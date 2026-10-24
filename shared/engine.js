// Residual risk engine (Scope Document §10–§12). Pure functions, shared by server, browser demo and tests.
import { RISKS, CONTROLS, RESULTS, NONBANK, LABELS, ENV_LABELS } from "./data.js";

export const riskApplies = (riskCode, ent) => riskCode !== "RC-04" || ent.islamic;

export function controlApplies(ctl, ent) {
  if (ctl.applies === "Banks only") return !NONBANK.includes(ent.type);
  if (ctl.applies === "Islamic only") return ent.islamic;
  return true;
}

export function addMonths(iso, months) {
  const d = new Date(iso + "T00:00:00Z");
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d.toISOString().slice(0, 10);
}

export const oeScore = result => (RESULTS.indexOf(result) + 1) || null;

// Test status and effective control rating (CE 1–4) for one entity/control (§10.2, §11).
export function evaluateTest(test, ctl, ent, config) {
  if (!controlApplies(ctl, ent)) return { status: "N/A", ce: null };
  if (!test || !test.test_date || !test.result) return { status: "Not tested", ce: 4 };
  const oe = oeScore(test.result);
  const cat = !ctl.key ? "nonkey" : oe === 1 ? "eff" : oe === 4 ? "ineff" : "mid";
  const due = addMonths(test.test_date, config.intervals[cat][ent.tier - 1]);
  let status = "Current";
  if (test.review === "Rejected") status = "Evidence rejected";
  else if (test.review !== "Accepted") status = "Evidence pending";
  else if (due < config.asOf) status = "Overdue";
  const ce = status === "Current" ? Math.max(Number(test.de) || 1, oe) : 4;
  return { status, ce, oe, due };
}

// Control environment for one risk (§10.3): weighted average CE, key-control cap, coverage rule.
export function controlEnvironment(riskCode, ent, tests, config) {
  let sw = 0, swc = 0, keys = 0, keyFail = 0;
  const detail = [];
  for (const ctl of CONTROLS) {
    const m = ctl.maps.find(([r]) => r === riskCode);
    if (!m || !controlApplies(ctl, ent)) continue;
    const ev = evaluateTest(tests[ctl.id], ctl, ent, config);
    sw += m[1]; swc += m[1] * ev.ce;
    if (ctl.key) { keys++; if (ev.ce === 4) keyFail++; }
    detail.push({ id: ctl.id, weight: m[1], key: ctl.key, ...ev });
  }
  if (!keys) return { env: 4, weighted: null, keys, keyFail, detail, note: "No key control" };
  const weighted = swc / sw;
  let env = weighted < 1.5 ? 1 : weighted < 2.5 ? 2 : weighted < 3.5 ? 3 : 4;
  if (keyFail) env = Math.max(env, config.keyCap);
  return { env, weighted, keys, keyFail, detail };
}

export function appetiteStatus(res, max) {
  if (res == null) return "";
  return res <= max ? "Within" : res - max === 1 ? "Amber" : "Red";
}

// Full assessment for one entity: every risk with inherent, control environment, residual and appetite.
export function assessEntity(ent, ratings = {}, tests = {}, config) {
  const rows = RISKS.map(r => {
    if (!riskApplies(r.code, ent)) return { code: r.code, name: r.name, na: true };
    const inh = Number(ratings[r.code]?.inherent) || null;
    const ce = controlEnvironment(r.code, ent, tests, config);
    const res = inh ? config.matrix[inh][ce.env - 1] : null;
    const max = config.appetite[r.code];
    return { code: r.code, name: r.name, inh, env: ce.env, envLabel: ENV_LABELS[ce.env], weighted: ce.weighted,
      keyFail: ce.keyFail, res, max, app: appetiteStatus(res, max), rationale: ratings[r.code]?.rationale || "" };
  });
  const live = rows.filter(x => !x.na && x.res);
  const avg = k => (live.length ? live.reduce((a, x) => a + x[k], 0) / live.length : null);
  const evals = CONTROLS.map(c => evaluateTest(tests[c.id], c, ent, config)).filter(e => e.status !== "N/A");
  return {
    rows,
    inhAvg: avg("inh"), resAvg: avg("res"),
    outside: live.filter(x => x.app !== "Within").length,
    red: live.filter(x => x.app === "Red").length,
    unrated: rows.filter(x => !x.na && !x.inh).length,
    testsApplicable: evals.length,
    testsCurrent: evals.filter(e => e.status === "Current").length,
    evidencePending: evals.filter(e => e.status === "Evidence pending").length,
  };
}

export const label = n => LABELS[n] || "";
