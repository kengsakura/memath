import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import ProblemManager, { EditableProblem } from "@/components/admin/ProblemManager";
import { getSession } from "@/lib/auth";
import { listProblems, parseChoices } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function AdminProblemsPage() {
  const s = await getSession();
  if (!s || s.role !== "teacher") redirect("/login");

  const problems: EditableProblem[] = (await listProblems(true)).map((p) => ({
    id: p.id,
    topic: p.topic,
    stars: p.stars,
    type: p.type,
    question: p.question,
    choices: parseChoices(p.choices),
    answer: p.answer,
    explanation: p.explanation,
    time_limit_sec: p.time_limit_sec,
    published: p.published,
  }));

  return (
    <AppShell session={s} active="/admin/problems">
      <ProblemManager problems={problems} />
    </AppShell>
  );
}
