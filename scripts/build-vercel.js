'use strict';
/**
 * تجهيز البناء على Vercel: ينسخ محتوى public/ إلى output/
 * عشان CDN بتاع Vercel يقدّم الملفات الثابتة (HTML/CSS/JS/صور) مباشرة
 * بدل ما تمر من الـ Serverless Function — ده بيصلح مشكلة 500 على الصور
 * وبيسرّع الموقع (CDN مجاني + مفيش تكلفة function لكل صورة).
 *
 * الـ function بتفضل مسؤولة بس عن /api/* و /media/* (المرفوعات).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'public');
const DEST = path.join(ROOT, 'output');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isFile()) fs.copyFileSync(s, d);
  }
}

if (!fs.existsSync(SRC)) {
  console.error('public/ مش موجودة — ما يقدرش يعمل build.');
  process.exit(1);
}
fs.rmSync(DEST, { recursive: true, force: true });
copyDir(SRC, DEST);
console.log('Vercel build: اتنسخ public/ → output/ (الملفات الثابتة هتتقدم من CDN).');
