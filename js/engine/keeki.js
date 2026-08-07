// KEEKI v2.5 Client Display Engine (aligned with engine.md)
QSCORER.WEIGHTS = { w1: 0.20, w2: 0.15, w3: 0.10, w4: 0.15, w5: 0.15, w6: 0.10, w7: 0.05, w8: 0.10 };

QSCORER.engine = {
  weights: Object.assign({}, QSCORER.WEIGHTS),

  // Get dynamic weights based on learning accuracy (W8 learning correction)
  getWeights(learning) {
    const base = { w1: 0.20, w2: 0.15, w3: 0.10, w4: 0.15, w5: 0.15, w6: 0.10, w7: 0.05, w8: 0.10 };
    let correct = 0;
    (learning || []).forEach(l => {
      if (l.Correct === true || l.Correct === 'TRUE' || l.Correct === 'true') correct++;
    });
    const total = (learning || []).length;
    const acc = total > 0 ? correct / total : 0.5;
    const w = Object.assign({}, base);
    w.w8 = Math.min(0.2, Math.max(0.05, 0.1 * (0.5 + acc)));
    const remain = 1 - w.w8;
    const bSum = 0.20 + 0.15 + 0.10 + 0.15 + 0.15 + 0.10 + 0.05;
    w.w1 = (0.20 / bSum) * remain;
    w.w2 = (0.15 / bSum) * remain;
    w.w3 = (0.10 / bSum) * remain;
    w.w4 = (0.15 / bSum) * remain;
    w.w5 = (0.15 / bSum) * remain;
    w.w6 = (0.10 / bSum) * remain;
    w.w7 = (0.05 / bSum) * remain;
    return w;
  },

  analyze(data, match) {
    const teams = data.teams || [];
    const results = data.results || [];
    const oddsList = data.odds || [];
    const learning = data.learning || [];
    const matches = data.matches || [];
    const home = this.findTeam(match.HomeTeamID, teams);
    const away = this.findTeam(match.AwayTeamID, teams);
    const odds = this.findOdds(match.MatchID, oddsList);
const leaguesAll = data.leagues || [];
    const league = leaguesAll.find(l => String(l.LeagueID) === String(match.LeagueID)) || {};
    league._allLeagues = leaguesAll;

// 9 components per engine.md (incl. club pattern learning)
    const form = this.formAnalysis(home, away, results, matches);
    const ha = this.homeAway(match, results, matches);
    const h2h = this.headToHead(match, results, matches);
    const goal = this.goalPattern(results);
    const htPat = this.htPattern(results);
    const lgPat = this.leaguePattern(league, results, matches);
    const clubPat = this.clubPattern(match, results, matches);
    const oddsVal = this.oddsValue(odds);
    const learnCorr = this.learningCorrection(learning, form, oddsVal);

    const w = this.getWeights(learning);
    const hs = w.w1 * form.home + w.w2 * ha.home + w.w3 * h2h.home + w.w4 * goal.home + w.w5 * htPat.home + w.w6 * lgPat.homeWin + w.w7 * oddsVal.home + w.w8 * clubPat.home;
    const ds = w.w1 * form.draw + w.w2 * ha.draw + w.w3 * h2h.draw + w.w4 * goal.draw + w.w5 * htPat.draw + w.w6 * lgPat.drawRate + w.w7 * oddsVal.draw + w.w8 * clubPat.draw;
    const as = w.w1 * form.away + w.w2 * ha.away + w.w3 * h2h.away + w.w4 * goal.away + w.w5 * htPat.away + w.w6 * lgPat.awayWin + w.w7 * oddsVal.away + w.w8 * clubPat.away;
    const total = hs + ds + as || 1;
    const pHome = hs / total, pDraw = ds / total, pAway = as / total;

    // --- Exact lines from input odds (tidak di-hardcode) ---
    const ouLine = odds && odds.OU_Line !== '' && odds.OU_Line !== undefined ? parseFloat(odds.OU_Line) : 2.5;
    const hdpHomeLine = odds && odds.HDPHome !== '' && odds.HDPHome !== undefined ? odds.HDPHome : -0.5;
    const hdpAwayLine = odds && odds.HDPAway !== '' && odds.HDPAway !== undefined ? odds.HDPAway : 0.5;
const avgGoals = (goal.avgTotal + lgPat.avgGoals) / 2;
    // Probabilitas OVER/UNDER JUJUR memakai distribusi Poisson total gol sesuai line.
    // Statistik memberi P(over) realistis (mis. 2.5 gol → over 2.5 ≈ 48%, bukan 86%),
    // lalu di-blend kecil dengan implied odds agar kadang OVER kadang UNDER.
    const statOverProb = this.overProbability(avgGoals, ouLine);
    const impliedOverProb = this.oddsValueOU(odds);
    const overSignificance = 0.35;
    let overProb = statOverProb * (1 - overSignificance) + impliedOverProb * overSignificance;
    overProb = Math.min(0.92, Math.max(0.08, overProb));

// Prediksi Skor HT & FT (Blueprint #8) — Poisson + seeded RNG (deterministik per match)
    // Expected goals memakai kekuatan relatif tim (bukan rata-rata statis).
    const sumP = (pHome + pAway) || 1;
    const expHome = Math.max(0.3, avgGoals * (pHome / sumP) * 1.15);
    const expAway = Math.max(0.3, avgGoals * (pAway / sumP) * 1.15);
    const rngSeed = String(match.MatchID || '') + '|' + String(match.HomeTeamID || '') + '|' + String(match.AwayTeamID || '');
    const rng = this.mulberry32(this.hashSeed(rngSeed));
    const ftHome = this.poisson(expHome, rng);
    const ftAway = this.poisson(expAway, rng);
    // HT ~ 45% dari ekspektasi gol FT
    const htHome = this.poisson(expHome * 0.45, rng);
    const htAway = this.poisson(expAway * 0.45, rng);

    // --- Semua market diturunkan dari prediksi skor agar konsisten dengan skor ---
    // FT 1X2 dari skor FT
    const ft1x2 = ftHome > ftAway ? 'HOME' : (ftHome < ftAway ? 'AWAY' : 'DRAW');
    // HT 1X2 dari skor HT
    const ht1x2 = htHome > htAway ? 'HOME' : (htHome < htAway ? 'AWAY' : 'DRAW');
    // FT Odd/Even dari total gol FT
    const ftOE = ((ftHome + ftAway) % 2 === 0) ? 'EVEN' : 'ODD';
    // FT O/U dari total gol vs line
    const ftOU = (ftHome + ftAway) >= ouLine ? 'OVER ' + ouLine : 'UNDER ' + ouLine;
    // HT O/U dari total gol HT
    const htOU = (htHome + htAway) >= 1 ? 'OVER 0.5' : 'UNDER 0.5';
    // FT HDP: skor draw → PUSH (bukan dipaksa AWAY)
    let ftHDP;
    if (ftHome > ftAway) ftHDP = 'HOME ' + hdpHomeLine;
    else if (ftHome < ftAway) ftHDP = 'AWAY ' + hdpAwayLine;
    else ftHDP = 'DRAW (PUSH)';
    // HT HDP: skor draw HT → PUSH
    let htHDP;
    if (htHome > htAway) htHDP = 'HOME';
    else if (htHome < htAway) htHDP = 'AWAY';
    else htHDP = 'DRAW (PUSH)';

// --- Confidence per market, disesuaikan dengan LEARNING (akurasi historis per market) ---
    // Engine BELAJAR: market yang sering benar → naik, yang sering salah → turun.
    // Ini membuat rekomendasi TIDAK MONOTON (kadang 1X2, HDP, O/U, atau Odd/Even).
    const oeProb = this.oddsValueOE(odds); // implied prob ODD dari odds
    const acc = this.marketAccuracy(learning); // {FT_1X2: 0.6, FT_OU: 0.4, ...}
    // blend: 60% probabilitas dasar + 40% akurasi historis market tsb
    const adj = (baseProb, market) => {
      const a = acc[market] != null ? acc[market] : 0.5;
      return Math.round((baseProb * 0.6 + a * 100 * 0.4) * 10) / 10;
    };
    // 1X2: peluang dari probabilitas home/draw/away (jujur — draw ya DRAW, bukan paksa home)
    const cFT1x2 = adj((ft1x2 === 'HOME' ? pHome : ft1x2 === 'AWAY' ? pAway : pDraw) * 100, 'FT_1X2');
    const cHT1x2 = adj((ht1x2 === 'HOME' ? pHome : ht1x2 === 'AWAY' ? pAway : pDraw) * 100, 'HT_1X2');
    // HDP: pada draw → PUSH (50); selain itu peluang tim terkait (jujur, tidak selalu home)
    const cFTHDP = ftHDP === 'DRAW (PUSH)' ? 50 : adj(Math.min(88, Math.max(50, (ft1x2 === 'HOME' ? pHome : pAway) * 100 + 4)), 'FT_HDP');
    const cHTHDP = htHDP === 'DRAW (PUSH)' ? 50 : adj(Math.min(88, Math.max(50, (ht1x2 === 'HOME' ? pHome : pAway) * 100 + 3)), 'HT_HDP');
    // O/U: pakai overProb Poisson yg jujur → kadang OVER, kadang UNDER
    const cFTOU = ftOU.indexOf('OVER') === 0 ? adj(overProb * 100, 'FT_OU') : adj((1 - overProb) * 100, 'FT_OU');
    const htOverRate = htPat.htOver;
    const cHTOU = htOU.indexOf('OVER') === 0 ? adj(htOverRate * 100, 'HT_OU') : adj((1 - htOverRate) * 100, 'HT_OU');
    // Odd/Even: implied odds (EVEN = 1 - prob ODD)
    const cFTOE = ftOE === 'EVEN' ? adj((1 - oeProb) * 100, 'FT_OddEven') : adj(oeProb * 100, 'FT_OddEven');
    // Probabilitas skor persis (Poisson) — agar tidak selalu 0%
    const scoreProb = Math.round(this.poissonProb(ftHome, ftAway, expHome, expAway) * 100);

    // --- Rekomendasi: pilih confidence tertinggi dari semua market (1X2, HDP, O/U, Odd/Even) ---
    // Karena confidence tiap market berbeda & dipengaruhi learning, pilihan jadi bervariasi.
    const candidates = [
      { label: 'FT 1X2', value: ft1x2, prob: cFT1x2 },
      { label: 'FT HDP', value: ftHDP, prob: cFTHDP },
      { label: 'FT O/U', value: ftOU, prob: cFTOU },
      { label: 'FT Odd/Even', value: ftOE, prob: cFTOE },
      { label: 'HT 1X2', value: ht1x2, prob: cHT1x2 },
      { label: 'HT HDP', value: htHDP, prob: cHTHDP },
      { label: 'HT O/U', value: htOU, prob: cHTOU }
    ].sort((a, b) => b.prob - a.prob);
    const best = candidates[0];
    const rec = best.value;
    const confidence = Math.round(best.prob);
    const markets = candidates.map(c => ({ label: c.label, value: c.value, prob: Math.round(c.prob) }));

    return {
      home: this.teamLabel(home), away: this.teamLabel(away),
      FT_1X2: ft1x2, FT_HDP: ftHDP, FT_OU: ftOU, FT_OddEven: ftOE,
      HT_1X2: ht1x2, HT_HDP: htHDP, HT_OU: htOU,
      Confidence: confidence, Recommendation: rec,
      RecommendationLabel: best.label,
      HTScore: htHome + '-' + htAway, FTScore: ftHome + '-' + ftAway,
      ScoreProb: scoreProb,
      markets: markets,
      probabilities: { home: Math.round(pHome * 1000) / 10, draw: Math.round(pDraw * 1000) / 10, away: Math.round(pAway * 1000) / 10, over: Math.round(overProb * 100) }
    };
  },

  findTeam(id, teams) {
    for (const t of teams) if (String(t.TeamID) === String(id)) return t;
    return { TeamID: id, TeamName: 'Unknown' };
  },
  findOdds(mid, oddsList) {
    for (const o of oddsList) if (String(o.MatchID) === String(mid)) return o;
    return null;
  },
  teamLabel(t) { return t.TeamName || 'Unknown'; },

formAnalysis(home, away, results, matches) {
    let hw = 0, hm = 0, hd = 0, aw = 0, am = 0, ad = 0;
    for (const r of results) {
      const m = matches.find(x => String(x.MatchID) === String(r.MatchID));
      if (!m) continue;
      const hs = this.score(r.FTScore, true), as = this.score(r.FTScore, false);
      if (String(m.HomeTeamID) === String(home.TeamID)) { hm++; if (hs > as) hw++; else if (hs === as) hd++; }
      if (String(m.AwayTeamID) === String(home.TeamID)) { hm++; if (as > hs) hw++; else if (as === hs) hd++; }
      if (String(m.HomeTeamID) === String(away.TeamID)) { am++; if (hs > as) aw++; else if (hs === as) ad++; }
      if (String(m.AwayTeamID) === String(away.TeamID)) { am++; if (as > hs) aw++; else if (as === hs) ad++; }
    }
    const draw = hm + am ? (hd + ad) / (hm + am) : 0.25;
    return { home: hm ? hw / hm : 0.5, away: am ? aw / am : 0.5, draw: Math.min(0.45, draw) };
  },

  homeAway(match, results, matches) {
    let hw = 0, hm = 0, hd = 0, aw = 0, am = 0, ad = 0;
    for (const r of results) {
      const m = matches.find(x => String(x.MatchID) === String(r.MatchID));
      if (!m) continue;
      const hs = this.score(r.FTScore, true), as = this.score(r.FTScore, false);
      if (String(m.HomeTeamID) === String(match.HomeTeamID)) { hm++; if (hs > as) hw++; else if (hs === as) hd++; }
      if (String(m.AwayTeamID) === String(match.AwayTeamID)) { am++; if (as > hs) aw++; else if (as === hs) ad++; }
    }
    const draw = hm + am ? (hd + ad) / (hm + am) : 0.25;
    return { home: hm ? hw / hm : 0.5, away: am ? aw / am : 0.5, draw: Math.min(0.45, draw) };
  },

  headToHead(match, results, matches) {
    let home = 0, draw = 0, away = 0, total = 0;
    for (const r of results) {
      const m = matches.find(x => String(x.MatchID) === String(r.MatchID));
      if (!m) continue;
      const sameHome = String(m.HomeTeamID) === String(match.HomeTeamID) && String(m.AwayTeamID) === String(match.AwayTeamID);
      const sameRev = String(m.HomeTeamID) === String(match.AwayTeamID) && String(m.AwayTeamID) === String(match.HomeTeamID);
      if (!sameHome && !sameRev) continue;
      total++;
      const hs = this.score(r.FTScore, true), as = this.score(r.FTScore, false);
      if (sameHome) { if (hs > as) home++; else if (hs === as) draw++; else away++; }
      else { if (hs > as) away++; else if (hs === as) draw++; else home++; }
    }
    if (total < 3) return { home: 0.33, draw: 0.34, away: 0.33 };
    return { home: home / total, draw: draw / total, away: away / total };
  },

  goalPattern(results) {
    let total = 0, goals = 0, draw = 0;
    for (const r of results) {
      total++;
      const hs = this.score(r.FTScore, true), as = this.score(r.FTScore, false);
      goals += hs + as;
      if (hs === as) draw++;
    }
    const drawRate = total ? draw / total : 0.25;
    return { avgTotal: total ? goals / total : 1.5, home: 0.5, draw: Math.min(0.45, drawRate) };
  },

  htPattern(results) {
    let htGoals = 0, total = 0, htDraw = 0;
    for (const r of (results || [])) {
      const hs = this.score(r.HTScore, true), as = this.score(r.HTScore, false);
      htGoals += hs + as;
      total++;
      if (hs === as) htDraw++;
    }
    const avg = total ? htGoals / total : 0.6;
    const draw = total ? htDraw / total : 0.3;
    return { home: 0.5, away: 0.5, draw: Math.min(0.5, draw), htOver: avg > 0.5 ? 0.5 : 0.3 };
  },

leaguePattern(league, results, matches) {
    let total = 0, avgGoals = 0, homeWin = 0, draw = 0;
    const scale = String((league && league.LeagueScale) || 'NATIONAL').toUpperCase();
    const leaguesAll = league ? (league._allLeagues || []) : [];
    for (const r of (results || [])) {
      const m = matches.find(x => String(x.MatchID) === String(r.MatchID));
      if (!m) continue;
      // Scale-aware: NATIONAL = liga spesifik, CONTINENTAL = semua liga skala benua,
      // UNIVERSAL = semua liga skala universal (dunia)
      if (league) {
        if (scale === 'CONTINENTAL') {
          const mLg = leaguesAll.find(l => String(l.LeagueID) === String(m.LeagueID)) || {};
          if (String(mLg.LeagueScale || 'NATIONAL').toUpperCase() !== 'CONTINENTAL') continue;
        } else if (scale === 'UNIVERSAL') {
          const mLg = leaguesAll.find(l => String(l.LeagueID) === String(m.LeagueID)) || {};
          if (String(mLg.LeagueScale || 'NATIONAL').toUpperCase() !== 'UNIVERSAL') continue;
        } else {
          if (m.LeagueID && String(m.LeagueID) !== String(league.LeagueID)) continue;
        }
      }
      total++;
      const hs = this.score(r.FTScore, true), as = this.score(r.FTScore, false);
      avgGoals += (hs + as);
      if (hs > as) homeWin++; else if (hs === as) draw++;
    }
    if (!total) return { avgGoals: 2.5, homeWin: 0.45, drawRate: 0.25, awayWin: 0.3 };
    return { avgGoals: avgGoals / total, homeWin: homeWin / total, drawRate: draw / total, awayWin: (total - homeWin - draw) / total };
  },

  learningCorrection(learning, form, oddsVal) {
    // Adjust based on historical market accuracy (placeholder blend)
    let correct = 0;
    (learning || []).forEach(l => {
      if (l.Correct === true || l.Correct === 'TRUE' || l.Correct === 'true') correct++;
    });
    const n = (learning || []).length;
    const acc = n ? correct / n : 0.5;
    const adj = 0.3 + acc * 0.4; // 0.5..0.7 shift toward form/odds
    return {
      home: form.home * adj / (oddsVal.home || 1),
      draw: form.draw,
      away: form.away * adj / (oddsVal.away || 1)
    };
  },

  oddsValue(odds) {
    if (!odds) return { home: 0.5, draw: 0.25, away: 0.5 };
    const h = parseFloat(odds.HomeOdds) || 2, d = parseFloat(odds.DrawOdds) || 3.2, a = parseFloat(odds.AwayOdds) || 3.5;
    const ih = 1 / h, id = 1 / d, ia = 1 / a, s = ih + id + ia || 1;
    return { home: ih / s, draw: id / s, away: ia / s };
  },

  // Implied over/under probability dari odds (agar bisa recommend UNDER juga)
  oddsValueOU(odds) {
    if (!odds) return 0.5;
    const over = parseFloat(odds.OverOdds), under = parseFloat(odds.UnderOdds);
    const ov = (!isNaN(over) && over > 0) ? over : 1.9;
    const un = (!isNaN(under) && under > 0) ? under : 1.9;
    const io = 1 / ov, iu = 1 / un, s = io + iu || 1;
    return io / s;
  },

  // Implied odd/even probability dari odds
  oddsValueOE(odds) {
    if (!odds) return 0.5;
    const odd = parseFloat(odds.OddOdds), even = parseFloat(odds.EvenOdds);
    const od = (!isNaN(odd) && odd > 0) ? odd : 1.9;
    const ev = (!isNaN(even) && even > 0) ? even : 1.9;
    const io = 1 / od, ie = 1 / ev, s = io + ie || 1;
    return io / s;
  },

// Probabilitas OVER/UNDER yang JUJUR memakai distribusi Poisson total gol.
  // Ini menggantikan rumus eksponensial lama yang selalu memberikan OVER besar
  // (contoh: avgGoals 2.5 → OVER 2.5 hanya ~48%, bukan 86%).
  overProbability(avgGoals, line) {
    const lam = avgGoals;
    const L = (line != null && !isNaN(line) && line > 0) ? parseFloat(line) : 2.5;
    // P(total >= L) dgn Poisson: 1 - P(total <= L-1) ; untuk L pecahan (.25/.75)
    // kita hitung peluang total gol >= ceil(L) untuk garis .25/.75 superior/inferior.
    let p = 0;
    if (L % 1 === 0.25 || L % 1 === 0.75) {
      // garis .25/.75: OVER menang penuh jika total >= ceil(L), setengah jika = floor
      const floor = Math.floor(L), ceil = Math.floor(L) + 1;
      const pFloor = this.poissonCdf(floor, lam);
      const pCeil = this.poissonCdf(ceil - 1, lam);
      p = (1 - pCeil) + 0.5 * (pCeil - pFloor);
    } else {
      // garis penuh / .5: OVER menang jika total >= L
      const kReq = (L % 1 === 0) ? L : Math.floor(L) + 1;
      p = 1 - this.poissonCdf(kReq - 1, lam);
    }
    return Math.min(0.92, Math.max(0.08, p));
  },

  // CDF Poisson: P(X <= k) untuk mean lam
  poissonCdf(k, lam) {
    let sum = 0;
    for (let i = 0; i <= k; i++) sum += this.poissonPmf(i, lam);
    return sum;
  },
  // PMF Poisson: P(X = k)
  poissonPmf(k, lam) {
    if (k < 0) return 0;
    const e = Math.exp(-lam);
    let fact = 1;
    for (let i = 1; i <= k; i++) fact *= i;
    return (Math.pow(lam, k) * e) / fact;
  },

  // Akurasi historis per market dari data Learning — ini inti "sistem belajar".
  // Semakin banyak data validasi, semakin akurat penyesuaian confidence per market.
  marketAccuracy(learning) {
    const byMarket = {};
    (learning || []).forEach(l => {
      const m = l.Market || 'FT_1X2';
      if (!byMarket[m]) byMarket[m] = { total: 0, correct: 0 };
      byMarket[m].total++;
      if (l.Correct === true || l.Correct === 'TRUE' || l.Correct === 'true') byMarket[m].correct++;
    });
    const out = {};
    Object.keys(byMarket).forEach(m => {
      const b = byMarket[m];
      out[m] = b.total > 0 ? b.correct / b.total : 0.5;
    });
    return out;
  },

  // Pola per klub (home/away tendency + over/under tendency) — engine belajar dari data
  clubPattern(match, results, matches) {
    const home = match.HomeTeamID, away = match.AwayTeamID;
    let hM = 0, hW = 0, hD = 0, hOver = 0, aM = 0, aW = 0, aD = 0, aOver = 0;
    for (const r of results) {
      const m = matches.find(x => String(x.MatchID) === String(r.MatchID));
      if (!m) continue;
      const hs = this.score(r.FTScore, true), as = this.score(r.FTScore, false);
      if (String(m.HomeTeamID) === String(home)) { hM++; if (hs > as) hW++; else if (hs === as) hD++; if ((hs + as) >= 2.5) hOver++; }
      if (String(m.AwayTeamID) === String(away)) { aM++; if (as > hs) aW++; else if (as === hs) aD++; if ((hs + as) >= 2.5) aOver++; }
    }
    const hp = hM > 0 ? hW / hM : 0.5;
    const ap = aM > 0 ? aW / aM : 0.5;
    const dp = (hM + aM) > 0 ? (hD + aD) / (hM + aM) : 0.25;
    const hOverRate = hM > 0 ? hOver / hM : 0.5;
    const aOverRate = aM > 0 ? aOver / aM : 0.5;
    return { home: hp, away: ap, draw: Math.min(0.4, dp), hOverRate, aOverRate };
  },

  // Bangun daftar kandidat rekomendasi dari semua market, urutkan probabilitas tertinggi
  buildCandidates(pHome, pDraw, pAway, ft1x2, ftHDP, ftOU, ftOE, overProb, oddProb, ouLine, hdpHomeLine, hdpAwayLine, lgPat, clubPat, avgGoals) {
    const arr = [];
    const hdpPick = String(ftHDP).indexOf('HOME') === 0;
    const hdpC = hdpPick ? Math.max(pHome * 100, 50 + (pHome - pAway) * 100) : Math.max(pAway * 100, 50 + (pAway - pHome) * 100);
    arr.push({ pick: ft1x2, prob: Math.max(pHome, pDraw, pAway) * 100 });
    arr.push({ pick: ftHDP, prob: Math.min(85, hdpC) });
    arr.push({ pick: ftOE, prob: oddProb * 100 });
    // Peluang under & over terpisah agar bisa rekomendasi under
    arr.push({ pick: 'OVER ' + ouLine, prob: overProb * 100 });
    arr.push({ pick: 'UNDER ' + ouLine, prob: (1 - overProb) * 100 });
    arr.sort((a, b) => b.prob - a.prob);
    return arr;
  },

score(str, home) {
    if (!str) return 0;
    const p = String(str).split(':');
    if (p.length < 2) return 0;
    return home ? (parseInt(p[0]) || 0) : (parseInt(p[1]) || 0);
  },

  // String → seed angka (deterministik)
  hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  },

  // PRNG mulberry32 (deterministik)
  mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  // Poisson sampling (Knuth) memakai PRNG tertentu
  poisson(lambda, rng) {
    const L = Math.max(0, lambda);
    if (L > 12) { // normal approximation untuk lambda besar
      return Math.max(0, Math.round(L + Math.sqrt(L) * (rng() + rng() + rng() - 1.5)));
    }
    let k = 0;
    let p = 1;
    const e = Math.exp(-L);
    do {
      k++;
      p *= rng();
    } while (p > e);
    return k - 1;
  },

  // Probabilitas Poisson untuk skor persis (home=hs, away=as) — biar ScoreProb realistis
  poissonProb(hs, as, lamH, lamA) {
    const f = (k, lam) => {
      if (k < 0) return 0;
      const e = Math.exp(-lam);
      let fact = 1;
      for (let i = 1; i <= k; i++) fact *= i;
      return (Math.pow(lam, k) * e) / fact;
    };
    return f(hs, Math.max(0.3, lamH)) * f(as, Math.max(0.3, lamA));
  }
};
