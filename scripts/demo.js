'use strict';
/**
 * «بيتك عندنا» — منشورات تجريبية ببيانات وهمية وصور وهمية.
 *
 * الغرض: يملأ الموقع بمحتوى عينة حتى لا يظهر فارغًا.
 * كل منشور هنا عليه علم demo:true وعنوان فيه (تجريبي) عشان يبقى سهل التفرقة
 * وحذفه من صفحة الإدارة السرية — زر «حذف المنشورات التجريبية» يشيلهم جميعًا بضغطة واحدة.
 *
 * الصور من public/demo-media حتى تعمل على Vercel بدون قرص دائم.
 */
const fs = require('fs');

function ts(iso) {
  return Date.parse(iso);
}

const img = (file) => '/demo-media/' + file;

function demoPosts() {
  return [
    {
      id: 'demo-nasr-rent',
      title: 'شقة إيجار 3 غرف + ريسبشن في مدينة نصر (تجريبي)',
      location: 'مدينة نصر، القاهرة',
      type: 'إيجار',
      price: '12,000 جنيه / الشهر',
      rooms: '3 غرف + ريسبشن',
      areaM2: '150',
      description:
        '⚠️ هذا منشور تجريبي ببيانات وهمية للعرض فقط — ليس شقة حقيقية، ويُحذف من صفحة الإدارة.\n' +
        'شقة 150 متر في مدينة نصر، الدور الخامس بآسانسير.\n' +
        '3 غرف نوم (ماستر بحمام)، ريسبشن واسع، مطبخ مفتوح، 2 حمام.\n' +
        'تشطيب لوكس، غاز طبيعي، أمن، قريبة من الخدمات.\n' +
        'معاينة بموعد مسبق.',
      media: { images: [img('demo-living.jpg'), img('demo-kitchen.jpg')], videos: [] },
      demo: true,
      createdAt: ts('2026-09-07T09:30:00Z'),
      updatedAt: ts('2026-09-07T09:30:00Z'),
    },
    {
      id: 'demo-tahlia-sale',
      title: 'شقة للبيع 2 غرف في التجمع الخامس (تجريبي)',
      location: 'التجمع الخامس، القاهرة الجديدة',
      type: 'بيع',
      price: '4,500,000 جنيه',
      rooms: '2 غرف + ريسبشن',
      areaM2: '135',
      description:
        '⚠️ هذا منشور تجريبي ببيانات وهمية للعرض فقط — ليس شقة حقيقية، ويُحذف من صفحة الإدارة.\n' +
        'شقة 135 متر في كمبوند بالتجمع الخامس.\n' +
        'غرفتين ماستر، ريسبشن مفتوح على سفرة، مطبخ أمريكي، 2 حمام، بلكونة.\n' +
        'الدور السابع إطلالة مفتوحة، تشطيب سوبر لوكس، جراج وحراسة.\n' +
        'الاستلام فوري. الأوراق جاهزة.',
      media: { images: [img('demo-bedroom.jpg'), img('demo-exterior.jpg')], videos: [] },
      demo: true,
      createdAt: ts('2026-09-07T08:00:00Z'),
      updatedAt: ts('2026-09-07T08:00:00Z'),
    },
    {
      id: 'demo-october-rent',
      title: 'شقة عائلية للإيجار في 6 أكتوبر (تجريبي)',
      location: 'الحي الثاني، 6 أكتوبر',
      type: 'إيجار',
      price: '7,500 جنيه / الشهر',
      rooms: '3 غرف + ريسبشن',
      areaM2: '140',
      description:
        '⚠️ هذا منشور تجريبي ببيانات وهمية للعرض فقط — ليس شقة حقيقية، ويُحذف من صفحة الإدارة.\n' +
        'شقة 140 متر في 6 أكتوبر، الدور الرابع.\n' +
        '3 غرف، ريسبشن، مطبخ، 2 حمام، بلكونة كبيرة إطلالة على الحدائق.\n' +
        'قريبة من المحور والمدارس والخدمات. تشطيب جيد جدًا.\n' +
        'الإيجار شامل الصيانة. مناسبة للعائلات.',
      media: { images: [img('demo-balcony.jpg')], videos: [] },
      demo: true,
      createdAt: ts('2026-09-06T18:00:00Z'),
      updatedAt: ts('2026-09-06T18:00:00Z'),
    },
    {
      id: 'demo-heliopolis-studio',
      title: 'استوديو مفروش للإيجار في مصر الجديدة (تجريبي)',
      location: 'مصر الجديدة، القاهرة',
      type: 'إيجار',
      price: '6,000 جنيه / الشهر',
      rooms: 'استوديو',
      areaM2: '55',
      description:
        '⚠️ هذا منشور تجريبي ببيانات وهمية للعرض فقط — ليس شقة حقيقية، ويُحذف من صفحة الإدارة.\n' +
        'استوديو 55 متر مفروش بالكامل في مصر الجديدة.\n' +
        'غرفة نوم، مطبخ صغيرة مجهزة، حمام، إطلالة شارع هادئ.\n' +
        'دور ثاني، تشطيب دافئ، إنترنت وشامل الخدمات.\n' +
        'مناسب لشخص واحد أو زوجين.',
      media: { images: [img('demo-studio.jpg')], videos: [] },
      demo: true,
      createdAt: ts('2026-09-05T12:00:00Z'),
      updatedAt: ts('2026-09-05T12:00:00Z'),
    },
  ];
}

/**
 * يضيف المنشورات التجريبية لو مش موجودة (بدون لمس بيانات موجودة).
 * لو الإدارة شالتهم من قبل (ملف demoRemovedFile موجود) ما نضيفهمش تاني عند إعادة التشغيل.
 * يرجع قائمة المنشورات المحدثة، ويكتب الملف على القرص إن أمكن.
 */
function seedDemoIfAbsent({ posts, postsFile, demoRemovedFile }) {
  if (demoRemovedFile && fs.existsSync(demoRemovedFile)) return posts;
  if (!Array.isArray(posts)) posts = [];
  const existing = new Set(posts.map((p) => p.id));
  const toAdd = demoPosts().filter((p) => !existing.has(p.id));
  if (!toAdd.length) return posts;
  const next = posts.concat(toAdd);
  try {
    fs.writeFileSync(postsFile, JSON.stringify(next, null, 2), 'utf8');
  } catch (e) {
    /* على الاستضافة بدون قرص دائم نكتفي بالذاكرة */
  }
  console.log('تمت إضافة ' + toAdd.length + ' منشورات تجريبية (بيانات وهمية — تقدر تحذفهم من صفحة الإدارة).');
  return next;
}

module.exports = { demoPosts, seedDemoIfAbsent };
