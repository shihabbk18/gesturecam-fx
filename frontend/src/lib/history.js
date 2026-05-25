const KEY = "ai-detector-pro-history";

export function loadHistory() {
  return JSON.parse(localStorage.getItem(KEY) || "[]");
}

export function saveScan(result) {
  const next = [{ ...result, scannedAt: new Date().toISOString() }, ...loadHistory()].slice(0, 12);
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}
