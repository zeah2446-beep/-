/* «بيتك عندنا» — سلوكيات مشتركة: زر التواصل + المدخل المخفي (الضغط المطوّل) */
(function () {
  const CONTACT_DISPLAY = '01552099055';
  const TEL = 'tel:+201552099055';
  const WA = 'https://wa.me/201552099055';
  const LONG_PRESS_MS = 2000;
  const MOVE_TOLERANCE = 14;

  function buildContactFab() {
    if (document.getElementById('contact-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'contact-fab';
    fab.className = 'contact-fab';
    fab.type = 'button';
    fab.innerHTML =
      '<span class="fab-ico">📞</span>' +
      '<span class="fab-num">' + CONTACT_DISPLAY + '</span>';
    document.body.appendChild(fab);
    return fab;
  }

  function buildContactModal() {
    if (document.getElementById('contact-modal')) return;
    const veil = document.createElement('div');
    veil.className = 'modal-veil';
    veil.id = 'contact-modal';
    veil.innerHTML =
      '<div class="modal-box" role="dialog" aria-modal="true">' +
        '<button class="m-close" type="button" aria-label="إغلاق">&times;</button>' +
        '<h3>تواصل مع الإدارة</h3>' +
        '<p class="sub">اختار طريقة التواصل المناسبة معاك:</p>' +
        '<span class="contact-num">' + CONTACT_DISPLAY + '</span>' +
        '<div class="contact-opts">' +
          '<a class="btn btn-cream" href="' + TEL + '"><span class="ico">📱</span> اتصال هاتفي</a>' +
          '<a class="btn btn-whatsapp" target="_blank" rel="noopener" href="' + WA + '"><span class="ico">💬</span> واتساب</a>' +
        '</div>' +
        '<p class="secure-note">بياناتك دي للإدارة بس، ومش بتتشارك مع حد تاني.</p>' +
      '</div>';
    document.body.appendChild(veil);
    const close = () => veil.classList.remove('show');
    veil.addEventListener('click', function (e) { if (e.target === veil) close(); });
    veil.querySelector('.m-close').addEventListener('click', close);
    veil._close = close;
    return veil;
  }

  function openContact() {
    const veil = document.getElementById('contact-modal') || buildContactModal();
    veil.classList.add('show');
  }

  // ---- نافذة كلمة مرور الإدارة المخفية ----
  function buildPasswordModal() {
    if (document.getElementById('admin-pw-modal')) return;
    const veil = document.createElement('div');
    veil.className = 'modal-veil';
    veil.id = 'admin-pw-modal';
    veil.innerHTML =
      '<div class="modal-box" role="dialog" aria-modal="true">' +
        '<button class="m-close" type="button" aria-label="إغلاق">&times;</button>' +
        '<h3>دخول الإدارة</h3>' +
        '<p class="sub">أدخل كلمة المرور للمتابعة.</p>' +
        '<div id="pw-msg" class="msg"></div>' +
        '<form id="pw-form">' +
          '<div class="field"><input type="password" id="pw-input" autocomplete="off" placeholder="كلمة المرور" required></div>' +
          '<button class="btn btn-block" id="pw-submit" type="submit">دخول</button>' +
        '</form>' +
      '</div>';
    document.body.appendChild(veil);
    const close = () => { veil.classList.remove('show'); };
    veil.addEventListener('click', function (e) { if (e.target === veil) close(); });
    veil.querySelector('.m-close').addEventListener('click', close);
    veil._close = close;

    const form = veil.querySelector('#pw-form');
    const input = veil.querySelector('#pw-input');
    const submit = veil.querySelector('#pw-submit');
    const msg = veil.querySelector('#pw-msg');

    function showMsg(text, type) {
      msg.textContent = text || '';
      msg.className = 'msg show ' + (type === 'err' ? 'err' : 'ok');
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      const val = input.value;
      if (!val) { showMsg('أدخل كلمة المرور.', 'err'); return; }
      submit.disabled = true;
      submit.innerHTML = '<span class="spinner"></span> جارٍ التحقق...';
      showMsg('', '');
      fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: val })
      }).then(function (r) { return r.json().then(function (d) { return { status: r.status, d: d }; }); })
        .then(function (res) {
          if (res.d && res.d.ok) {
            sessionStorage.setItem('bc_csrf', res.d.csrf);
            window.location.href = '/admin.html';
          } else {
            submit.disabled = false;
            submit.textContent = 'دخول';
            showMsg((res.d && res.d.error) || 'كلمة المرور غير صحيحة.', 'err');
            input.value = '';
            input.focus();
          }
        })
        .catch(function () {
          submit.disabled = false;
          submit.textContent = 'دخول';
          showMsg('تعذّر الاتصال بالخادم. أعد المحاولة.', 'err');
        });
    });
    return veil;
  }

  function openAdminPassword() {
    const veil = document.getElementById('admin-pw-modal') || buildPasswordModal();
    const input = veil.querySelector('#pw-input');
    const msg = veil.querySelector('#pw-msg');
    msg.className = 'msg';
    input.value = '';
    veil.classList.add('show');
    setTimeout(function () { input.focus(); }, 60);
  }

  // ---- سلوك الزر (ضغطة عادية + ضغط مطوّل) ----
  function wireFab(fab) {
    let timer = null;
    let triggered = false;
    let start = { x: 0, y: 0 };

    function cancel() { if (timer) { clearTimeout(timer); timer = null; } }

    fab.addEventListener('pointerdown', function (e) {
      triggered = false;
      start = { x: e.clientX, y: e.clientY };
      cancel();
      timer = setTimeout(function () {
        triggered = true;
        cancel();
        navigator.vibrate && navigator.vibrate(60); // اهتزاز خفيف للموبايل
        openAdminPassword();
      }, LONG_PRESS_MS);
    });

    fab.addEventListener('pointermove', function (e) {
      if (!timer) return;
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.hypot(dx, dy) > MOVE_TOLERANCE) cancel();
    });

    function end() {
      const wasTriggered = triggered;
      cancel();
      // لو تم الضغط المطوّل، لا نفتح نافذة التواصل إطلاقًا
      if (wasTriggered) return;
      openContact();
    }
    fab.addEventListener('pointerup', end);
    fab.addEventListener('pointercancel', function () { cancel(); triggered = false; });

    // منع القائمة اليمنى / النقر الإضافي على الموبايل أثناء الضغط الطويل
    fab.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    // عند إلغاء اللمس بالتحرك للتمرير
    fab.addEventListener('touchmove', function (e) { e.preventDefault(); }, { passive: false });
  }

  // ---- قسم الروابط: روابط السوشيال ميديا (قراءة عامة — التعديل من الإدارة) ----
  const SOCIAL_ICONS = {
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.6-.8-1.8-.9-.3-.1-.5-.1-.7.1-.2.3-.8.9-1 1.1-.2.2-.4.2-.7.1-.3-.1-1.2-.4-2.3-1.4-1-.9-1.5-1.9-1.7-2.2-.2-.3 0-.5.1-.6.1-.1.3-.4.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.7-.9-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1 2.9 1.2 3.1c.1.2 2 3.1 4.9 4.3 1.8.7 2.5.8 3.4.7.5-.1 1.6-.7 1.8-1.3.2-.6.2-1.2.2-1.3 0-.1-.3-.2-.6-.3z"/><path d="M12 2a10 10 0 0 0-8.7 15L2 22l5.2-1.4A10 10 0 1 0 12 2zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>',
    gmail: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 4H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zm0 4.2-8 5.1L4 8.2V6l8 5.1L20 6z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 21v-8h2.7l.4-3.1h-3.1V7.9c0-.9.3-1.5 1.6-1.5h1.7V3.6c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4v2.4H7.8V13h2.7v8h3z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.8s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2-.1-1.3-.1-1.7-.1-4.8s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4 1.3-.1 1.7-.1 4.9-.1zm0 1.8c-3.1 0-3.5 0-4.8.1-1.1.1-1.5.2-1.8.3-.5.2-.8.4-1.1.7-.3.3-.5.6-.7 1.1-.1.3-.3.8-.3 1.8-.1 1.3-.1 1.6-.1 4.8s0 3.5.1 4.8c.1 1.1.2 1.5.3 1.8.2.5.4.8.7 1.1.3.3.6.5 1.1.7.3.1.8.3 1.8.3 1.3.1 1.6.1 4.8.1s3.5 0 4.8-.1c1.1-.1 1.5-.2 1.8-.3.5-.2.8-.4 1.1-.7.3-.3.5-.6.7-1.1.1-.3.3-.8.3-1.8.1-1.3.1-1.6.1-4.8s0-3.5-.1-4.8c-.1-1.1-.2-1.5-.3-1.8-.2-.5-.4-.8-.7-1.1-.3-.3-.6-.5-1.1-.7-.3-.1-.8-.3-1.8-.3-1.3-.1-1.6-.1-4.8-.1zm0 3.1a4.9 4.9 0 1 1 0 9.8 4.9 4.9 0 0 1 0-9.8zm0 8.1a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zm5-8.3a1.1 1.1 0 1 1-2.2 0 1.1 1.1 0 0 1 2.2 0z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.47l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93zm-1.29 19.5h2.04L6.49 3.24H4.3l13.31 17.41z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23.5 6.19a3.02 3.02 0 0 0-2.12-2.14C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.5A3.02 3.02 0 0 0 .5 6.19C0 8.07 0 12 0 12s0 3.93.5 5.81a3.02 3.02 0 0 0 2.12 2.14c1.88.5 9.38.5 9.38.5s7.5 0 9.38-.5a3.02 3.02 0 0 0 2.12-2.14C24 15.93 24 12 24 12s0-3.93-.5-5.81zM9.55 15.57V8.43L15.82 12l-6.27 3.57z"/></svg>',
    telegram: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11.94 0A12 12 0 1 0 24 12 12 12 0 0 0 11.94 0zm5.87 8.16-1.97 9.3c-.15.66-.54.82-1.09.51l-3-2.21-1.45 1.4c-.16.16-.3.3-.6.3l.21-3.05 5.56-5.02c.24-.21-.05-.33-.37-.12l-6.87 4.33-2.96-.93c-.64-.2-.66-.64.14-.95l11.57-4.46c.53-.19 1 .13.83.9z"/></svg>'
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function loadSocialLinks() {
    fetch('/api/site-links')
      .then(function (r) { return r.json(); })
      .then(function (d) {
        const links = (d && d.ok && d.links) ? d.links : [];
        renderSocialSection(links);
        renderFooterSocial(links);
      })
      .catch(function () { /* الشبكة مقفولة — القسم يختفي بهدوء */ });
  }

  // قسم «تابعنا» الكبير (الصفحة الرئيسية)
  function renderSocialSection(links) {
    const box = document.getElementById('social-section');
    if (!box) return;
    if (!links.length) { box.style.display = 'none'; return; }
    box.innerHTML =
      '<h3 class="section-title">تابعنا على السوشيال ميديا</h3>' +
      '<p class="muted small" style="margin:0 0 12px">تابع كل جديد عن الشقق والعروض على صفحاتنا الرسمية.</p>' +
      '<div class="social-grid">' +
        links.map(function (l) {
          const extra = String(l.url).indexOf('mailto:') === 0 ? '' : ' target="_blank" rel="noopener"';
          return '<a class="social-btn" href="' + esc(l.url) + '"' + extra + '>' +
            (SOCIAL_ICONS[l.id] || '') + '<span>' + esc(l.name) + '</span></a>';
        }).join('') +
      '</div>';
  }

  // شريط أيقونات صغير في فوتر كل الصفحات
  function renderFooterSocial(links) {
    const footer = document.querySelector('footer');
    if (!footer || !links.length || document.getElementById('footer-social')) return;
    const row = document.createElement('div');
    row.id = 'footer-social';
    row.className = 'footer-social';
    row.innerHTML =
      '<span class="footer-social-label">تابعنا:</span>' +
      links.map(function (l) {
        const extra = String(l.url).indexOf('mailto:') === 0 ? '' : ' target="_blank" rel="noopener"';
        return '<a href="' + esc(l.url) + '"' + extra + ' title="' + esc(l.name) + '" aria-label="' + esc(l.name) + '">' +
          (SOCIAL_ICONS[l.id] || '') + '</a>';
      }).join('');
    footer.insertBefore(row, footer.firstChild);
  }

  function init() {
    const fab = buildContactFab();
    wireFab(fab);
    buildContactModal();
    buildPasswordModal();
    loadSocialLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
