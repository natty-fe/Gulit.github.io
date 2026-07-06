import { ComplaintModel } from "../models/complaintModel.js";
import { writeAuditLog } from "../services/auditService.js";

export async function listComplaints(req, res) {
  const filters = {};
  if (req.query.status) filters.status = req.query.status;
  if (req.query.orderId) filters.order_id = req.query.orderId;
  res.json(await ComplaintModel.list(filters));
}

export async function createComplaint(req, res) {
  const complaint = await ComplaintModel.create({
    ...req.body,
    from_id: req.user.id,
    from_name: req.user.name,
    status: "open",
  });
  await writeAuditLog(req.user.id, "COMPLAINT_CREATED", "complaint", complaint.id);
  res.status(201).json(complaint);
}
