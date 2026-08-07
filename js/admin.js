(function () {
  if (!QSCORER.guard('admin')) return;
  QSCORER.ui.init();
  const app = { data: null, page: 'dashboard' };

  const NAV = [
    ['dashboard', 'fa-gauge-high', 'Dashboard'],
    ['users', 'fa-users', 'User Management'],
    ['database', 'fa-database', 'Database'],
    ['validation', 'fa-check-double', 'Match Validation'],
    ['learning', 'fa-graduation-cap', 'Learning'],
    ['statistics', 'fa-square-poll-vertical', 'Statistics'],
    ['debug', 'fa-bug', 'Debug']
  ];

  function renderNav() {
    const box = QSCORER.util.el('navLinks');
    box.innerHTML = NAV.map(n => `<a class="nav-link ${app.page === n[0] ? 'active' : ''}" data-nav="${n[0]}"><i class="fa-solid ${n[1]}"></i>${n[2]}</a>`).join('') +
      `<button class="btn btn-red btn-sm" id="navLogout" style="margin-left:6px"><i class="fa-solid fa-right-from-bracket"></i></button>`;
    box.querySelectorAll('[data-nav]').forEach(a => a.onclick = (e) => { e.preventDefault(); showPage(a.dataset.nav); });
    const lg = QSCORER.util.el('navLogout');
    if (lg) lg.onclick = logout;
    QSCORER.util.el('year').textContent = new Date().getFullYear();
    const lo = QSCORER.util.el('btnLogout');
    if (lo) lo.onclick = logout;
    const toggle = QSCORER.util.el('navToggle');
    if (toggle) toggle.onclick = () => document.querySelector('.nav-links').classList.toggle('open');
    document.querySelectorAll('.nav-links').forEach(l => l.classList.remove('open'));
  }

  function showPage(page) {
    app.page = page;
    renderNav();
    const main = QSCORER.util.el('main');
    window.scrollTo({ top: 0 });
    if (page === 'dashboard') loadDashboard();
    else if (page === 'users') loadUsers();
    else if (page === 'database') loadDatabase();
    else if (page === 'validation') loadValidation();
    else if (page === 'learning') loadLearning();
    else if (page === 'statistics') loadStatistics();
    else if (page === 'debug') loadDebug();
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

  function layout(title, content) {
    return `<div class="container section"><div class="section-head"><div class="section-title"><span class="dot"></span> ${title}</div></div>${content}</div>`;
  }

  // ===== DASHBOARD =====
  async function loadDashboard() {
    const main = QSCORER.util.el('main');
    main.innerHTML = '<div style="padding:40px">' + QSCORER.ui.loader('Memuat dashboard...') + '</div>';
    try {
      const d = await fetchData();
      const st = (d.statistics && d.statistics[0]) || {};
      const acc = st.Accuracy || 0;
      main.innerHTML = layout('Dashboard', `
        <div class="grid g4">
          <div class="card stat-card"><div class="stat-icon"><i class="fa-solid fa-file-lines"></i></div><div class="stat-num">${st.TotalPrediction || 0}</div><div class="stat-lbl">Total Prediction</div></div>
          <div class="card stat-card"><div class="stat-icon"><i class="fa-solid fa-list-check"></i></div><div class="stat-num">${st.TotalValidated || 0}</div><div class="stat-lbl">Validated</div></div>
          <div class="card stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#16a34a,#22c55e)"><i class="fa-solid fa-circle-check"></i></div><div class="stat-num" style="color:#15803d">${st.CorrectPrediction || 0}</div><div class="stat-lbl">Correct</div></div>
          <div class="card stat-card"><div class="stat-icon" style="background:var(--grad-red)"><i class="fa-solid fa-circle-xmark"></i></div><div class="stat-num" style="color:var(--red-600)">${st.WrongPrediction || 0}</div><div class="stat-lbl">Wrong</div></div>
        </div>
        <div class="grid g2" style="margin-top:20px">
          <div class="card"><div class="card-title"><span class="card-icon"><i class="fa-solid fa-gauge-high"></i></span> Akurasi Sistem</div>
            <div style="font-size:3rem;font-weight:900;background:linear-gradient(90deg,#22c55e,#86efac);background-clip:text;-webkit-background-clip:text;color:transparent">${acc}%</div>
            <div class="progress" style="margin-top:8px"><div class="progress-bar green shimmer" style="width:${acc}%"></div></div>
          </div>
          <div class="card"><div class="card-title"><span class="card-icon"><i class="fa-solid fa-database"></i></span> Ringkasan Database</div>
            <div class="grid g2" style="gap:10px">
              ${dbStat('Continent', d.continents.length)}${dbStat('Country', d.countries.length)}${dbStat('League', d.leagues.length)}${dbStat('Team', d.teams.length)}
              ${dbStat('Match', d.matches.length)}${dbStat('Odds', d.odds.length)}${dbStat('Prediction', d.predictions.length)}${dbStat('Result', d.results.length)}
            </div>
          </div>
        </div>`);
    } catch (e) { main.innerHTML = errCard(e); }
  }

  function dbStat(name, count) {
    return `<div style="padding:10px;background:var(--dark-2);border:1px solid var(--border);border-radius:10px;text-align:center"><div style="font-weight:800">${count}</div><div style="font-size:.75rem;color:var(--muted)">${name}</div></div>`;
  }

  // ===== USER MANAGEMENT =====
  async function loadUsers() {
    const main = QSCORER.util.el('main');
    main.innerHTML = '<div style="padding:40px">' + QSCORER.ui.loader('Memuat user...') + '</div>';
    try {
      const res = await QSCORER.api.getUsers();
      if (res.status === 'error') throw new Error(res.message);
      const users = res.data || [];
      main.innerHTML = layout('User Management', `
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;align-items:center">
          <button class="btn btn-primary" id="btnAddUser"><i class="fa-solid fa-user-plus"></i> Tambah User</button>
          <div class="input-wrap" style="flex:1;min-width:220px"><i class="icon fa-solid fa-magnifying-glass"></i><input class="input" id="userSearch" placeholder="Cari username, email, phone, atau role..."></div>
          <span style="color:var(--muted);font-size:.84rem" id="userCount"></span>
        </div>
        <div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>UserID</th><th>Username</th><th>Email</th><th>Phone</th><th>Role</th><th>Created</th><th></th></tr></thead><tbody id="userBody"></tbody></table></div></div>`);
      const renderRows = (list) => {
        const rows = list.map(u => `<tr>
          <td>${QSCORER.util.esc(u.UserID)}</td><td><b>${QSCORER.util.esc(u.Username)}</b></td><td>${QSCORER.util.esc(u.Email)}</td><td>${QSCORER.util.esc(u.Phone)}</td>
          <td><span class="badge ${u.Role === 'ADMIN' ? 'badge-red' : 'badge-blue'}">${QSCORER.util.esc(u.Role)}</span></td>
          <td>${QSCORER.util.fmtDate(u.CreatedAt)}</td>
          <td style="text-align:right">
            <button class="btn btn-ghost btn-sm" data-edit-user="${QSCORER.util.esc(u.UserID)}"><i class="fa-solid fa-pen"></i></button>
            ${u.Role === 'ADMIN' ? '<span title="Admin tidak dapat dihapus" style="color:var(--muted)"><i class="fa-solid fa-lock"></i></span>' : `<button class="btn btn-red btn-sm" data-del-user="${QSCORER.util.esc(u.UserID)}"><i class="fa-solid fa-trash"></i></button>`}
          </td></tr>`).join('');
        QSCORER.util.el('userBody').innerHTML = rows || '<tr><td colspan="7" style="text-align:center;color:var(--muted)">Tidak ada user yang cocok</td></tr>';
        QSCORER.util.el('userCount').textContent = list.length + ' user';
        bindUserActions(list);
      };
      const search = QSCORER.util.el('userSearch');
      const doFilter = () => {
        const q = (search.value || '').toLowerCase().trim();
        const filtered = users.filter(u => {
          if (!q) return true;
          return (u.Username + ' ' + u.Email + ' ' + u.Phone + ' ' + u.Role + ' ' + u.UserID).toLowerCase().indexOf(q) >= 0;
        });
        renderRows(filtered);
      };
      search.oninput = doFilter;
      const add = QSCORER.util.el('btnAddUser');
      if (add) add.onclick = () => userModal(null);
      renderRows(users);
    } catch (e) { main.innerHTML = errCard(e); }
  }

  function bindUserActions(users) {
    document.querySelectorAll('[data-edit-user]').forEach(b => {
      b.onclick = () => {
        const u = users.find(x => String(x.UserID) === String(b.dataset.editUser));
        if (u) userModal(u);
      };
    });
    document.querySelectorAll('[data-del-user]').forEach(b => {
      b.onclick = () => {
        const u = users.find(x => String(x.UserID) === String(b.dataset.delUser));
        QSCORER.ui.confirm('Hapus User', 'Hapus user <b>' + QSCORER.util.esc(u ? u.Username : '') + '</b>?', async () => {
          const res = await QSCORER.api.deleteUser({ UserID: b.dataset.delUser });
          QSCORER.ui.toast(res.message, res.status === 'ok' ? 'success' : 'error');
          loadUsers();
        });
      };
    });
  }

  function userModal(u) {
    const isEdit = !!u;
    const ov = QSCORER.ui.modal(isEdit ? 'Edit User' : 'Tambah User', `
      <div class="form-group"><label class="form-label">Username</label><input class="input no-icon" id="uUsername" value="${QSCORER.util.esc(u ? u.Username : '')}"></div>
      <div class="form-group"><label class="form-label">Email</label><input class="input no-icon" id="uEmail" value="${QSCORER.util.esc(u ? u.Email : '')}"></div>
      <div class="form-group"><label class="form-label">Phone</label><input class="input no-icon" id="uPhone" value="${QSCORER.util.esc(u ? u.Phone : '')}"></div>
      <div class="form-group"><label class="form-label">Password</label><input class="input no-icon" id="uPassword" type="password" placeholder="${isEdit ? 'Kosongkan jika tidak diubah' : 'Min 8 karakter huruf & angka'}"></div>
      <div class="form-group"><label class="form-label">Role</label><select class="input no-icon" id="uRole"><option value="GUEST" ${u && u.Role === 'GUEST' ? 'selected' : ''}>GUEST</option>${u && u.Role === 'ADMIN' ? '<option value="ADMIN" selected>ADMIN</option>' : ''}</select></div>
      <div class="error-msg" id="uErr" style="display:none"></div>
      <button class="btn btn-primary btn-block" id="uSave"><i class="fa-solid fa-check"></i> ${isEdit ? 'Simpan' : 'Tambah'}</button>`);
    const save = QSCORER.util.el('uSave');
    save.onclick = async () => {
      const err = QSCORER.util.el('uErr');
      const username = QSCORER.util.el('uUsername').value.trim();
      const email = QSCORER.util.el('uEmail').value.trim();
      const phone = QSCORER.util.el('uPhone').value.trim();
      const password = QSCORER.util.el('uPassword').value;
      const role = QSCORER.util.el('uRole').value;
      showErr(err, '');
      if (!username) return showErr(err, 'Username wajib diisi');
      if (!isEdit && (!password || password.length < 8)) return showErr(err, 'Password minimal 8 karakter');
      if (password && password.length > 0 && password.length < 8) return showErr(err, 'Password minimal 8 karakter');
      let res;
      if (isEdit) {
        const payload = { UserID: u.UserID, Username: username, Email: email, Phone: phone, Role: role };
        if (password) payload.Password = password;
        res = await QSCORER.api.updateUser(payload);
      } else {
        res = await QSCORER.api.addUser({ username, email, phone, password, Role: role });
      }
      if (res.status === 'error') return showErr(err, res.message);
      QSCORER.ui.toast(res.message, 'success');
      ov.remove();
      loadUsers();
    };
  }

  // ===== DATABASE MANAGEMENT =====
  async function loadDatabase() {
    const main = QSCORER.util.el('main');
    main.innerHTML = '<div style="padding:40px">' + QSCORER.ui.loader('Memuat database...') + '</div>';
    try {
      const d = await fetchData();
      const tabs = [
        ['continent', 'Continent', d.continents],
        ['country', 'Country', d.countries],
        ['league', 'League', d.leagues],
        ['team', 'Team', d.teams]
      ];
      const tabBtns = tabs.map(t => `<button class="tab" data-dtab="${t[0]}">${t[1]}</button>`).join('');
      main.innerHTML = layout('Database Management', `
        <div class="card"><div class="card-title"><span class="card-icon"><i class="fa-solid fa-database"></i></span> Master Data</div>
          <div class="tabs">${tabBtns}</div>
          <div id="dbContent"></div>
        </div>`);
      document.querySelectorAll('[data-dtab]').forEach(t => t.onclick = () => { document.querySelectorAll('[data-dtab]').forEach(x => x.classList.remove('active')); t.classList.add('active'); renderMasterTable(t.dataset.dtab, d); });
      tabs[0][0] && renderMasterTable('continent', d);
    } catch (e) { main.innerHTML = errCard(e); }
  }

  function renderMasterTable(type, d) {
    const box = QSCORER.util.el('dbContent');
    if (type === 'continent') {
      const rows = d.continents.map(x => `<tr><td>${QSCORER.util.esc(x.ContinentID)}</td><td><b>${QSCORER.util.esc(x.ContinentName)}</b></td><td style="text-align:right"><button class="btn btn-ghost btn-sm" data-ed-c="${QSCORER.util.esc(x.ContinentID)}"><i class="fa-solid fa-pen"></i></button><button class="btn btn-red btn-sm" data-del-c="${QSCORER.util.esc(x.ContinentID)}"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');
      box.innerHTML = `<div style="margin-bottom:12px"><button class="btn btn-primary btn-sm" data-add-c><i class="fa-solid fa-plus"></i> Tambah Continent</button></div><div class="table-wrap"><table class="table"><thead><tr><th>ContinentID</th><th>Nama</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="3" style="text-align:center;color:var(--muted)">Kosong</td></tr>'}</tbody></table></div>`;
      bindContinents(d.continents);
    } else if (type === 'country') {
      const rows = d.countries.map(x => `<tr><td>${QSCORER.util.esc(x.CountryID)}</td><td>${QSCORER.util.esc(x.ContinentID)}</td><td><b>${QSCORER.util.esc(x.CountryName)}</b></td><td style="text-align:right"><button class="btn btn-ghost btn-sm" data-ed-cy="${QSCORER.util.esc(x.CountryID)}"><i class="fa-solid fa-pen"></i></button><button class="btn btn-red btn-sm" data-del-cy="${QSCORER.util.esc(x.CountryID)}"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');
      box.innerHTML = `<div style="margin-bottom:12px"><button class="btn btn-primary btn-sm" data-add-cy><i class="fa-solid fa-plus"></i> Tambah Country</button></div><div class="table-wrap"><table class="table"><thead><tr><th>CountryID</th><th>ContinentID</th><th>Nama</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:var(--muted)">Kosong</td></tr>'}</tbody></table></div>`;
      bindCountry(d.countries, d.continents);
} else if (type === 'league') {
      const scaleBadge = (s) => {
        const map = { NATIONAL: 'badge-blue', CONTINENTAL: 'badge-gold', UNIVERSAL: 'badge-red' };
        return `<span class="badge ${map[s] || 'badge-blue'}">${QSCORER.util.esc(s || 'NATIONAL')}</span>`;
      };
      const rows = d.leagues.map(x => `<tr><td>${QSCORER.util.esc(x.LeagueID)}</td><td>${QSCORER.util.esc(x.CountryID || '-')}</td><td><b>${QSCORER.util.esc(x.LeagueName)}</b></td><td>${QSCORER.util.esc(x.Season)}</td><td>${scaleBadge(x.LeagueScale)}</td><td style="text-align:right"><button class="btn btn-ghost btn-sm" data-ed-l="${QSCORER.util.esc(x.LeagueID)}"><i class="fa-solid fa-pen"></i></button><button class="btn btn-red btn-sm" data-del-l="${QSCORER.util.esc(x.LeagueID)}"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');
      box.innerHTML = `<div style="margin-bottom:12px"><button class="btn btn-primary btn-sm" data-add-l><i class="fa-solid fa-plus"></i> Tambah Liga</button></div><div class="table-wrap"><table class="table"><thead><tr><th>LeagueID</th><th>CountryID</th><th>Nama Liga</th><th>Season</th><th>Skala</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:var(--muted)">Kosong</td></tr>'}</tbody></table></div>`;
      bindLeague(d.leagues, d.countries, d.continents);
    } else if (type === 'team') {
      const rows = d.teams.map(x => `<tr><td>${QSCORER.util.esc(x.TeamID)}</td><td>${QSCORER.util.esc(x.LeagueID)}</td><td><b>${QSCORER.util.esc(x.TeamName)}</b></td><td style="text-align:right"><button class="btn btn-ghost btn-sm" data-ed-t="${QSCORER.util.esc(x.TeamID)}"><i class="fa-solid fa-pen"></i></button><button class="btn btn-red btn-sm" data-del-t="${QSCORER.util.esc(x.TeamID)}"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('');
      box.innerHTML = `<div style="margin-bottom:12px"><button class="btn btn-primary btn-sm" data-add-t><i class="fa-solid fa-plus"></i> Tambah Tim</button></div><div class="table-wrap"><table class="table"><thead><tr><th>TeamID</th><th>LeagueID</th><th>Nama Tim</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:var(--muted)">Kosong</td></tr>'}</tbody></table></div>`;
      bindTeam(d.teams, d.leagues);
    }
  }

  function bindContinents(list) {
    const add = document.querySelector('[data-add-c]');
    if (add) add.onclick = () => masterModal('continent', null);
    document.querySelectorAll('[data-ed-c]').forEach(b => b.onclick = () => masterModal('continent', list.find(x => String(x.ContinentID) === String(b.dataset.edC))));
    document.querySelectorAll('[data-del-c]').forEach(b => b.onclick = () => delMaster('deleteContinent', 'ContinentID', b.dataset.delC, 'Hapus Continent?'));
  }
  function bindCountry(list, conts) {
    const add = document.querySelector('[data-add-cy]');
    if (add) add.onclick = () => masterModal('country', null, conts);
    document.querySelectorAll('[data-ed-cy]').forEach(b => b.onclick = () => masterModal('country', list.find(x => String(x.CountryID) === String(b.dataset.edCy)), conts));
    document.querySelectorAll('[data-del-cy]').forEach(b => b.onclick = () => delMaster('deleteCountry', 'CountryID', b.dataset.delCy, 'Hapus Country?'));
  }
  function bindLeague(list, conts) {
    const add = document.querySelector('[data-add-l]');
    if (add) add.onclick = () => masterModal('league', null, null, conts);
    document.querySelectorAll('[data-ed-l]').forEach(b => b.onclick = () => masterModal('league', list.find(x => String(x.LeagueID) === String(b.dataset.edL)), null, conts));
    document.querySelectorAll('[data-del-l]').forEach(b => b.onclick = () => delMaster('deleteLeague', 'LeagueID', b.dataset.delL, 'Hapus Liga?'));
  }
  function bindTeam(list, leagues) {
    const add = document.querySelector('[data-add-t]');
    if (add) add.onclick = () => masterModal('team', null, null, null, leagues);
    document.querySelectorAll('[data-ed-t]').forEach(b => b.onclick = () => masterModal('team', list.find(x => String(x.TeamID) === String(b.dataset.edT)), null, null, leagues));
    document.querySelectorAll('[data-del-t]').forEach(b => b.onclick = () => delMaster('deleteTeam', 'TeamID', b.dataset.delT, 'Hapus Tim?'));
  }

  function masterModal(kind, item, conts, countries, leagues) {
    const isEdit = !!item;
    let body = '';
    if (kind === 'continent') {
      body = `<div class="form-group"><label class="form-label">Nama Benua</label><input class="input no-icon" id="mName" value="${QSCORER.util.esc(item ? item.ContinentName : '')}"></div>`;
    } else if (kind === 'country') {
      body = `<div class="form-group"><label class="form-label">Continent</label><select class="input no-icon" id="mParent">${QSCORER.util.option(conts, 'ContinentID', 'ContinentName', item ? item.ContinentID : '')}</select></div><div class="form-group"><label class="form-label">Nama Negara</label><input class="input no-icon" id="mName" value="${QSCORER.util.esc(item ? item.CountryName : '')}"></div>`;
} else if (kind === 'league') {
      const initScale = item && item.LeagueScale ? item.LeagueScale : 'NATIONAL';
      // Untuk CONTINENTAL, CountryID menyimpan ID benua (mis. CONT003 = Eropa).
      const lgParent = item ? item.CountryID : '';
      body = `<div class="form-group"><label class="form-label">Skala Liga</label><select class="input no-icon" id="mScale">
          <option value="NATIONAL" ${initScale === 'NATIONAL' ? 'selected' : ''}>NATIONAL (Liga Domestik)</option>
          <option value="CONTINENTAL" ${initScale === 'CONTINENTAL' ? 'selected' : ''}>CONTINENTAL (Benua - contoh: UCL)</option>
          <option value="UNIVERSAL" ${initScale === 'UNIVERSAL' ? 'selected' : ''}>UNIVERSAL (Dunia - contoh: Friendly)</option>
        </select></div>
        <div class="input-hint" id="mScaleHint" style="margin-bottom:14px"></div>
        <div id="mParentWrap"><div class="form-group"><label class="form-label" id="mParentLbl">Negara</label><select class="input no-icon" id="mParent"></select></div></div>
        <div class="form-group"><label class="form-label">Nama Liga</label><input class="input no-icon" id="mName" value="${QSCORER.util.esc(item ? item.LeagueName : '')}"></div>
        <div class="form-group"><label class="form-label">Season</label><input class="input no-icon" id="mSeason" value="${QSCORER.util.esc(item ? item.Season : '')}"></div>`;
    } else if (kind === 'team') {
      body = `<div class="form-group"><label class="form-label">League</label><select class="input no-icon" id="mParent">${QSCORER.util.option(leagues, 'LeagueID', 'LeagueName', item ? item.LeagueID : '')}</select></div><div class="form-group"><label class="form-label">Nama Tim</label><input class="input no-icon" id="mName" value="${QSCORER.util.esc(item ? item.TeamName : '')}"></div>`;
    }
    const ov = QSCORER.ui.modal('Data Master', body + '<div class="error-msg" id="mErr" style="display:none"></div><button class="btn btn-primary btn-block" id="mSave"><i class="fa-solid fa-check"></i> Simpan</button>');
// Logika dinamis: input dimulai dari skala liga.
    //  - NATIONAL    : pilih NEGARA (CountryID) → tim dari liga itu
    //  - CONTINENTAL : pilih BENUA (CountryID menyimpan ID benua) → tim satu benua
    //  - UNIVERSAL   : tidak perlu parent → CountryID dikosongkan
    if (kind === 'league') {
      const scaleSel = QSCORER.util.el('mScale');
      const parentSel = QSCORER.util.el('mParent');
      const wrap = QSCORER.util.el('mParentWrap');
      const parentLbl = QSCORER.util.el('mParentLbl');
      const hint = QSCORER.util.el('mScaleHint');
      // Untuk CONTINENTAL, CountryID harus berupa ID benua (bukan negara).
      const initCountry = item && item.LeagueScale === 'CONTINENTAL' ? '' : (item ? item.CountryID : '');
      const initContinent = item && item.LeagueScale === 'CONTINENTAL' ? (item.CountryID || '') : '';
      const applyScaleUI = () => {
        const v = scaleSel ? scaleSel.value : 'NATIONAL';
        const scaleLabels = { NATIONAL: 'Negara', CONTINENTAL: 'Benua', UNIVERSAL: 'Dunia' };
        if (hint) hint.textContent = 'Skala: ' + (scaleLabels[v] || v);
        if (!parentSel) return;
        if (v === 'NATIONAL') {
          parentSel.innerHTML = QSCORER.util.option(countries, 'CountryID', 'CountryName', initCountry);
        } else if (v === 'CONTINENTAL') {
          parentSel.innerHTML = QSCORER.util.option(conts, 'ContinentID', 'ContinentName', initContinent);
        } else {
          parentSel.innerHTML = '<option value="">-- Dunia (semua tim) --</option>';
        }
        if (parentLbl) parentLbl.textContent = v === 'CONTINENTAL' ? 'Benua' : (v === 'NATIONAL' ? 'Negara' : 'Cakupan');
        if (wrap) wrap.style.display = v === 'UNIVERSAL' ? 'none' : '';
      };
      if (scaleSel) {
        scaleSel.onchange = applyScaleUI;
        applyScaleUI();
      }
    }
    const save = QSCORER.util.el('mSave');
    save.onclick = async () => {
      const err = QSCORER.util.el('mErr');
      const name = QSCORER.util.el('mName').value.trim();
      const season = QSCORER.util.el('mSeason') ? QSCORER.util.el('mSeason').value.trim() : null;
      const scale = QSCORER.util.el('mScale') ? QSCORER.util.el('mScale').value : null;
      // parent:
      //  - NATIONAL    = CountryID (negara)
      //  - CONTINENTAL = CountryID (berisi ID benua)
      //  - UNIVERSAL   = '' (tidak terikat negara/benua)
      const parent = (kind === 'league' && scale === 'UNIVERSAL')
        ? ''
        : (QSCORER.util.el('mParent') ? QSCORER.util.el('mParent').value : '');
      showErr(err, '');
      if (!name) return showErr(err, 'Nama wajib diisi');
      if (kind === 'league' && scale !== 'UNIVERSAL' && !parent) return showErr(err, 'Pilih negara (NATIONAL) atau benua (CONTINENTAL)');
      let res;
      if (kind === 'continent') res = isEdit ? await QSCORER.api.updateContinent({ ContinentID: item.ContinentID, ContinentName: name }) : await QSCORER.api.addContinent({ ContinentName: name });
      else if (kind === 'country') res = isEdit ? await QSCORER.api.updateCountry({ CountryID: item.CountryID, ContinentID: parent, CountryName: name }) : await QSCORER.api.addCountry({ ContinentID: parent, CountryName: name });
      else if (kind === 'league') res = isEdit ? await QSCORER.api.updateLeague({ LeagueID: item.LeagueID, CountryID: parent, LeagueName: name, Season: season, LeagueScale: scale || 'NATIONAL' }) : await QSCORER.api.addLeague({ CountryID: parent, LeagueName: name, Season: season, LeagueScale: scale || 'NATIONAL' });
      else if (kind === 'team') res = isEdit ? await QSCORER.api.updateTeam({ TeamID: item.TeamID, LeagueID: parent, TeamName: name }) : await QSCORER.api.addTeam({ LeagueID: parent, TeamName: name });
      if (res.status === 'error') return showErr(err, res.message);
      QSCORER.ui.toast(res.message, 'success');
      ov.remove();
      loadDatabase();
    };
  }

  async function delMaster(action, idField, idVal, msg) {
    QSCORER.ui.confirm('Konfirmasi', msg, async () => {
      const res = await QSCORER.api.request(action, { [idField]: idVal });
      QSCORER.ui.toast(res.message, res.status === 'ok' ? 'success' : 'error');
      loadDatabase();
    });
  }

// ===== MATCH VALIDATION =====
  async function loadValidation() {
    const main = QSCORER.util.el('main');
    main.innerHTML = '<div style="padding:40px">' + QSCORER.ui.loader('Memuat pertandingan...') + '</div>';
    try {
      const d = await fetchData();
      const matches = d.matches || [], teams = d.teams || [], results = d.results || [];
      const isValidated = (mid) => results.some(r => String(r.MatchID) === String(mid));
      main.innerHTML = layout('Match Validation', `
        <div class="card">
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;align-items:center">
            <button class="tab active" data-vf="pending" id="vfPending">Pending</button>
            <button class="tab" data-vf="validated" id="vfValidated">Validated</button>
            <button class="tab" data-vf="all" id="vfAll">All</button>
            <span style="margin-left:auto;color:var(--muted);font-size:.84rem" id="valCount"></span>
          </div>
          <div class="table-wrap"><table class="table"><thead><tr><th>Tanggal</th><th>Match</th><th>HT</th><th>FT</th><th>Status</th><th></th></tr></thead><tbody id="valBody"></tbody></table></div>
        </div>`);
      let filter = 'pending'; // default menampilkan yang belum divalidasi
      const tabBtns = document.querySelectorAll('[data-vf]');
      const render = () => {
        const list = matches.filter(m => {
          const valid = isValidated(m.MatchID);
          if (filter === 'pending') return !valid;
          if (filter === 'validated') return valid;
          return true;
        });
        const rows = list.map(m => {
          const h = ((teams.find(t => String(t.TeamID) === String(m.HomeTeamID)) || {}).TeamName) || 'Home';
          const a = ((teams.find(t => String(t.TeamID) === String(m.AwayTeamID)) || {}).TeamName) || 'Away';
          const res = results.find(r => String(r.MatchID) === String(m.MatchID));
          const valid = !!res;
          // Jika sudah divalidasi → terkunci (tidak bisa divalidasi/diedit lagi)
          const action = valid
            ? '<span class="badge badge-green"><i class="fa-solid fa-lock"></i> Terkunci</span>'
            : `<button class="btn btn-primary btn-sm" data-val="${QSCORER.util.esc(m.MatchID)}"><i class="fa-solid fa-check"></i> Validasi</button>`;
          return `<tr><td>${QSCORER.util.fmtDate(m.Date)}</td><td><b>${QSCORER.util.esc(h + ' vs ' + a)}</b></td><td>${res ? QSCORER.util.esc(res.HTScore) : '-'}</td><td>${res ? QSCORER.util.esc(res.FTScore) : '-'}</td><td>${valid ? '<span class="badge badge-green">Validated</span>' : '<span class="badge badge-red">Pending</span>'}</td><td>${action}</td></tr>`;
        }).join('');
        QSCORER.util.el('valBody').innerHTML = rows || '<tr><td colspan="6" style="text-align:center;color:var(--muted)">Tidak ada pertandingan pada filter ini</td></tr>';
        QSCORER.util.el('valCount').textContent = list.length + ' pertandingan';
        bindValidation(d);
      };
      tabBtns.forEach(t => t.onclick = () => { tabBtns.forEach(x => x.classList.remove('active')); t.classList.add('active'); filter = t.dataset.vf; render(); });
      render();
    } catch (e) { main.innerHTML = errCard(e); }
  }

  function bindValidation(d) {
    document.querySelectorAll('[data-val]').forEach(b => {
      b.onclick = () => {
        const mid = b.dataset.val;
        const m = (d.matches || []).find(x => String(x.MatchID) === String(mid));
        const h = ((d.teams || []).find(t => m && String(t.TeamID) === String(m.HomeTeamID)) || {}).TeamName || 'Home';
        const a = ((d.teams || []).find(t => m && String(t.TeamID) === String(m.AwayTeamID)) || {}).TeamName || 'Away';
        const ov = QSCORER.ui.modal('Validasi Skor', `
          <div style="text-align:center;margin-bottom:14px"><b>${QSCORER.util.esc(h)} vs ${QSCORER.util.esc(a)}</b></div>
          <div class="form-group"><label class="form-label">Half Time Score (HT)</label><input class="input no-icon" id="vHT" placeholder="contoh: 1-0"></div>
          <div class="form-group"><label class="form-label">Full Time Score (FT)</label><input class="input no-icon" id="vFT" placeholder="contoh: 2-1"></div>
          <button class="btn btn-primary btn-block" id="vSave"><i class="fa-solid fa-check"></i> Simpan Validasi</button>`);
        const save = QSCORER.util.el('vSave');
        save.onclick = async () => {
          const ht = QSCORER.util.el('vHT').value.trim(), ft = QSCORER.util.el('vFT').value.trim();
          if (!ht || !ft) return QSCORER.ui.toast('Isi HT dan FT score', 'error');
          const norm = (s) => s.replace('-', ':');
          const me = QSCORER.store.get() || {};
          save.disabled = true;
          const res = await QSCORER.api.validateResult({ MatchID: mid, HTScore: norm(ht), FTScore: norm(ft), ValidatedBy: me.Username || 'iQy' });
          save.disabled = false;
          if (res.status === 'error') return QSCORER.ui.toast(res.message, 'error');
          ov.remove();
          QSCORER.ui.toast('Validasi berhasil, learning diperbarui', 'success');
          loadValidation();
        };
      };
    });
  }

  // ===== LEARNING =====
  async function loadLearning() {
    const main = QSCORER.util.el('main');
    main.innerHTML = '<div style="padding:40px">' + QSCORER.ui.loader('Memuat learning...') + '</div>';
    try {
      const d = await fetchData();
      const lr = d.learning || [];
      const rows = lr.slice().reverse().map(l => {
        const ok = l.Correct === true || l.Correct === 'TRUE' || l.Correct === 'true';
        return `<tr><td>${QSCORER.util.fmtDate(l.CreatedAt)}</td><td><span class="badge badge-blue">${QSCORER.util.esc(l.Market)}</span></td><td>${QSCORER.util.esc(l.Prediction)}</td><td>${QSCORER.util.esc(l.Actual)}</td><td>${ok ? '<span class="badge badge-green"><i class="fa-solid fa-check"></i> Correct</span>' : '<span class="badge badge-red"><i class="fa-solid fa-xmark"></i> Wrong</span>'}</td></tr>`;
      }).join('');
      main.innerHTML = layout('Learning Monitor', `<div class="card"><div class="table-wrap"><table class="table"><thead><tr><th>Waktu</th><th>Market</th><th>Prediction</th><th>Actual</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Belum ada data learning. Lakukan validasi hasil.</td></tr>'}</tbody></table></div></div>`);
    } catch (e) { main.innerHTML = errCard(e); }
  }

  // ===== STATISTICS =====
  async function loadStatistics() {
    const main = QSCORER.util.el('main');
    main.innerHTML = '<div style="padding:40px">' + QSCORER.ui.loader('Menghitung statistik...') + '</div>';
    try {
      const d = await fetchData();
      const st = (d.statistics && d.statistics[0]) || {};
      const lr = d.learning || [];
      const byMarket = {};
      lr.forEach(l => {
        const m = l.Market || 'FT_1X2';
        if (!byMarket[m]) byMarket[m] = { total: 0, correct: 0 };
        byMarket[m].total++;
        if (l.Correct === true || l.Correct === 'TRUE' || l.Correct === 'true') byMarket[m].correct++;
      });
      const marketRows = Object.keys(byMarket).map(k => {
        const b = byMarket[k];
        const pct = b.total ? Math.round((b.correct / b.total) * 100) : 0;
        return `<tr><td><b>${k}</b></td><td>${b.total}</td><td>${b.correct}</td><td style="color:var(--red-400)">${b.total - b.correct}</td><td><div class="progress" style="min-width:120px"><div class="progress-bar ${pct >= 60 ? 'green' : 'red'}" style="width:${pct}%"></div></div></td><td><b>${pct}%</b></td></tr>`;
      }).join('');
main.innerHTML = layout('Statistics', `
        <div class="grid g4">
          <div class="card stat-card"><div class="stat-icon"><i class="fa-solid fa-file-lines"></i></div><div class="stat-num">${st.TotalPrediction || 0}</div><div class="stat-lbl">Total Prediction</div></div>
          <div class="card stat-card"><div class="stat-icon"><i class="fa-solid fa-list-check"></i></div><div class="stat-num">${st.TotalValidated || 0}</div><div class="stat-lbl">Validated</div></div>
          <div class="card stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#16a34a,#22c55e)"><i class="fa-solid fa-circle-check"></i></div><div class="stat-num" style="color:#15803d">${st.CorrectPrediction || 0}</div><div class="stat-lbl">Correct</div></div>
          <div class="card stat-card"><div class="stat-icon" style="background:var(--grad-red)"><i class="fa-solid fa-circle-xmark"></i></div><div class="stat-num" style="color:var(--red-600)">${st.WrongPrediction || 0}</div><div class="stat-lbl">Wrong</div></div>
        </div>
        <div class="card" style="margin-top:20px"><div class="card-title"><span class="card-icon"><i class="fa-solid fa-gauge-high"></i></span> Akurasi per Market</div><div class="table-wrap"><table class="table"><thead><tr><th>Market</th><th>Total</th><th>Correct</th><th>Wrong</th><th>Progress</th><th>Akurasi</th></tr></thead><tbody>${marketRows || '<tr><td colspan="6" style="text-align:center;color:var(--muted)">Belum ada data learning</td></tr>'}</tbody></table></div></div>`);
    } catch (e) { main.innerHTML = errCard(e); }
  }

  // ===== DEBUG =====
  async function loadDebug() {
    const main = QSCORER.util.el('main');
    main.innerHTML = '<div style="padding:40px">' + QSCORER.ui.loader('Menyiapkan debug...') + '</div>';
    try {
      const d = await fetchData();
      const tables = ['continents', 'countries', 'leagues', 'teams', 'matches', 'odds', 'predictions', 'results', 'learning', 'statistics'];
      const tabBtns = tables.map(t => `<button class="tab" data-dbg="${t}">${t}</button>`).join('');
      main.innerHTML = layout('Debug API', `
        <div class="card"><div class="card-title"><span class="card-icon"><i class="fa-solid fa-bug"></i></span> Database Viewer</div>
          <div class="tabs">${tabBtns}</div>
          <pre id="dbgOut" style="background:var(--dark-2);padding:16px;border-radius:10px;overflow:auto;font-size:.78rem;color:#86efac;white-space:pre-wrap;max-height:480px">Pilih tabel untuk melihat isi data.</pre>
        </div>`);
      document.querySelectorAll('[data-dbg]').forEach(t => t.onclick = () => {
        document.querySelectorAll('[data-dbg]').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        QSCORER.util.el('dbgOut').textContent = JSON.stringify(d[t.dataset.dbg] || [], null, 2);
      });
      tables[0] && document.querySelector('[data-dbg="' + tables[0] + '"]').click();
    } catch (e) { main.innerHTML = errCard(e); }
  }

  function showErr(el, msg) { if (!el) return; el.style.display = msg ? 'flex' : 'none'; el.textContent = msg; }
  function errCard(e) {
    return '<div class="container section"><div class="card" style="max-width:640px;margin:0 auto;text-align:center"><h3 style="color:var(--red-400)">Gagal memuat data</h3><p style="color:var(--muted);margin-top:8px">' + QSCORER.util.esc(e.message || 'Pastikan backend Apps Script aktif.') + '</p><button class="btn btn-primary" style="margin-top:16px" onclick="location.reload()">Coba Lagi</button></div></div>';
  }

  showPage('dashboard');
})();
