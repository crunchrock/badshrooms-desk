# badshrooms-desk

The Bad Shrooms Command Center app. Code only; it holds no data.
The page reads and writes the private repo `crunchrock/badshrooms-desk-data` with a fine-grained token kept in the phone's localStorage.
Served from `/docs` on GitHub Pages: https://crunchrock.github.io/badshrooms-desk/

Unlock: a password opens `docs/vault.json` (the GitHub token, encrypted with PBKDF2 and AES-GCM). To set or change it, put `{token, password}` in `build/secret.json` (ignored by git), run `node build/vault.mjs`, check with `node build/test/smoke.mjs`, commit `docs/vault.json` and push.

## Copy Lab

Copy Lab uses `data/copy.json` in the same private data repo. Each map key is an existing Green
Room audit ID. It keeps game-source text and context, Jim's candidate, draft/approved/applied
state, a per-row revision, and up to 20 prior saved edits. Code and harvested game text stay
separate. Google Docs/Sheets are not synchronized by this app.

1. In Unity, open **Tools → Bad Shrooms → Audit → The Green Room** and export its full editable
   TSV. Use the updated exporter with context, source, writable flags and `escaped-v2` encoding.
2. Open the desk's **Copy Lab** on phone or desktop and choose **Import Green Room TSV**. A
   reimport retains existing candidates and history; changed or missing sources are flagged.
3. Search by wording, stable ID, group or trigger. Edit **Jim's candidate**, then **Save draft**
   or **Approve wording**. Text typed without a successful save stays on that device. Refresh
   compares concurrent edits and offers an explicit choice rather than overwriting them.
4. Choose **Export approved TSV**. Only approved, current, writable rows are included.
   Hardcoded and frozen rows remain available for review and disclose why application is blocked.
5. With Unity out of Play Mode, use **Apply TSV and save assets** in The Green Room. The importer
   checks every source baseline and placeholder before changing any assets.
6. Export a fresh full TSV from Unity and import it into Copy Lab. A matching approved candidate
   is then verified as applied. Review approval and source application do not publish a game build.

Run synthetic persistence checks with `node build/test/copy-lab.cjs`. Run the actual UI against a
local mock API with `node build/test/copy-lab-ui.cjs` and Playwright installed (`PLAYWRIGHT_PATH`
can point to an existing installation; `CHROME_PATH` can select the installed Chrome). These
checks never open the vault, live key pool or creator records. UI captures go outside this repo.
