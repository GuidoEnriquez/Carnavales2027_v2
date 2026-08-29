const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json", ...options.headers },
    ...options,
  });
  if (!response.ok) throw new Error(`HTTP_${response.status}`);
  return response.status === 204 ? null : response.json();
}
