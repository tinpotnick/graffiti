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

import { addBytes, getNodeId, publish, resolve, catJson } from './ipfs'
import { pinFile } from './pinning'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface WallPost {
  cid: string
  timestamp: number
  caption: string
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
  pinFile(png, `tag-${tagCid.slice(-8)}.png`).catch(e => console.warn('[profile] tag pin failed:', e))

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
export async function publishWallPost(png: Uint8Array, caption = ''): Promise<string> {
  const postCid = await addBytes(png)
  pinFile(png, `wall-${postCid.slice(-8)}.png`).catch(e => console.warn('[profile] wall post pin failed:', e))

  const manifest = loadManifest()
  manifest.wall = [{ cid: postCid, timestamp: Date.now(), caption }, ...manifest.wall]
  manifest.updatedAt = Date.now()

  const manifestCid = await _publishManifest(manifest)
  _saveManifest(manifest)
  return manifestCid
}

// ── Internal: publish manifest to IPFS + IPNS ────────────────────────────────

async function _publishManifest(manifest: WallManifest): Promise<string> {
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2))
  const manifestCid = await addBytes(manifestBytes)
  // Pin manifest + publish to IPNS — both fire-and-forget
  pinFile(manifestBytes, 'manifest.json').catch(e => console.warn('[profile] manifest pin failed:', e))
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

/**
 * Resolve a followed peer's IPNS name and fetch their manifest.
 * Returns null if resolution fails (peer offline, no record, timeout).
 */
export async function resolveFollowedPeer(peerId: string): Promise<WallManifest | null> {
  try {
    const rootCid = await resolve(peerId)
    try {
      // Current format: IPNS → flat manifest JSON
      return await catJson<WallManifest>(rootCid)
    } catch {
      // Legacy format: IPNS → directory containing manifest.json
      console.info('[profile] Flat fetch failed, trying legacy directory format for', peerId)
      return await catJson<WallManifest>(rootCid, 'manifest.json')
    }
  } catch (err) {
    console.warn('[profile] Failed to resolve peer', peerId, err)
    return null
  }
}

/** Remove a peer from the following list and persist locally. */
export function unfollowPeer(peerId: string): void {
  const manifest = loadManifest()
  manifest.following = manifest.following.filter(id => id !== peerId)
  manifest.updatedAt = Date.now()
  _saveManifest(manifest)
}
