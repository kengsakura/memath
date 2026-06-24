import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AssignmentCreator from "@/components/admin/AssignmentCreator";
import DeleteAssignmentButton from "@/components/admin/DeleteAssignmentButton";
import { getSession } from "@/lib/auth";
import { listProblems, parseTags } from "@/lib/queries";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminAssignmentsPage() {
  const s = await getSession();
  if (!s || s.role !== "teacher") redirect("/login");

  const problems = await listProblems(false);
  const pickList = problems.map((p) => ({
    id: p.id,
    topic: p.topic,
    stars: p.stars,
    question: p.question,
  }));
  const topics = [...new Set(problems.map((p) => p.topic).filter(Boolean))];
  const tags = [...new Set(problems.flatMap((p) => parseTags(p.tags)))].sort();

  const assignments = await q<{
    id: number;
    title: string;
    assign_date: string;
    grade: string;
    room: string;
    time_limit_sec: number | null;
    cnt: number;
    doers: number;
  }>(
    `SELECT a.id, a.title, a.assign_date, a.grade, a.room, a.time_limit_sec,
       (SELECT COUNT(*) FROM assignment_problems ap WHERE ap.assignment_id=a.id) AS cnt,
       (SELECT COUNT(DISTINCT user_id) FROM submissions sub WHERE sub.assignment_id=a.id) AS doers
     FROM assignments a ORDER BY a.assign_date DESC, a.id DESC`
  );

  return (
    <AppShell session={s} active="/admin/assignments">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">🎯 ภารกิจ ({assignments.length})</h1>
        <AssignmentCreator problems={pickList} topics={topics} tags={tags} />
      </div>

      <div className="space-y-2">
        {assignments.length === 0 && (
          <p className="text-sm text-slate-400">ยังไม่มีภารกิจ — กด “สร้างภารกิจ”</p>
        )}
        {assignments.map((a) => (
          <div key={a.id} className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center gap-3">
            <span className="text-2xl">🎯</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{a.title}</div>
              <div className="text-xs text-slate-400">
                📅 {a.assign_date} • {Number(a.cnt)} ข้อ
                {a.grade ? ` • ชั้น ${a.grade}` : " • ทุกชั้น"}
                {a.room ? `/${a.room}` : ""}
                {a.time_limit_sec ? ` • ⏱️ ${a.time_limit_sec}วิ` : ""}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-500">ทำแล้ว {Number(a.doers)} คน</div>
              <DeleteAssignmentButton id={a.id} />
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
