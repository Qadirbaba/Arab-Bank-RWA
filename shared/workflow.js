// Role-based access and workflow rules (Scope Document §13–§14). Enforced identically by the server and the demo.
export const ROLES = {
  cco: "Group Chief Compliance Officer (HO Administrator)",
  auditor: "Internal Audit (read-only)",
  country: "Country Compliance Officer",
};

export const canView = (user, code) => user.role !== "country" || user.entity === code;
export const isEditable = status => status === "Draft" || status === "Returned";
export const canEdit = (user, code, a) => user.role === "country" && user.entity === code && isEditable(a.status);
export const canReviewEvidence = (user, a) => user.role === "cco" && a.status !== "Approved" && a.status !== "Conditions";
export const canDecide = (user, a) => user.role === "cco" && a.status === "Submitted";
export const canConfigure = user => user.role === "cco";
export const canRemind = (user, a) => user.role === "cco" && isEditable(a.status);

export function submitError(assessment) {
  if (assessment.unrated) return `${assessment.unrated} applicable risk(s) still need an inherent rating.`;
  return null;
}

export function decisionError(decision, comment) {
  if (!["Approved", "Conditions", "Returned"].includes(decision)) return "Unknown decision.";
  if (decision !== "Approved" && !String(comment || "").trim()) return "A comment is required to approve with conditions or return.";
  return null;
}

export const statusText = s =>
  ({ Draft: "In progress", Submitted: "Awaiting HO review", Approved: "Approved", Conditions: "Approved with conditions", Returned: "Returned for rework" }[s] || s);
