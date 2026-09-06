/* صفحة تفاصيل الشقة */
(function () {
  const content = document.getElementById('content');
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ---- معرض صور مع تنقّل وتكبير ----
  function makeGallery(images) {
    if (!images || !images.length) return '';
    let current = 0;
    const thumbs = images.map(function (src, i) {
      return '<button type="button" class="' + (i === 0 ? 'active' : '') + '" data-i="' + i + '">' +
             '<img src="' + esc(src) + '" alt=""></button>';
    }).join('');

    const wrap = document.createElement('div');
    wrap.className = 'gallery';
    wrap.innerHTML =
      '<div class="gallery-main"><img data-slot="main" src="' + esc(images[0]) + '" alt=""></div>' +
      '<button type="button" class="gallery-nav prev" data-a="prev">‹</button>' +
      '<button type="button" class="gallery-nav next" data-a="next">›</button>' +
      '<div class="gallery-thumbs">' + thumbs + '</div>';

    const mainImg = wrap.querySelector('[data-slot=main]');
    const prev = wrap.querySelector('.gallery-nav.prev');
    const next = wrap.querySelector('.gallery-nav.next');
    function show(i) {
      current = (i + images.length) % images.length;
      mainImg.src = images[current];
      wrap.querySelectorAll('.gallery-thumbs button').forEach(function (b) {
        b.classList.toggle('active', Number(b.dataset.i) === current);
      });
      prev.disabled = images.length <= 1;
      next.disabled = images.length <= 1;
    }
    prev.addEventListener('click', function () { show(current - 1); });
    next.addEventListener('click', function () { show(current + 1); });
    wrap.querySelectorAll('.gallery-thumbs button').forEach(function (b) {
      b.addEventListener('click', function () { show(Number(b.dataset.i)); });
    });
    // تكبير
    function openLightbox(src) {
      const lb = document.createElement('div');
      lb.className = 'lightbox';
      lb.innerHTML = '<button class="lb-x" type="button">&times;</button><img src="' + esc(src) + '" alt="">';
      document.body.appendChild(lb);
      lb.addEventListener('click', function (e) { if (e.target === lb || e.target.classList.contains('lb-x')) lb.remove(); });
      // تنقّل بالصور داخل التكبير
      lb.querySelector('img').addEventListener('click', function () {
        show(current + 1);
        lb.querySelector('img').src = images[current];
      });
    }
    mainImg.addEventListener('click', function () { openLightbox(images[current]); });
    return wrap;
  }

  function makeVideo(video) {
    if (!video) return '';
    const wrap = document.createElement('div');
    wrap.className = 'video-wrap';
    const v = document.createElement('video');
    v.controls = true;
    v.preload = 'metadata';
    v.setAttribute('playsinline', '');
    const src = document.createElement('source');
    src.src = video;
    v.appendChild(src);
    wrap.appendChild(v);
    return wrap;
  }

  function render(post) {
    const imgs = (post.media && post.media.images) || [];
    const vids = (post.media && post.media.videos) || [];
    const hasAnyMedia = imgs.length || vids.length;

    const mediaHtml = document.createElement('div');
    if (hasAnyMedia) {
      mediaHtml.className = 'detail-media';
      const gal = makeGallery(imgs);
      const vid = makeVideo(vids[0]);
      if (gal) mediaHtml.appendChild(gal);
      if (vid) mediaHtml.appendChild(vid);
    }

    const card = document.createElement('div');
    card.className = 'detail-card';
    const titleH = document.createElement('h1');
    titleH.textContent = post.title;
    const loc = document.createElement('p');
    loc.className = 'loc-line';
    loc.textContent = '📍 ' + post.location;
    const lbl = document.createElement('div');
    lbl.className = 'sec-label';
    lbl.textContent = 'الوصف والمكان';
    const desc = document.createElement('div');
    desc.className = 'detail-desc';
    desc.textContent = post.description || '';
    card.appendChild(titleH);
    card.appendChild(loc);
    card.appendChild(lbl);
    card.appendChild(desc);

    // وسيلة تواصل للاستفسار عن الشقة
    const contactBlock = document.createElement('div');
    contactBlock.className = 'ask-bar';
    contactBlock.style.marginTop = '16px';
    contactBlock.innerHTML =
      '<div><p class="ab-t" style="margin:0">عايز تستفسر عن الشقة دي؟</p>' +
      '<p class="ab-s" style="margin:0">تواصل مع الإدارة بالهاتف أو واتساب.</p></div>' +
      '<span class="ab-cta"><a class="btn" href="/request.html">اطلب شقة</a></span>';

    content.innerHTML = '';
    content.appendChild(mediaHtml);
    content.appendChild(card);
    content.appendChild(contactBlock);
    // تواصل مع الإدارة زر — موجود كزر عائم أصلاً
  }

  function showEmpty(msg) {
    content.innerHTML = '<div class="empty"><div class="big">🏠</div><h3>' + esc(msg) + '</h3>' +
      '<div class="mt2"><a href="/listings.html" class="btn">العودة للمنشورات</a></div></div>';
  }

  if (!id) { showEmpty('المنشور غير موجود.'); }
  else {
    fetch('/api/posts/' + encodeURIComponent(id)).then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok) render(d.post);
        else showEmpty('المنشور مش موجود أو اتشال.');
      })
      .catch(function () { showEmpty('تعذّر تحميل التفاصيل.'); });
  }
})();
