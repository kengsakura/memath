"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.push("/login");
        router.refresh();
      }}
      className="text-sm text-slate-500 hover:text-rose-600 px-2 py-1"
    >
      ออกจากระบบ
    </button>
  );
}
