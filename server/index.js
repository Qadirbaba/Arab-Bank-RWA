// EWRA Platform server: Express API + static web UI. Designed to run inside the bank's network (Docker).
import express from "express";
import multer from "multer";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb, loadState } from "./db.js";
import { entity, control, RISKS, RESULTS } from "../shared/data.js";
import { assessEntity, riskApplies, controlApplies } from "../shared/engine.js";
import { canView, canEdit, canReviewEvidence, canDecide, canConfigure, canRemind, submitError, decisionError } from "../shared/workflow.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA = process.env.EWRA_DATA_DIR || path.join(ROOT, "data");
const PORT = Number(process.env.PORT || 8080);
const db = openDb(DATA);
const SECRET = process.env.EWRA_SESSION_SECRET || (() => {
  const f = path.join(DATA, "session.secret");
  if (!fs.existsSync(f)) fs.writeFileSync(f, crypto.randomBytes(32).toString("hex"), { mode: 0o600 });
  return fs.readFileSync(f, "utf8");
})();
const COOKIE_SECURE = process.env.EWRA_COOKIE_SECURE === "true";
const ALLOWED = /\.(pdf|docx?|xlsx?|csv|txt|msg|eml|png|jpe?g|tiff?|zip)$/i;
const now = () => new Date().toISOString();

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "200kb" }));
app.use((req, res, next) => {
  res.set({ "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'",
    "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY" });
  next();
});

// ---------- sessions (HMAC-signed cookie, 8-hour expiry) ----------
const sign = v => crypto.createHmac("sha256", SECRET).update(v).digest("base64url");
function setSession(res, username) {
  const v = Buffer.from(JSON.stringify({ u: username, exp: Date.now() + 8 * 3600e3 })).toString("base64url");
  res.cookie("ewra", `${v}.${sign(v)}`, { httpOnly: true, sameSite: "strict", secure: COOKIE_SECURE, maxAge: 8 * 3600e3 });
}
function getUser(req) {
  const raw = (req.headers.cookie || "").split(/;\s*/).find(c => c.startsWith("ewra="))?.slice(5);
  if (!raw) return null;
  const [v, sig] = raw.split(".");
  if (!sig || sig.length !== sign(v).length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(v)))) return null;
  const { u, exp } = JSON.parse(Buffer.from(v, "base64url").toString());
  if (exp < Date.now()) return null;
  return db.prepare("SELECT username,name,role,entity,must_change FROM users WHERE username = ?").get(u) || null;
}
const auth = (req, res, next) => ((req.user = getUser(req)) ? next() : res.status(401).json({ error: "Not signed in" }));
const audit = (user, action, ent = null) => db.prepare("INSERT INTO audit (ts,user,action,entity) VALUES (?,?,?,?)").run(now(), user, action, ent);
const fail = (res, code, msg) => res.status(code).json({ error: msg });

function ctx(req, res) {
  const code = req.params.code, ent = entity(code);
  if (!ent) return fail(res, 404, "Unknown entity"), null;
  if (!canView(req.user, code)) return fail(res, 403, "Not permitted for this entity"), null;
  return { code, ent, a: db.prepare("SELECT * FROM assessments WHERE entity = ?").get(code) };
}

// ---------- auth ----------
const attempts = new Map();
app.post("/api/login", (req, res) => {
  const key = req.ip, t = attempts.get(key) || { n: 0, until: 0 };
  if (t.until > Date.now()) return fail(res, 429, "Too many attempts. Try again in 15 minutes.");
  const { username = "", password = "" } = req.body || {};
  const u = db.prepare("SELECT * FROM users WHERE username = ?").get(String(username).toLowerCase().trim());
  if (!u || !bcrypt.compareSync(String(password), u.pw_hash)) {
    t.n++; if (t.n >= 5) { t.until = Date.now() + 15 * 60e3; t.n = 0; } attempts.set(key, t);
    audit(String(username).slice(0, 60), "Failed sign-in");
    return fail(res, 401, "Invalid username or password");
  }
  attempts.delete(key); setSession(res, u.username); audit(u.username, "Signed in");
  res.json({ ok: true });
});
app.post("/api/logout", (req, res) => { res.clearCookie("ewra"); res.json({ ok: true }); });
app.get("/api/me", (req, res) => res.json(getUser(req)));
app.post("/api/password", auth, (req, res) => {
  const { current = "", next = "" } = req.body || {};
  const u = db.prepare("SELECT pw_hash FROM users WHERE username = ?").get(req.user.username);
  if (!bcrypt.compareSync(String(current), u.pw_hash)) return fail(res, 400, "Current password is incorrect");
  if (String(next).length < 10 || !/[A-Z]/.test(next) || !/[0-9]/.test(next)) return fail(res, 400, "Use at least 10 characters with a capital letter and a number");
  db.prepare("UPDATE users SET pw_hash = ?, must_change = 0 WHERE username = ?").run(bcrypt.hashSync(String(next), 10), req.user.username);
  audit(req.user.username, "Changed password"); res.json({ ok: true });
});

// ---------- state ----------
app.get("/api/state", auth, (req, res) => res.json(loadState(db, req.user)));

// ---------- country compliance officer actions ----------
app.put("/api/entities/:code/ratings/:risk", auth, (req, res) => {
  const c = ctx(req, res); if (!c) return;
  if (!canEdit(req.user, c.code, c.a)) return fail(res, 403, "Assessment is not editable");
  const r = RISKS.find(x => x.code === req.params.risk);
  if (!r || !riskApplies(r.code, c.ent)) return fail(res, 400, "Risk not applicable");
  const inh = Number(req.body.inherent);
  if (!(inh >= 1 && inh <= 5 && Number.isInteger(inh))) return fail(res, 400, "Inherent rating must be 1–5");
  db.prepare(`INSERT INTO ratings VALUES (?,?,?,?,?,?) ON CONFLICT(entity,risk) DO UPDATE SET inherent=excluded.inherent,
    rationale=excluded.rationale, updated_by=excluded.updated_by, updated_at=excluded.updated_at`)
    .run(c.code, r.code, inh, String(req.body.rationale || "").slice(0, 2000), req.user.username, now());
  audit(req.user.username, `Set inherent ${r.code} = ${inh}`, c.code); res.json({ ok: true });
});

app.put("/api/entities/:code/tests/:ctl", auth, (req, res) => {
  const c = ctx(req, res); if (!c) return;
  if (!canEdit(req.user, c.code, c.a)) return fail(res, 403, "Assessment is not editable");
  const k = control(req.params.ctl);
  if (!k || !controlApplies(k, c.ent)) return fail(res, 400, "Control not applicable");
  const b = req.body || {};
  if (b.result && !RESULTS.includes(b.result)) return fail(res, 400, "Unknown result");
  if (b.test_date && (!/^\d{4}-\d{2}-\d{2}$/.test(b.test_date) || b.test_date > now().slice(0, 10))) return fail(res, 400, "Invalid test date");
  const de = b.de ? Number(b.de) : null;
  if (de !== null && !(de >= 1 && de <= 4)) return fail(res, 400, "Design effectiveness must be 1–4");
  const hasEv = db.prepare("SELECT COUNT(*) n FROM evidence WHERE entity=? AND control=?").get(c.code, k.id).n;
  db.prepare(`INSERT INTO tests VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(entity,control) DO UPDATE SET de=excluded.de, result=excluded.result,
    test_date=excluded.test_date, tester=excluded.tester, sample=excluded.sample, exceptions=excluded.exceptions, review=excluded.review,
    reviewer=NULL, updated_at=excluded.updated_at`)
    .run(c.code, k.id, de, b.result || null, b.test_date || null, String(b.tester || "").slice(0, 120), Number(b.sample) || null,
      Number(b.exceptions) || 0, hasEv ? "Pending" : null, null, now());
  audit(req.user.username, `Recorded test for ${k.id}: ${b.result || "no result"}`, c.code); res.json({ ok: true });
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024, files: 1 } });
app.post("/api/entities/:code/tests/:ctl/evidence", auth, upload.single("file"), (req, res) => {
  const c = ctx(req, res); if (!c) return;
  if (!canEdit(req.user, c.code, c.a)) return fail(res, 403, "Assessment is not editable");
  const k = control(req.params.ctl);
  if (!k || !controlApplies(k, c.ent)) return fail(res, 400, "Control not applicable");
  const f = req.file;
  if (!f || !ALLOWED.test(f.originalname)) return fail(res, 400, "Attach a PDF, Office, image, text, e-mail or ZIP file (max 25 MB)");
  const stored = crypto.randomUUID(), sha = crypto.createHash("sha256").update(f.buffer).digest("hex");
  fs.writeFileSync(path.join(DATA, "uploads", stored), f.buffer, { mode: 0o600 });
  db.prepare("INSERT INTO evidence (entity,control,filename,stored,size,sha256,mime,uploaded_by,uploaded_at) VALUES (?,?,?,?,?,?,?,?,?)")
    .run(c.code, k.id, path.basename(f.originalname).slice(0, 200), stored, f.size, sha, f.mimetype, req.user.username, now());
  db.prepare(`INSERT INTO tests (entity,control,review) VALUES (?,?, 'Pending') ON CONFLICT(entity,control) DO UPDATE SET review='Pending', reviewer=NULL`)
    .run(c.code, k.id);
  audit(req.user.username, `Uploaded evidence ${f.originalname} for ${k.id} (sha256 ${sha.slice(0, 12)}…)`, c.code); res.json({ ok: true });
});

app.get("/api/evidence/:id", auth, (req, res) => {
  const ev = db.prepare("SELECT * FROM evidence WHERE id = ?").get(Number(req.params.id));
  if (!ev) return fail(res, 404, "Not found");
  if (!canView(req.user, ev.entity)) return fail(res, 403, "Not permitted");
  audit(req.user.username, `Downloaded evidence ${ev.filename}`, ev.entity);
  res.set("Content-Disposition", `attachment; filename="${ev.filename.replace(/"/g, "")}"`);
  if (ev.sample) return res.type("text/plain").send(`Sample evidence placeholder for ${ev.filename}\nIllustrative demo record – no file content.`);
  res.type(ev.mime || "application/octet-stream").sendFile(path.join(DATA, "uploads", ev.stored));
});

app.post("/api/entities/:code/submit", auth, (req, res) => {
  const c = ctx(req, res); if (!c) return;
  if (!canEdit(req.user, c.code, c.a)) return fail(res, 403, "Assessment cannot be submitted");
  if (!req.body?.attest) return fail(res, 400, "Attestation is required");
  const st = loadState(db, req.user);
  const err = submitError(assessEntity(c.ent, st.ratings[c.code], st.tests[c.code], st.config));
  if (err) return fail(res, 400, err);
  db.prepare("UPDATE assessments SET status='Submitted', submitted_at=?, submitted_by=? WHERE entity=?").run(now(), req.user.username, c.code);
  audit(req.user.username, "Attested and submitted assessment to Head Office", c.code); res.json({ ok: true });
});

// ---------- comments (both sides) ----------
app.post("/api/entities/:code/comments", auth, (req, res) => {
  const c = ctx(req, res); if (!c) return;
  if (req.user.role === "auditor") return fail(res, 403, "Read-only role");
  const text = String(req.body?.text || "").trim().slice(0, 4000);
  if (!text) return fail(res, 400, "Comment is empty");
  db.prepare("INSERT INTO comments (entity,author,role,text,at) VALUES (?,?,?,?,?)").run(c.code, req.user.username, req.user.role, text, now());
  audit(req.user.username, "Added comment", c.code); res.json({ ok: true });
});

// ---------- Head Office (Group CCO) actions ----------
app.post("/api/entities/:code/tests/:ctl/review", auth, (req, res) => {
  const c = ctx(req, res); if (!c) return;
  if (!canReviewEvidence(req.user, c.a)) return fail(res, 403, "Not permitted");
  const d = req.body?.decision;
  if (!["Accepted", "Rejected"].includes(d)) return fail(res, 400, "Decision must be Accepted or Rejected");
  const t = db.prepare("UPDATE tests SET review=?, reviewer=? WHERE entity=? AND control=?").run(d, req.user.username, c.code, req.params.ctl);
  if (!t.changes) return fail(res, 404, "No test recorded for this control");
  audit(req.user.username, `Evidence ${d.toLowerCase()} for ${req.params.ctl}${req.body.reason ? ": " + String(req.body.reason).slice(0, 300) : ""}`, c.code);
  res.json({ ok: true });
});

app.post("/api/entities/:code/decision", auth, (req, res) => {
  const c = ctx(req, res); if (!c) return;
  if (!canDecide(req.user, c.a)) return fail(res, 403, "No submission awaiting decision");
  const { decision, comment = "" } = req.body || {};
  const err = decisionError(decision, comment); if (err) return fail(res, 400, err);
  db.prepare("UPDATE assessments SET status=?, decided_at=?, decided_by=?, decision_comment=? WHERE entity=?")
    .run(decision, now(), req.user.username, String(comment).slice(0, 4000) || null, c.code);
  if (comment) db.prepare("INSERT INTO comments (entity,author,role,text,at) VALUES (?,?,?,?,?)").run(c.code, req.user.username, "cco", String(comment).slice(0, 4000), now());
  audit(req.user.username, `Decision: ${decision}`, c.code); res.json({ ok: true });
});

app.post("/api/entities/:code/remind", auth, (req, res) => {
  const c = ctx(req, res); if (!c) return;
  if (!canRemind(req.user, c.a)) return fail(res, 403, "Not permitted");
  audit(req.user.username, "Sent reminder to Country Compliance Officer", c.code); res.json({ ok: true });
});

app.put("/api/config", auth, (req, res) => {
  if (!canConfigure(req.user)) return fail(res, 403, "Only the HO Administrator can change configuration");
  const cur = JSON.parse(db.prepare("SELECT json FROM config").get().json), b = req.body || {};
  if (b.asOf && /^\d{4}-\d{2}-\d{2}$/.test(b.asOf)) cur.asOf = b.asOf;
  if (b.appetite) for (const r of RISKS) { const v = Number(b.appetite[r.code]); if (v >= 1 && v <= 5) cur.appetite[r.code] = v; }
  if (b.matrix) for (let i = 1; i <= 5; i++) for (let j = 0; j < 4; j++) { const v = Number(b.matrix[i]?.[j]); if (v >= 1 && v <= 5) cur.matrix[i][j] = v; }
  db.prepare("UPDATE config SET json = ? WHERE id = 1").run(JSON.stringify(cur));
  audit(req.user.username, "Updated configuration (appetite / residual matrix / as-of date)"); res.json({ ok: true });
});

// ---------- static UI ----------
app.use("/shared", express.static(path.join(ROOT, "shared")));
app.use(express.static(path.join(ROOT, "public")));
app.use((err, req, res, next) => { console.error(err); fail(res, err.code === "LIMIT_FILE_SIZE" ? 413 : 500, err.code === "LIMIT_FILE_SIZE" ? "File too large (max 25 MB)" : "Server error"); });

app.listen(PORT, () => console.log(`EWRA platform listening on http://localhost:${PORT}`));
