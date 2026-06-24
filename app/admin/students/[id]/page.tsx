import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import FireStreak from "@/components/FireStreak";
import StarRating from "@/components/StarRating";
import MathText from "@/components/MathText";
import StudentAdminActions from "@/components/admin/StudentAdminActions";
import { getSession } from "@/lib/auth";
import { getStudentProfile, getStudentSummary, computeStreak } from "@/lib/queries";
import { q, qOne } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const s = await getSession();
  if (!s || s.role !== "teacher") redirect("/login");

  const { id } = await params;
  const userId = Number(id);
  const user = await qOne<{ name: string; username: string }>(
    "SELECT name, username FROM users WHERE id = ? AND role='student'",
    [userId]
  );
  if (!user) redirect("/admin/students");

  const profile = await getStudentProfile(userId);
  const summary = await getStudentSummary(userId);
  const streak = computeStreak(summary.activeDays);

  const perAssignment = await q<{
    title: string;
    assign_date: string;
    cnt: number;
    correct: number;
    points: number;
  }>(
    `SELECT a.title, a.assign_date,
       COUNT(*) AS cnt,
       COALESCE(SUM(sub.correct),0) AS correct,
       COALESCE(SUM(sub.points),0) AS points
     FROM submissions sub JOIN assignments a ON a.id = sub.assignment_id
     WHERE sub.user_id = ? GROUP BY a.id, a.title, a.assign_date
     ORDER BY a.assign_date DESC`,
    [userId]
  );

  const recent = await q<{ question: string; correct: number; stars: number; given_answer: string; created_at: string }>(
    `SELECT p.question, sub.correct, p.stars, sub.given_answer, sub.created_at
     FROM submissions sub JOIN problems p ON p.id = sub.problem_id
     WHERE sub.user_id = ? ORDER BY sub.id DESC LIMIT 20`,
    [userId]
  );

  return (
    <AppShell session={s} active="/admin/students">
      <Link href="/admin/students" className="text-sm text-slate-400">
        ← นักเรียนทั้งหมด
      </Link>
      <h1 className="text-xl font-bold mt-1 mb-1">{user.name}</h1>
      {profile && (
        <p className="text-sm text-slate-500 mb-4">
          เลขประจำตัว {profile.student_number || user.username}
          {profile.grade ? ` • ชั้น ${profile.grade}` : ""}
          {profile.room ? `/${profile.room}` : ""}
          {profile.academic_year ? ` • ปี ${profile.academic_year}` : ""}
          {profile.term ? ` เทอม ${profile.term}` : ""}
          {profile.subject_code ? ` • วิชา ${profile.subject_code}` : ""}
        </p>
      )}

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="แต้มรวม" value={summary.totalPoints + streak.bonusPoints} color="text-orange-600" />
        <Stat label="ตอบถูก" value={`${summary.totalCorrect}/${summary.totalAnswered}`} color="text-emerald-600" />
        <Stat label="ไฟต่อเนื่อง" value={`${streak.current} วัน`} color="text-rose-600" />
      </div>

      <div className="mb-5">
        <FireStreak runLength={streak.runLength} current={streak.current} longest={streak.longest} days={42} />
      </div>

      <h2 className="text-lg font-bold mb-2">🎯 ผลรายภารกิจ</h2>
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 mb-5">
        {perAssignment.length === 0 && <p className="p-4 text-sm text-slate-400">ยังไม่ได้ทำภารกิจใด</p>}
        {perAssignment.map((a, i) => (
          <div key={i} className="p-3 flex items-center gap-3 text-sm">
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{a.title}</div>
              <div className="text-xs text-slate-400">{a.assign_date}</div>
            </div>
            <div className="text-right">
              <div className="font-semibold text-emerald-600">
                {Number(a.correct)}/{Number(a.cnt)}
              </div>
              <div className="text-xs text-orange-600">+{Number(a.points)} แต้ม</div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-lg font-bold mb-2">🕘 คำตอบล่าสุด</h2>
      <div className="space-y-2 mb-5">
        {recent.map((r, i) => (
          <div key={i} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3 text-sm">
            <span className="text-lg">{Number(r.correct) === 1 ? "✅" : "❌"}</span>
            <div className="flex-1 min-w-0 truncate text-slate-600">
              <MathText text={r.question} />
            </div>
            <StarRating stars={Number(r.stars)} size="text-xs" />
          </div>
        ))}
      </div>

      <StudentAdminActions userId={userId} />
    </AppShell>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 text-center">
      <div className={`text-xl font-extrabold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
