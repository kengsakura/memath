"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function StudentAdminActions({ userId }: { userId: number }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");

  async function resetPw() {
    if (!pw.trim()) return;
    const res = await fetch("/api/admin/students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, password: pw.trim() }),
    });
    setMsg(res.ok ? "เปลี่ยนรหัสผ่านแล้ว ✅" : "ไม่สำเร็จ");
    setPw("");
  }

  async function remove() {
    if (!confirm("ลบนักเรียนคนนี้และข้อมูลทั้งหมด?")) return;
    const res = await fetch("/api/admin/students", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      router.push("/admin/students");
      router.refresh();
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
      <h3 className="font-bold text-sm text-slate-600">⚙️ จัดการบัญชี</h3>
      <div className="flex gap-2">
        <input
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="รหัสผ่านใหม่"
          className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm"
        />
        <button onClick={resetPw} className="bg-slate-700 text-white px-3 py-2 rounded-xl text-sm">
          รีเซ็ตรหัส
        </button>
      </div>
      {msg && <p className="text-xs text-emerald-600">{msg}</p>}
      <button onClick={remove} className="text-sm text-rose-600 hover:underline">
        ลบนักเรียนคนนี้
      </button>
    </div>
  );
}
