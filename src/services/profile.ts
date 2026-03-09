/**
 * Profile service — manages the user's WallManifest and publishes content to IPFS/IPNS.
 *
 * Content model:
 *   IPNS name → manifest CID (a single JSON file, not a directory)
 *   manifest.json contains CID references to tag.png and wall post images
 *
 * All images (tag, wall posts) are pinned as standalone CIDs.
 * The manifest is re-serialised, added to IPFS, pinned, and re-published
 * to IPNS on every change.
 */

import { addBytes, addJson, getNodeId, publish, resolve, catJson, serializeIPNSRecord, type IPNSRecord } from './ipfs'
import { pinFile } from './pinning'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WallPost {
  cid: string
  timestamp: number
  caption: string
  /** Post type — 'text' for markdown posts, undefined/'wall' for pixel art. */
  type?: 'wall' | 'text'
  /** Title for text posts (kept in manifest for feed snippets). */
  title?: string
  /** Top-left X of the cropped image on the 320×180 wall */
  x?: number
  /** Top-left Y of the cropped image on the 320×180 wall */
  y?: number
  /** Width of the cropped image */
  w?: number
  /** Height of the cropped image */
  h?: number
  /** CID of the original wall image this is a tag/delta on. Undefined for original walls. */
  wallRef?: string
  /** Bounds of the original wall image on the 320×180 canvas. */
  wallBounds?: { x: number; y: number; w: number; h: number }
}

export interface WallManifest {
  version: 1
  displayName: string
  /** CID of the latest tag.png, empty string if not yet published. */
  tag: string
  /** Wall posts, newest first. */
  wall: WallPost[]
  /** PeerIDs of followed users. */
  following: string[]
  /** Cached signed IPNS records for followed peers (peerId → base64 marshaled record). */
  peerRecords?: Record<string, string>
  updatedAt: number
}

// ── localStorage keys ─────────────────────────────────────────────────────────

const MANIFEST_KEY = 'graffiti:manifest'
const PEER_ID_KEY  = 'graffiti:peer-id'
/** base64-encoded bytes of the most recently published tag.png */
const TAG_PNG_KEY  = 'graffiti:tag-png'

// ── Manifest cache ────────────────────────────────────────────────────────────

function emptyManifest(): WallManifest {
  return { version: 1, displayName: '', tag: '', wall: [], following: [], updatedAt: 0 }
}

export function loadManifest(): WallManifest {
  try {
    const s = localStorage.getItem(MANIFEST_KEY)
    if (s) return JSON.parse(s) as WallManifest
  } catch { /* unavailable */ }
  return emptyManifest()
}

function _saveManifest(m: WallManifest): void {
  try { localStorage.setItem(MANIFEST_KEY, JSON.stringify(m)) } catch { /* unavailable */ }
}

// ── Tag PNG byte cache ────────────────────────────────────────────────────────
// We cache tag.png bytes locally so publishTag can pin them without re-fetching.

function _cacheTagPng(png: Uint8Array): void {
  try {
    let b = ''
    for (let i = 0; i < png.length; i++) b += String.fromCharCode(png[i])
    localStorage.setItem(TAG_PNG_KEY, btoa(b))
  } catch { /* unavailable */ }
}

function _getCachedTagPng(): Uint8Array | null {
  try {
    const s = localStorage.getItem(TAG_PNG_KEY)
    if (!s) return null
    const b = atob(s)
    const bytes = new Uint8Array(b.length)
    for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i)
    return bytes
  } catch { return null }
}

// ── IPNS record cache ────────────────────────────────────────────────────────
// Cached signed IPNS records for followed peers — survives resolution failures.

const IPNS_CACHE_PREFIX = 'graffiti:ipns-cache:'

interface CachedResolution {
  /** base64-encoded marshaled signed IPNS record */
  record: string
  /** CID the record resolved to */
  cid: string
  /** When we last successfully resolved this peer (epoch ms) */
  resolvedAt: number
}

function _cacheIPNSRecord(peerId: string, cid: string, record: IPNSRecord): void {
  const entry: CachedResolution = {
    record: serializeIPNSRecord(record),
    cid,
    resolvedAt: Date.now(),
  }
  try { localStorage.setItem(IPNS_CACHE_PREFIX + peerId, JSON.stringify(entry)) } catch { /* unavailable */ }
}

function _getCachedIPNSRecord(peerId: string): CachedResolution | null {
  try {
    const s = localStorage.getItem(IPNS_CACHE_PREFIX + peerId)
    if (!s) return null
    return JSON.parse(s) as CachedResolution
  } catch { return null }
}

// ── Identity ──────────────────────────────────────────────────────────────────

/** Return the local node's PeerID (cached in localStorage after first fetch). */
export async function getMyPeerId(): Promise<string> {
  const cached = localStorage.getItem(PEER_ID_KEY)
  if (cached) return cached
  const node = await getNodeId()
  localStorage.setItem(PEER_ID_KEY, node.id)
  return node.id
}

// ── Publish ───────────────────────────────────────────────────────────────────

/**
 * Publish MY TAG (64×64 PNG) to IPFS/IPNS.
 * Pins the PNG, updates manifest.tag, and re-publishes the manifest.
 * Returns the manifest CID.
 */
export async function publishTag(png: Uint8Array): Promise<string> {
  const tagCid = await addBytes(png)
  _cacheTagPng(png)
  pinFile(png, `tag-${tagCid.slice(-8)}.png`, tagCid).catch(e => console.warn('[profile] tag pin failed:', e))

  const manifest = loadManifest()
  manifest.tag = tagCid
  manifest.updatedAt = Date.now()

  const manifestCid = await _publishManifest(manifest)
  _saveManifest(manifest)
  return manifestCid
}

/**
 * Publish a THE WALL post to IPFS/IPNS.
 * Prepends the post to wall[] (newest first) and re-publishes the manifest.
 * Returns the manifest CID.
 */
export async function publishWallPost(
  png: Uint8Array,
  caption = '',
  bounds?: { x: number; y: number; w: number; h: number },
  wallRef?: { cid: string; bounds: { x: number; y: number; w: number; h: number } },
): Promise<string> {
  const postCid = await addBytes(png)
  pinFile(png, `wall-${postCid.slice(-8)}.png`, postCid).catch(e => console.warn('[profile] wall post pin failed:', e))

  const manifest = loadManifest()
  const post: WallPost = { cid: postCid, timestamp: Date.now(), caption }
  if (bounds) {
    post.x = bounds.x
    post.y = bounds.y
    post.w = bounds.w
    post.h = bounds.h
  }
  if (wallRef) {
    post.wallRef = wallRef.cid
    post.wallBounds = wallRef.bounds
  }
  manifest.wall = [post, ...manifest.wall]
  manifest.updatedAt = Date.now()

  const manifestCid = await _publishManifest(manifest)
  _saveManifest(manifest)
  return manifestCid
}

/**
 * Publish a text/markdown post to IPFS/IPNS.
 * Stores the markdown body in IPFS as a standalone CID;
 * the manifest only keeps the CID, title, and a short caption snippet.
 */
export async function publishTextPost(title: string, markdown: string): Promise<string> {
  const postCid = await addJson({ title, markdown })
  const snippetBytes = new TextEncoder().encode(JSON.stringify({ title, markdown }))
  pinFile(snippetBytes, `post-${postCid.slice(-8)}.json`, postCid).catch(e => console.warn('[profile] text post pin failed:', e))

  const manifest = loadManifest()
  const caption = markdown.replace(/[#*_`>\[\]!\-]/g, '').trim().slice(0, 140)
  const post: WallPost = {
    cid: postCid,
    timestamp: Date.now(),
    caption,
    type: 'text',
    title,
  }
  manifest.wall = [post, ...manifest.wall]
  manifest.updatedAt = Date.now()

  const manifestCid = await _publishManifest(manifest)
  _saveManifest(manifest)
  return manifestCid
}

// ── Internal: publish manifest to IPFS + IPNS ────────────────────────────────

async function _publishManifest(manifest: WallManifest): Promise<string> {
  // Embed cached IPNS records for followed peers (gossip hints for other followers)
  const peerRecords: Record<string, string> = {}
  for (const peerId of manifest.following) {
    const cached = _getCachedIPNSRecord(peerId)
    if (cached) peerRecords[peerId] = cached.record
  }
  if (Object.keys(peerRecords).length > 0) {
    manifest.peerRecords = peerRecords
  } else {
    delete manifest.peerRecords
  }

  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2))
  const manifestCid = await addBytes(manifestBytes)
  // Pin manifest + publish to IPNS — both fire-and-forget
  pinFile(manifestBytes, 'manifest.json', manifestCid).catch(e => console.warn('[profile] manifest pin failed:', e))
  publish(manifestCid).catch(e => console.warn('[profile] IPNS publish failed:', e))
  return manifestCid
}

// ── Follow management ─────────────────────────────────────────────────────────

/** Add a peer to the following list and persist locally (re-publishes to IPNS in background). */
export async function followPeer(peerId: string): Promise<void> {
  const manifest = loadManifest()
  if (manifest.following.includes(peerId)) return
  manifest.following = [...manifest.following, peerId]
  manifest.updatedAt = Date.now()
  _saveManifest(manifest)
  _publishManifest(manifest).catch(e => console.warn('[profile] republish after follow failed:', e))
}

/** Result of resolving a followed peer — includes staleness metadata. */
export interface PeerResolution {
  manifest: WallManifest
  /** True when the result came from a cached IPNS record (may be outdated). */
  stale: boolean
  /** When the IPNS record was last successfully resolved (epoch ms). */
  resolvedAt: number
}

/** Fetch a manifest from a CID, trying flat JSON then legacy directory format. */
async function _fetchManifest(cid: string): Promise<WallManifest | null> {
  try {
    return await catJson<WallManifest>(cid)
  } catch {
    console.info('[profile] Flat fetch failed, trying legacy directory format')
    try {
      return await catJson<WallManifest>(cid, 'manifest.json')
    } catch {
      return null
    }
  }
}

/**
 * Resolve a followed peer's IPNS name and fetch their manifest.
 * Caches the signed IPNS record on success; falls back to cache on failure.
 * Returns null only if both live resolution and cache miss.
 */
export async function resolveFollowedPeer(peerId: string): Promise<PeerResolution | null> {
  // 1. Try live IPNS resolution
  try {
    const { cid, record } = await resolve(peerId)
    _cacheIPNSRecord(peerId, cid, record)
    const manifest = await _fetchManifest(cid)
    if (manifest) return { manifest, stale: false, resolvedAt: Date.now() }
  } catch (err) {
    console.warn('[profile] Live IPNS resolution failed for', peerId, err)
  }

  // 2. Fall back to local cache
  const cached = _getCachedIPNSRecord(peerId)
  if (cached) {
    console.info('[profile] Using cached IPNS record for', peerId, '(resolved', new Date(cached.resolvedAt).toISOString(), ')')
    try {
      const manifest = await _fetchManifest(cached.cid)
      if (manifest) return { manifest, stale: true, resolvedAt: cached.resolvedAt }
    } catch {
      console.warn('[profile] Cached CID fetch also failed for', peerId)
    }
  }

  return null
}

/** Remove a peer from the following list and persist locally. */
export function unfollowPeer(peerId: string): void {
  const manifest = loadManifest()
  manifest.following = manifest.following.filter(id => id !== peerId)
  manifest.updatedAt = Date.now()
  _saveManifest(manifest)
  try { localStorage.removeItem(IPNS_CACHE_PREFIX + peerId) } catch { /* unavailable */ }
}
