/* منشورات الشقق — جلب وعرض من الخادم الحقيقي */
(function () {
  const listEl = document.getElementById('list');
  const stateEl = document.getElementById('state');
  const stateContent = document.getElementById('state-content');
  const qEl = document.getElementById('q');
  const typeEl = document.getElementById('type-filter');

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function dateLabel(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  function thumbHtml(p) {
    if (p.coverImage) {
      return '<div class="pc-thumb"><img src="' + esc(p.coverImage) + '" alt="" loading="lazy">' +
             (p.hasVideo ? '<span class="badge-media">🎬 فيديو</span>' : '') + '</div>';
    }
    if (p.hasVideo) {
      return '<div class="pc-thumb"><span class="ph">🎬 فيديو متاح</span></div>';
    }
    return '';
  }

  function metaHtml(p) {
    const bits = [];
    if (p.type) bits.push('<span class="type-chip">' + esc(p.type) + '</span>');
    if (p.price) bits.push('<span class="price-tag">' + esc(p.price) + '</span>');
    if (p.rooms) bits.push('<span class="meta-item">' + esc(p.rooms) + '</span>');
    if (p.areaM2) bits.push('<span class="meta-item">' + esc(p.areaM2) + ' م²</span>');
    return bits.length ? '<div class="meta-row">' + bits.join('') + '</div>' : '';
  }

  function render(posts) {
    stateEl.style.display = 'none';
    if (!posts.length) {
      listEl.innerHTML = '';
      stateContent.innerHTML =
        '<div class="empty"><div class="big">🏠</div><h3>مفيش منشورات مطابقة</h3>' +
        '<p>لو البحث ما جابش نتيجة، جرّب كلمة تانية أو ابعت طلب بمواصفاتك.</p>' +
        '<div class="mt3" style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">' +
        '<a href="/request.html" class="btn">اطلب شقة 📝</a></div></div>';
      stateEl.style.display = 'block';
      return;
    }

    const countHtml = '<p class="small muted">عدد المنشورات: <b class="ltr">' + posts.length + '</b></p>';

    const cards = posts.map(function (p) {
      return '<article class="post-card" data-id="' + esc(p.id) + '">' +
        '<div class="pc-head"><h2 class="pc-title">' + esc(p.title) + '</h2>' +
        '<p class="pc-loc">📍 ' + esc(p.location) + '</p>' +
        metaHtml(p) + '</div>' +
        thumbHtml(p) +
        '<div class="pc-body"><p class="pc-desc"></p></div>' +
        '<div class="pc-foot"><span class="btn btn-cream btn-sm">التفاصيل</span>' +
        '<span class="pc-date">🗓️ ' + dateLabel(p.createdAt) + '</span></div>' +
        '</article>';
    }).join('');

    listEl.innerHTML = countHtml + cards;

    document.querySelectorAll('.post-card').forEach(function (card) {
      card.addEventListener('click', function () {
        window.location.href = '/detail.html?id=' + encodeURIComponent(card.dataset.id);
      });
      const post = posts.find(function (x) { return x.id === card.dataset.id; });
      const desc = card.querySelector('.pc-desc');
      if (post) desc.textContent = (post.preview || '').trim() || 'اضغط لقراءة التفاصيل الكاملة.';
    });
  }

  function showErr(msg) {
    listEl.innerHTML = '';
    stateContent.innerHTML = '<div class="empty"><div class="big">⚠️</div><h3>تعذّر التحميل</h3><p>' + esc(msg) + '</p></div>';
    stateEl.style.display = 'block';
  }

  function load() {
    const params = new URLSearchParams();
    const q = qEl && qEl.value ? qEl.value.trim() : '';
    const type = typeEl && typeEl.value ? typeEl.value : '';
    if (q) params.set('q', q);
    if (type) params.set('type', type);
    const url = '/api/posts' + (params.toString() ? '?' + params.toString() : '');
    fetch(url).then(function (r) { return r.json(); })
      .then(function (d) {
        if (d && d.ok) render(d.posts || []);
        else showErr((d && d.error) || 'خطأ غير متوقع.');
      })
      .catch(function () { showErr('تعذّر الاتصال بالخادم. تأكد إن السيرفر شغال.'); });
  }

  let t = null;
  if (qEl) qEl.addEventListener('input', function () {
    clearTimeout(t);
    t = setTimeout(load, 280);
  });
  if (typeEl) typeEl.addEventListener('change', load);

  load();
})();
