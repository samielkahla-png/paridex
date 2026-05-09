// ════════════════════════════════════════════════════════
//  PARIDEX API PROXY — Fonction serverless Vercel
//  Bypass CORS en faisant les requêtes depuis le serveur Vercel
//  au lieu du navigateur de l'utilisateur.
//
//  Usage côté client :
//  fetch('/api/proxy?target=odds&path=/v4/sports/...&apiKey=XXX')
//  fetch('/api/proxy?target=oddspapi&path=/v4/odds-by-tournaments?...')
//  fetch('/api/proxy?target=apifoot&path=/fixtures?...')
// ════════════════════════════════════════════════════════

export default async function handler(req, res) {
  // CORS headers — autorise toutes les origines
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-apisports-key');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { target, path } = req.query;

  if (!target || !path) {
    res.status(400).json({ error: 'Missing target or path parameter' });
    return;
  }

  // Mapping cible → URL de base
  const targetUrls = {
    'odds':       'https://api.the-odds-api.com',
    'oddspapi':   'https://api.oddspapi.io',
    'apifoot':    'https://v3.football.api-sports.io',
    'sportsdb':   'https://www.thesportsdb.com',
  };

  const baseUrl = targetUrls[target];
  if (!baseUrl) {
    res.status(400).json({ error: 'Unknown target. Use: odds, oddspapi, apifoot, sportsdb' });
    return;
  }

  // Reconstruit l'URL complète
  const fullUrl = baseUrl + path;

  try {
    // Headers spéciaux pour API-Football qui demande la clé en header
    const fetchOptions = {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    };

    // API-Football demande le header x-apisports-key
    if (target === 'apifoot' && req.headers['x-apisports-key']) {
      fetchOptions.headers['x-apisports-key'] = req.headers['x-apisports-key'];
    }

    const apiResp = await fetch(fullUrl, fetchOptions);
    const text = await apiResp.text();

    // Forward les headers utiles (quota The Odds API)
    if (apiResp.headers.get('x-requests-remaining')) {
      res.setHeader('x-requests-remaining', apiResp.headers.get('x-requests-remaining'));
    }
    if (apiResp.headers.get('x-requests-used')) {
      res.setHeader('x-requests-used', apiResp.headers.get('x-requests-used'));
    }
    if (apiResp.headers.get('x-ratelimit-requests-remaining')) {
      res.setHeader('x-ratelimit-requests-remaining', apiResp.headers.get('x-ratelimit-requests-remaining'));
    }

    res.status(apiResp.status).setHeader('Content-Type', 'application/json').send(text);
  } catch (err) {
    res.status(500).json({
      error: 'Proxy failed',
      message: err.message,
      target: target,
      path: path
    });
  }
}
