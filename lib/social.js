'use strict';
/**
 * «بيتك عندنا» — تعريف روابط المنصة على السوشيال ميديا.
 * الروابط تُخزَّن في data/site-links.json (خارج public) وتُعدَّل من صفحة الإدارة السرية فقط.
 * أي رابط فارغ = المنصة دي مختفية من الموقع.
 */

const PLATFORMS = [
  { id: 'facebook', name: 'فيسبوك' },
  { id: 'instagram', name: 'انستجرام' },
  { id: 'tiktok', name: 'تيك توك' },
  { id: 'x', name: 'X (تويتر)' },
  { id: 'youtube', name: 'يوتيوب' },
  { id: 'telegram', name: 'تيليجرام' },
];

// روابط افتراضية (أمثلة) — يُفترض تغييرها للروابط الحقيقية من صفحة الإدارة
const DEFAULT_LINKS = {
  facebook: 'https://www.facebook.com/baytak.3andna',
  instagram: 'https://www.instagram.com/baytak.3andna',
  tiktok: 'https://www.tiktok.com/@baytak.3andna',
  x: 'https://x.com/baytak_3andna',
  youtube: 'https://www.youtube.com/@baytak.3andna',
  telegram: 'https://t.me/baytak_3andna',
};

function defaultLinks() {
  return Object.assign({}, DEFAULT_LINKS);
}

/**
 * تطبيع رابط إدخاله الإدارة:
 * - يزيل الوسوم/المسافات الزائدة
 * - لو مفيش بروتوكول، يعتبر https:// تلقائيًا
 * - يسمح بـ http/https فقط وبطول أقصى 300
 * يرجع: '' (فارغ = مختفي) | الرابط السليم | null (رابط غير صالح)
 */
function normalizeLink(value) {
  let s = String(value == null ? '' : value).replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim();
  if (!s) return '';
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  if (s.length > 300) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname || u.hostname.length > 253) return null;
    return u.href;
  } catch (e) {
    return null;
  }
}

/**
 * يبني كائن روابط كامل من مدخلات الإدارة.
 * - مفتاح غير موجود في الإدخال → يبقى على قيمته الحالية (existing) — التحديث جزئي آمن.
 * - مفتاح فارغ صراحةً ('') → المنصة تختفي.
 * errors: قائمة رسائل (عربية) لكل منصة غير صالحة.
 * يرجع null لو فيه أخطاء، وإلا كائن { id: url } جاهز للحفظ.
 */
function buildLinks(input, existing, errors) {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const prev = existing && typeof existing === 'object' ? existing : {};
  const out = {};
  for (const p of PLATFORMS) {
    if (!Object.prototype.hasOwnProperty.call(src, p.id)) {
      out[p.id] = prev[p.id] || '';
      continue;
    }
    const v = normalizeLink(src[p.id]);
    if (v === null) {
      (errors || []).push(p.name + ': الرابط غير صالح (اكتب رابطًا يبدأ بـ https://).');
      out[p.id] = '';
    } else {
      out[p.id] = v;
    }
  }
  return errors && errors.length ? null : out;
}

module.exports = { PLATFORMS, DEFAULT_LINKS, defaultLinks, normalizeLink, buildLinks };
