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

  function init() {
    const fab = buildContactFab();
    wireFab(fab);
    buildContactModal();
    buildPasswordModal();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else { init(); }
})();
