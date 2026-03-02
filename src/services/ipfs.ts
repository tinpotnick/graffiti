/**
 * IPFS service — thin wrapper around the Kubo HTTP API (localhost:5001).
 *
 * Lifecycle (start/stop/status) goes via Tauri commands so Rust can own the
 * daemon process.  All content operations call the Kubo API directly from the
 * frontend — there is no need to pipe binary data through Tauri IPC.
 */

import { invoke } from '@tauri-apps/api/core'

const API = 'http://127.0.0.1:5001/api/v0'

// ── Lifecycle ─────────────────────────────────────────────────────────────────

/** Start the Kubo daemon (init repo on first run, configure CORS, wait ready). */
export function startDaemon(): Promise<void> {
  return invoke('ipfs_start')
}

/** Stop the Kubo daemon. */
export function stopDaemon(): Promise<void> {
  return invoke('ipfs_stop')
}

/** True if the daemon process is currently running. */
export function isDaemonRunning(): Promise<boolean> {
  return invoke<boolean>('ipfs_status')
}

// ── Identity ──────────────────────────────────────────────────────────────────

export interface NodeId {
  /** PeerID — also the user's permanent IPNS name. */
  id: string
  publicKey: string
  addresses: string[]
  agentVersion: string
}

/** Get the local node's identity. Call after startDaemon() resolves. */
export async function getNodeId(): Promise<NodeId> {
  const res = await fetch(`${API}/id`, { method: 'POST' })
  const j = await res.json()
  return {
    id: j.ID,
    publicKey: j.PublicKey,
    addresses: j.Addresses ?? [],
    agentVersion: j.AgentVersion,
  }
}

// ── Add content ───────────────────────────────────────────────────────────────

/** Add raw bytes to IPFS and pin locally. Returns CID. */
export async function addBytes(data: Uint8Array): Promise<string> {
  const form = new FormData()
  form.append('file', new Blob([data]))
  const res = await fetch(`${API}/add?pin=true&quieter=true`, {
    method: 'POST',
    body: form,
  })
  const j = await res.json()
  return j.Hash as string
}

/** Serialise an object to JSON and add it to IPFS. Returns CID. */
export async function addJson(obj: unknown): Promise<string> {
  return addBytes(new TextEncoder().encode(JSON.stringify(obj)))
}

/** Add a named file to IPFS (name is metadata only, not part of the CID). */
export async function addFile(name: string, data: Uint8Array): Promise<string> {
  const form = new FormData()
  form.append('file', new Blob([data]), name)
  const res = await fetch(`${API}/add?pin=true`, { method: 'POST', body: form })
  const j = await res.json()
  return j.Hash as string
}

// ── Read content ──────────────────────────────────────────────────────────────

/** Fetch raw bytes for a CID. */
export async function catBytes(cid: string): Promise<Uint8Array> {
  const res = await fetch(`${API}/cat?arg=${cid}`, { method: 'POST' })
  return new Uint8Array(await res.arrayBuffer())
}

/** Fetch and JSON-parse a CID. */
export async function catJson<T>(cid: string): Promise<T> {
  const bytes = await catBytes(cid)
  return JSON.parse(new TextDecoder().decode(bytes)) as T
}

// ── Directories ───────────────────────────────────────────────────────────────

export interface DirEntry {
  /** Relative path within the directory, e.g. "wall/1709123456.png" */
  path: string
  data: Uint8Array
}

/**
 * Add multiple files as a wrapped UnixFS directory.
 * Returns the root directory CID.
 *
 * The response is NDJSON; the entry with Name === '' is the root.
 */
export async function addDirectory(entries: DirEntry[]): Promise<string> {
  const form = new FormData()
  for (const { path, data } of entries) {
    form.append('file', new Blob([data]), path)
  }
  const res = await fetch(`${API}/add?pin=true&wrap-with-directory=true`, {
    method: 'POST',
    body: form,
  })
  const lines = (await res.text())
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as { Name: string; Hash: string })
  const root = lines.find((l) => l.Name === '')
  if (!root) throw new Error('addDirectory: could not find root CID in response')
  return root.Hash
}

// ── IPNS ──────────────────────────────────────────────────────────────────────

/**
 * Publish a CID to the node's default IPNS key.
 * `allow-offline=true` returns immediately without waiting for DHT propagation.
 * Returns the IPNS name (same as the node's PeerID).
 */
export async function publish(cid: string): Promise<string> {
  const res = await fetch(
    `${API}/name/publish?arg=/ipfs/${cid}&allow-offline=true&quieter=true`,
    { method: 'POST' },
  )
  const j = await res.json()
  return j.Name as string
}

/**
 * Resolve an IPNS name to a /ipfs/<CID> path.
 * Pass just the PeerID — the /ipns/ prefix is added automatically.
 */
export async function resolve(peerId: string): Promise<string> {
  const res = await fetch(
    `${API}/name/resolve?arg=/ipns/${peerId}&recursive=true`,
    { method: 'POST' },
  )
  const j = await res.json()
  return j.Path as string // "/ipfs/bafy..."
}

/** Strip the /ipfs/ prefix from a resolved IPNS path to get a bare CID. */
export function pathToCid(ipfsPath: string): string {
  return ipfsPath.replace(/^\/ipfs\//, '')
}
