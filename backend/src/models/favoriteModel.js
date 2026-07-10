import { createModel } from "./baseModel.js";
import { encodeFilter, supabaseRequest } from "../utils/supabaseRest.js";

const BaseFavoriteModel = createModel("favorites");

export const FavoriteModel = {
  ...BaseFavoriteModel,

  listForUser(userId, targetType) {
    const params = new URLSearchParams({
      select: "*",
      user_id: `eq.${userId}`,
    });
    if (targetType) params.set("target_type", `eq.${targetType}`);
    params.set("order", "created_at.desc");
    return supabaseRequest(`favorites?${params.toString()}`);
  },

  async findForUser(userId, targetType, targetId) {
    const rows = await supabaseRequest(
      `favorites?select=*&user_id=eq.${encodeFilter(userId)}&target_type=eq.${encodeFilter(targetType)}&target_id=eq.${encodeFilter(targetId)}&limit=1`
    );
    return rows[0] || null;
  },

  removeForUser(userId, targetType, targetId) {
    return supabaseRequest(
      `favorites?user_id=eq.${encodeFilter(userId)}&target_type=eq.${encodeFilter(targetType)}&target_id=eq.${encodeFilter(targetId)}`,
      {
        method: "DELETE",
        prefer: "return=minimal",
      }
    );
  },
};
