import test from "node:test";
import assert from "node:assert/strict";
import { entity, control, DEFAULT_CONFIG, CONTROLS } from "../shared/data.js";
import { evaluateTest, controlEnvironment, assessEntity, appetiteStatus, addMonths, controlApplies } from "../shared/engine.js";
import { canEdit, canDecide, decisionError, canView } from "../shared/workflow.js";
import { buildSeed } from "../shared/seed.js";

const cfg = structuredClone(DEFAULT_CONFIG);
const ae = entity("AE"), inv = entity("JO-INV"), iiab = entity("JO-IIAB");
const ok = (de, result, date = "2026-08-01") => ({ de, result, test_date: date, review: "Accepted" });

test("addMonths clamps to month end", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-03-15", 12), "2027-03-15");
});

test("test status: only in-date tests with accepted evidence count", () => {
  const k = control("CTL-KYC-01");
  assert.equal(evaluateTest(undefined, k, ae, cfg).ce, 4);
  assert.equal(evaluateTest({ ...ok(1, "Pass"), review: "Pending" }, k, ae, cfg).status, "Evidence pending");
  assert.equal(evaluateTest({ ...ok(1, "Pass"), review: "Rejected" }, k, ae, cfg).ce, 4);
  assert.equal(evaluateTest(ok(1, "Pass", "2025-01-01"), k, ae, cfg).status, "Overdue"); // Tier 1 key, effective: 6 months
  const cur = evaluateTest(ok(2, "Pass"), k, ae, cfg);
  assert.equal(cur.status, "Current"); assert.equal(cur.ce, 2); // CE = worse of design (2) and operating (1)
});

test("applicability: banks-only and Islamic-only controls", () => {
  assert.equal(controlApplies(control("CTL-TM-01"), inv), false);
  assert.equal(controlApplies(control("CTL-SH-01"), ae), false);
  assert.equal(controlApplies(control("CTL-SH-01"), iiab), true);
});

test("control environment: key-control cap and full effectiveness", () => {
  const all = Object.fromEntries(CONTROLS.map(c => [c.id, ok(1, "Pass")]));
  assert.equal(controlEnvironment("FC-04", ae, all, cfg).env, 1);
  const oneFail = { ...all, "CTL-SAN-01": ok(1, "Fail") };
  assert.equal(controlEnvironment("FC-04", ae, oneFail, cfg).env, 3); // capped at Partially effective
});

test("residual matrix and appetite", () => {
  const all = Object.fromEntries(CONTROLS.map(c => [c.id, ok(1, "Pass")]));
  const r = assessEntity(ae, { "FC-01": { inherent: 5 } }, all, cfg).rows.find(x => x.code === "FC-01");
  assert.equal(r.res, 3); // High inherent + Effective environment → Medium
  assert.equal(r.app, "Amber"); // FC-01 max acceptable = Medium-Low (2)
  assert.equal(appetiteStatus(4, 2), "Red");
  assert.equal(appetiteStatus(1, 1), "Within");
});

test("workflow: role-based access and decisions", () => {
  const co = { role: "country", entity: "AE" }, cco = { role: "cco" };
  assert.equal(canView(co, "EG"), false);
  assert.equal(canEdit(co, "AE", { status: "Draft" }), true);
  assert.equal(canEdit(co, "AE", { status: "Submitted" }), false);
  assert.equal(canEdit(cco, "AE", { status: "Draft" }), false);
  assert.equal(canDecide(cco, { status: "Submitted" }), true);
  assert.ok(decisionError("Returned", ""));
  assert.equal(decisionError("Approved", ""), null);
});

test("seed data covers 30 entities and is deterministic", () => {
  const a = buildSeed(), b = buildSeed();
  assert.equal(Object.keys(a.assessments).length, 30);
  assert.deepEqual(a.ratings, b.ratings);
});
