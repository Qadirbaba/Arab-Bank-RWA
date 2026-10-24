// SQLite persistence (Node's built-in node:sqlite – no native build step).
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { ENTITIES } from "../shared/data.js";
import { buildSeed } from "../shared/seed.js";

export function openDb(dataDir) {
  fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });
  const db = new DatabaseSync(path.join(dataDir, "ewra.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (username TEXT PRIMARY KEY, name TEXT, role TEXT, entity TEXT, pw_hash TEXT, must_change INTEGER DEFAULT 1);
    CREATE TABLE IF NOT EXISTS config (id INTEGER PRIMARY KEY CHECK (id = 1), json TEXT);
    CREATE TABLE IF NOT EXISTS assessments (entity TEXT PRIMARY KEY, status TEXT, submitted_at TEXT, submitted_by TEXT,
      decided_at TEXT, decided_by TEXT, decision_comment TEXT);
    CREATE TABLE IF NOT EXISTS ratings (entity TEXT, risk TEXT, inherent INTEGER, rationale TEXT, updated_by TEXT, updated_at TEXT,
      PRIMARY KEY (entity, risk));
    CREATE TABLE IF NOT EXISTS tests (entity TEXT, control TEXT, de INTEGER, result TEXT, test_date TEXT, tester TEXT, sample INTEGER,
      exceptions INTEGER, review TEXT, reviewer TEXT, updated_at TEXT, PRIMARY KEY (entity, control));
    CREATE TABLE IF NOT EXISTS evidence (id INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT, control TEXT, filename TEXT, stored TEXT,
      size INTEGER, sha256 TEXT, mime TEXT, uploaded_by TEXT, uploaded_at TEXT, sample INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, entity TEXT, author TEXT, role TEXT, text TEXT, at TEXT);
    CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, ts TEXT, user TEXT, action TEXT, entity TEXT);
  `);
  if (!db.prepare("SELECT COUNT(*) n FROM users").get().n) seed(db);
  return db;
}

function seed(db) {
  const pw = bcrypt.hashSync(process.env.EWRA_SEED_PASSWORD || "Ewra@2026", 10);
  const u = db.prepare("INSERT INTO users VALUES (?,?,?,?,?,1)");
  u.run("cco", "Group Chief Compliance Officer", "cco", null, pw);
  u.run("auditor", "Group Internal Audit", "auditor", null, pw);
  for (const e of ENTITIES) u.run(`co.${e.code.toLowerCase()}`, `Compliance Officer – ${e.name}`, "country", e.code, pw);

  const s = buildSeed();
  db.prepare("INSERT INTO config VALUES (1, ?)").run(JSON.stringify(s.config));
  const a = db.prepare("INSERT INTO assessments VALUES (?,?,?,?,?,?,?)");
  const r = db.prepare("INSERT INTO ratings VALUES (?,?,?,?,?,?)");
  const t = db.prepare("INSERT INTO tests VALUES (?,?,?,?,?,?,?,?,?,?,?)");
  const ev = db.prepare("INSERT INTO evidence (entity,control,filename,stored,size,sha256,mime,uploaded_by,uploaded_at,sample) VALUES (?,?,?,?,?,?,?,?,?,1)");
  const c = db.prepare("INSERT INTO comments (entity,author,role,text,at) VALUES (?,?,?,?,?)");
  const au = db.prepare("INSERT INTO audit (ts,user,action,entity) VALUES (?,?,?,?)");
  db.exec("BEGIN");
  for (const e of ENTITIES) {
    const x = s.assessments[e.code];
    a.run(e.code, x.status, x.submitted_at, x.submitted_by, x.decided_at, x.decided_by, x.decision_comment);
    for (const [k, v] of Object.entries(s.ratings[e.code])) r.run(e.code, k, v.inherent, v.rationale, "seed", null);
    for (const [k, v] of Object.entries(s.tests[e.code]))
      t.run(e.code, k, v.de ?? null, v.result ?? null, v.test_date ?? null, v.tester ?? null, v.sample ?? null, v.exceptions ?? null,
        v.review ?? null, v.reviewer ?? null, null);
    for (const [k, list] of Object.entries(s.evidence[e.code]))
      for (const f of list) ev.run(e.code, k, f.filename, null, f.size, f.sha256, "application/pdf", f.uploaded_by, f.uploaded_at);
    for (const m of s.comments[e.code]) c.run(e.code, m.author, m.role, m.text, m.at);
  }
  for (const x of s.audit) au.run(x.ts, x.user, x.action, x.entity);
  db.exec("COMMIT");
}

// Assemble the state a given user is allowed to see (row-level security by entity).
export function loadState(db, user) {
  const own = user.role === "country" ? user.entity : null;
  const where = own ? " WHERE entity = ?" : "";
  const args = own ? [own] : [];
  const st = { config: JSON.parse(db.prepare("SELECT json FROM config").get().json),
    assessments: {}, ratings: {}, tests: {}, evidence: {}, comments: {}, audit: [] };
  for (const r of db.prepare("SELECT * FROM assessments" + where).all(...args)) {
    const { entity, ...rest } = r; st.assessments[entity] = rest;
    st.ratings[entity] = {}; st.tests[entity] = {}; st.evidence[entity] = {}; st.comments[entity] = [];
  }
  for (const r of db.prepare("SELECT * FROM ratings" + where).all(...args)) st.ratings[r.entity][r.risk] = { inherent: r.inherent, rationale: r.rationale };
  for (const r of db.prepare("SELECT * FROM tests" + where).all(...args)) { const { entity, control, ...rest } = r; st.tests[entity][control] = rest; }
  for (const r of db.prepare("SELECT id,entity,control,filename,size,sha256,uploaded_by,uploaded_at,sample FROM evidence" + where).all(...args))
    (st.evidence[r.entity][r.control] ||= []).push(r);
  for (const r of db.prepare("SELECT * FROM comments" + where + " ORDER BY id").all(...args)) st.comments[r.entity].push(r);
  st.audit = db.prepare(`SELECT ts,user,action,entity FROM audit${own ? " WHERE entity = ? OR user = ?" : ""} ORDER BY id DESC LIMIT 500`)
    .all(...(own ? [own, user.username] : []));
  return st;
}
