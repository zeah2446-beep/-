'use strict';
/**
 * تجزئة كلمة المرور الإدارية باستخدام scrypt (بطيئة وآمنة).
 * لا تُخزَّن كلمة المرور كنص ظاهر في أي ملف.
 */
const crypto = require('crypto');

const PREFIX = 'scrypt';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${PREFIX}:${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  if (typeof stored !== 'string') return false;
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== PREFIX) return false;
  const salt = parts[1];
  const expected = parts[2];
  const derived = crypto.scryptSync(String(password), salt, 64);
  const expectedBuf = Buffer.from(expected, 'hex');
  if (derived.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(derived, expectedBuf);
}

module.exports = { hashPassword, verifyPassword };
