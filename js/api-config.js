// Frontend API configuration.
// Local development uses the Express server on port 3000.
// GitHub/deployed builds can set window.GULIT_API_BASE_URL before main.js, or
// localStorage.gulit:v1:apiBaseUrl, to the deployed backend URL.

const override =
  globalThis.window?.GULIT_API_BASE_URL ||
  globalThis.localStorage?.getItem("gulit:v1:apiBaseUrl");

const isLocal =
  globalThis.location?.hostname === "localhost" ||
  globalThis.location?.hostname === "127.0.0.1";

export const API_BASE_URL = override || (isLocal ? "http://localhost:3000/api" : "/api");
