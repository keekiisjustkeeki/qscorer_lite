(function () {
  if (!QSCORER.guard('guest')) return;

QSCORER.ui.init();
  const app = { data: null, page: 'dashboard', selectedMatch: null };

  const NAV = [
    ['dashboard', 'fa-gauge-high', 'Dashboard'],
    ['prediction', 'fa-chart-line', 'Prediction'],
    ['search', 'fa-magnifying-glass', 'Search Match'],
    ['statistics', 'fa-square-poll-vertical', 'Statistics'],
    ['history', 'fa-clock-rotate-left', 'History'],
    ['view', 'fa-eye', 'View Prediction'],
    ['profile', 'fa-user', 'Profile']
  ];

  function renderNav() {
    const box = QSCORER.util.el('navLinks');
    const s = QSCORER.store.get() || {};
    box.innerHTML = NAV.map(n => `<a class="nav-link ${app.page === n[0] ? 'active' : ''}" data-nav="${n[0]}"><i class="fa-solid ${n[1]}"></i>${n[2]}</a>`).join('') +
      `<button class="btn btn-red btn-sm" id="btnLogout" style="margin-left:6px"><i class="fa-solid fa-right-from-bracket"></i></button>`;
    box.querySelectorAll('[data-nav]').forEach(a => a.onclick = (e) => { e.preventDefault(); showPage(a.dataset.nav); });
    const lg = QSCORER.util.el('btnLogout');
    if (lg) lg.onclick = logout;
    document.querySelectorAll('.nav-links').forEach(l => l.classList.remove('open'));
    QSCORER.util.el('year').textContent = new Date().getFullYear();
const donate = QSCORER.util.el('btnDonate');
    if (donate) donate.onclick = () => QSCORER.ui.donate();
    const toggle = QSCORER.util.el('navToggle');
    if (toggle) toggle.onclick = () => document.querySelector('.nav-links').classList.toggle('open');
  }

  function showPage(page) {
    app.page = page;
    renderNav();
    const main = QSCORER.util.el('main');
    main.scrollTop = 0; window.scrollTo({ top: 0 });
    if (page === 'dashboard') loadDashboard();
    else if (page === 'prediction') loadPrediction();
    else if (page === 'search') loadSearch();
    else if (page === 'view') loadView();
    else if (page === 'statistics') loadStatistics();
    else if (page === 'history') loadHistory();
    else if (page === 'profile') loadProfile();
  }

  // ===== DASHBOARD =====
  async function loadDashboard() {
    const main = QSCORER.util.el('main');
    main.innerHTML = '<div style="padding:40px">' + QSCORER.ui.loader('Menyiapkan dashboard...') + '</div>';
    try {
      const d = await fetchData();
      const st = (d.statistics && d.statistics[0]) || {};
      const s = QSCORER.store.get() || {};
      const preds = d.predictions || [];
      const results = d.results || [];
      const lastPred = preds.slice().reverse().find(p => {
        const r = results.find(x => String(x.MatchID) === String(p.MatchID));
        return r;
      });
      main.innerHTML = `
        <div class="container section">
          <div class="section-head"><div class="section-title"><span class="dot"></span> Dashboard</div><span class="badge badge-blue"><i class="fa-solid fa-robot"></i> KEEKI v2.5</span></div>
          <div class="card hero" style="text-align:center;padding:40px 20px">
            <div class="hero-badge"><i class="fa-solid fa-layer-group"></i> QSCORER Lite</div>
            <h1>Selamat datang, ${QSCORER.util.esc(s.Username || 'Guest')}!</h1>
            <p>Sistem pembelajaran prediksi sepak bola berbasis engine KEEKI v2.5 yang terus belajar dari data validasi hasil pertandingan.</p>
            <div class="hero-actions">
              <button class="btn btn-primary" data-go="prediction"><i class="fa-solid fa-bolt"></i> Buat Prediksi</button>
              <button class="btn btn-ghost" data-go="statistics"><i class="fa-solid fa-square-poll-vertical"></i> Statistik</button>
            </div>
          </div>
          <div class="grid g4" style="margin-top:24px">
            <div class="card stat-card"><div class="stat-icon"><i class="fa-solid fa-file-lines"></i></div><div class="stat-num">${st.TotalPrediction || 0}</div><div class="stat-lbl">Total Prediction</div></div>
            <div class="card stat-card"><div class="stat-icon"><i class="fa-solid fa-list-check"></i></div><div class="stat-num">${st.TotalValidated || 0}</div><div class="stat-lbl">Validated</div></div>
            <div class="card stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#16a34a,#22c55e)"><i class="fa-solid fa-circle-check"></i></div><div class="stat-num" style="color:#86efac">${st.CorrectPrediction || 0}</div><div class="stat-lbl">Correct</div></div>
            <div class="card stat-card"><div class="stat-icon" style="background:var(--grad-red)"><i class="fa-solid fa-circle-xmark"></i></div><div class="stat-num" style="color:#fca5a5">${st.WrongPrediction || 0}</div><div class="stat-lbl">Wrong</div></div>
          </div>
          <div class="card" style="margin-top:20px">
            <div class="card-title"><span class="card-icon"><i class="fa-solid fa-gauge-high"></i></span> Akurasi Keseluruhan</div>
            <div style="text-align:center;padding:20px"><div style="font-size:3.4rem;font-weight:900;background:linear-gradient(90deg,#22c55e,#86efac);background-clip:text;-webkit-background-clip:text;color:transparent">${st.Accuracy || 0}%</div><p style="color:var(--muted)">Persentase prediksi benar dari seluruh validasi.</p></div>
          </div>
        </div>`;
      const goBtn = main.querySelector('[data-go="prediction"]');
      if (goBtn) goBtn.onclick = () => showPage('prediction');
      const goSt = main.querySelector('[data-go="statistics"]');
      if (goSt) goSt.onclick = () => showPage('statistics');
    } catch (e) { main.innerHTML = errCard(e); }
  }

  function logout() {
    QSCORER.store.clear();
    location.href = 'index.html';
  }

  async function fetchData() {
    const res = await QSCORER.api.getFullData();
    if (res.status === 'error') throw new Error(res.message);
    app.data = res.data;
    return res.data;
  }

  // ===== PREDICTION =====
  async function loadPrediction() {
    const main = QSCORER.util.el('main');
    main.innerHTML = '<div style="padding:40px">' + QSCORER.ui.loader('Menyiapkan data prediksi...') + '</div>';
    try {
      const d = await fetchData();
      const leagues = d.leagues || [];
      const countries = d.countries || [];
      const continents = d.continents || [];
      app.selectedMatch = null;
      main.innerHTML = `
        <div class="container section">
          <div class="section-head"><div class="section-title"><span class="dot"></span> Prediksi Pertandingan</div><span class="badge badge-blue"><i class="fa-solid fa-robot"></i> KEEKI v2.5</span></div>
          <div class="grid g-2col">
            <div class="card anim-fade-up">
              <div class="card-title"><span class="card-icon"><i class="fa-solid fa-sliders"></i></span> Pilih Pertandingan</div>
${leagues.length ? `
              <div class="form-group"><label class="form-label">Cari Liga</label><div class="input-wrap"><i class="icon fa-solid fa-magnifying-glass"></i><input class="input" id="searchLeague" placeholder="Ketik nama liga untuk memfilter..."></div></div>
              <div class="form-group"><label class="form-label">League</label><select class="input no-icon" id="selLeague"><option value="">-- Pilih Liga --</option>${QSCORER.util.option(leagues, 'LeagueID', 'LeagueName')}</select></div>
<div class="form-group"><label class="form-label">Cari Tim Kandang</label><div class="input-wrap"><i class="icon fa-solid fa-magnifying-glass"></i><input class="input" id="searchHome" placeholder="Ketik nama tim kandang..."></div></div>
              <div class="form-group"><label class="form-label">Home Team</label><select class="input no-icon" id="selHome"><option value="">-- Pilih Tim Kandang --</option></select></div>
              <div class="form-group"><label class="form-label">Cari Tim Tandang</label><div class="input-wrap"><i class="icon fa-solid fa-magnifying-glass"></i><input class="input" id="searchAway" placeholder="Ketik nama tim tandang..."></div></div>
              <div class="form-group"><label class="form-label">Away Team</label><select class="input no-icon" id="selAway"><option value="">-- Pilih Tim Tandang --</option></select></div>
              <div class="form-group"><label class="form-label">Tanggal</label><input class="input no-icon" type="date" id="matchDate"></div>
              <button class="btn btn-primary btn-block" id="btnCheck"><i class="fa-solid fa-magnifying-glass"></i> Cek & Lanjutkan</button>
              ` : '<div class="empty"><h3>Belum ada liga</h3><p>Tunggu admin menambahkan data liga.</p></div>'}
            </div>
            <div>
              <div class="card anim-fade-up" style="animation-delay:.1s">
                <div class="card-title"><span class="card-icon"><i class="fa-solid fa-flask"></i></span> Hasil Analisa</div>
                <div id="predBox"><div class="empty"><div class="empty-icon"><i class="fa-solid fa-hand-pointer"></i></div><h3>Belum ada prediksi</h3><p>Pilih liga, tim, dan input odds.</p></div></div>
              </div>
            </div>
          </div>
        </div>`;
      QSCORER.util.el('matchDate').value = new Date().toISOString().substring(0, 10);
      bindPredictionSelects(d);
    } catch (e) {
      main.innerHTML = errCard(e);
    }
  }

function bindPredictionSelects(d) {
    const teams = d.teams || [];
    const leagues = d.leagues || [];
    const countries = d.countries || [];
    const selL = QSCORER.util.el('selLeague');
    const selH = QSCORER.util.el('selHome');
    const selA = QSCORER.util.el('selAway');
    const btn = QSCORER.util.el('btnCheck');
const searchL = QSCORER.util.el('searchLeague');
    const searchH = QSCORER.util.el('searchHome');
    const searchA = QSCORER.util.el('searchAway');
    // teamsInLeague: NATIONAL → hanya tim liga itu sendiri
    const teamsInLeague = (lid) => teams.filter(t => String(t.LeagueID) === String(lid));
// Resolver tim berdasarkan skala liga:
    //  - NATIONAL : tim dari liga tersebut (CountryID = negara)
    //  - CONTINENTAL : semua tim dari liga yg negaranya satu benua. CountryID liga
    //    diisi ID benua (mis. CONT003 = Eropa) sehingga ambil semua liga benua itu.
    //  - UNIVERSAL : semua tim di database (tidak terbatas negara/benua)
    const getTeamsForLeague = (lid) => {
      if (!lid) return teams;
      const lg = leagues.find(l => String(l.LeagueID) === String(lid));
      const scale = String((lg && lg.LeagueScale) || 'NATIONAL').toUpperCase();
      if (scale === 'UNIVERSAL') return teams.slice();
      if (scale === 'CONTINENTAL') {
        // CountryID pada liga CONTINENTAL menyimpan ID benua
        const continentId = lg && lg.CountryID ? String(lg.CountryID) : null;
        if (!continentId) return teamsInLeague(lid); // fallback hanya liga itu
        // semua liga yang negaranya berada di benua yang sama
        const sameContinentLeagues = leagues.filter(ol => {
          const oc = countries.find(c => String(c.CountryID) === String(ol.CountryID));
          return oc && String(oc.ContinentID) === String(continentId);
        });
        const ids = sameContinentLeagues.map(ol => String(ol.LeagueID));
        return teams.filter(t => ids.indexOf(String(t.LeagueID)) >= 0);
      }
      // NATIONAL (default)
      return teamsInLeague(lid);
    };
    // Search filter untuk liga — pangkas opsi dropdown liga sesuai kata kunci
    if (searchL) {
      searchL.oninput = () => {
        const q = (searchL.value || '').toLowerCase().trim();
        const filtered = q ? leagues.filter(l => (l.LeagueName || '').toLowerCase().indexOf(q) >= 0) : leagues;
        selL.innerHTML = '<option value="">-- Pilih Liga --</option>' + QSCORER.util.option(filtered, 'LeagueID', 'LeagueName');
      };
    }
// Search filter hub (untuk home & away) — pangkas opsi sesuai kata kunci masing-masing
    const fillHome = () => {
      const q = (searchH.value || '').toLowerCase().trim();
      let base = selL.value ? getTeamsForLeague(selL.value) : teams;
      const filtered = q ? base.filter(t => (t.TeamName || '').toLowerCase().indexOf(q) >= 0) : base;
      selH.innerHTML = '<option value="">-- Pilih Tim Kandang --</option>' + QSCORER.util.option(filtered, 'TeamID', 'TeamName');
    };
    const fillAway = () => {
      const q = (searchA.value || '').toLowerCase().trim();
      let base = selL.value ? getTeamsForLeague(selL.value) : teams;
      const filtered = q ? base.filter(t => (t.TeamName || '').toLowerCase().indexOf(q) >= 0) : base;
      selA.innerHTML = '<option value="">-- Pilih Tim Tandang --</option>' + QSCORER.util.option(filtered, 'TeamID', 'TeamName');
    };
    if (searchH) searchH.oninput = fillHome;
    if (searchA) searchA.oninput = fillAway;
    selL.onchange = () => {
      const opts = getTeamsForLeague(selL.value);
      selH.innerHTML = '<option value="">-- Pilih Tim Kandang --</option>' + QSCORER.util.option(opts, 'TeamID', 'TeamName');
      selA.innerHTML = '<option value="">-- Pilih Tim Tandang --</option>' + QSCORER.util.option(opts, 'TeamID', 'TeamName');
      // kosongkan pencarian tim agar tidak membatasi liga baru
      if (searchH) searchH.value = '';
      if (searchA) searchA.value = '';
    };
    btn.onclick = async () => {
      const box = QSCORER.util.el('predBox');
      const league = selL.value, home = selH.value, away = selA.value, date = QSCORER.util.el('matchDate').value;
      if (!league) return QSCORER.ui.toast('Pilih liga terlebih dahulu', 'error');
      if (!home || !away) return QSCORER.ui.toast('Pilih tim kandang dan tandang', 'error');
      if (home === away) return QSCORER.ui.toast('Home dan Away tidak boleh sama', 'error');
      if (!date) return QSCORER.ui.toast('Pilih tanggal pertandingan', 'error');
      const [hN, aN] = [((teams.find(t => String(t.TeamID) === String(home)) || {}).TeamName), ((teams.find(t => String(t.TeamID) === String(away)) || {}).TeamName)];
      // Check existing prediction
      const match = (d.matches || []).find(m => String(m.HomeTeamID) === String(home) && String(m.AwayTeamID) === String(away) && String(m.LeagueID) === String(league));
      const existingPred = match ? (d.predictions || []).find(p => String(p.MatchID) === String(match.MatchID)) : null;
      if (existingPred) {
        box.innerHTML = `
          <div class="pred-hero"><span class="badge badge-gold"><i class="fa-solid fa-circle-info"></i> Sudah Diprediksi</span>
          <p style="color:var(--muted);margin-top:12px">Pertandingan <b>${QSCORER.util.esc(hN)} vs ${QSCORER.util.esc(aN)}</b> sudah memiliki prediksi.<br>Tidak dapat membuat prediksi ulang.</p>
          <div style="margin-top:16px"><button class="btn btn-primary btn-sm" data-go="view">Lihat Prediksi</button></div></div>`;
        box.querySelector('[data-go="view"]').onclick = () => showPage('view');
        return;
      }
      // Show odds input — field mengikuti kolom sheet "Odds" di database.md
      box.innerHTML = `<div class="empty"><div class="empty-icon"><i class="fa-solid fa-arrows-rotate"></i></div>
        <h3>${QSCORER.util.esc(hN)} vs ${QSCORER.util.esc(aN)}</h3>
        <p>Masukkan odds (mengikuti kolom sheet Odds) lalu jalankan engine KEEKI.</p></div>
        <div style="margin-top:10px">
          <div class="card-title" style="font-size:.9rem;margin-top:12px"><i class="fa-solid fa-flag"></i> FT 1X2</div>
          <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:10px">
            <div><label class="form-label">Home Odds</label><input class="input no-icon" id="oHome" type="number" step="0.01" min="1.01" value="2.00"></div>
            <div><label class="form-label">Draw Odds</label><input class="input no-icon" id="oDraw" type="number" step="0.01" min="1.01" value="3.20"></div>
            <div><label class="form-label">Away Odds</label><input class="input no-icon" id="oAway" type="number" step="0.01" min="1.01" value="3.50"></div>
          </div>

          <div class="card-title" style="font-size:.9rem;margin-top:16px"><i class="fa-solid fa-scale-balanced"></i> FT Handicap</div>
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
            <div><label class="form-label">HDP Home</label><input class="input no-icon" id="oHdpHome" type="number" step="0.25" value="-0.5"></div>
            <div><label class="form-label">HDP Away</label><input class="input no-icon" id="oHdpAway" type="number" step="0.25" value="0.5"></div>
            <div><label class="form-label">HDP Home Odds</label><input class="input no-icon" id="oHdpHomeOdds" type="number" step="0.01" min="1.01" value="1.90"></div>
            <div><label class="form-label">HDP Away Odds</label><input class="input no-icon" id="oHdpAwayOdds" type="number" step="0.01" min="1.01" value="1.90"></div>
          </div>

          <div class="card-title" style="font-size:.9rem;margin-top:16px"><i class="fa-solid fa-greater-than"></i> FT Over / Under</div>
          <div class="grid" style="grid-template-columns:1fr 1fr 1fr;gap:10px">
            <div><label class="form-label">OU Line</label><input class="input no-icon" id="oOULine" type="number" step="0.25" value="2.5"></div>
            <div><label class="form-label">Over Odds</label><input class="input no-icon" id="oOverOdds" type="number" step="0.01" min="1.01" value="1.90"></div>
            <div><label class="form-label">Under Odds</label><input class="input no-icon" id="oUnderOdds" type="number" step="0.01" min="1.01" value="1.90"></div>
          </div>

          <div class="card-title" style="font-size:.9rem;margin-top:16px"><i class="fa-solid fa-shuffle"></i> FT Odd / Even</div>
          <div class="grid" style="grid-template-columns:1fr 1fr;gap:10px">
            <div><label class="form-label">Odd Odds</label><input class="input no-icon" id="oOddOdds" type="number" step="0.01" min="1.01" value="1.90"></div>
            <div><label class="form-label">Even Odds</label><input class="input no-icon" id="oEvenOdds" type="number" step="0.01" min="1.01" value="1.90"></div>
          </div>
        </div>
        <div style="margin-top:16px"><button class="btn btn-primary btn-block" id="btnRun"><i class="fa-solid fa-bolt"></i> Jalankan KEEKI Engine</button></div>`;
      const run = QSCORER.util.el('btnRun');
      run.onclick = async () => runEngineFlow({ league, home, away, date, hN, aN });
    };
  }

async function runEngineFlow(sel) {
    const box = QSCORER.util.el('predBox');
    // BACA DULU nilai odds dari input SEBELUM loader mengganti innerHTML predBox
    // (mencegah input hilang sehingga odds tersimpan kosong).
    const gv = (id) => { const el = document.getElementById(id); return el ? el.value : ''; };
    sel.odds = sel.odds || {};
    sel.odds.HomeOdds = gv('oHome');
    sel.odds.DrawOdds = gv('oDraw');
    sel.odds.AwayOdds = gv('oAway');
    sel.odds.HDPHome = gv('oHdpHome');
    sel.odds.HDPAway = gv('oHdpAway');
    sel.odds.HDPHomeOdds = gv('oHdpHomeOdds');
    sel.odds.HDPAwayOdds = gv('oHdpAwayOdds');
    sel.odds.OU_Line = gv('oOULine');
    sel.odds.OverOdds = gv('oOverOdds');
    sel.odds.UnderOdds = gv('oUnderOdds');
    sel.odds.OddOdds = gv('oOddOdds');
    sel.odds.EvenOdds = gv('oEvenOdds');
    // loading process steps
    const steps = [
      'Menyimpan Data & Odds...',
      'Analyzing Match Data...',
      'Checking Team Performance...',
      'Calculating Odds Value...',
      'Running KEEKI Engine...',
      'Generating Prediction...'
    ];
    for (const st of steps) {
      box.innerHTML = '<div style="padding:30px;text-align:center">' + QSCORER.ui.loader(st) + '</div>';
      await wait(550);
    }
try {
      // Create match — backend returns matchId; fallback to reload if not provided
      const mk = await QSCORER.api.addMatch({ LeagueID: sel.league, Date: sel.date, HomeTeamID: sel.home, AwayTeamID: sel.away, Status: 'UPCOMING' });
      if (mk.status === 'error') throw new Error(mk.message);
let match = { MatchID: mk.matchId, LeagueID: sel.league, Date: sel.date, HomeTeamID: sel.home, AwayTeamID: sel.away, Status: 'UPCOMING' };
      if (!match.MatchID) {
        // fallback untuk backend versi lama: reload full data lalu cari match yang baru dibuat
        const d = await fetchData();
        const found = (d.matches || []).filter(m => String(m.HomeTeamID) === String(sel.home) && String(m.AwayTeamID) === String(sel.away) && String(m.LeagueID) === String(sel.league));
        // prefer tanggal sama; jika tidak ada yang cocok tanggal, ambil yang terbaru
        match = found.find(m => String(m.Date).substring(0,10) === String(sel.date).substring(0,10)) || found[found.length - 1];
      }
      if (!match || !match.MatchID) throw new Error('Match tidak ditemukan setelah dibuat. Coba lagi / muat ulang halaman.');
// Add odds — kirim semua field sesuai kolom sheet "Odds" di database.md
      const odds = await QSCORER.api.addOdds({
        MatchID: match.MatchID,
        HomeOdds: sel.odds.HomeOdds,
        DrawOdds: sel.odds.DrawOdds,
        AwayOdds: sel.odds.AwayOdds,
        HDPHome: sel.odds.HDPHome,
        HDPAway: sel.odds.HDPAway,
        HDPHomeOdds: sel.odds.HDPHomeOdds,
        HDPAwayOdds: sel.odds.HDPAwayOdds,
        OU_Line: sel.odds.OU_Line,
        OverOdds: sel.odds.OverOdds,
        UnderOdds: sel.odds.UnderOdds,
        OddOdds: sel.odds.OddOdds,
        EvenOdds: sel.odds.EvenOdds
      });
if (odds.status === 'error') throw new Error(odds.message);
      // Run engine (simpan prediksi di backend sebagai baseline/learning)
      const res = await QSCORER.api.runEngine(match.MatchID);
      if (res.status === 'error') throw new Error(res.message);
      // Hitung ulang prediksi secara KONSISTEN di sisi client memakai engine KEEKI,
      // agar semua market selaras dengan prediksi skor (1-1 → DRAW, EVEN, UNDER, dst.)
      let pred = res.prediction;
      try {
        const full = await fetchData();
        const matchObj = (full.matches || []).find(m => String(m.MatchID) === String(match.MatchID)) || match;
        pred = QSCORER.engine.analyze(full, matchObj);
      } catch (e) { /* fallback: tetap pakai hasil backend */ }
QSCORER.ui.toast('Hasil Prediksi Selesai', 'success');
      box.innerHTML = '<div style="padding:20px">' + predResultHtml(match, pred, sel.hN, sel.aN);
    } catch (e) {
      box.innerHTML = '<div class="card"><h3 style="color:var(--red-400)">Gagal membuat prediksi</h3><p style="color:var(--muted)">' + QSCORER.util.esc(e.message) + '</p></div>';
    }
  }

function predResultHtml(match, p, hN, aN) {
    const conf = Number(p.Confidence) || 0;
    const prob = p.probabilities || {};
    // markets berisi per-market confidence (dari engine); fallback ke mapping per-field
    const mkt = (p.markets && p.markets.length) ? p.markets : [
      { label: 'FT 1X2', value: p.FT_1X2 },
      { label: 'FT HDP', value: p.FT_HDP },
      { label: 'FT O/U', value: p.FT_OU },
      { label: 'FT Odd/Even', value: p.FT_OddEven },
      { label: 'HT 1X2', value: p.HT_1X2 },
      { label: 'HT HDP', value: p.HT_HDP },
      { label: 'HT O/U', value: p.HT_OU }
    ].map(ms => ({ label: ms.label, value: ms.value, prob: conf }));
    const color = (label) => {
      if (label.indexOf('HDP') >= 0) return 'red';
      if (label.indexOf('O/U') >= 0) return 'green';
      if (label.indexOf('Odd/Even') >= 0) return 'gold';
      return 'blue';
    };
    return `
      <div class="pred-hero">
        <div class="badge badge-blue"><i class="fa-solid fa-arrow-up-right-dots"></i> Rekomendasi Engine</div>
        <div class="pred-pick">${QSCORER.util.esc(p.Recommendation || '-')}</div>
        <div class="pred-confidence"><div class="progress"><div class="progress-bar green shimmer" style="width:${conf}%"></div></div><div style="text-align:center;margin-top:6px;font-weight:800">${conf}% Confidence</div></div>
        <div style="color:var(--muted);margin-top:8px">${QSCORER.util.esc(hN)} vs ${QSCORER.util.esc(aN)}</div>
      </div>
      <div class="pred-score" style="margin-top:16px">
        <div class="score-box"><div class="s-label">Prediksi Skor HT</div><div class="s-val blue">${QSCORER.util.esc(p.HTScore || '0-0')}</div></div>
        <div class="score-box"><div class="s-label">Prediksi Skor FT</div><div class="s-val green">${QSCORER.util.esc(p.FTScore || '0-0')}</div></div>
      </div>
      <div style="margin-top:10px;text-align:center;color:var(--muted);font-size:.82rem">Probabilitas terjadinya skor <b>${QSCORER.util.esc(p.FTScore || '0-0')}</b> ≈ <b>${p.ScoreProb != null ? p.ScoreProb : 0}%</b></div>
<div class="pred-market" style="margin-top:20px">
        ${mkt.map(ms => `<div class="market-box"><div class="m-name">${QSCORER.util.esc(ms.label)}</div><div class="m-val ${color(ms.label)}">${QSCORER.util.esc(ms.value)}</div><div class="m-conf"><div class="progress" style="height:6px"><div class="progress-bar ${Number(ms.prob) >= 55 ? 'green' : 'red'}" style="width:${Math.min(100, Number(ms.prob) || 0)}%"></div></div><div style="font-size:.72rem;font-weight:700;margin-top:3px">${Math.round(Number(ms.prob) || 0)}%</div></div></div>`).join('')}
      </div>
      <div style="margin-top:20px">
        <div class="card-title" style="font-size:.95rem"><i class="fa-solid fa-chart-pie"></i> Probabilitas Home · Draw · Away</div>
        <div class="pred-market" style="grid-template-columns:1fr 1fr 1fr">
          <div class="market-box"><div class="m-name">Home</div><div class="m-val green">${prob.home || 0}%</div></div>
          <div class="market-box"><div class="m-name">Draw</div><div class="m-val">${prob.draw || 0}%</div></div>
          <div class="market-box"><div class="m-name">Away</div><div class="m-val red">${prob.away || 0}%</div></div>
        </div>
      </div>`;
  }

  // ===== SEARCH =====
  async function loadSearch() {
    const main = QSCORER.util.el('main');
    main.innerHTML = `
      <div class="container section">
        <div class="section-head"><div class="section-title"><span class="dot"></span> Search Match</div></div>
        <div class="search-bar"><div class="input-wrap"><i class="icon fa-solid fa-magnifying-glass"></i><input class="input" id="searchInput" placeholder="Cari tim atau liga..."></div><button class="btn btn-primary" id="searchBtn"><i class="fa-solid fa-magnifying-glass"></i> Cari</button></div>
        <div id="searchResults"><div class="card"><div class="empty"><div class="empty-icon"><i class="fa-solid fa-magnifying-glass"></i></div><h3>Cari pertandingan</h3><p>Hasil pencarian akan tampil di sini.</p></div></div></div>
      </div>`;
    try { await fetchData(); } catch (e) { }
    const input = QSCORER.util.el('searchInput'), btn = QSCORER.util.el('searchBtn');
    const doSearch = () => {
      const q = (input.value || '').toLowerCase();
      const box = QSCORER.util.el('searchResults');
      const d = app.data || {};
      const teams = d.teams || [], leagues = d.leagues || [];
      const matches = (d.matches || []).filter(m => {
        if (!q) return true;
        const h = ((teams.find(t => String(t.TeamID) === String(m.HomeTeamID)) || {}).TeamName || '').toLowerCase();
        const a = ((teams.find(t => String(t.TeamID) === String(m.AwayTeamID)) || {}).TeamName || '').toLowerCase();
        const lg = ((leagues.find(l => String(l.LeagueID) === String(m.LeagueID)) || {}).LeagueName || '').toLowerCase();
        return h.includes(q) || a.includes(q) || lg.includes(q);
      });
      if (!matches.length) { box.innerHTML = '<div class="card"><div class="empty"><div class="empty-icon"><i class="fa-solid fa-face-frown"></i></div><h3>Tidak ditemukan</h3><p>Coba kata kunci lain.</p></div></div>'; return; }
      box.innerHTML = '<div class="grid g3">' + matches.map(m => matchCard(m, d)).join('') + '</div>';
    };
    btn.onclick = doSearch;
    input.onkeyup = (e) => e.key === 'Enter' && doSearch();
    doSearch();
  }

  function matchCard(m, d) {
    const teams = d.teams || [];
    const odds = (d.odds || []).find(o => String(o.MatchID) === String(m.MatchID));
    const h = ((teams.find(t => String(t.TeamID) === String(m.HomeTeamID)) || {}).TeamName) || 'Home';
    const a = ((teams.find(t => String(t.TeamID) === String(m.AwayTeamID)) || {}).TeamName) || 'Away';
    const pred = (d.predictions || []).find(p => String(p.MatchID) === String(m.MatchID));
    return `
      <div class="match-card">
        <div class="match-top"><span>${QSCORER.util.esc(m.LeagueID || '')}</span><span>${QSCORER.util.fmtDate(m.Date)}</span></div>
        <div class="match-teams"><div class="match-team"><div class="name">${QSCORER.util.esc(h)}</div></div><div class="match-vs">VS</div><div class="match-team"><div class="name">${QSCORER.util.esc(a)}</div></div></div>
        <div class="match-odds">
          <span class="odds-chip">1 <b>${odds ? odds.HomeOdds : '-'}</b></span>
          <span class="odds-chip">X <b>${odds ? odds.DrawOdds : '-'}</b></span>
          <span class="odds-chip">2 <b>${odds ? odds.AwayOdds : '-'}</b></span>
        </div>
        <div style="margin-top:12px;text-align:center">${pred ? '<span class="badge badge-blue">Prediksi: ' + QSCORER.util.esc(pred.Recommendation) + '</span>' : '<span class="badge badge-gold">Belum diprediksi</span>'}</div>
      </div>`;
  }

  // ===== VIEW PREDICTION =====
  async function loadView() {
    const main = QSCORER.util.el('main');
    main.innerHTML = '<div style="padding:40px">' + QSCORER.ui.loader('Memuat prediksi...') + '</div>';
    try {
      const d = await fetchData();
      const preds = d.predictions || [];
      main.innerHTML = `
        <div class="container section">
          <div class="section-head"><div class="section-title"><span class="dot"></span> View Prediction</div><span class="badge badge-blue"><i class="fa-solid fa-eye"></i> Prediksi tersimpan</span></div>
          <div class="card" style="margin-bottom:16px">
            <div class="grid g-2col" style="gap:14px">
              <div class="form-group" style="margin-bottom:0"><label class="form-label">Filter Tanggal (Pilih Hari)</label><input class="input no-icon" type="date" id="vpDate"></div>
              <div class="form-group" style="margin-bottom:0"><label class="form-label">Cari Liga / Tim</label><div class="input-wrap"><i class="icon fa-solid fa-magnifying-glass"></i><input class="input" id="vpSearch" placeholder="Cari nama liga atau tim..."></div></div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px;align-items:center">
              <button class="btn btn-primary btn-sm" id="vpToday">Hari Ini</button>
              <button class="btn btn-ghost btn-sm" id="vpAll">Semua Tanggal</button>
              <span style="margin-left:auto;color:var(--muted);font-size:.84rem" id="vpCount"></span>
            </div>
          </div>
          <div class="card"><div class="table-wrap"><table class="table">
            <thead><tr><th>Tanggal</th><th>Liga</th><th>Pertandingan</th><th>FT 1X2</th><th>FT HDP</th><th>FT O/U</th><th>Rekomendasi</th><th>Confidence</th></tr></thead>
            <tbody id="vpBody"></tbody></table></div></div>
        </div>`;
      // Default filter = tanggal real-time hari ini
      const today = new Date().toISOString().substring(0, 10);
      const dateEl = QSCORER.util.el('vpDate');
      const searchEl = QSCORER.util.el('vpSearch');
      dateEl.value = today;
      const applyFilter = () => {
        const q = (searchEl.value || '').toLowerCase().trim();
        const chosenDate = dateEl.value;
        const filtered = preds.slice().reverse().filter(p => {
          const m = (d.matches || []).find(x => String(x.MatchID) === String(p.MatchID));
          // Date filter
          if (chosenDate) {
            const md = m ? String(m.Date).substring(0, 10) : '';
            if (md !== chosenDate) return false;
          }
          // Search filter
          if (q) {
            const lg = ((d.leagues || []).find(l => m && String(l.LeagueID) === String(m.LeagueID)) || {}).LeagueName || '';
            const h = ((d.teams || []).find(t => m && String(t.TeamID) === String(m.HomeTeamID)) || {}).TeamName || '';
            const a = ((d.teams || []).find(t => m && String(t.TeamID) === String(m.AwayTeamID)) || {}).TeamName || '';
            if ((lg + ' ' + h + ' ' + a).toLowerCase().indexOf(q) < 0) return false;
          }
          return true;
        });
        const rows = filtered.map(p => {
          const m = (d.matches || []).find(x => String(x.MatchID) === String(p.MatchID));
          const lg = ((d.leagues || []).find(l => m && String(l.LeagueID) === String(m.LeagueID)) || {}).LeagueName || '-';
          const h = ((d.teams || []).find(t => m && String(t.TeamID) === String(m.HomeTeamID)) || {}).TeamName || 'Home';
          const a = ((d.teams || []).find(t => m && String(t.TeamID) === String(m.AwayTeamID)) || {}).TeamName || 'Away';
          return `<tr><td>${QSCORER.util.fmtDate(m ? m.Date : '')}</td><td><span class="badge badge-blue">${QSCORER.util.esc(lg)}</span></td><td><b>${QSCORER.util.esc(h + ' vs ' + a)}</b></td><td><span class="badge badge-gold">${QSCORER.util.esc(p.FT_1X2)}</span></td><td>${QSCORER.util.esc(p.FT_HDP || '-')}</td><td><span class="badge badge-green">${QSCORER.util.esc(p.FT_OU)}</span></td><td><span class="badge badge-gold">${QSCORER.util.esc(p.Recommendation)}</span></td><td><b>${p.Confidence}%</b></td></tr>`;
        }).join('');
        QSCORER.util.el('vpBody').innerHTML = rows || '<tr><td colspan="8" style="text-align:center;color:var(--muted)">Tidak ada prediksi pada tanggal/filter ini</td></tr>';
        QSCORER.util.el('vpCount').textContent = filtered.length + ' prediksi';
        if (!preds.length) QSCORER.util.el('vpCount').textContent = 'Belum ada prediksi';
      };
      dateEl.onchange = applyFilter;
      searchEl.oninput = applyFilter;
      QSCORER.util.el('vpToday').onclick = () => { dateEl.value = today; applyFilter(); };
      QSCORER.util.el('vpAll').onclick = () => { dateEl.value = ''; applyFilter(); };
      if (!preds.length) { QSCORER.util.el('vpBody').innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted)">Belum ada prediksi. Buat prediksi di menu Prediction.</td></tr>'; QSCORER.util.el('vpCount').textContent = '0 prediksi'; return; }
      applyFilter();
    } catch (e) { main.innerHTML = errCard(e); }
  }

  // ===== STATISTICS =====
  async function loadStatistics() {
    const main = QSCORER.util.el('main');
    main.innerHTML = '<div style="padding:40px">' + QSCORER.ui.loader('Menghitung statistik...') + '</div>';
    try {
      const d = await fetchData();
      const st = (d.statistics && d.statistics[0]) || {};
      const totalPred = st.TotalPrediction || 0, totalValid = st.TotalValidated || 0, correct = st.CorrectPrediction || 0, wrong = st.WrongPrediction || 0, acc = st.Accuracy || 0;
      main.innerHTML = `
        <div class="container section">
          <div class="section-head"><div class="section-title"><span class="dot"></span> Statistics</div><span class="badge badge-blue"><i class="fa-solid fa-rotate"></i> Update otomatis</span></div>
          <div class="grid g4">
            <div class="card stat-card anim-fade-up"><div class="stat-icon"><i class="fa-solid fa-file-lines"></i></div><div class="stat-num">${totalPred}</div><div class="stat-lbl">Total Prediction</div></div>
            <div class="card stat-card anim-fade-up" style="animation-delay:.1s"><div class="stat-icon"><i class="fa-solid fa-list-check"></i></div><div class="stat-num">${totalValid}</div><div class="stat-lbl">Validated</div></div>
            <div class="card stat-card anim-fade-up" style="animation-delay:.2s"><div class="stat-icon" style="background:linear-gradient(135deg,#16a34a,#22c55e)"><i class="fa-solid fa-circle-check"></i></div><div class="stat-num" style="color:#86efac">${correct}</div><div class="stat-lbl">Correct</div></div>
            <div class="card stat-card anim-fade-up" style="animation-delay:.3s"><div class="stat-icon" style="background:var(--grad-red)"><i class="fa-solid fa-circle-xmark"></i></div><div class="stat-num" style="color:#fca5a5">${wrong}</div><div class="stat-lbl">Wrong</div></div>
          </div>
          <div class="card" style="margin-top:20px">
            <div class="card-title"><span class="card-icon"><i class="fa-solid fa-gauge-high"></i></span> Akurasi Keseluruhan</div>
            <div style="text-align:center;padding:20px"><div style="font-size:4rem;font-weight:900;background:linear-gradient(90deg,#22c55e,#86efac);background-clip:text;-webkit-background-clip:text;color:transparent">${acc}%</div><p style="color:var(--muted)">Persentase prediksi benar dari seluruh validasi.</p></div>
          </div>
        </div>`;
    } catch (e) { main.innerHTML = errCard(e); }
  }

  // ===== HISTORY =====
  async function loadHistory() {
    const main = QSCORER.util.el('main');
    main.innerHTML = '<div style="padding:40px">' + QSCORER.ui.loader('Memuat riwayat...') + '</div>';
    try {
      const d = await fetchData();
      const preds = d.predictions || [];
      const results = d.results || [];
      if (!preds.length) { main.innerHTML = emptyCard('fa-clock-rotate-left', 'Belum Ada Riwayat', 'Prediksi yang dibuat akan muncul di sini.'); return; }
      const rows = preds.slice().reverse().map(p => {
        const m = (d.matches || []).find(x => String(x.MatchID) === String(p.MatchID));
        const r = results.find(x => String(x.MatchID) === String(p.MatchID));
        const h = ((d.teams || []).find(t => m && String(t.TeamID) === String(m.HomeTeamID)) || {}).TeamName || 'Home';
        const a = ((d.teams || []).find(t => m && String(t.TeamID) === String(m.AwayTeamID)) || {}).TeamName || 'Away';
        return `<tr><td>${QSCORER.util.fmtDate(m ? m.Date : '')}</td><td><b>${QSCORER.util.esc(h + ' vs ' + a)}</b></td><td><span class="badge badge-blue">${QSCORER.util.esc(p.Recommendation)}</span></td><td>${r ? QSCORER.util.esc(r.FTScore) : '<span class="badge badge-gold">Belum</span>'}</td><td>${r ? '<span class="badge badge-green">Selesai</span>' : '<span class="badge badge-blue">Berlangsung</span>'}</td></tr>`;
      }).join('');
      main.innerHTML = `<div class="container section"><div class="section-head"><div class="section-title"><span class="dot"></span> Riwayat Prediksi</div></div><div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Tanggal</th><th>Pertandingan</th><th>Rekomendasi</th><th>Skor FT</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></div></div>`;
    } catch (e) { main.innerHTML = errCard(e); }
  }

  // ===== PROFILE =====
  function loadProfile() {
    const s = QSCORER.store.get() || {};
    const main = QSCORER.util.el('main');
    main.innerHTML = `
      <div class="container section">
        <div class="section-head"><div class="section-title"><span class="dot"></span> Profile</div></div>
        <div class="card" style="max-width:520px;text-align:center;margin:0 auto">
          <div style="width:80px;height:80px;margin:0 auto 14px;border-radius:50%;background:var(--grad-main);display:flex;align-items:center;justify-content:center;font-size:2rem"><i class="fa-solid fa-user"></i></div>
          <h2>${QSCORER.util.esc(s.Username || 'Guest')}</h2>
          <div style="margin-top:8px"><span class="badge ${s.Role === 'ADMIN' ? 'badge-red' : 'badge-blue'}">${QSCORER.util.esc(s.Role || 'GUEST')}</span></div>
          <div style="margin-top:22px;color:var(--muted);text-align:left">
            <p style="display:flex;justify-content:space-between;padding:10px;border-bottom:1px solid var(--border)"><span>Email</span><b>${QSCORER.util.esc(s.Email || '-')}</b></p>
            <p style="display:flex;justify-content:space-between;padding:10px;border-bottom:1px solid var(--border)"><span>Phone</span><b>${QSCORER.util.esc(s.Phone || '-')}</b></p>
            <p style="display:flex;justify-content:space-between;padding:10px"><span>UserID</span><b>${QSCORER.util.esc(s.UserID || '-')}</b></p>
          </div>
          <button class="btn btn-red btn-block" style="margin-top:20px" id="btnLogoutProfile"><i class="fa-solid fa-right-from-bracket"></i> Keluar</button>
        </div>
      </div>`;
    const lo = QSCORER.util.el('btnLogoutProfile');
    if (lo) lo.onclick = logout;
  }

  function emptyCard(icon, title, sub) {
    return `<div class="container section"><div class="card"><div class="empty"><div class="empty-icon"><i class="fa-solid ${icon}"></i></div><h3>${title}</h3><p>${sub}</p></div></div></div>`;
  }
  function errCard(e) {
    return '<div class="container section"><div class="card" style="max-width:640px;margin:0 auto;text-align:center"><h3 style="color:var(--red-400)">Gagal memuat data</h3><p style="color:var(--muted);margin-top:8px">' + QSCORER.util.esc(e.message || 'Pastikan backend Apps Script aktif.') + '</p><button class="btn btn-primary" style="margin-top:16px" onclick="location.reload()">Coba Lagi</button></div></div>';
  }
  function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  showPage('dashboard');
})();
