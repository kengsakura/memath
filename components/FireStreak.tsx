// กราฟ "ไฟต่อเนื่อง" — แต่ละวันที่ทำภารกิจไล่สีตามอุณหภูมิไฟ
// ยิ่งทำต่อเนื่องหลายวัน (runLength มาก) สียิ่งร้อน; เว้นวันแล้วเริ่มนับใหม่ = สีเย็นใหม่
// เป็นฟังก์ชันล้วน ใช้ได้ทั้ง server/client

// ไล่ระดับสีไฟตามความยาว streak (0 = ไม่ได้ทำ)
export function fireColor(run: number): string {
  if (run <= 0) return "#e2e8f0"; // slate-200 (เย็น/ว่าง)
  const ramp = [
    "#7f1d1d", // 1  ถ่านแดงเข้ม
    "#b91c1c", // 2
    "#dc2626", // 3  แดง
    "#ea580c", // 4  แดงส้ม
    "#f97316", // 5  ส้ม
    "#fb923c", // 6
    "#f59e0b", // 7  ส้มเหลือง
    "#fbbf24", // 8
    "#fcd34d", // 9  เหลือง
    "#fde68a", // 10+ เหลืองสว่าง (ร้อนจัด)
  ];
  return ramp[Math.min(run, 10) - 1];
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function FireStreak({
  runLength,
  current,
  longest,
  days = 28,
  endDate = ymd(new Date()),
}: {
  runLength: Record<string, number>;
  current: number;
  longest: number;
  days?: number;
  endDate?: string;
}) {
  const cells: { date: string; run: number }[] = [];
  const end = Date.parse(endDate + "T00:00:00Z");
  for (let i = days - 1; i >= 0; i--) {
    const date = ymd(new Date(end - i * 86400000));
    cells.push({ date, run: runLength[date] || 0 });
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={`text-2xl ${current > 0 ? "animate-flicker" : "opacity-40"}`}>🔥</span>
          <div>
            <div className="text-sm text-slate-500 leading-none">ทำต่อเนื่อง</div>
            <div className="text-xl font-bold text-orange-600 leading-tight">{current} วัน</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-slate-500 leading-none">สถิติสูงสุด</div>
          <div className="text-xl font-bold text-slate-700 leading-tight">{longest} วัน</div>
        </div>
      </div>

      <div className="grid grid-cols-14 gap-1 sm:gap-1.5" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
        {cells.map((c) => (
          <div
            key={c.date}
            title={`${c.date} • ต่อเนื่อง ${c.run} วัน`}
            className="aspect-square rounded-[5px]"
            style={{
              backgroundColor: fireColor(c.run),
              boxShadow: c.run >= 7 ? `0 0 6px ${fireColor(c.run)}` : undefined,
            }}
          />
        ))}
      </div>
      <p className="text-[11px] text-slate-400 mt-2">
        เว้นวันเมื่อไหร่ ไฟจะดับแล้วเริ่มก่อใหม่จากสีแดงเข้ม — ทำทุกวันเพื่อให้ไฟร้อนถึงสีเหลือง ✨
      </p>
    </div>
  );
}
