// ════════════════════════════════════════════════════════
// PARIDEX API PROXY — MULTI-SPORT API-SPORTS + The Odds API
// À mettre dans : api/proxy.js
//
// Variables Vercel supportées :
// - ODDS_API_KEY
// - API_FOOTBALL_KEY
// - APISPORTS_KEY                 (clé commune si ton compte API-SPORTS la partage)
// - ou clés spécifiques : API_BASKETBALL_KEY, API_NBA_KEY, API_BASEBALL_KEY, etc.
// ════════════════════════════════════════════════════════

const TARGETS = {
  odds: 'https://api.the-odds-api.com',
  oddspapi: 'https://api.oddspapi.io',
  sportsdb: 'https://www.thesportsdb.com',

  // API-SPORTS
  apifoot: 'https://v3.football.api-sports.io',
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

const TARGET_ENV = {
  apifoot: ['API_FOOTBALL_KEY', 'APISPORTS_KEY'],
  football: ['API_FOOTBALL_KEY', 'APISPORTS_KEY'],
  afl: ['API_AFL_KEY', 'APISPORTS_KEY'],
  baseball: ['API_BASEBALL_KEY', 'APISPORTS_KEY'],
  basketball: ['API_BASKETBALL_KEY', 'APISPORTS_KEY'],
  formula1: ['API_FORMULA1_KEY', 'APISPORTS_KEY'],
  handball: ['API_HANDBALL_KEY', 'APISPORTS_KEY'],
  hockey: ['API_HOCKEY_KEY', 'APISPORTS_KEY'],
  mma: ['API_MMA_KEY', 'APISPORTS_KEY'],
  nba: ['API_NBA_KEY', 'APISPORTS_KEY'],
  nfl: ['API_NFL_KEY', 'API_AMERICAN_FOOTBALL_KEY', 'APISPORTS_KEY'],
  rugby: ['API_RUGBY_KEY', 'APISPORTS_KEY'],
  volleyball: ['API_VOLLEYBALL_KEY', 'APISPORTS_KEY'],
};

const CACHE = new Map();

function cacheTtlMs(target) {
  if (target === 'odds') return 2 * 60 * 1000;
  if (TARGET_ENV[target]) return 30 * 60 * 1000;
  return 60 * 1000;
}

function getQueryValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
}

function sendJson(res, status, payload) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.send(JSON.stringify(payload));
}

function firstEnv(names) {
  for (const name of names) {
    if (process.env[name]) return process.env[name];
  }
  return null;
}

function buildUrl(target, rawPath) {
  const baseUrl = TARGETS[target];

  if (!baseUrl) {
    const err = new Error('Unknown target');
    err.statusCode = 400;
    err.extra = { validTargets: Object.keys(TARGETS) };
    throw err;
  }

  if (!rawPath || typeof rawPath !== 'string') {
    const err = new Error('Missing path parameter');
    err.statusCode = 400;
    throw err;
  }

  if (!rawPath.startsWith('/')) {
    const err = new Error('Invalid path: it must start with /');
    err.statusCode = 400;
    throw err;
  }

  if (/^\/\/|https?:\/\//i.test(rawPath) || rawPath.includes('..')) {
    const err = new Error('Invalid path');
    err.statusCode = 400;
    throw err;
  }

  const url = new URL(baseUrl + rawPath);

  // Ne jamais accepter les clés depuis le navigateur.
  ['key', 'apiKey', 'apifootKey', 'x-apisports-key'].forEach((k) => url.searchParams.delete(k));

  if (target === 'odds') {
    const apiKey = process.env.ODDS_API_KEY;
    if (!apiKey) {
      const err = new Error('Missing ODDS_API_KEY in Vercel Environment Variables');
      err.statusCode = 500;
      throw err;
    }
    url.searchParams.set('apiKey', apiKey);
  }

  return url;
}

function buildFetchOptions(target) {
  const headers = {
    Accept: 'application/json',
    'User-Agent': 'Paridex/1.0',
  };

  if (TARGET_ENV[target]) {
    const apiKey = firstEnv(TARGET_ENV[target]);
    if (!apiKey) {
      const err = new Error(`Missing API-SPORTS key for target ${target}. Add one of: ${TARGET_ENV[target].join(', ')}`);
      err.statusCode = 500;
      throw err;
    }
    headers['x-apisports-key'] = apiKey;
  }

  return { method: 'GET', headers };
}

function forwardUsefulHeaders(apiResp, res) {
  [
    'x-requests-remaining',
    'x-requests-used',
    'x-requests-last',
    'x-ratelimit-requests-remaining',
    'x-ratelimit-requests-limit',
    'x-ratelimit-requests-reset',
  ].forEach((h) => {
    const val = apiResp.headers.get(h);
    if (val) res.setHeader(h, val);
  });
}

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { ok: false, error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  const target = getQueryValue(req.query.target);
  const rawPath = getQueryValue(req.query.path);

  try {
    if (!target || !rawPath) {
      sendJson(res, 400, {
        ok: false,
        error: 'MISSING_PARAMS',
        message: 'Missing target or path parameter',
        examples: [
          '/api/proxy?target=odds&path=/v4/sports/soccer_epl/odds?regions=eu&markets=h2h',
          '/api/proxy?target=basketball&path=/games?date=2026-05-10',
          '/api/proxy?target=nba&path=/games?date=2026-05-10',
        ],
      });
      return;
    }

    const url = buildUrl(target, rawPath);
    const cacheKey = `${target}:${url.toString()}`;
    const ttl = cacheTtlMs(target);
    const cached = CACHE.get(cacheKey);

    if (cached && Date.now() - cached.savedAt < ttl) {
      res.setHeader('x-paridex-cache', 'HIT');
      res.status(cached.status);
      res.setHeader('Content-Type', cached.contentType || 'application/json; charset=utf-8');
      res.send(cached.body);
      return;
    }

    const apiResp = await fetch(url, buildFetchOptions(target));
    const body = await apiResp.text();
    const contentType = apiResp.headers.get('content-type') || 'application/json; charset=utf-8';

    forwardUsefulHeaders(apiResp, res);
    res.setHeader('x-paridex-cache', 'MISS');
    res.status(apiResp.status);
    res.setHeader('Content-Type', contentType);

    if (apiResp.ok) {
      CACHE.set(cacheKey, { savedAt: Date.now(), status: apiResp.status, contentType, body });
    }

    res.send(body);
  } catch (err) {
    sendJson(res, err.statusCode || 500, {
      ok: false,
      error: err.statusCode === 400 ? 'BAD_PROXY_REQUEST' : 'PROXY_FAILED',
      message: err.message,
      target,
      ...(err.extra || {}),
    });
  }
}
