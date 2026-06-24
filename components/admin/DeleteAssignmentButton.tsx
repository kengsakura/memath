"use client";

import { useRouter } from "next/navigation";

export default function DeleteAssignmentButton({ id }: { id: number }) {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        if (!confirm("ลบภารกิจนี้และผลของนักเรียนทั้งหมด?")) return;
        await fetch("/api/admin/assignments", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        router.refresh();
      }}
      className="text-xs text-rose-500"
    >
      ลบ
    </button>
  );
}
