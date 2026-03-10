/**
 * Profile service — manages the user's manifest and publishes content to IPFS/IPNS.
 *
 * Content model (v2):
 *   IPNS name → root manifest CID (small JSON with CID pointers)
 *     → monthly post buckets (CID → JSON file per year-month)
 *     → monthly like buckets (CID → JSON file per year-month)
 *
 * The root manifest is small (~1KB). Monthly buckets are only re-published
 * when their contents change, so a single like doesn't force peers to
 * re-download all posts.
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
  /** When the post was last edited (epoch ms). Undefined for never-edited posts. */
  updatedAt?: number
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

/** Year-month key, e.g. "2026-03" */
type YearMonth = string

/** Maps year-month keys to CIDs of monthly JSON files. */
type BucketIndex = Record<YearMonth, string>

export interface LikeRecord {
  /** CID of the liked content. */
  target: string
  /** PeerID of the original content author. */
  author: string
  timestamp: number
  /** 1 = like, 2 = really like. Mutually exclusive (strength score). */
  strength: 1 | 2
}

export interface PostsBucket {
  month: YearMonth
  posts: WallPost[]
}

export interface LikesBucket {
  month: YearMonth
  likes: LikeRecord[]
}

export interface DraftEntry {
  id: string
  title: string
  markdown: string
  /** IPFS content CID for the {title, markdown} JSON. */
  cid: string
  updatedAt: number
  createdAt: number
}

export interface DraftsBucket {
  drafts: DraftEntry[]
}

/** v1 manifest — kept for migration and remote peer compat. */
interface WallManifestV1 {
  version: 1
  displayName: string
  tag: string
  wall: WallPost[]
  following: string[]
  peerRecords?: Record<string, string>
  updatedAt: number
}

export interface WallManifest {
  version: 2
  displayName: string
  /** CID of the latest tag.png, empty string if not yet published. */
  tag: string
  /** PeerIDs of followed users. */
  following: string[]
  /** CID pointers to monthly post files, keyed by year-month. */
  posts: BucketIndex
  /** CID pointers to monthly like files, keyed by year-month. */
  likes: BucketIndex
  /** CID of the drafts bucket (optional, omitted if no drafts). */
  drafts?: string
  /** Cached signed IPNS records for followed peers (peerId → base64 marshaled record). */
  peerRecords?: Record<string, string>
  updatedAt: number
}

/** Manifest with inline posts — used when converting remote v1 peers for read-only display. */
export type ResolvedManifest = WallManifest & { _inlinePosts?: WallPost[] }

// ── localStorage keys ─────────────────────────────────────────────────────────

const MANIFEST_KEY = 'graffiti:manifest'
const PEER_ID_KEY  = 'graffiti:peer-id'
/** base64-encoded bytes of the most recently published tag.png */
const TAG_PNG_KEY  = 'graffiti:tag-png'
const BUCKET_PREFIX = 'graffiti:bucket:'
const DRAFTS_KEY   = 'graffiti:drafts'

// ── Year-month helper ─────────────────────────────────────────────────────────

function yearMonth(ts: number = Date.now()): YearMonth {
  const d = new Date(ts)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Return the current month and the N-1 preceding months as YearMonth strings. */
export function recentMonths(count: number = 2): YearMonth[] {
  const result: YearMonth[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    result.push(yearMonth(d.getTime()))
  }
  return result
}

// ── Bucket localStorage helpers ───────────────────────────────────────────────

function _saveBucket<T>(kind: 'posts' | 'likes', month: YearMonth, data: T): void {
  try { localStorage.setItem(`${BUCKET_PREFIX}${kind}:${month}`, JSON.stringify(data)) } catch { /* unavailable */ }
}

function _loadBucket<T>(kind: 'posts' | 'likes', month: YearMonth): T | null {
  try {
    const s = localStorage.getItem(`${BUCKET_PREFIX}${kind}:${month}`)
    return s ? JSON.parse(s) as T : null
  } catch { return null }
}

// ── Manifest cache ────────────────────────────────────────────────────────────

/** PeerIDs that new users auto-follow so the feed isn't empty on first launch. */
const DEFAULT_FOLLOWS = [
  '12D3KooWAALMJ8M8f4MH9hx4VGsUxSkAGYD4uRGggGAfoLyP6dsK', // nick
]

function emptyManifest(): WallManifest {
  const myPeerId = localStorage.getItem(PEER_ID_KEY) ?? ''
  const following = DEFAULT_FOLLOWS.filter(id => id !== myPeerId)
  return { version: 2, displayName: '', tag: '', following, posts: {}, likes: {}, updatedAt: 0 }
}

export function loadManifest(): WallManifest {
  try {
    const s = localStorage.getItem(MANIFEST_KEY)
    if (s) {
      const raw = JSON.parse(s)
      if (raw.version === 1) return _migrateV1toV2(raw as WallManifestV1)
      return raw as WallManifest
    }
  } catch { /* unavailable */ }
  return emptyManifest()
}

function _saveManifest(m: WallManifest): void {
  try { localStorage.setItem(MANIFEST_KEY, JSON.stringify(m)) } catch { /* unavailable */ }
}

/** Migrate a v1 manifest to v2 shape. Groups wall[] by month into localStorage buckets. */
function _migrateV1toV2(v1: WallManifestV1): WallManifest {
  // Group existing posts by month
  const postsByMonth = new Map<YearMonth, WallPost[]>()
  for (const post of v1.wall) {
    const ym = yearMonth(post.timestamp)
    const arr = postsByMonth.get(ym) ?? []
    arr.push(post)
    postsByMonth.set(ym, arr)
  }

  // Store raw monthly post data in localStorage — CIDs assigned on next publish
  for (const [month, posts] of postsByMonth) {
    const bucket: PostsBucket = { month, posts }
    _saveBucket('posts', month, bucket)
  }

  const v2: WallManifest = {
    version: 2,
    displayName: v1.displayName,
    tag: v1.tag,
    following: v1.following,
    posts: {},   // CIDs assigned on first publish via _ensureBucketsCidified
    likes: {},
    peerRecords: v1.peerRecords,
    updatedAt: v1.updatedAt,
  }

  _saveManifest(v2)
  console.info('[profile] Migrated manifest v1 → v2, grouped', postsByMonth.size, 'months of posts')
  return v2
}

// ── Tag PNG byte cache ────────────────────────────────────────────────────────

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

// ── Bucket IPFS publishing ────────────────────────────────────────────────────

/** Serialize a monthly bucket to IPFS and pin. Returns CID string. */
async function _publishBucket(kind: 'posts' | 'likes', month: YearMonth, data: unknown): Promise<string> {
  const json = JSON.stringify(data, null, 2)
  const bytes = new TextEncoder().encode(json)
  const cid = await addBytes(bytes)
  pinFile(bytes, `${kind}-${month}.json`, cid).catch(e =>
    console.warn(`[profile] ${kind} bucket pin failed:`, e)
  )
  return cid
}

/**
 * Ensure all localStorage buckets have CIDs in the manifest.
 * Called during publish to catch migration leftovers (v1→v2 creates buckets without CIDs).
 */
async function _ensureBucketsCidified(manifest: WallManifest): Promise<boolean> {
  let changed = false

  // Scan localStorage for post buckets without manifest CID entries
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key) continue

    if (key.startsWith(`${BUCKET_PREFIX}posts:`)) {
      const month = key.slice(`${BUCKET_PREFIX}posts:`.length)
      if (!manifest.posts[month]) {
        const bucket = _loadBucket<PostsBucket>('posts', month)
        if (bucket && bucket.posts.length > 0) {
          manifest.posts[month] = await _publishBucket('posts', month, bucket)
          changed = true
        }
      }
    }

    if (key.startsWith(`${BUCKET_PREFIX}likes:`)) {
      const month = key.slice(`${BUCKET_PREFIX}likes:`.length)
      if (!manifest.likes[month]) {
        const bucket = _loadBucket<LikesBucket>('likes', month)
        if (bucket && bucket.likes.length > 0) {
          manifest.likes[month] = await _publishBucket('likes', month, bucket)
          changed = true
        }
      }
    }
  }

  return changed
}

// ── Publish ───────────────────────────────────────────────────────────────────

/**
 * Publish MY TAG (64×64 PNG) to IPFS/IPNS.
 * Pins the PNG, updates manifest.tag, and re-publishes the manifest.
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
 * Publish a wall post to IPFS/IPNS.
 * Adds the post to the current month's posts bucket and re-publishes the manifest.
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

  const month = yearMonth()
  const bucket = _loadBucket<PostsBucket>('posts', month) ?? { month, posts: [] }
  bucket.posts = [post, ...bucket.posts]

  const bucketCid = await _publishBucket('posts', month, bucket)
  manifest.posts[month] = bucketCid
  manifest.updatedAt = Date.now()

  _saveBucket('posts', month, bucket)
  const manifestCid = await _publishManifest(manifest)
  _saveManifest(manifest)
  return manifestCid
}

/**
 * Publish a text/markdown post to IPFS/IPNS.
 * Stores the markdown body in IPFS as a standalone CID;
 * the bucket keeps the CID, title, and a short caption snippet.
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

  const month = yearMonth()
  const bucket = _loadBucket<PostsBucket>('posts', month) ?? { month, posts: [] }
  bucket.posts = [post, ...bucket.posts]

  const bucketCid = await _publishBucket('posts', month, bucket)
  manifest.posts[month] = bucketCid
  manifest.updatedAt = Date.now()

  _saveBucket('posts', month, bucket)
  const manifestCid = await _publishManifest(manifest)
  _saveManifest(manifest)
  return manifestCid
}

// ── Delete / Update posts ─────────────────────────────────────────────────────

/**
 * Delete a post by CID. Removes it from the appropriate monthly bucket
 * and re-publishes the manifest.
 */
export async function deletePost(cid: string): Promise<void> {
  const manifest = loadManifest()

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(`${BUCKET_PREFIX}posts:`)) continue
    const month = key.slice(`${BUCKET_PREFIX}posts:`.length)
    const bucket = _loadBucket<PostsBucket>('posts', month)
    if (!bucket) continue
    const idx = bucket.posts.findIndex(p => p.cid === cid)
    if (idx < 0) continue

    bucket.posts.splice(idx, 1)
    const bucketCid = await _publishBucket('posts', month, bucket)
    manifest.posts[month] = bucketCid
    manifest.updatedAt = Date.now()
    _saveBucket('posts', month, bucket)
    _saveManifest(manifest)
    await _publishManifest(manifest)
    return
  }
}

/**
 * Update a published text post. Replaces the old entry in its bucket with
 * new content (new CID, title, caption) and sets updatedAt.
 */
export async function updateTextPost(oldCid: string, title: string, markdown: string): Promise<string> {
  const newCid = await addJson({ title, markdown })
  const snippetBytes = new TextEncoder().encode(JSON.stringify({ title, markdown }))
  pinFile(snippetBytes, `post-${newCid.slice(-8)}.json`, newCid).catch(e => console.warn('[profile] text post pin failed:', e))

  const manifest = loadManifest()
  const caption = markdown.replace(/[#*_`>\[\]!\-]/g, '').trim().slice(0, 140)

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(`${BUCKET_PREFIX}posts:`)) continue
    const month = key.slice(`${BUCKET_PREFIX}posts:`.length)
    const bucket = _loadBucket<PostsBucket>('posts', month)
    if (!bucket) continue
    const idx = bucket.posts.findIndex(p => p.cid === oldCid)
    if (idx < 0) continue

    bucket.posts[idx] = {
      ...bucket.posts[idx],
      cid: newCid,
      title,
      caption,
      updatedAt: Date.now(),
    }

    const bucketCid = await _publishBucket('posts', month, bucket)
    manifest.posts[month] = bucketCid
    manifest.updatedAt = Date.now()
    _saveBucket('posts', month, bucket)
    const manifestCid = await _publishManifest(manifest)
    _saveManifest(manifest)
    return manifestCid
  }

  throw new Error(`Post not found: ${oldCid}`)
}

// ── Likes ─────────────────────────────────────────────────────────────────────

/**
 * Like or really-like a post. Strength: 1 = like, 2 = really like.
 * If an existing interaction exists (any month), it is upgraded/downgraded.
 * Returns the manifest CID, or empty string if no change was needed.
 */
export async function likePost(targetCid: string, authorPeerId: string, strength: 1 | 2): Promise<string> {
  const manifest = loadManifest()

  // Check for existing interaction across all months — remove if found
  const existingMonth = _findInteractionMonth(manifest, targetCid)
  if (existingMonth) {
    const oldBucket = _loadBucket<LikesBucket>('likes', existingMonth)!
    const existing = oldBucket.likes.find(l => l.target === targetCid)
    if (existing && existing.strength === strength) {
      return '' // Same strength, no-op
    }
    // Remove old interaction (will be replaced with new strength)
    oldBucket.likes = oldBucket.likes.filter(l => l.target !== targetCid)
    const oldCid = await _publishBucket('likes', existingMonth, oldBucket)
    manifest.likes[existingMonth] = oldCid
    _saveBucket('likes', existingMonth, oldBucket)
  }

  const month = yearMonth()
  const bucket = _loadBucket<LikesBucket>('likes', month) ?? { month, likes: [] }

  const record: LikeRecord = {
    target: targetCid,
    author: authorPeerId,
    timestamp: Date.now(),
    strength,
  }
  bucket.likes = [record, ...bucket.likes]

  const bucketCid = await _publishBucket('likes', month, bucket)
  manifest.likes[month] = bucketCid
  manifest.updatedAt = Date.now()

  _saveBucket('likes', month, bucket)
  const manifestCid = await _publishManifest(manifest)
  _saveManifest(manifest)
  return manifestCid
}

/** Remove a like/really-like. Returns the manifest CID, or empty string if not found. */
export async function unlikePost(targetCid: string): Promise<string> {
  const manifest = loadManifest()
  const month = _findInteractionMonth(manifest, targetCid)
  if (!month) return ''

  const bucket = _loadBucket<LikesBucket>('likes', month)!
  bucket.likes = bucket.likes.filter(l => l.target !== targetCid)

  const bucketCid = await _publishBucket('likes', month, bucket)
  manifest.likes[month] = bucketCid
  manifest.updatedAt = Date.now()

  _saveBucket('likes', month, bucket)
  const manifestCid = await _publishManifest(manifest)
  _saveManifest(manifest)
  return manifestCid
}

/** Find which month contains an interaction for a given target CID. */
function _findInteractionMonth(manifest: WallManifest, targetCid: string): YearMonth | null {
  for (const month of Object.keys(manifest.likes)) {
    const bucket = _loadBucket<LikesBucket>('likes', month)
    if (bucket && bucket.likes.some(l => l.target === targetCid)) return month
  }
  return null
}

// ── Drafts ────────────────────────────────────────────────────────────────────

function _loadDrafts(): DraftEntry[] {
  try {
    const s = localStorage.getItem(DRAFTS_KEY)
    return s ? JSON.parse(s) as DraftEntry[] : []
  } catch { return [] }
}

function _saveDrafts(drafts: DraftEntry[]): void {
  try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)) } catch { /* unavailable */ }
}

async function _publishDrafts(drafts: DraftEntry[], manifest: WallManifest): Promise<void> {
  if (drafts.length === 0) {
    delete manifest.drafts
  } else {
    const bucket: DraftsBucket = { drafts }
    const json = JSON.stringify(bucket, null, 2)
    const bytes = new TextEncoder().encode(json)
    const cid = await addBytes(bytes)
    pinFile(bytes, 'drafts.json', cid).catch(e => console.warn('[profile] drafts bucket pin failed:', e))
    manifest.drafts = cid
  }
  manifest.updatedAt = Date.now()
  _saveManifest(manifest)
  _publishManifest(manifest).catch(e => console.warn('[profile] republish after drafts change failed:', e))
}

/** Get all drafts from localStorage. */
export function loadDrafts(): DraftEntry[] {
  return _loadDrafts()
}

/**
 * Save a draft to IPFS and localStorage.
 * If draftId is provided, updates an existing draft; otherwise creates a new one.
 * Returns the draft ID.
 */
export async function saveDraft(title: string, markdown: string, draftId?: string): Promise<string> {
  const contentCid = await addJson({ title, markdown })
  const snippetBytes = new TextEncoder().encode(JSON.stringify({ title, markdown }))
  pinFile(snippetBytes, `draft-${contentCid.slice(-8)}.json`, contentCid).catch(e =>
    console.warn('[profile] draft content pin failed:', e)
  )

  const drafts = _loadDrafts()
  const now = Date.now()
  let id: string

  if (draftId) {
    id = draftId
    const idx = drafts.findIndex(d => d.id === draftId)
    if (idx >= 0) {
      drafts[idx] = { ...drafts[idx], title, markdown, cid: contentCid, updatedAt: now }
    } else {
      drafts.unshift({ id, title, markdown, cid: contentCid, updatedAt: now, createdAt: now })
    }
  } else {
    id = `d_${now}`
    drafts.unshift({ id, title, markdown, cid: contentCid, updatedAt: now, createdAt: now })
  }

  _saveDrafts(drafts)
  await _publishDrafts(drafts, loadManifest())
  return id
}

/** Delete a draft by ID. */
export async function deleteDraft(draftId: string): Promise<void> {
  const drafts = _loadDrafts().filter(d => d.id !== draftId)
  _saveDrafts(drafts)
  await _publishDrafts(drafts, loadManifest())
}

/**
 * Publish a draft as a text post, then remove it from drafts.
 * Returns the manifest CID from publishTextPost.
 */
export async function publishDraft(draftId: string): Promise<string> {
  const drafts = _loadDrafts()
  const draft = drafts.find(d => d.id === draftId)
  if (!draft) throw new Error(`Draft not found: ${draftId}`)

  const manifestCid = await publishTextPost(draft.title, draft.markdown)

  const remaining = drafts.filter(d => d.id !== draftId)
  _saveDrafts(remaining)
  // Update manifest drafts field (publishTextPost already saved/published the manifest,
  // so reload the fresh copy before updating drafts)
  await _publishDrafts(remaining, loadManifest())
  return manifestCid
}

// ── Local data getters (for own feed) ─────────────────────────────────────────

/** Get own posts for the given months from localStorage. */
export function getMyPosts(months: YearMonth[]): WallPost[] {
  const posts: WallPost[] = []
  for (const m of months) {
    const bucket = _loadBucket<PostsBucket>('posts', m)
    if (bucket) posts.push(...bucket.posts)
  }
  return posts
}

/** Get all own posts across all months from localStorage. */
export function getAllMyPosts(): WallPost[] {
  const posts: WallPost[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(`${BUCKET_PREFIX}posts:`)) continue
    try {
      const bucket = JSON.parse(localStorage.getItem(key)!) as PostsBucket
      posts.push(...bucket.posts)
    } catch { /* skip */ }
  }
  return posts
}

/** Get own likes for the given months from localStorage. */
export function getMyLikes(months: YearMonth[]): LikeRecord[] {
  const likes: LikeRecord[] = []
  for (const m of months) {
    const bucket = _loadBucket<LikesBucket>('likes', m)
    if (bucket) likes.push(...bucket.likes)
  }
  return likes
}

/** Get all own likes across all months from localStorage. */
export function getAllMyLikes(): LikeRecord[] {
  const likes: LikeRecord[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key?.startsWith(`${BUCKET_PREFIX}likes:`)) continue
    try {
      const bucket = JSON.parse(localStorage.getItem(key)!) as LikesBucket
      likes.push(...bucket.likes)
    } catch { /* skip */ }
  }
  return likes
}

// ── Peer bucket fetching ──────────────────────────────────────────────────────

/** Fetch a peer's posts for the given months by resolving bucket CIDs. */
export async function fetchPeerPostBuckets(
  manifest: WallManifest,
  months: YearMonth[],
): Promise<WallPost[]> {
  const results = await Promise.all(
    months.map(async (m) => {
      const cid = manifest.posts[m]
      if (!cid) return []
      try {
        const bucket = await catJson<PostsBucket>(cid)
        return bucket.posts
      } catch {
        console.warn('[profile] Failed to fetch posts bucket', m)
        return []
      }
    })
  )
  return results.flat()
}

export interface PeerInteractions {
  likes: LikeRecord[]
}

/** Fetch a peer's likes for the given months by resolving bucket CIDs. */
export async function fetchPeerInteractions(
  manifest: WallManifest,
  months: YearMonth[],
): Promise<PeerInteractions> {
  const results = await Promise.all(
    months.map(async (m) => {
      const cid = manifest.likes[m]
      if (!cid) return []
      try {
        const bucket = await catJson<LikesBucket>(cid)
        return bucket.likes
      } catch {
        console.warn('[profile] Failed to fetch likes bucket', m)
        return []
      }
    })
  )
  return { likes: results.flat() }
}

// ── Internal: publish manifest to IPFS + IPNS ────────────────────────────────

async function _publishManifest(manifest: WallManifest): Promise<string> {
  // Ensure migrated buckets have CIDs
  await _ensureBucketsCidified(manifest)

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

/** Update the local user's display name and re-publish the manifest. */
export function setDisplayName(name: string): void {
  const manifest = loadManifest()
  manifest.displayName = name.trim()
  manifest.updatedAt = Date.now()
  _saveManifest(manifest)
  _publishManifest(manifest).catch(e => console.warn('[profile] republish after displayName change failed:', e))
}

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
  manifest: ResolvedManifest
  /** True when the result came from a cached IPNS record (may be outdated). */
  stale: boolean
  /** When the IPNS record was last successfully resolved (epoch ms). */
  resolvedAt: number
}

/** Fetch a manifest from a CID, trying flat JSON then legacy directory format. Handles v1→v2 conversion. */
async function _fetchManifest(cid: string): Promise<ResolvedManifest | null> {
  try {
    const raw = await catJson<any>(cid)
    if (raw.version === 1) return _convertRemoteV1(raw as WallManifestV1)
    return raw as WallManifest
  } catch {
    console.info('[profile] Flat fetch failed, trying legacy directory format')
    try {
      const raw = await catJson<any>(cid, 'manifest.json')
      if (raw.version === 1) return _convertRemoteV1(raw as WallManifestV1)
      return raw as WallManifest
    } catch {
      return null
    }
  }
}

/** Convert a remote v1 manifest to v2 shape for read-only display. */
function _convertRemoteV1(v1: WallManifestV1): ResolvedManifest {
  return {
    version: 2,
    displayName: v1.displayName,
    tag: v1.tag,
    following: v1.following,
    posts: {},
    likes: {},
    peerRecords: v1.peerRecords,
    updatedAt: v1.updatedAt,
    _inlinePosts: v1.wall,
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
