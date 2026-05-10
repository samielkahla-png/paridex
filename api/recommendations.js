// ════════════════════════════════════════════════════════
// PARIDEX RECOMMENDATIONS — endpoint serveur tout-en-un
// GET /api/recommendations?days=1&risk=mod&limit=20
//
// Objectif : ne jamais bloquer la génération quand API-Football échoue.
// The Odds API fournit les cotes ; API-Football enrichit si disponible.
// ════════════════════════════════════════════════════════

const ODDS_BASE = 'https://api.the-odds-api.com/v4';
const FOOTBALL_BASE = 'https://v3.football.api-sports.io';

const DEFAULT_SPORTS = [
  'soccer_france_ligue_one',
  'soccer_epl',
  'soccer_spain_la_liga',
  'soccer_italy_serie_a',
  'soccer_germany_bundesliga',
  'soccer_uefa_champs_league',
];


const UI_SPORT_MAP = {
  foot: [
    'soccer_france_ligue_one',
    'soccer_epl',
    'soccer_spain_la_liga',
    'soccer_italy_serie_a',
    'soccer_germany_bundesliga',
    'soccer_uefa_champs_league',
    'soccer_uefa_europa_league',
    'soccer_uefa_europa_conference_league',
    'soccer_france_ligue_two',
    'soccer_efl_champ',
    'soccer_brazil_campeonato',
    'soccer_argentina_primera_division',
    'soccer_usa_mls',
  ],
  basket: ['basketball_nba', 'basketball_euroleague'],
  tennis: ['tennis_atp_french_open', 'tennis_wta_french_open'],
  hockey: ['icehockey_nhl'],
  baseball: ['baseball_mlb'],
};

function resolveSports(requestedSports) {
  const raw = Array.isArray(requestedSports) ? requestedSports : [];
  const expanded = [];

  for (const item of raw) {
    const key = String(item || '').trim();
    if (!key) continue;
    if (UI_SPORT_MAP[key]) expanded.push(...UI_SPORT_MAP[key]);
    else expanded.push(key);
  }

  const unique = [...new Set(expanded)];
  return unique.length ? unique : DEFAULT_SPORTS;
}

const CACHE = new Map();

function json(res, status, payload) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(payload));
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function toDateOnly(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(fc|cf|sc|afc|cfc|the|club|de|la|le|los|real)\b/g, '')
    .replace(/[^a-z0-9]/g, '');
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
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }

  if (!resp.ok) {
    const err = new Error(body?.message || body?.error || `HTTP ${resp.status}`);
    err.statusCode = resp.status;
    err.body = body;
    err.headers = Object.fromEntries(resp.headers.entries());
    throw err;
  }

  return {
    body,
    headers: Object.fromEntries(resp.headers.entries()),
  };
}

function getBookmaker(event) {
  const preferred = ['unibet', 'betclic', 'winamax', 'pinnacle', 'betfair_ex_eu'];
  const bookmakers = event.bookmakers || [];
  return preferred.map((key) => bookmakers.find((b) => b.key === key)).find(Boolean) || bookmakers[0];
}

function extractSelections(event, sportKey) {
  const bookmaker = getBookmaker(event);
  const market = bookmaker?.markets?.find((m) => m.key === 'h2h');
  if (!market?.outcomes?.length) return [];

  return market.outcomes
    .filter((o) => Number(o.price) > 1.15 && Number(o.price) < 5)
    .map((outcome) => {
      const price = Number(outcome.price);
      const impliedProbability = 1 / price;
      const isDraw = ['draw', 'nul', 'x'].includes(String(outcome.name).toLowerCase());
      const side = isDraw
        ? 'draw'
        : norm(outcome.name) === norm(event.home_team)
          ? 'home'
          : norm(outcome.name) === norm(event.away_team)
            ? 'away'
            : 'unknown';

      return {
        id: `${event.id}:${side}:${outcome.name}`,
        eventId: event.id,
        sportKey,
        commenceTime: event.commence_time,
        date: toDateOnly(event.commence_time),
        homeTeam: event.home_team,
        awayTeam: event.away_team,
        pick: outcome.name,
        market: '1X2',
        side,
        odd: price,
        bookmaker: bookmaker?.title || bookmaker?.key || 'Bookmaker',
        impliedProbability,
        dataQuality: 'odds_only',
        apiFootball: null,
      };
    });
}

function baseScore(selection, risk) {
  const p = selection.impliedProbability;
  const odd = selection.odd;

  let oddFit = 0;
  if (risk === 'safe') oddFit = odd <= 1.8 ? 1 : odd <= 2.2 ? 0.8 : 0.45;
  else if (risk === 'bold') oddFit = odd >= 1.7 && odd <= 3.5 ? 1 : 0.55;
  else oddFit = odd >= 1.35 && odd <= 2.5 ? 1 : 0.6;

  const marketSafety = selection.side === 'draw' ? 0.55 : 1;
  return clamp((p * 100 * 0.65 + oddFit * 25 + marketSafety * 10), 1, 99);
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
  url.searchParams.set('regions', 'eu');
  url.searchParams.set('markets', 'h2h');
  url.searchParams.set('oddsFormat', 'decimal');
  url.searchParams.set('dateFormat', 'iso');
  url.searchParams.set('commenceTimeFrom', fromIso);
  url.searchParams.set('commenceTimeTo', toIso);
  // Pas de paramètre bookmakers ici : certains sports n'ont pas toujours Unibet/Betclic.
  // On choisit ensuite le meilleur bookmaker disponible côté serveur.

  return cached(`odds:${url.toString()}`, 2 * 60 * 1000, async () => fetchJson(url));
}

async function fetchFootballFixturesByDate(date) {
  const apiKey = process.env.API_FOOTBALL_KEY;
  if (!apiKey) {
    const err = new Error('Missing API_FOOTBALL_KEY in Vercel Environment Variables');
    err.statusCode = 500;
    throw err;
  }

  const url = new URL(`${FOOTBALL_BASE}/fixtures`);
  url.searchParams.set('date', date);

  return cached(`apifoot:fixtures:${date}`, 30 * 60 * 1000, async () => {
    const { body } = await fetchJson(url, {
      headers: {
        Accept: 'application/json',
        'x-apisports-key': apiKey,
      },
    });
    return body?.response || [];
  });
}

function matchFixture(selection, fixtures) {
  const h = norm(selection.homeTeam);
  const a = norm(selection.awayTeam);

  return fixtures.find((f) => {
    const fh = norm(f?.teams?.home?.name);
    const fa = norm(f?.teams?.away?.name);
    return (fh === h && fa === a) || (fh === a && fa === h);
  }) || null;
}

function predictionConfidenceForSelection(selection, predictionBody) {
  const pred = predictionBody?.response?.[0]?.predictions;
  if (!pred) return null;

  const percent = pred.percent || {};
  const winnerName = pred.winner?.name;

  let rawPercent = null;
  if (selection.side === 'home') rawPercent = percent.home;
  if (selection.side === 'draw') rawPercent = percent.draw;
  if (selection.side === 'away') rawPercent = percent.away;

  const parsedPercent = Number(String(rawPercent || '').replace('%', ''));
  const winnerBoost = winnerName && norm(winnerName) === norm(selection.pick) ? 8 : 0;

  if (Number.isFinite(parsedPercent)) return clamp(parsedPercent + winnerBoost, 1, 99);
  return null;
}

async function enrichSelection(selection) {
  try {
    if (!String(selection.sportKey || '').startsWith('soccer_')) {
      return { ...selection, dataQuality: 'odds_only', enrichmentNote: 'not_football' };
    }

    const fixtures = await fetchFootballFixturesByDate(selection.date);
    const fixture = matchFixture(selection, fixtures);

    if (!fixture?.fixture?.id) {
      return {
        ...selection,
        dataQuality: 'odds_only',
        enrichmentNote: 'fixture_not_matched',
      };
    }

    const apiKey = process.env.API_FOOTBALL_KEY;
    const url = new URL(`${FOOTBALL_BASE}/predictions`);
    url.searchParams.set('fixture', String(fixture.fixture.id));

    const { body } = await cached(`apifoot:prediction:${fixture.fixture.id}`, 6 * 60 * 60 * 1000, async () => (
      fetchJson(url, {
        headers: {
          Accept: 'application/json',
          'x-apisports-key': apiKey,
        },
      })
    ));

    const apiConfidence = predictionConfidenceForSelection(selection, body);
    const expertBoost = apiConfidence == null ? 0 : (apiConfidence - 50) * 0.45;

    return {
      ...selection,
      fixtureId: fixture.fixture.id,
      apiFootball: {
        confidence: apiConfidence,
        advice: body?.response?.[0]?.predictions?.advice || null,
        winner: body?.response?.[0]?.predictions?.winner?.name || null,
      },
      score: clamp((selection.score || 0) + expertBoost, 1, 99),
      dataQuality: 'full',
    };
  } catch (err) {
    return {
      ...selection,
      dataQuality: 'odds_only',
      enrichmentNote: err.statusCode ? `apifoot_http_${err.statusCode}` : 'apifoot_failed',
    };
  }
}

function product(arr, field) {
  return arr.reduce((acc, item) => acc * Number(item[field] || 1), 1);
}

function comboKey(legs) {
  return legs.map((l) => l.eventId).sort().join('|');
}

function combinations(items, size, limit = 5000) {
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

function buildCombos(selections, risk, maxCombos) {
  // Version V2 : beaucoup moins restrictive.
  // Objectif : ne plus afficher "Aucun combiné exploitable" quand les API ont bien renvoyé des matchs.
  // On essaie d'abord des vrais combinés 2-4 sélections, puis on relâche les critères,
  // et en dernier recours on affiche des sélections simples pour ne jamais laisser l'écran vide.
  const riskRules = {
    safe: [
      { sizes: [2], minScore: 44, maxOdd: 7.5, poolSize: 34, label: 'Combiné prudent' },
      { sizes: [2, 3], minScore: 30, maxOdd: 14, poolSize: 40, label: 'Combiné prudent élargi' },
      { sizes: [1], minScore: 0, maxOdd: 6, poolSize: 14, label: 'Sélection simple recommandée' },
    ],
    mod: [
      { sizes: [2, 3], minScore: 34, maxOdd: 18, poolSize: 38, label: 'Combiné équilibré' },
      { sizes: [2, 3], minScore: 0, maxOdd: 30, poolSize: 44, label: 'Combiné équilibré élargi' },
      { sizes: [1], minScore: 0, maxOdd: 8, poolSize: 16, label: 'Sélection simple recommandée' },
    ],
    bold: [
      { sizes: [2, 3, 4], minScore: 24, maxOdd: 45, poolSize: 44, label: 'Combiné audacieux' },
      { sizes: [2, 3], minScore: 0, maxOdd: 80, poolSize: 50, label: 'Combiné très ouvert' },
      { sizes: [1], minScore: 0, maxOdd: 12, poolSize: 18, label: 'Sélection simple recommandée' },
    ],
  }[risk] || [
    { sizes: [2, 3], minScore: 34, maxOdd: 18, poolSize: 38, label: 'Combiné équilibré' },
    { sizes: [2, 3], minScore: 0, maxOdd: 30, poolSize: 44, label: 'Combiné équilibré élargi' },
    { sizes: [1], minScore: 0, maxOdd: 8, poolSize: 16, label: 'Sélection simple recommandée' },
  ];

  const basePool = selections
    .filter((s) => Number.isFinite(Number(s.odd)) && Number(s.odd) >= 1.12 && Number(s.odd) <= 12)
    .sort((a, b) => {
      const aFull = a.dataQuality === 'full' ? 4 : 0;
      const bFull = b.dataQuality === 'full' ? 4 : 0;
      return (Number(b.score || 0) + bFull) - (Number(a.score || 0) + aFull);
    });

  function buildWithRule(rule) {
    const pool = basePool
      .filter((s) => Number(s.score || 0) >= rule.minScore)
      .slice(0, rule.poolSize);

    const seen = new Set();
    const combos = [];

    for (const size of rule.sizes) {
      if (pool.length < size) continue;

      for (const legs of combinations(pool, size, 12000)) {
        const uniqueEvents = new Set(legs.map((l) => l.eventId));
        if (uniqueEvents.size !== legs.length) continue;

        const key = comboKey(legs);
        if (seen.has(key)) continue;
        seen.add(key);

        const odd = product(legs, 'odd');
        if (!Number.isFinite(odd) || odd > rule.maxOdd) continue;

        const avgScore = legs.reduce((sum, l) => sum + Number(l.score || 0), 0) / legs.length;
        const impliedProbability = legs.reduce((acc, l) => acc * Number(l.impliedProbability || (1 / l.odd)), 1);
        const dataQuality = legs.every((l) => l.dataQuality === 'full') ? 'full' : 'partial';

        combos.push({
          id: key,
          title: size === 1
            ? rule.label
            : size === 2
              ? rule.label
              : size === 3
                ? `${rule.label} · 3 sélections`
                : `${rule.label} · 4 sélections`,
          legs,
          odd: Number(odd.toFixed(2)),
          probability: Number((impliedProbability * 100).toFixed(1)),
          confidence: Math.round(clamp(avgScore, 1, 99)),
          dataQuality,
          generationMode: rule.minScore === 0 ? 'relaxed' : 'standard',
        });
      }
    }

    return combos
      .sort((a, b) => {
        const aQuality = a.dataQuality === 'full' ? 8 : 0;
        const bQuality = b.dataQuality === 'full' ? 8 : 0;
        const aScore = a.confidence * 0.75 + Math.log(Math.max(a.odd, 1.01)) * 10 + aQuality;
        const bScore = b.confidence * 0.75 + Math.log(Math.max(b.odd, 1.01)) * 10 + bQuality;
        return bScore - aScore;
      })
      .slice(0, maxCombos);
  }

  for (const rule of riskRules) {
    const combos = buildWithRule(rule);
    if (combos.length) return combos;
  }

  return [];
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
    const days = clamp(Number(req.query.days || 1), 1, 3);
    const risk = ['safe', 'mod', 'bold'].includes(req.query.risk) ? req.query.risk : 'mod';
    const maxCombos = clamp(Number(req.query.limit || 20), 5, 50);
    const requestedSports = String(req.query.sports || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const sports = resolveSports(requestedSports);

    const now = new Date();
    const fromIso = now.toISOString();
    const toIso = addDays(now, days).toISOString();

    const oddsResults = await Promise.allSettled(
      sports.map(async (sportKey) => {
        const { body, headers } = await fetchOddsForSport(sportKey, fromIso, toIso);
        return { sportKey, events: Array.isArray(body) ? body : [], headers };
      })
    );

    const quota = {};
    const oddsEvents = [];
    const errors = [];

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
      .flatMap((event) => extractSelections(event, event.sportKey))
      .map((s) => ({ ...s, score: baseScore(s, risk) }))
      .sort((a, b) => b.score - a.score);

    // Enrichissement API-Football limité aux meilleurs candidats pour ne pas brûler le quota.
    const candidatesToEnrich = selections.slice(0, 14);
    const enriched = await Promise.all(candidatesToEnrich.map(enrichSelection));
    const enrichedById = new Map(enriched.map((s) => [s.id, s]));

    selections = selections.map((s) => enrichedById.get(s.id) || s);

    const combos = buildCombos(selections, risk, maxCombos);
    const degraded = selections.some((s) => s.dataQuality !== 'full');

    json(res, 200, {
      ok: true,
      generatedAt: new Date().toISOString(),
      degraded,
      mode: degraded ? 'degraded_or_partial' : 'full',
      quota,
      errors,
      counts: {
        sports: sports.length,
        events: oddsEvents.length,
        selections: selections.length,
        combos: combos.length,
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
