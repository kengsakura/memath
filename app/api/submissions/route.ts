import { NextResponse } from "next/server";
import { q, qOne } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { checkAnswer, pointsFor } from "@/lib/queries";

// บันทึกผลภารกิจ — ตรวจคำตอบใหม่ฝั่งเซิร์ฟเวอร์ (ไม่เชื่อค่าจาก client)
export async function POST(req: Request) {
  const s = await getSession();
  if (!s || s.role !== "student") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { assignmentId, answers } = await req.json();
  const aid = Number(assignmentId);
  if (!aid || !Array.isArray(answers)) {
    return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }

  // เฉพาะโจทย์ที่อยู่ในภารกิจนี้จริงเท่านั้น
  const allowed = await q<{ id: number; type: "choice" | "numeric"; answer: string; stars: number }>(
    `SELECT p.id, p.type, p.answer, p.stars FROM assignment_problems ap
     JOIN problems p ON p.id = ap.problem_id WHERE ap.assignment_id = ?`,
    [aid]
  );
  const byId = new Map(allowed.map((p) => [Number(p.id), p]));

  let correctCount = 0;
  let points = 0;
  for (const a of answers) {
    const p = byId.get(Number(a.problemId));
    if (!p) continue;
    const correct = checkAnswer(p.type, p.answer, String(a.given ?? ""));
    const pts = correct ? pointsFor(Number(p.stars)) : 0;
    if (correct) correctCount += 1;
    points += pts;
    await q(
      `INSERT INTO submissions (user_id, assignment_id, problem_id, given_answer, correct, time_spent_sec, points)
       VALUES (?,?,?,?,?,?,?)
       ON CONFLICT (user_id, assignment_id, problem_id) DO NOTHING`,
      [
        s.userId,
        aid,
        Number(p.id),
        String(a.given ?? ""),
        correct ? 1 : 0,
        Math.max(0, Math.round(Number(a.timeSpent) || 0)),
        pts,
      ]
    );
  }

  return NextResponse.json({
    ok: true,
    correct: correctCount,
    total: answers.length,
    points,
  });
}
