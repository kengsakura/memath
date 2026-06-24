import katex from "katex";

// แสดงข้อความที่อาจมีสมการ LaTeX คั่นด้วย $...$ (inline) หรือ $$...$$ (display)
// ใช้ได้ทั้งใน server และ client component (เป็นฟังก์ชันล้วน ไม่มี hook)
export default function MathText({
  text,
  className = "",
}: {
  text: string;
  className?: string;
}) {
  const parts = renderParts(text);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        p.math ? (
          <span
            key={i}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(p.value, {
                throwOnError: false,
                displayMode: p.display,
              }),
            }}
          />
        ) : (
          <span key={i} style={{ whiteSpace: "pre-wrap" }}>
            {p.value}
          </span>
        )
      )}
    </span>
  );
}

type Part = { math: boolean; display: boolean; value: string };

function renderParts(text: string): Part[] {
  const parts: Part[] = [];
  const re = /\$\$([\s\S]+?)\$\$|\$([\s\S]+?)\$/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push({ math: false, display: false, value: text.slice(last, m.index) });
    if (m[1] !== undefined) parts.push({ math: true, display: true, value: m[1] });
    else parts.push({ math: true, display: false, value: m[2] });
    last = re.lastIndex;
  }
  if (last < text.length) parts.push({ math: false, display: false, value: text.slice(last) });
  return parts;
}
