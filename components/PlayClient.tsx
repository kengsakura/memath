"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MathText from "./MathText";
import StarRating from "./StarRating";

type PlayProblem = {
  id: number;
  type: "choice" | "numeric";
  stars: number;
  question: string;
  choices: string[];
  answer: string;
  explanation: string;
  time_limit_sec: number | null;
};

// ตรวจคำตอบฝั่ง client เพื่อโชว์ผลทันที (เซิร์ฟเวอร์ตรวจซ้ำตอนบันทึก)
function isCorrect(p: PlayProblem, given: string): boolean {
  const g = String(given ?? "").trim();
  if (p.type === "choice") return g !== "" && g === String(p.answer).trim();
  const gv = parseFloat(g.replace(",", "."));
  const cv = parseFloat(String(p.answer).replace(",", "."));
  if (Number.isNaN(gv) || Number.isNaN(cv)) return false;
  return Math.abs(gv - cv) < 1e-6;
}

export default function PlayClient({
  assignmentId,
  title,
  problems,
}: {
  assignmentId: number;
  title: string;
  timeLimit?: number | null;
  problems: PlayProblem[];
}) {
  const router = useRouter();
  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"answer" | "feedback">("answer");
  const [input, setInput] = useState("");
  const [given, setGiven] = useState<string[]>(() => problems.map(() => ""));
  const [flags, setFlags] = useState<boolean[]>(() => problems.map(() => false));
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ correct: number; total: number; points: number } | null>(null);
  const startedAt = useRef<number>(Date.now());

  const p = problems[idx];
  const lastCorrect = flags[idx];

  const submit = useCallback(
    (value: string) => {
      if (phase !== "answer") return;
      const correct = isCorrect(p, value);
      setGiven((g) => {
        const n = [...g];
        n[idx] = value;
        return n;
      });
      setFlags((f) => {
        const n = [...f];
        n[idx] = correct;
        return n;
      });
      setTimeLeft(null);
      setPhase("feedback");
    },
    [idx, p, phase]
  );

  // ตัวจับเวลาต่อข้อ (ถ้ามี)
  useEffect(() => {
    startedAt.current = Date.now();
    if (phase !== "answer") return;
    if (!p.time_limit_sec) {
      setTimeLeft(null);
      return;
    }
    setTimeLeft(p.time_limit_sec);
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(t);
          // หมดเวลา → ส่งคำตอบที่กรอกไว้ (อาจว่าง = ผิด)
          submit(input);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, phase]);

  function next() {
    if (idx + 1 >= problems.length) {
      finish();
      return;
    }
    setIdx((i) => i + 1);
    setInput("");
    setPhase("answer");
  }

  async function finish() {
    setDone(true);
    const answers = problems.map((pr, i) => ({
      problemId: pr.id,
      given: given[i],
      timeSpent: 0,
    }));
    try {
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignmentId, answers }),
      });
      const data = await res.json();
      setResult({
        correct: data.correct ?? flags.filter(Boolean).length,
        total: data.total ?? problems.length,
        points: data.points ?? 0,
      });
    } catch {
      setResult({ correct: flags.filter(Boolean).length, total: problems.length, points: 0 });
    }
  }

  // ───── หน้าจบภารกิจ ─────
  if (done) {
    const correct = result?.correct ?? flags.filter(Boolean).length;
    const total = result?.total ?? problems.length;
    const pct = Math.round((correct / total) * 100);
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-7xl animate-flicker mb-2">{pct >= 80 ? "🏆" : pct >= 50 ? "🔥" : "💪"}</div>
        <h1 className="text-2xl font-bold text-orange-700 mb-1">จบภารกิจ!</h1>
        <p className="text-slate-500 mb-5">{title}</p>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-xs text-center animate-pop">
          <div className="text-5xl font-extrabold text-emerald-600">
            {correct}/{total}
          </div>
          <div className="text-sm text-slate-500 mb-3">ตอบถูก ({pct}%)</div>
          <div className="text-3xl font-bold text-orange-600">+{result?.points ?? 0} แต้ม</div>
        </div>
        <button
          onClick={() => {
            router.push("/");
            router.refresh();
          }}
          className="mt-6 bg-orange-600 hover:bg-orange-700 text-white font-semibold px-8 py-3 rounded-xl"
        >
          กลับหน้าหลัก 🔥
        </button>
      </div>
    );
  }

  // ───── หน้าเล่น ─────
  const progress = ((idx + (phase === "feedback" ? 1 : 0)) / problems.length) * 100;

  return (
    <div className="min-h-dvh flex flex-col max-w-xl mx-auto w-full">
      {/* แถบบน: ความคืบหน้า + เวลา */}
      <div className="px-4 pt-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <button onClick={() => router.push("/")} className="text-slate-400">
            ✕ ออก
          </button>
          <span className="font-medium text-slate-600">
            ข้อ {idx + 1}/{problems.length}
          </span>
          {timeLeft !== null ? (
            <span
              className={`font-bold tabular-nums ${
                timeLeft <= 5 ? "text-rose-600 animate-pulse" : "text-orange-600"
              }`}
            >
              ⏱️ {timeLeft}
            </span>
          ) : (
            <span className="text-slate-300 text-xs">ไม่จับเวลา</span>
          )}
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* โจทย์ */}
      <div className="flex-1 flex flex-col px-4 py-6">
        <div className="mb-1">
          <StarRating stars={p.stars} />
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 text-center text-xl leading-relaxed mb-5 shadow-sm">
          <MathText text={p.question} />
        </div>

        {phase === "answer" ? (
          p.type === "choice" ? (
            <ChoiceInput choices={p.choices} onPick={(i) => submit(String(i))} />
          ) : (
            <NumericInput value={input} setValue={setInput} onSubmit={() => submit(input)} />
          )
        ) : (
          <Feedback
            correct={lastCorrect}
            problem={p}
            given={given[idx]}
            onNext={next}
            isLast={idx + 1 >= problems.length}
          />
        )}
      </div>
    </div>
  );
}

function ChoiceInput({ choices, onPick }: { choices: string[]; onPick: (i: number) => void }) {
  return (
    <div className="grid grid-cols-1 gap-3">
      {choices.map((c, i) => (
        <button
          key={i}
          onClick={() => onPick(i)}
          className="bg-white border-2 border-slate-200 hover:border-orange-400 active:scale-[0.98] rounded-2xl px-4 py-4 text-lg flex items-center gap-3 transition"
        >
          <span className="w-8 h-8 shrink-0 rounded-full bg-orange-100 text-orange-700 font-bold grid place-items-center">
            {String.fromCharCode(65 + i)}
          </span>
          <MathText text={c} />
        </button>
      ))}
    </div>
  );
}

function NumericInput({
  value,
  setValue,
  onSubmit,
}: {
  value: string;
  setValue: (v: string) => void;
  onSubmit: () => void;
}) {
  const keys = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "-", "0", "."];
  const press = (k: string) => {
    if (k === "." && value.includes(".")) return;
    if (k === "-" && value.length > 0) return; // ใส่ลบได้เฉพาะตัวแรก
    setValue(value + k);
  };
  return (
    <div className="mt-auto">
      <div className="bg-white border-2 border-orange-300 rounded-2xl px-4 py-5 text-center text-3xl font-bold tabular-nums mb-3 min-h-[68px]">
        {value || <span className="text-slate-300">?</span>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {keys.map((k) => (
          <button
            key={k}
            onClick={() => press(k)}
            className="bg-white border border-slate-200 active:bg-slate-100 rounded-xl py-4 text-2xl font-semibold"
          >
            {k}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <button
          onClick={() => setValue(value.slice(0, -1))}
          className="bg-slate-100 active:bg-slate-200 rounded-xl py-4 text-lg font-medium"
        >
          ⌫ ลบ
        </button>
        <button
          onClick={onSubmit}
          disabled={value.trim() === ""}
          className="bg-orange-600 disabled:bg-slate-300 text-white rounded-xl py-4 text-lg font-bold"
        >
          ส่งคำตอบ
        </button>
      </div>
    </div>
  );
}

function Feedback({
  correct,
  problem,
  given,
  onNext,
  isLast,
}: {
  correct: boolean;
  problem: PlayProblem;
  given: string;
  onNext: () => void;
  isLast: boolean;
}) {
  const correctText =
    problem.type === "choice"
      ? problem.choices[Number(problem.answer)] ?? problem.answer
      : problem.answer;
  return (
    <div className="mt-auto animate-pop">
      <div
        className={`rounded-2xl p-4 mb-3 ${
          correct ? "bg-emerald-50 border border-emerald-300" : "bg-rose-50 border border-rose-300"
        }`}
      >
        <div className={`text-lg font-bold ${correct ? "text-emerald-700" : "text-rose-700"}`}>
          {correct ? "🎉 ถูกต้อง!" : "❌ ยังไม่ถูก"}
        </div>
        {!correct && (
          <div className="text-sm text-slate-600 mt-1">
            คำตอบที่ถูกคือ <MathText text={String(correctText)} className="font-semibold" />
            {given?.trim() ? (
              <span className="text-slate-400"> (คุณตอบ {problem.type === "choice" ? String.fromCharCode(65 + Number(given)) : given})</span>
            ) : (
              <span className="text-slate-400"> (หมดเวลา/ไม่ได้ตอบ)</span>
            )}
          </div>
        )}
        {problem.explanation && (
          <div className="text-sm text-slate-600 mt-2">
            💡 <MathText text={problem.explanation} />
          </div>
        )}
      </div>
      <button
        onClick={onNext}
        className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-xl"
      >
        {isLast ? "ดูผลภารกิจ 🏁" : "ข้อต่อไป ›"}
      </button>
    </div>
  );
}
