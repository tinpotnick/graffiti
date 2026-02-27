# Tauri + SvelteKit + TypeScript

This template should help get you started developing with Tauri, SvelteKit and TypeScript in Vite.

## Building with Docker

If you don't want to install the full development environment locally, you can use Docker to build the application.

### Easy method (recommended)

Use the provided build script:

```sh
./docker-build.sh
```

The built application bundles (AppImage, .deb, etc.) will be in the `./dist-bundle` directory.

### Manual method

```sh
# Build the Tauri application using Docker
docker build -t graffiti-build .

# Extract the built artifacts to your local machine
docker create --name graffiti-artifacts graffiti-build
docker cp graffiti-artifacts:/app/src-tauri/target/release/bundle ./dist-bundle
docker rm graffiti-artifacts
```

### Alternative: Direct export (requires BuildKit)

```sh
# Build and export artifacts directly
docker build --output type=local,dest=./dist-bundle --target=export .
```

## Local Development (requires full dev environment)

### Testing / Checks

There are no automated test suites wired up yet, but you can run the type + Svelte checks:

```sh
pnpm install
pnpm run check
```

Watch mode:

```sh
pnpm run check:watch
```

Optional sanity checks for a production build:

```sh
pnpm run build
pnpm run preview
```

## Recommended IDE Setup

[VS Code](https://code.visualstudio.com/) + [Svelte](https://marketplace.visualstudio.com/items?itemName=svelte.svelte-vscode) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer).
