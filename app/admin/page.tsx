import Link from "next/link";
import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import { getSession } from "@/lib/auth";
import { qOne, q } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function AdminHome() {
  const s = await getSession();
  if (!s || s.role !== "teacher") redirect("/login");

  const n = async (sql: string) => Number((await qOne<{ c: number }>(sql))?.c || 0);
  const students = await n("SELECT COUNT(*) AS c FROM users WHERE role='student'");
  const problems = await n("SELECT COUNT(*) AS c FROM problems WHERE published=1");
  const assignments = await n("SELECT COUNT(*) AS c FROM assignments");
  const today = new Date().toISOString().slice(0, 10);
  const activeToday = Number(
    (await qOne<{ c: number }>("SELECT COUNT(DISTINCT user_id) AS c FROM submissions WHERE substr(created_at,1,10)=?", [today]))
      ?.c || 0
  );

  const recent = await q<{ title: string; assign_date: string; id: number; cnt: number; doers: number }>(
    `SELECT a.id, a.title, a.assign_date,
       (SELECT COUNT(*) FROM assignment_problems ap WHERE ap.assignment_id=a.id) AS cnt,
       (SELECT COUNT(DISTINCT user_id) FROM submissions sub WHERE sub.assignment_id=a.id) AS doers
     FROM assignments a ORDER BY a.assign_date DESC, a.id DESC LIMIT 6`
  );

  return (
    <AppShell session={s} active="/admin">
      <h1 className="text-xl font-bold mb-4">📊 ภาพรวม</h1>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Card label="นักเรียน" value={students} icon="👩‍🎓" href="/admin/students" />
        <Card label="โจทย์ในคลัง" value={problems} icon="🧮" href="/admin/problems" />
        <Card label="ภารกิจ" value={assignments} icon="🎯" href="/admin/assignments" />
        <Card label="ทำวันนี้" value={activeToday} icon="🔥" />
      </div>

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold">ภารกิจล่าสุด</h2>
        <Link href="/admin/assignments" className="text-sm text-orange-600 font-medium">
          + สร้างภารกิจ
        </Link>
      </div>
      <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {recent.length === 0 && <p className="p-4 text-sm text-slate-400">ยังไม่มีภารกิจ</p>}
        {recent.map((a) => (
          <div key={a.id} className="p-3 flex items-center gap-3 text-sm">
            <span className="text-xl">🎯</span>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{a.title}</div>
              <div className="text-xs text-slate-400">
                {a.assign_date} • {Number(a.cnt)} ข้อ
              </div>
            </div>
            <span className="text-slate-500">ทำแล้ว {Number(a.doers)} คน</span>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function Card({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: number;
  icon: string;
  href?: string;
}) {
  const inner = (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 hover:border-orange-300">
      <div className="text-2xl">{icon}</div>
      <div className="text-2xl font-extrabold mt-1">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}
