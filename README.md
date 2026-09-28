# Network of Trust (NoT) v2

Academic management platform with blockchain-anchored, privacy-preserving credentials.

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)
- Why v2: [docs/reviews/2026-09-28-v1-review.md](docs/reviews/2026-09-28-v1-review.md)
- v1 code (reference only): [legacy/](legacy/)

## Quick start

```bash
nvm use            # Node 22
npm ci
npm test           # builds and tests all packages
```

## Packages

| Package | What |
|---|---|
| `packages/credential-core` | Canonical JSON, credential hash, Merkle batches (shared by API and web) |
| `packages/contracts` | `CredentialRegistry` smart contract, tests, deploy script |
