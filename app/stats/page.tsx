import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import FireStreak from "@/components/FireStreak";
import StarRating from "@/components/StarRating";
import MathText from "@/components/MathText";
import { getSession } from "@/lib/auth";
import { getStudentSummary, computeStreak } from "@/lib/queries";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function StatsPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role === "teacher") redirect("/admin");

  const summary = await getStudentSummary(s.userId);
  const streak = computeStreak(summary.activeDays);

  // สรุปตามหัวข้อ
  const byTopic = await q<{ topic: string; answered: number; correct: number }>(
    `SELECT p.topic AS topic,
            COUNT(*) AS answered,
            COALESCE(SUM(sub.correct),0) AS correct
     FROM submissions sub JOIN problems p ON p.id = sub.problem_id
     WHERE sub.user_id = ? GROUP BY p.topic ORDER BY answered DESC`,
    [s.userId]
  );

  // โจทย์ล่าสุด
  const recent = await q<{ question: string; correct: number; stars: number; created_at: string }>(
    `SELECT p.question, sub.correct, p.stars, sub.created_at
     FROM submissions sub JOIN problems p ON p.id = sub.problem_id
     WHERE sub.user_id = ? ORDER BY sub.id DESC LIMIT 10`,
    [s.userId]
  );

  return (
    <AppShell session={s} active="/stats">
      <h1 className="text-xl font-bold mb-4">🔥 สถิติของฉัน</h1>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="แต้มรวม" value={summary.totalPoints + streak.bonusPoints} color="text-orange-600" />
        <Stat label="ตอบถูก" value={summary.totalCorrect} color="text-emerald-600" />
        <Stat label="ไฟต่อเนื่อง" value={`${streak.current} วัน`} color="text-rose-600" />
      </div>

      <div className="mb-5">
        <FireStreak
          runLength={streak.runLength}
          current={streak.current}
          longest={streak.longest}
          days={42}
        />
      </div>

      <h2 className="text-lg font-bold mb-2">📊 ความแม่นยำตามหัวข้อ</h2>
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 mb-5">
        {byTopic.length === 0 && <p className="p-4 text-sm text-slate-400">ยังไม่มีข้อมูล</p>}
        {byTopic.map((t) => {
          const acc = Math.round((Number(t.correct) / Number(t.answered)) * 100);
          return (
            <div key={t.topic} className="p-3">
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">{t.topic || "อื่น ๆ"}</span>
                <span className="text-slate-500">
                  {Number(t.correct)}/{Number(t.answered)} ({acc}%)
                </span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400" style={{ width: `${acc}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <h2 className="text-lg font-bold mb-2">🕘 ทำล่าสุด</h2>
      <div className="space-y-2">
        {recent.length === 0 && <p className="text-sm text-slate-400">ยังไม่มีข้อมูล</p>}
        {recent.map((r, i) => (
          <div
            key={i}
            className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3 text-sm"
          >
            <span className="text-lg">{Number(r.correct) === 1 ? "✅" : "❌"}</span>
            <div className="flex-1 min-w-0 truncate text-slate-600">
              <MathText text={r.question} />
            </div>
            <StarRating stars={Number(r.stars)} size="text-xs" />
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-3 text-center">
      <div className={`text-2xl font-extrabold ${color}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
