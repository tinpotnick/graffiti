# graffiti

A self-sovereign, decentralised social art app. Draw pixel art, post it to your personal wall, and follow other users — all stored on IPFS with no central server.

## What it is

- **MY TAG** — a 64×64 pixel avatar that identifies you
- **THE WALL** — a 320×180 canvas you post drawings to
- Content is stored on [IPFS](https://ipfs.tech/) using an in-browser [Helia](https://github.com/ipfs/helia) node + optional remote pinning
- Your identity is your IPFS node's keypair; your wall is published to your IPNS name (PeerID)
- Follow others by sharing IPNS addresses; follow-of-follows lets the network grow organically

## Stack

| Layer | Tech |
|---|---|
| UI | Vanilla TypeScript + Web Components |
| Desktop shell | [Tauri 2](https://tauri.app/) (Rust) |
| IPFS node | [Helia](https://github.com/ipfs/helia) (in-browser) + [Pinata](https://www.pinata.cloud/) pinning |
| Markdown editor | [Tiptap v3](https://tiptap.dev/) |
| Build | Vite 6 |

## Development

Docker and Docker Compose are the only requirements.

### UI only — browser, instant hot reload

```sh
docker compose up frontend-dev
```

Opens at <http://localhost:1420>. Reflects code changes immediately via Vite HMR.
`invoke()` calls to Tauri will throw here — that is expected for pure UI work.

### Full desktop app — Tauri window + live IPFS node

**One-time host dependency** (Docker handles everything else):
```sh
sudo dnf install webkit2gtk4.1        # Fedora
# sudo apt install libwebkit2gtk-4.1-0  # Debian/Ubuntu
```

Then:
```sh
./scripts/tauri-dev.sh
```

This will:
1. Download the Kubo binary if not already present
2. Start the Vite dev server in Docker (background)
3. **Build** the Tauri binary inside Docker (no display needed — pure compilation)
4. **Run** the resulting binary on the host where the display lives

The binary connects to the Vite server at `http://localhost:1420` automatically.

**Rebuild cadence:**

| Change | Action | Speed |
|---|---|---|
| TypeScript / CSS | Nothing — Vite HMR handles it | Instant |
| Rust source | Re-run `./scripts/tauri-dev.sh` | ~10 s (incremental, cached) |
| First ever build | Wait for crate downloads + compile | Several minutes |

### Type check

```sh
docker compose run --rm frontend-check
```

### Production frontend build

```sh
docker compose run --rm frontend-build
```

## Project structure

```
src/
  shell/app-shell.ts      SPA router
  views/
    home-view.ts          feed
    create-view.ts        markdown post editor
    paint-view.ts         pixel art canvas (MY TAG + THE WALL)
  components/
    paint-canvas.ts       256-colour pixel engine
    md-editor.ts          Tiptap markdown editor
    feed-item.ts          post card
    top-nav.ts            bottom navigation
  services/
    ipfs.ts               Helia IPFS node (add, cat, IPNS publish/resolve)
    pinning.ts            Pinata remote pinning (fire-and-forget uploads)
    profile.ts            manifest management, publish, follow/unfollow
  data/
    stamps.ts             stamp definitions
src-tauri/
  src/lib.rs              Tauri setup
scripts/
  tauri-dev.sh            launch full Tauri dev environment in Docker
```

## IPFS data layout

Each user's IPNS name (= PeerID) points directly to a manifest CID:

```
IPNS name (PeerID) → manifest CID (JSON)
  ├── tag: "<CID>"          ← 64×64 avatar PNG
  ├── wall: [{ cid, … }]   ← wall post PNGs
  ├── following: ["<PeerID>", …]
  └── displayName, updatedAt, version
```

All images are standalone CIDs — no directory wrapping. This ensures CID determinism across IPFS implementations (Helia JS and Kubo Go produce different directory CIDs for identical content, but identical single-file CIDs).

The local blockstore is IndexedDB-backed, so the node's identity persists across app restarts.

See [IPFS.md](IPFS.md) for architecture details, non-standard choices, self-hosting guidance, and alternative pinning providers.

## Android

### First-time setup (one-time, then commit):
```sh
./scripts/android-build.sh --init
git add src-tauri/gen/android/
git commit -m "tauri android init"
```

### Build debug APK:
```sh
./scripts/android-build.sh
```

Output: `src-tauri/gen/android/app/build/outputs/apk/`

The first build is slow (~15-30 min) — it downloads the Android SDK/NDK inside Docker and cross-compiles Rust for 4 Android architectures. Subsequent builds are cached and much faster.

## Troubleshooting

**Stale dependencies after changing `package.json`:**
```sh
docker compose run --rm frontend-check
```

**Clean reset of all Docker volumes:**
```sh
docker compose down -v
```

## Recommended IDE setup

[VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
