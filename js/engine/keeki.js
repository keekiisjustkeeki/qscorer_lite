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
    const league = (data.leagues || []).find(l => String(l.LeagueID) === String(match.LeagueID)) || {};

    // 8 components per engine.md
    const form = this.formAnalysis(home, away, results, matches);
    const ha = this.homeAway(match, results, matches);
    const h2h = this.headToHead(match, results, matches);
    const goal = this.goalPattern(results);
    const htPat = this.htPattern(results);
    const lgPat = this.leaguePattern(league, results, matches);
    const oddsVal = this.oddsValue(odds);
    const learnCorr = this.learningCorrection(learning, form, oddsVal);

    const w = this.getWeights(learning);
    const hs = w.w1 * form.home + w.w2 * ha.home + w.w3 * h2h.home + w.w4 * goal.home + w.w5 * htPat.home + w.w6 * lgPat.homeWin + w.w7 * oddsVal.home + w.w8 * learnCorr.home;
    const ds = w.w1 * form.draw + w.w2 * ha.draw + w.w3 * h2h.draw + w.w4 * goal.draw + w.w5 * htPat.draw + w.w6 * lgPat.drawRate + w.w7 * oddsVal.draw + w.w8 * learnCorr.draw;
    const as = w.w1 * form.away + w.w2 * ha.away + w.w3 * h2h.away + w.w4 * goal.away + w.w5 * htPat.away + w.w6 * lgPat.awayWin + w.w7 * oddsVal.away + w.w8 * learnCorr.away;
    const total = hs + ds + as || 1;
    const pHome = hs / total, pDraw = ds / total, pAway = as / total;

    const ouLine = odds && odds.OU_Line ? parseFloat(odds.OU_Line) : 2.5;
    const avgGoals = (goal.avgTotal + lgPat.avgGoals) / 2;
    const overProb = Math.min(0.9, Math.max(0.1, 1 - Math.exp(-avgGoals * 0.8)));

    const ft1x2 = pHome >= pDraw && pHome >= pAway ? 'HOME' : (pAway >= pDraw ? 'AWAY' : 'DRAW');
    const ftOU = overProb >= 0.5 ? 'OVER ' + ouLine : 'UNDER ' + ouLine;
    // Odd/Even berdasarkan probabilitas gol (bukan Math.random)
    const oddProb = Math.min(0.9, Math.max(0.1, 0.55 - (avgGoals % 2) * 0.1));
    const ftOE = oddProb >= 0.5 ? 'ODD' : 'EVEN';
    const hdpHome = pHome - pAway;
    const ftHDP = hdpHome >= 0 ? 'HOME ' + (odds && odds.HDPHome ? odds.HDPHome : '-0.5') : 'AWAY ' + (odds && odds.HDPAway ? odds.HDPAway : '+0.5');
    const ht1x2 = pHome >= 0.34 ? 'HOME' : (pAway >= 0.34 ? 'AWAY' : 'DRAW');
    const htOU = avgGoals >= 0.8 ? 'OVER 0.5' : 'UNDER 0.5';
    const htHDP = hdpHome >= 0 ? 'HOME' : 'AWAY';

    const confidence = Math.round(Math.max(pHome, pDraw, pAway) * 100);
    const probArr = [
      ['FT 1X2', ft1x2, 100 * Math.max(pHome, pDraw, pAway)],
      ['FT O/U', ftOU, 100 * overProb],
      ['HT 1X2', ht1x2, 100 * Math.max(pHome, pDraw, pAway)]
    ].sort((a, b) => b[2] - a[2]);
    const rec = probArr[0][2] >= 70 ? probArr[0][1] : ftOU;

    // Prediksi Skor HT & FT (Blueprint #8)
    const htHome = Math.round(pHome * avgGoals * 0.45);
    const htAway = Math.round(pAway * avgGoals * 0.45);
    const ftHome = Math.round(pHome * avgGoals);
    const ftAway = Math.round(pAway * avgGoals);

    return {
      home: this.teamLabel(home), away: this.teamLabel(away),
      FT_1X2: ft1x2, FT_HDP: ftHDP, FT_OU: ftOU, FT_OddEven: ftOE,
      HT_1X2: ht1x2, HT_HDP: htHDP, HT_OU: htOU,
      Confidence: confidence, Recommendation: rec,
      HTScore: htHome + '-' + htAway, FTScore: ftHome + '-' + ftAway,
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
    let hw = 0, hm = 0, aw = 0, am = 0;
    for (const r of results) {
      const m = matches.find(x => String(x.MatchID) === String(r.MatchID));
      if (!m) continue;
      const hs = this.score(r.FTScore, true), as = this.score(r.FTScore, false);
      if (String(m.HomeTeamID) === String(home.TeamID)) { hm++; if (hs > as) hw++; }
      if (String(m.AwayTeamID) === String(home.TeamID)) { hm++; if (as > hs) hw++; }
      if (String(m.HomeTeamID) === String(away.TeamID)) { am++; if (hs > as) aw++; }
      if (String(m.AwayTeamID) === String(away.TeamID)) { am++; if (as > hs) aw++; }
    }
    return { home: hm ? hw / hm : 0.5, away: am ? aw / am : 0.5, draw: 0.25 };
  },

  homeAway(match, results, matches) {
    let hw = 0, hm = 0, aw = 0, am = 0;
    for (const r of results) {
      const m = matches.find(x => String(x.MatchID) === String(r.MatchID));
      if (!m) continue;
      const hs = this.score(r.FTScore, true), as = this.score(r.FTScore, false);
      if (String(m.HomeTeamID) === String(match.HomeTeamID)) { hm++; if (hs > as) hw++; }
      if (String(m.AwayTeamID) === String(match.AwayTeamID)) { am++; if (as > hs) aw++; }
    }
    return { home: hm ? hw / hm : 0.5, away: am ? aw / am : 0.5, draw: 0.25 };
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
    let total = 0, goals = 0;
    for (const r of results) {
      total++;
      goals += this.score(r.FTScore, true) + this.score(r.FTScore, false);
    }
    return { avgTotal: total ? goals / total : 1.5, home: 0.5, draw: 0.25 };
  },

  htPattern(results) {
    let htGoals = 0, total = 0;
    for (const r of (results || [])) {
      htGoals += this.score(r.HTScore, true) + this.score(r.HTScore, false);
      total++;
    }
    const avg = total ? htGoals / total : 0.6;
    return { home: 0.5, away: 0.5, draw: 0.3, htOver: avg > 0.5 ? 0.5 : 0.3 };
  },

  leaguePattern(league, results, matches) {
    let total = 0, avgGoals = 0, homeWin = 0, draw = 0;
    for (const r of (results || [])) {
      const m = matches.find(x => String(x.MatchID) === String(r.MatchID));
      if (!m) continue;
      if (league && m.LeagueID && String(m.LeagueID) !== String(league.LeagueID)) continue;
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

  score(str, home) {
    if (!str) return 0;
    const p = String(str).split(':');
    if (p.length < 2) return 0;
    return home ? (parseInt(p[0]) || 0) : (parseInt(p[1]) || 0);
  }
};
