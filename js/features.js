import { apiRequest } from "./http.js";

export const InventoryTrends = {
  async list(filters = {}) {
    const qs = new URLSearchParams(filters).toString();
    return apiRequest(`/inventory-trends${qs ? `?${qs}` : ""}`);
  },

  async get(id) {
    return apiRequest(`/inventory-trends/${encodeURIComponent(id)}`);
  },
};

export function priceTrendBadge(trend, { invertColors = false } = {}) {
  if (!trend || trend.direction === "flat" || trend.pct === 0) return "";

  const isUp = trend.direction === "up";
  const good = invertColors ? isUp : !isUp;
  const color = good ? "#22c55e" : "#ef4444";
  const arrow = isUp ? "\u25B2" : "\u25BC";
  const pulseClass = trend.isSudden ? " price-pulse" : "";
  const title = trend.isSudden ? "Sudden price change" : "Recent price change";

  return `
    <span class="price-trend${pulseClass}" style="color:${color};" title="${title}">
      ${arrow} ${Math.abs(trend.pct)}%
    </span>
  `;
}
