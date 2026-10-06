# badshrooms-desk

The Bad Shrooms Command Center app. Code only; it holds no data.
The page reads and writes the private repo `crunchrock/badshrooms-desk-data` with a fine-grained token kept in the phone's localStorage.
Served from `/docs` on GitHub Pages: https://crunchrock.github.io/badshrooms-desk/

Unlock: a password opens `docs/vault.json` (the GitHub token, encrypted with PBKDF2 and AES-GCM). To set or change it, put `{token, password}` in `build/secret.json` (ignored by git), run `node build/vault.mjs`, check with `node build/test/smoke.mjs`, commit `docs/vault.json` and push.

## Navigation and updates

The existing root URL opens **Home**, with separate **Marketing** and **Copy Lab / Green Room**
entries. The app bar stays available in both apps. Existing `#today`, `#numbers`, `#creators`,
`#more` and `#copy` links still work. The shortcut's `start_url` and scope remain `./`.

The header's **Version / Updates** panel checks `version.json` with a fresh request. **Reload app**
loads the same path with a cache-busting query, retains the active view, and leaves device drafts,
queued taps and unlock storage intact. A running save blocks reload until it finishes. Release
metadata, the loaded version constant and asset query versions change together. The app does not
register a service worker or clear browser storage during updates.

Run `node build/test/command-center-ui.cjs` for the local mock-API navigation/update checks.
It supports the same Playwright and Chrome environment variables as the Copy Lab UI test.

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
4. With this candidate open in a stopped Unity Editor, choose **Sync approved copy** in The
   Green Room, or run `node tools/copy-sync.cjs` from the Unity repo. It pulls approved rows,
   checks fresh native source, applies supported assets and verifies the same unchanged app
   approvals as applied. No recurring export/import file shuffling is required.
5. Desktop sync uses the desk checkout's existing ignored `build/secret.json`; it creates no
   credentials or service. A token held only on the phone is unavailable to desktop Unity.
   Manual **Export approved TSV** and **Apply TSV and save assets** remain the fallback; then
   reimport a full source TSV to confirm application.

Read-only, lore-frozen and missing or unresolved-callsite rows stay reviewable and are labelled.
Automatic sync and approved export skip them. The generic manual native importer has no extra
lore approval gate. Coverage is the harvested provider set, not a claim of every visible word.
Sync preserves candidates/history and skips drafts. Changed source or changed approvals stop
application; newer app revisions after import remain untouched and unacknowledged. Network or
SHA failures can leave saved game assets awaiting acknowledgement: retry the explicit sync.
Changes enter the next candidate build. No approval or sync publishes a game or Steam update.

Run synthetic persistence checks with `node build/test/copy-lab.cjs`. Run the actual UI against a
local mock API with `node build/test/copy-lab-ui.cjs` and Playwright installed (`PLAYWRIGHT_PATH`
can point to an existing installation; `CHROME_PATH` can select the installed Chrome). These
checks never open the vault, live key pool or creator records. UI captures go outside this repo.
