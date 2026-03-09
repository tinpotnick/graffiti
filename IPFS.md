# IPFS architecture

How Graffiti uses IPFS for decentralised content storage and identity.

## Overview

Every user runs an in-browser IPFS node ([Helia](https://github.com/ipfs/helia)). Content is stored locally in IndexedDB and optionally replicated to a remote pinning service (currently [Pinata](https://www.pinata.cloud/)) so it stays available when the browser is closed.

Identity is the node's Ed25519 keypair. The PeerID derived from this key doubles as the user's IPNS name — a stable address that always resolves to their latest content.

## Content model (v2)

```
IPNS name (PeerID)
  └─► root manifest CID (small JSON, ~1KB)
        ├── tag: "<CID>"                    ← 64×64 avatar PNG
        ├── posts: { "2026-03": "<CID>", …} ← CID pointers to monthly post buckets
        ├── likes: { "2026-03": "<CID>", …} ← CID pointers to monthly like buckets
        ├── following: ["<PeerID>", …]
        └── displayName, updatedAt, version: 2

Monthly post bucket (e.g. posts/2026-03):
  { month: "2026-03", posts: [{ cid, timestamp, caption, … }] }

Monthly like bucket (e.g. likes/2026-03):
  { month: "2026-03", likes: [{ target, author, timestamp, strength }] }
  strength: 1 = like, 2 = really like (mutually exclusive)
```

IPNS points to a small root manifest containing CID pointers to monthly bucket files. When a like is added, only the affected month's bucket and the root manifest are re-published — peers who already have older months cached don't need to re-fetch them (same CIDs, content-addressed and immutable).

There is no directory wrapping — every piece of content is a standalone CID.

### Why flat CIDs, not a UnixFS directory

UnixFS directory CIDs are not deterministic across implementations. Helia (JS) and Kubo (Go) use different DAG-PB encoding defaults, producing different root CIDs for identical directory contents. By using only single-file CIDs (raw codec + SHA-256), the CID is fully deterministic regardless of which IPFS implementation produced it. This means the local Helia node and the remote pinning service always agree on CIDs.

## How publishing works

1. **Add content** — image bytes are added to the local Helia blockstore → returns a CID
2. **Pin remotely** — the same bytes are uploaded to Pinata via `pinFileToIPFS` (fire-and-forget)
3. **Update manifest** — the manifest JSON is serialised, added to IPFS, and pinned
4. **Publish IPNS** — the manifest CID is published under the node's PeerID via GossipSub + DHT

Steps 2–4 are non-blocking. A failed pin doesn't prevent local publishing; the content just won't be reachable from other browsers until pinning succeeds.

## How reading works

1. **Resolve IPNS** — look up the peer's IPNS name to get their current manifest CID
2. **Fetch manifest** — download the JSON by CID
3. **Fetch images** — download each referenced CID (avatar, wall posts)

Content is fetched through Helia first (instant for local data in IndexedDB). If Helia's bitswap/routing fails (common for browser nodes behind NAT), the app falls back to public IPFS gateways:

- `https://ipfs.io/ipfs/<CID>`
- `https://dweb.link/ipfs/<CID>`
- `https://cloudflare-ipfs.com/ipfs/<CID>`

## Non-standard choices and known limitations

These are areas where we deviate from "just use IPFS" and will need attention as the project matures.

### Browser-only Helia node

The IPFS node runs entirely in the browser using WebRTC/WebSocket transports. This means:

- **No direct TCP connections** — the node can't dial or be dialled by standard Kubo nodes
- **NAT traversal** — relies on relay servers and WebRTC STUN/TURN; connectivity is unreliable
- **No persistent daemon** — when the tab closes, the node goes offline. Content is only reachable via the pinning service or gateways.
- **IndexedDB storage limits** — browsers may evict the blockstore under storage pressure

### Fire-and-forget pinning

Pinning calls run in the background and failures are logged but not surfaced to the user. Content might be published to IPNS before pinning completes, creating a brief window where followers can resolve the IPNS name but can't fetch the content.

### IPNS propagation

IPNS records are published via GossipSub (instant for connected peers) and the DHT (slower, survives disconnection). In practice:

- GossipSub only works if both peers are online and subscribed to the same topic
- DHT propagation can take minutes, and browser nodes often can't participate in the DHT effectively
- IPNS records have a limited lifetime and need periodic re-publishing (Helia handles this automatically while the node is running)

### Gateway fallback for reads

Fetching content from public gateways means those gateways must be able to find the content on the IPFS network. This only works if the content has been pinned by a reachable node (Pinata, a self-hosted node, etc.). Without pinning, gateway fetches will timeout.

### CID version

All content uses CIDv1 (`cidVersion: 1` in Pinata options; Helia defaults to CIDv1). This is important for consistency — CIDv0 and CIDv1 for the same content are different strings. The manifest stores CIDv1 strings exclusively.

## Self-hosting: running your own pinning node

Instead of relying on Pinata, you can run a Kubo (Go-IPFS) node on a Raspberry Pi or VPS to pin your own content. Here's what's needed.

### What the pinning node does

The pinning node replaces Pinata in the architecture. It needs to:

1. **Accept file uploads** and add them to its local IPFS repo
2. **Stay online** so content is reachable via bitswap and gateways
3. **Be publicly reachable** (has a real IP or port-forwarded, unlike browser nodes)

### Minimal setup with Kubo

```bash
# Install Kubo (https://docs.ipfs.tech/install/)
wget https://dist.ipfs.tech/kubo/v0.32.1/kubo_v0.32.1_linux-arm64.tar.gz
tar xzf kubo_*.tar.gz
sudo mv kubo/ipfs /usr/local/bin/

# Initialise and start
ipfs init
ipfs daemon &
```

The Kubo API listens on `localhost:5001` by default. To accept remote uploads, you'd expose it behind a reverse proxy with authentication.

### Integration approach

The app currently uploads to Pinata's `pinFileToIPFS` REST endpoint. To support a self-hosted node, you would:

1. **Implement the same REST interface** — a thin HTTP server in front of `ipfs add`:
   ```
   POST /pinning/pinFileToIPFS
   Authorization: Bearer <your-token>
   Content-Type: multipart/form-data

   → { "IpfsHash": "<CID>", "PinSize": 1234 }
   ```

2. **Or** add a new provider in `src/services/pinning.ts` that calls the Kubo HTTP API directly:
   ```
   POST http://your-pi:5001/api/v0/add?cid-version=1
   ```

3. **Configure the endpoint URL and auth token** in the app's settings (similar to the existing Pinata JWT field)

### What a self-hosted node gives you

- **Full control** — your content, your hardware, no third-party dependency
- **Better availability** — a Pi running 24/7 keeps content online even when no browser tabs are open
- **DHT participation** — a Kubo node can fully participate in the IPFS DHT, making IPNS resolution and content discovery faster
- **No API rate limits** — unlike free-tier Pinata

### What it doesn't solve

- **IPNS publishing** still happens from the browser's Helia node (it holds the private key). The Pi only pins content by CID — it doesn't need the user's key.
- **Discovery** — followers still need to resolve the IPNS name. A self-hosted node helps because it can provide the content that IPNS points to, but IPNS resolution itself depends on DHT/PubSub propagation.

## Alternative pinning providers

Any service that supports the [IPFS Pinning Services API](https://ipfs.github.io/pinning-services-api-spec/) or accepts direct file uploads could work. Candidates:

| Provider | Notes |
|----------|-------|
| [Pinata](https://www.pinata.cloud/) | Current provider. Free tier: 500 files. REST API. |
| [Web3.Storage](https://web3.storage/) | Free tier available. Uses w3up protocol (not plain IPFS pin API). Would need a different upload path. |
| [Filebase](https://filebase.com/) | S3-compatible + IPFS pinning. Standard pinning API. |
| [4everland](https://4everland.org/) | IPFS pinning + gateway. Standard pinning API. |
| Self-hosted Kubo | See above. Full control, no limits. |

Adding support for multiple providers would mean abstracting `src/services/pinning.ts` behind a provider interface — each provider implements `pinFile(data, name)` with its own auth and endpoint.

## Future considerations

### Collaborative walls (others drawing on your wall)

The current model is owner-publishes-everything: only the wall owner's Helia node writes to their manifest. For collaborative walls where others can contribute:

- **Option A: owner aggregates** — contributors send their drawings to the wall owner (via PubSub message, HTTP, etc.), and the owner adds them to their manifest. Simple, preserves single-writer IPNS semantics.
- **Option B: linked manifests** — each user's manifest includes a section for "contributions to other walls". The wall owner's manifest links to contributor manifests. More decentralised but harder to render a unified wall view.
- **Option C: shared mutable state** — use a CRDT or append-only log that multiple writers can update. Significantly more complex (OrbitDB, Merkle-CRDTs). Not needed initially.

Option A is the simplest path and fits the current architecture.

### Mobile

Tauri 2 supports Android/iOS, but the in-browser Helia node has the same NAT/connectivity limitations on mobile. A self-hosted Kubo node (or Pinata) becomes even more important on mobile since the app may be backgrounded or killed at any time.
