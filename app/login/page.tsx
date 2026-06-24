"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "เกิดข้อผิดพลาด");
        return;
      }
      router.push(data.role === "teacher" ? "/admin" : "/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-gradient-to-br from-orange-50 via-white to-amber-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-5xl mb-2">🔥</div>
          <h1 className="text-2xl font-bold text-orange-700">MeMath</h1>
          <p className="text-slate-500 text-sm">ฝึกคณิตศาสตร์ ทำภารกิจรายวัน สะสมไฟต่อเนื่อง</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 p-5">
          <form onSubmit={submit} className="space-y-3">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="เลขประจำตัว / ชื่อผู้ใช้"
              autoCapitalize="none"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-orange-400"
              required
            />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="รหัสผ่าน"
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-orange-400"
              required
            />
            {error && <p className="text-sm text-rose-600">⚠️ {error}</p>}
            <button
              disabled={loading}
              className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 text-white font-semibold py-2.5 rounded-xl"
            >
              {loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
            </button>
          </form>
          <p className="text-xs text-slate-400 text-center mt-4">
            นักเรียนสมัครเองไม่ได้ — ติดต่อคุณครูเพื่อรับบัญชี
          </p>
        </div>
      </div>
    </div>
  );
}
