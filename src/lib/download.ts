/**
 * Browser file downloads.
 *
 * The export endpoint answers with bytes rather than a URL, so there is nothing to navigate to.
 * The standard approach is a temporary object URL behind a synthetic anchor click, which keeps
 * the server's chosen filename and works without popups.
 */

/** Save a blob to the user's downloads, using `filename` as the suggested name. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.style.display = "none";

  document.body.append(anchor);
  anchor.click();
  anchor.remove();

  // Deferred: revoking in the same task can cancel the download before the browser has read the
  // blob, most visibly in Safari.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
