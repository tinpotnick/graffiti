# Contributing to graffiti

Thanks for your interest! graffiti is an experiment in building a social network on a decentralised file system. Every contribution helps, whether it's a bug report, docs, pixel art, code, or just a good idea for one of the [open problems](README.md#open-problems). Design discussion is as valuable here as code.

By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to help

- **Report bugs.** Open an issue using the bug report template. Include your platform (browser / desktop / Android) and any `[ipfs]` or `[profile]` lines from the console.
- **Tackle an open problem.** Open an issue to think one through: pinning without sign-up, faster IPNS, tag moderation, notifications. A write-up of an approach, even one that doesn't work, is a contribution.
- **Suggest features.** Open an issue first so we can talk through the design before you spend time on code. This matters especially for anything that touches the manifest format or IPNS behaviour.
- **Improve docs.** Fixes to the README or [IPFS.md](IPFS.md) are always welcome.
- **Write code.** Issues labelled `good first issue` are a good place to start.

## Development setup

Everything runs in Docker. You don't need Node, pnpm or Rust on your host.

```sh
git clone https://github.com/tinpotnick/graffiti.git
cd graffiti
docker compose up frontend-dev     # http://localhost:1420, hot reload
```

See the [README](README.md#development) for the desktop (Tauri) and Android workflows.

> Don't assume `pnpm` is installed on the host. If you need to run a pnpm command, run it in a container, e.g.
> `docker compose run --rm frontend-dev bash -lc "corepack enable && pnpm <command>"`.

### Testing with two identities

Each browser profile gets its own IPFS keypair, stored in IndexedDB. To test following, likes or tagging, open the app in a normal window and in a private window (or a second browser), then follow one identity from the other using the PeerID on the *Account* page.

## Before you open a pull request

Run the same checks CI runs:

```sh
docker compose run --rm frontend-check   # TypeScript
docker compose run --rm frontend-build   # production build
```

If your change affects packaging or Rust code, also run `./docker-build.sh`.

If Docker reports a lockfile mismatch, regenerate `pnpm-lock.yaml` inside the Node container and commit it along with your change.

## Pull request guidelines

- Keep PRs focused: one logical change per PR.
- Match the existing style: vanilla TypeScript, Web Components, no framework.
- **Manifest / data format changes** must stay backward compatible with existing published manifests, or include a migration and a `version` bump. Explain the change in the PR description.
- Update docs (README / IPFS.md) when behaviour changes.
- Include a screenshot or short clip for UI changes.
- Write commit messages in the imperative mood ("Add spray-can size slider", not "Added…").

## Project layout

See [Project structure](README.md#project-structure) in the README. Most logic lives in `src/services/`:

- `ipfs.ts` is the Helia node, IPNS and gateway fallback
- `profile.ts` is the manifest model: posts, likes, bookmarks, follows
- `pinning.ts` is remote pinning (Pinata)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
