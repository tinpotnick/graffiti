/**
 * IPFS service — Helia in-process node (no daemon required).
 *
 * Content operations (add/cat) run locally against an IndexedDB blockstore.
 * The blockstore and datastore are IDB-backed so the node's identity (PeerID)
 * is stable across app restarts.
 *
 * Remote persistence: handled by the pinning service (Pinata).
 * IPNS publishing: stubbed — content is accessible by CID via Pinata.
 *   Full IPNS support (delegated routing) is deferred pending ecosystem stability.
 */

import { createHelia, type Helia } from 'helia'
import { unixfs } from '@helia/unixfs'
import { IDBBlockstore } from 'blockstore-idb'
import { IDBDatastore } from 'datastore-idb'
import { CID } from 'multiformats/cid'

// ── Singleton ──────────────────────────────────────────────────────────────────

let _helia: Helia | null = null
let _fs: ReturnType<typeof unixfs> | null = null

/** Initialise Helia with persistent IDB stores. Safe to call multiple times. */
export async function initHelia(): Promise<void> {
  if (_helia) return

  const blockstore = new IDBBlockstore('graffiti-blocks')
  const datastore = new IDBDatastore('graffiti-data')
  await blockstore.open()
  await datastore.open()

  _helia = await createHelia({ blockstore, datastore })
  _fs = unixfs(_helia)
}

async function _getHelia(): Promise<Helia> {
  if (!_helia) await initHelia()
  return _helia!
}

async function _getFs(): Promise<ReturnType<typeof unixfs>> {
  if (!_fs) await initHelia()
  return _fs!
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
    addresses: h.libp2p.getMultiaddrs().map(a => a.toString()),
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

/** Fetch raw bytes for a CID. */
export async function catBytes(cid: string): Promise<Uint8Array> {
  const fs = await _getFs()
  const chunks: Uint8Array[] = []
  for await (const chunk of fs.cat(CID.parse(cid))) {
    chunks.push(chunk)
  }
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    out.set(chunk, offset)
    offset += chunk.length
  }
  return out
}

/** Fetch and JSON-parse a CID. */
export async function catJson<T>(cid: string): Promise<T> {
  const bytes = await catBytes(cid)
  return JSON.parse(new TextDecoder().decode(bytes)) as T
}

// ── Directories ────────────────────────────────────────────────────────────────

export interface DirEntry {
  /** Relative path within the directory, e.g. "manifest.json" */
  path: string
  data: Uint8Array
}

/**
 * Add multiple files as a wrapped UnixFS directory.
 * Returns the root directory CID string.
 */
export async function addDirectory(entries: DirEntry[]): Promise<string> {
  const fs = await _getFs()
  const source = entries.map(({ path, data }) => ({ path, content: data }))
  let rootCid: CID | undefined
  for await (const result of fs.addAll(source, { wrapWithDirectory: true })) {
    if (result.path === '') rootCid = result.cid
  }
  if (!rootCid) throw new Error('addDirectory: no root entry in result')
  return rootCid.toString()
}

// ── IPNS ───────────────────────────────────────────────────────────────────────

/**
 * Publish a CID under this node's IPNS name.
 * Currently a stub — content is accessible by CID via Pinata pinning.
 * Returns the PeerID (which is the IPNS name once full publishing is wired up).
 */
export async function publish(cid: string): Promise<string> {
  const h = await _getHelia()
  console.info('[ipfs] IPNS publish deferred — content at CID', cid)
  return h.libp2p.peerId.toString()
}

/**
 * Resolve an IPNS name (PeerID) to a /ipfs/<CID> path via public gateway.
 */
export async function resolve(peerId: string): Promise<string> {
  const res = await fetch(`https://dweb.link/ipns/${peerId}`, {
    redirect: 'follow',
    headers: { Accept: 'text/plain' },
  })
  if (!res.ok) throw new Error(`IPNS resolve failed: ${res.status}`)
  // Gateway redirects to /ipfs/<cid>
  return new URL(res.url).pathname
}

/** Strip the /ipfs/ prefix from a resolved IPNS path to get a bare CID. */
export function pathToCid(ipfsPath: string): string {
  return ipfsPath.replace(/^\/ipfs\//, '')
}
