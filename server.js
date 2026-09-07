'use strict';
/**
 * «بيتك عندنا» — خادم Node.js + Express
 *
 * الوظائف الحقيقية: نشر الشقق، حفظ الطلبات، الإدارة المخفية المحمية، الرفع والوسائط.
 * البيانات تُحفظ في ملفات JSON خارج public (بكتابة ذرية)، والوسائط في مجلد uploads.
 * كلمة المرور الإدارية مخزَّنة كتجزئة scrypt داخل config.json (مستثنى من git).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const session = require('express-session');
const multer = require('multer');
const { verifyPassword, hashPassword } = require('./lib/passwords');
const { seedIfEmpty } = require('./scripts/seed');

// ------------------------------------------------------------------ paths / config
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const DATA_DIR = path.join(ROOT, 'data');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const POSTS_FILE = path.join(DATA_DIR, 'posts.json');
const REQUESTS_FILE = path.join(DATA_DIR, 'requests.json');
const CONFIG_FILE = path.join(ROOT, 'config.json');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// حدود الإعدادات (قابلة للضبط عبر متغيرات البيئة إن أردت)
const MAX_REQUESTS = Number(process.env.MAX_REQUESTS || 2000); // حد الطلبات المحفوظة في النسخة الصغيرة
const MAX_LOGIN_FAILS = 5;      // عدد محاولات كلمة المرور الخاطئة قبل الحظر
const LOGIN_BLOCK_MS = 10 * 60 * 1000; // مدة الحظر (10 دقائق)
const REQUEST_WINDOW_MS = 15 * 60 * 1000; // نافذة طلبات الشقق (15 دقيقة)
const REQUEST_RATE_LIMIT = 5;  // عدد طلبات الشقق لكل عنوان خلال النافذة

// حدود الوسائط
const MAX_IMAGES = 8;
const MAX_VIDEOS = 1;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;      // 5MB
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;     // 20MB
const MAX_POST_MEDIA_BYTES = 40 * 1024 * 1024; // 40MB إجمالي

// رقم التواصل (الوحيد الظاهر)
const CONTACT_NUMBER = '01552099055';
const TEL_LINK = 'tel:+201552099055';
const WHATSAPP_LINK = 'https://wa.me/201552099055';

// ------------------------------------------------------------------ config loading
function loadConfig() {
  let cfg = {};
  if (fs.existsSync(CONFIG_FILE)) {
    try { cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
    catch (e) { cfg = {}; }
  }
  if (!cfg.adminPasswordHash) {
    // أول تشغيل: توليد كلمة مرور عشوائية وكتابتها في config.json مع رسالة تنبيه قوية
    const generated = crypto.randomBytes(9).toString('base64url');
    cfg.adminPasswordHash = hashPassword(generated);
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), { encoding: 'utf8', mode: 0o600 });
    } catch (e) { /* تجاهل */ }
    console.error('\n==============================================================');
    console.error('  لم تُضبط كلمة مرور إدارية من قبل، لذلك وُلِّدت كلمة عشوائية:');
    console.error('      ' + generated);
    console.error('  غيّرها فورًا عبر:  node scripts/set-password.js');
    console.error('  ملاحظة: لم تُطبع في أي ملف عام، والكلمة الظاهرة أعلاه في السجل فقط.');
    console.error('==============================================================\n');
  }
  cfg.sessionSecret = cfg.sessionSecret || crypto.randomBytes(32).toString('hex');
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), { encoding: 'utf8', mode: 0o600 });
  } catch (e) { /* تجاهل */ }
  return cfg;
}
let config = loadConfig();

// ------------------------------------------------------------------ JSON data store (atomic)
let posts = [];
let requests = [];
let writeQueue = Promise.resolve();

function ensureFiles() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(POSTS_FILE)) fs.writeFileSync(POSTS_FILE, '[]', 'utf8');
  if (!fs.existsSync(REQUESTS_FILE)) fs.writeFileSync(REQUESTS_FILE, '[]', 'utf8');
}
function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { return fallback; } // عند خطأ لا نستبدل بملف فارغ فقد نفقد بيانات المستخدم
}
function atomicWrite(file, data) {
  const tmp = file + '.tmp-' + crypto.randomBytes(4).toString('hex');
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}
function enqueueSave(file, data) {
  writeQueue = writeQueue.then(() => atomicWrite(file, data));
  return writeQueue;
}
function loadData() {
  ensureFiles();
  posts = readJSON(POSTS_FILE, []);
  requests = readJSON(REQUESTS_FILE, []);
  if (!Array.isArray(posts)) posts = [];
  if (!Array.isArray(requests)) requests = [];
  if (posts.length === 0) {
    posts = seedIfEmpty({
      posts,
      postsFile: POSTS_FILE,
      uploadsDir: UPLOADS_DIR,
      rootDir: ROOT,
      enqueueSave,
    }) || [];
  }
}

// ------------------------------------------------------------------ sessions / admin state
const sessions = new Map(); // token -> { csrf, createdAt }
const loginFailures = new Map(); // ip -> { count, blockedUntil }
const requestActivity = new Map(); // ip -> { windowStart, count, tokens:Set }

// ------------------------------------------------------------------ utilities
function sanitizeIp(ip) {
  if (!ip) return 'unknown';
  return String(ip).replace('::ffff:', '');
}
function isHttps(req) {
  return !!(req.secure || (req.headers['x-forwarded-proto'] || '').startsWith('https'));
}
function escAttr(v) { return String(v).replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
function newId() { return crypto.randomBytes(8).toString('hex'); }
function newRef() {
  return 'BC' + crypto.randomBytes(4).toString('hex').toUpperCase();
}
// تحويل الأرقام العربية إلى إنجليزية للتحقق
function toAsciiDigits(s) {
  return String(s)
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
}
function validateEgyptianPhone(raw) {
  let s = toAsciiDigits(raw).replace(/[\s\-()]/g, '');
  // دعم +20 أو 0020
  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('0020')) s = '0' + s.slice(4);
  if (s.startsWith('20')) s = '0' + s.slice(2);
  // الآن إما 11 رقماً يبدأ بـ 01
  if (/^01[0125][0-9]{8}$/.test(s)) return true;
  return false;
}
function normalizePhoneForWa(raw) {
  let s = toAsciiDigits(raw).replace(/[\s\-()]/g, '');
  if (s.startsWith('+')) s = s.slice(1);
  if (s.startsWith('0020')) s = s.slice(4);
  if (s.startsWith('20')) s = s.slice(2);
  if (s.startsWith('0')) s = '20' + s.slice(1);
  return s.replace(/[^\d]/g, '');
}
// ---- تصفية النص (نمنع أي وسوم HTML/JS — نعرضه كنص فقط) ----
function cleanText(v, max) {
  let s = String(v == null ? '' : v);
  s = s.replace(/<[^>]*>/g, '');
  // إزالة رموز خطيرة لكن نحافظ على النص
  s = s.replace(/[<>]/g, '').trim();
  if (max && s.length > max) s = s.slice(0, max);
  return s;
}

// ------------------------------------------------------------------ media sniffing
const SIG = {
  jpeg: [0xff, 0xd8, 0xff],
  png: [0x89, 0x50, 0x4e, 0x47],
};
function detectImage(buf) {
  if (!buf || buf.length < 16) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  // WebP: RIFF....WEBP
  if (buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP') return 'webp';
  return null;
}
function detectVideo(buf) {
  if (!buf || buf.length < 20) return null;
  // MP4: ftyp في البايت 4-8
  const box = buf.slice(4, 8).toString('latin1');
  if (box === 'ftyp') {
    const brand = buf.slice(8, 12).toString('latin1').toLowerCase();
    if (brand.includes('mp4') || brand.includes('isom') || brand.includes('avc1') || brand.includes('m4v') || brand.includes('3gp') || brand.includes('dash')) return 'mp4';
  }
  // WebM: EBML 1A 45 DF A3
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'webm';
  return null;
}
function saveMediaBuffer(buf, ext, kind) {
  const name = kind + '-' + crypto.randomBytes(8).toString('hex') + '.' + ext;
  fs.writeFileSync(path.join(UPLOADS_DIR, name), buf);
  return name;
}

// ------------------------------------------------------------------ rate limiters
function checkLoginRate(ip) {
  const rec = loginFailures.get(ip) || { count: 0, blockedUntil: 0 };
  if (rec.blockedUntil > Date.now()) {
    const remainMin = Math.ceil((rec.blockedUntil - Date.now()) / 60000);
    return { ok: false, message: `محاولات كثيرة. انتظر ${remainMin} دقيقة قبل المحاولة مجددًا.` };
  }
  if (rec.count >= MAX_LOGIN_FAILS) {
    rec.blockedUntil = Date.now() + LOGIN_BLOCK_MS;
    rec.count = 0;
    loginFailures.set(ip, rec);
    return { ok: false, message: 'محاولات كثيرة جدًا. تم الحظر 10 دقائق. حاول لاحقًا.' };
  }
  return { ok: true };
}
function recordLoginFail(ip) {
  const rec = loginFailures.get(ip) || { count: 0, blockedUntil: 0 };
  rec.count += 1;
  loginFailures.set(ip, rec);
}
function clearLoginFails(ip) { loginFailures.delete(ip); }

// حد طلبات الشقق لكل عنوان
function requestRateOk(ip) {
  const now = Date.now();
  let rec = requestActivity.get(ip);
  if (!rec || (now - rec.windowStart) > REQUEST_WINDOW_MS) {
    rec = { windowStart: now, count: 0, tokens: new Set() };
    requestActivity.set(ip, rec);
  }
  return rec.count < REQUEST_RATE_LIMIT;
}
function consumeRequestSlot(ip) {
  const now = Date.now();
  let rec = requestActivity.get(ip);
  if (!rec || (now - rec.windowStart) > REQUEST_WINDOW_MS) {
    rec = { windowStart: now, count: 0, tokens: new Set() };
    requestActivity.set(ip, rec);
  }
  rec.count += 1;
  requestActivity.set(ip, rec);
}
function requestWaitMinutes(ip) {
  const rec = requestActivity.get(ip);
  if (!rec) return 0;
  return Math.max(0, Math.ceil((REQUEST_WINDOW_MS - (Date.now() - rec.windowStart)) / 60000));
}
// ---- مفتاح إرسال الطلب (مضاد للتكرار من نفس الصفحة) ----
const issuedTokens = new Map(); // token -> used
const EXPIRED_TOKENS = 60 * 60 * 1000;
function pruneTokens() {
  const now = Date.now();
  for (const [k, t] of issuedTokens) { if (now - t.created > EXPIRED_TOKENS) issuedTokens.delete(k); }
}

// ------------------------------------------------------------------ middleware
function requireAdmin(req, res, next) {
  const sid = req.session && req.session.sid;
  const s = sid && sessions.get(sid);
  if (s && s.admin) { req.adminSession = s; return next(); }
  return res.status(401).json({ ok: false, error: 'غير مصرح — سجّل الدخول أولًا.' });
}
// حماية إدارية إضافية من CSRF: نتحقق من رأس مخصص يحمل توكن الجلسة
function requireCsrf(req, res, next) {
  const s = req.adminSession;
  const header = req.get('X-CSRF-Token');
  if (!s || !s.csrf || header !== s.csrf) {
    return res.status(403).json({ ok: false, error: 'طلب غير مصرح (تأكد من تحديث الصفحة).' });
  }
  next();
}

// ------------------------------------------------------------------ express app
const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));

app.use(session({
  name: 'bsess',
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // يُفعَّل أدناه إذا كان الطلب عبر HTTPS
    maxAge: 12 * 60 * 60 * 1000,
  }
}));

// تحديث خاصية secure في الكوكي حسب البروتوكول
app.use((req, res, next) => {
  if (req.session && req.session.cookie && !req.session.cookie.secure && isHttps(req)) {
    req.session.cookie.secure = true;
  }
  next();
});

// static public
app.use(express.static(PUBLIC_DIR, { index: false }));
// الوسائط المرفوعة (خارج public) تُقدَّم لكن باسم آمن
app.use('/media', (req, res, next) => {
  const name = path.basename(req.path);
  const full = path.join(UPLOADS_DIR, name);
  if (!name || !/^[a-z]+-[0-9a-f]{16}\.(jpg|png|webp|mp4|webm)$/.test(name)) return res.status(404).end();
  if (!fs.existsSync(full)) return res.status(404).end();
  res.set('X-Content-Type-Options', 'nosniff');
  next();
}, express.static(UPLOADS_DIR));

// ------------------------------------------------ سيرفر لتوليد مفتاح إرسال الطلبات (public)
app.get('/api/request-token', (req, res) => {
  pruneTokens();
  const token = crypto.randomBytes(24).toString('hex');
  issuedTokens.set(token, { created: Date.now(), used: false });
  res.json({ ok: true, token });
});

// ------------------------------------------------ المنشورات (public)
const ALLOWED_TYPES = ['إيجار', 'بيع', 'أخرى'];

app.get('/api/posts', (req, res) => {
  const q = cleanText(req.query.q || '', 80).toLowerCase();
  const type = cleanText(req.query.type || '', 20);
  let list = posts.slice();
  if (type && ALLOWED_TYPES.includes(type)) {
    list = list.filter((p) => p.type === type);
  }
  if (q) {
    list = list.filter((p) => {
      const hay = [p.title, p.location, p.description, p.price, p.rooms].join(' ').toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }
  list = list
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .map((p) => ({
      id: p.id, title: p.title, location: p.location, createdAt: p.createdAt,
      type: p.type || '',
      price: p.price || '',
      rooms: p.rooms || '',
      areaM2: p.areaM2 || '',
      imageCount: (p.media && p.media.images ? p.media.images.length : 0),
      videoCount: (p.media && p.media.videos ? p.media.videos.length : 0),
      hasVideo: !!(p.media && p.media.videos && p.media.videos.length),
      coverImage: (p.media && p.media.images && p.media.images[0]) || null,
      preview: String(p.description || '').split('\n').filter((l) => l.trim()).slice(0, 3).join('\n').slice(0, 220)
    }));
  res.json({ ok: true, count: list.length, posts: list });
});

app.get('/api/posts/:id', (req, res) => {
  const post = posts.find((p) => p.id === req.params.id);
  if (!post) return res.status(404).json({ ok: false, error: 'المنشور غير موجود.' });
  res.json({ ok: true, post });
});

// ------------------------------------------------ إرسال طلب شقة (public)
app.post('/api/requests', (req, res) => {
  const ip = sanitizeIp(req.ip);
  pruneTokens();
  if (!requestRateOk(ip)) {
    const m = requestWaitMinutes(ip);
    return res.status(429).json({ ok: false, error: `وصلت للحد الأقصى من الطلبات (${REQUEST_RATE_LIMIT} خلال 15 دقيقة). حاول مجددًا بعد ${m} دقيقة.` });
  }
  const b = req.body || {};
  const token = String(b.token || '');
  const stored = issuedTokens.get(token);
  if (!stored || stored.used) {
    return res.status(400).json({ ok: false, error: 'طلب مكرر أو انتهت صلاحية النموذج. حدّث الصفحة وأعد المحاولة.' });
  }

  const name = cleanText(b.name, 80);
  const area = cleanText(b.area, 150);
  const budget = cleanText(b.budget, 100);
  const description = cleanText(b.description, 3000);
  const phoneRaw = String(b.phone || '').trim();

  const errors = [];
  if (name.length < 2) errors.push('الاسم يجب أن يكون حرفين على الأقل.');
  if (name.length > 80) errors.push('الاسم أطول من 80 حرفًا.');
  if (area.length < 2) errors.push('المنطقة/الحي مطلوب (حرفان على الأقل).');
  if (area.length > 150) errors.push('المنطقة أطول من 150 حرفًا.');
  if (budget.length < 2) errors.push('الميزانية مطلوبة.');
  if (budget.length > 100) errors.push('الميزانية أطول من 100 حرف.');
  if (description.length < 10) errors.push('وصف الشقة/المواصفات مطلوب (10 أحرف على الأقل).');
  if (description.length > 3000) errors.push('الوصف أطول من 3000 حرف.');
  if (!validateEgyptianPhone(phoneRaw)) errors.push('رقم التواصل غير صحيح. أدخل رقم موبايل مصري 11 رقمًا أو رقمًا دوليًا صحيحًا.');

  if (errors.length) {
    return res.status(400).json({ ok: false, error: errors[0], errors });
  }

  // حجز مفتاح الإرسال قبل الحفظ لمنع التكرار حتى لو تعطل الحفظ
  stored.used = true;

  if (requests.length >= MAX_REQUESTS) {
    return res.status(503).json({ ok: false, error: 'عذرًا، وصل عدد الطلبات إلى الحد الأقصى حاليًا. تواصل معنا هاتفيًا أو واتساب.' });
  }

  const now = Date.now();
  const item = {
    id: newId(),
    ref: newRef(),
    name,
    phone: phoneRaw,
    area,
    budget,
    description,
    status: 'جديد',
    createdAt: now,
    updatedAt: now,
  };
  requests.push(item);
  consumeRequestSlot(ip);
  enqueueSave(REQUESTS_FILE, requests).then(() => {
    res.json({ ok: true, ref: item.ref, message: 'تم استلام طلبك بنجاح.' });
  }).catch(() => {
    // استرجاع الفتحة إذا فشل الحفظ فعليًا
    requests = requests.filter((r) => r.id !== item.id);
    consumeRequestSlotFree(ip);
    res.status(500).json({ ok: false, error: 'تعذّر حفظ الطلب على الخادم. حاول مجددًا.' });
  });
});

// ------------------------------------------------ تسجيل دخول الإدارة (مخفي)
app.post('/api/admin/login', (req, res) => {
  const ip = sanitizeIp(req.ip);
  const gate = checkLoginRate(ip);
  if (!gate.ok) return res.status(429).json({ ok: false, error: gate.message });
  const password = String((req.body || {}).password || '');
  if (!config.adminPasswordHash || !verifyPassword(password, config.adminPasswordHash)) {
    recordLoginFail(ip);
    return res.status(401).json({ ok: false, error: 'كلمة المرور غير صحيحة.' });
  }
  clearLoginFails(ip);
  const sid = crypto.randomBytes(24).toString('hex');
  const csrf = crypto.randomBytes(24).toString('hex');
  sessions.set(sid, { admin: true, csrf, createdAt: Date.now() });
  req.session.sid = sid;
  res.json({ ok: true, csrf });
});

// حالة جلسة الإدارة
app.get('/api/admin/session', (req, res) => {
  const sid = req.session && req.session.sid;
  const s = sid && sessions.get(sid);
  if (s && s.admin) return res.json({ ok: true, authenticated: true, csrf: s.csrf });
  res.json({ ok: true, authenticated: false });
});

// تسجيل خروج
app.post('/api/admin/logout', (req, res) => {
  const sid = req.session && req.session.sid;
  if (sid) { sessions.delete(sid); delete req.session.sid; }
  req.session.destroy(() => res.json({ ok: true }));
});

// إحصاءات إدارية حقيقية
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const counts = { 'جديد': 0, 'قيد المراجعة': 0, 'متوفر': 0, 'غير متوفر': 0 };
  requests.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
  res.json({ ok: true, posts: posts.length, requests: requests.length, byStatus: counts });
});

// قائمة الطلبات (إدارة فقط) مع تصفية وتقسيم صفحات من 20
app.get('/api/admin/requests', requireAdmin, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const perPage = 20;
  let list = requests.slice().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const statusFilter = req.query.status;
  if (statusFilter && statusFilter !== 'الكل') {
    list = list.filter((r) => r.status === statusFilter);
  }
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const slice = list.slice((page - 1) * perPage, page * perPage);
  res.json({ ok: true, total, page, perPage, totalPages, requests: slice });
});

// تحديث حالة طلب
app.patch('/api/admin/requests/:id', requireAdmin, requireCsrf, (req, res) => {
  const allowed = ['جديد', 'قيد المراجعة', 'متوفر', 'غير متوفر'];
  const status = String((req.body || {}).status || '');
  if (!allowed.includes(status)) return res.status(400).json({ ok: false, error: 'حالة غير صالحة.' });
  const item = requests.find((r) => r.id === req.params.id);
  if (!item) return res.status(404).json({ ok: false, error: 'الطلب غير موجود.' });
  item.status = status;
  item.updatedAt = Date.now();
  enqueueSave(REQUESTS_FILE, requests).then(() => {
    res.json({ ok: true, message: 'تم حفظ الحالة بنجاح.' });
  }).catch(() => res.status(500).json({ ok: false, error: 'تعذّر الحفظ.' }));
});

// ------------------------------------------------ نشر منشور (إدارة فقط، رفع وسائط)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: MAX_IMAGES + MAX_VIDEOS }
});

app.post('/api/admin/posts', requireAdmin, requireCsrf, (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ ok: false, error: 'أحد الملفات أكبر من الحد المسموح (صورة 5MB / فيديو 20MB).' });
      if (err.code === 'LIMIT_FILE_COUNT') return res.status(413).json({ ok: false, error: 'عدد الملفات يتجاوز الحد (حتى 8 صور وفيديو واحد).' });
      return res.status(400).json({ ok: false, error: 'خطأ في رفع الملفات: ' + err.message });
    }
    handleCreatePost(req, res);
  });
});

app.delete('/api/admin/posts/:id', requireAdmin, requireCsrf, (req, res) => {
  const idx = posts.findIndex((p) => p.id === req.params.id);
  if (idx < 0) return res.status(404).json({ ok: false, error: 'المنشور غير موجود.' });
  const [removed] = posts.splice(idx, 1);
  const mediaFiles = [
    ...((removed.media && removed.media.images) || []),
    ...((removed.media && removed.media.videos) || []),
  ];
  enqueueSave(POSTS_FILE, posts).then(() => {
    mediaFiles.forEach((m) => {
      try { fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(m))); } catch (e) { /* تجاهل */ }
    });
    res.json({ ok: true, message: 'تم حذف المنشور.' });
  }).catch(() => {
    posts.splice(idx, 0, removed);
    res.status(500).json({ ok: false, error: 'تعذّر حذف المنشور.' });
  });
});

function handleCreatePost(req, res) {
  const b = req.body || {};
  const title = cleanText(b.title, 90);
  const location = cleanText(b.location, 150);
  const description = cleanText(b.description, 4000);
  const type = cleanText(b.type, 20);
  const price = cleanText(b.price, 80);
  const rooms = cleanText(b.rooms, 40);
  const areaM2 = cleanText(b.areaM2, 20);

  const errors = [];
  if (title.length < 3) errors.push('عنوان المنشور مطلوب (3 أحرف على الأقل).');
  if (title.length > 90) errors.push('العنوان أطول من 90 حرفًا.');
  if (location.length < 2) errors.push('المكان مطلوب (حرفان على الأقل).');
  if (location.length > 150) errors.push('المكان أطول من 150 حرفًا.');
  if (description.length < 10) errors.push('الوصف مطلوب (10 أحرف على الأقل).');
  if (description.length > 4000) errors.push('الوصف أطول من 4000 حرف.');
  if (type && !ALLOWED_TYPES.includes(type)) errors.push('نوع العرض غير صالح (إيجار / بيع / أخرى).');

  const files = Array.isArray(req.files) ? req.files : [];
  const images = files.filter((f) => f.fieldname === 'images');
  const videos = files.filter((f) => f.fieldname === 'video');
  if (images.length > MAX_IMAGES) errors.push('عدد الصور يتجاوز 8.');
  if (videos.length > MAX_VIDEOS) errors.push('فيديو واحد فقط لكل منشور.');

  let mediaTotal = 0;
  const media = { images: [], videos: [] };
  if (files.length) {
    // فحص المحتوى أولاً
    for (const f of images) {
      const ext = detectImage(f.buffer);
      if (!ext) { errors.push('أحد الصور غير مدعوم (JPG/PNG/WebP فقط).'); continue; }
      if (f.size > MAX_IMAGE_BYTES) { errors.push('صورة أكبر من 5 ميجابايت.'); continue; }
      mediaTotal += f.size;
      media.images.push(f);
    }
    for (const f of videos) {
      const ext = detectVideo(f.buffer);
      if (!ext) { errors.push('الفيديو غير مدعوم (MP4/WebM فقط).'); continue; }
      if (f.size > MAX_VIDEO_BYTES) { errors.push('الفيديو أكبر من 20 ميجابايت.'); continue; }
      mediaTotal += f.size;
      media.videos.push({ f, ext });
    }
    if (mediaTotal > MAX_POST_MEDIA_BYTES) {
      errors.push('إجمالي الوسائط يتجاوز 40 ميجابايت.');
    }
  }

  if (errors.length) {
    return res.status(400).json({ ok: false, error: errors[0], errors });
  }

  // الحفظ الفعلي للملفات
  const saved = { images: [], videos: [] };
  for (const f of media.images) {
    saved.images.push('/media/' + saveMediaBuffer(f.buffer, detectImage(f.buffer), 'img'));
  }
  for (const v of media.videos) {
    saved.videos.push('/media/' + saveMediaBuffer(v.f.buffer, v.ext, 'vid'));
  }

  const now = Date.now();
  const post = {
    id: newId(),
    title,
    location,
    description,
    type: type || 'أخرى',
    price,
    rooms,
    areaM2,
    media: saved,
    createdAt: now,
    updatedAt: now,
  };
  posts.push(post);
  enqueueSave(POSTS_FILE, posts).then(() => {
    res.status(201).json({ ok: true, message: 'تم نشر المنشور بنجاح.', post: { id: post.id } });
  }).catch(() => {
    posts = posts.filter((p) => p.id !== post.id);
    // تنظيف الوسائط المحفوظة عند فشل الحفظ
    [...saved.images, ...saved.videos].forEach((m) => {
      try { fs.unlinkSync(path.join(UPLOADS_DIR, path.basename(m))); } catch (e) { /* تجاهل */ }
    });
    res.status(500).json({ ok: false, error: 'تعذّر حفظ المنشور على الخادم.' });
  });
}

function consumeRequestSlotFree(ip) {
  const rec = requestActivity.get(ip);
  if (rec && rec.count > 0) rec.count -= 1;
}

// صحة عامة
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'بيتك عندنا', up: true }));

// مسارات SPA لملفات الصفحات النصية
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/listings', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'listings.html')));
app.get('/detail', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'detail.html')));
app.get('/request', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'request.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));

// error handling
app.use((req, res) => {
  const wantsHtml = req.method === 'GET' && !String(req.path || '').startsWith('/api/');
  if (wantsHtml && fs.existsSync(path.join(PUBLIC_DIR, '404.html'))) {
    return res.status(404).sendFile(path.join(PUBLIC_DIR, '404.html'));
  }
  res.status(404).json({ ok: false, error: 'غير موجود.' });
});

// boot
loadData();
pruneTokens();
setInterval(pruneTokens, 5 * 60 * 1000);

const server = http.createServer(app);
server.listen(PORT, HOST, () => {
  console.log(`بيتك عندنا — يعمل على http://${HOST}:${PORT}`);
  console.log(`المنشورات: ${posts.length} | الطلبات: ${requests.length}`);
});

module.exports = app;
