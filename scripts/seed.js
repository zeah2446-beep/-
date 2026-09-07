'use strict';
/**
 * زراعة منشورات حقيقية إذا كانت قاعدة المنشورات فارغة.
 * الصور تُقدَّم من public/listings-media حتى تعمل على Vercel بدون قرص دائم.
 */
const fs = require('fs');

function ts(iso) {
  return Date.parse(iso);
}

function seedIfEmpty({ posts, postsFile }) {
  if (Array.isArray(posts) && posts.length > 0) return posts;

  const img = (file) => '/listings-media/' + file;

  const seeded = [
    {
      id: 'post-nasr-rent',
      title: 'شقة إيجار 3 غرف في مدينة نصر',
      location: 'مدينة نصر، القاهرة',
      type: 'إيجار',
      price: '8,500 جنيه / الشهر',
      rooms: '3 غرف + ريسبشن',
      areaM2: '145',
      description:
        'شقة واسعة 145 متر في مدينة نصر، الدور السادس بآسانسير.\n' +
        '3 غرف نوم (ماستر بحمام)، ريسبشن كبير، مطبخ تجهيز كامل، 2 حمام.\n' +
        'تشطيب سوبر لوكس، غاز طبيعي، أمن 24 ساعة، قريبة من عباس العقاد والخدمات.\n' +
        'الإيجار شامل الصيانة. معاينة بموعد مسبق.',
      media: { images: [img('nasr-living.jpg'), img('nasr-kitchen.jpg')], videos: [] },
      createdAt: ts('2026-09-05T10:00:00Z'),
      updatedAt: ts('2026-09-05T10:00:00Z'),
    },
    {
      id: 'post-maadi-sale',
      title: 'شقة للبيع في المعادي — إطلالة هادئة',
      location: 'المعادي، القاهرة',
      type: 'بيع',
      price: '3,200,000 جنيه',
      rooms: '2 غرف + ريسبشن',
      areaM2: '120',
      description:
        'شقة 120 متر للبيع في المعادي، شارع هادئ ومشجر.\n' +
        'غرفتين نوم، ريسبشن قطعتين، مطبخ، حمامين، بلكونة.\n' +
        'الدور الثالث، تشطيب حديث، قريبة من المترو والنادي.\n' +
        'عقد مسجل، جاهزة للمعاينة والتفاوض الجاد.',
      media: { images: [img('maadi-exterior.jpg'), img('maadi-bedroom.jpg')], videos: [] },
      createdAt: ts('2026-09-02T10:00:00Z'),
      updatedAt: ts('2026-09-02T10:00:00Z'),
    },
    {
      id: 'post-newcairo-rent',
      title: 'شقة حديثة للإيجار في التجمع الخامس',
      location: 'التجمع الخامس، القاهرة الجديدة',
      type: 'إيجار',
      price: '14,000 جنيه / الشهر',
      rooms: '3 غرف + ريسبشن',
      areaM2: '165',
      description:
        'شقة 165 متر في كمبوند راقٍ بالتجمع الخامس.\n' +
        '3 غرف، ريسبشن مفتوح، مطبخ أمريكاني، 3 حمامات، 2 بلكونة.\n' +
        'تشطيب الترا لوكس، تكييفات، جراج، حراسة، جيم ومسبح للكمبوند.\n' +
        'الإيجار غير شامل الكهرباء. عائلات فقط.',
      media: { images: [img('newcairo-living.jpg')], videos: [] },
      createdAt: ts('2026-09-06T10:00:00Z'),
      updatedAt: ts('2026-09-06T10:00:00Z'),
    },
    {
      id: 'post-october-rent',
      title: 'شقة عائلية للإيجار في 6 أكتوبر',
      location: 'الحي المتميز، 6 أكتوبر',
      type: 'إيجار',
      price: '6,500 جنيه / الشهر',
      rooms: '3 غرف + ريسبشن',
      areaM2: '130',
      description:
        'شقة 130 متر في الحي المتميز بـ 6 أكتوبر، الدور الرابع.\n' +
        '3 غرف، ريسبشن، مطبخ، 2 حمام، بلكونة تطل على مساحات خضراء.\n' +
        'قريبة من المحور والخدمات والمدارس. تشطيب جيد جدًا.\n' +
        'الإيجار شامل الصيانة. مناسبة للعائلات.',
      media: { images: [img('october-balcony.jpg')], videos: [] },
      createdAt: ts('2026-08-30T10:00:00Z'),
      updatedAt: ts('2026-08-30T10:00:00Z'),
    },
    {
      id: 'post-zamalek-sale',
      title: 'شقة للبيع في الزمالك بإطلالة مميزة',
      location: 'الزمالك، القاهرة',
      type: 'بيع',
      price: '6,800,000 جنيه',
      rooms: '2 غرف + ريسبشن واسع',
      areaM2: '155',
      description:
        'شقة مميزة 155 متر في الزمالك، إطلالة مفتوحة وإضاءة طبيعية ممتازة.\n' +
        'غرفتين ماستر، ريسبشن واسع، مطبخ، 2 حمام، سقف مرتفع.\n' +
        'عمارة راقية بأسانسير، دور مرتفع، موقع حيوي هادئ.\n' +
        'للجادّين في الشراء. المعاينة بتنسيق مسبق.',
      media: { images: [img('zamalek-view.jpg')], videos: [] },
      createdAt: ts('2026-09-04T10:00:00Z'),
      updatedAt: ts('2026-09-04T10:00:00Z'),
    },
    {
      id: 'post-heliopolis-rent',
      title: 'شقة إيجار في مصر الجديدة',
      location: 'مصر الجديدة، القاهرة',
      type: 'إيجار',
      price: '9,000 جنيه / الشهر',
      rooms: '3 غرف + صالة',
      areaM2: '150',
      description:
        'شقة 150 متر في مصر الجديدة، ريسبشن كلاسيك واسع.\n' +
        '3 غرف، صالة، مطبخ، 2 حمام، بلكونة.\n' +
        'قريبة من الكوربة والخدمات والمواصلات. تشطيب محترم.\n' +
        'عائلات. الإيجار قابل للنقاش للمدة الطويلة.',
      media: { images: [img('heliopolis-hall.jpg')], videos: [] },
      createdAt: ts('2026-09-01T10:00:00Z'),
      updatedAt: ts('2026-09-01T10:00:00Z'),
    },
    {
      id: 'post-zayed-sale',
      title: 'شقة للبيع في الشيخ زايد',
      location: 'الشيخ زايد، الجيزة',
      type: 'بيع',
      price: '4,150,000 جنيه',
      rooms: '3 غرف + ريسبشن',
      areaM2: '170',
      description:
        'شقة 170 متر في الشيخ زايد، استلام فوري ومفروشة جزئيًا.\n' +
        '3 غرف، ريسبشن مفتوح على سفرة، مطبخ، 3 حمامات.\n' +
        'كمبوند بخدمات كاملة، جراج، أمن. مناسبة للسكن فورًا.\n' +
        'السعر للتفاوض الجاد. الأوراق جاهزة.',
      media: { images: [img('sheikhzayed-living.jpg')], videos: [] },
      createdAt: ts('2026-09-03T10:00:00Z'),
      updatedAt: ts('2026-09-03T10:00:00Z'),
    },
    {
      id: 'post-downtown-studio',
      title: 'استوديو للإيجار في وسط البلد',
      location: 'وسط البلد، القاهرة',
      type: 'إيجار',
      price: '4,800 جنيه / الشهر',
      rooms: 'استوديو',
      areaM2: '55',
      description:
        'استوديو 55 متر في وسط البلد، سقف مرتفع وإضاءة دافئة.\n' +
        'مساحة مفتوحة للنوم والمعيشة، مطبخ صغير، حمام، إطلالة شارع.\n' +
        'مناسب لشخص واحد أو زوجين. قريب من المترو والخدمات.\n' +
        'مفروش جزئيًا. الإيجار شامل الإنترنت.',
      media: { images: [img('downtown-studio.jpg')], videos: [] },
      createdAt: ts('2026-09-07T08:00:00Z'),
      updatedAt: ts('2026-09-07T08:00:00Z'),
    },
  ];

  try {
    fs.writeFileSync(postsFile, JSON.stringify(seeded, null, 2), 'utf8');
  } catch (e) {
    /* على الاستضافة بدون قرص دائم نكتفي بالذاكرة */
  }
  console.log('تمت زراعة ' + seeded.length + ' منشورات شقق حقيقية مع الصور.');
  return seeded;
}

module.exports = { seedIfEmpty };
