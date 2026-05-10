// ════════════════════════════════════════════════════════
//  PARIDEX RECOMMENDATIONS V4
//  Correctifs :
//  - cotes Unibet priorisées / strictes par défaut
//  - aucune cote estimée inventée
//  - diversification des matchs dans les 20 combinés
//  - combinés de 2 à 5 sélections selon le risque
//  - ajout ligue + textes français + forme API-Football quand disponible
//  GET /api/recommendations?days=3&risk=mod&limit=20&sports=foot,basket,tennis
//  Options utiles :
//    &unibetOnly=1   défaut : n'utilise que les cotes Unibet quand disponibles
//    &unibetOnly=0   autorise Betclic/Winamax/Pinnacle si Unibet absent
//    &maxLegs=4      force le nombre max de sélections par combiné
// ════════════════════════════════════════════════════════

const ODDS_BASE = 'https://api.the-odds-api.com/v4';
const FOOTBALL_BASE = 'https://v3.football.api-sports.io';

const DEFAULT_SPORTS = [
  'soccer_france_ligue_one',
  'soccer_france_ligue_two',
  'soccer_epl',
  'soccer_spain_la_liga',
  'soccer_italy_serie_a',
  'soccer_germany_bundesliga',
  'soccer_uefa_champs_league',
  'soccer_uefa_europa_league',
  'basketball_nba',
  'basketball_euroleague',
  'tennis_atp_french_open',
  'tennis_wta_french_open',
];

const UI_SPORT_MAP = {
  foot: [
    'soccer_france_ligue_one',
    'soccer_france_ligue_two',
    'soccer_epl',
    'soccer_spain_la_liga',
    'soccer_italy_serie_a',
    'soccer_germany_bundesliga',
    'soccer_uefa_champs_league',
    'soccer_uefa_europa_league',
    'soccer_uefa_europa_conference_league',
    'soccer_netherlands_eredivisie',
    'soccer_portugal_primeira_liga',
    'soccer_turkey_super_league',
    'soccer_brazil_campeonato',
    'soccer_argentina_primera_division',
    'soccer_usa_mls',
  ],
  basket: [
    'basketball_nba',
    'basketball_euroleague',
    'basketball_ncaab',
    'basketball_wnba',
  ],
  tennis: [
    'tennis_atp_french_open',
    'tennis_wta_french_open',
    'tennis_atp_wimbledon',
    'tennis_wta_wimbledon',
    'tennis_atp_us_open',
    'tennis_wta_us_open',
  ],
  hockey: ['icehockey_nhl'],
  baseball: ['baseball_mlb'],
};

const SPORT_META = {
  soccer_france_ligue_one: ['⚽', 'foot', 'Ligue 1'],
  soccer_france_ligue_two: ['⚽', 'foot', 'Ligue 2'],
  soccer_epl: ['⚽', 'foot', 'Premier League'],
  soccer_spain_la_liga: ['⚽', 'foot', 'La Liga'],
  soccer_italy_serie_a: ['⚽', 'foot', 'Serie A'],
  soccer_germany_bundesliga: ['⚽', 'foot', 'Bundesliga'],
  soccer_uefa_champs_league: ['⚽', 'foot', 'Ligue des Champions'],
  soccer_uefa_europa_league: ['⚽', 'foot', 'Europa League'],
  soccer_uefa_europa_conference_league: ['⚽', 'foot', 'Conference League'],
  soccer_netherlands_eredivisie: ['⚽', 'foot', 'Eredivisie'],
  soccer_portugal_primeira_liga: ['⚽', 'foot', 'Liga Portugal'],
  soccer_turkey_super_league: ['⚽', 'foot', 'Süper Lig'],
  soccer_brazil_campeonato: ['⚽', 'foot', 'Brésil Série A'],
  soccer_argentina_primera_division: ['⚽', 'foot', 'Argentine Primera'],
  soccer_usa_mls: ['⚽', 'foot', 'MLS'],
  basketball_nba: ['🏀', 'basket', 'NBA'],
  basketball_euroleague: ['🏀', 'basket', 'EuroLeague'],
  basketball_ncaab: ['🏀', 'basket', 'NCAA Basket'],
  basketball_wnba: ['🏀', 'basket', 'WNBA'],
  tennis_atp_french_open: ['🎾', 'tennis', 'Roland-Garros ATP'],
  tennis_wta_french_open: ['🎾', 'tennis', 'Roland-Garros WTA'],
  tennis_atp_wimbledon: ['🎾', 'tennis', 'Wimbledon ATP'],
  tennis_wta_wimbledon: ['🎾', 'tennis', 'Wimbledon WTA'],
  tennis_atp_us_open: ['🎾', 'tennis', 'US Open ATP'],
  tennis_wta_us_open: ['🎾', 'tennis', 'US Open WTA'],
  icehockey_nhl: ['🏒', 'hockey', 'NHL'],
  baseball_mlb: ['⚾', 'baseball', 'MLB'],
};

const UNIBET_KEYS = ['unibet', 'unibet_fr', 'unibet_eu', 'unibet_uk'];
const FALLBACK_BOOKMAKERS = [
  'betclic', 'betclic_fr', 'winamax', 'winamax_fr', 'pinnacle', 'betfair_ex_eu', 'betfair', 'bet365', 'williamhill',
];

const CACHE = new Map();

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
}

function json(res, status, payload) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(payload));
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function oddsIso(date) {
  // The Odds API refuse les millisecondes : YYYY-MM-DDTHH:MM:SSZ uniquement.
  return new Date(date).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function toDateOnly(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

function formatKickoff(iso) {
  const d = new Date(iso);
  const jours = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const mois = ['jan', 'fév', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  return `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]} · ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

function dayDiffFromNow(iso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|afc|cfc|the|club|de|la|le|los|real|team)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function resolveSports(requestedSports) {
  const raw = Array.isArray(requestedSports) ? requestedSports : [];
  const expanded = [];
  for (const item of raw) {
    const key = String(item || '').trim();
    if (!key) continue;
    if (UI_SPORT_MAP[key]) expanded.push(...UI_SPORT_MAP[key]);
    else expanded.push(key);
  }
  return [...new Set(expanded.length ? expanded : DEFAULT_SPORTS)];
}

async function cached(key, ttlMs, fn) {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.savedAt < ttlMs) return hit.value;
  const value = await fn();
  CACHE.set(key, { savedAt: Date.now(), value });
  return value;
}

async function fetchJson(url, options = {}) {
  const resp = await fetch(url, options);
  const text = await resp.text();
  let body;
  try { body = text ? JSON.parse(text) : null; }
  catch { body = { raw: text }; }
  if (!resp.ok) {
    const err = new Error(body?.message || body?.error || body?.raw || `HTTP ${resp.status}`);
    err.statusCode = resp.status;
    err.body = body;
    err.headers = Object.fromEntries(resp.headers.entries());
    throw err;
  }
  return { body, headers: Object.fromEntries(resp.headers.entries()) };
}

function isUnibet(bookmaker) {
  const key = String(bookmaker?.key || '').toLowerCase();
  const title = String(bookmaker?.title || '').toLowerCase();
  return UNIBET_KEYS.includes(key) || title.includes('unibet');
}

function chooseBookmaker(event, unibetOnly) {
  const bookmakers = Array.isArray(event.bookmakers) ? event.bookmakers : [];
  const unibet = bookmakers.find(isUnibet);
  if (unibet) return { bookmaker: unibet, exactUnibet: true };

  if (unibetOnly) return { bookmaker: null, exactUnibet: false };

  for (const key of FALLBACK_BOOKMAKERS) {
    const found = bookmakers.find((b) => String(b.key || '').toLowerCase() === key || String(b.title || '').toLowerCase().includes(key.replace('_fr', '')));
    if (found) return { bookmaker: found, exactUnibet: false };
  }
  return { bookmaker: bookmakers[0] || null, exactUnibet: false };
}

function marketByKey(bookmaker, key) {
  return bookmaker?.markets?.find((m) => m.key === key) || null;
}

function outcomeByName(outcomes, name) {
  const n = norm(name);
  return outcomes?.find((o) => norm(o.name) === n) || null;
}

function leagueNameFor(event, sportKey) {
  return SPORT_META[sportKey]?.[2] || event.sport_title || sportKey;
}

function sportIconFor(sportKey) {
  return SPORT_META[sportKey]?.[0] || '🏟️';
}

function sportSlugFor(sportKey) {
  return SPORT_META[sportKey]?.[1] || 'sport';
}

function makeSelection(event, sportKey, bookmaker, exactUnibet, outcome, side, marketLabel, marketType, rawOdds) {
  const odd = Number(outcome.price);
  if (!Number.isFinite(odd) || odd < 1.05 || odd > 20) return null;

  const implied = 1 / odd;
  const league = leagueNameFor(event, sportKey);
  const sport = sportIconFor(sportKey);
  const sk = sportSlugFor(sportKey);
  const kickoff = event.commence_time;
  const title = bookmaker?.title || bookmaker?.key || 'Bookmaker';
  const sourceText = exactUnibet ? 'Unibet' : title;
  const p = Math.round(implied * 100);
  const bookmakerWarning = exactUnibet
    ? 'Cote Unibet récupérée directement via The Odds API.'
    : `Cote ${sourceText}, à vérifier sur Unibet car Unibet n'était pas disponible dans la réponse API.`;

  return {
    id: `${event.id}:${marketType}:${side}:${outcome.name}`,
    eventId: event.id,
    sportKey,
    sport,
    sk,
    league,
    ligue: league,
    commenceTime: kickoff,
    commence: kickoff,
    date: toDateOnly(kickoff),
    ko: new Date(kickoff).getTime(),
    day: dayDiffFromNow(kickoff),
    h: formatKickoff(kickoff),
    homeTeam: event.home_team,
    awayTeam: event.away_team,
    m: event.home_team,
    vs: event.away_team,
    pick: outcome.name,
    market: marketLabel,
    mkt: marketLabel,
    marketType,
    side,
    odd,
    cote: odd,
    bookmaker: title,
    bookmakerKey: bookmaker?.key || null,
    exactUnibet,
    bookmakerWarning,
    rawHomeOdd: rawOdds.home || null,
    rawAwayOdd: rawOdds.away || null,
    rawDrawOdd: rawOdds.draw || null,
    ub: exactUnibet,
    ubm: `${marketLabel}${exactUnibet ? '' : ' · non Unibet'}`,
    ubc: odd,
    impliedProbability: implied,
    pm: p,
    pr: p,
    ce: null,
    fh: null,
    lh: null,
    patterns: [],
    tend: null,
    alert: exactUnibet ? null : 'Cote non-Unibet : vérification obligatoire avant de miser.',
    tip: null,
    why: `${bookmakerWarning} Probabilité implicite : ${p}%. Ligue : ${league}.`,
    analysisFr: `Sélection basée sur une vraie cote ${sourceText}. Marché : ${marketLabel}.`,
    dataQuality: exactUnibet ? 'unibet_odds' : 'other_bookmaker_odds',
    apiFootball: null,
    _predictions: null,
    _homeStats: null,
    _awayStats: null,
  };
}

function extractSelections(event, sportKey, unibetOnly) {
  const { bookmaker, exactUnibet } = chooseBookmaker(event, unibetOnly);
  if (!bookmaker) return [];

  const h2h = marketByKey(bookmaker, 'h2h');
  if (!h2h?.outcomes?.length) return [];

  const home = outcomeByName(h2h.outcomes, event.home_team);
  const away = outcomeByName(h2h.outcomes, event.away_team);
  const draw = h2h.outcomes.find((o) => ['draw', 'nul', 'x'].includes(String(o.name).toLowerCase()));

  const rawOdds = {
    home: home ? Number(home.price) : null,
    away: away ? Number(away.price) : null,
    draw: draw ? Number(draw.price) : null,
  };

  const selections = [];

  // Ne propose pas toutes les issues : seulement les issues rationnelles.
  // Ça évite 20 combinés basés sur les mêmes matchs avec des marchés différents.
  const candidates = [];
  if (home) candidates.push({ outcome: home, side: 'home', label: `${event.home_team} gagne (1)`, type: '1' });
  if (away) candidates.push({ outcome: away, side: 'away', label: `${event.away_team} gagne (2)`, type: '2' });
  if (draw) candidates.push({ outcome: draw, side: 'draw', label: 'Match nul (N)', type: 'N' });

  // Favori + éventuellement outsider raisonnable. Pas de doubles chances calculées/inventées.
  candidates
    .filter((c) => Number(c.outcome.price) >= 1.10 && Number(c.outcome.price) <= 4.50)
    .sort((a, b) => Number(a.outcome.price) - Number(b.outcome.price))
    .slice(0, sportSlugFor(sportKey) === 'tennis' ? 2 : 2)
    .forEach((c) => {
      const s = makeSelection(event, sportKey, bookmaker, exactUnibet, c.outcome, c.side, c.label, c.type, rawOdds);
      if (s) selections.push(s);
    });

  // Totals réel uniquement si The Odds API le renvoie. Aucune estimation.
  const totals = marketByKey(bookmaker, 'totals');
  if (totals?.outcomes?.length) {
    const over = totals.outcomes.find((o) => String(o.name).toLowerCase() === 'over' && Number(o.point) === 2.5)
      || totals.outcomes.find((o) => String(o.name).toLowerCase() === 'over');
    if (over && Number(over.price) >= 1.20 && Number(over.price) <= 3.20) {
      const label = sportSlugFor(sportKey) === 'foot'
        ? `+${over.point || 2.5} buts dans le match`
        : `Total points : Over ${over.point || ''}`.trim();
      const s = makeSelection(event, sportKey, bookmaker, exactUnibet, over, 'over', label, 'over', rawOdds);
      if (s) selections.push(s);
    }
  }

  return selections;
}

function baseScore(selection, risk) {
  const odd = Number(selection.odd);
  const p = Number(selection.impliedProbability || (1 / odd));
  let oddFit;
  if (risk === 'safe') oddFit = odd <= 1.60 ? 1 : odd <= 2.05 ? 0.75 : 0.35;
  else if (risk === 'bold') oddFit = odd >= 1.45 && odd <= 3.50 ? 1 : 0.55;
  else oddFit = odd >= 1.25 && odd <= 2.40 ? 1 : 0.60;
  const drawPenalty = selection.side === 'draw' ? 0.72 : 1;
  const unibetBonus = selection.exactUnibet ? 6 : -5;
  const marketBonus = selection.marketType === 'over' ? 1 : 3;
  return clamp(Math.round(p * 65 + oddFit * 24 + drawPenalty * 7 + unibetBonus + marketBonus), 1, 99);
}

async function fetchOddsForSport(sportKey, fromIso, toIso) {
  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    const err = new Error('Missing ODDS_API_KEY in Vercel Environment Variables');
    err.statusCode = 500;
    throw err;
  }

  const url = new URL(`${ODDS_BASE}/sports/${encodeURIComponent(sportKey)}/odds`);
  url.searchParams.set('apiKey', apiKey);
  url.searchParams.set('regions', 'eu,uk');
  url.searchParams.set('markets', 'h2h,totals');
  url.searchParams.set('oddsFormat', 'decimal');
  url.searchParams.set('dateFormat', 'iso');
  url.searchParams.set('commenceTimeFrom', fromIso);
  url.searchParams.set('commenceTimeTo', toIso);

  return cached(`odds:${url.toString()}`, 2 * 60 * 1000, async () => fetchJson(url));
}

async function fetchFootball(path, params) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    const err = new Error('Missing API_FOOTBALL_KEY in Vercel Environment Variables');
    err.statusCode = 500;
    throw err;
  }
  const url = new URL(`${FOOTBALL_BASE}${path}`);
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  return cached(`apifoot:${url.toString()}`, 30 * 60 * 1000, async () => fetchJson(url, {
    headers: { Accept: 'application/json', 'x-apisports-key': apiKey },
  }));
}

async function fetchFootballFixturesByDate(date) {
  const { body } = await fetchFootball('/fixtures', { date });
  return Array.isArray(body?.response) ? body.response : [];
}

function matchFixture(selection, fixtures) {
  const h = norm(selection.homeTeam);
  const a = norm(selection.awayTeam);
  return fixtures.find((f) => {
    const fh = norm(f?.teams?.home?.name);
    const fa = norm(f?.teams?.away?.name);
    return (fh === h && fa === a) || (fh === a && fa === h)
      || (fh.includes(h) && fa.includes(a)) || (h.includes(fh) && a.includes(fa));
  }) || null;
}

function resultForTeam(fixture, teamId) {
  const homeId = fixture?.teams?.home?.id;
  const awayId = fixture?.teams?.away?.id;
  const gh = Number(fixture?.goals?.home);
  const ga = Number(fixture?.goals?.away);
  if (!Number.isFinite(gh) || !Number.isFinite(ga)) return null;
  const isHome = teamId === homeId;
  const gf = isHome ? gh : ga;
  const gc = isHome ? ga : gh;
  if (gf > gc) return 'W';
  if (gf === gc) return 'D';
  return 'L';
}

async function lastForm(teamId) {
  if (!teamId) return [];
  const { body } = await fetchFootball('/fixtures', { team: teamId, last: 5 });
  const arr = Array.isArray(body?.response) ? body.response : [];
  return arr.map((f) => resultForTeam(f, teamId)).filter(Boolean).slice(-5);
}

function formScore(form) {
  if (!Array.isArray(form) || !form.length) return null;
  const points = form.reduce((sum, r) => sum + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);
  return Math.round((points / (form.length * 3)) * 100);
}

function predictionConfidenceForSelection(selection, predictionBody) {
  const pred = predictionBody?.response?.[0]?.predictions;
  if (!pred) return null;
  const percent = pred.percent || {};
  let rawPercent = null;
  if (selection.side === 'home') rawPercent = percent.home;
  if (selection.side === 'draw') rawPercent = percent.draw;
  if (selection.side === 'away') rawPercent = percent.away;
  const parsedPercent = Number(String(rawPercent || '').replace('%', ''));
  const winnerName = pred.winner?.name;
  const winnerBoost = winnerName && norm(winnerName) === norm(selection.pick) ? 8 : 0;
  if (Number.isFinite(parsedPercent)) return clamp(parsedPercent + winnerBoost, 1, 99);
  return null;
}

function patternsFromForms(homeForm, awayForm, selection) {
  const patterns = [];
  const hWins = homeForm.filter((x) => x === 'W').length;
  const aWins = awayForm.filter((x) => x === 'W').length;
  if (selection.side === 'home' && hWins >= 3) patterns.push('form5');
  if (selection.side === 'away' && aWins >= 3) patterns.push('form5');
  if (homeForm.length && awayForm.length && !homeForm.includes('L') && !awayForm.includes('W')) patterns.push('h2h');
  return patterns;
}

async function enrichFootballSelections(selections) {
  const football = selections.filter((s) => String(s.sportKey).startsWith('soccer_'));
  const byDate = [...new Set(football.map((s) => s.date))];
  const fixturesByDate = new Map();

  for (const date of byDate) {
    try { fixturesByDate.set(date, await fetchFootballFixturesByDate(date)); }
    catch { fixturesByDate.set(date, []); }
  }

  // Enrichit seulement les meilleurs matchs uniques pour préserver le quota.
  const uniqueEventIds = [];
  for (const s of football.sort((a, b) => b.score - a.score)) {
    if (!uniqueEventIds.includes(s.eventId)) uniqueEventIds.push(s.eventId);
    if (uniqueEventIds.length >= 10) break;
  }
  const allowed = new Set(uniqueEventIds);

  const out = [];
  for (const s of selections) {
    if (!String(s.sportKey).startsWith('soccer_') || !allowed.has(s.eventId)) {
      out.push(s);
      continue;
    }

    try {
      const fixture = matchFixture(s, fixturesByDate.get(s.date) || []);
      if (!fixture?.fixture?.id) {
        out.push({ ...s, enrichmentNote: 'fixture_not_matched' });
        continue;
      }

      const fixtureId = fixture.fixture.id;
      const homeId = fixture.teams?.home?.id;
      const awayId = fixture.teams?.away?.id;

      const [predRes, homeForm, awayForm] = await Promise.allSettled([
        fetchFootball('/predictions', { fixture: fixtureId }),
        lastForm(homeId),
        lastForm(awayId),
      ]);

      const predictionBody = predRes.status === 'fulfilled' ? predRes.value.body : null;
      const hf = homeForm.status === 'fulfilled' ? homeForm.value : [];
      const af = awayForm.status === 'fulfilled' ? awayForm.value : [];
      const apiConfidence = predictionConfidenceForSelection(s, predictionBody);
      const fsHome = formScore(hf);
      const fsAway = formScore(af);
      const selectedFormScore = s.side === 'away' ? fsAway : s.side === 'home' ? fsHome : null;
      const expertBoost = apiConfidence == null ? 0 : (apiConfidence - 50) * 0.35;
      const formBoost = selectedFormScore == null ? 0 : (selectedFormScore - 50) * 0.18;
      const patterns = patternsFromForms(hf, af, s);
      const pred = predictionBody?.response?.[0]?.predictions || null;
      const advice = pred?.advice || null;

      out.push({
        ...s,
        fixtureId,
        apiFootball: {
          confidence: apiConfidence,
          advice,
          winner: pred?.winner?.name || null,
          home: pred?.percent?.home || null,
          draw: pred?.percent?.draw || null,
          away: pred?.percent?.away || null,
        },
        _predictions: pred ? {
          percentHome: pred?.percent?.home || null,
          percentDraw: pred?.percent?.draw || null,
          percentAway: pred?.percent?.away || null,
          advice,
          winner: pred?.winner?.name || null,
        } : null,
        fh: hf,
        _awayStats: { form: af },
        lh: {
          formHome: hf.join('-') || null,
          formAway: af.join('-') || null,
          W: hf.filter((x) => x === 'W').length,
          D: hf.filter((x) => x === 'D').length,
          L: hf.filter((x) => x === 'L').length,
          bt: null,
          o25: null,
          cs: null,
        },
        patterns,
        ce: apiConfidence,
        pr: apiConfidence || s.pr,
        score: clamp(Math.round((s.score || 0) + expertBoost + formBoost + patterns.length * 2), 1, 99),
        dataQuality: s.exactUnibet ? 'full_unibet_api_football' : 'full_non_unibet_api_football',
        why: buildFrenchWhy({ ...s, apiConfidence, homeForm: hf, awayForm: af, advice, patterns }),
      });
    } catch (err) {
      out.push({ ...s, enrichmentNote: err.statusCode ? `apifoot_http_${err.statusCode}` : 'apifoot_failed' });
    }
  }
  return out;
}

function buildFrenchWhy(s) {
  const parts = [];
  parts.push(s.exactUnibet ? `Cote Unibet réelle : ${Number(s.odd).toFixed(2)}.` : `Cote ${s.bookmaker} : ${Number(s.odd).toFixed(2)} — à comparer sur Unibet.`);
  parts.push(`Ligue : ${s.ligue}.`);
  parts.push(`Probabilité implicite : ${Math.round((1 / Number(s.odd)) * 100)}%.`);
  if (s.apiConfidence) parts.push(`API-Football estime cette issue autour de ${Math.round(s.apiConfidence)}%.`);
  if (s.homeForm?.length) parts.push(`Forme ${s.homeTeam} : ${s.homeForm.join('-')}.`);
  if (s.awayForm?.length) parts.push(`Forme ${s.awayTeam} : ${s.awayForm.join('-')}.`);
  if (s.advice) parts.push(`Conseil API-Football : ${s.advice}.`);
  return parts.join(' ');
}

function product(arr, field) {
  return arr.reduce((acc, item) => acc * Number(item[field] || 1), 1);
}

function getCombinations(items, size, limit = 20000) {
  const out = [];
  const stack = [];
  function walk(start) {
    if (out.length >= limit) return;
    if (stack.length === size) {
      out.push([...stack]);
      return;
    }
    for (let i = start; i < items.length; i += 1) {
      stack.push(items[i]);
      walk(i + 1);
      stack.pop();
    }
  }
  walk(0);
  return out;
}

function eventBaseId(id) {
  return String(id).split(':')[0];
}

function comboSimilarity(a, b) {
  const A = new Set(a.legs.map((l) => l.eventId));
  const B = new Set(b.legs.map((l) => l.eventId));
  const inter = [...A].filter((x) => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union ? inter / union : 0;
}

function comboReason(combo) {
  const leagues = [...new Set(combo.legs.map((l) => l.ligue))].join(' · ');
  const unibetCount = combo.legs.filter((l) => l.exactUnibet).length;
  const formCount = combo.legs.filter((l) => l.fh?.length || l._predictions).length;
  const parts = [];
  parts.push(`Combiné de ${combo.legs.length} sélections.`);
  parts.push(`Ligues : ${leagues}.`);
  parts.push(`${unibetCount}/${combo.legs.length} cote(s) Unibet exacte(s).`);
  if (formCount) parts.push(`${formCount} match(s) enrichi(s) avec forme/prédictions API-Football.`);
  parts.push(`Cote totale ${combo.coteTotale.toFixed(2)} · probabilité implicite ${combo.probVictoire.toFixed(1)}%.`);
  return parts.join(' ');
}

function verdictFor(prob, score) {
  if (prob >= 55 || score >= 82) return '✅ Sûr';
  if (prob >= 38 || score >= 68) return '⚡ Modéré';
  return '⚠️ Audacieux';
}

function buildCombos(selections, risk, maxCombos, requestedMaxLegs) {
  const riskCfg = {
    safe: { sizes: [2, 3], minOdd: 1.70, maxOdd: 8.00, pool: 42, maxExposure: 5 },
    mod: { sizes: [2, 3, 4], minOdd: 2.00, maxOdd: 18.00, pool: 52, maxExposure: 5 },
    bold: { sizes: [3, 4, 5], minOdd: 3.00, maxOdd: 55.00, pool: 60, maxExposure: 6 },
  }[risk] || { sizes: [2, 3, 4], minOdd: 2.00, maxOdd: 18.00, pool: 52, maxExposure: 5 };

  const maxLegs = requestedMaxLegs ? clamp(requestedMaxLegs, 2, 5) : Math.max(...riskCfg.sizes);
  const sizes = riskCfg.sizes.filter((s) => s <= maxLegs);

  // 1 sélection max par match dans le pool principal, sauf si on manque de volume.
  const sorted = selections
    .filter((s) => Number.isFinite(Number(s.odd)) && Number(s.odd) >= 1.08 && Number(s.odd) <= 8.00)
    .sort((a, b) => {
      const au = a.exactUnibet ? 10 : 0;
      const bu = b.exactUnibet ? 10 : 0;
      return (Number(b.score || 0) + bu) - (Number(a.score || 0) + au);
    });

  const byEvent = new Map();
  for (const s of sorted) {
    if (!byEvent.has(s.eventId)) byEvent.set(s.eventId, []);
    byEvent.get(s.eventId).push(s);
  }

  let pool = [...byEvent.values()].map((arr) => arr[0]);
  if (pool.length < 12) {
    // Si très peu d'événements, ajoute une deuxième option par match, mais jamais dans le même combiné.
    for (const arr of byEvent.values()) {
      if (arr[1]) pool.push(arr[1]);
    }
  }
  pool = pool.slice(0, riskCfg.pool);

  const rawCombos = [];
  for (const size of sizes) {
    if (pool.length < size) continue;
    for (const legs of getCombinations(pool, size)) {
      const eventIds = legs.map((l) => l.eventId);
      if (new Set(eventIds).size !== eventIds.length) continue;

      const odd = product(legs, 'odd');
      if (!Number.isFinite(odd) || odd < riskCfg.minOdd || odd > riskCfg.maxOdd) continue;

      // Diversité : évite un combiné 100% même ligue quand possible.
      const leagueCount = new Set(legs.map((l) => l.ligue)).size;
      const sportCount = new Set(legs.map((l) => l.sk)).size;
      const avgScore = legs.reduce((sum, l) => sum + Number(l.score || 0), 0) / legs.length;
      const impliedProbability = legs.reduce((acc, l) => acc * Number(l.impliedProbability || (1 / l.odd)), 1);
      const unibetRatio = legs.filter((l) => l.exactUnibet).length / legs.length;
      const enrichedRatio = legs.filter((l) => l.fh?.length || l._predictions).length / legs.length;
      const diversityBonus = (leagueCount - 1) * 4 + (sportCount - 1) * 5;
      const score = clamp(Math.round(avgScore + unibetRatio * 7 + enrichedRatio * 4 + diversityBonus), 1, 99);

      rawCombos.push({
        id: legs.map((l) => l.id).sort().join('|'),
        title: `Combiné ${legs.length} sélections`,
        legs: legs.map((l) => ({ ...l })),
        odd: Number(odd.toFixed(2)),
        coteTotale: Number(odd.toFixed(2)),
        probability: Number((impliedProbability * 100).toFixed(1)),
        probVictoire: Number((impliedProbability * 100).toFixed(1)),
        probReal: Number((impliedProbability * 100).toFixed(1)),
        rendement: Number(((odd - 1) * 100).toFixed(1)),
        confidence: score,
        score,
        confIntel: score,
        sFiabilite: score,
        sEfficacite: Math.min(100, Math.round((odd - 1) * 45)),
        sExperts: Math.round(avgScore),
        dataQuality: unibetRatio === 1 ? 'unibet' : 'mixed_bookmakers',
      });
    }
  }

  rawCombos.sort((a, b) => {
    // Évite que tous les meilleurs soient les mêmes doublés : favorise score + diversité + taille.
    const adiv = new Set(a.legs.map((l) => l.eventId)).size + new Set(a.legs.map((l) => l.ligue)).size;
    const bdiv = new Set(b.legs.map((l) => l.eventId)).size + new Set(b.legs.map((l) => l.ligue)).size;
    return (b.score * 1.6 + bdiv * 2 + b.legs.length) - (a.score * 1.6 + adiv * 2 + a.legs.length);
  });

  const selected = [];
  const exposure = new Map();
  const exactSeen = new Set();

  for (const c of rawCombos) {
    if (selected.length >= maxCombos) break;
    if (exactSeen.has(c.id)) continue;
    if (selected.some((x) => comboSimilarity(x, c) > 0.50)) continue;

    const overUsed = c.legs.some((l) => (exposure.get(l.eventId) || 0) >= riskCfg.maxExposure);
    if (overUsed && selected.length >= Math.ceil(maxCombos * 0.55)) continue;

    c.verdict = verdictFor(c.probVictoire, c.score);
    c.reason = comboReason(c);
    selected.push(c);
    exactSeen.add(c.id);
    c.legs.forEach((l) => exposure.set(l.eventId, (exposure.get(l.eventId) || 0) + 1));
  }

  // Si la diversification est trop stricte, complète sans similitude forte mais avec exposition limitée.
  if (selected.length < maxCombos) {
    for (const c of rawCombos) {
      if (selected.length >= maxCombos) break;
      if (exactSeen.has(c.id)) continue;
      if (c.legs.some((l) => (exposure.get(l.eventId) || 0) >= riskCfg.maxExposure + 2)) continue;
      c.verdict = verdictFor(c.probVictoire, c.score);
      c.reason = comboReason(c);
      selected.push(c);
      exactSeen.add(c.id);
      c.legs.forEach((l) => exposure.set(l.eventId, (exposure.get(l.eventId) || 0) + 1));
    }
  }

  return selected;
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'GET') {
    json(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  try {
    const days = clamp(Number(req.query.days || 3), 1, 7);
    const risk = ['safe', 'mod', 'bold'].includes(req.query.risk) ? req.query.risk : 'mod';
    const maxCombos = clamp(Number(req.query.limit || 20), 5, 50);
    const maxLegs = req.query.maxLegs ? clamp(Number(req.query.maxLegs), 2, 5) : null;
    const unibetOnly = String(req.query.unibetOnly ?? '1') !== '0';
    const requestedSports = String(req.query.sports || 'foot,basket,tennis')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const sports = resolveSports(requestedSports);

    const now = new Date();
    const fromIso = oddsIso(now);
    const toIso = oddsIso(addDays(now, days));

    const oddsResults = await Promise.allSettled(
      sports.map(async (sportKey) => {
        const { body, headers } = await fetchOddsForSport(sportKey, fromIso, toIso);
        return { sportKey, events: Array.isArray(body) ? body : [], headers };
      })
    );

    const quota = {};
    const errors = [];
    const oddsEvents = [];

    for (const r of oddsResults) {
      if (r.status === 'fulfilled') {
        oddsEvents.push(...r.value.events.map((event) => ({ ...event, sportKey: r.value.sportKey })));
        quota.oddsRemaining = r.value.headers?.['x-requests-remaining'] || quota.oddsRemaining;
        quota.oddsUsed = r.value.headers?.['x-requests-used'] || quota.oddsUsed;
        quota.oddsLast = r.value.headers?.['x-requests-last'] || quota.oddsLast;
      } else {
        errors.push({ source: 'odds', message: r.reason?.message, status: r.reason?.statusCode || null });
      }
    }

    let selections = oddsEvents
      .flatMap((event) => extractSelections(event, event.sportKey, unibetOnly))
      .map((s) => ({ ...s, score: baseScore(s, risk) }));

    // Si Unibet strict donne trop peu de résultats, on relance en fallback non strict,
    // mais les cotes seront clairement marquées comme non-Unibet.
    let fallbackUsed = false;
    if (unibetOnly && selections.length < 8) {
      const fallbackSelections = oddsEvents
        .flatMap((event) => extractSelections(event, event.sportKey, false))
        .map((s) => ({ ...s, score: baseScore(s, risk) }));
      if (fallbackSelections.length > selections.length) {
        selections = fallbackSelections;
        fallbackUsed = true;
      }
    }

    selections = await enrichFootballSelections(selections);
    selections.sort((a, b) => b.score - a.score);

    const combos = buildCombos(selections, risk, maxCombos, maxLegs);
    const degraded = fallbackUsed || selections.some((s) => !String(s.dataQuality || '').includes('full'));

    json(res, 200, {
      ok: true,
      generatedAt: new Date().toISOString(),
      degraded,
      mode: fallbackUsed ? 'fallback_non_unibet_available' : 'unibet_first',
      note: fallbackUsed
        ? 'Unibet strict donnait trop peu de matchs : certaines cotes viennent d’autres bookmakers et sont signalées.'
        : 'Cotes Unibet priorisées. Aucune cote estimée inventée.',
      quota,
      errors,
      counts: {
        sports: sports.length,
        events: oddsEvents.length,
        selections: selections.length,
        combos: combos.length,
        footballEnriched: selections.filter((s) => s.fh?.length || s._predictions).length,
        unibetSelections: selections.filter((s) => s.exactUnibet).length,
      },
      combos,
    });
  } catch (err) {
    json(res, err.statusCode || 500, {
      ok: false,
      error: 'RECOMMENDATIONS_FAILED',
      message: err.message,
      details: err.body || null,
    });
  }
}
