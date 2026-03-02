/**
 * Profile service — manages the user's WallManifest and publishes content to IPFS/IPNS.
 *
 * Content model (IPNS root directory):
 *   manifest.json  — index: tag CID, wall post CIDs, following list
 *   tag.png        — 64×64 avatar (MY TAG)
 *
 * Wall PNGs are pinned as standalone CIDs referenced from manifest.json.
 * The directory is rebuilt and re-published to IPNS on every change.
 */

import { addBytes, addDirectory, getNodeId, publish } from './ipfs'

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
// We store the latest tag.png bytes locally so we can include them in the
// IPFS directory whenever a wall post is published (avoids a round-trip fetch).

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
 * Pins the PNG, updates manifest.tag, rebuilds the IPNS-root directory,
 * and re-publishes. Returns the root directory CID.
 */
export async function publishTag(png: Uint8Array): Promise<string> {
  const tagCid = await addBytes(png)
  _cacheTagPng(png)

  const manifest = loadManifest()
  manifest.tag = tagCid
  manifest.updatedAt = Date.now()

  const dirCid = await _publishDir(manifest, png)
  _saveManifest(manifest)
  return dirCid
}

/**
 * Publish a THE WALL post to IPFS/IPNS.
 * Prepends the post to wall[] (newest first), rebuilds the IPNS-root directory,
 * and re-publishes. Returns the root directory CID.
 */
export async function publishWallPost(png: Uint8Array, caption = ''): Promise<string> {
  const postCid = await addBytes(png)

  const manifest = loadManifest()
  manifest.wall = [{ cid: postCid, timestamp: Date.now(), caption }, ...manifest.wall]
  manifest.updatedAt = Date.now()

  const tagPng = _getCachedTagPng() ?? new Uint8Array(0)
  const dirCid = await _publishDir(manifest, tagPng)
  _saveManifest(manifest)
  return dirCid
}

// ── Internal: build IPFS directory + publish to IPNS ─────────────────────────

async function _publishDir(manifest: WallManifest, tagPng: Uint8Array): Promise<string> {
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2))
  const entries = [
    { path: 'manifest.json', data: manifestBytes },
    ...(tagPng.length > 0 ? [{ path: 'tag.png', data: tagPng }] : []),
  ]
  const dirCid = await addDirectory(entries)
  // IPNS publish is slow (DHT propagation); fire-and-forget so the UI isn't blocked.
  // The content is already pinned locally and reachable by CID immediately.
  publish(dirCid).catch(e => console.warn('[profile] IPNS publish failed:', e))
  return dirCid
}
