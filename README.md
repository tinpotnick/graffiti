# graffiti

A self-sovereign, decentralised social art app. Draw pixel art, post it to your personal wall, and follow other users — all stored on IPFS with no central server.

## What it is

- **MY TAG** — a 64×64 pixel avatar that identifies you
- **THE WALL** — a 320×180 canvas you post drawings to
- Content is stored on [IPFS](https://ipfs.tech/) using [Kubo](https://github.com/ipfs/kubo) (bundled — no installation needed)
- Your identity is your IPFS node's keypair; your wall is published to your IPNS name (PeerID)
- Follow others by sharing IPNS addresses; follow-of-follows lets the network grow organically

## Stack

| Layer | Tech |
|---|---|
| UI | Vanilla TypeScript + Web Components |
| Desktop shell | [Tauri 2](https://tauri.app/) (Rust) |
| IPFS node | [Kubo](https://github.com/ipfs/kubo) (bundled sidecar) |
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
    ipfs.ts               Kubo HTTP API wrapper (add, cat, publish, resolve)
  data/
    stamps.ts             stamp definitions
src-tauri/
  src/lib.rs              Tauri commands: ipfs_start / ipfs_stop / ipfs_status
  binaries/               Kubo binary (git-ignored, fetched by download script)
scripts/
  download-kubo.sh        download Kubo for the current platform
  tauri-dev.sh            launch full Tauri dev environment in Docker
```

## IPFS data layout

Each user owns an IPFS directory published to their IPNS name (= their Kubo node's PeerID):

```
/ipns/<PeerID>/
  manifest.json     ← index of all content + social graph
  tag.png           ← 64×64 avatar (MY TAG export)
  wall/
    <timestamp>.png ← wall posts, newest first
```

`manifest.json`:
```json
{
  "version": 1,
  "displayName": "...",
  "tag": "<CID>",
  "wall": [{ "cid": "...", "timestamp": 0, "caption": "" }],
  "following": ["<PeerID>"],
  "updatedAt": 0
}
```

The IPFS repo is stored in the app data directory (`~/.local/share/graffiti/ipfs/` on Linux) and never touches an existing `~/.ipfs` installation.

## Mobile

Tauri 2 supports Android and iOS. The bundled Kubo sidecar approach works on desktop (Linux, macOS, Windows). Mobile support is planned: Android can run Kubo as a foreground service; iOS will connect to a remote node you own. Desktop is the initial target.

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
