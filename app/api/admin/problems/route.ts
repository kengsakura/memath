import { NextResponse } from "next/server";
import { q } from "@/lib/db";
import { getSession } from "@/lib/auth";

async function requireTeacher() {
  const s = await getSession();
  return s && s.role === "teacher" ? s : null;
}

function normalize(b: Record<string, unknown>) {
  const type = b.type === "choice" ? "choice" : "numeric";
  const choices = Array.isArray(b.choices) ? (b.choices as unknown[]).map(String) : [];
  const stars = Math.max(1, Math.min(5, Number(b.stars) || 1));
  const tl = b.time_limit_sec === null || b.time_limit_sec === "" ? null : Number(b.time_limit_sec) || null;
  return {
    topic: String(b.topic ?? "").trim(),
    stars,
    type,
    question: String(b.question ?? "").trim(),
    choices: JSON.stringify(choices),
    answer: String(b.answer ?? "").trim(),
    explanation: String(b.explanation ?? "").trim(),
    time_limit_sec: tl,
    published: b.published === 0 || b.published === false ? 0 : 1,
  };
}

export async function POST(req: Request) {
  if (!(await requireTeacher())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const n = normalize(await req.json());
  if (!n.question || !n.answer) {
    return NextResponse.json({ error: "ต้องมีโจทย์และคำตอบ" }, { status: 400 });
  }
  const r = await q<{ id: number }>(
    `INSERT INTO problems (topic, stars, type, question, choices, answer, explanation, time_limit_sec, published)
     VALUES (?,?,?,?,?,?,?,?,?) RETURNING id`,
    [n.topic, n.stars, n.type, n.question, n.choices, n.answer, n.explanation, n.time_limit_sec, n.published]
  );
  return NextResponse.json({ ok: true, id: Number(r[0].id) });
}

export async function PUT(req: Request) {
  if (!(await requireTeacher())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const id = Number(body.id);
  if (!id) return NextResponse.json({ error: "ไม่พบรหัสโจทย์" }, { status: 400 });
  const n = normalize(body);
  await q(
    `UPDATE problems SET topic=?, stars=?, type=?, question=?, choices=?, answer=?, explanation=?, time_limit_sec=?, published=? WHERE id=?`,
    [n.topic, n.stars, n.type, n.question, n.choices, n.answer, n.explanation, n.time_limit_sec, n.published, id]
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  if (!(await requireTeacher())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "ไม่พบรหัสโจทย์" }, { status: 400 });
  await q("DELETE FROM problems WHERE id = ?", [Number(id)]);
  return NextResponse.json({ ok: true });
}
