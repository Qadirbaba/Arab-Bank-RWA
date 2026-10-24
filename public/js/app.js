import { ENTITIES, RISKS, CONTROLS, LABELS, ENV_LABELS, RESULTS, entity } from "../shared/data.js";
import { assessEntity, evaluateTest, controlApplies } from "../shared/engine.js";
import { ROLES, canEdit, canReviewEvidence, canDecide, canConfigure, canRemind, statusText } from "../shared/workflow.js";
import { createApi } from "./api.js";

const api = createApi();
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = t => (t ? new Date(t).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–");
const fmtD = d => (d ? new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }) : "–");
const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const rt = v => (v ? `<span class="rt r${v}">${v}</span>` : `<span class="na">–</span>`);
const pill = s => `<span class="pill s-${s}">${statusText(s)}</span>`;
const tpill = s => `<span class="pill t-${s.replace(/\s/g, "")}">${s}</span>`;
const ceb = c => (c ? `<span class="rt ce${c}">${c}</span>` : `<span class="na">N/A</span>`);
const appCls = a => ({ Within: "within", Amber: "amber", Red: "red" }[a] || "");

let me = null, S = null, R = {}, view = "", cur = null, sub = "risks", attOnly = false, editTest = null;
const filt = { status: "All", region: "All" };

// ---------- shell ----------
const B = window.EWRA_BRAND || {};
$("product").textContent = B.product || "Entity-Wide Risk Assessment";
$("org").textContent = B.org || "";
if (B.logo) $("logo").innerHTML = `<img src="${esc(B.logo)}" alt="Logo">`;
if (api.mode === "demo") {
  $("banner").hidden = false;
  $("banner").textContent = "Demonstration build · illustrative data · not a live bank system · changes are saved only in this browser";
}
function toast(m, bad) { const t = $("toast"); t.textContent = m; t.className = bad ? "bad" : ""; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => (t.hidden = true), 3500); }
let queue_ = Promise.resolve(); // saves run one after another so quick successive edits are never lost
function act(fn, ok) {
  queue_ = queue_.then(async () => { try { await fn(); await load(); if (ok) toast(ok); render(); } catch (e) { toast(e.message, true); } });
  return queue_;
}

async function load() {
  S = await api.state(); R = {};
  for (const c of Object.keys(S.assessments)) R[c] = assessEntity(entity(c), S.ratings[c], S.tests[c], S.config);
}
async function start() {
  me = await api.me();
  if (!me) return renderLogin();
  await load();
  if (me.role === "country") { cur = me.entity; view ||= "entity"; } else view ||= "overview";
  render();
}

function renderLogin() {
  $("nav").innerHTML = ""; $("who").innerHTML = "";
  if (api.mode === "demo") {
    const btn = u => `<button class="btn b-l" data-act="demo-login" data-user="${u.username}"><b>${esc(u.name)}</b><br><span class="mut">${ROLES[u.role]}</span></button>`;
    $("main").innerHTML = `<div class="card" style="max-width:980px;margin:24px auto"><h2>Choose a role to explore the platform</h2>
      <p class="mut">Demo mode: no passwords. In the deployed platform each user signs in with bank credentials and sees only what their role permits.</p>
      <h3>Head Office</h3><div class="personas">${api.users.filter(u => u.role !== "country").map(btn).join("")}</div>
      <h3>Country Compliance Officers (30 entities)</h3><div class="personas">${api.users.filter(u => u.role === "country").map(btn).join("")}</div>
      <p style="margin-top:14px"><button class="btn b-l sm" data-act="reset">Reset demo data</button></p></div>`;
    return;
  }
  $("main").innerHTML = `<form class="card login" id="loginForm"><h2>Sign in</h2>
    <label for="u">Username</label><input id="u" autocomplete="username" required>
    <label for="p">Password</label><input id="p" type="password" autocomplete="current-password" required>
    <p class="err" id="lerr"></p><button class="btn b-n" type="submit">Sign in</button></form>`;
}

function navItems() {
  const t = me.role === "country" ? [["entity", "My entity assessment"], ["audit", "Activity log"]]
    : [["overview", "Group overview"], ["queue", "Submissions"], ["heat", "Residual heat map"], ...(canConfigure(me) ? [["settings", "Settings"]] : []), ["audit", "Audit trail"]];
  if (api.mode === "server") t.push(["account", "My account"]);
  return t;
}

function render() {
  const tag = { cco: "HO Administrator", auditor: "Read-only", country: me.entity }[me.role];
  $("who").innerHTML = `<span>${esc(me.name)} · ${esc(tag)}</span><button data-act="logout">${api.mode === "demo" ? "Switch role" : "Sign out"}</button>`;
  const v = view === "entity" && me.role !== "country" ? "queue" : view;
  $("nav").innerHTML = navItems().map(([k, l]) => `<button class="${k === v ? "on" : ""}" data-act="nav" data-view="${k}">${l}</button>`).join("");
  const warn = me.must_change && api.mode === "server" ? `<div class="msg">Please change your initial password in <a href="#" data-act="nav" data-view="account">My account</a>.</div>` : "";
  $("main").innerHTML = warn + ({ overview, queue, heat, entity: entityView, settings, audit: auditView, account }[view] || overview)();
}

// ---------- Head Office views ----------
function overview() {
  const codes = Object.keys(S.assessments), n = s => codes.filter(c => S.assessments[c].status === s).length;
  const all = codes.flatMap(c => R[c].rows.filter(x => x.res));
  const tA = codes.reduce((a, c) => a + R[c].testsApplicable, 0), tC = codes.reduce((a, c) => a + R[c].testsCurrent, 0);
  const by = RISKS.map(r => { const v = codes.map(c => R[c].rows.find(x => x.code === r.code)).filter(x => x && x.res);
    return { ...r, i: avg(v.map(x => x.inh)), s: avg(v.map(x => x.res)) }; });
  const attention = codes.filter(c => S.assessments[c].status === "Submitted" || R[c].red > 3)
    .sort((a, b) => (S.assessments[b].status === "Submitted") - (S.assessments[a].status === "Submitted") || R[b].outside - R[a].outside).slice(0, 10);
  const k = [["Entities in campaign", codes.length], ["Awaiting HO review", n("Submitted")], ["Approved", n("Approved") + n("Conditions")],
    ["Returned for rework", n("Returned")], ["In progress", n("Draft")],
    ["Outside appetite (Red / Amber)", `<span class="red">${all.filter(x => x.app === "Red").length}</span> / <span class="amber">${all.filter(x => x.app === "Amber").length}</span>`],
    ["Control tests current", tA ? Math.round((tC / tA) * 100) + "%" : "–"]];
  return `<div class="kpis">${k.map(([l, v]) => `<div class="card kpi"><small>${l}</small><b>${v}</b></div>`).join("")}</div>
  <div class="grid2"><div class="card"><h2>Inherent vs residual by risk – group average</h2>
    <p class="mut">Grey = inherent, navy = residual after tested controls (1 Low – 5 High). ${S.config.cycle} · controls as of ${fmtD(S.config.asOf)}.</p>
    ${by.map(x => `<div class="row" style="margin:5px 0"><span style="width:190px;font-size:12px">${x.code} ${esc(x.name)}</span>
      <div style="flex:1"><div class="bar"><i style="width:${(x.i || 0) * 20}%;background:#c3c9d6"></i></div>
      <div class="bar" style="margin-top:2px"><i style="width:${(x.s || 0) * 20}%;background:var(--navy2)"></i></div></div>
      <span class="mut" style="width:70px;text-align:right">${x.i ? x.i.toFixed(1) : "–"} → ${x.s ? x.s.toFixed(1) : "–"}</span></div>`).join("")}</div>
  <div class="card"><h2>Needs your attention</h2>${entTable(attention, true)}</div></div>`;
}

function entTable(codes, short) {
  return `<div class="tw"><table><tr><th>Entity</th>${short ? "" : "<th>Region</th><th>Tier</th>"}<th>Status</th>${short ? "" : "<th>Submitted</th>"}
  <th>Inherent</th><th>Residual</th><th>Outside appetite</th>${short ? "" : "<th>Tests current</th><th>Evidence pending</th>"}<th></th></tr>
  ${codes.map(c => { const e = entity(c), a = S.assessments[c], r = R[c];
    return `<tr><td><b>${c}</b> ${esc(e.name)}</td>${short ? "" : `<td>${e.region}</td><td>Tier ${e.tier}</td>`}<td>${pill(a.status)}</td>
    ${short ? "" : `<td>${a.submitted_at ? fmt(a.submitted_at) : "–"}</td>`}<td>${rt(Math.round(r.inhAvg || 0))}</td><td>${rt(Math.round(r.resAvg || 0))}</td>
    <td class="${r.red ? "red" : r.outside ? "amber" : "within"}">${r.outside}</td>
    ${short ? "" : `<td>${r.testsCurrent}/${r.testsApplicable}</td><td>${r.evidencePending}</td>`}
    <td><button class="btn b-l sm" data-act="open" data-code="${c}">Open</button></td></tr>`; }).join("")}</table></div>`;
}

function queue() {
  const regions = [...new Set(ENTITIES.map(e => e.region))];
  const codes = Object.keys(S.assessments).filter(c => (filt.status === "All" || S.assessments[c].status === filt.status)
    && (filt.region === "All" || entity(c).region === filt.region));
  return `<div class="card"><div class="row" style="justify-content:space-between"><h2>Submissions – ${codes.length} of ${Object.keys(S.assessments).length} entities</h2>
    <div class="row"><select data-filter="status">${["All", "Draft", "Submitted", "Approved", "Conditions", "Returned"].map(s => `<option value="${s}" ${filt.status === s ? "selected" : ""}>${s === "All" ? "All statuses" : statusText(s)}</option>`).join("")}</select>
    <select data-filter="region">${["All", ...regions].map(s => `<option ${filt.region === s ? "selected" : ""}>${s === "All" ? "All" : s}</option>`).join("")}</select></div></div>
    ${entTable(codes, false)}</div>`;
}

function heat() {
  const codes = Object.keys(S.assessments);
  return `<div class="card"><h2>Residual risk heat map – ${codes.length} entities × ${RISKS.length} risks</h2>
  <p class="mut">Residual rating after tested controls. Click a cell to open the entity.</p>
  <div class="tw"><table class="hm"><tr><th style="text-align:left">Entity</th>${RISKS.map(r => `<th title="${esc(r.name)}">${r.code}</th>`).join("")}</tr>
  ${codes.map(c => `<tr><td style="text-align:left;white-space:nowrap" data-act="open" data-code="${c}"><b>${c}</b></td>
    ${R[c].rows.map(x => x.na ? `<td class="na">–</td>` : `<td class="${x.res ? "r" + x.res : "na"}" data-act="open" data-code="${c}" title="${esc(entity(c).name)} · ${esc(x.name)}: ${LABELS[x.res] || "not rated"}">${x.res || "·"}</td>`).join("")}</tr>`).join("")}
  </table></div><p class="mut">${[1, 2, 3, 4, 5].map(v => `${rt(v)} ${LABELS[v]}`).join(" &nbsp; ")}</p></div>`;
}

// ---------- entity workspace (Country CO edits; HO reviews) ----------
function entityView() {
  const e = entity(cur), a = S.assessments[cur], r = R[cur];
  const back = me.role !== "country" ? `<p><a href="#" data-act="nav" data-view="queue">← Back to submissions</a></p>` : "";
  const scope = me.role === "country" ? `<div class="card" style="border-left:4px solid var(--gold)"><b>Role-based access:</b> you can see and submit only <b>${esc(e.name)}</b>.</div>` : "";
  const k = [["Inherent (avg)", r.inhAvg?.toFixed(2) ?? "–"], ["Residual (avg)", r.resAvg?.toFixed(2) ?? "–"], ["Outside appetite", r.outside],
    ["Risks not yet rated", r.unrated], ["Control tests current", `${r.testsCurrent}/${r.testsApplicable}`], ["Evidence pending HO review", r.evidencePending]];
  const tabs = [["risks", "Risk ratings"], ["controls", "Control tests & evidence"], ["comments", `Comments (${S.comments[cur].length})`]];
  return `${back}${scope}<div class="card"><div class="row" style="justify-content:space-between">
    <div><h2 style="margin:0">${esc(e.name)} <span class="mut">(${cur} · Tier ${e.tier} · ${e.region} · ${esc(e.type)})</span></h2>
    <div class="mut">${a.submitted_at ? `Submitted ${fmt(a.submitted_at)} by ${esc(a.submitted_by)}` : "Not yet submitted"}${a.decided_at ? ` · Decision ${fmt(a.decided_at)}` : ""}</div></div>${pill(a.status)}</div>
    ${a.decision_comment ? `<div class="msg" style="margin-top:10px"><b>Head Office:</b> ${esc(a.decision_comment)}</div>` : ""}
    <div class="kpis" style="margin-top:12px">${k.map(([l, v]) => `<div class="card kpi" style="margin:0"><small>${l}</small><b>${v}</b></div>`).join("")}</div>
    <div class="subnav">${tabs.map(([t, l]) => `<button class="${sub === t ? "on" : ""}" data-act="sub" data-sub="${t}">${l}</button>`).join("")}</div>
    ${{ risks: risksTab, controls: controlsTab, comments: commentsTab }[sub](e, a, r)}</div>${actionPanel(e, a, r)}`;
}

function risksTab(e, a, r) {
  const ed = canEdit(me, cur, a);
  return `<p class="mut">Inherent rating per the group methodology (factor model for FC risks, likelihood × impact for others – see the Excel calculator).
  Control environment and residual are calculated automatically from tested controls; residual = matrix(inherent, control environment).</p>
  <div class="tw"><table><tr><th>Risk</th><th>Inherent</th><th>Rationale</th><th>Control environment</th><th>Residual</th><th>Appetite (max)</th><th>Status</th></tr>
  ${r.rows.map(x => x.na ? `<tr><td>${x.code} ${esc(x.name)}</td><td colspan="6" class="na">Not applicable to this entity</td></tr>` :
    `<tr><td>${x.code} ${esc(x.name)}</td>
    <td>${ed ? `<select data-rating="${x.code}"><option value="">Rate…</option>${[1, 2, 3, 4, 5].map(v => `<option value="${v}" ${x.inh === v ? "selected" : ""}>${v} ${LABELS[v]}</option>`).join("")}</select>` : `${rt(x.inh)} ${LABELS[x.inh] || "Not rated"}`}</td>
    <td>${ed ? `<input data-rationale="${x.code}" value="${esc(x.rationale)}" placeholder="Basis for rating" style="width:100%;min-width:200px">` : esc(x.rationale)}</td>
    <td><span class="rt ce${x.env}">${x.env}</span> ${x.envLabel}${x.keyFail ? ` <span class="mut">(${x.keyFail} key control${x.keyFail > 1 ? "s" : ""} not effective)</span>` : ""}</td>
    <td>${rt(x.res)} ${LABELS[x.res] || ""}</td><td>${LABELS[x.max]}</td><td class="${appCls(x.app)}">${x.app || "–"}</td></tr>`).join("")}</table></div>`;
}

function controlsTab(e, a) {
  const ed = canEdit(me, cur, a), rv = canReviewEvidence(me, a);
  let list = CONTROLS.filter(c => controlApplies(c, e)).map(c => ({ c, t: S.tests[cur][c.id], ev: evaluateTest(S.tests[cur][c.id], c, e, S.config), files: S.evidence[cur][c.id] || [] }));
  if (attOnly) list = list.filter(x => x.ev.status !== "Current");
  const form = x => { const t = x.t || {};
    return `<tr><td colspan="10" style="background:#f8f9fc"><div class="row">
      <label>Design (1–4) <select id="f-de">${[1, 2, 3, 4].map(v => `<option ${Number(t.de) === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label>Test date <input id="f-date" type="date" value="${t.test_date || ""}" max="${new Date().toISOString().slice(0, 10)}"></label>
      <label>Result <select id="f-res"><option value="">–</option>${RESULTS.map(v => `<option ${t.result === v ? "selected" : ""}>${v}</option>`).join("")}</select></label>
      <label>Sample <input id="f-samp" type="number" min="0" value="${t.sample ?? ""}" style="width:70px"></label>
      <label>Exceptions <input id="f-exc" type="number" min="0" value="${t.exceptions ?? 0}" style="width:70px"></label>
      <label>Tester <input id="f-tester" value="${esc(t.tester || "")}" placeholder="Independent tester"></label>
      <button class="btn b-n sm" data-act="savetest" data-ctl="${x.c.id}">Save test</button><button class="btn b-l sm" data-act="canceltest">Cancel</button>
      <label class="btn b-l sm">Upload evidence <input type="file" data-upload="${x.c.id}" hidden></label></div>
      <p class="mut">Changing a test sends its evidence back to Head Office for review. The control earns mitigation credit only when evidence is accepted and the test is in date.</p></td></tr>`; };
  return `<div class="row" style="justify-content:space-between"><p class="mut">A control counts toward residual risk only when its latest test is in date and Head Office has accepted the evidence; otherwise it is treated as Ineffective.</p>
    <label class="mut"><input type="checkbox" data-act="att" ${attOnly ? "checked" : ""}> Only items needing attention</label></div>
  <div class="tw"><table><tr><th>Control</th><th>Key</th><th>Frequency</th><th>Risks</th><th>Test status</th><th>Effective CE</th><th>Test date / next due</th><th>Result</th><th>Evidence</th><th></th></tr>
  ${list.map(x => `<tr><td><b>${x.c.id}</b><br>${esc(x.c.name)}</td><td>${x.c.key ? "Key" : ""}</td><td>${x.c.freq}</td>
    <td class="mut">${x.c.maps.map(m => m[0]).join(", ")}</td><td>${tpill(x.ev.status)}</td><td>${ceb(x.ev.ce)} ${ENV_LABELS[x.ev.ce] || ""}</td>
    <td>${fmtD(x.t?.test_date)}${x.ev.due ? `<br><span class="mut">next ${fmtD(x.ev.due)}</span>` : ""}</td>
    <td>${esc(x.t?.result || "–")}${x.t?.sample ? `<br><span class="mut">sample ${x.t.sample}, exceptions ${x.t.exceptions ?? 0}</span>` : ""}</td>
    <td>${x.files.map(f => `<a href="#" data-act="dl" data-id="${f.id}">${esc(f.filename)}</a>`).join("<br>") || `<span class="na">None</span>`}
      ${x.t?.review ? `<br><span class="mut">HO review: ${x.t.review}</span>` : ""}</td>
    <td style="white-space:nowrap">${ed ? `<button class="btn b-l sm" data-act="edittest" data-ctl="${x.c.id}">Record test</button>` : ""}
      ${rv && x.files.length && x.t?.review !== "Accepted" ? `<button class="btn b-g sm" data-act="accept" data-ctl="${x.c.id}">Accept</button>` : ""}
      ${rv && x.files.length && x.t?.review !== "Rejected" ? `<button class="btn b-r sm" data-act="reject" data-ctl="${x.c.id}">Reject</button>` : ""}</td></tr>
    ${editTest === x.c.id ? form(x) : ""}`).join("")}</table></div>`;
}

function commentsTab() {
  const list = S.comments[cur];
  return `${list.length ? list.map(m => `<div class="comment ${m.role === "cco" ? "cco" : ""}"><b>${esc(m.author)}</b> <span class="mut">${fmt(m.at)}</span><br>${esc(m.text)}</div>`).join("") : `<p class="mut">No comments yet.</p>`}
  ${me.role !== "auditor" ? `<textarea id="newc" placeholder="Write a comment or challenge"></textarea><p><button class="btn b-n sm" data-act="comment">Post comment</button></p>` : ""}`;
}

function actionPanel(e, a, r) {
  if (canEdit(me, cur, a)) return `<div class="card"><h2>Attest and submit to Head Office</h2>
    ${r.unrated ? `<p class="err">${r.unrated} applicable risk(s) still need an inherent rating.</p>` : ""}
    <label><input type="checkbox" id="attest"> I confirm this assessment is complete and accurate to the best of my knowledge, and that the evidence uploaded supports the control test results.</label>
    <p><button class="btn b-n" data-act="submit" ${r.unrated ? "disabled" : ""}>Submit to Head Office</button></p></div>`;
  if (canDecide(me, a)) return `<div class="card"><h2>Head Office decision</h2>
    <textarea id="dcmt" placeholder="Comment or challenge to the Country Compliance Officer (required to approve with conditions or return)"></textarea>
    <div class="row" style="margin-top:8px"><button class="btn b-g" data-act="decide" data-d="Approved">Approve</button>
    <button class="btn b-a" data-act="decide" data-d="Conditions">Approve with conditions</button>
    <button class="btn b-r" data-act="decide" data-d="Returned">Return for rework</button></div></div>`;
  if (canRemind(me, a)) return `<div class="card"><p class="mut">This entity has not submitted yet.</p><button class="btn b-n" data-act="remind">Send reminder to Country CO</button></div>`;
  return "";
}

// ---------- settings, audit, account ----------
function settings() {
  const c = S.config, sel = (name, v) => `<select data-cfg="${name}">${[1, 2, 3, 4, 5].map(x => `<option value="${x}" ${v === x ? "selected" : ""}>${x} ${LABELS[x]}</option>`).join("")}</select>`;
  return `<div class="card"><h2>Configuration (HO Administrator)</h2><p class="mut">Changes apply to every entity immediately and are recorded in the audit trail.</p>
  <label><b>Controls assessed as of</b> <input type="date" id="cfg-asof" value="${c.asOf}"></label></div>
  <div class="grid2"><div class="card"><h2>Risk appetite – maximum acceptable residual rating</h2><table><tr><th>Risk</th><th>Appetite level</th><th>Max residual</th></tr>
  ${RISKS.map(r => `<tr><td>${r.code} ${esc(r.name)}</td><td>${r.appetite}</td><td>${sel("app-" + r.code, c.appetite[r.code])}</td></tr>`).join("")}</table></div>
  <div class="card"><h2>Residual risk matrix</h2><p class="mut">Residual rating for each inherent rating (rows) and control environment (columns).</p>
  <table class="matrix"><tr><th>Inherent</th>${ENV_LABELS.slice(1).map(l => `<th>${l}</th>`).join("")}</tr>
  ${[5, 4, 3, 2, 1].map(i => `<tr><td>${i} ${LABELS[i]}</td>${[0, 1, 2, 3].map(j => `<td>${sel(`m-${i}-${j}`, c.matrix[i][j]).replace("<select", '<select style="width:120px"')}</td>`).join("")}</tr>`).join("")}</table></div></div>
  <button class="btn b-n" data-act="savecfg">Save configuration</button>`;
}

function auditView() {
  return `<div class="card"><h2>${me.role === "country" ? "Activity log" : "Audit trail"}</h2><p class="mut">Every sign-in, rating, test, upload, download, review decision and configuration change, newest first.</p>
  <div class="tw"><table><tr><th>When</th><th>User</th><th>Entity</th><th>Action</th></tr>
  ${S.audit.slice(0, 300).map(x => `<tr><td style="white-space:nowrap">${fmt(x.ts)}</td><td>${esc(x.user)}</td><td>${esc(x.entity || "")}</td><td>${esc(x.action)}</td></tr>`).join("")}</table></div></div>`;
}

function account() {
  return `<form class="card login" id="pwForm"><h2>Change password</h2><label>Current password</label><input type="password" id="pw0" required>
  <label>New password</label><input type="password" id="pw1" required><p class="mut">At least 10 characters with a capital letter and a number.</p>
  <button class="btn b-n" type="submit">Update password</button></form>`;
}

// ---------- events ----------
document.addEventListener("click", async ev => {
  const el = ev.target.closest("[data-act]"); if (!el) return;
  const d = el.dataset, A = d.act;
  if (A !== "att") ev.preventDefault();
  if (A === "nav") { view = d.view; editTest = null; render(); scrollTo(0, 0); }
  else if (A === "open") { cur = d.code; view = "entity"; sub = "risks"; editTest = null; render(); scrollTo(0, 0); }
  else if (A === "sub") { sub = d.sub; editTest = null; render(); }
  else if (A === "att") { attOnly = el.checked; render(); }
  else if (A === "logout") {
    await api.logout(); me = null; view = ""; cur = null; sub = "risks"; attOnly = false; editTest = null;
    filt.status = filt.region = "All"; renderLogin();
  }
  else if (A === "demo-login") { await api.login(d.user); start(); }
  else if (A === "reset") { if (confirm("Reset all demo data to the original sample?")) { api.reset(); toast("Demo data reset"); } }
  else if (A === "edittest") { editTest = d.ctl; render(); }
  else if (A === "canceltest") { editTest = null; render(); }
  else if (A === "savetest") act(async () => { await api.test(cur, d.ctl, { de: $("f-de").value, test_date: $("f-date").value, result: $("f-res").value,
    sample: $("f-samp").value, exceptions: $("f-exc").value, tester: $("f-tester").value }); editTest = null; }, "Test saved");
  else if (A === "dl") api.download(Number(d.id));
  else if (A === "accept") act(() => api.review(cur, d.ctl, "Accepted"), "Evidence accepted");
  else if (A === "reject") { const why = prompt("Reason for rejecting the evidence (sent to the Country CO):"); if (why) act(() => api.review(cur, d.ctl, "Rejected", why), "Evidence rejected"); }
  else if (A === "comment") act(() => api.comment(cur, $("newc").value), "Comment posted");
  else if (A === "submit") { if (!$("attest").checked) return toast("Please tick the attestation first.", true); act(() => api.submit(cur), "Submitted to Head Office"); }
  else if (A === "decide") act(() => api.decide(cur, d.d, $("dcmt").value), "Decision recorded");
  else if (A === "remind") act(() => api.remind(cur), "Reminder sent");
  else if (A === "savecfg") {
    const g = n => Number(document.querySelector(`[data-cfg="${n}"]`).value);
    const matrix = {}; for (let i = 1; i <= 5; i++) matrix[i] = [0, 1, 2, 3].map(j => g(`m-${i}-${j}`));
    act(() => api.config({ asOf: $("cfg-asof").value, appetite: Object.fromEntries(RISKS.map(r => [r.code, g("app-" + r.code)])), matrix }), "Configuration saved");
  }
});

document.addEventListener("change", ev => {
  const t = ev.target, d = t.dataset;
  if (d.filter) { filt[d.filter] = t.value; render(); }
  else if (d.rating || d.rationale) {
    const code = d.rating || d.rationale, inh = document.querySelector(`[data-rating="${code}"]`).value;
    if (!inh) return toast("Choose an inherent rating first.", true);
    act(() => api.rating(cur, code, { inherent: Number(inh), rationale: document.querySelector(`[data-rationale="${code}"]`).value }), `${code} saved`);
  } else if (d.upload && t.files[0]) act(() => api.upload(cur, d.upload, t.files[0]), "Evidence uploaded – awaiting HO review");
});

document.addEventListener("submit", async ev => {
  ev.preventDefault();
  if (ev.target.id === "loginForm") {
    try { await api.login($("u").value, $("p").value); start(); } catch (e) { $("lerr").textContent = e.message; }
  } else if (ev.target.id === "pwForm") {
    try { await api.password($("pw0").value, $("pw1").value); me.must_change = 0; toast("Password updated"); ev.target.reset(); render(); } catch (e) { toast(e.message, true); }
  }
});

start();
