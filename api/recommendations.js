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

// ▶ Mapping ID de ligue API-Football par clé Odds API (football uniquement)
//   Indispensable pour cibler les bons fixtures et économiser le quota.
//   IDs trouvés sur https://dashboard.api-football.com/soccer/ids
const ODDS_TO_APIFOOTBALL_LEAGUE = {
  soccer_france_ligue_one: 61,
  soccer_france_ligue_two: 62,
  soccer_epl: 39,
  soccer_efl_champ: 40,
  soccer_spain_la_liga: 140,
  soccer_italy_serie_a: 135,
  soccer_germany_bundesliga: 78,
  soccer_uefa_champs_league: 2,
  soccer_uefa_europa_league: 3,
  soccer_uefa_europa_conference_league: 848,
  soccer_netherlands_eredivisie: 88,
  soccer_portugal_primeira_liga: 94,
  soccer_turkey_super_league: 203,
  soccer_belgium_first_div: 144,
  soccer_brazil_campeonato: 71,
  soccer_argentina_primera_division: 128,
  soccer_usa_mls: 253,
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

// État global du quota API-Sports (consommation actuelle visible)
let apiSportsQuota = { remaining: null, used: null, limit: null };

async function apiSports(api, path, params = {}) {
  const base = API_BASES[api];
  if (!base) throw new Error(`API-Sports non configurée pour ${api}`);
  const key = getApiSportsKey(api);
  if (!key) throw new Error(`Clé API-Sports manquante pour ${api}. Ajoute APISPORTS_KEY dans Vercel.`);

  // ▶ COUPE-CIRCUIT : si quota < 3, on n'envoie plus de requêtes
  if (apiSportsQuota.remaining !== null && Number(apiSportsQuota.remaining) < 3) {
    throw new Error(`Quota API-Sports épuisé (reste ${apiSportsQuota.remaining}). Enrichissement stoppé.`);
  }

  const url = new URL(base + path);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  const { body, headers } = await fetchJson(url.toString(), {
    headers: { Accept: 'application/json', 'x-apisports-key': key },
    timeoutMs: 10000,
  });

  // ▶ Met à jour le quota visible
  const remaining = headers.get('x-ratelimit-requests-remaining');
  const used = headers.get('x-ratelimit-requests-used');
  const limit = headers.get('x-ratelimit-requests-limit');
  if (remaining !== null) apiSportsQuota.remaining = Number(remaining);
  if (used !== null) apiSportsQuota.used = Number(used);
  if (limit !== null) apiSportsQuota.limit = Number(limit);

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
  // ▶ MULTI-MARCHÉS : h2h (1X2) + totals (Over/Under buts)
  // Note : btts n'est pas supporté sur l'endpoint /odds basique de The Odds API.
  // → On obtient quand même la diversité avec Over/Under (2.5/3.5 buts en foot, totaux en basket/baseball).
  url.searchParams.set('markets', 'h2h,totals');
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

  // ▶ Plages de cotes par risque (légèrement élargies pour Over/BTTS)
  const oddMin = risk === 'safe' ? 1.20 : risk === 'bold' ? 1.30 : 1.25;
  const oddMax = risk === 'safe' ? 2.20 : risk === 'bold' ? 4.50 : 3.20;

  for (const event of events) {
    const pickedBook = findBookmaker(event, unibetOnly);
    if (!pickedBook) continue;
    const markets = pickedBook.bookmaker.markets || [];
    if (!markets.length) continue;

    const homeTeam = event.home_team || event.homeTeam || '';
    const awayTeam = event.away_team || event.awayTeam || '';
    const commenceTime = event.commence_time || event.commenceTime;
    const eventId = `${sportKey}:${norm(homeTeam)}:${norm(awayTeam)}:${dateOnly(commenceTime || new Date())}`;

    const baseSel = {
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
      bookmaker: pickedBook.bookmaker.title || pickedBook.bookmaker.key || 'Bookmaker',
      bookmakerKey: pickedBook.bookmaker.key,
      isUnibet: pickedBook.isUnibet,
      dataQuality: 'odds_only',
      apiSports: null,
      apiFootball: null,
    };

    // ═══ Marché 1 : H2H (1X2 / Résultat du match) ═══
    const h2h = markets.find(m => m.key === 'h2h');
    if (h2h && Array.isArray(h2h.outcomes)) {
      for (const out of h2h.outcomes) {
        const price = Number(out.price);
        if (!Number.isFinite(price) || price < oddMin || price > oddMax) continue;

        const name = String(out.name || '');
        const isHome = similarity(name, homeTeam) >= 0.78;
        const isAway = similarity(name, awayTeam) >= 0.78;
        const isDraw = /^draw$|^nul$|^match nul$/i.test(name);
        if (!isHome && !isAway && !isDraw) continue;

        const probability = 100 / price;
        selections.push({
          ...baseSel,
          id: `${eventId}:h2h:${norm(name)}:${price}`,
          market: 'Résultat (1X2)',
          marketType: 'h2h',
          pick: isDraw ? 'Match nul' : (isHome ? homeTeam : awayTeam),
          pickSide: isDraw ? 'draw' : (isHome ? 'home' : 'away'),
          odd: price,
          baseProbability: probability,
          probability,
          confidence: clamp(Math.round(probability * 0.78), 30, 72),
          reason: `${pickedBook.isUnibet ? 'Cote Unibet' : 'Cote bookmaker'} 1X2 : ${price.toFixed(2)}`,
        });
      }
    }

    // ═══ Marché 2 : TOTALS (Over/Under buts) ═══
    const totals = markets.find(m => m.key === 'totals');
    if (totals && Array.isArray(totals.outcomes)) {
      for (const out of totals.outcomes) {
        const price = Number(out.price);
        if (!Number.isFinite(price) || price < oddMin || price > oddMax) continue;

        const point = Number(out.point);
        if (!Number.isFinite(point)) continue;

        const name = String(out.name || '').toLowerCase();
        const isOver = name.includes('over');
        const isUnder = name.includes('under');
        if (!isOver && !isUnder) continue;

        // Préférence : Over/Under 2.5 buts (foot) ou les lignes principales
        // En foot : 2.5 / 3.5 ; en basket/NBA : seuils plus hauts (220+) ; on garde tout dans la plage de cotes
        const probability = 100 / price;
        const pickLabel = isOver ? `+${point} buts` : `−${point} buts`;
        selections.push({
          ...baseSel,
          id: `${eventId}:tot:${isOver?'over':'under'}_${point}:${price}`,
          market: 'Buts (Over/Under)',
          marketType: isOver ? 'over' : 'under',
          marketPoint: point,
          pick: pickLabel,
          pickSide: isOver ? 'over' : 'under',
          odd: price,
          baseProbability: probability,
          probability,
          confidence: clamp(Math.round(probability * 0.78), 30, 72),
          reason: `${pickedBook.isUnibet ? 'Cote Unibet' : 'Cote bookmaker'} ${pickLabel} : ${price.toFixed(2)}`,
        });
      }
    }

    // ═══ Marché 3 : BTTS (Les 2 équipes marquent) ═══
    const btts = markets.find(m => m.key === 'btts');
    if (btts && Array.isArray(btts.outcomes)) {
      for (const out of btts.outcomes) {
        const price = Number(out.price);
        if (!Number.isFinite(price) || price < oddMin || price > oddMax) continue;

        const name = String(out.name || '').toLowerCase();
        const isYes = /^yes$/.test(name) || name === 'oui';
        const isNo = /^no$/.test(name) || name === 'non';
        if (!isYes && !isNo) continue;

        const probability = 100 / price;
        selections.push({
          ...baseSel,
          id: `${eventId}:btts:${isYes?'yes':'no'}:${price}`,
          market: 'Les 2 marquent',
          marketType: isYes ? 'btts_yes' : 'btts_no',
          pick: isYes ? 'Les 2 marquent : Oui' : 'Les 2 marquent : Non',
          pickSide: isYes ? 'btts_yes' : 'btts_no',
          odd: price,
          baseProbability: probability,
          probability,
          confidence: clamp(Math.round(probability * 0.78), 30, 72),
          reason: `${pickedBook.isUnibet ? 'Cote Unibet' : 'Cote bookmaker'} BTTS ${isYes?'Oui':'Non'} : ${price.toFixed(2)}`,
        });
      }
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

async function fetchGamesForDate(api, date, errors, opts = {}) {
  const path = api === 'football' ? '/fixtures' : '/games';
  const leaguePart = opts.league ? `:${opts.league}` : '';
  const seasonsPart = (opts.seasons || []).join(',');
  const key = `${api}:${path}:${date}${leaguePart}:${seasonsPart}`;
  return cached(key, 30 * 60 * 1000, async () => {
    // ▶ API-Football exige `season` quand on passe `league`.
    //   Mais les championnats ont des calendriers différents :
    //   - Europe (Ligue 1, EPL, Serie A...) : saison = année - 1 entre janvier-juillet
    //   - Brésil/Argentine/MLS : saison = année courante (calendrier civil)
    //   → On essaie LES DEUX saisons (N et N-1) et on fusionne.
    const seasons = opts.seasons || [];
    const results = [];

    for (const season of seasons) {
      try {
        const params = { date };
        if (opts.league) params.league = opts.league;
        if (season) params.season = season;
        const body = await apiSports(api, path, params);
        const arr = Array.isArray(body?.response) ? body.response : [];
        results.push(...arr);
        // Si on a trouvé des matchs avec cette saison, on s'arrête (économie de quota)
        if (arr.length > 0) break;
      } catch (err) {
        errors.push({ source: api, endpoint: path, date, league: opts.league, season, message: err.message, status: err.statusCode || 500 });
        // Si erreur quota, on arrête immédiatement
        if (err.message && err.message.includes('Quota')) break;
      }
    }

    // Fallback sans league/season (max 100 matchs monde) si rien trouvé
    if (results.length === 0 && opts.league) {
      try {
        const body = await apiSports(api, path, { date });
        const arr = Array.isArray(body?.response) ? body.response : [];
        results.push(...arr);
      } catch (err) {
        // déjà loggé
      }
    }

    return results;
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
  const currentYear = new Date().getUTCFullYear();
  // ▶ FIX : pour les calendriers européens en mai, la saison en cours est N-1
  //   On essaie les 2 saisons pour couvrir tous les championnats.
  const seasonsToTry = api === 'football' ? [currentYear, currentYear - 1] : [currentYear];
  const league = context.leagueId;
  const key = `${api}:recent:${teamId}:multi:${league || 'all'}`;

  return cached(key, 3 * 60 * 60 * 1000, async () => {
    let collected = [];
    let totalRawResponses = 0;
    const requestErrors = [];

    // ▶ Stratégie cascade pour le foot : season+team (le plus fiable) → puis last seul
    const attempts = api === 'football'
      ? [
          // Tente d'abord avec season (le plus fiable selon doc API-Football)
          ...seasonsToTry.map(season => ({ team: teamId, season })),
          // Fallback sans season
          { team: teamId, last: 15 },
        ]
      : [
          { team: teamId, season: currentYear },
          { team: teamId, last: 15 },
        ];

    for (const rawParams of attempts) {
      const params = Object.fromEntries(Object.entries(rawParams).filter(([, v]) => !isNil(v)));
      try {
        const body = await apiSports(api, path, params);
        const arr = Array.isArray(body?.response) ? body.response : [];
        totalRawResponses += arr.length;
        collected = collected.concat(arr);
        const finished = uniqGames(collected, api).filter(g => isFinishedGame(g, api));
        // ▶ ÉCONOMIE QUOTA : on s'arrête dès qu'on a 1 match terminé (suffit pour partial)
        if (finished.length >= 1) return finished;
        // ▶ Et aussi si l'API a renvoyé des matchs (même non terminés), on s'arrête
        //   pour ne pas griller du quota inutile (saison en cours = beaucoup de NS)
        if (arr.length >= 5) {
          await sleep(150);
          break;
        }
      } catch (err) {
        requestErrors.push(`${JSON.stringify(params)} → ${err.message}`);
        if (err.message && err.message.includes('Quota API-Sports épuisé')) {
          throw err;
        }
        if (err.message && (err.message.includes('429') || err.message.toLowerCase().includes('too many'))) {
          await sleep(1100);
        }
      }
      await sleep(150);
    }

    const finished = uniqGames(collected, api).filter(g => isFinishedGame(g, api));
    if (finished.length) return finished;

    const statusesSample = collected.slice(0, 3).map(g => statusShort(g, api) || 'unknown').join(', ');
    errors.push({
      source: api,
      endpoint: path,
      team: teamId,
      seasonsTried: seasonsToTry,
      message: `[v8.2] Forme indisponible. API a renvoyé ${totalRawResponses} matchs bruts, 0 terminés (status: ${statusesSample || 'aucun'}).`,
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
    const t = getTeams(g, api);
    const isHome = String(t.home.id) === String(teamId);
    const homeScore = extractScore(g, 'home', api);
    const awayScore = extractScore(g, 'away', api);
    rows.push({
      result: r,
      date: getGameDate(g) || '',
      isHome,
      goalsFor: isHome ? homeScore : awayScore,
      goalsAgainst: isHome ? awayScore : homeScore,
    });
  }
  rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));

  // Forme globale (5 derniers)
  const lastRows = rows.slice(-5);
  const last = lastRows.map(x => x.result);
  const W = last.filter(x => x === 'W').length;
  const D = last.filter(x => x === 'D').length;
  const L = last.filter(x => x === 'L').length;

  // ▶ NOUVELLES METRIQUES PRÉDICTIVES
  // Forme domicile/extérieur séparée (signal fort en foot)
  const homeRows = rows.slice(-10).filter(r => r.isHome);
  const awayRows = rows.slice(-10).filter(r => !r.isHome);
  const homeForm = {
    W: homeRows.filter(r => r.result === 'W').length,
    D: homeRows.filter(r => r.result === 'D').length,
    L: homeRows.filter(r => r.result === 'L').length,
    played: homeRows.length,
  };
  const awayForm = {
    W: awayRows.filter(r => r.result === 'W').length,
    D: awayRows.filter(r => r.result === 'D').length,
    L: awayRows.filter(r => r.result === 'L').length,
    played: awayRows.length,
  };

  // Momentum : moyenne 5 derniers vs moyenne 5 d'avant (en points : W=3, D=1, L=0)
  const last5pts = last.reduce((a, r) => a + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);
  const prev5 = rows.slice(-10, -5).map(x => x.result);
  const prev5pts = prev5.reduce((a, r) => a + (r === 'W' ? 3 : r === 'D' ? 1 : 0), 0);
  const momentum = prev5.length ? (last5pts / 15) - (prev5pts / Math.max(prev5.length * 3, 1)) : 0;

  // Série en cours (streak)
  let streak = 0;
  let streakType = null;
  for (let i = last.length - 1; i >= 0; i--) {
    if (!streakType) { streakType = last[i]; streak = 1; }
    else if (last[i] === streakType) streak++;
    else break;
  }

  // Buts (signal pour Over/BTTS)
  const validScored = rows.slice(-10).filter(r => Number.isFinite(r.goalsFor) && Number.isFinite(r.goalsAgainst));
  const avgGoalsFor = validScored.length ? validScored.reduce((a, r) => a + r.goalsFor, 0) / validScored.length : null;
  const avgGoalsAgainst = validScored.length ? validScored.reduce((a, r) => a + r.goalsAgainst, 0) / validScored.length : null;
  const over25Count = validScored.filter(r => r.goalsFor + r.goalsAgainst > 2.5).length;
  const over25Rate = validScored.length ? over25Count / validScored.length : null;
  const bttsCount = validScored.filter(r => r.goalsFor >= 1 && r.goalsAgainst >= 1).length;
  const bttsRate = validScored.length ? bttsCount / validScored.length : null;

  return {
    form: last, W, D, L, played: last.length,
    label: last.length ? last.join('') : 'n/d',
    homeForm, awayForm,
    momentum: Number(momentum.toFixed(3)),
    streak, streakType,
    avgGoalsFor: avgGoalsFor != null ? Number(avgGoalsFor.toFixed(2)) : null,
    avgGoalsAgainst: avgGoalsAgainst != null ? Number(avgGoalsAgainst.toFixed(2)) : null,
    over25Rate: over25Rate != null ? Number(over25Rate.toFixed(2)) : null,
    bttsRate: bttsRate != null ? Number(bttsRate.toFixed(2)) : null,
    sampleSize: validScored.length,
  };
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

// ════════════════════════════════════════════════════════
// 🧠 MOTEUR PRÉDICTIF — Calcule la probabilité RÉELLE en croisant :
// - Forme générale (W/D/L 5 derniers)
// - Forme domicile/extérieur (signal fort en foot)
// - Momentum (tendance des 5 derniers vs précédents)
// - Série en cours
// - Predictions API-Football (6 algos agrégés)
// - Probabilité implicite des cotes (sagesse du marché)
//
// Renvoie une vraie probabilité 0-100, et détecte le VALUE BET
// (cote sous-évaluée par le bookmaker = profit espéré positif).
// ════════════════════════════════════════════════════════
function computePredictiveProbability(selection, homeStats, awayStats, prediction) {
  // Probabilité de base = celle implicite des cotes (sagesse du marché, ~5% de marge)
  const impliedProb = selection.baseProbability || (100 / selection.odd);
  const marketProb = impliedProb * 0.95; // retire la marge bookmaker

  let predictiveProb = marketProb;
  const signals = [];

  // ── Marché H2H (1X2) : utilise forme home/away + predictions ──
  if (selection.marketType === 'h2h') {
    const chosen = selection.pickSide === 'home' ? homeStats : (selection.pickSide === 'away' ? awayStats : null);
    const other = selection.pickSide === 'home' ? awayStats : (selection.pickSide === 'away' ? homeStats : null);

    if (chosen && other && chosen.played >= 3 && other.played >= 3) {
      // Score forme = points moyens (0..3) normalisés sur 100
      const chosenPts = chosen.W * 3 + chosen.D * 1;
      const otherPts = other.W * 3 + other.D * 1;
      const formGap = (chosenPts - otherPts) / Math.max(chosen.played + other.played, 1);
      // Ajuste la proba : +/- 12% max selon la différence de forme
      const formAdj = clamp(formGap * 4, -12, 12);
      predictiveProb += formAdj;
      if (Math.abs(formAdj) > 2) signals.push(`forme ${formAdj > 0 ? '+' : ''}${formAdj.toFixed(1)}`);

      // Forme spécifique domicile (équipe à domicile gagnant 'home')
      if (selection.pickSide === 'home' && chosen.homeForm && chosen.homeForm.played >= 3) {
        const homeRate = chosen.homeForm.W / chosen.homeForm.played;
        const homeAdj = clamp((homeRate - 0.4) * 10, -5, 8);
        predictiveProb += homeAdj;
        if (Math.abs(homeAdj) > 1.5) signals.push(`dom ${homeAdj > 0 ? '+' : ''}${homeAdj.toFixed(1)}`);
      }

      // Momentum : équipes en série gagnante / défaite
      if (chosen.momentum !== undefined) {
        const momAdj = clamp(chosen.momentum * 15, -6, 6);
        predictiveProb += momAdj;
        if (Math.abs(momAdj) > 2) signals.push(`mom ${momAdj > 0 ? '+' : ''}${momAdj.toFixed(1)}`);
      }

      // Série de victoires/défaites
      if (chosen.streak >= 3 && chosen.streakType === 'W') {
        predictiveProb += 4;
        signals.push(`série ${chosen.streak}V`);
      } else if (chosen.streak >= 3 && chosen.streakType === 'L') {
        predictiveProb -= 5;
        signals.push(`série ${chosen.streak}D`);
      }
    }

    // Predictions API-Football (croise avec 6 algos)
    if (prediction?.predictions) {
      const p = prediction.predictions;
      const winnerName = p?.winner?.name || '';
      if (winnerName && similarity(winnerName, selection.pick) >= 0.72) {
        predictiveProb += 6;
        signals.push('AF winner ✓');
      }
      const pct = p?.percent || {};
      const target = selection.pickSide === 'home' ? pct.home : (selection.pickSide === 'away' ? pct.away : pct.draw);
      if (target && typeof target === 'string') {
        const num = Number(target.replace('%', ''));
        if (Number.isFinite(num)) {
          // Pondère la pred vs marché : moyenne 30% pred / 70% marché ajusté
          const blend = predictiveProb * 0.7 + num * 0.3;
          predictiveProb = blend;
          signals.push(`AF ${num}%`);
        }
      }
    }
  }

  // ── Marché TOTALS (Over/Under buts) : utilise avgGoals + over25Rate ──
  if (selection.marketType === 'over' || selection.marketType === 'under') {
    if (homeStats?.avgGoalsFor != null && awayStats?.avgGoalsFor != null) {
      const projectedGoals = (homeStats.avgGoalsFor + homeStats.avgGoalsAgainst + awayStats.avgGoalsFor + awayStats.avgGoalsAgainst) / 2;
      const point = selection.marketPoint || 2.5;

      if (selection.marketType === 'over') {
        // Plus les buts moyens dépassent le seuil, plus l'Over est probable
        const goalAdj = clamp((projectedGoals - point) * 8, -15, 15);
        predictiveProb += goalAdj;
        signals.push(`buts moy ${projectedGoals.toFixed(1)}`);
      } else {
        const goalAdj = clamp((point - projectedGoals) * 8, -15, 15);
        predictiveProb += goalAdj;
        signals.push(`buts moy ${projectedGoals.toFixed(1)}`);
      }

      // Bonus si l'historique confirme (over25Rate sur les 2 équipes)
      if (homeStats.over25Rate != null && awayStats.over25Rate != null) {
        const avgOver = (homeStats.over25Rate + awayStats.over25Rate) / 2;
        if (selection.marketType === 'over' && avgOver >= 0.6) {
          predictiveProb += 4;
          signals.push(`O2.5 ${Math.round(avgOver * 100)}%`);
        } else if (selection.marketType === 'under' && avgOver <= 0.4) {
          predictiveProb += 4;
          signals.push(`U2.5 hist`);
        }
      }
    }
  }

  // ── Marché BTTS : utilise bttsRate des 2 équipes ──
  if (selection.marketType === 'btts_yes' || selection.marketType === 'btts_no') {
    if (homeStats?.bttsRate != null && awayStats?.bttsRate != null) {
      const avgBtts = (homeStats.bttsRate + awayStats.bttsRate) / 2;
      if (selection.marketType === 'btts_yes') {
        const adj = clamp((avgBtts - 0.5) * 30, -15, 15);
        predictiveProb += adj;
        signals.push(`BTTS hist ${Math.round(avgBtts * 100)}%`);
      } else {
        const adj = clamp((0.5 - avgBtts) * 30, -15, 15);
        predictiveProb += adj;
        signals.push(`BTTS no ${Math.round((1 - avgBtts) * 100)}%`);
      }
    }
  }

  predictiveProb = clamp(predictiveProb, 5, 95);

  // ▶ DÉTECTION VALUE BET
  // Si proba prédictive > proba implicite du bookmaker → cote sous-évaluée = profit espéré
  // Edge = (probaPredictive/100) × cote − 1 (positif = value bet)
  const edge = (predictiveProb / 100) * selection.odd - 1;
  const valueBet = edge > 0.05; // au moins 5% d'edge

  return {
    predictiveProb,
    impliedProb,
    edge,
    valueBet,
    signals,
  };
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

// ▶ NOUVELLE STRATEGIE : team-first
//   Au lieu de chercher fixtures par date+league+season (qui échoue car saisons varient),
//   on cherche les ÉQUIPES par leur nom, puis on récupère leurs derniers matchs.
//   Plus fiable car indépendant des dates et saisons.
async function searchTeamByName(api, teamName, errors) {
  if (!teamName) return null;
  const key = `${api}:teamSearch:${teamName.toLowerCase()}`;
  return cached(key, 7 * 24 * 60 * 60 * 1000, async () => { // cache 7 jours
    try {
      // ▶ API-Football : /teams?search= (min 3 caractères, accepte le nom complet)
      //   On nettoie le nom (retire FC, CF, SC, club, etc.) pour maximiser les chances
      let search = teamName.trim();
      // Garde le nom complet jusqu'à 30 chars
      if (search.length < 3) {
        errors.push({ source: api, message: `Nom équipe trop court : "${teamName}"` });
        return null;
      }
      search = search.substring(0, 30);

      const body = await apiSports(api, '/teams', { search });
      const arr = Array.isArray(body?.response) ? body.response : [];

      if (arr.length === 0) {
        // ▶ FALLBACK : si 0 résultat, essaie avec le premier mot significatif
        //   Ex: "Inter Miami CF" → "Miami", "Bayer Leverkusen" → "Leverkusen"
        const words = teamName.split(/\s+/).filter(w => w.length >= 4 && !/^(fc|sc|cf|sk|sv|ac|as|le|la|de|du|of)$/i.test(w));
        if (words.length > 0) {
          const fallback = words[words.length - 1]; // dernier mot souvent le plus distinctif
          if (fallback.length >= 3 && fallback !== search) {
            try {
              const fallbackBody = await apiSports(api, '/teams', { search: fallback });
              const fallbackArr = Array.isArray(fallbackBody?.response) ? fallbackBody.response : [];
              if (fallbackArr.length > 0) {
                arr.push(...fallbackArr);
              }
            } catch (e) { /* ignore */ }
          }
        }
      }

      if (arr.length === 0) {
        errors.push({ source: api, message: `API-Sports : 0 équipe trouvée pour "${teamName}"` });
        return null;
      }

      // Trouve la meilleure correspondance par similarité de nom
      let best = null;
      let bestSim = 0;
      for (const entry of arr) {
        const teamData = entry.team || entry;
        const apiName = teamData.name || '';
        const sim = similarity(teamName, apiName);
        if (sim > bestSim) {
          bestSim = sim;
          best = { id: teamData.id, name: apiName, similarity: sim };
        }
      }
      // ▶ Seuil abaissé à 0.55 (Inter Miami CF ≈ Inter Miami sim ~0.75 OK)
      //   En dessous de 0.55, c'est vraiment douteux
      if (best && best.similarity >= 0.55) return best;
      errors.push({
        source: api,
        message: `Équipe "${teamName}" : meilleur match "${best?.name}" avec similarité ${best?.similarity?.toFixed(2)} (rejeté car < 0.55)`,
      });
      return null;
    } catch (err) {
      errors.push({ source: api, message: `Recherche équipe "${teamName}" échouée : ${err.message}` });
      if (err.message && err.message.includes('Quota')) throw err;
      return null;
    }
  });
}

async function enrichSelections(selections, opts, errors) {
  // ▶ DÉFENSIF : si maxApiEvents arrive en null/undefined/0, on force 60
  const maxApiEvents = (typeof opts.maxApiEvents === 'number' && opts.maxApiEvents > 0)
    ? opts.maxApiEvents
    : 60;
  errors.push({ source: 'paridex', message: `[v8.1] enrichSelections démarré avec ${selections.length} sélections, maxApiEvents=${maxApiEvents}` });

  const byEvent = [];
  const seen = new Set();

  // ▶ PRIORISATION INTELLIGENTE :
  //   1. Foot avec ligue mappée (Ligue 1, EPL, Brazil, etc.) en premier
  //   2. Cotes intéressantes (1.5-2.5) avant ultra-favoris (1.2) et outsiders (>3)
  //   → maximise les chances de trouver des stats utiles avec peu de quota
  const prioritized = selections.slice().sort((a, b) => {
    const aIsFootMapped = a.apiSport === 'football' && ODDS_TO_APIFOOTBALL_LEAGUE[a.oddsSportKey] ? 1 : 0;
    const bIsFootMapped = b.apiSport === 'football' && ODDS_TO_APIFOOTBALL_LEAGUE[b.oddsSportKey] ? 1 : 0;
    if (aIsFootMapped !== bIsFootMapped) return bIsFootMapped - aIsFootMapped;

    // Score "cote sweet spot" : proche de 1.7 (équilibre entre proba et value)
    const sweetA = Math.abs(a.odd - 1.7);
    const sweetB = Math.abs(b.odd - 1.7);
    return sweetA - sweetB;
  });

  for (const s of prioritized) {
    if (!seen.has(s.eventId)) {
      seen.add(s.eventId);
      byEvent.push(s);
    }
    if (byEvent.length >= maxApiEvents) break;
  }

  errors.push({ source: 'paridex', message: `[v8.1] byEvent après dédoublonnage: ${byEvent.length} matchs uniques` });

  // ▶ ÉCONOMIE QUOTA : on limite le nombre de matchs à enrichir en fonction du quota restant
  //   Chaque match consomme ~3-5 requêtes.
  const reqPerMatch = 4;
  const safetyBuffer = 5;
  // On laisse plus de matchs si quota inconnu (1ère requête le révèlera)
  const maxAffordable = apiSportsQuota.remaining !== null
    ? Math.max(0, Math.floor((apiSportsQuota.remaining - safetyBuffer) / reqPerMatch))
    : byEvent.length;

  const eventsToEnrich = byEvent.slice(0, Math.min(byEvent.length, maxAffordable, maxApiEvents));

  errors.push({
    source: 'paridex',
    message: `[v8.1] eventsToEnrich: ${eventsToEnrich.length} (byEvent=${byEvent.length}, maxAffordable=${maxAffordable}, maxApiEvents=${maxApiEvents}, quotaRemaining=${apiSportsQuota.remaining})`,
  });

  if (apiSportsQuota.remaining !== null && eventsToEnrich.length < byEvent.length) {
    errors.push({
      source: 'apisports',
      message: `Quota API-Football limité (${apiSportsQuota.remaining}/${apiSportsQuota.limit || '?'}). Enrichissement limité à ${eventsToEnrich.length}/${byEvent.length} matchs. Pour plus, upgrade Pro $19/mois.`,
    });
  }

  const enrichedByEvent = new Map();
  let quotaExhausted = false;

  for (const seed of eventsToEnrich) {
    if (quotaExhausted) break;

    const api = seed.apiSport;
    if (!API_BASES[api] || api === 'mma' || api === 'formula1') {
      errors.push({ source: api, event: seed.eventId, message: `Enrichissement automatique non activé pour ${api}.` });
      continue;
    }

    try {
      errors.push({ source: 'paridex', message: `[v8.2] Tentative enrichissement: ${seed.homeTeam} vs ${seed.awayTeam} (${api})` });
      // ▶ ÉTAPE 1 : Trouver les IDs des 2 équipes par recherche de nom
      //   PAUSES de 200ms entre requêtes pour respecter rate limit Free (10 req/min)
      await sleep(200);
      const homeTeam = await searchTeamByName(api, seed.homeTeam, errors);
      await sleep(200);
      const awayTeam = await searchTeamByName(api, seed.awayTeam, errors);

      if (!homeTeam && !awayTeam) {
        errors.push({
          source: api,
          event: seed.eventId,
          message: `Équipes non trouvées dans API-Sports : "${seed.homeTeam}" et "${seed.awayTeam}"`,
        });
        continue;
      }

      // ▶ ÉTAPE 2 : Récupérer la forme (last=10) pour chaque équipe — pas de saison nécessaire
      await sleep(250);
      const homeRecent = homeTeam ? await fetchRecentGames(api, homeTeam.id, errors, { fixtureId: null, seed }) : [];
      await sleep(250);
      const awayRecent = awayTeam ? await fetchRecentGames(api, awayTeam.id, errors, { fixtureId: null, seed }) : [];

      const homeStats = homeTeam ? summarizeForm(homeRecent, homeTeam.id, api) : { form: [], W: 0, D: 0, L: 0, played: 0, label: 'n/d' };
      const awayStats = awayTeam ? summarizeForm(awayRecent, awayTeam.id, api) : { form: [], W: 0, D: 0, L: 0, played: 0, label: 'n/d' };

      // ▶ ÉTAPE 3 : Predictions (uniquement si quota OK : ça coûte 2 requêtes en plus par match)
      let prediction = null;
      let fixtureId = null;
      const quotaOkForPredictions = apiSportsQuota.remaining === null || apiSportsQuota.remaining > 20;
      if (api === 'football' && homeTeam && quotaOkForPredictions) {
        try {
          await sleep(250);
          const nextBody = await apiSports(api, '/fixtures', { team: homeTeam.id, next: 5 });
          const upcoming = Array.isArray(nextBody?.response) ? nextBody.response : [];
          const targetMatch = upcoming.find(g => {
            const t = getTeams(g, api);
            return awayTeam && String(t.away.id) === String(awayTeam.id);
          });
          if (targetMatch) {
            fixtureId = getGameId(targetMatch);
            await sleep(15);
            prediction = await fetchFootballPrediction(fixtureId, errors);
          }
        } catch (err) {
          if (err.message && err.message.includes('Quota')) throw err;
        }
      }

      const fullEnough = homeStats.played >= 3 && awayStats.played >= 3;
      const partialEnough = homeStats.played >= 1 || awayStats.played >= 1 || prediction;

      if (!fullEnough && !partialEnough) {
        errors.push({
          source: api,
          event: seed.eventId,
          message: 'Équipes trouvées mais aucun match récent exploitable.',
          homePlayed: homeStats.played,
          awayPlayed: awayStats.played,
          homeId: homeTeam?.id,
          awayId: awayTeam?.id,
        });
        continue;
      }

      enrichedByEvent.set(seed.eventId, {
        api,
        fixtureId,
        leagueName: seed.league,
        teams: {
          home: { id: homeTeam?.id, name: homeTeam?.name || seed.homeTeam },
          away: { id: awayTeam?.id, name: awayTeam?.name || seed.awayTeam },
        },
        homeStats,
        awayStats,
        prediction,
        _quality: fullEnough ? 'full' : 'partial',
      });
    } catch (err) {
      if (err.message && err.message.includes('Quota API-Sports épuisé')) {
        quotaExhausted = true;
        errors.push({
          source: 'apisports',
          message: `🛑 Quota API-Sports épuisé. ${enrichedByEvent.size} matchs enrichis, ${byEvent.length - enrichedByEvent.size - 1} restants traités en cotes seules.`,
          quota: apiSportsQuota,
        });
      } else {
        errors.push({ source: api, event: seed.eventId, message: err.message });
      }
    }
  }

  const enriched = [];
  for (const s of selections) {
    const e = enrichedByEvent.get(s.eventId);
    if (!e) {
      // ▶ Sélection non enrichie : on la GARDE en mode odds_only
      //   (sport unknown, match non retrouvé dans API-Sports, etc.)
      //   La confidence reste basée sur la cote, mais on accepte de combiner ces matchs
      //   plutôt que de retourner "0 combiné".
      enriched.push({
        ...s,
        dataQuality: 'odds_only',
        // pas de prédiction réelle → on s'appuie uniquement sur la cote
        probability: s.baseProbability || (100 / s.odd),
        confidence: clamp(Math.round((s.baseProbability || (100 / s.odd)) * 0.85 + 12), 35, 75),
      });
      continue;
    }

    // ▶ MOTEUR PRÉDICTIF : croise toutes les sources de données
    const pred = computePredictiveProbability(s, e.homeStats, e.awayStats, e.prediction);

    // Confidence finale = pondération entre proba prédictive et value bet
    // - 70% probabilité prédictive (forme + predictions)
    // - 30% bonus "value bet" (cote sous-évaluée)
    const valueBonus = pred.valueBet ? Math.min(15, pred.edge * 30) : 0;
    const confidence = clamp(Math.round(pred.predictiveProb * 0.7 + valueBonus + 25), 35, 94);

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
      predictiveProb: Number(pred.predictiveProb.toFixed(1)),
      impliedProb: Number(pred.impliedProb.toFixed(1)),
      edge: Number((pred.edge * 100).toFixed(1)),  // en %
      valueBet: pred.valueBet,
      signals: pred.signals,
      advice: adviceText({ ...s, league: e.leagueName }, null, e.homeStats, e.awayStats, e.prediction)
        + (pred.valueBet ? ` 💎 VALUE BET : edge ${(pred.edge * 100).toFixed(1)}%` : '')
        + (pred.signals.length ? ` · Signaux : ${pred.signals.join(', ')}` : ''),
    };

    enriched.push({
      ...s,
      league: e.leagueName || s.league,
      confidence,
      probability: pred.predictiveProb,
      predictiveProb: pred.predictiveProb,
      edge: pred.edge,
      valueBet: pred.valueBet,
      dataQuality: e._quality || 'full',
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
  // Seuils plus exigeants pour maximiser le taux de réussite
  if (risk === 'safe') return 68;  // ↑ de 62 — exige forte confiance
  if (risk === 'bold') return 48;  // ↑ de 45
  return 58;                        // ↑ de 52 — modéré plus sélectif
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

  // ▶ STRATÉGIE EN CASCADE INTERNE :
  //   1. D'abord on tente avec sélections 'full' ou 'partial' (enrichies)
  //   2. Si pas assez (< 3 sélections), on ouvre aux 'odds_only' avec confiance assouplie
  let candidates = selections.filter(s =>
    (s.dataQuality === 'full' || s.dataQuality === 'partial')
    && s.confidence >= minConf
  );

  if (candidates.length < 3) {
    // Pas assez de sélections enrichies → on accepte les odds_only avec confiance abaissée
    const minConfRelaxed = Math.max(40, minConf - 18);
    candidates = selections.filter(s => s.confidence >= minConfRelaxed);
  }

  const sorted = candidates.sort((a, b) => (b.confidence - a.confidence) || (a.odd - b.odd));

  const combos = [];
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

    // ▶ PÉNALITÉ DU MAILLON FAIBLE
    // Un combiné est aussi solide que sa pire sélection. On pénalise donc le minimum.
    const minConfLeg = Math.min(...legs.map(l => l.confidence));
    const weakLinkPenalty = Math.max(0, (avgConf - minConfLeg) * 0.5);

    // ▶ BONUS VALUE BETS : nombre de legs avec edge positif
    const valueLegsCount = legs.filter(l => l.valueBet === true).length;
    const valueBonus = valueLegsCount * 4; // +4 par value bet

    // ▶ BONUS EDGE TOTAL (somme des edges positifs)
    const totalEdge = legs.reduce((a, l) => a + Math.max(0, (l.edge || 0) * 100), 0);
    const edgeBonus = Math.min(totalEdge * 0.3, 8); // cap à +8

    // ▶ BONUS UNIBET (rapidité de pari Unibet exclusif)
    const unibetRatio = legs.filter(l => l.isUnibet).length / legs.length;
    const unibetBonus = unibetRatio * 5;

    // ▶ BONUS DIVERSITÉ SPORTS
    const sportDiversity = new Set(legs.map(l => l.apiSport)).size;
    const diversityBonus = (sportDiversity - 1) * 2;

    // ▶ BONUS DIVERSITÉ MARCHÉS
    const marketDiversity = new Set(legs.map(l => l.marketType)).size;
    const marketBonus = (marketDiversity - 1) * 2;

    // ▶ PÉNALITÉ COTE EXTRÊME (cote totale > 8 = peu fiable)
    const extremePenalty = Math.max(0, odd - 8) * 2.5;

    const score = avgConf
      - weakLinkPenalty
      + valueBonus
      + edgeBonus
      + unibetBonus
      + diversityBonus
      + marketBonus
      - extremePenalty;

    combos.push({
      legs,
      odd,
      probability,
      avgConf,
      minConfLeg,
      valueLegsCount,
      totalEdge,
      confidence: clamp(Math.round(score), 30, 94),
      score,
    });
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

  combos.sort((a, b) => b.score - a.score);

  const selected = [];
  const eventUse = new Map();
  const comboFingerprints = new Set();

  function canTake(c, maxUse) {
    const fp = c.legs.map(l => l.eventId).sort().join('|');
    if (comboFingerprints.has(fp)) return false;
    return c.legs.every(l => (eventUse.get(l.eventId) || 0) < maxUse);
  }

  for (const maxUse of [1, 2, 3, 4]) {
    for (const c of combos) {
      if (selected.length >= opts.limit) break;
      if (!canTake(c, maxUse)) continue;
      const fp = c.legs.map(l => l.eventId).sort().join('|');
      comboFingerprints.add(fp);
      c.legs.forEach(l => eventUse.set(l.eventId, (eventUse.get(l.eventId) || 0) + 1));
      selected.push(c);
    }
    if (selected.length >= opts.limit) break;
  }

  return selected.slice(0, opts.limit).map((c, idx) => {
    const valueLabel = c.valueLegsCount > 0 ? ` · 💎 ${c.valueLegsCount} value bet${c.valueLegsCount > 1 ? 's' : ''}` : '';
    return {
      title: comboTitle(c.legs.length, idx),
      rank: idx + 1,
      odd: Number(c.odd.toFixed(2)),
      probability: Number(c.probability.toFixed(1)),
      confidence: c.confidence,
      valueLegsCount: c.valueLegsCount,
      totalEdge: Number(c.totalEdge.toFixed(1)),
      avgConf: Number(c.avgConf.toFixed(1)),
      minConfLeg: c.minConfLeg,
      dataQuality: c.legs.every(l => l.dataQuality === 'full') ? 'full' : (c.legs.every(l => l.dataQuality !== 'odds_only') ? 'partial' : 'odds_only'),
      mode: c.legs.every(l => l.dataQuality === 'full') ? 'enriched' : (c.legs.every(l => l.dataQuality !== 'odds_only') ? 'partial' : 'odds_only'),
      legs: c.legs,
      verdict: c.legs.every(l => l.dataQuality === 'full')
        ? `✅ Cotes + API-Sports complet${valueLabel}`
        : (c.legs.every(l => l.dataQuality !== 'odds_only')
          ? `🔵 Cotes + forme partielle${valueLabel}`
          : `ℹ️ Cotes seules${valueLabel}`),
      reason: c.legs.map(l => `${l.sport} ${l.league} : ${l.pick} @${l.odd.toFixed(2)}${l.valueBet ? ' 💎' : ''}`).join(' · '),
    };
  });
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });

  const started = Date.now();
  const errors = [];

  // ▶ MODE DEBUG : permet de tester la recherche d'équipe en isolation
  //   Ex: /api/recommendations?debug=teamSearch&team=Palmeiras
  //   Renvoie ce qu'API-Sports répond + similarités calculées
  if (req.query?.debug === 'teamSearch') {
    const teamName = String(req.query.team || '').trim();
    const api = String(req.query.api || 'football').toLowerCase();
    if (!teamName) return sendJson(res, 400, { ok: false, error: 'MISSING_TEAM', message: 'Ajoute ?team=NomEquipe' });
    try {
      const body = await apiSports(api, '/teams', { search: teamName.substring(0, 30) });
      const arr = Array.isArray(body?.response) ? body.response : [];
      const matches = arr.map(entry => {
        const t = entry.team || entry;
        return {
          id: t.id,
          name: t.name,
          country: t.country,
          similarity: Number(similarity(teamName, t.name || '').toFixed(2)),
          accepted: similarity(teamName, t.name || '') >= 0.55,
        };
      });
      return sendJson(res, 200, {
        ok: true,
        teamName,
        api,
        resultsCount: arr.length,
        matches: matches.sort((a, b) => b.similarity - a.similarity).slice(0, 10),
        quota: apiSportsQuota,
        errors,
      });
    } catch (err) {
      return sendJson(res, 500, { ok: false, error: err.message, teamName, api });
    }
  }

  try {
    const oddsKey = process.env.ODDS_API_KEY;
    if (!oddsKey) return sendJson(res, 500, { ok: false, error: 'MISSING_ODDS_API_KEY', message: 'Ajoute ODDS_API_KEY dans Vercel.' });

    const q = req.query || {};
    const risk = String(q.risk || 'mod').toLowerCase();
    const days = clamp(Number(q.days || 3), 1, 14);
    const limit = clamp(Number(q.limit || 20), 1, 40);
    const maxLegs = q.maxLegs ? Number(q.maxLegs) : undefined;
    // ▶ Mode testOne : enrichit UN seul match pour valider le pipeline sans consommer le quota
    const testOne = String(q.testOne || '0') === '1';
    const maxApiEvents = testOne ? 1 : clamp(Number(q.maxApiEvents || 60), 5, 120);
    const unibetOnly = String(q.unibetOnly ?? '1') !== '0';
    const allowPartial = String(q.allowPartial || '0') === '1';

    // ▶ Liste de matchs déjà proposés à l'utilisateur (historique 24h)
    //   On les exclut pour éviter de reproposer les mêmes combinés
    const excludeEventIdsRaw = String(q.excludeEventIds || '').trim();
    const excludeEventIds = excludeEventIdsRaw
      ? new Set(excludeEventIdsRaw.split(',').map(s => s.trim()).filter(Boolean))
      : new Set();

    const fromIso = oddsIso(new Date());
    const toIso = oddsIso(addDays(new Date(), days));

    const requestedKeys = resolveSports(q.sports);
    const activeSports = await getActiveOddsSports(oddsKey).catch(err => {
      errors.push({ source: 'odds', message: `Impossible de lire /sports : ${err.message}` });
      return [];
    });
    const activeSet = new Set(activeSports.map(s => s.key));

    // ▶ STRATÉGIE : on essaie TOUS les sports demandés (l'endpoint /odds peut répondre
    //    même si le sport n'est pas dans /sports actifs). Si l'API rejette, on log.
    //    Avantage : pas de "0 match" silencieux à cause d'une cache désynchronisée.
    const activeRequested = requestedKeys.slice(); // on tente tout

    // Log informatif : quels sports demandés ne sont pas dans la liste active
    const notInActive = requestedKeys.filter(k => activeSet.size && !activeSet.has(k));
    if (notInActive.length) {
      errors.push({
        source: 'odds',
        message: `Sports demandés non listés actifs (essayés quand même) : ${notInActive.join(', ')}. Actifs sur The Odds API : ${[...activeSet].slice(0, 8).join(', ')}${activeSet.size > 8 ? '...' : ''}`,
      });
    }

    let allEvents = [];
    let quota = {};
    for (const sportKey of activeRequested) {
      const { events, quota: qh } = await fetchOddsForSport(oddsKey, sportKey, fromIso, toIso, errors);
      quota = { ...quota, ...Object.fromEntries(Object.entries(qh).filter(([, v]) => v != null)) };
      for (const ev of events) allEvents.push({ ...ev, _sportKey: sportKey });
    }

    // ▶ FALLBACK : si 0 événement après les sports demandés, essaie les sports
    //    POPULAIRES actuellement actifs (sauf ceux déjà essayés)
    if (allEvents.length === 0 && activeSet.size > 0) {
      const popularFallbacks = [
        'soccer_brazil_campeonato',
        'soccer_argentina_primera_division',
        'soccer_usa_mls',
        'basketball_nba',
        'baseball_mlb',
        'icehockey_nhl',
        'soccer_epl',
        'soccer_uefa_champs_league',
      ].filter(k => activeSet.has(k) && !activeRequested.includes(k));

      if (popularFallbacks.length) {
        errors.push({
          source: 'odds',
          message: `0 match trouvé pour les sports demandés. Bascule sur sports populaires actifs : ${popularFallbacks.join(', ')}`,
        });
        for (const sportKey of popularFallbacks.slice(0, 4)) {
          const { events, quota: qh } = await fetchOddsForSport(oddsKey, sportKey, fromIso, toIso, errors);
          quota = { ...quota, ...Object.fromEntries(Object.entries(qh).filter(([, v]) => v != null)) };
          for (const ev of events) allEvents.push({ ...ev, _sportKey: sportKey });
          activeRequested.push(sportKey); // ajouter pour la suite
        }
      }
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

    // ▶ EXCLUSION HISTORIQUE : retire les matchs déjà proposés à l'utilisateur (24h)
    const beforeExclude = rawSelections.length;
    if (excludeEventIds.size > 0) {
      rawSelections = rawSelections.filter(s => !excludeEventIds.has(s.eventId));
      const removed = beforeExclude - rawSelections.length;
      if (removed > 0) {
        errors.push({
          source: 'paridex',
          message: `[v9] Historique : ${removed} sélections exclues (matchs déjà proposés)`,
        });
      }
    }

    // ▶ STRATÉGIE EN 2 PHASES (économie quota API-Football) :
    //   PHASE 1 : Forme les combinés sur la BASE DES COTES uniquement
    //   PHASE 2 : Enrichit UNIQUEMENT les sélections qui sont DANS un combiné
    //   → 6x moins de quota consommé qu'en enrichissant toutes les 200 sélections

    // PHASE 1 : Construit les combinés en mode "cote seule" (gratuit, 0 req API-Football)
    // On marque toutes les sélections en odds_only pour que buildCombos accepte tout
    const phase1Selections = rawSelections.map(s => ({
      ...s,
      dataQuality: 'odds_only',
      // Petit boost de confiance pour passer le filtre minConf
      confidence: clamp(Math.round((s.baseProbability || (100 / s.odd)) * 0.85 + 12), 35, 75),
    }));

    // Construit plus de combinés que demandés pour avoir le choix après enrichissement
    const phase1Combos = buildCombos(phase1Selections, { risk, limit: limit * 2, maxLegs, allowPartial: true });

    // Extrait les sélections uniques DES combinés (par eventId)
    const selectionsInCombosMap = new Map();
    for (const combo of phase1Combos) {
      for (const leg of combo.legs || []) {
        if (!selectionsInCombosMap.has(leg.eventId)) {
          selectionsInCombosMap.set(leg.eventId, leg);
        }
      }
    }
    const selectionsInCombos = Array.from(selectionsInCombosMap.values());

    errors.push({
      source: 'paridex',
      message: `[v9] PHASE 1: ${phase1Combos.length} combinés candidats avec ${selectionsInCombos.length} matchs uniques à enrichir (vs ${rawSelections.length} sélections totales)`,
    });

    // PHASE 2 : Enrichit UNIQUEMENT ces ~30 matchs (économie 6x)
    const enrichedSelections = await enrichSelections(selectionsInCombos, { allowPartial, maxApiEvents }, errors);

    // Crée un map pour retrouver rapidement les versions enrichies
    const enrichedMap = new Map();
    for (const e of enrichedSelections) enrichedMap.set(e.eventId, e);

    // PHASE 3 : Reconstruit les combinés avec les versions enrichies (stats + scoring affiné)
    const finalSelections = phase1Selections.map(s => {
      const enriched = enrichedMap.get(s.eventId);
      return enriched ? { ...s, ...enriched } : s;
    });

    const combos = buildCombos(finalSelections, { risk, limit, maxLegs, allowPartial });

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
      apiSportsQuota: { ...apiSportsQuota }, // Pour suivre la consommation côté frontend
      params: { days, risk, limit, maxLegs: legLimitForRisk(risk, maxLegs), sports: activeRequested, unibetOnly, allowPartial, maxApiEvents, testOne },
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
