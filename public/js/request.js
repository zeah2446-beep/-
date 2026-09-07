/* نموذج «اطلب شقة» — بدون حساب */
(function () {
  const form = document.getElementById('req-form');
  const sendBtn = document.getElementById('send-btn');
  const msg = document.getElementById('msg');
  const formWrap = document.getElementById('form-wrap');
  const successWrap = document.getElementById('success-wrap');
  const refNum = document.getElementById('ref-num');

  let myToken = null;
  let currentSubmitKey = '';
  fetchToken();

  function showMsg(text, type) {
    msg.textContent = text || '';
    msg.className = 'msg show ' + (type === 'err' ? 'err' : 'ok');
  }
  function hideMsg() { msg.className = 'msg'; }

  // مفتاح إرسال من الخادم (مضاد لتكرار الطلب من نفس الصفحة)
  function fetchToken() {
    return fetch('/api/request-token').then(function (r) { return r.json(); }).then(function (d) {
      if (d && d.ok) { myToken = d.token; return true; }
      return false;
    }).catch(function () { return false; });
  }

  function digitsKey() {
    // مفتاح ثابت من قيم الحقول للمساعدة في منع التكرار (اختياري محلي)
    return '';
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (sendBtn.disabled) return;

    const name = form.name.value.trim();
    const phone = form.phone.value.trim();
    const area = form.area.value.trim();
    const budget = form.budget.value.trim();
    const description = form.description.value.trim();

    const key = [name, phone, area, budget, description].join('|');
    if (key === currentSubmitKey) {
      showMsg('الطلب ده اتساب بالفعل من الصفحة دي. حدّث الصفحة لو عايز تبعت طلب جديد.', 'err');
      return;
    }

    // تحقق محلي مبدئي (التحقّق النهائي على الخادم)
    if (name.length < 2) return fail('اكتب اسمك (حرفين على الأقل).');
    if (phone.length < 8) return fail('اكتب رقم تواصل صحيح.');
    if (area.length < 2) return fail('اكتب المنطقة أو الحي المطلوب.');
    if (budget.length < 2) return fail('اكتب الميزانية التقريبية.');
    if (description.length < 10) return fail('اكتب وصف ومواصفات الشقة المطلوبة (10 أحرف على الأقل).');

    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="spinner"></span> جارٍ الإرسال…';
    hideMsg();

    const ensureToken = myToken ? Promise.resolve(true) : fetchToken();

    ensureToken.then(function (hasToken) {
      if (!hasToken) throw new Error('notoken');
      currentSubmitKey = key;
      return fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name, phone: phone, area: area, budget: budget, description: description, token: myToken })
      });
    }).then(function (r) {
      return r.json().then(function (d) { return { status: r.status, d: d }; });
    }).then(function (res) {
      if (res.d && res.d.ok) {
        // نجاح فعلي بعد الحفظ على الخادم
        refNum.textContent = res.d.ref || '—';
        formWrap.style.display = 'none';
        successWrap.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        resetBtn();
        currentSubmitKey = '';
        myToken = null;
        fetchToken();
        showMsg((res.d && res.d.error) || 'لم يتم حفظ الطلب. حاول مجددًا.', 'err');
      }
    }).catch(function (err) {
      resetBtn();
      currentSubmitKey = '';
      myToken = null;
      fetchToken();
      if (err && err.message === 'notoken') {
        showMsg('تعذّر تجهيز النموذج. حدّث الصفحة وحاول تاني.', 'err');
      } else {
        showMsg('تعذّر الاتصال بالخادم أو انقطع الاتصال أثناء الحفظ. لم يتم تأكيد الحفظ — راجع بياناتك وحاول تاني.', 'err');
      }
    });
  });

  function fail(text) {
    showMsg(text, 'err');
    msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function resetBtn() {
    sendBtn.disabled = false;
    sendBtn.innerHTML = 'أرسل الطلب 📨';
  }
})();
