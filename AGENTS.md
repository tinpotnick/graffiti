# AGENTS.md

## Goal
Use Docker-first commands for all routine development tasks. Prefer containerized workflows over host-installed toolchains.

## Canonical Commands

### Frontend dev (hot reload)
```sh
docker compose up frontend-dev
```
- Serves app at `http://localhost:1420`.
- Stop with `docker compose down`.

### Type check
```sh
docker compose run --rm frontend-check
```

### Frontend production build
```sh
docker compose run --rm frontend-build
```

### Full Tauri bundle build
```sh
./docker-build.sh
```
- Exports artifacts to `./dist-bundle/`.

## Validation Order
When asked to validate changes:
1. Run `docker compose run --rm frontend-check`.
2. Run `docker compose run --rm frontend-build`.
3. If release-related, run `./docker-build.sh`.

## Constraints
- Do not assume `pnpm` is available on host.
- Prefer Docker commands in docs, scripts, and recommendations.
- If lockfile mismatch appears in Docker builds, regenerate `pnpm-lock.yaml` in a Node container and commit it.
