// ════════════════════════════════════════════════════════
//  PARIDEX RECOMMENDATIONS V7 — MULTI-SPORT + FORME OBLIGATOIRE
//  Objectif : cotes réelles + enrichissement API-Sports par sport.
//  - Football : API-Football v3
//  - Basket : API-Basketball v1
//  - NBA : API-NBA v2
//  - Baseball / Hockey / NFL / Rugby / Volley / Handball / AFL : API-Sports v1
//  - Unibet strict par défaut pour éviter les écarts de cotes
//  - Les combinés principaux n'utilisent que les matchs enrichis
//  - Diversification forte : moins de répétition des mêmes matchs
//  GET /api/recommendations?days=7&risk=mod&limit=20&sports=foot,basket,nba,baseball,hockey,nfl,rugby&maxLegs=4
//  Options :
//    unibetOnly=1       défaut : cotes Unibet uniquement
//    unibetOnly=0       autorise des bookmakers de secours avec mention claire
//    allowPartial=1     autorise les cotes seules si un sport n'est pas enrichissable
//    maxApiEvents=60    nombre max d'événements à enrichir via API-Sports
// ════════════════════════════════════════════════════════

const ODDS_BASE = 'https://api.the-odds-api.com/v4';

const API_BASES = {
  football: 'https://v3.football.api-sports.io',
  afl: 'https://v1.afl.api-sports.io',
  baseball: 'https://v1.baseball.api-sports.io',
  basketball: 'https://v1.basketball.api-sports.io',
  formula1: 'https://v1.formula-1.api-sports.io',
  handball: 'https://v1.handball.api-sports.io',
  hockey: 'https://v1.hockey.api-sports.io',
  mma: 'https://v1.mma.api-sports.io',
  nba: 'https://v2.nba.api-sports.io',
  nfl: 'https://v1.american-football.api-sports.io',
  rugby: 'https://v1.rugby.api-sports.io',
  volleyball: 'https://v1.volleyball.api-sports.io',
};

const DEFAULT_SPORT_ALIASES = ['foot'];

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
    'soccer_belgium_first_div',
    'soccer_brazil_campeonato',
    'soccer_argentina_primera_division',
    'soccer_usa_mls',
  ],
  football: [
    'soccer_france_ligue_one',
    'soccer_france_ligue_two',
    'soccer_epl',
    'soccer_spain_la_liga',
    'soccer_italy_serie_a',
    'soccer_germany_bundesliga',
    'soccer_uefa_champs_league',
    'soccer_uefa_europa_league',
  ],
  basket: ['basketball_nba', 'basketball_euroleague', 'basketball_ncaab', 'basketball_wnba'],
  basketball: ['basketball_nba', 'basketball_euroleague', 'basketball_ncaab', 'basketball_wnba'],
  nba: ['basketball_nba'],
  baseball: ['baseball_mlb'],
  hockey: ['icehockey_nhl'],
  nhl: ['icehockey_nhl'],
  nfl: ['americanfootball_nfl', 'americanfootball_ncaaf'],
  rugby: ['rugby_league_nrl', 'rugby_union_international', 'rugby_union_six_nations'],
  afl: ['aussierules_afl'],
  volleyball: ['volleyball'],
  volley: ['volleyball'],
  handball: ['handball'],
  mma: ['mma_mixed_martial_arts'],
  formula1: ['motor_sport_formula_1'],
  f1: ['motor_sport_formula_1'],
};

const SPORT_META = {
  soccer_france_ligue_one: ['⚽', 'football', 'Ligue 1'],
  soccer_france_ligue_two: ['⚽', 'football', 'Ligue 2'],
  soccer_epl: ['⚽', 'football', 'Premier League'],
  soccer_spain_la_liga: ['⚽', 'football', 'La Liga'],
  soccer_italy_serie_a: ['⚽', 'football', 'Serie A'],
  soccer_germany_bundesliga: ['⚽', 'football', 'Bundesliga'],
  soccer_uefa_champs_league: ['⚽', 'football', 'Ligue des Champions'],
  soccer_uefa_europa_league: ['⚽', 'football', 'Europa League'],
  soccer_uefa_europa_conference_league: ['⚽', 'football', 'Conference League'],
  soccer_netherlands_eredivisie: ['⚽', 'football', 'Eredivisie'],
  soccer_portugal_primeira_liga: ['⚽', 'football', 'Liga Portugal'],
  soccer_turkey_super_league: ['⚽', 'football', 'Süper Lig'],
  soccer_belgium_first_div: ['⚽', 'football', 'Belgique Jupiler'],
  soccer_brazil_campeonato: ['⚽', 'football', 'Brésil Série A'],
  soccer_argentina_primera_division: ['⚽', 'football', 'Argentine Primera'],
  soccer_usa_mls: ['⚽', 'football', 'MLS'],
  basketball_nba: ['🏀', 'nba', 'NBA'],
  basketball_euroleague: ['🏀', 'basketball', 'EuroLeague'],
  basketball_ncaab: ['🏀', 'basketball', 'NCAA Basket'],
  basketball_wnba: ['🏀', 'basketball', 'WNBA'],
  baseball_mlb: ['⚾', 'baseball', 'MLB'],
  icehockey_nhl: ['🏒', 'hockey', 'NHL'],
  americanfootball_nfl: ['🏈', 'nfl', 'NFL'],
  americanfootball_ncaaf: ['🏈', 'nfl', 'NCAA Football'],
  rugby_league_nrl: ['🏉', 'rugby', 'NRL'],
  rugby_union_international: ['🏉', 'rugby', 'Rugby international'],
  rugby_union_six_nations: ['🏉', 'rugby', 'Six Nations'],
  aussierules_afl: ['🏉', 'afl', 'AFL'],
  volleyball: ['🏐', 'volleyball', 'Volleyball'],
  handball: ['🤾', 'handball', 'Handball'],
  mma_mixed_martial_arts: ['🥊', 'mma', 'MMA'],
  motor_sport_formula_1: ['🏎️', 'formula1', 'Formule 1'],
};

const UNIBET_KEYS = ['unibet', 'unibet_fr', 'unibet_eu', 'unibet_uk'];
const FALLBACK_BOOKMAKERS = ['betclic', 'betclic_fr', 'winamax', 'winamax_fr', 'pinnacle', 'bet365', 'williamhill', 'betfair', 'betfair_ex_eu'];

const CACHE = new Map();

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
}

function sendJson(res, status, payload) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(payload));
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function oddsIso(date) {
  return new Date(date).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function dateOnly(isoOrDate) {
  return new Date(isoOrDate).toISOString().slice(0, 10);
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function formatKickoff(iso) {
  const d = new Date(iso);
  const jours = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
  const mois = ['jan', 'fév', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  return `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]} · ${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/\b(fc|cf|sc|afc|cfc|ac|the|club|de|da|do|la|le|les|los|real|team|basket|bc|hk|hc)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

const TEAM_ALIASES = {
  manu: 'manchesterunited', manunited: 'manchesterunited', manchesterutd: 'manchesterunited', manchesterunited: 'manchesterunited',
  mancity: 'manchestercity', manchestercity: 'manchestercity',
  psg: 'parissaintgermain', parisstgermain: 'parissaintgermain', parissaintgermain: 'parissaintgermain',
  intermilan: 'inter', internazionale: 'inter', inter: 'inter',
  bayernmunich: 'bayernmunchen', bayernmunchen: 'bayernmunchen', bayern: 'bayernmunchen',
  atletico: 'atleticomadrid', atleticomadrid: 'atleticomadrid',
  milan: 'acmilan', acmilan: 'acmilan',
  sportinglisbon: 'sportingcp', sportingcp: 'sportingcp',
  spurs: 'tottenham', tottenhamhotspur: 'tottenham',
  wolves: 'wolverhampton', wolverhamptonwanderers: 'wolverhampton',
  lakers: 'lalakers', losangeleslakers: 'lalakers',
  clippers: 'laclippers', losangelesclippers: 'laclippers',
  knicks: 'newyorkknicks', nyknicks: 'newyorkknicks',
};

function teamKey(name) {
  const n = norm(name);
  return TEAM_ALIASES[n] || n;
}

function similarity(a, b) {
  a = teamKey(a); b = teamKey(b);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.88;
  const A = new Set(a.match(/.{1,2}/g) || [a]);
  const B = new Set(b.match(/.{1,2}/g) || [b]);
  const inter = [...A].filter(x => B.has(x)).length;
  const union = new Set([...A, ...B]).size;
  return union ? inter / union : 0;
}

async function cached(key, ttlMs, fn) {
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.savedAt < ttlMs) return hit.value;
  const value = await fn();
  CACHE.set(key, { savedAt: Date.now(), value });
  return value;
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 12000);
  try {
    const resp = await fetch(url, { ...options, signal: controller.signal });
    const text = await resp.text();
    let body;
    try { body = text ? JSON.parse(text) : null; }
    catch { body = { raw: text }; }
    if (!resp.ok) {
      const err = new Error(body?.message || body?.error || body?.raw || `HTTP ${resp.status}`);
      err.statusCode = resp.status;
      err.body = body;
      throw err;
    }
    return { body, headers: resp.headers, status: resp.status };
  } finally {
    clearTimeout(timeout);
  }
}

function getApiSportsKey(api) {
  const envMap = {
    football: ['API_FOOTBALL_KEY', 'APISPORTS_KEY'],
    basketball: ['API_BASKETBALL_KEY', 'APISPORTS_KEY'],
    nba: ['API_NBA_KEY', 'APISPORTS_KEY'],
    baseball: ['API_BASEBALL_KEY', 'APISPORTS_KEY'],
    hockey: ['API_HOCKEY_KEY', 'APISPORTS_KEY'],
    nfl: ['API_NFL_KEY', 'API_AMERICAN_FOOTBALL_KEY', 'APISPORTS_KEY'],
    rugby: ['API_RUGBY_KEY', 'APISPORTS_KEY'],
    volleyball: ['API_VOLLEYBALL_KEY', 'APISPORTS_KEY'],
    handball: ['API_HANDBALL_KEY', 'APISPORTS_KEY'],
    afl: ['API_AFL_KEY', 'APISPORTS_KEY'],
    mma: ['API_MMA_KEY', 'APISPORTS_KEY'],
    formula1: ['API_FORMULA1_KEY', 'API_F1_KEY', 'APISPORTS_KEY'],
  };
  for (const name of (envMap[api] || ['APISPORTS_KEY'])) {
    if (process.env[name]) return process.env[name];
  }
  return '';
}

async function apiSports(api, path, params = {}) {
  const base = API_BASES[api];
  if (!base) throw new Error(`API-Sports non configurée pour ${api}`);
  const key = getApiSportsKey(api);
  if (!key) throw new Error(`Clé API-Sports manquante pour ${api}. Ajoute APISPORTS_KEY dans Vercel.`);

  const url = new URL(base + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const { body } = await fetchJson(url.toString(), {
    headers: { Accept: 'application/json', 'x-apisports-key': key },
    timeoutMs: 10000,
  });
  return body;
}

function resolveSports(input) {
  const tokens = String(input || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const requested = tokens.length ? tokens : DEFAULT_SPORT_ALIASES;
  const keys = [];
  for (const token of requested) {
    if (UI_SPORT_MAP[token]) keys.push(...UI_SPORT_MAP[token]);
    else keys.push(token);
  }
  return [...new Set(keys)];
}

function sportMeta(oddsSportKey) {
  if (SPORT_META[oddsSportKey]) return SPORT_META[oddsSportKey];
  const api = apiForOddsSport(oddsSportKey);
  const emoji = api === 'football' ? '⚽' : api === 'nba' || api === 'basketball' ? '🏀' : api === 'baseball' ? '⚾' : api === 'hockey' ? '🏒' : api === 'nfl' ? '🏈' : api === 'rugby' || api === 'afl' ? '🏉' : api === 'volleyball' ? '🏐' : api === 'handball' ? '🤾' : '🎯';
  return [emoji, api, oddsSportKey];
}

function apiForOddsSport(key) {
  if (key.startsWith('soccer_')) return 'football';
  if (key === 'basketball_nba') return 'nba';
  if (key.startsWith('basketball_')) return 'basketball';
  if (key.startsWith('baseball_')) return 'baseball';
  if (key.startsWith('icehockey_')) return 'hockey';
  if (key.startsWith('americanfootball_')) return 'nfl';
  if (key.startsWith('rugby_')) return 'rugby';
  if (key.startsWith('aussierules_')) return 'afl';
  if (key.startsWith('volleyball')) return 'volleyball';
  if (key.startsWith('handball')) return 'handball';
  if (key.startsWith('mma_')) return 'mma';
  if (key.startsWith('motor_sport_formula_1')) return 'formula1';
  return 'unknown';
}

async function getActiveOddsSports(oddsKey) {
  const url = new URL(`${ODDS_BASE}/sports`);
  url.searchParams.set('apiKey', oddsKey);
  return cached('odds:sports', 60 * 60 * 1000, async () => {
    const { body } = await fetchJson(url.toString(), { headers: { Accept: 'application/json' } });
    return Array.isArray(body) ? body : [];
  });
}

async function fetchOddsForSport(oddsKey, sportKey, fromIso, toIso, errors) {
  const url = new URL(`${ODDS_BASE}/sports/${encodeURIComponent(sportKey)}/odds`);
  url.searchParams.set('apiKey', oddsKey);
  url.searchParams.set('regions', 'eu,uk,us,au');
  url.searchParams.set('markets', 'h2h');
  url.searchParams.set('oddsFormat', 'decimal');
  url.searchParams.set('dateFormat', 'iso');
  url.searchParams.set('commenceTimeFrom', fromIso);
  url.searchParams.set('commenceTimeTo', toIso);

  try {
    const { body, headers } = await cached(`odds:${sportKey}:${fromIso}:${toIso}`, 2 * 60 * 1000, async () => {
      return fetchJson(url.toString(), { headers: { Accept: 'application/json' }, timeoutMs: 12000 });
    });
    return {
      events: Array.isArray(body) ? body : [],
      quota: {
        remaining: headers.get('x-requests-remaining'),
        used: headers.get('x-requests-used'),
        last: headers.get('x-requests-last'),
      },
    };
  } catch (err) {
    errors.push({ source: 'odds', sport: sportKey, message: err.message, status: err.statusCode || 500 });
    return { events: [], quota: {} };
  }
}

function findBookmaker(event, unibetOnly) {
  const books = Array.isArray(event.bookmakers) ? event.bookmakers : [];
  const byKey = (keys) => books.find(b => keys.includes(String(b.key || '').toLowerCase()));
  const unibet = byKey(UNIBET_KEYS);
  if (unibet) return { bookmaker: unibet, isUnibet: true };
  if (unibetOnly) return null;
  const fallback = byKey(FALLBACK_BOOKMAKERS) || books[0];
  return fallback ? { bookmaker: fallback, isUnibet: false } : null;
}

function makeSelectionsFromOdds(events, sportKey, opts) {
  const [emoji, api, defaultLeague] = sportMeta(sportKey);
  const selections = [];
  const risk = opts.risk;
  const unibetOnly = opts.unibetOnly;

  const oddMin = risk === 'safe' ? 1.12 : risk === 'bold' ? 1.18 : 1.14;
  const oddMax = risk === 'safe' ? 1.65 : risk === 'bold' ? 2.85 : 2.15;

  for (const event of events) {
    const pickedBook = findBookmaker(event, unibetOnly);
    if (!pickedBook) continue;
    const market = (pickedBook.bookmaker.markets || []).find(m => m.key === 'h2h');
    if (!market || !Array.isArray(market.outcomes)) continue;

    const homeTeam = event.home_team || event.homeTeam || '';
    const awayTeam = event.away_team || event.awayTeam || '';
    const commenceTime = event.commence_time || event.commenceTime;
    const eventId = `${sportKey}:${norm(homeTeam)}:${norm(awayTeam)}:${dateOnly(commenceTime || new Date())}`;

    for (const out of market.outcomes) {
      const price = Number(out.price);
      if (!Number.isFinite(price) || price < oddMin || price > oddMax) continue;

      const name = String(out.name || '');
      const isHome = similarity(name, homeTeam) >= 0.78;
      const isAway = similarity(name, awayTeam) >= 0.78;
      const isDraw = /^draw$|^nul$|^match nul$/i.test(name);
      if (!isHome && !isAway && !isDraw) continue;

      const probability = 100 / price;
      selections.push({
        id: `${eventId}:${norm(name)}:${price}`,
        eventId,
        oddsEventId: event.id,
        oddsSportKey: sportKey,
        apiSport: api,
        sport: emoji,
        sportName: api,
        league: defaultLeague,
        homeTeam,
        awayTeam,
        commenceTime,
        kickoff: commenceTime ? formatKickoff(commenceTime) : '',
        market: 'Résultat du match',
        pick: isDraw ? 'Match nul' : (isHome ? homeTeam : awayTeam),
        pickSide: isDraw ? 'draw' : (isHome ? 'home' : 'away'),
        odd: price,
        bookmaker: pickedBook.bookmaker.title || pickedBook.bookmaker.key || 'Bookmaker',
        bookmakerKey: pickedBook.bookmaker.key,
        isUnibet: pickedBook.isUnibet,
        baseProbability: probability,
        probability,
        confidence: clamp(Math.round(probability * 0.78), 30, 72),
        dataQuality: 'odds_only',
        apiSports: null,
        apiFootball: null,
        reason: `${pickedBook.isUnibet ? 'Cote Unibet réelle' : 'Cote réelle bookmaker'} : ${price.toFixed(2)}. En attente d'enrichissement ${api}.`,
      });
    }
  }

  return selections;
}

function getGameDate(game) {
  const raw = game?.fixture?.date || game?.date?.start || game?.date || game?.game?.date || game?.time;
  if (typeof raw === 'string') return raw;
  if (raw?.start) return raw.start;
  return null;
}

function getGameId(game) {
  return game?.fixture?.id || game?.id || game?.game?.id || game?.game?.ID || null;
}

function getLeagueName(game, fallback) {
  return game?.league?.name || game?.league?.Name || game?.competition?.name || game?.country?.name || fallback || '';
}

function getTeams(game, api) {
  if (api === 'nba') {
    const home = game?.teams?.home || game?.teams?.Home || game?.home || {};
    const away = game?.teams?.visitors || game?.teams?.away || game?.teams?.Away || game?.visitors || {};
    return {
      home: { id: home.id || home.teamId || home.ID, name: home.name || home.nickname || home.code || home.Name },
      away: { id: away.id || away.teamId || away.ID, name: away.name || away.nickname || away.code || away.Name },
    };
  }
  const home = game?.teams?.home || game?.teams?.Home || game?.home || game?.localteam || {};
  const away = game?.teams?.away || game?.teams?.Away || game?.away || game?.visitorteam || game?.visitors || {};
  return {
    home: { id: home.id || home.teamId || home.ID, name: home.name || home.nickname || home.code || home.Name },
    away: { id: away.id || away.teamId || away.ID, name: away.name || away.nickname || away.code || away.Name },
  };
}

function scoreMatch(selection, game) {
  const t = getTeams(game, selection.apiSport);
  const direct = (similarity(selection.homeTeam, t.home.name) + similarity(selection.awayTeam, t.away.name)) / 2;
  const reversed = (similarity(selection.homeTeam, t.away.name) + similarity(selection.awayTeam, t.home.name)) / 2;
  const dateScore = dateOnly(selection.commenceTime) === dateOnly(getGameDate(game) || selection.commenceTime) ? 0.08 : 0;
  return Math.max(direct, reversed) + dateScore;
}

async function fetchGamesForDate(api, date, errors) {
  const path = api === 'football' ? '/fixtures' : '/games';
  const key = `${api}:${path}:${date}`;
  return cached(key, 30 * 60 * 1000, async () => {
    try {
      const body = await apiSports(api, path, { date });
      return Array.isArray(body?.response) ? body.response : [];
    } catch (err) {
      errors.push({ source: api, endpoint: path, date, message: err.message, status: err.statusCode || 500 });
      return [];
    }
  });
}

function isNil(v) {
  return v === undefined || v === null || v === '';
}

function toScoreNumber(v) {
  if (isNil(v)) return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function statusShort(game, api) {
  if (api === 'football') return game?.fixture?.status?.short || game?.status?.short || '';
  return game?.status?.short || game?.status?.long || game?.status || game?.game?.status || '';
}

function isFinishedGame(game, api) {
  const st = String(statusShort(game, api) || '').toUpperCase();
  if (api === 'football') return ['FT', 'AET', 'PEN'].includes(st);
  if (!st) {
    const hs = extractScore(game, 'home', api);
    const as = extractScore(game, 'away', api);
    return Number.isFinite(hs) && Number.isFinite(as);
  }
  return ['FT', 'AET', 'PEN', 'FINISHED', 'ENDED', 'FINAL', 'FULLTIME', 'AFTER OVERTIME', 'COMPLETED'].some(x => st.includes(x));
}

function uniqGames(games, api) {
  const out = [];
  const seen = new Set();
  for (const g of games || []) {
    const id = getGameId(g) || `${getGameDate(g) || ''}:${JSON.stringify(getTeams(g, api))}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(g);
  }
  return out;
}

async function fetchRecentGames(api, teamId, errors, context = {}) {
  if (!teamId) return [];
  const path = api === 'football' ? '/fixtures' : '/games';
  const season = context.season || new Date().getUTCFullYear();
  const league = context.leagueId;
  const key = `${api}:recent:${teamId}:${season}:${league || 'all'}`;

  return cached(key, 3 * 60 * 60 * 1000, async () => {
    const attempts = api === 'football'
      ? [
          // Le plus fiable pour la forme football : saison + ligue + statut terminé.
          { team: teamId, season, league, status: 'FT' },
          { team: teamId, season, status: 'FT' },
          { team: teamId, season, league },
          { team: teamId, season },
          { team: teamId, last: 12 },
          { team: teamId, last: 25 },
        ]
      : [
          { team: teamId, season, league },
          { team: teamId, season },
          { team: teamId, last: 12 },
          { id: teamId, last: 12 },
        ];

    let collected = [];
    const requestErrors = [];

    for (const rawParams of attempts) {
      const params = Object.fromEntries(Object.entries(rawParams).filter(([, v]) => !isNil(v)));
      try {
        const body = await apiSports(api, path, params);
        const arr = Array.isArray(body?.response) ? body.response : [];
        collected = collected.concat(arr);
        const finished = uniqGames(collected, api).filter(g => isFinishedGame(g, api));
        if (finished.length >= 5) return finished;
      } catch (err) {
        requestErrors.push(`${JSON.stringify(params)} → ${err.message}`);
      }
    }

    const finished = uniqGames(collected, api).filter(g => isFinishedGame(g, api));
    if (finished.length) return finished;

    errors.push({
      source: api,
      endpoint: path,
      team: teamId,
      season,
      league,
      message: 'Forme récente indisponible pour cette équipe après plusieurs stratégies.',
      debug: requestErrors.slice(0, 3),
    });
    return [];
  });
}

function extractScore(game, side, api) {
  if (api === 'football') {
    const goals = game?.goals || {};
    return toScoreNumber(side === 'home' ? goals.home : goals.away);
  }
  if (api === 'nba') {
    const scores = game?.scores || {};
    const node = side === 'home' ? scores.home : (scores.visitors || scores.away);
    return toScoreNumber(node?.points ?? node?.total ?? node?.score);
  }
  const scores = game?.scores || game?.score || {};
  const node = side === 'home' ? scores.home : scores.away;
  if (typeof node === 'number') return node;
  return toScoreNumber(node?.total ?? node?.points ?? node?.score ?? node?.runs ?? node?.goals);
}

function resultForTeam(game, teamId, api) {
  const t = getTeams(game, api);
  const isHome = String(t.home.id) === String(teamId);
  const isAway = String(t.away.id) === String(teamId);
  if (!isHome && !isAway) return null;
  const homeScore = extractScore(game, 'home', api);
  const awayScore = extractScore(game, 'away', api);
  if (!Number.isFinite(homeScore) || !Number.isFinite(awayScore)) return null;
  if (homeScore === awayScore) return 'D';
  const homeWon = homeScore > awayScore;
  return (isHome && homeWon) || (isAway && !homeWon) ? 'W' : 'L';
}

function summarizeForm(games, teamId, api) {
  const rows = [];
  for (const g of games || []) {
    if (!isFinishedGame(g, api)) continue;
    const r = resultForTeam(g, teamId, api);
    if (!r) continue;
    rows.push({
      result: r,
      date: getGameDate(g) || '',
    });
  }
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const lastRows = rows.slice(-5);
  const last = lastRows.map(x => x.result);
  const W = last.filter(x => x === 'W').length;
  const D = last.filter(x => x === 'D').length;
  const L = last.filter(x => x === 'L').length;
  return { form: last, W, D, L, played: last.length, label: last.length ? last.join('') : 'n/d' };
}

async function fetchFootballPrediction(fixtureId, errors) {
  if (!fixtureId) return null;
  const key = `football:prediction:${fixtureId}`;
  return cached(key, 6 * 60 * 60 * 1000, async () => {
    try {
      const body = await apiSports('football', '/predictions', { fixture: fixtureId });
      return Array.isArray(body?.response) ? body.response[0] : null;
    } catch (err) {
      errors.push({ source: 'football', endpoint: '/predictions', fixture: fixtureId, message: err.message, status: err.statusCode || 500 });
      return null;
    }
  });
}

function sideFormScore(selection, homeStats, awayStats) {
  const chosen = selection.pickSide === 'home' ? homeStats : selection.pickSide === 'away' ? awayStats : null;
  const other = selection.pickSide === 'home' ? awayStats : selection.pickSide === 'away' ? homeStats : null;
  if (!chosen || !other || chosen.played < 3 || other.played < 3) return 0;
  return ((chosen.W - chosen.L) - (other.W - other.L)) * 4 + (chosen.W - other.W) * 3;
}

function adviceText(selection, match, homeStats, awayStats, prediction) {
  const league = selection.league || getLeagueName(match, 'Compétition');
  const formHome = homeStats?.label || 'n/d';
  const formAway = awayStats?.label || 'n/d';
  const predAdvice = prediction?.predictions?.advice || prediction?.predictions?.winner?.comment;
  const base = `${league} · ${selection.bookmaker}${selection.isUnibet ? ' (Unibet)' : ''}. Forme ${selection.homeTeam} : ${formHome} · ${selection.awayTeam} : ${formAway}.`;
  if (predAdvice) return `${base} Signal API-Football : ${predAdvice}`;
  const chosen = selection.pickSide === 'home' ? homeStats : awayStats;
  if (chosen && chosen.played >= 3) return `${base} Signal forme : ${selection.pick} reste sur ${chosen.W} victoire(s) sur ses ${chosen.played} derniers matchs.`;
  return base;
}

async function enrichSelections(selections, opts, errors) {
  const maxApiEvents = opts.maxApiEvents;
  const byEvent = [];
  const seen = new Set();
  for (const s of selections.sort((a, b) => a.odd - b.odd)) {
    if (!seen.has(s.eventId)) {
      seen.add(s.eventId);
      byEvent.push(s);
    }
    if (byEvent.length >= maxApiEvents) break;
  }

  const enrichedByEvent = new Map();

  for (const seed of byEvent) {
    const api = seed.apiSport;
    if (!API_BASES[api] || api === 'mma' || api === 'formula1') {
      errors.push({ source: api, event: seed.eventId, message: `Enrichissement automatique non activé pour ${api}.` });
      continue;
    }

    const date = dateOnly(seed.commenceTime || new Date());
    const games = await fetchGamesForDate(api, date, errors);
    let best = null;
    let bestScore = 0;
    for (const g of games) {
      const sc = scoreMatch(seed, g);
      if (sc > bestScore) { best = g; bestScore = sc; }
    }
    if (!best || bestScore < 0.72) {
      errors.push({ source: api, event: seed.eventId, message: `Match non retrouvé dans API-Sports (${api})`, score: Number(bestScore.toFixed(2)) });
      continue;
    }

    const teams = getTeams(best, api);
    const fixtureId = getGameId(best);
    const leagueName = getLeagueName(best, seed.league);

    let homeRecent = [];
    let awayRecent = [];
    // Petite pause pour éviter les rafales sur les plans gratuits.
    const leagueId = best?.league?.id || best?.league?.ID || best?.leagueId;
    const season = best?.league?.season || best?.season || new Date(seed.commenceTime || Date.now()).getUTCFullYear();

    await sleep(20);
    homeRecent = await fetchRecentGames(api, teams.home.id, errors, { leagueId, season, fixtureId, seed });
    await sleep(20);
    awayRecent = await fetchRecentGames(api, teams.away.id, errors, { leagueId, season, fixtureId, seed });

    const homeStats = summarizeForm(homeRecent, teams.home.id, api);
    const awayStats = summarizeForm(awayRecent, teams.away.id, api);
    const prediction = api === 'football' ? await fetchFootballPrediction(fixtureId, errors) : null;

    // Pour respecter le but de Paridex, un match principal doit avoir une vraie forme lisible.
    // Une prédiction seule ne suffit plus, sinon l'interface affiche "forme n/d".
    const fullEnough = homeStats.played >= 3 && awayStats.played >= 3;
    if (!fullEnough) {
      errors.push({
        source: api,
        event: seed.eventId,
        message: 'Match trouvé, mais forme insuffisante : exclu des combinés principaux.',
        homePlayed: homeStats.played,
        awayPlayed: awayStats.played,
      });
      continue;
    }

    enrichedByEvent.set(seed.eventId, {
      api,
      fixtureId,
      leagueName,
      teams,
      homeStats,
      awayStats,
      prediction,
    });
  }

  const enriched = [];
  for (const s of selections) {
    const e = enrichedByEvent.get(s.eventId);
    if (!e) {
      if (opts.allowPartial) enriched.push(s);
      continue;
    }

    const formBonus = sideFormScore(s, e.homeStats, e.awayStats);
    let predBonus = 0;
    if (e.prediction?.predictions) {
      const p = e.prediction.predictions;
      const winnerName = p?.winner?.name || '';
      if (winnerName && similarity(winnerName, s.pick) >= 0.72) predBonus += 10;
      if (typeof p?.percent?.home === 'string' && s.pickSide === 'home') predBonus += Number(p.percent.home.replace('%', '')) > 45 ? 5 : 0;
      if (typeof p?.percent?.away === 'string' && s.pickSide === 'away') predBonus += Number(p.percent.away.replace('%', '')) > 45 ? 5 : 0;
    }

    const confidence = clamp(Math.round(s.baseProbability * 0.75 + 18 + formBonus + predBonus), 42, 92);
    const apiPayload = {
      provider: e.api === 'football' ? 'API-Football' : `API-${e.api}`,
      api: e.api,
      fixtureId: e.fixtureId,
      league: e.leagueName,
      home: e.teams.home,
      away: e.teams.away,
      homeForm: e.homeStats,
      awayForm: e.awayStats,
      prediction: e.prediction,
      advice: adviceText({ ...s, league: e.leagueName }, null, e.homeStats, e.awayStats, e.prediction),
    };

    enriched.push({
      ...s,
      league: e.leagueName || s.league,
      confidence,
      probability: clamp(s.baseProbability + Math.max(0, formBonus * 0.35) + predBonus * 0.25, 20, 95),
      dataQuality: 'full',
      apiSports: apiPayload,
      apiFootball: apiPayload,
      _homeStats: e.homeStats,
      _awayStats: e.awayStats,
      reason: apiPayload.advice,
      why: apiPayload.advice,
    });
  }

  return enriched;
}

function legLimitForRisk(risk, forced) {
  if (forced) return clamp(Number(forced), 2, 5);
  if (risk === 'safe') return 2;
  if (risk === 'bold') return 4;
  return 3;
}

function minConfidenceForRisk(risk) {
  if (risk === 'safe') return 62;
  if (risk === 'bold') return 45;
  return 52;
}

function comboTitle(size, idx) {
  const labels = { 2: 'Duo', 3: 'Trio', 4: 'Combiné 4', 5: 'Combiné 5' };
  return `${labels[size] || 'Combiné'} Paridex #${idx + 1}`;
}

function product(arr, fn) { return arr.reduce((acc, x) => acc * fn(x), 1); }

function buildCombos(selections, opts) {
  const risk = opts.risk;
  const maxLegs = legLimitForRisk(risk, opts.maxLegs);
  const minConf = minConfidenceForRisk(risk);
  const sorted = selections
    .filter(s => s.dataQuality === 'full' || opts.allowPartial)
    .filter(s => s.confidence >= minConf)
    .sort((a, b) => (b.confidence - a.confidence) || (a.odd - b.odd));

  const candidates = [];
  const maxPool = Math.min(sorted.length, 80);
  const pool = sorted.slice(0, maxPool);

  function validAdd(combo, leg) {
    if (combo.some(x => x.eventId === leg.eventId)) return false;
    if (combo.some(x => x.homeTeam === leg.homeTeam || x.awayTeam === leg.awayTeam || x.homeTeam === leg.awayTeam || x.awayTeam === leg.homeTeam)) return false;
    return true;
  }

  function pushCombo(legs) {
    if (legs.length < 2) return;
    const odd = product(legs, l => Number(l.odd || 1));
    const probability = product(legs, l => Number(l.probability || 50) / 100) * 100;
    const avgConf = legs.reduce((a, l) => a + l.confidence, 0) / legs.length;
    const unibetRatio = legs.filter(l => l.isUnibet).length / legs.length;
    const sportDiversity = new Set(legs.map(l => l.apiSport)).size;
    const score = avgConf + unibetRatio * 7 + sportDiversity * 1.5 - Math.max(0, odd - 8) * 2;
    candidates.push({ legs, odd, probability, confidence: clamp(Math.round(score), 30, 94), score });
  }

  for (let size = 2; size <= maxLegs; size++) {
    for (let start = 0; start < pool.length; start++) {
      const combo = [pool[start]];
      for (let step = 1; step < pool.length && combo.length < size; step++) {
        const idx = (start + step * 7) % pool.length;
        const leg = pool[idx];
        if (validAdd(combo, leg)) combo.push(leg);
      }
      if (combo.length === size) pushCombo(combo);
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const selected = [];
  const eventUse = new Map();
  const comboFingerprints = new Set();

  function canTake(c, maxUse) {
    const fp = c.legs.map(l => l.eventId).sort().join('|');
    if (comboFingerprints.has(fp)) return false;
    return c.legs.every(l => (eventUse.get(l.eventId) || 0) < maxUse);
  }

  for (const maxUse of [1, 2, 3, 4]) {
    for (const c of candidates) {
      if (selected.length >= opts.limit) break;
      if (!canTake(c, maxUse)) continue;
      const fp = c.legs.map(l => l.eventId).sort().join('|');
      comboFingerprints.add(fp);
      c.legs.forEach(l => eventUse.set(l.eventId, (eventUse.get(l.eventId) || 0) + 1));
      selected.push(c);
    }
    if (selected.length >= opts.limit) break;
  }

  return selected.slice(0, opts.limit).map((c, idx) => ({
    title: comboTitle(c.legs.length, idx),
    rank: idx + 1,
    odd: Number(c.odd.toFixed(2)),
    probability: Number(c.probability.toFixed(1)),
    confidence: c.confidence,
    dataQuality: c.legs.every(l => l.dataQuality === 'full') ? 'full' : 'partial',
    mode: c.legs.every(l => l.dataQuality === 'full') ? 'enriched' : 'partial',
    legs: c.legs,
    verdict: c.legs.every(l => l.dataQuality === 'full') ? '✅ Cotes + API-Sports' : 'ℹ️ Combiné partiel',
    reason: c.legs.map(l => `${l.sport} ${l.league} : ${l.pick} @${l.odd.toFixed(2)}`).join(' · '),
  }));
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });

  const started = Date.now();
  const errors = [];

  try {
    const oddsKey = process.env.ODDS_API_KEY;
    if (!oddsKey) return sendJson(res, 500, { ok: false, error: 'MISSING_ODDS_API_KEY', message: 'Ajoute ODDS_API_KEY dans Vercel.' });

    const q = req.query || {};
    const risk = String(q.risk || 'mod').toLowerCase();
    const days = clamp(Number(q.days || 3), 1, 14);
    const limit = clamp(Number(q.limit || 20), 1, 40);
    const maxLegs = q.maxLegs ? Number(q.maxLegs) : undefined;
    const maxApiEvents = clamp(Number(q.maxApiEvents || 60), 5, 120);
    const unibetOnly = String(q.unibetOnly ?? '1') !== '0';
    const allowPartial = String(q.allowPartial || '0') === '1';

    const fromIso = oddsIso(new Date());
    const toIso = oddsIso(addDays(new Date(), days));

    const requestedKeys = resolveSports(q.sports);
    const activeSports = await getActiveOddsSports(oddsKey).catch(err => {
      errors.push({ source: 'odds', message: `Impossible de lire /sports : ${err.message}` });
      return [];
    });
    const activeSet = new Set(activeSports.map(s => s.key));
    const activeRequested = requestedKeys.filter(k => activeSet.size ? activeSet.has(k) : true);

    const skippedInactive = requestedKeys.filter(k => activeSet.size && !activeSet.has(k));
    for (const k of skippedInactive) errors.push({ source: 'odds', sport: k, message: 'Sport absent de la liste active The Odds API au moment du test.' });

    let allEvents = [];
    let quota = {};
    for (const sportKey of activeRequested) {
      const { events, quota: qh } = await fetchOddsForSport(oddsKey, sportKey, fromIso, toIso, errors);
      quota = { ...quota, ...Object.fromEntries(Object.entries(qh).filter(([, v]) => v != null)) };
      for (const ev of events) allEvents.push({ ...ev, _sportKey: sportKey });
    }

    let rawSelections = [];
    for (const sportKey of activeRequested) {
      const events = allEvents.filter(ev => ev._sportKey === sportKey);
      rawSelections.push(...makeSelectionsFromOdds(events, sportKey, { risk, unibetOnly }));
    }

    // Déduplique les sélections identiques.
    const seenSel = new Set();
    rawSelections = rawSelections.filter(s => {
      const key = `${s.eventId}:${s.pickSide}:${s.odd}:${s.bookmakerKey}`;
      if (seenSel.has(key)) return false;
      seenSel.add(key);
      return true;
    });

    const enrichedSelections = await enrichSelections(rawSelections, { allowPartial, maxApiEvents }, errors);
    const combos = buildCombos(enrichedSelections, { risk, limit, maxLegs, allowPartial });

    const fullyEnriched = enrichedSelections.filter(s => s.dataQuality === 'full').length;
    const partial = enrichedSelections.filter(s => s.dataQuality !== 'full').length;

    const statusMessage = combos.length
      ? 'Combinés générés avec cotes réelles et enrichissement API-Sports.'
      : fullyEnriched
        ? 'Des matchs enrichis existent, mais pas assez de sélections compatibles pour former des combinés diversifiés. Essaie risk=bold ou maxLegs=2.'
        : 'Aucun match n’a pu être enrichi avec API-Sports. Vérifie APISPORTS_KEY et augmente days/maxApiEvents.';

    return sendJson(res, 200, {
      ok: true,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - started,
      degraded: combos.some(c => c.dataQuality !== 'full') || (combos.length === 0 && rawSelections.length > 0),
      mode: combos.every(c => c.dataQuality === 'full') ? 'full-multisport' : 'partial',
      message: statusMessage,
      quota,
      params: { days, risk, limit, maxLegs: legLimitForRisk(risk, maxLegs), sports: activeRequested, unibetOnly, allowPartial, maxApiEvents },
      counts: {
        requestedSports: requestedKeys.length,
        activeSports: activeRequested.length,
        oddsEvents: allEvents.length,
        oddsSelections: rawSelections.length,
        enrichedSelections: fullyEnriched,
        partialSelections: partial,
        combos: combos.length,
      },
      errors: errors.slice(0, 80),
      combos,
    });
  } catch (err) {
    return sendJson(res, 500, {
      ok: false,
      error: 'RECOMMENDATIONS_FAILED',
      message: err.message || 'Erreur API Paridex',
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
  }
}
