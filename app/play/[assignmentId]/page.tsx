import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getAssignment,
  getAssignmentProblems,
  getCompletedAssignmentIds,
  parseChoices,
} from "@/lib/queries";
import PlayClient from "@/components/PlayClient";

export const dynamic = "force-dynamic";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ assignmentId: string }>;
}) {
  const s = await getSession();
  if (!s) redirect("/login");
  if (s.role === "teacher") redirect("/admin");

  const { assignmentId } = await params;
  const aid = Number(assignmentId);
  const assignment = await getAssignment(aid);
  if (!assignment) redirect("/");

  const completed = await getCompletedAssignmentIds(s.userId);
  if (completed.has(aid)) redirect("/");

  const problems = (await getAssignmentProblems(aid)).map((p) => ({
    id: p.id,
    type: p.type,
    stars: p.stars,
    question: p.question,
    choices: parseChoices(p.choices),
    answer: p.answer,
    explanation: p.explanation,
    time_limit_sec: p.time_limit_sec ?? assignment.time_limit_sec ?? null,
  }));

  if (problems.length === 0) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-slate-500">ภารกิจนี้ยังไม่มีโจทย์</p>
        <Link href="/" className="text-orange-600 font-medium">
          ← กลับหน้าหลัก
        </Link>
      </div>
    );
  }

  return (
    <PlayClient
      assignmentId={aid}
      title={assignment.title || "ภารกิจคณิต"}
      timeLimit={assignment.time_limit_sec}
      problems={problems}
    />
  );
}
