import { env } from "../config/env.js";
import { httpError } from "./httpError.js";

function baseHeaders(prefer) {
  const key = env.supabaseServiceRoleKey;
  return {
    apikey: key || "",
    Authorization: `Bearer ${key || ""}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

export function encodeFilter(value) {
  return encodeURIComponent(String(value));
}

export async function supabaseRequest(path, options = {}) {
  if (!env.supabaseServiceRoleKey) {
    throw httpError(500, "Backend Supabase service role key is not configured.");
  }

  const response = await fetch(`${env.supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      ...baseHeaders(options.prefer),
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let details = null;
    try {
      details = await response.json();
    } catch {
      details = await response.text();
    }
    throw httpError(response.status, details?.message || "Supabase request failed.", details);
  }

  if (response.status === 204) return null;
  return response.json();
}
