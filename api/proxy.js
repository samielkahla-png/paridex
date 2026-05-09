// ════════════════════════════════════════════════════════
//  PARIDEX API PROXY — Fonction serverless Vercel
//  Bypass CORS en faisant les requêtes depuis le serveur Vercel
//  au lieu du navigateur de l'utilisateur.
// ════════════════════════════════════════════════════════

export default async function handler(req, res) {
  // CORS headers — autorise toutes les origines
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-apisports-key, Accept');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { target, path, apifootKey } = req.query;

  if (!target || !path) {
    res.status(400).json({
      error: 'Missing target or path parameter',
      usage: '/api/proxy?target=odds&path=/v4/sports?apiKey=XXX'
    });
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
    res.status(400).json({
      error: 'Unknown target',
      validTargets: Object.keys(targetUrls)
    });
    return;
  }

  const fullUrl = baseUrl + path;

  try {
    const fetchOptions = {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    };

    // API-Football : clé via header x-apisports-key
    if (target === 'apifoot') {
      const key = req.headers['x-apisports-key'] || apifootKey;
      if (key) {
        fetchOptions.headers['x-apisports-key'] = key;
      }
    }

    const apiResp = await fetch(fullUrl, fetchOptions);
    const text = await apiResp.text();

    // Forward les headers utiles (quota)
    const fwdHeaders = [
      'x-requests-remaining',
      'x-requests-used',
      'x-ratelimit-requests-remaining',
      'x-ratelimit-requests-limit'
    ];
    fwdHeaders.forEach(h => {
      const val = apiResp.headers.get(h);
      if (val) res.setHeader(h, val);
    });

    res.status(apiResp.status);
    res.setHeader('Content-Type', 'application/json');
    res.send(text);
  } catch (err) {
    res.status(500).json({
      error: 'Proxy failed',
      message: err.message,
      target: target
    });
  }
}
