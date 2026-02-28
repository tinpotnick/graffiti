# Tauri + Web Components + TypeScript

This project uses Tauri with a Vite + TypeScript frontend built on standards-based Web Components.
For agent-specific execution rules, see `AGENTS.md`.

## Docker-first workflow

This repository is set up so you can develop and build without installing Node, pnpm, or Rust on your host.

### 1) Quick frontend iteration (hot reload)

Start the frontend dev server in Docker:

```sh
docker compose up frontend-dev
```

Then open `http://localhost:1420`.
Code changes on your host are reflected inside the container via bind mounts.

Stop it with:

```sh
docker compose down
```

### 2) Type checks (containerized)

```sh
docker compose run --rm frontend-check
```

### 3) Frontend production build (containerized)

```sh
docker compose run --rm frontend-build
```

### 4) Full Tauri bundle build (AppImage/.deb, etc.)

```sh
./docker-build.sh
```

Artifacts are exported to `./dist-bundle/`.

### 5) Manual full build (equivalent)

```sh
docker build --target export --output type=local,dest=./dist-bundle .
```

## Notes
- There is currently no automated unit/integration test suite. The primary validation command is `frontend-check` (TypeScript check).
- Tauri desktop runtime development (`tauri dev`) usually needs host GUI integration. For a clean host workflow, iterate on frontend in Docker and run full Tauri bundle builds in Docker.

## Troubleshooting
- If dependencies look stale after changing `package.json`, rerun:
```sh
docker compose run --rm frontend-check
```
- If you want a clean dependency reset in Docker volumes:
```sh
docker compose down -v
docker compose up frontend-dev
```

## Optional local (non-Docker)

If you do want local tooling:
```sh
pnpm install
pnpm run dev
pnpm run check
pnpm run build
```

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).
