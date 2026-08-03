# ContractLens AI — Chrome Extension (MVP scaffold)

## What's here
- `manifest.json` — Manifest V3 config, scoped to Gmail only for the MVP.
- `background.js` — service worker; opens the side panel and stands in for
  the backend call (currently returns mock analysis after a 1.2s delay).
- `content-scripts/gmail-detector.js` — watches Gmail for PDF/DOCX
  attachments and injects an "Analyze with ContractLens" button next to
  each one.
- `sidepanel/` — the panel UI that shows risk-scored clauses and
  suggested edits.

## Load it locally
1. `chrome://extensions`
2. Enable **Developer mode** (top right)
3. **Load unpacked** → select this folder
4. Open Gmail, open an email with a PDF/DOCX attachment, click
   **Analyze with ContractLens** on the attachment
5. The side panel opens and shows a mock analysis after ~1 second

## What's mocked vs. real
Everything about the extension shell (attachment detection, side panel,
storage, message passing) is real and functional. The one thing that's
mocked is the actual contract analysis — `analyzeContract()` in
`background.js` returns a hardcoded example instead of calling a backend,
because that backend doesn't exist yet.

## Next steps, in order
1. **Build the backend first.** A simple endpoint that accepts a file URL
   or file bytes, extracts text (PDF/DOCX parsing), sends it to Claude for
   clause extraction + risk scoring, and returns JSON in the same shape
   `mockAnalysis()` already returns. Keep the response contract identical
   so you can swap `analyzeContract()` over without touching any UI code.
2. **Swap the mock for the real fetch call** — it's already stubbed out
   (commented) at the top of `analyzeContract()` in `background.js`.
3. **Auth** — add `chrome.identity` for Google sign-in before wiring real
   user accounts and a free-tier usage limit (enforce the limit
   server-side, not in the extension).
4. **File access** — Gmail attachment URLs require the user's session
   cookie to fetch; the cleanest approach is to have the content script
   read the file as a blob client-side (via the existing authenticated
   page context) and upload the blob to your backend, rather than trying
   to have the backend fetch Gmail's URL directly.
5. **Harden the Gmail selectors** — `gmail-detector.js` uses
   extension/download-affordance heuristics on purpose to survive Gmail's
   frequent DOM changes, but test against a real inbox before each
   release; Gmail updates its markup without notice.
6. **Chrome Web Store review** — keep `host_permissions` scoped to only
   `mail.google.com` and your own API domain. Requesting broader access
   (e.g. full `<all_urls>`) will slow down or block store approval and
   erodes user trust for a tool that's explicitly handling sensitive
   documents.
