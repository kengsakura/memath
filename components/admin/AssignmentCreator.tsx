"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import MathText from "@/components/MathText";
import StarRating from "@/components/StarRating";

type PickProblem = { id: number; topic: string; stars: number; question: string };

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function AssignmentCreator({
  problems,
  topics,
  tags,
}: {
  problems: PickProblem[];
  topics: string[];
  tags: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"random" | "manual">("random");
  const [form, setForm] = useState({
    title: "",
    assign_date: today(),
    grade: "",
    room: "",
    academic_year: "",
    term: "",
    subject_code: "",
    time_limit_sec: "" as string,
    count: 5,
    stars: "" as string,
    topic: "" as string,
    tag: "" as string,
  });
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));
  const input = "border border-slate-200 rounded-xl px-3 py-2 text-sm w-full";

  function togglePick(id: number) {
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function save() {
    setError("");
    const body: Record<string, unknown> = {
      title: form.title,
      assign_date: form.assign_date,
      grade: form.grade,
      room: form.room,
      academic_year: form.academic_year,
      term: form.term,
      subject_code: form.subject_code,
      time_limit_sec: form.time_limit_sec === "" ? null : Number(form.time_limit_sec),
    };
    if (mode === "manual") {
      body.problemIds = [...picked];
    } else {
      body.count = form.count;
      if (form.stars) body.stars = Number(form.stars);
      if (form.topic) body.topic = form.topic;
      if (form.tag) body.tag = form.tag;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "สร้างไม่สำเร็จ");
        return;
      }
      setOpen(false);
      setPicked(new Set());
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-xl text-sm"
      >
        + สร้างภารกิจ
      </button>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-orange-200 p-4 mb-4 space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-bold">สร้างภารกิจรายวัน</h3>
        <button onClick={() => setOpen(false)} className="text-slate-400 text-sm">
          ปิด ✕
        </button>
      </div>

      <input className={input} placeholder="ชื่อภารกิจ เช่น ฝึกบวกเลข" value={form.title} onChange={(e) => set("title", e.target.value)} />

      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-slate-500">
          วันที่ทำภารกิจ
          <input type="date" className={input} value={form.assign_date} onChange={(e) => set("assign_date", e.target.value)} />
        </label>
        <label className="text-xs text-slate-500">
          เวลาต่อข้อ (วิ) เว้น=ไม่จับ
          <input type="number" className={input} value={form.time_limit_sec} onChange={(e) => set("time_limit_sec", e.target.value)} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <input className={input} placeholder="ชั้น เช่น ป.5 (เว้น=ทุกชั้น)" value={form.grade} onChange={(e) => set("grade", e.target.value)} />
        <input className={input} placeholder="ห้อง เช่น 2 (เว้น=ทุกห้อง)" value={form.room} onChange={(e) => set("room", e.target.value)} />
        <input className={input} placeholder="ปีการศึกษา" value={form.academic_year} onChange={(e) => set("academic_year", e.target.value)} />
        <input className={input} placeholder="เทอม" value={form.term} onChange={(e) => set("term", e.target.value)} />
      </div>

      {/* โหมดเลือกโจทย์ */}
      <div className="flex rounded-xl bg-slate-100 p-1">
        {([["random", "🎲 สุ่มจากคลัง"], ["manual", "✋ เลือกเอง"]] as const).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setMode(k)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium ${
              mode === k ? "bg-white shadow text-orange-700" : "text-slate-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "random" ? (
        <div className="space-y-3">
        {tags.length > 0 && (
          <label className="text-xs text-slate-500 block">
            ชุด/แท็ก
            <select className={input} value={form.tag} onChange={(e) => set("tag", e.target.value)}>
              <option value="">ทุกชุด</option>
              {tags.map((t) => (
                <option key={t} value={t}>
                  🏷️ {t}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-3 gap-3">
          <label className="text-xs text-slate-500">
            จำนวนข้อ
            <input type="number" className={input} value={form.count} onChange={(e) => set("count", Number(e.target.value))} />
          </label>
          <label className="text-xs text-slate-500">
            ระดับดาว
            <select className={input} value={form.stars} onChange={(e) => set("stars", e.target.value)}>
              <option value="">ทุกระดับ</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} ดาว
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-500">
            หัวข้อ
            <select className={input} value={form.topic} onChange={(e) => set("topic", e.target.value)}>
              <option value="">ทุกหัวข้อ</option>
              {topics.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
        </div>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
          {problems.map((p) => (
            <label key={p.id} className="flex items-center gap-2 p-2 text-sm cursor-pointer hover:bg-slate-50">
              <input type="checkbox" checked={picked.has(p.id)} onChange={() => togglePick(p.id)} />
              <StarRating stars={p.stars} size="text-xs" />
              <span className="truncate flex-1">
                <MathText text={p.question} />
              </span>
            </label>
          ))}
          <p className="p-2 text-xs text-slate-400">เลือกแล้ว {picked.size} ข้อ</p>
        </div>
      )}

      {error && <p className="text-sm text-rose-600">⚠️ {error}</p>}
      <button onClick={save} disabled={saving} className="w-full bg-orange-600 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-xl">
        {saving ? "กำลังสร้าง…" : "สร้างภารกิจ"}
      </button>
    </div>
  );
}
