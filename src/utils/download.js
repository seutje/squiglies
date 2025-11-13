export function downloadTextFile(filename, text) {
  if (!filename) {
    throw new Error("downloadTextFile requires a filename");
  }
  const payload = typeof text === "string" ? text : JSON.stringify(text ?? "", null, 2);

  if (typeof document === "undefined") {
    console.warn("downloadTextFile: document is not available; returning payload instead of downloading.");
    return payload;
  }

  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);

  return payload;
}
