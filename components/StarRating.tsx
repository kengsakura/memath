// แสดงระดับความยากเป็นดาว 1–5
export default function StarRating({ stars, size = "text-sm" }: { stars: number; size?: string }) {
  const n = Math.max(1, Math.min(5, stars));
  return (
    <span className={`${size} tracking-tight`} title={`ระดับ ${n} ดาว`}>
      <span className="text-amber-400">{"★".repeat(n)}</span>
      <span className="text-slate-300">{"★".repeat(5 - n)}</span>
    </span>
  );
}
