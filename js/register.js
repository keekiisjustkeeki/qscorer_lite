(function () {
  if (!QSCORER.guard('auth')) return;
  QSCORER.ui.init();

  // Toggle password visibility
  const toggle = document.querySelector('.toggle-pass');
  if (toggle) {
    toggle.onclick = () => {
      const i = toggle.previousElementSibling;
      if (i) { i.type = i.type === 'password' ? 'text' : 'password'; toggle.innerHTML = i.type === 'password' ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>'; }
    };
  }

  // Password strength indicator
  const pass = QSCORER.util.el('regPassword');
  if (pass) {
    pass.oninput = () => {
      const box = QSCORER.util.el('pwStrength'); if (!box) return;
      const v = pass.value; let s = 0;
      if (v.length >= 8) s++;
      if (/[a-zA-Z]/.test(v) && /[0-9]/.test(v)) s++;
      if (v.length >= 10) s++;
      if (/[^a-zA-Z0-9]/.test(v)) s++;
      box.className = 'pw-strength s' + s;
    };
  }

  // Register form (fields align with database.md User sheet: Username, Email, Phone, Password)
  const fm = QSCORER.util.el('authForm');
  if (fm) {
    fm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = QSCORER.util.el('authError');
      const fd = new FormData(fm);
      const payload = {
        username: fd.get('username'),
        email: fd.get('email'),
        phone: fd.get('phone'),
        password: fd.get('password')
      };
      showErr(err, '');
      if (!payload.username || !payload.email || !payload.phone || !payload.password) return showErr(err, 'Semua field wajib diisi');
      if (payload.password.length < 8) return showErr(err, 'Password minimal 8 karakter');
      if (!/[a-zA-Z]/.test(payload.password) || !/[0-9]/.test(payload.password)) return showErr(err, 'Password wajib kombinasi huruf dan angka');
      const btn = QSCORER.util.el('authSubmit');
      loading(btn, true);
      const res = await QSCORER.api.register(payload);
      loading(btn, false);
      if (res.status === 'error') return showErr(err, res.message);
      QSCORER.ui.toast('Pendaftaran berhasil, silakan masuk', 'success');
      setTimeout(() => location.href = 'index.html', 900);
    });
  }

  function showErr(el, msg) { if (!el) return; el.style.display = msg ? 'flex' : 'none'; el.textContent = msg; }
  function loading(btn, on) {
    if (!btn) return;
    if (on) { btn.dataset.orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Memproses...'; }
    else { btn.disabled = false; btn.innerHTML = btn.dataset.orig || btn.innerHTML; }
  }
})();
