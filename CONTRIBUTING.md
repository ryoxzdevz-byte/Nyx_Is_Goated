# Contributing

This repository is a private local Nyx fork/build workspace. Keep changes focused, tested, and consistent with the existing codebase.

## Before changing code

- Read `LICENSE` and follow its constraints.
- Do not rename internal compatibility identifiers unless explicitly required (`LinerElectronApi`, `liner_db_v1`, `liner-local://`, `LINER_*`, `x-liner-*`, API/cover URLs, DB/storage keys that must remain compatible).
- Do not modify `signer/src` (Rust/WASM) unless explicitly requested.

## Development

```bash
pnpm install
pnpm dev
pnpm test
pnpm check
```

## Pull requests / commits

- Make one logical change at a time.
- Include how you verified the change.
- Do not commit secrets, `node_modules/`, or `release/` build artifacts.
- Do not add documentation files unless requested.
