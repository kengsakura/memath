# MeMath — เว็บแอปโจทย์คณิตศาสตร์ (ครู/นักเรียน)

แอปนี้ใช้ **Next.js 16 (App Router)**. เวอร์ชันนี้มี breaking changes จากที่เคยรู้ —
อ่านคู่มือใน `node_modules/next/dist/docs/01-app` ก่อนเขียนโค้ดที่เกี่ยวกับ routing, server components หรือ route handlers

## สถาปัตยกรรม
- **Auth**: JWT cookie (`jose`) — ดู `lib/auth.ts`. มี 2 บทบาท: `teacher` (แอดมิน) และ `student`
- **DB**: data layer เลือก backend อัตโนมัติ (`lib/db.ts`)
  - มี `POSTGRES_URL` (Supabase) → ใช้ Postgres
  - ไม่มี → ใช้ SQLite ไฟล์ในเครื่อง (dev)
  - เขียน SQL ด้วย placeholder `?` เสมอ แล้วถูกแปลงเป็น `$1..$n` ให้เองเมื่อใช้ Postgres
- **โจทย์/สมการ**: เก็บเป็นข้อความ LaTeX ในฐานข้อมูล แสดงผลด้วย **KaTeX** (`components/MathText.tsx`)
- เนื้อหาโจทย์ตั้งต้น seed จาก `lib/seed-problems.json` ผ่าน `syncContent()` (รันเมื่อ `SEED_VERSION` เปลี่ยน) — ไม่ลบ progress เดิม
