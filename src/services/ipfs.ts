/**
 * IPFS service — Helia in-process node with IPNS over PubSub.
 *
 * Content operations (add/cat) run locally against an IndexedDB blockstore.
 * The blockstore and datastore are IDB-backed so the node's identity (PeerID)
 * is stable across app restarts.
 *
 * IPNS publishing uses GossipSub (PubSub) for instant peer updates.
 * The @helia/ipns library handles automatic re-publishing (~hourly) to keep
 * records alive in the DHT.
 *
 * Remote persistence: handled by the pinning service (Pinata).
 */

import { createHelia, libp2pDefaults, type Helia } from 'helia'
import { unixfs } from '@helia/unixfs'
import { ipns, type IPNS } from '@helia/ipns'
import { helia as heliaRouting, pubsub } from '@helia/ipns/routing'
import { gossipsub } from '@chainsafe/libp2p-gossipsub'
import { IDBBlockstore } from 'blockstore-idb'
import { IDBDatastore } from 'datastore-idb'
import { CID } from 'multiformats/cid'
import { peerIdFromString } from '@libp2p/peer-id'
import { getPinataGateway } from './pinning'

// ── Singleton ──────────────────────────────────────────────────────────────────

let _helia: Helia | null = null
let _fs: ReturnType<typeof unixfs> | null = null
let _name: IPNS | null = null

/** Initialise Helia with persistent IDB stores + GossipSub. Safe to call multiple times. */
export async function initHelia(): Promise<void> {
  if (_helia) return

  const blockstore = new IDBBlockstore('graffiti-blocks')
  const datastore = new IDBDatastore('graffiti-data')
  await blockstore.open()
  await datastore.open()

  // Browser defaults + GossipSub for IPNS over PubSub
  const libp2pOptions = libp2pDefaults()
  ;(libp2pOptions.services as Record<string, unknown>).pubsub = gossipsub()

  // Request persistent storage so the browser won't evict IndexedDB under pressure
  if (navigator.storage?.persist) {
    const persistent = await navigator.storage.persist()
    console.info('[ipfs] Persistent storage:', persistent ? 'granted' : 'denied')
  }

  const helia = await createHelia({ blockstore, datastore, libp2p: libp2pOptions })
  _helia = helia
  _fs = unixfs(helia)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Helia's generic doesn't reflect runtime services
  const h = helia as any
  _name = ipns(h, { routers: [heliaRouting(h), pubsub(h)] })
}

async function _getHelia(): Promise<Helia> {
  if (!_helia) await initHelia()
  return _helia!
}

async function _getFs(): Promise<ReturnType<typeof unixfs>> {
  if (!_fs) await initHelia()
  return _fs!
}

async function _getName(): Promise<IPNS> {
  if (!_name) await initHelia()
  return _name!
}

// ── Identity ───────────────────────────────────────────────────────────────────

export interface NodeId {
  /** PeerID — the user's permanent identity / IPNS name. */
  id: string
  publicKey: string
  addresses: string[]
  agentVersion: string
}

export async function getNodeId(): Promise<NodeId> {
  const h = await _getHelia()
  return {
    id: h.libp2p.peerId.toString(),
    publicKey: '',
    addresses: h.libp2p.getMultiaddrs().map((a: { toString(): string }) => a.toString()),
    agentVersion: 'helia',
  }
}

// ── Add content ────────────────────────────────────────────────────────────────

/** Add raw bytes to the local blockstore. Returns CID string. */
export async function addBytes(data: Uint8Array): Promise<string> {
  const fs = await _getFs()
  const cid = await fs.addBytes(data)
  return cid.toString()
}

/** Serialise an object to JSON and add it. Returns CID string. */
export async function addJson(obj: unknown): Promise<string> {
  return addBytes(new TextEncoder().encode(JSON.stringify(obj)))
}

// ── Read content ───────────────────────────────────────────────────────────────

// Public IPFS gateways for fallback when Helia's bitswap/delegated routing fails.
const PUBLIC_GATEWAYS = [
  'https://ipfs.io/ipfs',
  'https://dweb.link/ipfs',
]

/** Build gateway list — Pinata dedicated gateway first (if configured), then public. */
function _getGateways(): string[] {
  const pinata = getPinataGateway()
  if (pinata) return [`${pinata}/ipfs`, ...PUBLIC_GATEWAYS]
  return PUBLIC_GATEWAYS
}

/**
 * Fetch raw bytes for a CID, optionally resolving a path within a UnixFS directory.
 * Tries Helia first (instant for local content), falls back to public IPFS gateways
 * if the network fetch fails (browser nodes often can't reach peers directly).
 */
export async function catBytes(cid: string, path?: string): Promise<Uint8Array> {
  // Try Helia first — instant for local content (own posts in IndexedDB)
  try {
    const fs = await _getFs()
    const chunks: Uint8Array[] = []
    const opts: Record<string, unknown> = { signal: AbortSignal.timeout(10_000) }
    if (path) opts.path = path
    for await (const chunk of fs.cat(CID.parse(cid), opts)) {
      chunks.push(chunk)
    }
    return _concatChunks(chunks)
  } catch (err) {
    console.warn('[ipfs] Helia fetch failed, trying gateways:', (err as Error).message)
  }

  // Gateway fallback — try each until one succeeds
  const suffix = path ? `/${cid}/${path}` : `/${cid}`
  for (const gw of _getGateways()) {
    try {
      const res = await fetch(`${gw}${suffix}`, { signal: AbortSignal.timeout(30_000) })
      if (res.ok) {
        console.info('[ipfs] Gateway fetch succeeded:', gw)
        return new Uint8Array(await res.arrayBuffer())
      }
    } catch { /* try next gateway */ }
  }

  throw new Error(`Failed to fetch ${cid}${path ? '/' + path : ''} from Helia and all gateways`)
}

function _concatChunks(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

/** Fetch and JSON-parse a CID, optionally resolving a path within a UnixFS directory. */
export async function catJson<T>(cid: string, path?: string): Promise<T> {
  const bytes = await catBytes(cid, path)
  const text = new TextDecoder().decode(bytes)
  try {
    return JSON.parse(text) as T
  } catch {
    console.warn('[ipfs] catJson: response is not valid JSON for', cid, '— first 200 chars:', text.slice(0, 200))
    throw new Error(`CID ${cid} did not resolve to valid JSON (got ${bytes.length} bytes)`)
  }
}

// ── IPNS ───────────────────────────────────────────────────────────────────────

/**
 * Publish a CID under this node's IPNS name via DHT + PubSub.
 * Uses the 'self' keychain key (the node's own identity).
 * Returns the PeerID string (the IPNS name).
 */
export async function publish(cid: string): Promise<string> {
  const h = await _getHelia()
  const name = await _getName()
  try {
    await name.publish('self', CID.parse(cid))
    console.info('[ipfs] IPNS published', cid, 'under', h.libp2p.peerId.toString())
  } catch (err) {
    // PubSub publish fails when no peers are subscribed — non-fatal.
    // The record is still stored locally and will propagate when peers connect.
    console.warn('[ipfs] IPNS publish partial (no peers yet):', (err as Error).message)
  }
  return h.libp2p.peerId.toString()
}

/**
 * Resolve an IPNS name (PeerID string) to a CID string via PubSub + DHT.
 * Times out after 30 seconds if the peer has never published.
 */
export async function resolve(peerId: string): Promise<string> {
  const name = await _getName()
  const pid = peerIdFromString(peerId)
  const { cid } = await name.resolve(pid, { signal: AbortSignal.timeout(30_000) })
  console.info('[ipfs] IPNS resolved', peerId, '->', cid.toString())
  return cid.toString()
}
