import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import AddStudentForm from "@/components/admin/AddStudentForm";
import { getSession } from "@/lib/auth";
import { q } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminStudentsPage() {
  const s = await getSession();
  if (!s || s.role !== "teacher") redirect("/login");

  const rows = await q<{
    id: number;
    name: string;
    username: string;
    grade: string;
    room: string;
    points: number;
    correct: number;
    answered: number;
  }>(
    `SELECT u.id, u.name, u.username,
       COALESCE(st.grade,'') AS grade, COALESCE(st.room,'') AS room,
       (SELECT COALESCE(SUM(points),0) FROM submissions sub WHERE sub.user_id=u.id) AS points,
       (SELECT COALESCE(SUM(correct),0) FROM submissions sub WHERE sub.user_id=u.id) AS correct,
       (SELECT COUNT(*) FROM submissions sub WHERE sub.user_id=u.id) AS answered
     FROM users u LEFT JOIN students st ON st.user_id=u.id
     WHERE u.role='student' ORDER BY st.grade, st.room, u.name`
  );

  return (
    <AppShell session={s} active="/admin/students">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">👩‍🎓 นักเรียน ({rows.length})</h1>
        <AddStudentForm />
      </div>

      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-slate-400">ยังไม่มีนักเรียน — กด “เพิ่มนักเรียน”</p>
        )}
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/admin/students/${r.id}`}
            prefetch={false}
            className="block bg-white rounded-2xl border border-slate-200 p-4 hover:border-orange-300"
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">🧒</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-orange-700 truncate">{r.name} ›</div>
                <div className="text-xs text-slate-400">
                  เลขที่ {r.username}
                  {r.grade ? ` • ชั้น ${r.grade}` : ""}
                  {r.room ? `/${r.room}` : ""}
                </div>
              </div>
              <div className="text-right text-sm">
                <div className="font-bold text-orange-600">{Number(r.points)} แต้ม</div>
                <div className="text-xs text-slate-400">
                  ถูก {Number(r.correct)}/{Number(r.answered)}
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
