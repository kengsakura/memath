"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MathText from "@/components/MathText";
import StarRating from "@/components/StarRating";

export type EditableProblem = {
  id: number | null;
  topic: string;
  tags: string; // คั่นด้วยจุลภาค
  stars: number;
  type: "choice" | "numeric";
  question: string;
  choices: string[];
  answer: string; // numeric: ค่า, choice: index
  explanation: string;
  time_limit_sec: number | null;
  published: number;
};

const blank: EditableProblem = {
  id: null,
  topic: "",
  tags: "",
  stars: 1,
  type: "numeric",
  question: "",
  choices: ["", "", "", ""],
  answer: "",
  explanation: "",
  time_limit_sec: null,
  published: 1,
};

function splitTags(s: string): string[] {
  return String(s ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function ProblemManager({ problems }: { problems: EditableProblem[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<EditableProblem | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // รวมแท็กทั้งหมดในคลัง (ไม่ซ้ำ) สำหรับทำชิปกรอง
  const allTags = [...new Set(problems.flatMap((p) => splitTags(p.tags)))].sort();

  const shown = problems.filter((p) => {
    if (tagFilter && !splitTags(p.tags).includes(tagFilter)) return false;
    if (search && !p.question.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  async function del(id: number) {
    if (!confirm("ลบโจทย์ข้อนี้?")) return;
    await fetch("/api/admin/problems", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold">🧮 คลังโจทย์ ({shown.length}/{problems.length})</h1>
        <button
          onClick={() => setEditing({ ...blank })}
          className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-xl text-sm"
        >
          + เพิ่มโจทย์
        </button>
      </div>

      {/* ค้นหา + กรองตามแท็ก/ชุด */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 ค้นหาโจทย์…"
        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm mb-2"
      />
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setTagFilter(null)}
            className={`text-xs px-2.5 py-1 rounded-full border ${
              tagFilter === null
                ? "bg-orange-600 text-white border-orange-600"
                : "bg-white text-slate-600 border-slate-200"
            }`}
          >
            ทั้งหมด
          </button>
          {allTags.map((t) => (
            <button
              key={t}
              onClick={() => setTagFilter(t)}
              className={`text-xs px-2.5 py-1 rounded-full border ${
                tagFilter === t
                  ? "bg-orange-600 text-white border-orange-600"
                  : "bg-white text-slate-600 border-slate-200 hover:border-orange-300"
              }`}
            >
              🏷️ {t}
            </button>
          ))}
        </div>
      )}

      {editing && (
        <Editor
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}

      <div className="space-y-2">
        {shown.length === 0 && (
          <p className="text-sm text-slate-400 py-6 text-center">ไม่พบโจทย์ตามที่กรอง</p>
        )}
        {shown.map((p) => (
          <div key={p.id} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-2 mb-1">
                  <StarRating stars={p.stars} size="text-xs" />
                  <span className="text-xs text-slate-400">{p.topic}</span>
                  <span className="text-xs bg-slate-100 rounded px-1.5 py-0.5 text-slate-500">
                    {p.type === "choice" ? "ช้อย" : "เติมตัวเลข"}
                  </span>
                  {p.time_limit_sec ? (
                    <span className="text-xs text-orange-500">⏱️ {p.time_limit_sec}วิ</span>
                  ) : null}
                  {!p.published && <span className="text-xs text-rose-400">(ซ่อน)</span>}
                  {splitTags(p.tags).map((t) => (
                    <button
                      key={t}
                      onClick={() => setTagFilter(t)}
                      className="text-xs text-orange-600 bg-orange-50 rounded-full px-2 py-0.5 hover:bg-orange-100"
                    >
                      🏷️ {t}
                    </button>
                  ))}
                </div>
                <div className="text-slate-700">
                  <MathText text={p.question} />
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => setEditing({ ...p })} className="text-sm text-indigo-600">
                  แก้ไข
                </button>
                {p.id && (
                  <button onClick={() => del(p.id!)} className="text-sm text-rose-500">
                    ลบ
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Editor({
  initial,
  onClose,
  onSaved,
}: {
  initial: EditableProblem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState<EditableProblem>(initial);
  const [correctIdx, setCorrectIdx] = useState(
    initial.type === "choice" ? Number(initial.answer) || 0 : 0
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof EditableProblem>(k: K, v: EditableProblem[K]) =>
    setF((s) => ({ ...s, [k]: v }));
  const input = "border border-slate-200 rounded-xl px-3 py-2 text-sm w-full";

  async function save() {
    setError("");
    const payload = {
      ...f,
      answer: f.type === "choice" ? String(correctIdx) : f.answer,
      choices: f.type === "choice" ? f.choices.filter((c) => c.trim() !== "") : [],
    };
    if (!payload.question.trim() || (f.type === "numeric" && !payload.answer.trim())) {
      setError("ต้องมีโจทย์และคำตอบ");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/problems", {
        method: f.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        setError((await res.json()).error || "บันทึกไม่สำเร็จ");
        return;
      }
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-orange-200 p-4 mb-4 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-bold">{f.id ? "แก้ไขโจทย์" : "เพิ่มโจทย์ใหม่"}</h3>
        <button onClick={onClose} className="text-slate-400 text-sm">
          ปิด ✕
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <input className={input} placeholder="หัวข้อ เช่น การบวก" value={f.topic} onChange={(e) => set("topic", e.target.value)} />
        <select className={input} value={f.stars} onChange={(e) => set("stars", Number(e.target.value))}>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)} ({n} ดาว)
            </option>
          ))}
        </select>
        <select className={input} value={f.type} onChange={(e) => set("type", e.target.value as "choice" | "numeric")}>
          <option value="numeric">เติมคำตอบตัวเลข</option>
          <option value="choice">ช้อยส์</option>
        </select>
        <input
          className={input}
          type="number"
          placeholder="เวลา (วิ) เว้น=ไม่จับ"
          value={f.time_limit_sec ?? ""}
          onChange={(e) => set("time_limit_sec", e.target.value === "" ? null : Number(e.target.value))}
        />
      </div>

      <div>
        <input
          className={input}
          placeholder="แท็ก/ชุด คั่นด้วยจุลภาค เช่น การคูณจำนวนนับ ชุดที่ 1, ป.5"
          value={f.tags}
          onChange={(e) => set("tags", e.target.value)}
        />
        {splitTags(f.tags).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {splitTags(f.tags).map((t) => (
              <span key={t} className="text-xs text-orange-600 bg-orange-50 rounded-full px-2 py-0.5">
                🏷️ {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <textarea
        className={`${input} min-h-[70px] font-mono`}
        placeholder="โจทย์ — ใส่สมการในเครื่องหมาย $...$ เช่น  หาผลลัพธ์ $12 + 7 = ?$"
        value={f.question}
        onChange={(e) => set("question", e.target.value)}
      />
      <div className="bg-slate-50 rounded-xl p-3 text-sm">
        <span className="text-xs text-slate-400">ตัวอย่าง: </span>
        <MathText text={f.question || "(ยังว่าง)"} />
      </div>

      {f.type === "choice" ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-500">ตัวเลือก (เลือกวงกลมข้อที่ถูก):</p>
          {f.choices.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="radio"
                name="correct"
                checked={correctIdx === i}
                onChange={() => setCorrectIdx(i)}
              />
              <input
                className={input}
                placeholder={`ตัวเลือก ${String.fromCharCode(65 + i)} (ใส่ $...$ ได้)`}
                value={c}
                onChange={(e) => {
                  const n = [...f.choices];
                  n[i] = e.target.value;
                  set("choices", n);
                }}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() => set("choices", [...f.choices, ""])}
            className="text-xs text-orange-600"
          >
            + เพิ่มตัวเลือก
          </button>
        </div>
      ) : (
        <input className={input} placeholder="คำตอบ (ตัวเลข) เช่น 19" value={f.answer} onChange={(e) => set("answer", e.target.value)} />
      )}

      <textarea
        className={`${input} min-h-[50px]`}
        placeholder="คำอธิบายเฉลย (ใส่ $...$ ได้)"
        value={f.explanation}
        onChange={(e) => set("explanation", e.target.value)}
      />

      {error && <p className="text-sm text-rose-600">⚠️ {error}</p>}
      <button onClick={save} disabled={saving} className="w-full bg-orange-600 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-xl">
        {saving ? "กำลังบันทึก…" : "บันทึกโจทย์"}
      </button>
    </div>
  );
}
