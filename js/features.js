import { apiRequest } from "./http.js";

export const Favorites = {
  async list(type) {
    const qs = type ? `?type=${encodeURIComponent(type)}` : "";
    return apiRequest(`/favorites${qs}`);
  },

  async toggle(targetType, targetId) {
    return apiRequest("/favorites/toggle", {
      method: "POST",
      body: { targetType, targetId },
    });
  },
};

export function favoriteButtonHtml(targetType, targetId, favorited = false) {
  return `
    <button
      class="fav-btn${favorited ? " favorited" : ""}"
      data-fav-type="${targetType}"
      data-fav-id="${targetId}"
      aria-label="Toggle favorite"
      type="button"
    >${favorited ? "\u2665" : "\u2661"}</button>
  `;
}

export function wireFavoriteButtons(root = document) {
  root.querySelectorAll("[data-fav-type]").forEach((btn) => {
    if (btn.dataset.wired) return;
    btn.dataset.wired = "1";
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const { favType, favId } = btn.dataset;
      btn.disabled = true;
      try {
        const { favorited } = await Favorites.toggle(favType, favId);
        btn.classList.toggle("favorited", favorited);
        btn.textContent = favorited ? "\u2665" : "\u2661";
      } catch (err) {
        console.warn("Favorite toggle failed:", err.message);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

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
