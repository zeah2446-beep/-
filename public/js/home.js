/* أحدث المنشورات على الصفحة الرئيسية — من الخادم الحقيقي */
(function () {
  const box = document.getElementById('home-list');
  if (!box) return;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function cardHtml(p) {
    const thumb = p.coverImage
      ? '<div class="pc-thumb"><img src="' + esc(p.coverImage) + '" alt="" loading="lazy"></div>'
      : '';
    const price = p.price ? '<span class="price-tag">' + esc(p.price) + '</span>' : '';
    const type = p.type ? '<span class="type-chip">' + esc(p.type) + '</span>' : '';
    return '<article class="post-card" data-id="' + esc(p.id) + '">' +
      '<div class="pc-head"><h2 class="pc-title">' + esc(p.title) + '</h2>' +
      '<p class="pc-loc">📍 ' + esc(p.location) + '</p>' +
      '<div class="meta-row">' + type + price + '</div></div>' +
      thumb +
      '<div class="pc-foot"><span class="btn btn-cream btn-sm">التفاصيل</span></div>' +
      '</article>';
  }

  fetch('/api/posts')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (!d || !d.ok) throw new Error();
      const posts = (d.posts || []).slice(0, 3);
      if (!posts.length) {
        box.innerHTML = '<div class="empty"><div class="big">🏠</div><p>مفيش منشورات حاليًا — تقدر تبعت طلب مواصفات.</p>' +
          '<div class="mt2"><a class="btn" href="/request.html">اطلب شقة</a></div></div>';
        return;
      }
      box.innerHTML = '<div class="home-grid">' + posts.map(cardHtml).join('') + '</div>';
      box.querySelectorAll('.post-card').forEach(function (card) {
        card.addEventListener('click', function () {
          window.location.href = '/detail.html?id=' + encodeURIComponent(card.dataset.id);
        });
      });
    })
    .catch(function () {
      box.innerHTML = '<div class="empty"><div class="big">⚠️</div><p>تعذّر تحميل المنشورات من الخادم.</p></div>';
    });
})();
