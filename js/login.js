(function () {
  // If already logged in, redirect to proper dashboard
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

// Guest session (continue as guest)
  const guestBtn = QSCORER.util.el('btnGuest');
  if (guestBtn) {
    guestBtn.onclick = () => {
      QSCORER.store.set({ Username: 'Guest', Role: 'GUEST', Email: '', Phone: '' });
      location.href = 'guest.html';
    };
  }
  const guestHero = QSCORER.util.el('btnGuestHero');
  if (guestHero) guestHero.onclick = () => guestBtn && guestBtn.click();

  // Scroll to login on hero button
  const toLogin = QSCORER.util.el('btnToLogin');
  if (toLogin) toLogin.onclick = () => {
    const auth = document.querySelector('.auth-wrap');
    if (auth) { window.scrollTo({ top: auth.offsetTop - 70, behavior: 'smooth' }); QSCORER.util.el('authForm').username.focus(); }
  };

  // ===== Visitor Preview (Blueprint #4 & #5) =====
  const VISKEY = 'qscorer_visitor_trial';
  function visitorUsed() { try { return localStorage.getItem(VISKEY) === '1'; } catch (e) { return false; } }
  function visitorMark() { try { localStorage.setItem(VISKEY, '1'); } catch (e) {} }

  async function loadVisitorPreview() {
    const statsBox = QSCORER.util.el('visitorStats');
    const leagueSel = QSCORER.util.el('visLeague');
    const homeSel = QSCORER.util.el('visHome');
    const awaySel = QSCORER.util.el('visAway');
    const runBtn = QSCORER.util.el('visRun');
if (!statsBox && !leagueSel) return; // not on visitor layout
try {
      // Muat paralel supaya cepat (kompatibel dgn backend lama maupun baru)
      const [statsRes, leagueRes, teamRes] = await Promise.all([
        statsBox ? QSCORER.api.request('getStatistics') : Promise.resolve({ status: 'error' }),
        leagueSel ? QSCORER.api.request('getLeagues') : Promise.resolve({ status: 'error' }),
        leagueSel ? QSCORER.api.request('getTeams') : Promise.resolve({ status: 'error' })
      ]);
      const stats = (statsRes && statsRes.status === 'ok' && statsRes.data) || [];
      const leagues = (leagueRes && leagueRes.status === 'ok' && leagueRes.data) || [];
      const teams = (teamRes && teamRes.status === 'ok' && teamRes.data) || [];
      // 1) Stats preview
      if (statsBox) {
        const st = stats[0] || {};
        statsBox.innerHTML = `
          <div class="grid g2" style="gap:12px">
            <div class="stat-card"><div class="stat-icon"><i class="fa-solid fa-file-lines"></i></div><div class="stat-num">${st.TotalPrediction || 0}</div><div class="stat-lbl">Total Prediction</div></div>
            <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#16a34a,#22c55e)"><i class="fa-solid fa-circle-check"></i></div><div class="stat-num" style="color:#86efac">${st.CorrectPrediction || 0}</div><div class="stat-lbl">Correct</div></div>
            <div class="stat-card"><div class="stat-icon" style="background:var(--grad-red)"><i class="fa-solid fa-circle-xmark"></i></div><div class="stat-num" style="color:#fca5a5">${st.WrongPrediction || 0}</div><div class="stat-lbl">Wrong</div></div>
            <div class="stat-card"><div class="stat-icon"><i class="fa-solid fa-gauge-high"></i></div><div class="stat-num">${st.Accuracy || 0}%</div><div class="stat-lbl">Akurasi</div></div>
          </div>
          <div class="input-hint" style="text-align:center;margin-top:14px">Statistik diperbarui otomatis dari data validasi.</div>`;
      }
      // 2) Trial form
      if (leagueSel) {
        leagueSel.innerHTML = '<option value="">-- Pilih Liga --</option>' + QSCORER.util.option(leagues, 'LeagueID', 'LeagueName');
        const fillTeams = (lid) => teams.filter(t => String(t.LeagueID) === String(lid));
        leagueSel.onchange = () => {
          const opts = fillTeams(leagueSel.value);
          homeSel.innerHTML = '<option value="">-- Kandang --</option>' + QSCORER.util.option(opts, 'TeamID', 'TeamName');
          awaySel.innerHTML = '<option value="">-- Tandang --</option>' + QSCORER.util.option(opts, 'TeamID', 'TeamName');
        };
        // Disable if already used
        if (visitorUsed()) {
          runBtn.disabled = true;
          runBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Percobaan Habis';
          leagueSel.disabled = true; homeSel.disabled = true; awaySel.disabled = true;
          const box = document.getElementById('visitorTrial');
          if (box) {
            const em = box.querySelector('.empty h3');
            if (em) em.textContent = 'Percobaan telah digunakan';
          }
        }
        runBtn.onclick = async () => {
          if (visitorUsed()) return QSCORER.ui.toast('Percobaan prediksi sudah habis', 'error');
          const league = leagueSel.value, home = homeSel.value, away = awaySel.value;
          if (!league) return QSCORER.ui.toast('Pilih liga terlebih dahulu', 'error');
          if (!home || !away) return QSCORER.ui.toast('Pilih tim kandang dan tandang', 'error');
          if (home === away) return QSCORER.ui.toast('Home dan Away tidak boleh sama', 'error');
          runBtn.disabled = true;
          runBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Menjalankan...';
          const hN = (teams.find(t => String(t.TeamID) === String(home)) || {}).TeamName || 'Home';
          const aN = (teams.find(t => String(t.TeamID) === String(away)) || {}).TeamName || 'Away';
          try {
// do not persist to DB: compute a local demo prediction
            await wait(1400);
            const odds = { HomeOdds: 2.0, DrawOdds: 3.2, AwayOdds: 3.5, OU_Line: 2.5 };
            const demo = QSCORER.engine.analyze({ teams, results: [], matches: [], odds: [odds] }, { HomeTeamID: home, AwayTeamID: away, MatchID: 'demo' });
            visitorMark();
            const box = QSCORER.util.el('visitorTrial');
            box.innerHTML = visitorResultHtml(demo, hN, aN);
            QSCORER.ui.toast('Hasil percobaan prediksi (tidak disimpan)', 'info');
          } catch (err) {
            QSCORER.ui.toast('Gagal menjalankan percobaan', 'error');
            runBtn.disabled = false;
            runBtn.innerHTML = '<i class="fa-solid fa-bolt"></i> Jalankan Percobaan';
          }
        };
      }
    } catch (e) {
      if (statsBox) statsBox.innerHTML = '<div class="empty"><h3>Gagal memuat preview</h3><p>' + QSCORER.util.esc(e.message || '') + '</p></div>';
    }
  }

  function visitorResultHtml(p, hN, aN) {
    const conf = Number(p.Confidence) || 0;
    const markets = [
      ['FT 1X2', p.FT_1X2, 'blue'], ['FT O/U', p.FT_OU, 'green'], ['FT Odd/Even', p.FT_OddEven, 'gold'],
      ['HT 1X2', p.HT_1X2, 'blue'], ['HT O/U', p.HT_OU, 'green']
    ];
    return `
      <div class="pred-hero">
        <div class="badge badge-blue"><i class="fa-solid fa-arrow-up-right-dots"></i> Hasil Percobaan</div>
        <div class="pred-pick">${QSCORER.util.esc(p.Recommendation || '-')}</div>
        <div class="pred-confidence"><div class="progress"><div class="progress-bar green shimmer" style="width:${conf}%"></div></div><div style="text-align:center;margin-top:6px;font-weight:800">${conf}% Confidence</div></div>
        <div style="color:var(--muted);margin-top:8px">${QSCORER.util.esc(hN)} vs ${QSCORER.util.esc(aN)}</div>
        <div style="margin-top:10px;color:var(--muted)">Skor HT: <b>${QSCORER.util.esc(p.HTScore || '-')}</b> · Skor FT: <b>${QSCORER.util.esc(p.FTScore || '-')}</b></div>
      </div>
      <div class="pred-market">
        ${markets.map(ms => `<div class="market-box"><div class="m-name">${ms[0]}</div><div class="m-val ${ms[2]}">${QSCORER.util.esc(ms[1])}</div></div>`).join('')}
      </div>
      <div class="input-hint" style="text-align:center;margin-top:14px">Ini hanya preview. Daftar/Guest untuk prediksi tersimpan & fitur lengkap.</div>`;
  }

  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  loadVisitorPreview();

  // Donate button
  const donate = QSCORER.util.el('btnDonate');
  if (donate) donate.onclick = () => QSCORER.ui.toast('Fitur donasi tersedia setelah login', 'info');

  // Login form
  const fm = QSCORER.util.el('authForm');
  if (fm) {
    fm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const err = QSCORER.util.el('authError');
const fd = new FormData(fm);
      const u = (fd.get('username') || '').trim(), p = fd.get('password');
      showErr(err, '');
      if (!u || !p) return showErr(err, 'Username dan password wajib diisi');
      const btn = QSCORER.util.el('authSubmit');
      loading(btn, true);
      const res = await QSCORER.api.login(u, p);
      loading(btn, false);
      if (res.status === 'error') return showErr(err, res.message);
      QSCORER.store.set(res.user);
      QSCORER.ui.toast('Selamat datang, ' + res.user.Username, 'success');
      location.href = res.user.Role === 'ADMIN' ? 'admin.html' : 'guest.html';
    });
  }

  function showErr(el, msg) { if (!el) return; el.style.display = msg ? 'flex' : 'none'; el.textContent = msg; }
  function loading(btn, on) {
    if (!btn) return;
    if (on) { btn.dataset.orig = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Memproses...'; }
    else { btn.disabled = false; btn.innerHTML = btn.dataset.orig || btn.innerHTML; }
  }
})();
