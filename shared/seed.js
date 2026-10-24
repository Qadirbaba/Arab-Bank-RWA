// Deterministic ILLUSTRATIVE sample data so the platform can be demonstrated end to end.
import { ENTITIES, RISKS, CONTROLS, RESULTS, DEFAULT_CONFIG } from "./data.js";
import { controlApplies, riskApplies, addMonths } from "./engine.js";

export function buildSeed() {
  let s = 2026;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 1.15;
  const clip = (v, a, b) => Math.max(a, Math.min(b, Math.round(v)));
  const P = { L: 0.15, M: 0.45, H: 0.8 }, Q = { L: 1.2, M: 1.55, H: 2.1 };
  const STAT = ["Approved", "Submitted", "Submitted", "Approved", "Draft", "Returned", "Submitted", "Approved", "Conditions"];
  const config = structuredClone(DEFAULT_CONFIG);
  const asOf = config.asOf;
  const minus = days => new Date(Date.parse(asOf) - days * 864e5).toISOString().slice(0, 10);
  const why = ["", "Limited exposure; indicators below group thresholds.", "Moderate exposure; within normal operations.",
    "Exposure requires active management; see indicator file.", "Significant exposure from customer and geography factors.",
    "Severe exposure; high-risk jurisdiction and customer profile."];
  const state = { config, assessments: {}, ratings: {}, tests: {}, evidence: {}, comments: {}, audit: [] };
  let evId = 1;

  ENTITIES.forEach((e, i) => {
    const status = STAT[i % STAT.length];
    const submitted = status === "Draft" ? null : `${minus(clip(rnd() * 20, 0, 20) - 21)}T10:00:00Z`;
    state.assessments[e.code] = { status, submitted_at: submitted, submitted_by: submitted ? `co.${e.code.toLowerCase()}` : null,
      decided_at: ["Approved", "Conditions", "Returned"].includes(status) ? "2026-10-23T12:00:00Z" : null,
      decided_by: ["Approved", "Conditions", "Returned"].includes(status) ? "cco" : null,
      decision_comment: status === "Conditions" ? "Approved subject to re-testing CTL-SAN-01 by 31 Dec 2026."
        : status === "Returned" ? "Evidence for CTL-SAN-01 not accepted; please re-test and resubmit." : null };
    state.ratings[e.code] = {};
    for (const r of RISKS) {
      if (!riskApplies(r.code, e)) continue;
      const inh = clip(1 + 4 * P[e.profile] + gauss(), 1, 5);
      // leave a few risks unrated for draft entities so the submit check can be shown
      if (status === "Draft" && rnd() < 0.15) continue;
      state.ratings[e.code][r.code] = { inherent: inh, rationale: why[inh] };
    }
    state.tests[e.code] = {}; state.evidence[e.code] = {};
    for (const c of CONTROLS) {
      if (!controlApplies(c, e)) continue;
      const de = clip(Q[e.profile] + gauss() * 0.45, 1, 4), oe = clip(Q[e.profile] + gauss() * 0.5, 1, 4);
      if (rnd() < 0.01) { state.tests[e.code][c.id] = { de }; continue; }
      const cat = !c.key ? "nonkey" : oe === 1 ? "eff" : oe === 4 ? "ineff" : "mid";
      const months = config.intervals[cat][e.tier - 1];
      const ago = rnd() < 0.025 ? (months + 1 + rnd() * 2) * 30.4 : (0.2 + rnd() * (months - 0.8)) * 30.4;
      const date = minus(Math.round(ago));
      const rv = rnd();
      const review = rv < 0.015 ? "Rejected" : rv < 0.05 ? "Pending" : "Accepted";
      state.tests[e.code][c.id] = { de, result: RESULTS[oe - 1], test_date: date, tester: `CMT – ${e.code}`,
        sample: c.freq === "Daily" || c.freq === "Event-driven" ? 25 : c.freq === "Monthly" ? 3 : 1,
        exceptions: [0, 1, 2, 5][oe - 1], review, reviewer: review === "Pending" ? null : "cco" };
      state.evidence[e.code][c.id] = [{ id: evId++, filename: `EV-${e.code}-${c.id}-${date.slice(0, 7)}.pdf`, size: 120000 + Math.round(rnd() * 900000),
        sha256: "sample", uploaded_by: `co.${e.code.toLowerCase()}`, uploaded_at: `${date}T09:00:00Z`, sample: true }];
    }
    state.comments[e.code] = state.assessments[e.code].decision_comment
      ? [{ author: "cco", role: "cco", text: state.assessments[e.code].decision_comment, at: "2026-10-23T12:00:00Z" }] : [];
  });
  state.audit.push({ ts: "2026-10-01T08:00:00Z", user: "system", action: `Campaign ${config.cycle} launched to 30 entities`, entity: null });
  for (const e of ENTITIES) {
    const a = state.assessments[e.code];
    if (a.submitted_at) state.audit.push({ ts: a.submitted_at, user: a.submitted_by, action: "Submitted assessment to Head Office", entity: e.code });
    if (a.decided_at) state.audit.push({ ts: a.decided_at, user: "cco", action: `Decision: ${a.status}`, entity: e.code });
  }
  state.audit.sort((a, b) => a.ts.localeCompare(b.ts));
  return state;
}

export { addMonths };
