/* 登录 / 注册 */
(function () {
  'use strict';

  var params = new URLSearchParams(location.search);
  var next = params.get('next');
  var target = next && /^[\w.-]+(\.html)?(\?.*)?$/.test(next) ? next : 'index.html';

  var el = {
    form: document.getElementById('auth-form'),
    modeSwitch: document.getElementById('mode-switch'),
    rowPhone: document.getElementById('row-phone'),
    rowEmail: document.getElementById('row-email'),
    phone: document.getElementById('f-phone'),
    email: document.getElementById('f-email'),
    code: document.getElementById('f-code'),
    phoneError: document.getElementById('phone-error'),
    send: document.getElementById('btn-send'),
    submit: document.getElementById('btn-submit'),
    error: document.getElementById('form-error'),
    wechat: document.getElementById('btn-wechat')
  };

  var mode = 'phone';
  var pending = null;     // { value, verificationId, isExistingUser }
  var countdown = null;
  var busy = false;

  function showError(message) {
    el.error.textContent = message;
    el.error.classList.add('show');
  }
  function clearError() {
    el.error.textContent = '';
    el.error.classList.remove('show');
  }

  function setMode(nextMode) {
    mode = nextMode;
    pending = null;
    clearError();
    el.rowPhone.hidden = mode !== 'phone';
    el.rowEmail.hidden = mode !== 'email';
    el.phoneError.style.display = 'none';
    el.modeSwitch.querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-mode') === mode);
    });
    (mode === 'phone' ? el.phone : el.email).focus();
  }

  el.modeSwitch.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-mode]');
    if (btn) setMode(btn.getAttribute('data-mode'));
  });

  el.phone.addEventListener('input', function () {
    el.phoneError.style.display = 'none';
    clearError();
  });
  el.email.addEventListener('input', clearError);

  function currentValue() {
    return mode === 'phone' ? el.phone.value.trim() : el.email.value.trim();
  }

  function startCountdown() {
    var left = 60;
    el.send.disabled = true;
    el.send.textContent = left + 's 后重发';
    countdown = setInterval(function () {
      left -= 1;
      if (left <= 0) {
        clearInterval(countdown);
        countdown = null;
        el.send.disabled = false;
        el.send.textContent = '重新获取';
        return;
      }
      el.send.textContent = left + 's 后重发';
    }, 1000);
  }

  el.send.addEventListener('click', async function () {
    clearError();
    var value = currentValue();

    if (mode === 'phone') {
      if (!/^1\d{10}$/.test(value)) {
        el.phoneError.textContent = '请输入正确的 11 位手机号';
        el.phoneError.style.display = 'block';
        return;
      }
      el.phoneError.style.display = 'none';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      showError('请输入正确的邮箱地址');
      return;
    }

    el.send.disabled = true;
    el.send.textContent = '发送中…';
    try {
      var payload = mode === 'phone' ? { phone: value } : { email: value };
      var sent = await SY.cloud.auth.sendOtp(payload);
      if (sent.error) {
        el.send.disabled = false;
        el.send.textContent = '获取验证码';
        showError(sent.error.message || '验证码没能发出去，请稍后重试');
        return;
      }
      pending = {
        value: value,
        verificationId: sent.data.verificationId,
        isExistingUser: sent.data.isExistingUser
      };
      startCountdown();
      el.code.focus();
      SY.toast('验证码已发送');
    } catch (err) {
      el.send.disabled = false;
      el.send.textContent = '获取验证码';
      showError('网络异常，请稍后重试');
    }
  });

  el.form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (busy) return;
    clearError();

    var value = currentValue();
    var code = el.code.value.trim();

    if (!pending || pending.value !== value) {
      showError(mode === 'phone' ? '请先获取当前手机号的验证码' : '请先获取当前邮箱的验证码');
      return;
    }
    if (!/^\d{4,8}$/.test(code)) {
      showError('请输入收到的验证码');
      return;
    }

    busy = true;
    el.submit.disabled = true;
    el.submit.textContent = '验证中…';

    try {
      var payload = {
        verificationId: pending.verificationId,
        isExistingUser: pending.isExistingUser,
        token: code
      };
      if (mode === 'phone') payload.phone = pending.value;
      else payload.email = pending.value;

      var completed = await SY.cloud.auth.verifyOtp(payload);
      if (completed.error) {
        showError(completed.error.message || '验证码不正确，请重试');
        el.submit.disabled = false;
        el.submit.textContent = '登录 / 注册';
        busy = false;
        return;
      }
      var name = completed.data && completed.data.user ? completed.data.user.name : '';
      SY.toast(name ? '欢迎回来，' + name : '登录成功');
      el.submit.textContent = '正在进入…';
      setTimeout(function () { location.href = target; }, 320);
    } catch (err) {
      showError('网络异常，请稍后重试');
      el.submit.disabled = false;
      el.submit.textContent = '登录 / 注册';
      busy = false;
    }
  });

  el.wechat.addEventListener('click', async function () {
    clearError();
    el.wechat.disabled = true;
    try {
      var res = await SY.cloud.auth.signInWithOAuth({
        provider: 'wechat',
        redirectTo: location.origin + '/'
      });
      if (res.error) {
        el.wechat.disabled = false;
        showError(res.error.message || '微信登录暂时不可用');
        return;
      }
      location.assign(res.data.url);
    } catch (err) {
      el.wechat.disabled = false;
      showError('微信登录需要先发布到正式域名后使用');
    }
  });

  async function init() {
    await SY.boot();

    if (!SY.cloud) {
      showError('云服务没有连接成功，请检查网络后刷新。');
      el.submit.disabled = true;
      el.send.disabled = true;
      el.wechat.disabled = true;
      return;
    }

    if (SY.user) {
      location.replace(target);
      return;
    }
    if (SY.authError) showError(SY.authError);
    el.phone.focus();
  }

  init();
})();
