# badshrooms-desk

The Bad Shrooms Command Center app. Code only; it holds no data.
The page reads and writes the private repo `crunchrock/badshrooms-desk-data` with a fine-grained token kept in the phone's localStorage.
Served from `/docs` on GitHub Pages: https://crunchrock.github.io/badshrooms-desk/

Unlock: a password opens `docs/vault.json` (the GitHub token, encrypted with PBKDF2 and AES-GCM). To set or change it, put `{token, password}` in `build/secret.json` (ignored by git), run `node build/vault.mjs`, check with `node build/test/smoke.mjs`, commit `docs/vault.json` and push.
