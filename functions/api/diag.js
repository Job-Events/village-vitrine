// Diagnostic temporaire — lecture seule, n'écrit rien dans Odoo, n'expose jamais la clé.
// À supprimer après diagnostic. Renvoie uniquement des booléens / nombres / mots
// (aucun caractère . / @ = & ? dans les valeurs) afin d'être lisible côté navigateur.

function j(o){ return new Response(JSON.stringify(o), { status:200, headers:{'Content-Type':'application/json'} }); }
function word(s){ return String(s==null?'':s).replace(/[^A-Za-z ]+/g,' ').replace(/\s+/g,' ').trim().slice(0,180) || 'none'; }

async function call(url, service, method, args){
  const res = {};
  const t0 = Date.now();
  try{
    const r = await fetch(url.replace(/\/+$/,'') + '/jsonrpc', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ jsonrpc:'2.0', method:'call', params:{ service, method, args } })
    });
    res.http = r.status;
    let t = '';
    try{ t = await r.text(); }catch(e){ res.readErr = word(e && e.message); }
    let jj = null;
    try{ jj = JSON.parse(t); }catch(e){ res.parseErr = true; res.bodyWords = word(t); }
    if (jj){
      res.hasError = !!jj.error;
      res.hasResult = ('result' in jj);
      if (jj.error) res.errWords = word(JSON.stringify(jj.error));
      res._result = jj.result;
    }
  }catch(e){
    res.fetchErrClass = word(e && e.name);
    res.fetchErrWords = word(e && e.message);
  }
  res.ms = Date.now() - t0;
  return res;
}

export async function onRequestGet({ env }){
  const { ODOO_URL, ODOO_DB, ODOO_LOGIN, ODOO_API_KEY } = env;
  const out = {
    cfgUrl:!!ODOO_URL, cfgDb:!!ODOO_DB, cfgLogin:!!ODOO_LOGIN, cfgKey:!!ODOO_API_KEY,
    keyLen:(ODOO_API_KEY||'').length, loginLen:(ODOO_LOGIN||'').length, dbLen:(ODOO_DB||'').length,
    urlLen:(ODOO_URL||'').length
  };

  // Étape 1 : version (sans authentification) — teste la simple accessibilité sortante.
  const v = await call(ODOO_URL, 'common', 'version', []);
  out.versionHttp = v.http || 0;
  out.versionHasResult = v.hasResult || false;
  out.versionParseErr = v.parseErr || false;
  out.versionFetchErrClass = v.fetchErrClass || 'none';
  out.versionFetchErrWords = v.fetchErrWords || 'none';
  out.versionMs = v.ms || 0;

  // Étape 2 : authenticate avec la vraie clé — teste l'authentification.
  const a = await call(ODOO_URL, 'common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}]);
  out.authHttp = a.http || 0;
  out.authHasError = a.hasError || false;
  out.authErrWords = a.errWords || 'none';
  out.authParseErr = a.parseErr || false;
  out.authFetchErrClass = a.fetchErrClass || 'none';
  out.authFetchErrWords = a.fetchErrWords || 'none';
  out.authUidType = typeof a._result;
  out.authUidTruthy = !!a._result;
  out.authUid = (typeof a._result === 'number') ? a._result : 0;
  out.authMs = a.ms || 0;

  return j(out);
}
