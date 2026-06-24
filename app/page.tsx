import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import FireStreak from "@/components/FireStreak";
import { getSession } from "@/lib/auth";
import {
  getStudentProfile,
  getAssignmentsForStudent,
  getCompletedAssignmentIds,
  getStudentSummary,
  computeStreak,
} from "@/lib/queries";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default async function HomePage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role === "teacher") redirect("/admin");

  const profile = await getStudentProfile(s.userId);
  const assignments = profile ? await getAssignmentsForStudent(profile) : [];
  const completed = await getCompletedAssignmentIds(s.userId);
  const summary = await getStudentSummary(s.userId);
  const streak = computeStreak(summary.activeDays);

  // จำนวนข้อในแต่ละภารกิจ
  const counts = new Map<number, number>();
  if (assignments.length) {
    const rows = await q<{ assignment_id: number; c: number }>(
      `SELECT assignment_id, COUNT(*) AS c FROM assignment_problems
       WHERE assignment_id IN (${assignments.map(() => "?").join(",")})
       GROUP BY assignment_id`,
      assignments.map((a) => a.id)
    );
    for (const r of rows) counts.set(Number(r.assignment_id), Number(r.c));
  }

  const today = todayStr();
  const todays = assignments.filter((a) => a.assign_date === today);
  const others = assignments.filter((a) => a.assign_date !== today);

  return (
    <AppShell session={s} active="/">
      <div className="mb-4">
        <h1 className="text-xl font-bold">สวัสดี {s.name} 👋</h1>
        {profile && (profile.grade || profile.room) && (
          <p className="text-sm text-slate-500">
            ชั้น {profile.grade} ห้อง {profile.room}
            {profile.subject_code ? ` • วิชา ${profile.subject_code}` : ""}
          </p>
        )}
      </div>

      {/* แต้ม + ไฟต่อเนื่อง */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-2xl p-4">
          <div className="text-sm opacity-90">แต้มสะสม</div>
          <div className="text-3xl font-extrabold">{summary.totalPoints + streak.bonusPoints}</div>
          <div className="text-xs opacity-90 mt-1">
            ฐาน {summary.totalPoints} + โบนัสไฟ {streak.bonusPoints}
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="text-sm text-slate-500">ตอบถูกแล้ว</div>
          <div className="text-3xl font-extrabold text-emerald-600">{summary.totalCorrect}</div>
          <div className="text-xs text-slate-400 mt-1">จาก {summary.totalAnswered} ข้อที่ทำ</div>
        </div>
      </div>

      <div className="mb-5">
        <FireStreak runLength={streak.runLength} current={streak.current} longest={streak.longest} />
      </div>

      {/* ภารกิจวันนี้ */}
      <h2 className="text-lg font-bold mb-2">🎯 ภารกิจวันนี้</h2>
      {todays.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-5 text-center text-slate-400 text-sm mb-5">
          วันนี้ยังไม่มีภารกิจจากคุณครู — กลับมาดูใหม่นะ 😊
        </div>
      )}
      <div className="space-y-3 mb-6">
        {todays.map((a) => {
          const done = completed.has(a.id);
          return (
            <MissionCard
              key={a.id}
              id={a.id}
              title={a.title || "ภารกิจคณิต"}
              count={counts.get(a.id) || 0}
              timeLimit={a.time_limit_sec}
              done={done}
              highlight
            />
          );
        })}
      </div>

      {/* ภารกิจอื่น ๆ */}
      {others.length > 0 && (
        <>
          <h2 className="text-lg font-bold mb-2">📚 ภารกิจอื่น ๆ</h2>
          <div className="space-y-3">
            {others.map((a) => (
              <MissionCard
                key={a.id}
                id={a.id}
                title={a.title || "ภารกิจคณิต"}
                count={counts.get(a.id) || 0}
                timeLimit={a.time_limit_sec}
                done={completed.has(a.id)}
                date={a.assign_date}
              />
            ))}
          </div>
        </>
      )}
    </AppShell>
  );
}

function MissionCard({
  id,
  title,
  count,
  timeLimit,
  done,
  highlight,
  date,
}: {
  id: number;
  title: string;
  count: number;
  timeLimit: number | null;
  done: boolean;
  highlight?: boolean;
  date?: string;
}) {
  const inner = (
    <div
      className={`rounded-2xl p-4 border flex items-center gap-3 ${
        highlight && !done
          ? "bg-orange-50 border-orange-300"
          : "bg-white border-slate-200"
      }`}
    >
      <div className="text-3xl">{done ? "✅" : highlight ? "🔥" : "🧮"}</div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate">{title}</div>
        <div className="text-xs text-slate-500">
          {count} ข้อ
          {timeLimit ? ` • ⏱️ ${timeLimit} วิ/ข้อ` : " • ไม่จับเวลา"}
          {date ? ` • ${date}` : ""}
        </div>
      </div>
      {done ? (
        <span className="text-sm font-medium text-emerald-600">ทำแล้ว</span>
      ) : (
        <span className="text-sm font-semibold text-orange-600">เริ่ม ›</span>
      )}
    </div>
  );
  if (done) return inner;
  return (
    <Link href={`/play/${id}`} prefetch={false} className="block">
      {inner}
    </Link>
  );
}
