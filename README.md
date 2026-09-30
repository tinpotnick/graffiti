# graffiti

**A self-sovereign, decentralised social art app.** Draw pixel art, spray it on your wall, tag other people's walls, and follow your friends. Everything lives on [IPFS](https://ipfs.tech/). There's no central server and no account to sign up for.

[![CI](https://github.com/tinpotnick/graffiti/actions/workflows/ci.yml/badge.svg)](https://github.com/tinpotnick/graffiti/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Status: alpha](https://img.shields.io/badge/status-alpha-orange.svg)

![Feed, paint and profile screens](docs/screenshots/hero.png)

## Features

- **MY TAG**: a 64×64 pixel avatar that is your signature
- **THE WALL**: a 320×180 canvas you post drawings to, with a 256-colour palette, spray can, shapes, mirror mode and PNG import/export
- **Tag other walls**: draw over someone else's piece and your delta is composited on top
- **Text posts**: a markdown editor with drafts
- **Like, really-like and bookmark**: engagement also re-pins content, so popular posts are replicated by the people who love them
- **Follow by QR code or PeerID**: your identity is your IPFS keypair, and your IPNS name is your address
- **Desktop and Android** via [Tauri 2](https://tauri.app/)

## How it works

Every user runs an in-browser IPFS node ([Helia](https://github.com/ipfs/helia)). Your node's Ed25519 keypair is your identity, and its PeerID doubles as your IPNS name. That name always points at a small JSON manifest, which links to your tag, monthly buckets of posts, likes and bookmarks, and the people you follow:

```
IPNS name (PeerID)
  └─► root manifest (JSON, ~1KB)
        ├── tag:       "<CID>"                   ← 64×64 avatar PNG
        ├── posts:     { "2026-03": "<CID>", … }  ← monthly post buckets
        ├── likes:     { "2026-03": "<CID>", … }
        ├── bookmarks: { "2026-03": "<CID>", … }
        ├── following: ["<PeerID>", …]
        └── displayName, updatedAt, version: 2
```

Content is stored locally in IndexedDB and optionally pinned to a remote service ([Pinata](https://www.pinata.cloud/) today), so it stays reachable when your device is offline. Reads fall back to public IPFS gateways.

See **[IPFS.md](IPFS.md)** for the full architecture, the non-standard choices, self-hosting a pinning node, and alternative providers.

## Status

graffiti is **alpha**. It works, but please be aware of the following:

- **Pinning is effectively required.** Without a Pinata JWT (set it under *Account → Settings*), your content is only reachable while your app is open.
- **IPNS records expire.** If you're offline for a couple of days, followers may be unable to resolve your wall until you come back online.
- **Browser nodes have limited connectivity.** NAT traversal and DHT participation are unreliable, so discovery can be slow.
- **The data format may change** before 1.0.

Issues and ideas are very welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Quick start

The only requirement is Docker with Docker Compose. You don't need Node, pnpm or Rust on your machine.

```sh
git clone https://github.com/tinpotnick/graffiti.git
cd graffiti
docker compose up frontend-dev
```

Open <http://localhost:1420>. The whole app, including the IPFS node, runs in the browser.

## Development

| Task | Command |
|---|---|
| Dev server with hot reload | `docker compose up frontend-dev` |
| Type check | `docker compose run --rm frontend-check` |
| Production frontend build | `docker compose run --rm frontend-build` |
| Desktop app (Tauri window) | `./scripts/tauri-dev.sh` |
| Desktop release bundles | `./docker-build.sh` → `./dist-bundle/` |
| Android debug APK | `./scripts/android-build.sh` |
| Local Kubo node for inspecting CIDs | `docker compose up ipfs-dev` |

### Desktop app

`./scripts/tauri-dev.sh` starts the Vite server in Docker, compiles the Tauri binary in Docker, then runs it on your host, where the display is. You need one host library for this:

```sh
sudo dnf install webkit2gtk4.1          # Fedora
sudo apt install libwebkit2gtk-4.1-0    # Debian/Ubuntu
```

| Change | What to do | Speed |
|---|---|---|
| TypeScript / CSS | Nothing: Vite HMR picks it up | Instant |
| Rust source | Re-run `./scripts/tauri-dev.sh` | ~10 s (cached) |
| First ever build | Wait for crates to download and compile | Several minutes |

### Android

```sh
./scripts/android-build.sh
```

The APK lands in `src-tauri/gen/android/app/build/outputs/apk/`. The first build takes 15–30 minutes because it downloads the Android SDK/NDK inside Docker and cross-compiles Rust for four architectures. Later builds are cached.

### Troubleshooting

- **Dependencies look stale after editing `package.json`:** run `docker compose run --rm frontend-check`, which reinstalls.
- **Anything else odd:** do a clean reset of all Docker volumes with `docker compose down -v`.

## Project structure

```
src/
  main.ts                  entry point, theme handling
  shell/app-shell.ts       SPA router
  views/
    home-view.ts           wall + feed of everyone you follow
    paint-view.ts          pixel editor (MY TAG / THE WALL / tagging)
    create-view.ts         markdown post editor with drafts
    post-view.ts           single text post
    saved-view.ts          bookmarks
    account-view.ts        profile, QR sharing, following, settings
  components/
    paint-canvas.ts        256-colour pixel engine
    wall-scroll.ts         composited wall view
    feed-item.ts           post card
    md-editor.ts           Tiptap markdown editor
    top-nav.ts             bottom navigation
  services/
    ipfs.ts                Helia node: add/cat, IPNS publish/resolve, gateway fallback
    profile.ts             manifest, posts, likes, bookmarks, follows
    pinning.ts             Pinata remote pinning
    compositing.ts         wall + tag image compositing
src-tauri/                 Tauri shell (Rust) and generated Android project
scripts/                   Docker-based dev/build helpers
```

## Stack

| Layer | Tech |
|---|---|
| UI | Vanilla TypeScript + Web Components |
| IPFS | [Helia](https://github.com/ipfs/helia), IPNS over DHT + GossipSub |
| Pinning | [Pinata](https://www.pinata.cloud/) (pluggable, see [IPFS.md](IPFS.md)) |
| Editor | [Tiptap v3](https://tiptap.dev/) |
| App shell | [Tauri 2](https://tauri.app/) (desktop + Android) |
| Build | Vite 6, all in Docker |

## Contributing

Contributions of all sizes are welcome: bug reports, pixel art, docs and code. Start with [CONTRIBUTING.md](CONTRIBUTING.md), and please follow our [Code of Conduct](CODE_OF_CONDUCT.md). To report a security issue, see [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE) © Nick Knight
