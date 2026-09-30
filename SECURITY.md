# Security policy

graffiti handles cryptographic identities: each user's IPFS keypair *is* their account. Security reports are taken seriously.

## Supported versions

graffiti is alpha software. Only the latest release and the `main` branch receive fixes.

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub's [private vulnerability reporting](https://github.com/tinpotnick/graffiti/security/advisories/new). Include:

- a description of the issue and its impact
- steps to reproduce, or a proof of concept
- the affected platform(s): browser, desktop or Android

You should get an acknowledgement within a few days. Once a fix is available, we'll coordinate disclosure with you and credit you if you'd like.

## Scope

Areas of particular interest:

- leaking or exfiltrating a user's private key / IPFS identity
- forging IPNS records or manifests for another user
- script injection via post content, captions, display names or markdown
- leaking the Pinata JWT stored in settings
- Tauri capability or IPC misconfiguration

The known limitations of browser IPFS nodes described in [IPFS.md](IPFS.md#non-standard-choices-and-known-limitations), such as connectivity and record expiry, are not vulnerabilities in themselves.
