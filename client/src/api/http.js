const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  constructor({ status, code, message, details }) {
    super(message ?? code ?? `HTTP_${status}`);
    this.name = "ApiError";
    this.status = status;
    this.code = code ?? `HTTP_${status}`;
    this.details = details;
  }
}

export async function apiRequest(path, options = {}) {
  const { headers, ...requestOptions } = options;
  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      ...requestOptions,
      credentials: "include",
      cache: "no-store",
      headers: { "content-type": "application/json", ...headers },
    });
  } catch (error) {
    throw new ApiError({ status: 0, code: "NETWORK_ERROR", message: error.message });
  }
  if (!response.ok) {
    let payload = null;
    try { payload = await response.json(); } catch { /* Response body is optional. */ }
    const error = payload?.error ?? payload ?? {};
    throw new ApiError({
      status: response.status,
      code: error.code,
      message: error.message,
      details: error.details ?? error,
    });
  }
  return response.status === 204 ? null : response.json();
}
