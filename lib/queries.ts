// Data-access layer — รวม query ที่หน้าเว็บใช้ไว้ที่เดียว
// ทำงานได้ทั้ง SQLite (dev) และ Postgres/Supabase (prod) ผ่าน q()/qOne() ใน lib/db.ts
import { q, qOne } from "./db";

export type Problem = {
  id: number;
  code: string | null;
  topic: string;
  tags: string; // คั่นด้วยจุลภาค เช่น "การคูณ ชุด 1, จำนวนนับ"
  stars: number;
  type: "choice" | "numeric";
  question: string;
  choices: string; // JSON array (string)
  answer: string;
  explanation: string;
  time_limit_sec: number | null;
  published: number;
};

export type StudentProfile = {
  user_id: number;
  prefix: string;
  first_name: string;
  last_name: string;
  student_number: string;
  academic_year: string;
  term: string;
  grade: string;
  room: string;
  subject_code: string;
};

export type Assignment = {
  id: number;
  title: string;
  assign_date: string;
  academic_year: string;
  term: string;
  grade: string;
  room: string;
  subject_code: string;
  time_limit_sec: number | null;
  created_at: string;
};

/** แต้มต่อข้อ = ดาว × 10 (ตอบถูกเท่านั้น) */
export function pointsFor(stars: number): number {
  return stars * 10;
}

// ตรวจคำตอบ: choice เทียบ index, numeric เทียบค่าตัวเลข (เผื่อทศนิยมคลาดเคลื่อนเล็กน้อย)
export function checkAnswer(
  type: "choice" | "numeric",
  correctAnswer: string,
  given: string
): boolean {
  const g = String(given ?? "").trim();
  if (type === "choice") return g !== "" && g === String(correctAnswer).trim();
  const gv = parseFloat(g.replace(",", "."));
  const cv = parseFloat(String(correctAnswer).replace(",", "."));
  if (Number.isNaN(gv) || Number.isNaN(cv)) return false;
  return Math.abs(gv - cv) < 1e-6;
}

// แท็กเก็บเป็นสตริงคั่นจุลภาค → แตกเป็นรายการ (ตัดช่องว่าง/ค่าว่าง)
export function parseTags(s: string): string[] {
  return String(s ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export function parseChoices(json: string): string[] {
  try {
    const a = JSON.parse(json);
    return Array.isArray(a) ? a.map(String) : [];
  } catch {
    return [];
  }
}

// ───────────────────────── โจทย์ (คลัง) ─────────────────────────
export async function listProblems(includeUnpublished = true): Promise<Problem[]> {
  const where = includeUnpublished ? "" : "WHERE published = 1";
  return q<Problem>(`SELECT * FROM problems ${where} ORDER BY topic, stars, id`);
}

export async function getProblem(id: number): Promise<Problem | undefined> {
  return qOne<Problem>("SELECT * FROM problems WHERE id = ?", [id]);
}

// ───────────────────────── นักเรียน ─────────────────────────
export async function getStudentProfile(userId: number): Promise<StudentProfile | undefined> {
  return qOne<StudentProfile>("SELECT * FROM students WHERE user_id = ?", [userId]);
}

// ───────────────────────── ภารกิจ ─────────────────────────
export async function getAssignment(id: number): Promise<Assignment | undefined> {
  return qOne<Assignment>("SELECT * FROM assignments WHERE id = ?", [id]);
}

export async function getAssignmentProblems(assignmentId: number): Promise<Problem[]> {
  return q<Problem>(
    `SELECT p.* FROM assignment_problems ap
     JOIN problems p ON p.id = ap.problem_id
     WHERE ap.assignment_id = ? ORDER BY ap.sort_order, p.id`,
    [assignmentId]
  );
}

// ภารกิจที่ตรงกับชั้น/ห้อง/ปี/เทอม ของนักเรียน (ช่องว่าง = ใช้ได้กับทุกค่า)
export async function getAssignmentsForStudent(p: StudentProfile): Promise<Assignment[]> {
  return q<Assignment>(
    `SELECT * FROM assignments
     WHERE (grade = '' OR grade = ?)
       AND (room = '' OR room = ?)
       AND (academic_year = '' OR academic_year = ?)
       AND (term = '' OR term = ?)
     ORDER BY assign_date DESC, id DESC`,
    [p.grade, p.room, p.academic_year, p.term]
  );
}

// id ของภารกิจที่นักเรียนทำเสร็จแล้ว (มี submission อย่างน้อย 1 ข้อ)
export async function getCompletedAssignmentIds(userId: number): Promise<Set<number>> {
  const rows = await q<{ assignment_id: number }>(
    "SELECT DISTINCT assignment_id FROM submissions WHERE user_id = ?",
    [userId]
  );
  return new Set(rows.map((r) => Number(r.assignment_id)));
}

// ───────────────────────── คะแนน / สถิติ ─────────────────────────
export type StudentSummary = {
  totalPoints: number; // แต้มฐาน (ไม่รวมโบนัส)
  totalStars: number; // จำนวนข้อที่ตอบถูก
  totalCorrect: number;
  totalAnswered: number;
  activeDays: string[]; // วันที่ที่ทำภารกิจ (YYYY-MM-DD) เรียงน้อย→มาก
};

export async function getStudentSummary(userId: number): Promise<StudentSummary> {
  const agg = await qOne<{ pts: number; correct: number; answered: number; stars: number }>(
    `SELECT COALESCE(SUM(points),0) AS pts,
            COALESCE(SUM(correct),0) AS correct,
            COUNT(*) AS answered,
            COALESCE(SUM(CASE WHEN correct=1 THEN 1 ELSE 0 END),0) AS stars
     FROM submissions WHERE user_id = ?`,
    [userId]
  );
  const dayRows = await q<{ d: string }>(
    "SELECT DISTINCT substr(created_at,1,10) AS d FROM submissions WHERE user_id = ? ORDER BY d",
    [userId]
  );
  return {
    totalPoints: Number(agg?.pts || 0),
    totalCorrect: Number(agg?.correct || 0),
    totalAnswered: Number(agg?.answered || 0),
    totalStars: Number(agg?.stars || 0),
    activeDays: dayRows.map((r) => r.d),
  };
}

// ───────────────────────── Streak / ไฟต่อเนื่อง ─────────────────────────
export type StreakInfo = {
  current: number; // ความต่อเนื่องล่าสุด (จำนวนวันติดกันถึงวันล่าสุดที่ทำ)
  longest: number;
  activeToday: boolean;
  // แต่ละวันที่ทำ → ความยาว streak สะสมถึงวันนั้น (ใช้ไล่สีไฟ)
  runLength: Record<string, number>;
  bonusPoints: number; // โบนัสจากความต่อเนื่อง (derived)
};

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dayDiff(a: string, b: string): number {
  // จำนวนวันระหว่าง a→b (b - a)
  const da = Date.parse(a + "T00:00:00Z");
  const db = Date.parse(b + "T00:00:00Z");
  return Math.round((db - da) / 86400000);
}

// คำนวณความต่อเนื่องจากรายการวันที่ที่ทำกิจกรรม (เรียงน้อย→มาก)
export function computeStreak(activeDays: string[], today = ymd(new Date())): StreakInfo {
  const runLength: Record<string, number> = {};
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of activeDays) {
    if (prev && dayDiff(prev, d) === 1) run += 1;
    else run = 1; // วันแรก หรือเว้นช่วง → เริ่มนับใหม่ (เริ่มสีใหม่)
    runLength[d] = run;
    if (run > longest) longest = run;
    prev = d;
  }
  // current: ต่อเนื่องนับจากวันล่าสุดที่ทำ ถ้าวันล่าสุด = วันนี้หรือเมื่อวาน ถือว่ายังต่อ
  let current = 0;
  const activeToday = activeDays.includes(today);
  if (prev) {
    const gap = dayDiff(prev, today);
    if (gap <= 1) current = runLength[prev];
  }
  // โบนัส: แต่ละวันที่ทำ ได้โบนัส = min(runLen, 10) × 5
  let bonusPoints = 0;
  for (const d of activeDays) bonusPoints += Math.min(runLength[d], 10) * 5;
  return { current, longest, activeToday, runLength, bonusPoints };
}
