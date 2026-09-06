'use strict';
/**
 * ضبط كلمة مرور الإدارة المخفية.
 * الاستخدام:
 *   node scripts/set-password.js
 *   node scripts/set-password.js "كلمة المرور"
 *
 * يكتب النتيجة (تجزئة آمنة فقط) داخل ملف config.json في جذر المشروع.
 * هذا الملف مستثنى من git حتى لا تُرفع كلمة المرور إلى أي مستودع عام.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { hashPassword } = require('../lib/passwords');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

function readArgPassword() {
  return process.argv[2];
}

function askPassword() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const onData = (buf) => {
      const str = String(buf);
      if (str.startsWith('\u0003') || str.startsWith('\u0004')) { // Ctrl+C / Ctrl+D
        rl.close();
        resolve(null);
      }
    };
    process.stdin.on('data', onData);
    rl.question('أدخل كلمة مرور الإدارة الجديدة (ستُخفى أثناء الكتابة): ', (val) => {
      process.stdin.removeListener('data', onData);
      rl.close();
      resolve(val.trim());
    });
  });
}

function main() {
  let pass = readArgPassword();
  const doSet = (p) => {
    if (!p) { console.error('كلمة المرور فارغة. أعد المحاولة.'); process.exit(1); }
    const hash = hashPassword(p);
    let cfg = {};
    if (fs.existsSync(CONFIG_PATH)) {
      try { cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
      catch (e) { cfg = {}; }
    }
    cfg.adminPasswordHash = hash;
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), { encoding: 'utf8', mode: 0o600 });
    console.log('\nتم حفظ تجزئة كلمة المرور الإدارية في config.json بنجاح.');
    console.log('ملاحظة: هذا الملف مستثنى من git، ولا تُرفع قيمته إلى المستودع.');
  };

  if (pass !== undefined) { doSet(pass); return; }
  askPassword().then((p) => { if (p === null) { console.log('تم الإلغاء.'); return; } doSet(p); });
}

main();
