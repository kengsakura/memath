"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const PREFIXES = ["เด็กชาย", "เด็กหญิง", "นาย", "นางสาว"];

const empty = {
  prefix: "เด็กชาย",
  first_name: "",
  last_name: "",
  student_number: "",
  academic_year: "",
  term: "",
  grade: "",
  room: "",
  subject_code: "",
  password: "",
};

export default function AddStudentForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...empty });
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "เพิ่มไม่สำเร็จ");
        return;
      }
      setMsg(`เพิ่มแล้ว! ผู้ใช้: ${data.username} • รหัสผ่าน: ${data.password}`);
      setForm({ ...empty });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-orange-600 hover:bg-orange-700 text-white font-semibold px-4 py-2 rounded-xl text-sm"
      >
        + เพิ่มนักเรียน
      </button>
    );
  }

  const input = "border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-orange-400 w-full";

  return (
    <div className="bg-white rounded-2xl border border-orange-200 p-4 mb-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold">เพิ่มนักเรียนใหม่</h3>
        <button onClick={() => setOpen(false)} className="text-slate-400 text-sm">
          ปิด ✕
        </button>
      </div>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <select value={form.prefix} onChange={(e) => set("prefix", e.target.value)} className={input}>
          {PREFIXES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <input className={input} placeholder="เลขประจำตัว *" value={form.student_number} onChange={(e) => set("student_number", e.target.value)} required />
        <input className={input} placeholder="ชื่อ *" value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
        <input className={input} placeholder="นามสกุล" value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
        <input className={input} placeholder="ชั้น เช่น ป.5" value={form.grade} onChange={(e) => set("grade", e.target.value)} />
        <input className={input} placeholder="ห้อง เช่น 2" value={form.room} onChange={(e) => set("room", e.target.value)} />
        <input className={input} placeholder="ปีการศึกษา เช่น 2569" value={form.academic_year} onChange={(e) => set("academic_year", e.target.value)} />
        <input className={input} placeholder="เทอม เช่น 1" value={form.term} onChange={(e) => set("term", e.target.value)} />
        <input className={input} placeholder="รหัสวิชา เช่น ค21101" value={form.subject_code} onChange={(e) => set("subject_code", e.target.value)} />
        <input className={input} placeholder="รหัสผ่าน (ว่าง=เลขประจำตัว)" value={form.password} onChange={(e) => set("password", e.target.value)} />
        <div className="col-span-2">
          {error && <p className="text-sm text-rose-600 mb-2">⚠️ {error}</p>}
          {msg && <p className="text-sm text-emerald-600 mb-2">✅ {msg}</p>}
          <button disabled={loading} className="w-full bg-orange-600 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-xl">
            {loading ? "กำลังบันทึก…" : "บันทึกนักเรียน"}
          </button>
        </div>
      </form>
    </div>
  );
}
