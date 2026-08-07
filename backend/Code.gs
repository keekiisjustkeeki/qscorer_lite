function doGet(e){
  ensureSheets();
  return handleRequest(e, 'get');
}
function doPost(e){
  ensureSheets();
  return handleRequest(e, 'post');
}
function handleRequest(e, method){
  try{
    var evt = e || {};
    var parameters = evt.parameter || {};
    var payload = evt[method === 'post' ? 'postData' : 'parameter'] || {};
    var data = {};
    var act = null;

    if(method === 'post' && payload && payload.contents){
      data = parseJson(payload.contents) || {};
      act = data.action || parameters.action;
    } else {
      data = parameters || {};
      act = data.action;
    }

    if(!act) return json({status:'error', message:'Action required'});

    var result = route(act, data);
    return json(result);
  }catch(err){
    return json({status:'error', message:String(err)});
  }
}
function parseJson(str){
  try{
    return JSON.parse(str);
  }catch(e){
    return {};
  }
}
function json(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function getSpreadsheet(){
  var props = PropertiesService.getScriptProperties();

  // 1) SPREADSHEET_ID (paling cepat & pasti)
  var savedId = props.getProperty('SPREADSHEET_ID');
  if(savedId){
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (e) { /* lanjut ke opsi berikutnya */ }
  }

  // 2) SPREADSHEET_URL
  var savedUrl = props.getProperty('SPREADSHEET_URL');
  if(savedUrl){
    try {
      return SpreadsheetApp.openByUrl(savedUrl);
    } catch (e) { /* lanjut */ }
  }

  // 3) Spreadsheet aktif (jika script ditempel sebagai container-bound)
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if(active){
      props.setProperty('SPREADSHEET_ID', active.getId());
      return active;
    }
  } catch (e) { /* lanjut */ }

  // 4) Cari Google Sheets ASLI di Drive bernama "masterdata_Qscorerlite"
  var files = DriveApp.getFilesByName('masterdata_Qscorerlite');
  while(files.hasNext()){
    var f = files.next();
    if(f.getMimeType() === 'application/vnd.google-apps.spreadsheet'){
      props.setProperty('SPREADSHEET_ID', f.getId());
      return SpreadsheetApp.open(f.getId());
    }
  }

  // 5) Jika hanya ada file .xlsx (belum dikonversi ke Google Sheets)
  var filesXlsx = DriveApp.getFilesByName('masterdata_Qscorerlite.xlsx');
  while(filesXlsx.hasNext()){
    var fx = filesXlsx.next();
    if(fx.getMimeType() === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'){
      throw new Error('Ditemukan file masterdata_Qscorerlite.xlsx di Drive, tetapi itu bukan Google Sheets. Konversi file tsb ke Google Sheets, lalu jalankan fungsi setup() dengan link/ID spreadsheet (atau set Script Property SPREADSHEET_ID).');
    }
  }

  throw new Error('Tidak dapat menemukan spreadsheet masterdata_Qscorerlite. Upload & konversi file ke Google Sheets, lalu jalankan setup() dari editor Apps Script.');
}

/**
 * setup(urlAtauId) — Tautkan spreadsheet Google ke aplikasi.
 * Contoh:
 *   setup('https://docs.google.com/spreadsheets/d/1abc.../edit')
 *   setup('1abc...')
 */
function setup(urlOrId){
  var input = String(urlOrId || '').trim();
  if(!input) return {status:'error', message:'Masukkan URL atau ID spreadsheet.'};
  var fileId = input;
  var m = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if(m) fileId = m[1];
  try {
    var ss = SpreadsheetApp.openById(fileId);
    if(ss.getMimeType && ss.getMimeType() !== 'application/vnd.google-apps.spreadsheet'){
      return {status:'error', message:'File harus berupa Google Sheets (bukan .xlsx). Konversi dulu.'};
    }
    var props = PropertiesService.getScriptProperties();
    props.setProperty('SPREADSHEET_ID', fileId);
    props.deleteProperty('SPREADSHEET_URL');
    ensureSheets();
    return {status:'ok', message:'Spreadsheet tertaut: ' + ss.getName() + ' (ID: ' + fileId + ')'};
  } catch(e){
    return {status:'error', message:'Gagal membuka spreadsheet: ' + String(e)};
  }
}

/**
 * importMasterData() — Mengisi sheet (User, Continent, Country, League, Team)
 * dengan data master default bila sheet masih kosong (hanya header).
 */
function importMasterData(){
  var ss = getSpreadsheet();
  ensureSheets();
  var seeded = [];
  var master = getMasterRows();

  Object.keys(master).forEach(function(name){
    var sh = ss.getSheetByName(name);
    if(!sh) return;
    if(sh.getLastRow() > 1) { seeded.push(name + ' (sudah ada data)'); return; }
    var rows = master[name];
    for(var i = 0; i < rows.length; i++){
      sh.appendRow(rows[i]);
    }
    seeded.push(name + ' (' + rows.length + ' baris)');
  });

  return {status:'ok', message:'Import data master selesai: ' + seeded.join(', ')};
}
function getSheet(name){
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName(name);
  if(!sh){
    ensureSheets();
    sh = ss.getSheetByName(name);
  }
  if(!sh) throw new Error('Sheet not found: ' + name);
  return sh;
}
function readAll(name){
  var sh = getSheet(name);
  var values = sh.getDataRange().getValues();
  if(values.length < 2) return [];
  var headers = values[0];
  var rows = [];
  for(var i = 1; i < values.length; i++){
    var obj = {};
    for(var j = 0; j < headers.length; j++){
      obj[headers[j]] = values[i][j];
    }
    rows.push(obj);
  }
  return rows;
}
function appendRow(name, rowObj){
  var sh = getSheet(name);
  var headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var row = [];
  for(var i = 0; i < headers.length; i++){
    row.push(rowObj[headers[i]] !== undefined ? rowObj[headers[i]] : '');
  }
  sh.appendRow(row);
}
function updateRow(name, idCol, idVal, rowObj){
  var sh = getSheet(name);
  var headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var lastRow = sh.getLastRow();
  var idIndex = headers.indexOf(idCol);
  var data = sh.getRange(2,1,lastRow-1,headers.length).getValues();
  for(var i = 0; i < data.length; i++){
    if(String(data[i][idIndex]) === String(idVal)){
      for(var j = 0; j < headers.length; j++){
        if(rowObj[headers[j]] !== undefined){
          sh.getRange(i+2, j+1).setValue(rowObj[headers[j]]);
        }
      }
      return true;
    }
  }
  return false;
}
function deleteRow(name, idCol, idVal){
  var sh = getSheet(name);
  var headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var lastRow = sh.getLastRow();
  var idIndex = headers.indexOf(idCol);
  var data = sh.getRange(2,1,lastRow-1,headers.length).getValues();
  for(var i = 0; i < data.length; i++){
    if(String(data[i][idIndex]) === String(idVal)){
      sh.deleteRow(i+2);
      return true;
    }
  }
  return false;
}
function genId(prefix){
  return prefix + '_' + new Date().getTime();
}
function route(act, data){
  switch(act){
    case 'health': return {status:'ok', message:'QSCORER Lite API running'};
    case 'login': return login(data);
    case 'register': return register(data);
    case 'getUser': return getUser(data);
    case 'getUsers': return requireAdmin(data, function(){ return getUsers(data); });
    case 'addUser': return requireAdmin(data, function(){ return addUser(data); });
    case 'updateUser': return requireAdmin(data, function(){ return updateUser(data); });
    case 'deleteUser': return requireAdmin(data, function(){ return deleteUser(data); });
    case 'addContinent': return requireAdmin(data, function(){ return addContinent(data); });
    case 'updateContinent': return requireAdmin(data, function(){ return updateContinent(data); });
    case 'deleteContinent': return requireAdmin(data, function(){ return deleteContinent(data); });
    case 'addCountry': return requireAdmin(data, function(){ return addCountry(data); });
    case 'updateCountry': return requireAdmin(data, function(){ return updateCountry(data); });
    case 'deleteCountry': return requireAdmin(data, function(){ return deleteCountry(data); });
    case 'addLeague': return requireAdmin(data, function(){ return addLeague(data); });
    case 'updateLeague': return requireAdmin(data, function(){ return updateLeague(data); });
    case 'deleteLeague': return requireAdmin(data, function(){ return deleteLeague(data); });
    case 'addTeam': return requireAdmin(data, function(){ return addTeam(data); });
    case 'updateTeam': return requireAdmin(data, function(){ return updateTeam(data); });
    case 'deleteTeam': return requireAdmin(data, function(){ return deleteTeam(data); });
    case 'updateMatch': return requireAdmin(data, function(){ return updateMatch(data); });
    case 'deleteMatch': return requireAdmin(data, function(){ return deleteMatch(data); });
    case 'updateOdds': return requireAdmin(data, function(){ return updateOdds(data); });
    case 'validateResult': return requireAdmin(data, function(){ return validateResult(data); });
    case 'addMatch': return addMatch(data);
    case 'addOdds': return addOdds(data);
    case 'runEngine': return runEngine(data);
    case 'getContinents': return {status:'ok', data:readAll('Continent')};
    case 'getCountries': return {status:'ok', data:readAll('Country')};
    case 'getLeagues': return {status:'ok', data:readAll('League')};
    case 'getTeams': return {status:'ok', data:readAll('Team')};
    case 'getMatches': return {status:'ok', data:readAll('Match')};
    case 'getOdds': return {status:'ok', data:readAll('Odds')};
    case 'getPredictions': return {status:'ok', data:readAll('Prediction')};
    case 'getResults': return getResults(data);
    case 'getLearning': return {status:'ok', data:readAll('Learning')};
case 'getStatistics': return getStatistics();
    case 'getFullData': return getFullData();
    case 'getVisitorPreview': return getVisitorPreview();
    case 'getDBView': return getDBView();
    default: return {status:'error', message:'Unknown action: ' + act};
  }
}
function requireAdmin(data, fn){
  var uid = data && data._uid;
  var uname = data && data._username;
  if(!uid && !uname) return {status:'error', message:'Akses ditolak: tidak ada session'};
  var users = readAll('User');
  for(var i=0;i<users.length;i++){
    var isMatch = false;
    if(uid && String(users[i].UserID) === String(uid)) isMatch = true;
    if(uname && String(users[i].Username || '').trim().toLowerCase() === String(uname).trim().toLowerCase()) isMatch = true;
    if(isMatch && String(users[i].Role) === 'ADMIN'){
      return fn();
    }
  }
  return {status:'error', message:'Akses ditolak: butuh role ADMIN'};
}
function login(data){
  var users = readAll('User');
  var username = String(data.username || '').trim();
  var password = String(data.password || '').trim();
  for(var i = 0; i < users.length; i++){
    var storedUser = String(users[i].Username || '').trim();
    // Password di sheet bisa berupa angka (mis. 121819) → dipaksa jadi string lalu di-trim
    var storedPass = String(users[i].Password).trim();
    if(storedUser === username && storedPass === password){
      return {status:'ok', user: users[i]};
    }
  }
  return {status:'error', message:'Username atau password salah'};
}
function register(data){
  var username = data.username;
  var email = data.email;
  var phone = data.phone;
  var password = data.password;
  if(!username || !email || !phone || !password){
    return {status:'error', message:'Semua field wajib diisi'};
  }
  if(password.length < 8) return {status:'error', message:'Password minimal 8 karakter'};
  if(!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return {status:'error', message:'Password wajib kombinasi huruf dan angka'};
  var users = readAll('User');
  for(var i = 0; i < users.length; i++){
    if(users[i].Username === username) return {status:'error', message:'Username sudah digunakan'};
    if(users[i].Email === email) return {status:'error', message:'Email sudah digunakan'};
  }
  appendRow('User', {
    UserID: genId('U_'),
    Username: username,
    Email: email,
    Phone: phone,
    Password: password,
    Role: 'GUEST',
    CreatedAt: new Date().toISOString()
  });
  return {status:'ok', message:'Register berhasil'};
}
function getUser(data){
  var users = readAll('User');
  for(var i = 0; i < users.length; i++){
    if(String(users[i].UserID) === String(data.userId)) return {status:'ok', user: users[i]};
  }
  return {status:'error', message:'User tidak ditemukan'};
}
function getUsers(data){
  var users = readAll('User');
  return {status:'ok', data: users};
}
function addUser(data){
  var username = data.username;
  var email = data.email;
  var phone = data.phone;
  var password = data.password;
  var role = data.Role || data.role || 'GUEST';
  if(!username || !password){
    return {status:'error', message:'Username dan password wajib diisi'};
  }
  var users = readAll('User');
  for(var i = 0; i < users.length; i++){
    if(users[i].Username === username) return {status:'error', message:'Username sudah digunakan'};
    if(email && users[i].Email === email) return {status:'error', message:'Email sudah digunakan'};
  }
  appendRow('User', {
    UserID: genId('U_'),
    Username: username,
    Email: email || '',
    Phone: phone || '',
    Password: password,
    Role: role,
    CreatedAt: new Date().toISOString()
  });
  return {status:'ok', message:'User ditambahkan'};
}
function updateUser(data){
  var users = readAll('User');
  var target = null;
  for(var i = 0; i < users.length; i++){
    if(String(users[i].UserID) === String(data.UserID)){ target = users[i]; break; }
  }
  if(!target) return {status:'error', message:'User tidak ditemukan'};
  if(target.Role === 'ADMIN' && data.Role && data.Role !== 'ADMIN'){
    return {status:'error', message:'Akun admin tidak dapat diubah menjadi non-admin'};
  }
  var updated = {
    Username: data.Username !== undefined ? data.Username : target.Username,
    Email: data.Email !== undefined ? data.Email : target.Email,
    Phone: data.Phone !== undefined ? data.Phone : target.Phone,
    Password: data.Password !== undefined ? data.Password : target.Password,
    Role: data.Role !== undefined ? data.Role : target.Role
  };
  for(var j = 0; j < users.length; j++){
    if(String(users[j].UserID) !== String(data.UserID) && users[j].Username === updated.Username){
      return {status:'error', message:'Username sudah digunakan'};
    }
  }
  updateRow('User', 'UserID', data.UserID, updated);
  return {status:'ok', message:'User diupdate'};
}
function deleteUser(data){
  var users = readAll('User');
  var target = null;
  for(var i = 0; i < users.length; i++){
    if(String(users[i].UserID) === String(data.UserID)){ target = users[i]; break; }
  }
  if(!target) return {status:'error', message:'User tidak ditemukan'};
  if(target.Role === 'ADMIN') return {status:'error', message:'Akun admin tidak dapat dihapus'};
  deleteRow('User', 'UserID', data.UserID);
  return {status:'ok', message:'User dihapus'};
}
function normName(s){
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}
function addContinent(data){
  var name = String(data.ContinentName || '').trim();
  if(!name) return {status:'error', message:'Nama benua wajib diisi'};
  var list = readAll('Continent');
  for(var i=0;i<list.length;i++){
    if(normName(list[i].ContinentName) === normName(name)) return {status:'error', message:'Benua "' + name + '" sudah ada'};
  }
  appendRow('Continent', {ContinentID: genId('C_'), ContinentName: name});
  return {status:'ok', message:'Benua ditambahkan'};
}
function updateContinent(data){
  var name = String(data.ContinentName || '').trim();
  if(!name) return {status:'error', message:'Nama benua wajib diisi'};
  var list = readAll('Continent');
  for(var i=0;i<list.length;i++){
    if(String(list[i].ContinentID) !== String(data.ContinentID) && normName(list[i].ContinentName) === normName(name)){
      return {status:'error', message:'Benua "' + name + '" sudah ada'};
    }
  }
  updateRow('Continent', 'ContinentID', data.ContinentID, {ContinentName: name});
  return {status:'ok', message:'Benua diupdate'};
}
function deleteContinent(data){
  deleteRow('Continent', 'ContinentID', data.ContinentID);
  return {status:'ok', message:'Benua dihapus'};
}
function addCountry(data){
  var name = String(data.CountryName || '').trim();
  if(!name) return {status:'error', message:'Nama negara wajib diisi'};
  var list = readAll('Country');
  for(var i=0;i<list.length;i++){
    if(normName(list[i].CountryName) === normName(name)) return {status:'error', message:'Negara "' + name + '" sudah ada'};
  }
  appendRow('Country', {CountryID: genId('CY_'), ContinentID: data.ContinentID, CountryName: name});
  return {status:'ok', message:'Negara ditambahkan'};
}
function updateCountry(data){
  var name = String(data.CountryName || '').trim();
  if(!name) return {status:'error', message:'Nama negara wajib diisi'};
  var list = readAll('Country');
  for(var i=0;i<list.length;i++){
    if(String(list[i].CountryID) !== String(data.CountryID) && normName(list[i].CountryName) === normName(name)){
      return {status:'error', message:'Negara "' + name + '" sudah ada'};
    }
  }
  updateRow('Country', 'CountryID', data.CountryID, {ContinentID: data.ContinentID, CountryName: name});
  return {status:'ok', message:'Negara diupdate'};
}
function deleteCountry(data){
  deleteRow('Country', 'CountryID', data.CountryID);
  return {status:'ok', message:'Negara dihapus'};
}
function addLeague(data){
  var name = String(data.LeagueName || '').trim();
  if(!name) return {status:'error', message:'Nama liga wajib diisi'};
  var list = readAll('League');
  for(var i=0;i<list.length;i++){
    if(normName(list[i].LeagueName) === normName(name)) return {status:'error', message:'Liga "' + name + '" sudah ada'};
  }
var scale = String(data.LeagueScale || 'NATIONAL').toUpperCase();
  // NATIONAL   → CountryID = negara
  // CONTINENTAL→ CountryID = ID benua (mis. CONT003 = Eropa)
  // UNIVERSAL  → CountryID dikosongkan (tidak terikat negara/benua)
  var cid = (scale === 'UNIVERSAL') ? '' : data.CountryID;
appendRow('League', {LeagueID: genId('L_'), CountryID: cid, LeagueName: name, Season: data.Season, LeagueScale: scale});
  return {status:'ok', message:'Liga ditambahkan'};
}
function updateLeague(data){
  var name = String(data.LeagueName || '').trim();
  if(!name) return {status:'error', message:'Nama liga wajib diisi'};
  var list = readAll('League');
  for(var i=0;i<list.length;i++){
    if(String(list[i].LeagueID) !== String(data.LeagueID) && normName(list[i].LeagueName) === normName(name)){
      return {status:'error', message:'Liga "' + name + '" sudah ada'};
    }
  }
var scale = String(data.LeagueScale || 'NATIONAL').toUpperCase();
  // NATIONAL   → CountryID = negara
  // CONTINENTAL→ CountryID = ID benua (mis. CONT003 = Eropa)
  // UNIVERSAL  → CountryID dikosongkan (tidak terikat negara/benua)
  var cid = (scale === 'UNIVERSAL') ? '' : data.CountryID;
updateRow('League', 'LeagueID', data.LeagueID, {CountryID: cid, LeagueName: name, Season: data.Season, LeagueScale: scale});
  return {status:'ok', message:'Liga diupdate'};
}
function deleteLeague(data){
  deleteRow('League', 'LeagueID', data.LeagueID);
  return {status:'ok', message:'Liga dihapus'};
}
function addTeam(data){
  var name = String(data.TeamName || '').trim();
  if(!name) return {status:'error', message:'Nama tim wajib diisi'};
  var list = readAll('Team');
  for(var i=0;i<list.length;i++){
    if(normName(list[i].TeamName) === normName(name)) return {status:'error', message:'Tim "' + name + '" sudah ada'};
  }
  appendRow('Team', {TeamID: genId('T_'), LeagueID: data.LeagueID, TeamName: name});
  return {status:'ok', message:'Tim ditambahkan'};
}
function updateTeam(data){
  var name = String(data.TeamName || '').trim();
  if(!name) return {status:'error', message:'Nama tim wajib diisi'};
  var list = readAll('Team');
  for(var i=0;i<list.length;i++){
    if(String(list[i].TeamID) !== String(data.TeamID) && normName(list[i].TeamName) === normName(name)){
      return {status:'error', message:'Tim "' + name + '" sudah ada'};
    }
  }
  updateRow('Team', 'TeamID', data.TeamID, {LeagueID: data.LeagueID, TeamName: name});
  return {status:'ok', message:'Tim diupdate'};
}
function deleteTeam(data){
  deleteRow('Team', 'TeamID', data.TeamID);
  return {status:'ok', message:'Tim dihapus'};
}
function addMatch(data){
  if(String(data.HomeTeamID) === String(data.AwayTeamID)) return {status:'error', message:'Home dan Away tidak boleh sama'};
  if(!data.LeagueID || !data.HomeTeamID || !data.AwayTeamID) return {status:'error', message:'Data pertandingan belum lengkap'};
  var matches = readAll('Match');
  for(var i = 0; i < matches.length; i++){
    var m = matches[i];
    var sameLg = String(m.LeagueID) === String(data.LeagueID);
    var sameHome = String(m.HomeTeamID) === String(data.HomeTeamID);
    var sameAway = String(m.AwayTeamID) === String(data.AwayTeamID);
    var sameDate = m.Date && data.Date ? String(m.Date).substring(0,10) === String(data.Date).substring(0,10) : true;
    // cegah double: pasangan tim yang sama (home/away) di liga & tanggal yang sama
    if(sameLg && sameHome && sameAway && sameDate){
      return {status:'error', message:'Pertandingan ini sudah terdaftar (duplikat). Cari di Search/View.'};
    }
  }
  var matchId = genId('M_');
  appendRow('Match', {
    MatchID: matchId,
    Date: data.Date,
    LeagueID: data.LeagueID,
    HomeTeamID: data.HomeTeamID,
    AwayTeamID: data.AwayTeamID,
    Status: data.Status || 'UPCOMING'
  });
  return {status:'ok', message:'Match ditambahkan', matchId: matchId};
}
function updateMatch(data){
  updateRow('Match', 'MatchID', data.MatchID, {
    Date: data.Date,
    LeagueID: data.LeagueID,
    HomeTeamID: data.HomeTeamID,
    AwayTeamID: data.AwayTeamID,
    Status: data.Status
  });
  return {status:'ok', message:'Match diupdate'};
}
function deleteMatch(data){
  deleteRow('Match', 'MatchID', data.MatchID);
  return {status:'ok', message:'Match dihapus'};
}
function addOdds(data){
  appendRow('Odds', {
    OddsID: genId('O_'),
    MatchID: data.MatchID,
    HomeOdds: data.HomeOdds,
    DrawOdds: data.DrawOdds,
    AwayOdds: data.AwayOdds,
    HDPHome: data.HDPHome,
    HDPAway: data.HDPAway,
    HDPHomeOdds: data.HDPHomeOdds,
    HDPAwayOdds: data.HDPAwayOdds,
    OU_Line: data.OU_Line,
    OverOdds: data.OverOdds,
    UnderOdds: data.UnderOdds,
    OddOdds: data.OddOdds,
    EvenOdds: data.EvenOdds
  });
  return {status:'ok', message:'Odds ditambahkan'};
}
function updateOdds(data){
  updateRow('Odds', 'OddsID', data.OddsID, {
    MatchID: data.MatchID,
    HomeOdds: data.HomeOdds,
    DrawOdds: data.DrawOdds,
    AwayOdds: data.AwayOdds,
    HDPHome: data.HDPHome,
    HDPAway: data.HDPAway,
    HDPHomeOdds: data.HDPHomeOdds,
    HDPAwayOdds: data.HDPAwayOdds,
    OU_Line: data.OU_Line,
    OverOdds: data.OverOdds,
    UnderOdds: data.UnderOdds,
    OddOdds: data.OddOdds,
    EvenOdds: data.EvenOdds
  });
  return {status:'ok', message:'Odds diupdate'};
}
function getResults(data){
  var results = readAll('Result');
  if(data && data.matchId){
    results = results.filter(function(r){ return String(r.MatchID) === String(data.matchId); });
  }
  return {status:'ok', data: results};
}
function validateResult(data){
  var matchId = data.MatchID;
  var htScore = data.HTScore;
  var ftScore = data.FTScore;
  var validatedBy = data.ValidatedBy;
  var results = readAll('Result');
  var exists = false;
  for(var i = 0; i < results.length; i++){
    if(String(results[i].MatchID) === String(matchId)){ exists = true; break; }
  }
  if(exists){
    updateRow('Result', 'MatchID', matchId, {
      HTScore: htScore, FTScore: ftScore, ValidatedBy: validatedBy, ValidatedAt: new Date().toISOString()
    });
  } else {
    appendRow('Result', {
      ResultID: genId('R_'), MatchID: matchId, HTScore: htScore, FTScore: ftScore,
      ValidatedBy: validatedBy, ValidatedAt: new Date().toISOString()
    });
  }
  runLearning(matchId);
  updateStatistics();
  return {status:'ok', message:'Hasil tervalidasi'};
}
function getStatistics(){
  return {status:'ok', data: readAll('Statistics')};
}
function getVisitorPreview(){
  // Ringan: hanya baca tabel yang dipakai di halaman login/preview visitor.
  return {
    status:'ok',
    data: {
      statistics: readAll('Statistics'),
      leagues: readAll('League'),
      teams: readAll('Team'),
      matches: readAll('Match'),
      results: readAll('Result'),
      odds: readAll('Odds')
    }
  };
}
function getFullData(){
  return {
    status:'ok',
    data: {
      continents: readAll('Continent'),
      countries: readAll('Country'),
      leagues: readAll('League'),
      teams: readAll('Team'),
      matches: readAll('Match'),
      odds: readAll('Odds'),
      predictions: readAll('Prediction'),
      results: readAll('Result'),
      learning: readAll('Learning'),
      statistics: readAll('Statistics')
    }
  };
}
function getDBView(){
  return getFullData();
}
function runEngine(data){
  var matchId = data.matchId;
  var matches = readAll('Match');
  var match = null;
  for(var i = 0; i < matches.length; i++){
    if(String(matches[i].MatchID) === String(matchId)){ match = matches[i]; break; }
  }
  if(!match) return {status:'error', message:'Match tidak ditemukan'};
  var teams = readAll('Team');
  var leagues = readAll('League');
  var oddsList = readAll('Odds');
  var results = readAll('Result');
  var predictions = readAll('Prediction');
  var learning = readAll('Learning');
  var odds = null;
  for(var j = 0; j < oddsList.length; j++){
    if(String(oddsList[j].MatchID) === String(matchId)){ odds = oddsList[j]; break; }
  }
  var pred = keekiEngine(match, teams, leagues, odds, results, predictions, learning);
  var existing = false;
  for(var k = 0; k < predictions.length; k++){
    if(String(predictions[k].MatchID) === String(matchId)){ existing = true; break; }
  }
  if(existing){
    updateRow('Prediction', 'MatchID', matchId, {
      FT_1X2: pred.FT_1X2, FT_HDP: pred.FT_HDP, FT_OU: pred.FT_OU, FT_OddEven: pred.FT_OddEven,
      HT_1X2: pred.HT_1X2, HT_HDP: pred.HT_HDP, HT_OU: pred.HT_OU,
      Confidence: pred.Confidence, Recommendation: pred.Recommendation,
      CreatedAt: new Date().toISOString()
    });
  } else {
    appendRow('Prediction', {
      PredictionID: genId('P_'), MatchID: matchId,
      FT_1X2: pred.FT_1X2, FT_HDP: pred.FT_HDP, FT_OU: pred.FT_OU, FT_OddEven: pred.FT_OddEven,
      HT_1X2: pred.HT_1X2, HT_HDP: pred.HT_HDP, HT_OU: pred.HT_OU,
      Confidence: pred.Confidence, Recommendation: pred.Recommendation,
      CreatedAt: new Date().toISOString()
    });
  }
  updateStatistics();
  return {status:'ok', prediction: pred};
}
function keekiEngine(match, teams, leagues, odds, results, predictions, learning){
  var weights = getWeights(learning);
  var home = findTeam(match.HomeTeamID, teams);
  var away = findTeam(match.AwayTeamID, teams);
  var league = findLeague(match.LeagueID, leagues);
  var form = formAnalysis(home, away, results, teams);
  var homeAway = homeAwayAnalysis(match, results, teams);
  var h2h = headToHead(match, results, teams);
  var goal = goalPattern(results);
  var htPat = htPattern(results);
var lgPat = leaguePattern(league, results, teams, leagues);
  var clubPat = clubPattern(match, results, teams);
  var oddsVal = oddsValue(odds);
  var homeScore = weights.w1*form.home + weights.w2*homeAway.home + weights.w3*h2h.home + weights.w4*goal.home + weights.w5*htPat.home + weights.w6*lgPat.homeWin + weights.w7*oddsVal.home + weights.w8*clubPat.home;
  var drawScore = weights.w1*form.draw + weights.w2*homeAway.draw + weights.w3*h2h.draw + weights.w4*goal.draw + weights.w5*htPat.draw + weights.w6*lgPat.drawRate + weights.w7*oddsVal.draw + weights.w8*clubPat.draw;
  var awayScore = weights.w1*form.away + weights.w2*homeAway.away + weights.w3*h2h.away + weights.w4*goal.away + weights.w5*htPat.away + weights.w6*lgPat.awayWin + weights.w7*oddsVal.away + weights.w8*clubPat.away;
  var total = homeScore + drawScore + awayScore;
  if(total === 0) total = 1;
  var pHome = homeScore/total;
  var pDraw = drawScore/total;
  var pAway = awayScore/total;
  // --- Exact lines from input odds (tidak di-hardcode) ---
  var ouLine = odds && odds.OU_Line !== '' && odds.OU_Line !== undefined ? parseFloat(odds.OU_Line) : 2.5;
  if(isNaN(ouLine) || ouLine <= 0) ouLine = 2.5;
  var hdpHomeLine = odds && odds.HDPHome !== '' && odds.HDPHome !== undefined ? odds.HDPHome : -0.5;
  var hdpAwayLine = odds && odds.HDPAway !== '' && odds.HDPAway !== undefined ? odds.HDPAway : 0.5;
  var avgGoals = (goal.avgTotal + lgPat.avgGoals) / 2;
  // Blend statistik avg-goals dengan implied odds over/under untuk UNDER/OVER seimbang
  var statOverProb = overProbability(avgGoals, total);
  var impliedOverProb = oddsValueOU(odds);
  var overSignificance = 0.5; // semakin banyak learning, semakin percaya odds
  var overProb = statOverProb * (1 - overSignificance) + impliedOverProb * overSignificance;
  overProb = Math.min(0.9, Math.max(0.1, overProb));

  // --- Prediksi skor lebih dulu agar market konsisten dengan skor ---
  var htHome = Math.max(0.3, avgGoals * (pHome / ((pHome + pAway) || 1)) * 0.45);
  var htAway = Math.max(0.3, avgGoals * (pAway / ((pHome + pAway) || 1)) * 0.45);
  var ftHome = Math.max(0.3, avgGoals * (pHome / ((pHome + pAway) || 1)));
  var ftAway = Math.max(0.3, avgGoals * (pAway / ((pHome + pAway) || 1)));
  var rHT = Math.round(htHome) + '-' + Math.round(htAway);
  var rFT = Math.round(ftHome) + '-' + Math.round(ftAway);
  var sftH = Math.round(ftHome), sftA = Math.round(ftAway);
  var shtH = Math.round(htHome), shtA = Math.round(htAway);

  // --- Semua market diturunkan dari prediksi skor ---
  var ft1x2 = sftH > sftA ? 'HOME' : (sftH < sftA ? 'AWAY' : 'DRAW');
  var ht1x2 = shtH > shtA ? 'HOME' : (shtH < shtA ? 'AWAY' : 'DRAW');
  var ftOE = ((sftH + sftA) % 2 === 0) ? 'EVEN' : 'ODD';
  var ftOU = (sftH + sftA) >= ouLine ? 'OVER ' + ouLine : 'UNDER ' + ouLine;
  var htOU = (shtH + shtA) >= 1 ? 'OVER 0.5' : 'UNDER 0.5';
  var ftHDP = sftH > sftA ? 'HOME ' + hdpHomeLine : 'AWAY ' + hdpAwayLine;
  var htHDP = shtH > shtA ? 'HOME' : 'AWAY';

  // --- Confidence per market ---
  function cap(x){ return Math.min(0.98, Math.max(0.34, x)); }
  var c1x2 = 100*(ft1x2==='HOME'?pHome:(ft1x2==='AWAY'?pAway:pDraw));
  var cHandicap = ft1x2==='HOME' ? 100*cap(pHome) : 100*cap(pAway);
  var cOU = ftOU.indexOf('OVER')===0 ? overProb*100 : (1-overProb)*100;
  var cOE = ftOE==='EVEN' ? oddsValueOE(odds)*100 : (1-oddsValueOE(odds))*100;
  var cHT1x2 = 100*(ht1x2==='HOME'?pHome:(ht1x2==='AWAY'?pAway:pDraw));
  var cHTHDP = htHDP==='HOME' ? 100*cap(pHome) : 100*cap(pAway);
  var cHTOU = htOU.indexOf('OVER')===0 ? 55 : 45;
  // probabilitas skor (Poisson approx)
  function poissonP(k, lam){ if(k<0)return 0; var e=Math.exp(-lam); var f=1; for(var i=1;i<=k;i++)f*=i; return (Math.pow(lam,k)*e)/f; }
  var scoreProb = poissonP(sftH, ftHome) * poissonP(sftA, ftAway);

  // --- Rekomendasi: pilih confidence tertinggi dari semua market ---
  var candidateArr = [
    {label:'FT 1X2', pick:ft1x2, prob:c1x2},
    {label:'FT HDP', pick:ftHDP, prob:cHandicap},
    {label:'FT O/U', pick:ftOU, prob:cOU},
    {label:'FT Odd/Even', pick:ftOE, prob:cOE},
    {label:'HT 1X2', pick:ht1x2, prob:cHT1x2},
    {label:'HT HDP', pick:htHDP, prob:cHTHDP},
    {label:'HT O/U', pick:htOU, prob:cHTOU}
  ];
  candidateArr.sort(function(a,b){ return b.prob - a.prob; });
  var best = candidateArr[0];
  var rec = best.pick;
  var confidence = Math.round(best.prob);
  var markets = candidateArr.map(function(c){
    return {label:c.label, value:c.pick, prob: Math.round(c.prob)};
  });
  return {
    FT_1X2: ft1x2, FT_HDP: ftHDP, FT_OU: ftOU, FT_OddEven: ftOE,
    HT_1X2: ht1x2, HT_HDP: htHDP, HT_OU: htOU,
    Confidence: confidence,
    Recommendation: rec,
    RecommendationLabel: best.label,
    HTScore: rHT,
    FTScore: rFT,
    ScoreProb: Math.round(scoreProb*100),
    markets: markets,
    probabilities: {home: Math.round(pHome*1000)/10, draw: Math.round(pDraw*1000)/10, away: Math.round(pAway*1000)/10, over: Math.round(overProb*100)}
  };
}
function getWeights(learning){
  var w = {w1:0.20,w2:0.15,w3:0.10,w4:0.15,w5:0.15,w6:0.10,w7:0.05,w8:0.10};
  var total = 0;
  var correct = 0;
  var byMarket = {};
  for(var i = 0; i < learning.length; i++){
    var l = learning[i];
    if(l.Correct === true || l.Correct === 'TRUE' || l.Correct === 'true') correct++;
    var m = l.Market || 'FT_1X2';
    if(!byMarket[m]) byMarket[m] = {total:0, correct:0};
    byMarket[m].total++;
    if(l.Correct === true || l.Correct === 'TRUE' || l.Correct === 'true') byMarket[m].correct++;
  }
  total = learning.length;
  var acc = total > 0 ? correct/total : 0.5;
  w.w8 = Math.min(0.2, Math.max(0.05, 0.1 * (0.5 + acc)));
  var remain = 1 - w.w8;
  var base = 0.20 + 0.15 + 0.10 + 0.15 + 0.15 + 0.10 + 0.05;
  w.w1 = (0.20/base)*remain;
  w.w2 = (0.15/base)*remain;
  w.w3 = (0.10/base)*remain;
  w.w4 = (0.15/base)*remain;
  w.w5 = (0.15/base)*remain;
  w.w6 = (0.10/base)*remain;
  w.w7 = (0.05/base)*remain;
  return w;
}
function findTeam(id, teams){
  for(var i=0;i<teams.length;i++){ if(String(teams[i].TeamID)===String(id)) return teams[i]; }
  return {TeamID:id, TeamName:'Unknown', LeagueID:''};
}
function findLeague(id, leagues){
  for(var i=0;i<leagues.length;i++){ if(String(leagues[i].LeagueID)===String(id)) return leagues[i]; }
  return {LeagueID:id, LeagueName:'Unknown', LeagueScale:'NATIONAL'};
}
function formAnalysis(home, away, results, teams){
  var homeM = 0, homeW = 0, homeD = 0, homeL = 0, homeGf = 0, homeGa = 0, homeCs = 0;
  var awayM = 0, awayW = 0, awayD = 0, awayL = 0, awayGf = 0, awayGa = 0, awayCs = 0;
  for(var i=0;i<results.length;i++){
    var r = results[i];
    var m = findMatch(r.MatchID);
    if(!m) continue;
    var hs = parseScore(r.FTScore, true);
    var as = parseScore(r.FTScore, false);
    var hId = m.HomeTeamID, aId = m.AwayTeamID;
    if(String(hId)===String(home.TeamID)){
      homeM++; homeGf+=hs; homeGa+=as;
      if(hs>as){homeW++;} else if(hs===as){homeD++;} else {homeL++;}
      if(as===0) homeCs++;
    }
    if(String(aId)===String(home.TeamID)){
      homeM++; homeGf+=as; homeGa+=hs;
      if(as>hs){homeW++;} else if(as===hs){homeD++;} else {homeL++;}
      if(hs===0) homeCs++;
    }
    if(String(hId)===String(away.TeamID)){
      awayM++; awayGf+=hs; awayGa+=as;
      if(hs>as){awayW++;} else if(hs===as){awayD++;} else {awayL++;}
      if(as===0) awayCs++;
    }
    if(String(aId)===String(away.TeamID)){
      awayM++; awayGf+=as; awayGa+=hs;
      if(as>hs){awayW++;} else if(as===hs){awayD++;} else {awayL++;}
      if(hs===0) awayCs++;
    }
  }
  var homeForm = formScore(homeM,homeW,homeD,homeL,homeGf,homeGa,homeCs);
  var awayForm = formScore(awayM,awayW,awayD,awayL,awayGf,awayGa,awayCs);
  return {home:homeForm.value, draw:homeForm.draw, away:awayForm.value};
}
function formScore(m,w,d,l,gf,ga,cs){
  if(m===0) return {value:0.33, draw:0.34};
  var winP = w/m;
  var gd = (gf-ga)/Math.max(1,m);
  var cleanP = cs/m;
  var value = winP*0.5 + gd*0.3 + cleanP*0.2;
  value = Math.min(1, Math.max(0, value));
  var drawP = d/m*0.5;
  return {value:value, draw:drawP};
}
function homeAwayAnalysis(match, results, teams){
  var home = findTeam(match.HomeTeamID, teams);
  var away = findTeam(match.AwayTeamID, teams);
  var homeW=0,homeM=0,homeD=0; var awayW=0,awayM=0,awayD=0;
  for(var i=0;i<results.length;i++){
    var r = results[i];
    var m = findMatch(r.MatchID);
    if(!m) continue;
    var hs = parseScore(r.FTScore, true), as = parseScore(r.FTScore, false);
    if(String(m.HomeTeamID)===String(home.TeamID)){
      homeM++;
      if(hs>as) homeW++; else if(hs===as) homeD++;
    }
    if(String(m.AwayTeamID)===String(away.TeamID)){
      awayM++;
      if(as>hs) awayW++; else if(as===hs) awayD++;
    }
  }
  var hp = homeM>0?homeW/homeM:0.5;
  var ap = awayM>0?awayW/awayM:0.5;
  var dp = (homeM+awayM)>0 ? (homeD+awayD)/(homeM+awayM) : 0.25;
  return {home:hp, away:ap, draw:Math.min(0.4, dp)};
}
function headToHead(match, results, teams){
  var home=0,away=0,draw=0,total=0;
  for(var i=0;i<results.length;i++){
    var r = results[i];
    var m = findMatch(r.MatchID);
    if(!m) continue;
    var sameHome = String(m.HomeTeamID)===String(match.HomeTeamID) && String(m.AwayTeamID)===String(match.AwayTeamID);
    var sameRev = String(m.HomeTeamID)===String(match.AwayTeamID) && String(m.AwayTeamID)===String(match.HomeTeamID);
    if(!sameHome && !sameRev) continue;
    total++;
    var hs = parseScore(r.FTScore,true), as = parseScore(r.FTScore,false);
    if(sameHome){
      if(hs>as) home++; else if(hs===as) draw++; else away++;
    } else {
      if(hs>as) away++; else if(hs===as) draw++; else home++;
    }
  }
  if(total<3){ return {home:0.33,draw:0.34,away:0.33}; }
  return {home:home/total, draw:draw/total, away:away/total};
}
function goalPattern(results){
  var total=0, allGoals=0;
  for(var i=0;i<results.length;i++){
    var r = results[i];
    var hs = parseScore(r.FTScore,true), as = parseScore(r.FTScore,false);
    total++; allGoals += (hs+as);
  }
  var avg = total>0 ? allGoals/total : 1.5;
  var over = total>0 ? countOver(results,2.5)/total : 0.5;
  return {avgTotal:avg, overRate:over, home:0.5, away:0.5, draw:0.25};
}
function countOver(results, line){
  var c=0;
  for(var i=0;i<results.length;i++){
    var r=results[i];
    var hs=parseScore(r.FTScore,true), as=parseScore(r.FTScore,false);
    if((hs+as)>=line) c++;
  }
  return c;
}
function htPattern(results){
  var htGoals=0, total=0;
  for(var i=0;i<results.length;i++){
    var r=results[i];
    var hs=parseScore(r.HTScore,true), as=parseScore(r.HTScore,false);
    total++; htGoals+=(hs+as);
  }
  var avg = total>0 ? htGoals/total : 0.6;
  return {home:0.5, away:0.5, draw:0.3, htOver: avg>0.5?0.5:0.3};
}
function leaguePattern(league, results, teams){
  var total=0, avgGoals=0, homeWin=0, draw=0;
  var scale = String((league && league.LeagueScale) || 'NATIONAL').toUpperCase();
  for(var i=0;i<results.length;i++){
    var r=results[i];
    var m=findMatch(r.MatchID);
    if(!m) continue;
    // Scale-aware: NATIONAL = liga spesifik, CONTINENTAL = semua liga skala benua,
    // UNIVERSAL = semua liga skala universal (dunia)
    if(league){
      if(scale === 'CONTINENTAL'){
        // sertakan semua hasil dari liga yang juga CONTINENTAL
        var mLg = findLeagueByMatch(m, teams);
        var ms = String((mLg && mLg.LeagueScale) || 'NATIONAL').toUpperCase();
        if(ms !== 'CONTINENTAL') continue;
      } else if(scale === 'UNIVERSAL'){
        var mLgU = findLeagueByMatch(m, teams);
        var msu = String((mLgU && mLgU.LeagueScale) || 'NATIONAL').toUpperCase();
        if(msu !== 'UNIVERSAL') continue;
      } else {
        // NATIONAL — hanya liga yang sama
        if(m.LeagueID && String(m.LeagueID)!==String(league.LeagueID)) continue;
      }
    }
    total++; var hs=parseScore(r.FTScore,true), as=parseScore(r.FTScore,false);
    avgGoals+=(hs+as);
    if(hs>as) homeWin++; else if(hs===as) draw++;
  }
  if(total===0) return {avgGoals:2.5, homeWin:0.45, drawRate:0.25, awayWin:0.3};
  return {avgGoals:avgGoals/total, homeWin:homeWin/total, drawRate:draw/total, awayWin:(total-homeWin-draw)/total};
}
function findLeagueByMatch(match, teams){
  // cari tim home dari match untuk dapat LeagueID aslinya, lalu cari detail liga
  var leagueId = match && match.LeagueID;
  var homeTeam = findTeam(match ? match.HomeTeamID : '', teams);
  if(!leagueId && homeTeam && homeTeam.LeagueID) leagueId = homeTeam.LeagueID;
  try { return findLeague(leagueId, readAll('League')); } catch(e){ return {LeagueScale:'NATIONAL'}; }
}
function oddsValue(odds){
  if(!odds) return {home:0.5, away:0.5, draw:0.25};
  var h = parseFloat(odds.HomeOdds), d = parseFloat(odds.DrawOdds), a = parseFloat(odds.AwayOdds);
  if(isNaN(h)||h<=0) h=2.0; if(isNaN(d)||d<=0) d=3.2; if(isNaN(a)||a<=0) a=3.5;
  var ih = 1/h, id = 1/d, ia = 1/a;
  var s = ih+id+ia; if(s<=0) s=1;
  return {home:ih/s, away:ia/s, draw:id/s};
}
function overProbability(avgGoals, total){
  var pOver = 1 - Math.exp(-avgGoals*0.8);
  return Math.min(0.9, Math.max(0.1, pOver));
}
// Implied over/under probability dari odds (agar bisa recommend UNDER juga)
function oddsValueOU(odds){
  if(!odds) return 0.5;
  var over = parseFloat(odds.OverOdds), under = parseFloat(odds.UnderOdds);
  if(isNaN(over)||over<=0) over=1.9;
  if(isNaN(under)||under<=0) under=1.9;
  var io = 1/over, iu = 1/under;
  var s = io+iu; if(s<=0) s=1;
  return io/s;
}
// Implied odd/even probability dari odds
function oddsValueOE(odds){
  if(!odds) return 0.5;
  var odd = parseFloat(odds.OddOdds), even = parseFloat(odds.EvenOdds);
  if(isNaN(odd)||odd<=0) odd=1.9;
  if(isNaN(even)||even<=0) even=1.9;
  var io = 1/odd, ie = 1/even;
  var s = io+ie; if(s<=0) s=1;
  return io/s;
}
// Pola per klub (home/away tendency + over/under tendency) — engine belajar dari data
function clubPattern(match, results, teams){
  var home = findTeam(match.HomeTeamID, teams);
  var away = findTeam(match.AwayTeamID, teams);
  var hM=0,hW=0,hD=0,hOver=0;
  var aM=0,aW=0,aD=0,aOver=0;
  for(var i=0;i<results.length;i++){
    var r=results[i];
    var m=findMatch(r.MatchID);
    if(!m) continue;
    var hs=parseScore(r.FTScore,true), as=parseScore(r.FTScore,false);
    if(String(m.HomeTeamID)===String(home.TeamID)){
      hM++; if(hs>as) hW++; else if(hs===as) hD++;
      if((hs+as)>=2.5) hOver++;
    }
    if(String(m.AwayTeamID)===String(away.TeamID)){
      aM++; if(as>hs) aW++; else if(as===hs) aD++;
      if((hs+as)>=2.5) aOver++;
    }
  }
  var hp = hM>0 ? hW/hM : 0.5;
  var ap = aM>0 ? aW/aM : 0.5;
  var dp = (hM+aM)>0 ? (hD+aD)/(hM+aM) : 0.25;
  // preferensi over/under klub
  var hOverRate = hM>0 ? hOver/hM : 0.5;
  var aOverRate = aM>0 ? aOver/aM : 0.5;
  return {home:hp, away:ap, draw:Math.min(0.4,dp), hOverRate:hOverRate, aOverRate:aOverRate};
}
// Bangun daftar kandidat rekomendasi dari semua market, urutkan probabilitas tertinggi
function buildCandidates(pHome, pDraw, pAway, ft1x2, ftHDP, ftOU, ftOE, overProb, oddProb, ouLine, hdpHomeLine, hdpAwayLine, lgPat, clubPat, avgGoals){
  var arr = [];
  var hdpPick = (ftHDP||'').indexOf('HOME')===0;
  var hdpC = hdpPick ? Math.max(pHome*100, 50 + (pHome-pAway)*100) : Math.max(pAway*100, 50 + (pAway-pHome)*100);
  arr.push({pick: ft1x2, prob: Math.max(pHome,pDraw,pAway)*100});
  arr.push({pick: ftHDP, prob: Math.min(85, hdpC)});
  arr.push({pick: ftOU, prob: overProb*100});
  arr.push({pick: ftOE, prob: oddProb*100});
  // peluang under & over terpisah agar bisa rekomendasi under
  arr.push({pick: 'OVER ' + ouLine, prob: overProb*100});
  arr.push({pick: 'UNDER ' + ouLine, prob: (1-overProb)*100});
  arr.sort(function(a,b){ return b.prob - a.prob; });
  return arr;
}
function parseScore(score, home){
  if(!score) return 0;
  var s = String(score).split(':');
  if(s.length<2) return 0;
  var h = parseInt(s[0])||0, a = parseInt(s[1])||0;
  return home ? h : a;
}
var matchCache = null;
function findMatch(id){
  if(matchCache === null) matchCache = readAll('Match');
  for(var i=0;i<matchCache.length;i++){
    if(String(matchCache[i].MatchID)===String(id)) return matchCache[i];
  }
  return null;
}
function runLearning(matchId){
  var predictions = readAll('Prediction');
  var results = readAll('Result');
  var pred = null;
  for(var i=0;i<predictions.length;i++){
    if(String(predictions[i].MatchID)===String(matchId)){ pred = predictions[i]; break; }
  }
  var res = null;
  for(var j=0;j<results.length;j++){
    if(String(results[j].MatchID)===String(matchId)){ res = results[j]; break; }
  }
  if(!pred || !res) return;
  var learning = readAll('Learning');
  var hs = parseScore(res.HTScore,true), as = parseScore(res.HTScore,false);
  var fhs = parseScore(res.FTScore,true), fas = parseScore(res.FTScore,false);
  var actualFT = fhs>fas?'HOME':(fas>fhs?'AWAY':'DRAW');
  var actualOE = ((fhs+fas)%2===0)?'EVEN':'ODD';
  var actualOU = (fhs+fas)>=2.5?'OVER':'UNDER';
  var actualHT = hs>as?'HOME':(as>hs?'AWAY':'DRAW');
  var entries = [
    {Market:'FT_1X2', Prediction:pred.FT_1X2, Actual:actualFT},
    {Market:'FT_OU', Prediction:pred.FT_OU, Actual:actualOU},
    {Market:'FT_OddEven', Prediction:pred.FT_OddEven, Actual:actualOE},
    {Market:'HT_1X2', Prediction:pred.HT_1X2, Actual:actualHT}
  ];
  for(var k=0;k<entries.length;k++){
    var e = entries[k];
    var correct = (String(e.Prediction).indexOf(String(e.Actual))>=0);
    appendRow('Learning', {
      LearningID: genId('LR_'), PredictionID: pred.PredictionID, Market: e.Market,
      Prediction: e.Prediction, Actual: e.Actual, Correct: correct,
      CreatedAt: new Date().toISOString()
    });
  }
}
function updateStatistics(){
  var predictions = readAll('Prediction');
  var learning = readAll('Learning');
  var totalPred = predictions.length;
  var validated = 0, correct = 0, wrong = 0;
  for(var i=0;i<learning.length;i++){
    if(learning[i].Correct === true || learning[i].Correct === 'TRUE' || learning[i].Correct === 'true'){ correct++; validated++; }
    else { wrong++; validated++; }
  }
  var accuracy = validated>0 ? Math.round((correct/validated)*1000)/10 : 0;
  var ss = getSpreadsheet();
  var sh = ss.getSheetByName('Statistics');
  var headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  var has = sh.getLastRow()>1;
  if(has){
    sh.getRange(2,1,1,headers.length).setValues([[
      sh.getRange(2,1).getValue(),
      totalPred, validated, correct, wrong, accuracy, new Date().toISOString()
    ]]);
  } else {
    sh.appendRow(['S_1', totalPred, validated, correct, wrong, accuracy, new Date().toISOString()]);
  }
}
function ensureSheets(){
  var database = {
    "User": ["UserID","Username","Email","Phone","Password","Role","CreatedAt"],
    "Continent": ["ContinentID","ContinentName"],
    "Country": ["CountryID","ContinentID","CountryName"],
    "League": ["LeagueID","CountryID","LeagueName","Season","LeagueScale"],
    "Team": ["TeamID","LeagueID","TeamName"],
    "Match": ["MatchID","Date","LeagueID","HomeTeamID","AwayTeamID","Status"],
    "Odds": ["OddsID","MatchID","HomeOdds","DrawOdds","AwayOdds","HDPHome","HDPAway","HDPHomeOdds","HDPAwayOdds","OU_Line","OverOdds","UnderOdds","OddOdds","EvenOdds"],
    "Prediction": ["PredictionID","MatchID","FT_1X2","FT_HDP","FT_OU","FT_OddEven","HT_1X2","HT_HDP","HT_OU","Confidence","Recommendation","CreatedAt"],
    "Result": ["ResultID","MatchID","HTScore","FTScore","ValidatedBy","ValidatedAt"],
    "Learning": ["LearningID","PredictionID","Market","Prediction","Actual","Correct","CreatedAt"],
    "Statistics": ["StatisticID","TotalPrediction","TotalValidated","CorrectPrediction","WrongPrediction","Accuracy","UpdatedAt"]
  };
  var ss = getSpreadsheet();
  var needsSeed = false;
  Object.keys(database).forEach(function(name){
    var sheet = ss.getSheetByName(name);
    if(!sheet){
      sheet = ss.insertSheet(name);
      sheet.appendRow(database[name]);
      needsSeed = true;
    } else if(sheet.getLastRow() === 0){
      sheet.appendRow(database[name]);
      needsSeed = true;
    } else if(sheet.getLastRow() === 1){
      // Hanya header — data master (User/Continent/Country/League/Team) akan di-seed
      needsSeed = true;
    }
  });
  if(needsSeed){
    seedMasterData(ss);
  }
}

function seedMasterData(ss){
  var master = getMasterRows();
  Object.keys(master).forEach(function(name){
    var sheet = ss.getSheetByName(name);
    if(!sheet) return;
    if(sheet.getLastRow() > 1) return; // sudah terisi
    var rows = master[name];
    for(var i = 0; i < rows.length; i++){
      sheet.appendRow(rows[i]);
    }
  });
}

function getMasterRows(){
  return {
    "User": [
      ['U001','iqy','iqy@qscorer.com',81234567801,'121819','ADMIN','2026-08-07'],
      ['U002','betamin','betamin@qscorer.com',81234567802,'134567','ADMIN','2026-08-07'],
      ['U003','qmin','qmin@qscorer.com',81234567803,'123409','ADMIN','2026-08-07'],
      ['U004','keeki_guest','guest@qscorer.com',81234567804,'asdf1234','GUEST','2026-08-07'],
      ['U005','footballfan','fan@qscorer.com',81234567805,'asdf1234','GUEST','2026-08-07']
    ],
    "Continent": [
      ['CONT001','Africa'],['CONT002','Asia'],['CONT003','Europe'],
      ['CONT004','North America'],['CONT005','South America'],['CONT006','Oceania']
    ],
    "Country": [
      ['C001','CONT001','Algeria'],['C002','CONT001','Egypt'],['C003','CONT001','Morocco'],['C004','CONT001','Nigeria'],['C005','CONT001','South Africa'],
      ['C006','CONT002','Indonesia'],['C007','CONT002','Japan'],['C008','CONT002','South Korea'],['C009','CONT002','China'],['C010','CONT002','Saudi Arabia'],
      ['C011','CONT003','England'],['C012','CONT003','Spain'],['C013','CONT003','Germany'],['C014','CONT003','Italy'],['C015','CONT003','France'],
      ['C016','CONT003','Netherlands'],['C017','CONT003','Portugal'],['C018','CONT004','United States'],['C019','CONT004','Mexico'],['C020','CONT004','Canada'],
      ['C021','CONT005','Brazil'],['C022','CONT005','Argentina'],['C023','CONT005','Uruguay'],['C024','CONT005','Colombia'],['C025','CONT006','Australia'],['C026','CONT006','New Zealand']
    ],
    "League": [
      ['L001','C011','Premier League',''],['L002','C012','La Liga',''],['L003','C013','Bundesliga',''],['L004','C014','Serie A',''],['L005','C015','Ligue 1',''],
      ['L006','C016','Eredivisie',''],['L007','C017','Primeira Liga',''],['L008','C006','Liga 1 Indonesia',''],['L009','C007','J1 League',''],['L010','C008','K League 1',''],
      ['L011','C010','Saudi Pro League',''],['L012','C003','Botola Pro',''],['L013','C004','NPFL',''],['L014','C021','Brasileirão Serie A',''],['L015','C022','Primera División Argentina',''],
      ['L016','C024','Categoría Primera A',''],['L017','C018','Major League Soccer',''],['L018','C019','Liga MX',''],['L019','C020','Canadian Premier League',''],['L020','C025','A-League Men',''],
      ['L021','C026','New Zealand Football Championship',''],['L022','C001','Egyptian Premier League',''],['L023','C002','South African Premier Division',''],['L024','C005','Chinese Super League',''],
      ['L025','C009','Uruguayan Primera División',''],['L026','C023','Algerian Ligue 1','']
    ],
    "Team": [
      ['T001','L001','Arsenal'],['T002','L001','Aston Villa'],['T003','L001','AFC Bournemouth'],['T004','L001','Brentford'],['T005','L001','Brighton & Hove Albion'],
      ['T006','L001','Chelsea'],['T007','L001','Crystal Palace'],['T008','L001','Everton'],['T009','L001','Fulham'],['T010','L001','Hull City'],
      ['T011','L001','Ipswich Town'],['T012','L001','Leeds United'],['T013','L001','Liverpool'],['T014','L001','Manchester City'],['T015','L001','Manchester United'],
      ['T016','L001','Newcastle United'],['T017','L001','Nottingham Forest'],['T018','L001','Sunderland'],['T019','L001','Tottenham Hotspur'],['T020','L001','Coventry City'],
      ['T021','L004','Atalanta'],['T022','L004','Bologna'],['T023','L004','Cagliari'],['T024','L004','Como'],['T025','L004','Fiorentina'],
      ['T026','L004','Genoa'],['T027','L004','Inter Milan'],['T028','L004','Juventus'],['T029','L004','Lazio'],['T030','L004','Lecce'],
      ['T031','L004','AC Milan'],['T032','L004','Napoli'],['T033','L004','Parma'],['T034','L004','Pisa'],['T035','L004','Roma'],
      ['T036','L004','Torino'],['T037','L004','Udinese'],['T038','L004','Verona'],['T039','L004','Sassuolo'],['T040','L004','Cremonese'],
      ['T041','L002','Alaves'],['T042','L002','Athletic Bilbao'],['T043','L002','Atletico Madrid'],['T044','L002','Barcelona'],['T045','L002','Celta Vigo'],
      ['T046','L002','Elche'],['T047','L002','Espanyol'],['T048','L002','Getafe'],['T049','L002','Girona'],['T050','L002','Levante'],
      ['T051','L002','Mallorca'],['T052','L002','Osasuna'],['T053','L002','Rayo Vallecano'],['T054','L002','Real Betis'],['T055','L002','Real Madrid'],
      ['T056','L002','Real Sociedad'],['T057','L002','Sevilla'],['T058','L002','Valencia'],['T059','L002','Villarreal'],['T060','L002','Real Oviedo'],
      ['T061','L003','Bayern Munich'],['T062','L003','Borussia Dortmund'],['T063','L003','Bayer Leverkusen'],['T064','L003','RB Leipzig'],['T065','L003','Eintracht Frankfurt'],
      ['T066','L003','SC Freiburg'],['T067','L003','VfB Stuttgart'],['T068','L003','Mainz 05'],['T069','L003','Werder Bremen'],['T070','L003','Borussia Monchengladbach'],
      ['T071','L003','Wolfsburg'],['T072','L003','FC Augsburg'],['T073','L003','Union Berlin'],['T074','L003','Hoffenheim'],['T075','L003','FC St. Pauli'],
      ['T076','L003','Hamburger SV'],['T077','L003','FC Koln'],['T078','L003','Heidenheim'],['T079','L003','Darmstadt'],['T080','L003','Hannover 96'],
      ['T081','L005','Paris Saint-Germain'],['T082','L005','AS Monaco'],['T083','L005','Olympique Marseille'],['T084','L005','Olympique Lyonnais'],['T085','L005','Lille OSC'],
      ['T086','L005','Nice'],['T087','L005','Lens'],['T088','L005','Rennes'],['T089','L005','Strasbourg'],['T090','L005','Toulouse'],
      ['T091','L005','Nantes'],['T092','L005','Montpellier'],['T093','L005','Auxerre'],['T094','L005','Brest'],['T095','L005','Le Havre'],
      ['T096','L005','Saint-Etienne'],['T097','L005','Metz'],['T098','L005','Lorient'],['T099','L005','Angers']
    ]
  };
}
