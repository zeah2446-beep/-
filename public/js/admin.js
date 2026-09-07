/* لوحة إدارة بيتك عندنا — محمية بجلسة على الخادم */
(function () {
  let csrf = sessionStorage.getItem('bc_csrf') || '';
  let reqPage = 1;
  let reqFilter = 'الكل';

  const $ = function (id) { return document.getElementById(id); };
  const loginScreen = $('login-screen');
  const adminPanel = $('admin-panel');
  const logoutBtn = $('logout-btn');

  function apiHeaders(json) {
    const h = {};
    if (json) h['Content-Type'] = 'application/json';
    if (csrf) h['X-CSRF-Token'] = csrf;
    return h;
  }

  function showMsg(el, text, type) {
    if (!el) return;
    el.textContent = text || '';
    el.className = 'msg show ' + (type === 'err' ? 'err' : 'ok');
  }
  function clearMsg(el) { if (el) el.className = 'msg'; }

  function showLogin() {
    loginScreen.style.display = 'block';
    adminPanel.style.display = 'none';
    logoutBtn.style.display = 'none';
    document.title = 'دخول — إدارة بيتك عندنا';
  }
  function showPanel(stats) {
    loginScreen.style.display = 'none';
    adminPanel.style.display = 'block';
    logoutBtn.style.display = '';
    if (stats) {
      $('admin-stats').textContent = 'منشورات: ' + stats.posts + ' | طلبات: ' + stats.requests +
        ' (جديد: ' + stats.byStatus['جديد'] + ' — قيد المراجعة: ' + stats.byStatus['قيد المراجعة'] + ' — متوفر: ' + stats.byStatus['متوفر'] + ' — غير متوفر: ' + stats.byStatus['غير متوفر'] + ')';
    }
  }

  function checkSession() {
    return fetch('/api/admin/session').then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.ok && d.authenticated) {
        csrf = d.csrf;
        sessionStorage.setItem('bc_csrf', d.csrf);
        loadStats();
        showPanel();
        return true;
      }
      showLogin();
      return false;
    }).catch(function () { showLogin(); return false; });
  }

  // ---- تسجيل الدخول ----
  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const pass = $('admin-pass').value;
    const btn = $('login-btn');
    if (!pass) return;
    btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> جارٍ الدخول…';
    clearMsg($('login-msg'));
    fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass })
    }).then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (res) {
        if (res.d && res.d.ok) {
          csrf = res.d.csrf;
          sessionStorage.setItem('bc_csrf', csrf);
          $('admin-pass').value = '';
          loadStats();
          showPanel();
        } else {
          btn.disabled = false; btn.innerHTML = 'دخول';
          showMsg($('login-msg'), (res.d && res.d.error) || 'كلمة المرور غير صحيحة.', 'err');
        }
      })
      .catch(function () {
        btn.disabled = false; btn.innerHTML = 'دخول';
        showMsg($('login-msg'), 'تعذّر الاتصال بالخادم.', 'err');
      });
  });

  // ---- خروج ----
  logoutBtn.addEventListener('click', function () {
    fetch('/api/admin/logout', { method: 'POST', headers: apiHeaders(false) }).catch(function () {});
    sessionStorage.removeItem('bc_csrf');
    csrf = '';
    showLogin();
  });

  // ---- إحصائيات ----
  function loadStats() {
    return fetch('/api/admin/stats', { headers: apiHeaders(false) }).then(function (r) { return r.json(); })
      .then(function (d) { if (d.ok) showPanel(d); })
      .catch(function () {});
  }

  // ---- تبويبات ----
  document.querySelectorAll('.tabs button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tabs button').forEach(function (b) { b.classList.remove('active'); });
      document.querySelectorAll('.panel').forEach(function (p) { p.classList.remove('active'); });
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      $('tab-' + tab).classList.add('active');
      if (tab === 'requests') loadRequests(true);
      if (tab === 'posts') loadAdminPosts();
    });
  });

  // ===================== إضافة منشور =====================
  let selectedImages = [];
  let selectedVideo = null;

  $('img-picker').addEventListener('click', function () { $('pimages').click(); });
  $('pimages').addEventListener('change', function () {
    const files = Array.prototype.slice.call(this.files || []).slice(0, 8 - selectedImages.length);
    files.forEach(function (f) { if (f.size > 5 * 1024 * 1024) { showMsg($('pub-msg'), 'صورة أكبر من 5 ميجابايت.', 'err'); return; } selectedImages.push(f); });
    this.value = '';
    renderImgPreviews();
  });
  function renderImgPreviews() {
    const box = $('img-previews');
    box.innerHTML = '';
    selectedImages.forEach(function (f, i) {
      const url = URL.createObjectURL(f);
      const d = document.createElement('div');
      d.className = 'pitem';
      d.innerHTML = '<img src="' + url + '" alt=""><button class="rm" type="button" data-i="' + i + '">&times;</button>';
      d.querySelector('.rm').addEventListener('click', function () { selectedImages.splice(i, 1); renderImgPreviews(); });
      box.appendChild(d);
    });
  }

  $('vid-picker').addEventListener('click', function () { $('pvideo').click(); });
  $('pvideo').addEventListener('change', function () {
    const f = this.files && this.files[0];
    this.value = '';
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) { showMsg($('pub-msg'), 'الفيديو أكبر من 20 ميجابايت.', 'err'); return; }
    selectedVideo = f;
    renderVidPreviews();
  });
  function renderVidPreviews() {
    const box = $('vid-previews');
    box.innerHTML = '';
    if (!selectedVideo) return;
    const d = document.createElement('div');
    d.className = 'pitem';
    const url = URL.createObjectURL(selectedVideo);
    d.style.width = '140px'; d.style.height = '80px';
    d.innerHTML = '<video src="' + url + '" muted></video><span class="vidtag">فيديو</span><button class="rm" type="button" data-rm="1">&times;</button>';
    d.querySelector('[data-rm]').addEventListener('click', function () { selectedVideo = null; renderVidPreviews(); });
    box.appendChild(d);
  }

  // نشر المنشور
  $('post-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const btn = $('post-btn');
    if (btn.disabled) return;
    const title = $('ptitle').value.trim();
    const location = $('plocation').value.trim();
    const description = $('pdescription').value.trim();
    if (title.length < 3) return pubFail('العنوان مطلوب (3 أحرف على الأقل).');
    if (location.length < 2) return pubFail('المكان مطلوب.');
    if (description.length < 10) return pubFail('الوصف مطلوب (10 أحرف على الأقل).');
    const totalSize = selectedImages.reduce(function (s, f) { return s + f.size; }, 0) + (selectedVideo ? selectedVideo.size : 0);
    if (totalSize > 40 * 1024 * 1024) return pubFail('إجمالي الوسائط يتجاوز 40 ميجابايت.');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> جارٍ النشر…';
    clearMsg($('pub-msg'));

    const fd = new FormData();
    fd.append('title', title);
    fd.append('location', location);
    fd.append('description', description);
    fd.append('type', $('ptype') ? $('ptype').value : '');
    fd.append('price', $('pprice') ? $('pprice').value.trim() : '');
    fd.append('rooms', $('prooms') ? $('prooms').value.trim() : '');
    fd.append('areaM2', $('parea') ? $('parea').value.trim() : '');
    selectedImages.forEach(function (f) { fd.append('images', f, f.name); });
    if (selectedVideo) fd.append('video', selectedVideo, selectedVideo.name);

    fetch('/api/admin/posts', { method: 'POST', headers: apiHeaders(false), body: fd })
      .then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
      .then(function (res) {
        if (res.d && res.d.ok) {
          // نجاح فعلي بعد الحفظ على الخادم
          $('ptitle').value = ''; $('plocation').value = ''; $('pdescription').value = '';
          if ($('pprice')) $('pprice').value = '';
          if ($('prooms')) $('prooms').value = '';
          if ($('parea')) $('parea').value = '';
          selectedImages = []; selectedVideo = null;
          renderImgPreviews(); renderVidPreviews();
          showMsg($('pub-msg'), 'تم نشر المنشور بنجاح. هيظهر للزوار في كل المتصفحات.', 'ok');
          loadStats();
        } else if (res.status === 401 || res.status === 403) {
          showMsg($('pub-msg'), (res.d && res.d.error) || 'انتهت الجلسة. سجّل الدخول من جديد.', 'err');
          sessionStorage.removeItem('bc_csrf');
          setTimeout(function () { location.reload(); }, 900);
        } else {
          showMsg($('pub-msg'), (res.d && res.d.error) || 'لم يتم نشر المنشور. حاول تاني.', 'err');
        }
      })
      .catch(function () { showMsg($('pub-msg'), 'تعذّر الاتصال بالخادم أثناء الرفع. لم يتم نشر المنشور — راجع وحاول تاني.', 'err'); })
      .finally(function () {
        if (btn.disabled) { btn.disabled = false; btn.innerHTML = 'نشر المنشور 🚀'; }
      });
  });

  function pubFail(text) { showMsg($('pub-msg'), text, 'err'); $('pub-msg').scrollIntoView({ behavior: 'smooth', block: 'center' }); }

  // ===================== طلبات الشقق =====================
  const STATUS_CHIP = { 'جديد': 'chip-new', 'قيد المراجعة': 'chip-review', 'متوفر': 'chip-available', 'غير متوفر': 'chip-unavailable' };
  const WA_TEXTS = {
    'جديد': 'أهلًا {name}، وصلنا طلبك بخصوص شقة في {area} من موقع بيتك عندنا. بنراجعه حاليًا وهنوافيك بالرد. شكرًا لثقتك.',
    'قيد المراجعة': 'أهلًا {name}، طلبك لشقة في {area} قيد المراجعة من فريقنا. هنوافيك بالرد قريبًا. شكرًا لصبرك.',
    'متوفر': 'أهلًا {name}، بشّرنا إن فيه شقق متاحة تناسب طلبك في {area}. عايزين نكمل معاك التفاصيل، تواصل معانا. 🌟',
    'غير متوفر': 'أهلًا {name}، أسفين إنه مفيش حاليًا ما يناسب طلبك في {area}، هنوافيك فور توفر المناسب. شكرًا لثقتك في بيتك عندنا.'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function dateLabel(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  function waNumber(phone) {
    let s = String(phone).replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
      .replace(/[۰-۹]/g, function (d) { return String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); })
      .replace(/[\s\-()]/g, '');
    if (s.startsWith('+')) s = s.slice(1);
    if (s.startsWith('0020')) s = s.slice(4);
    if (s.startsWith('20')) s = s.slice(2);
    if (s.startsWith('0')) s = '20' + s.slice(1);
    return s.replace(/\D/g, '');
  }

  function renderRequests(data) {
    $('req-total').textContent = 'العدد: ' + data.total;
    const list = $('req-list');
    if (!data.requests.length) {
      list.innerHTML = '<div class="empty"><div class="big">🗂️</div><h3>مفيش طلبات هنا</h3><p>لا توجد طلبات مطابقة لهذه التصفية حاليًا.</p></div>';
      renderPager(1, 1);
      return;
    }
    list.innerHTML = data.requests.map(function (r) {
      const chip = STATUS_CHIP[r.status] || 'chip-new';
      const waNum = waNumber(r.phone);
      const waHref = 'https://wa.me/' + waNum;
      return '<div class="req-card" data-id="' + esc(r.id) + '">' +
        '<div class="rc-head"><span class="rc-name">' + esc(r.name) + '</span>' +
        '<span class="rc-ref ltr">' + esc(r.ref) + '</span>' +
        '<span class="rc-status chip ' + chip + '">' + esc(r.status) + '</span></div>' +
        '<div class="rc-grid">' +
          '<div class="row"><b>رقم التواصل:</b> <span class="ltr">' + esc(r.phone) + '</span></div>' +
          '<div class="row"><b>المنطقة:</b> ' + esc(r.area) + '</div>' +
          '<div class="row"><b>الميزانية:</b> ' + esc(r.budget) + '</div>' +
        '</div>' +
        '<div class="sec-label mt2">الوصف والمواصفات</div>' +
        '<div class="rc-desc"></div>' +
        '<div class="small muted">تاريخ الاستلام: ' + dateLabel(r.createdAt) + '</div>' +
        '<div class="rc-actions">' +
          '<label><span class="small">الحالة:</span> <select class="status-sel">' +
            ['جديد', 'قيد المراجعة', 'متوفر', 'غير متوفر'].map(function (s) {
              return '<option value="' + s + '"' + (s === r.status ? ' selected' : '') + '>' + s + '</option>';
            }).join('') +
          '</select></label>' +
          '<button class="btn btn-outline btn-sm save-status" type="button">حفظ الحالة</button>' +
          '<a class="btn btn-outline btn-sm" href="tel:+' + esc(String(r.phone).replace(/\D/g, '')) + '">📞 اتصال</a>' +
          '<a class="btn btn-whatsapp btn-sm" target="_blank" rel="noopener" href="' + waHref + '">💬 رد على واتساب</a>' +
        '</div>' +
      '</div>';
    }).join('');

    // الوصف كنص آمن
    list.querySelectorAll('.req-card').forEach(function (card) {
      const r = data.requests.find(function (x) { return x.id === card.dataset.id; });
      card.querySelector('.rc-desc').textContent = r ? (r.description || '') : '';
    });

    renderPager(data.page, data.totalPages);
    // واتساب بمسودة جاهزة حسب الحالة (مفتوح للتعديل، بلا إرسال تلقائي)
    list.querySelectorAll('.req-card a[target=_blank]').forEach(function (a) {
      const card = a.closest('.req-card');
      const r = data.requests.find(function (x) { return x.id === card.dataset.id; });
      if (r && /wa\.me/.test(a.href)) {
        const text = (WA_TEXTS[r.status] || WA_TEXTS['جديد'])
          .replace('{name}', r.name).replace('{area}', r.area);
        a.href = 'https://wa.me/' + waNumber(r.phone) + '?text=' + encodeURIComponent(text);
      }
    });
  }

  function renderPager(page, totalPages) {
    const pager = $('pager');
    pager.innerHTML = '';
    if (totalPages <= 1) { pager.style.display = 'none'; return; }
    pager.style.display = 'flex';
    const mk = function (label, p, disabled) {
      const b = document.createElement('button');
      b.textContent = label;
      b.disabled = !!disabled;
      if (p) b.addEventListener('click', function () { loadRequests(false, p); });
      return b;
    };
    pager.appendChild(mk('السابق', page - 1, page <= 1));
    const span = document.createElement('span');
    span.textContent = 'صفحة ' + page + ' من ' + totalPages;
    span.className = 'small';
    pager.appendChild(span);
    pager.appendChild(mk('التالي', page + 1, page >= totalPages));
  }

  function loadRequests(resetPage, page) {
    if (resetPage) reqPage = 1;
    if (page) reqPage = page;
    const url = '/api/admin/requests?page=' + reqPage + '&status=' + encodeURIComponent(reqFilter);
    fetch(url, { headers: apiHeaders(false) })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) { renderRequests(d); }
        else if (d.error && (d.error.indexOf('غير مصرح') >= 0)) { location.reload(); }
        else { showMsg($('req-msg'), d.error || 'خطأ.', 'err'); }
      })
      .catch(function () { showMsg($('req-msg'), 'تعذّر تحميل الطلبات.', 'err'); });
  }

  // تفويض أحداث عبر المستند (للأزرار داخل البطاقات)
  $('req-list').addEventListener('click', function (e) {
    const saveBtn = e.target.closest('.save-status');
    if (!saveBtn) return;
    const card = saveBtn.closest('.req-card');
    const id = card.dataset.id;
    const status = card.querySelector('.status-sel').value;
    saveBtn.disabled = true;
    saveBtn.textContent = 'حفظ…';
    clearMsg($('req-msg'));
    fetch('/api/admin/requests/' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: apiHeaders(true),
      body: JSON.stringify({ status: status })
    }).then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) {
          showMsg($('req-msg'), 'تم حفظ الحالة بنجاح: ' + status, 'ok');
          loadRequests(false);
        } else {
          saveBtn.disabled = false; saveBtn.textContent = 'حفظ الحالة';
          if (d.error && d.error.indexOf('غير مصرح') >= 0) location.reload();
          else showMsg($('req-msg'), d.error || 'تعذّر الحفظ.', 'err');
        }
      })
      .catch(function () { saveBtn.disabled = false; saveBtn.textContent = 'حفظ الحالة'; showMsg($('req-msg'), 'تعذّر الحفظ.', 'err'); });
  });

  $('status-filter').addEventListener('change', function () { reqFilter = this.value; loadRequests(true); });
  $('refresh-btn').addEventListener('click', function () { loadRequests(true); });

  // ===================== إدارة المنشورات =====================
  function loadAdminPosts() {
    fetch('/api/posts').then(function (r) { return r.json(); })
      .then(function (d) {
        if (!d.ok) { showMsg($('posts-msg'), d.error || 'خطأ.', 'err'); return; }
        const list = $('admin-posts-list');
        $('posts-total').textContent = 'العدد: ' + d.count;
        if (!d.posts.length) {
          list.innerHTML = '<div class="empty"><div class="big">🏠</div><h3>مفيش منشورات</h3></div>';
          return;
        }
        list.innerHTML = d.posts.map(function (p) {
          const thumb = p.coverImage
            ? '<img class="admin-thumb" src="' + esc(p.coverImage) + '" alt="">'
            : '<div class="admin-thumb ph">بدون صورة</div>';
          return '<div class="req-card" data-id="' + esc(p.id) + '">' +
            '<div class="rc-head">' + thumb +
            '<div><div class="rc-name">' + esc(p.title) + '</div>' +
            '<div class="small muted">📍 ' + esc(p.location) + (p.price ? ' — ' + esc(p.price) : '') + '</div></div>' +
            (p.type ? '<span class="chip chip-review">' + esc(p.type) + '</span>' : '') +
            '</div>' +
            '<div class="rc-actions">' +
              '<a class="btn btn-outline btn-sm" href="/detail.html?id=' + encodeURIComponent(p.id) + '" target="_blank" rel="noopener">عرض</a>' +
              '<button class="btn btn-ghost-danger btn-sm del-post" type="button">حذف</button>' +
            '</div></div>';
        }).join('');
      })
      .catch(function () { showMsg($('posts-msg'), 'تعذّر تحميل المنشورات.', 'err'); });
  }

  $('admin-posts-list').addEventListener('click', function (e) {
    const btn = e.target.closest('.del-post');
    if (!btn) return;
    const card = btn.closest('.req-card');
    const id = card.dataset.id;
    if (!confirm('حذف المنشور نهائيًا مع صوره؟')) return;
    btn.disabled = true;
    fetch('/api/admin/posts/' + encodeURIComponent(id), {
      method: 'DELETE',
      headers: apiHeaders(false)
    }).then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.ok) {
          showMsg($('posts-msg'), 'تم حذف المنشور.', 'ok');
          loadAdminPosts();
          loadStats();
        } else {
          btn.disabled = false;
          showMsg($('posts-msg'), d.error || 'تعذّر الحذف.', 'err');
        }
      })
      .catch(function () { btn.disabled = false; showMsg($('posts-msg'), 'تعذّر الحذف.', 'err'); });
  });

  $('refresh-posts-btn').addEventListener('click', function () { loadAdminPosts(); });

  // ---- تشغيل ----
  checkSession();
})();
