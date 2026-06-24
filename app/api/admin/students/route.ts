import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { q, qOne } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function requireTeacher() {
  const s = await getSession();
  return s && s.role === "teacher" ? s : null;
}

// เพิ่มนักเรียน (ครูเท่านั้น)
export async function POST(req: Request) {
  if (!(await requireTeacher())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json();
  const studentNumber = String(b.student_number ?? "").trim();
  const firstName = String(b.first_name ?? "").trim();
  if (!studentNumber || !firstName) {
    return NextResponse.json({ error: "ต้องมีเลขประจำตัวและชื่อ" }, { status: 400 });
  }
  const username = studentNumber; // ใช้เลขประจำตัวเป็นชื่อผู้ใช้
  const exists = await qOne<{ id: number }>("SELECT id FROM users WHERE username = ?", [username]);
  if (exists) return NextResponse.json({ error: "เลขประจำตัวนี้มีอยู่แล้ว" }, { status: 409 });

  const prefix = String(b.prefix ?? "").trim();
  const lastName = String(b.last_name ?? "").trim();
  const name = `${prefix}${firstName} ${lastName}`.trim();
  const password = String(b.password ?? "").trim() || studentNumber; // รหัสเริ่มต้น = เลขประจำตัว

  const inserted = await q<{ id: number }>(
    "INSERT INTO users (username, password_hash, name, role) VALUES (?,?,?,'student') RETURNING id",
    [username, bcrypt.hashSync(password, 10), name]
  );
  const userId = Number(inserted[0].id);
  await q(
    `INSERT INTO students (user_id, prefix, first_name, last_name, student_number, academic_year, term, grade, room, subject_code)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      userId,
      prefix,
      firstName,
      lastName,
      studentNumber,
      String(b.academic_year ?? "").trim(),
      String(b.term ?? "").trim(),
      String(b.grade ?? "").trim(),
      String(b.room ?? "").trim(),
      String(b.subject_code ?? "").trim(),
    ]
  );
  return NextResponse.json({ ok: true, userId, username, password });
}

// รีเซ็ตรหัสผ่าน
export async function PATCH(req: Request) {
  if (!(await requireTeacher())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { userId, password } = await req.json();
  const pw = String(password ?? "").trim();
  if (!userId || !pw) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  await q("UPDATE users SET password_hash = ? WHERE id = ? AND role = 'student'", [
    bcrypt.hashSync(pw, 10),
    Number(userId),
  ]);
  return NextResponse.json({ ok: true });
}

// ลบนักเรียน
export async function DELETE(req: Request) {
  if (!(await requireTeacher())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });
  await q("DELETE FROM users WHERE id = ? AND role = 'student'", [Number(userId)]);
  return NextResponse.json({ ok: true });
}
