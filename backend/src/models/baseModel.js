import { encodeFilter, supabaseRequest } from "../utils/supabaseRest.js";

export function createModel(table) {
  return {
    list(filters = {}) {
      const params = new URLSearchParams({ select: "*" });
      for (const [key, value] of Object.entries(filters)) {
        if (value !== undefined && value !== null && value !== "") {
          params.set(key, `eq.${value}`);
        }
      }
      return supabaseRequest(`${table}?${params.toString()}`);
    },

    async findById(id) {
      const rows = await supabaseRequest(`${table}?select=*&id=eq.${encodeFilter(id)}&limit=1`);
      return rows[0] || null;
    },

    async findOne(filters = {}) {
      const rows = await this.list(filters);
      return rows[0] || null;
    },

    create(payload) {
      return supabaseRequest(table, {
        method: "POST",
        prefer: "return=representation",
        body: JSON.stringify(payload),
      }).then((rows) => rows[0]);
    },

    update(id, payload) {
      return supabaseRequest(`${table}?id=eq.${encodeFilter(id)}`, {
        method: "PATCH",
        prefer: "return=representation",
        body: JSON.stringify(payload),
      }).then((rows) => rows[0] || null);
    },

    remove(id) {
      return supabaseRequest(`${table}?id=eq.${encodeFilter(id)}`, {
        method: "DELETE",
        prefer: "return=minimal",
      });
    },
  };
}
