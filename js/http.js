import { API_BASE_URL } from "./api-config.js";

const API_TOKEN_KEY = "gulit:v1:apiToken";

export function isBackendApiEnabled() {
  return Boolean(API_BASE_URL && API_BASE_URL.trim());
}

export function getApiToken() {
  return localStorage.getItem(API_TOKEN_KEY);
}

export function setApiToken(token) {
  if (token) localStorage.setItem(API_TOKEN_KEY, token);
  else localStorage.removeItem(API_TOKEN_KEY);
}

export async function apiRequest(path, options = {}) {
  if (!isBackendApiEnabled()) throw new Error("Backend API is not configured.");

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  const token = getApiToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    body: options.body && typeof options.body !== "string" ? JSON.stringify(options.body) : options.body,
  });

  if (response.status === 204) return null;

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new Error(payload?.message || `Request failed with status ${response.status}.`);
  }

  return payload;
}
