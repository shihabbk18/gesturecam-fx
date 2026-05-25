const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api/v1";

export async function detectText(text, language) {
  const response = await fetch(`${API_BASE}/detect/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, language }),
  });
  return handleResponse(response);
}

export async function detectFile(file) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE}/detect/file`, {
    method: "POST",
    body: form,
  });
  return handleResponse(response);
}

export function reportUrl(id) {
  return `${API_BASE}/report/${id}`;
}

async function handleResponse(response) {
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.detail || "Detection failed");
  }
  return response.json();
}
