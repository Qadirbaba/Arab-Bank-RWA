// Data access layer. "server" mode talks to the Node API; "demo" mode runs the same rules entirely in the browser.
import { ENTITIES, entity, control, RESULTS } from "../shared/data.js";
import { buildSeed } from "../shared/seed.js";
import { assessEntity } from "../shared/engine.js";
import { canView, canEdit, canReviewEvidence, canDecide, canConfigure, canRemind, submitError, decisionError } from "../shared/workflow.js";

export const DEMO_USERS = [
  { username: "cco", name: "Group Chief Compliance Officer", role: "cco", entity: null },
  { username: "auditor", name: "Group Internal Audit", role: "auditor", entity: null },
  ...ENTITIES.map(e => ({ username: `co.${e.code.toLowerCase()}`, name: `Compliance Officer – ${e.name}`, role: "country", entity: e.code })),
];

async function call(method, url, body, isForm) {
  const r = await fetch(url, { method, credentials: "same-origin",
    headers: isForm || !body ? {} : { "Content-Type": "application/json" }, body: isForm ? body : body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

function serverApi() {
  const E = c => `api/entities/${encodeURIComponent(c)}`;
  return {
    mode: "server",
    me: () => call("GET", "api/me").catch(() => null),
    login: (u, p) => call("POST", "api/login", { username: u, password: p }),
    logout: () => call("POST", "api/logout"),
    password: (current, next) => call("POST", "api/password", { current, next }),
    state: () => call("GET", "api/state"),
    rating: (c, r, b) => call("PUT", `${E(c)}/ratings/${r}`, b),
    test: (c, k, b) => call("PUT", `${E(c)}/tests/${k}`, b),
    upload: (c, k, file) => { const f = new FormData(); f.append("file", file); return call("POST", `${E(c)}/tests/${k}/evidence`, f, true); },
    download: id => { window.location.href = `api/evidence/${id}`; },
    review: (c, k, decision, reason) => call("POST", `${E(c)}/tests/${k}/review`, { decision, reason }),
    submit: c => call("POST", `${E(c)}/submit`, { attest: true }),
    comment: (c, text) => call("POST", `${E(c)}/comments`, { text }),
    decide: (c, decision, comment) => call("POST", `${E(c)}/decision`, { decision, comment }),
    remind: c => call("POST", `${E(c)}/remind`),
    config: b => call("PUT", "api/config", b),
  };
}

function demoApi() {
  const KEY = "ewra-demo-v1";
  let full, user = null;
  try { full = JSON.parse(localStorage.getItem(KEY)); } catch { full = null; }
  if (!full) full = buildSeed();
  full.audit.sort((x, y) => y.ts.localeCompare(x.ts));
  try { user = JSON.parse(sessionStorage.getItem(KEY + "-user")); } catch { user = null; }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(full)); } catch { /* storage unavailable: keep in memory */ } };
  const ts = () => new Date().toISOString();
  const log = (action, ent = null) => { full.audit.unshift({ ts: ts(), user: user.username, action, entity: ent }); save(); };
  const guard = (ok, msg) => { if (!ok) throw new Error(msg); };
  const a = c => { guard(entity(c) && canView(user, c), "Not permitted for this entity"); return full.assessments[c]; };
  return {
    mode: "demo",
    users: DEMO_USERS,
    reset: () => { localStorage.removeItem(KEY); full = buildSeed(); full.audit.sort((x, y) => y.ts.localeCompare(x.ts)); },
    me: async () => user,
    login: async u => { user = DEMO_USERS.find(x => x.username === u); sessionStorage.setItem(KEY + "-user", JSON.stringify(user)); log("Signed in (demo)"); },
    logout: async () => { user = null; sessionStorage.removeItem(KEY + "-user"); },
    state: async () => {
      const keep = c => canView(user, c), pick = o => Object.fromEntries(Object.entries(o).filter(([c]) => keep(c)));
      return { config: full.config, assessments: pick(full.assessments), ratings: pick(full.ratings), tests: pick(full.tests),
        evidence: pick(full.evidence), comments: pick(full.comments),
        audit: full.audit.filter(x => user.role !== "country" || x.entity === user.entity || x.user === user.username) };
    },
    rating: async (c, r, b) => { guard(canEdit(user, c, a(c)), "Assessment is not editable");
      full.ratings[c][r] = { inherent: Number(b.inherent), rationale: b.rationale || "" }; log(`Set inherent ${r} = ${b.inherent}`, c); },
    test: async (c, k, b) => { guard(canEdit(user, c, a(c)), "Assessment is not editable"); guard(!b.result || RESULTS.includes(b.result), "Unknown result");
      const hasEv = (full.evidence[c][k] || []).length;
      full.tests[c][k] = { ...b, de: b.de ? Number(b.de) : null, sample: Number(b.sample) || null, exceptions: Number(b.exceptions) || 0,
        review: hasEv ? "Pending" : null, reviewer: null };
      log(`Recorded test for ${k}: ${b.result || "no result"}`, c); },
    upload: async (c, k, file) => { guard(canEdit(user, c, a(c)), "Assessment is not editable");
      let sha = "n/a";
      try { sha = [...new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer()))].map(x => x.toString(16).padStart(2, "0")).join(""); } catch { /* insecure context */ }
      (full.evidence[c][k] ||= []).push({ id: Date.now(), filename: file.name, size: file.size, sha256: sha, uploaded_by: user.username, uploaded_at: ts(), sample: true });
      full.tests[c][k] = { ...(full.tests[c][k] || {}), review: "Pending", reviewer: null };
      log(`Uploaded evidence ${file.name} for ${k} (demo: metadata only)`, c); },
    download: () => alert("Demo mode: evidence files are not stored. In the deployed platform the file downloads here and the download is logged."),
    review: async (c, k, decision, reason) => { guard(canReviewEvidence(user, a(c)), "Not permitted");
      guard(full.tests[c][k], "No test recorded"); full.tests[c][k].review = decision; full.tests[c][k].reviewer = user.username;
      log(`Evidence ${decision.toLowerCase()} for ${k}${reason ? ": " + reason : ""}`, c); },
    submit: async c => { const x = a(c); guard(canEdit(user, c, x), "Assessment cannot be submitted");
      const err = submitError(assessEntity(entity(c), full.ratings[c], full.tests[c], full.config)); guard(!err, err);
      Object.assign(x, { status: "Submitted", submitted_at: ts(), submitted_by: user.username }); log("Attested and submitted assessment to Head Office", c); },
    comment: async (c, text) => { a(c); guard(user.role !== "auditor", "Read-only role"); guard(text.trim(), "Comment is empty");
      full.comments[c].push({ author: user.username, role: user.role, text: text.trim(), at: ts() }); log("Added comment", c); },
    decide: async (c, decision, comment) => { const x = a(c); guard(canDecide(user, x), "No submission awaiting decision");
      const err = decisionError(decision, comment); guard(!err, err);
      Object.assign(x, { status: decision, decided_at: ts(), decided_by: user.username, decision_comment: comment || null });
      if (comment) full.comments[c].push({ author: user.username, role: "cco", text: comment, at: ts() });
      log(`Decision: ${decision}`, c); },
    remind: async c => { guard(canRemind(user, a(c)), "Not permitted"); log("Sent reminder to Country Compliance Officer", c); },
    config: async b => { guard(canConfigure(user), "Only the HO Administrator can change configuration");
      if (b.asOf) full.config.asOf = b.asOf; if (b.appetite) Object.assign(full.config.appetite, b.appetite); if (b.matrix) full.config.matrix = b.matrix;
      log("Updated configuration (appetite / residual matrix / as-of date)"); },
  };
}

export const createApi = () => (window.EWRA_MODE === "demo" ? demoApi() : serverApi());
export { control };
