'use strict';
/**
 * «بيتك عندنا» — روابط المنصة على السوشيال والتواصل.
 * تُخزَّن في data/site-links.json وتُعدَّل من صفحة الإدارة فقط.
 * أي رابط فارغ = المنصة مختفية من الموقع.
 * مفيش روابط وهمية: الظاهر للزوار هو الحقيقي بس (واتساب الرقم الفعلي).
 */

const PLATFORMS = [
  { id: 'whatsapp', name: 'واتساب' },
  { id: 'gmail', name: 'جيميل' },
  { id: 'facebook', name: 'فيسبوك' },
  { id: 'instagram', name: 'انستجرام' },
  { id: 'tiktok', name: 'تيك توك' },
  { id: 'youtube', name: 'يوتيوب' },
  { id: 'telegram', name: 'تيليجرام' },
  { id: 'x', name: 'X (تويتر)' },
];

// الظاهر افتراضيًا: واتساب الحقيقي فقط. الباقي فاضي لحد ما الإدارة تحط الرابط الحقيقي.
const DEFAULT_LINKS = {
  whatsapp: 'https://wa.me/201552099055',
  gmail: '',
  facebook: '',
  instagram: '',
  tiktok: '',
  youtube: '',
  telegram: '',
  x: '',
};

function defaultLinks() {
  return Object.assign({}, DEFAULT_LINKS);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toAsciiDigits(s) {
  return String(s)
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}

function normalizeWhatsApp(raw) {
  let s = toAsciiDigits(raw).replace(/[\s\-()]/g, '');
  if (/^https?:\/\/(wa\.me|api\.whatsapp\.com|whatsapp\.com)\//i.test(s)) {
    try { return new URL(s).href; } catch (e) { return null; }
  }
  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('00')) s = s.slice(2);
  if (s.startsWith('0') && s.length === 11) s = '20' + s.slice(1);
  s = s.replace(/\D/g, '');
  if (!/^20(10|11|12|15)\d{8}$/.test(s) && !/^\d{8,15}$/.test(s)) return null;
  return 'https://wa.me/' + s;
}

function normalizeGmail(raw) {
  let s = String(raw).trim();
  if (/^mailto:/i.test(s)) s = s.slice(7);
  s = s.replace(/^https?:\/\/(mail\.google\.com\/mail\/.*[?&]to=)/i, '');
  if (!EMAIL_RE.test(s)) return null;
  return 'mailto:' + s;
}

/**
 * تطبيع رابط إدخاله الإدارة.
 * يرجع: '' (فارغ = مختفي) | الرابط السليم | null (غير صالح)
 */
function normalizeLink(value, platformId) {
  let s = String(value == null ? '' : value).replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim();
  if (!s) return '';
  if (s.length > 300) return null;

  if (platformId === 'gmail' || EMAIL_RE.test(s) || /^mailto:/i.test(s)) {
    return normalizeGmail(s);
  }
  if (platformId === 'whatsapp' || /wa\.me|whatsapp/i.test(s) || /^(\+|00)?(20)?0?1[0125]\d{8}$/.test(toAsciiDigits(s).replace(/[\s\-()]/g, ''))) {
    const wa = normalizeWhatsApp(s);
    if (wa) return wa;
    if (platformId === 'whatsapp') return null;
  }

  if (!/^https?:\/\//i.test(s) && !/^mailto:/i.test(s)) s = 'https://' + s;
  try {
    const u = new URL(s);
    if (u.protocol === 'mailto:') {
      return EMAIL_RE.test(u.pathname) ? u.href : null;
    }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    if (!u.hostname || u.hostname.length > 253) return null;
    return u.href;
  } catch (e) {
    return null;
  }
}

function buildLinks(input, existing, errors) {
  const src = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const prev = existing && typeof existing === 'object' ? existing : {};
  const out = {};
  for (const p of PLATFORMS) {
    if (!Object.prototype.hasOwnProperty.call(src, p.id)) {
      out[p.id] = prev[p.id] || '';
      continue;
    }
    const v = normalizeLink(src[p.id], p.id);
    if (v === null) {
      (errors || []).push(p.name + ': القيمة غير صالحة. للجيميـل اكتب إيميل، وللواتساب رقم أو رابط wa.me، ولباقي المنصات رابط https://.');
      out[p.id] = '';
    } else {
      out[p.id] = v;
    }
  }
  return errors && errors.length ? null : out;
}

module.exports = { PLATFORMS, DEFAULT_LINKS, defaultLinks, normalizeLink, buildLinks };
