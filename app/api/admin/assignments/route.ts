import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function requireTeacher() {
  const s = await getSession();
  return s && s.role === "teacher" ? s : null;
}

// สร้างภารกิจ: เลือกโจทย์เอง (problemIds) หรือสุ่มจากคลัง (random + เงื่อนไข)
export async function POST(req: Request) {
  if (!(await requireTeacher())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json();
  const assignDate = String(b.assign_date ?? "").trim();
  if (!assignDate) return NextResponse.json({ error: "ต้องเลือกวันที่" }, { status: 400 });

  // เลือกโจทย์
  let problemIds: number[] = [];
  if (Array.isArray(b.problemIds) && b.problemIds.length) {
    problemIds = b.problemIds.map((x: unknown) => Number(x)).filter(Boolean);
  } else {
    // สุ่มจากคลังตามเงื่อนไข
    const where: string[] = ["published = 1"];
    const params: unknown[] = [];
    if (b.stars) {
      where.push("stars = ?");
      params.push(Number(b.stars));
    }
    if (b.topic) {
      where.push("topic = ?");
      params.push(String(b.topic));
    }
    const cand = await q<{ id: number }>(
      `SELECT id FROM problems WHERE ${where.join(" AND ")}`,
      params
    );
    // สุ่มสับ (cross-DB: ทำใน JS แทน RANDOM()/random())
    const ids = cand.map((r) => Number(r.id));
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    problemIds = ids.slice(0, Math.max(1, Number(b.count) || 5));
  }

  if (problemIds.length === 0) {
    return NextResponse.json({ error: "ไม่มีโจทย์ตรงเงื่อนไข" }, { status: 400 });
  }

  const tl =
    b.time_limit_sec === null || b.time_limit_sec === "" ? null : Number(b.time_limit_sec) || null;

  const r = await q<{ id: number }>(
    `INSERT INTO assignments (title, assign_date, academic_year, term, grade, room, subject_code, time_limit_sec)
     VALUES (?,?,?,?,?,?,?,?) RETURNING id`,
    [
      String(b.title ?? "").trim() || "ภารกิจคณิต",
      assignDate,
      String(b.academic_year ?? "").trim(),
      String(b.term ?? "").trim(),
      String(b.grade ?? "").trim(),
      String(b.room ?? "").trim(),
      String(b.subject_code ?? "").trim(),
      tl,
    ]
  );
  const aid = Number(r[0].id);

  for (let i = 0; i < problemIds.length; i++) {
    await q(
      "INSERT INTO assignment_problems (assignment_id, problem_id, sort_order) VALUES (?,?,?) ON CONFLICT (assignment_id, problem_id) DO NOTHING",
      [aid, problemIds[i], i]
    );
  }
  return NextResponse.json({ ok: true, id: aid, count: problemIds.length });
}

// ลบภารกิจ
export async function DELETE(req: Request) {
  if (!(await requireTeacher())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  await q("DELETE FROM assignments WHERE id = ?", [Number(id)]);
  return NextResponse.json({ ok: true });
}
