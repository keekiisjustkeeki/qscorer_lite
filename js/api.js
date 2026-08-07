const QSCORER = {
  API_URL: 'https://script.google.com/macros/s/AKfycbwVYHNrejSKEpBpnSfM4mjcmPtGsgqs4nDvtwZqJEa5IQRLK73YySv_Xc_nEgsURUFVNw/exec',
  SESSION_KEY: 'qscorer_session'
};

QSCORER.api = {
  async request(action, data = {}) {
    // Attach session UserID for backend role verification (Blueprint #19)
const s = QSCORER.store.get();
    const body = { action, ...data };
    if (s && s.UserID) body._uid = s.UserID;
    if (s && s.Username) body._username = s.Username;
    const res = await fetch(QSCORER.API_URL, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return { status: 'error', message: text };
    }
  },
  // Auth
  login: (username, password) => QSCORER.api.request('login', { username, password }),
  register: (data) => QSCORER.api.request('register', data),
  getUser: (userId) => QSCORER.api.request('getUser', { userId }),
  getUsers: () => QSCORER.api.request('getUsers'),
  addUser: (d) => QSCORER.api.request('addUser', d),
  updateUser: (d) => QSCORER.api.request('updateUser', d),
  deleteUser: (d) => QSCORER.api.request('deleteUser', d),
  // Data
getFullData: () => QSCORER.api.request('getFullData'),
  getDBView: () => QSCORER.api.request('getDBView'),
  getStatistics: () => QSCORER.api.request('getStatistics'),
  // Engine
  runEngine: (matchId) => QSCORER.api.request('runEngine', { matchId }),
  validateResult: (data) => QSCORER.api.request('validateResult', data),
  // Master Data CRUD
  addContinent: (d) => QSCORER.api.request('addContinent', d),
  updateContinent: (d) => QSCORER.api.request('updateContinent', d),
  deleteContinent: (d) => QSCORER.api.request('deleteContinent', d),
  addCountry: (d) => QSCORER.api.request('addCountry', d),
  updateCountry: (d) => QSCORER.api.request('updateCountry', d),
  deleteCountry: (d) => QSCORER.api.request('deleteCountry', d),
  addLeague: (d) => QSCORER.api.request('addLeague', d),
  updateLeague: (d) => QSCORER.api.request('updateLeague', d),
  deleteLeague: (d) => QSCORER.api.request('deleteLeague', d),
  addTeam: (d) => QSCORER.api.request('addTeam', d),
  updateTeam: (d) => QSCORER.api.request('updateTeam', d),
  deleteTeam: (d) => QSCORER.api.request('deleteTeam', d),
  addMatch: (d) => QSCORER.api.request('addMatch', d),
  updateMatch: (d) => QSCORER.api.request('updateMatch', d),
  deleteMatch: (d) => QSCORER.api.request('deleteMatch', d),
  addOdds: (d) => QSCORER.api.request('addOdds', d),
  health: () => QSCORER.api.request('health')
};

// ===== Session & Role helpers =====
QSCORER.store = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(QSCORER.SESSION_KEY));
    } catch (e) { return null; }
  },
  set(user) {
    localStorage.setItem(QSCORER.SESSION_KEY, JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem(QSCORER.SESSION_KEY);
  }
};

// Role guard: redirects to proper page if session role mismatches required page
QSCORER.guard = function (page) {
  const s = QSCORER.store.get();
  if (page === 'guest') {
    if (!s || s.Role !== 'GUEST') { location.href = 'index.html'; return false; }
    return true;
  }
  if (page === 'admin') {
    if (!s || s.Role !== 'ADMIN') { location.href = 'index.html'; return false; }
    return true;
  }
  // auth pages (index/regist): if already logged in, route to dashboard
  if (s) {
    location.href = s.Role === 'ADMIN' ? 'admin.html' : 'guest.html';
    return false;
  }
  return true;
};

