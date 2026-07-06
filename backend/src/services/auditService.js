import { createModel } from "../models/baseModel.js";

const AuditLog = createModel("audit_logs");

export async function writeAuditLog(actorId, action, entity, entityId, details = {}) {
  try {
    await AuditLog.create({
      actor_id: actorId || null,
      action,
      entity,
      entity_id: entityId || null,
      details,
    });
  } catch (err) {
    console.warn("Audit log write failed:", err.message);
  }
}
