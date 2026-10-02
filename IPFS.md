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
        ├── posts: { "2026-03": "<CID>", …}     ← CID pointers to monthly post buckets
        ├── likes: { "2026-03": "<CID>", …}     ← CID pointers to monthly like buckets
        ├── bookmarks: { "2026-03": "<CID>", …} ← CID pointers to monthly bookmark buckets
        ├── following: ["<PeerID>", …]
        └── displayName, updatedAt, version: 2

Monthly post bucket (e.g. posts/2026-03):
  { month: "2026-03", posts: [{ cid, timestamp, caption, … }] }

Monthly like bucket (e.g. likes/2026-03):
  { month: "2026-03", likes: [{ target, author, timestamp, strength }] }
  strength: 1 = like, 2 = really like (mutually exclusive)

Monthly bookmark bucket (e.g. bookmarks/2026-03):
  { month: "2026-03", bookmarks: [{ target, author, timestamp }] }
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

Content is fetched through Helia first: instantly for local data in IndexedDB, otherwise directly from peers. Helia finds providers through delegated routing (`delegated-ipfs.dev`) and the DHT, then dials them over browser-friendly transports (WebRTC, WebTransport, secure WebSockets). Helia gets 30 seconds, because the first fetch includes connection warm-up and can take around 10 seconds. If that fails and you've configured a Pinata gateway, the app tries it next.

The sponsored public gateways (`ipfs.io`, `dweb.link`) used to be a fallback too. They're now rate-limited and being retired (see [IPFS is moving beyond the sponsored gateways](https://blog.ipfs.tech/2026-08-beyond-sponsored-gateways/)), so graffiti no longer uses them.

## Non-standard choices and known limitations

These are areas where we deviate from "just use IPFS" and will need attention as the project matures.

### Browser-only Helia node

The IPFS node runs entirely in the browser using WebRTC/WebSocket transports. This means:

- **No direct TCP connections** — the node can't dial or be dialled by standard Kubo nodes
- **NAT traversal** — relies on relay servers and WebRTC STUN/TURN; connectivity is unreliable
- **No persistent daemon** — when the tab closes, the node goes offline. Content is only reachable via the pinning service or other peers that hold it.
- **IndexedDB storage limits** — browsers may evict the blockstore under storage pressure

### Fire-and-forget pinning

Pinning calls run in the background and failures are logged but not surfaced to the user. Content might be published to IPNS before pinning completes, creating a brief window where followers can resolve the IPNS name but can't fetch the content.

### IPNS propagation

IPNS records are published via GossipSub (instant for connected peers) and the DHT (slower, survives disconnection). In practice:

- GossipSub only works if both peers are online and subscribed to the same topic
- DHT propagation can take minutes, and browser nodes often can't participate in the DHT effectively
- IPNS records have a limited lifetime and need periodic re-publishing (Helia handles this automatically while the node is running)

### Reads depend on reachable providers

With no public gateway fallback, someone else's content only loads if a peer the browser can dial is providing it: their own app while it's open, a pinning service, a self-hosted node, or anyone who re-pinned it. Delegated routing (`delegated-ipfs.dev`) is still how a browser finds those peers quickly. That service is run by Protocol Labs, and its long-term future is unclear after the end of Shipyard's maintenance funding in September 2026. Removing that dependency, for example by also querying other routers or the DHT directly, is part of [open problem #4](https://github.com/tinpotnick/graffiti/issues/4).

[`@helia/verified-fetch`](https://www.npmjs.com/package/@helia/verified-fetch) is the officially recommended replacement for gateway fetches. It isn't used yet: its default fallback gateway, `trustless-gateway.link`, was timing out when tested (October 2026), and Helia already fetches from peers directly.

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

## Content replication via engagement

Likes and bookmarks serve a dual purpose: social signal and content replication. When a user views content, the bytes are already in their local Helia blockstore. Liking or bookmarking that content pins it — keeping it available from their node and (selectively) uploading it to their Pinata account.

### How it works

1. **User views a post** — Helia fetches the content bytes into IndexedDB (passive cache)
2. **User bookmarks or really-likes** — the content CID is re-pinned to their Pinata account via `_repinContent()`
3. **The content now lives on multiple nodes** — the author's node/Pinata, plus every user who bookmarked or really-liked it

This creates a demand-driven CDN: popular content gets replicated across more nodes proportional to engagement. A post that 200 people really-like is served from 200+ sources, not just the author's single node.

### Pinning tiers

| Tier | Content | Local pin | Remote pin (Pinata) |
|------|---------|-----------|---------------------|
| Own content | Your posts, avatar, manifest | Always | Always |
| Bookmarks | Explicitly saved for later | Yes (already fetched) | Yes |
| Really-likes (strength 2) | Strong endorsement | Yes (already fetched) | Yes |
| Regular likes (strength 1) | Light endorsement | Cached by Helia | No |
| Viewed content | Scrolled past in feed | Cached by Helia | No |

### Cost implications

Remote pinning has real costs (Pinata free tier: 500 files). The tiered approach limits remote pins to content the user explicitly engaged with — bookmarks and really-likes. Regular likes and passive views only benefit from local Helia caching, which is free but ephemeral (browser may evict IndexedDB under storage pressure).

### Discovery through engagement

Bookmarks and likes are public in the manifest. When user A follows user B:

- A sees B's posts (direct content)
- A sees B's likes and bookmarks (discovered content)
- A discovers user C through B's engagement with C's posts
- A can follow C, extending the social graph

Each hop through the social graph adds another potential replica of popular content.

## Future considerations

### Collaborative walls (others drawing on your wall)

IPNS is single-writer: only the owner's key can update their manifest. So how does anyone else draw on your wall?

**What graffiti does today** (a variant of option B below): the tagger publishes only their delta image, in *their own* manifest, with `wallRef` (the CID of the wall they tagged) and `wallBounds`. When a viewer's app renders a wall, it gathers every post it knows about whose `wallRef` matches, and composites them over the original, oldest first.

Consequences of this approach, some good and some open:

- The owner never grants write access, and nothing in their manifest changes.
- There is no canonical wall. Each viewer sees the tags from people *they* follow, so two people can see different versions of the same wall.
- The owner can't remove a tag, and won't see tags from people they don't follow. Moderation and notifications are open problems.

Alternatives considered:

- **Option A: owner aggregates.** Contributors send their drawings to the wall owner (via a PubSub message, HTTP, etc.), and the owner adds them to their manifest. This gives a canonical, moderated wall, but the owner has to be online, and it re-centralises control.
- **Option B: linked manifests.** Contributions live in the contributor's manifest and point at the wall. This is what's implemented, minus any link back from the owner. The owner's manifest could additionally list accepted contributors, to give an "official" view.
- **Option C: shared mutable state.** Use a CRDT or append-only log that multiple writers can update (OrbitDB, Merkle-CRDTs). This is the most powerful option and also significantly more complex.

### Mobile

Tauri 2 supports Android/iOS, but the in-browser Helia node has the same NAT/connectivity limitations on mobile. A self-hosted Kubo node (or Pinata) becomes even more important on mobile since the app may be backgrounded or killed at any time.
