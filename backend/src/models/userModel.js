import { createModel } from "./baseModel.js";
import { supabaseRequest, encodeFilter } from "../utils/supabaseRest.js";

const users = createModel("users");

export const UserModel = {
  ...users,

  async findByIdentifier(identifier) {
    const value = encodeFilter(identifier);
    const rows = await supabaseRequest(`users?select=*&or=(email.eq.${value},phone.eq.${value})&limit=1`);
    return rows[0] || null;
  },

  async emailOrPhoneExists({ email, phone }) {
    const filters = [];
    if (email) filters.push(`email.eq.${encodeFilter(email)}`);
    if (phone) filters.push(`phone.eq.${encodeFilter(phone)}`);
    if (!filters.length) return false;
    const rows = await supabaseRequest(`users?select=id&or=(${filters.join(",")})&limit=1`);
    return rows.length > 0;
  },

  async findByResetTokenHash(tokenHash) {
    const rows = await supabaseRequest(`users?select=*&password_reset_token_hash=eq.${encodeFilter(tokenHash)}&limit=1`);
    return rows[0] || null;
  },
};
