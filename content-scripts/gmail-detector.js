// content-scripts/gmail-detector.js
//
// Watches the Gmail DOM for PDF/DOCX attachments and injects an
// "Analyze with ContractLens" button next to each one.
//
// IMPORTANT: Gmail's DOM/class names are unstable and change without
// notice — the selectors below are heuristic (file-extension + download
// affordance) rather than tied to exact class names, on purpose, to
// reduce how often this breaks. Still, expect to revisit this file
// periodically. Test changes against a real Gmail thread before shipping.

const CONTRACT_EXTENSIONS = [".pdf", ".doc", ".docx"];
const PROCESSED_ATTR = "data-contractlens-processed";

function isContractFile(name) {
  const lower = name.toLowerCase();
  return CONTRACT_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

// Gmail renders each attachment as a clickable chip that usually carries
// either a download URL attribute or a title/aria-label with the filename.
function findAttachmentChips(root) {
  const candidates = root.querySelectorAll(
    "[download_url], [aria-label*='Download'], span[title]"
  );
  return Array.from(candidates).filter((el) => {
    const label =
      el.getAttribute("download_url") ||
      el.getAttribute("aria-label") ||
      el.getAttribute("title") ||
      "";
    return isContractFile(label);
  });
}

function extractFileName(el) {
  const downloadUrl = el.getAttribute("download_url"); // format: "mime:filename:url"
  if (downloadUrl) {
    const parts = downloadUrl.split(":");
    if (parts.length >= 2) return parts[1];
  }
  return (
    el.getAttribute("aria-label") || el.getAttribute("title") || "contract"
  ).replace(/^Download\s*/i, "");
}

function extractFileUrl(el) {
  const downloadUrl = el.getAttribute("download_url");
  if (downloadUrl) {
    const parts = downloadUrl.split(":");
    if (parts.length >= 3) return parts.slice(2).join(":");
  }
  // Fall back to a nearby anchor's href if present.
  const anchor = el.closest("a") || el.querySelector("a");
  return anchor ? anchor.href : null;
}

function injectAnalyzeButton(chip) {
  if (chip.getAttribute(PROCESSED_ATTR)) return;
  chip.setAttribute(PROCESSED_ATTR, "true");

  const fileName = extractFileName(chip);
  const fileUrl = extractFileUrl(chip);

  const btn = document.createElement("button");
  btn.className = "cl-analyze-btn";
  btn.type = "button";
  btn.textContent = "Analyze with ContractLens";
  btn.title = `Scan ${fileName} for risky clauses`;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    btn.disabled = true;
    btn.textContent = "Analyzing…";

    chrome.runtime.sendMessage(
      {
        type: "CONTRACT_DETECTED",
        payload: { fileName, fileUrl, mimeType: guessMime(fileName) },
      },
      (response) => {
        btn.disabled = false;
        btn.textContent = "Analyze with ContractLens";
        if (chrome.runtime.lastError || (response && response.error)) {
          btn.textContent = "Analysis failed — retry";
        }
      }
    );
  });

  // Place the button right after the attachment chip so it reads as
  // "attached to" that specific file, not floating loose in the thread.
  chip.insertAdjacentElement("afterend", btn);
}

function guessMime(fileName) {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/msword";
}

function scan(root = document) {
  findAttachmentChips(root).forEach(injectAnalyzeButton);
}

// Gmail is a single-page app — content loads and re-renders dynamically,
// so a MutationObserver is required instead of a one-time scan on load.
const observer = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.addedNodes.length) scan(document);
  }
});

observer.observe(document.body, { childList: true, subtree: true });
scan(document);
