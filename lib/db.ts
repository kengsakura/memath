import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import SEED_PROBLEMS from "./seed-problems.json";

// Data layer แบบเลือก backend อัตโนมัติ (ลอกแพตเทิร์นจาก PyLearn):
// - มี POSTGRES_URL (เช่นจาก Supabase integration บน Vercel) → ใช้ Postgres
// - ไม่มี → ใช้ SQLite ไฟล์ในเครื่อง (โหมด dev / รันเองในเครื่อง)
// SQL ทุกคำสั่งเขียนด้วย placeholder `?` แล้วถูกแปลงเป็น $1..$n ให้เองเมื่อใช้ Postgres

// เพิ่ม SEED_VERSION เมื่อแก้ไขคลังโจทย์ตั้งต้น เพื่อให้ sync ใหม่
export const SEED_VERSION = 3;

const PG_URL =
  process.env.POSTGRES_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.DATABASE_URL ||
  "";

const DB_DIR =
  process.env.DB_DIR ||
  (process.env.VERCEL ? "/tmp" : path.join(process.cwd(), "data"));
const SQLITE_PATH =
  process.env.DB_PATH ||
  path.join(DB_DIR, process.env.NODE_ENV === "production" ? "prod.db" : "dev.db");

type Row = Record<string, unknown>;

/* eslint-disable @typescript-eslint/no-explicit-any */
let pgSql: any = null;
let sqliteDb: any = null;
let initPromise: Promise<void> | null = null;

async function getPg() {
  if (!pgSql) {
    const postgres = (await import("postgres")).default;
    // prepare:false จำเป็นเมื่อต่อผ่าน pgbouncer (pooled URL ของ Supabase)
    pgSql = postgres(PG_URL, {
      prepare: false,
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      // คืน bigint (int8 เช่นคอลัมน์ id) เป็น number ให้เหมือน SQLite
      types: {
        bigint: {
          to: 20,
          from: [20],
          serialize: (x: number) => x.toString(),
          parse: (x: string) => Number(x),
        },
      },
    });
  }
  return pgSql;
}

async function resetPg() {
  const old = pgSql;
  pgSql = null;
  if (old) {
    try {
      await old.end({ timeout: 1 });
    } catch {
      /* ปิดไม่สำเร็จก็ทิ้งไป */
    }
  }
}

// บน serverless connection ที่ถือข้ามการเรียกอาจถูกปิดฝั่งเซิร์ฟเวอร์ — ใส่ timeout ต่อ query
async function pgRun<T>(run: (pg: any) => Promise<T>): Promise<T> {
  const QUERY_TIMEOUT = 4000;
  const attempt = async (): Promise<T> => {
    const pg = await getPg();
    return await Promise.race<T>([
      run(pg),
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error("PG_TIMEOUT")), QUERY_TIMEOUT)
      ),
    ]);
  };
  try {
    return await attempt();
  } catch {
    await resetPg();
    return await attempt();
  }
}

async function getSqlite() {
  if (!sqliteDb) {
    const Database = (await import("better-sqlite3")).default;
    fs.mkdirSync(path.dirname(SQLITE_PATH), { recursive: true });
    sqliteDb = new Database(SQLITE_PATH);
    sqliteDb.pragma("journal_mode = WAL");
    sqliteDb.pragma("foreign_keys = ON");
  }
  return sqliteDb;
}

function toPgPlaceholders(sql: string): string {
  let n = 0;
  return sql.replace(/\?/g, () => `$${++n}`);
}

async function rawQuery<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (PG_URL) {
    return (await pgRun((pg) => pg.unsafe(toPgPlaceholders(sql), params as never[]))) as T[];
  }
  const d = await getSqlite();
  const stmt = d.prepare(sql);
  if (stmt.reader) return stmt.all(...params) as T[];
  stmt.run(...params);
  return [];
}

async function rawExec(ddl: string): Promise<void> {
  if (PG_URL) {
    await pgRun((pg) => pg.unsafe(ddl));
    return;
  }
  const d = await getSqlite();
  d.exec(ddl);
}

/** รัน query (สร้าง schema + sync เนื้อหาให้อัตโนมัติครั้งแรก) — ใช้ placeholder `?` */
export async function q<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  if (!initPromise) {
    initPromise = init().catch((e) => {
      initPromise = null;
      throw e;
    });
  }
  await initPromise;
  return rawQuery<T>(sql, params);
}

/** เหมือน q แต่คืนแถวแรกแถวเดียว (หรือ undefined) */
export async function qOne<T = Row>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  const rows = await q<T>(sql, params);
  return rows[0];
}

/** เวลาปัจจุบัน UTC รูปแบบ 'YYYY-MM-DD HH:MM:SS' */
export function nowStr(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

async function init() {
  await migrate();
  await ensureColumns();
  await seedUsers();
  await syncContent();
}

// เพิ่มคอลัมน์ที่มาทีหลังให้ฐานข้อมูลเดิม (idempotent — มีอยู่แล้วก็ข้าม)
async function ensureColumns() {
  const adds = PG_URL
    ? ["ALTER TABLE problems ADD COLUMN IF NOT EXISTS tags TEXT NOT NULL DEFAULT ''"]
    : ["ALTER TABLE problems ADD COLUMN tags TEXT NOT NULL DEFAULT ''"];
  for (const ddl of adds) {
    try {
      await rawExec(ddl);
    } catch {
      /* คอลัมน์มีอยู่แล้ว (SQLite โยน duplicate column) — ข้าม */
    }
  }
}

const SQLITE_SCHEMA = `
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','teacher')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS students (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    prefix TEXT NOT NULL DEFAULT '',
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    student_number TEXT NOT NULL DEFAULT '',
    academic_year TEXT NOT NULL DEFAULT '',
    term TEXT NOT NULL DEFAULT '',
    grade TEXT NOT NULL DEFAULT '',
    room TEXT NOT NULL DEFAULT '',
    subject_code TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS problems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE,
    topic TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    stars INTEGER NOT NULL DEFAULT 1 CHECK (stars BETWEEN 1 AND 5),
    type TEXT NOT NULL DEFAULT 'numeric' CHECK (type IN ('choice','numeric')),
    question TEXT NOT NULL DEFAULT '',
    choices TEXT NOT NULL DEFAULT '[]',
    answer TEXT NOT NULL DEFAULT '',
    explanation TEXT NOT NULL DEFAULT '',
    time_limit_sec INTEGER,
    published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS assignments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT '',
    assign_date TEXT NOT NULL,
    academic_year TEXT NOT NULL DEFAULT '',
    term TEXT NOT NULL DEFAULT '',
    grade TEXT NOT NULL DEFAULT '',
    room TEXT NOT NULL DEFAULT '',
    subject_code TEXT NOT NULL DEFAULT '',
    time_limit_sec INTEGER,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS assignment_problems (
    assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (assignment_id, problem_id)
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    problem_id INTEGER NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    given_answer TEXT NOT NULL DEFAULT '',
    correct INTEGER NOT NULL DEFAULT 0,
    time_spent_sec INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, assignment_id, problem_id)
  );
`;

const PG_NOW = `to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD HH24:MI:SS')`;
const PG_SCHEMA = `
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','teacher')),
    created_at TEXT NOT NULL DEFAULT ${PG_NOW}
  );
  CREATE TABLE IF NOT EXISTS students (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    prefix TEXT NOT NULL DEFAULT '',
    first_name TEXT NOT NULL DEFAULT '',
    last_name TEXT NOT NULL DEFAULT '',
    student_number TEXT NOT NULL DEFAULT '',
    academic_year TEXT NOT NULL DEFAULT '',
    term TEXT NOT NULL DEFAULT '',
    grade TEXT NOT NULL DEFAULT '',
    room TEXT NOT NULL DEFAULT '',
    subject_code TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS problems (
    id BIGSERIAL PRIMARY KEY,
    code TEXT UNIQUE,
    topic TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    stars INTEGER NOT NULL DEFAULT 1 CHECK (stars BETWEEN 1 AND 5),
    type TEXT NOT NULL DEFAULT 'numeric' CHECK (type IN ('choice','numeric')),
    question TEXT NOT NULL DEFAULT '',
    choices TEXT NOT NULL DEFAULT '[]',
    answer TEXT NOT NULL DEFAULT '',
    explanation TEXT NOT NULL DEFAULT '',
    time_limit_sec INTEGER,
    published INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT ${PG_NOW}
  );
  CREATE TABLE IF NOT EXISTS assignments (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL DEFAULT '',
    assign_date TEXT NOT NULL,
    academic_year TEXT NOT NULL DEFAULT '',
    term TEXT NOT NULL DEFAULT '',
    grade TEXT NOT NULL DEFAULT '',
    room TEXT NOT NULL DEFAULT '',
    subject_code TEXT NOT NULL DEFAULT '',
    time_limit_sec INTEGER,
    created_at TEXT NOT NULL DEFAULT ${PG_NOW}
  );
  CREATE TABLE IF NOT EXISTS assignment_problems (
    assignment_id BIGINT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (assignment_id, problem_id)
  );
  CREATE TABLE IF NOT EXISTS submissions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assignment_id BIGINT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
    problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    given_answer TEXT NOT NULL DEFAULT '',
    correct INTEGER NOT NULL DEFAULT 0,
    time_spent_sec INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT ${PG_NOW},
    UNIQUE (user_id, assignment_id, problem_id)
  );
`;

async function migrate() {
  await rawExec(PG_URL ? PG_SCHEMA : SQLITE_SCHEMA);
}

async function seedUsers() {
  const users = await rawQuery<{ c: number }>("SELECT COUNT(*) AS c FROM users");
  if (Number(users[0]?.c) > 0) return;
  await rawQuery(
    "INSERT INTO users (username, password_hash, name, role) VALUES (?,?,?,?)",
    ["admin", bcrypt.hashSync("admin1234", 10), "ครูผู้ดูแล", "teacher"]
  );
}

type SeedProblem = {
  code: string;
  topic: string;
  tags?: string[];
  stars: number;
  type: "choice" | "numeric";
  question: string;
  choices: string[];
  answer: string;
  explanation: string;
  time_limit_sec: number | null;
};

// Sync คลังโจทย์ตั้งต้นเข้าฐานข้อมูล (รันเมื่อ SEED_VERSION เปลี่ยน)
// upsert ตาม code: ของเดิมถูกอัปเดต ของใหม่ถูกเพิ่ม — ไม่ลบแถว จึงไม่กระทบ submissions
async function syncContent() {
  const v = await rawQuery<{ value: string }>("SELECT value FROM meta WHERE key = 'seed_version'");
  if (v[0]?.value === String(SEED_VERSION)) return;

  const seed = SEED_PROBLEMS as SeedProblem[];
  const existing = await rawQuery<{ code: string }>(
    "SELECT code FROM problems WHERE code IS NOT NULL"
  );
  const have = new Set(existing.map((r) => r.code));

  for (const p of seed) {
    const params = [
      p.topic,
      (p.tags ?? []).join(", "),
      p.stars,
      p.type,
      p.question,
      JSON.stringify(p.choices ?? []),
      p.answer,
      p.explanation ?? "",
      p.time_limit_sec ?? null,
    ];
    if (have.has(p.code)) {
      await rawQuery(
        `UPDATE problems SET topic=?, tags=?, stars=?, type=?, question=?, choices=?, answer=?,
         explanation=?, time_limit_sec=?, published=1 WHERE code=?`,
        [...params, p.code]
      );
    } else {
      await rawQuery(
        `INSERT INTO problems (topic, tags, stars, type, question, choices, answer, explanation, time_limit_sec, code)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [...params, p.code]
      );
    }
  }

  await rawQuery(
    "INSERT INTO meta (key, value) VALUES ('seed_version', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    [String(SEED_VERSION)]
  );
}
