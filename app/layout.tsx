import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
});

export const metadata: Metadata = {
  title: "MeMath — ฝึกคณิตศาสตร์",
  description: "เว็บฝึกโจทย์คณิตศาสตร์ ภารกิจรายวัน เก็บแต้ม สะสมไฟต่อเนื่อง",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className={`${notoThai.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-800">
        {children}
      </body>
    </html>
  );
}
