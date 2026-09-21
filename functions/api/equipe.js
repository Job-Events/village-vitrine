// Cloudflare Pages Function — Espace équipe (lecture seule des données Odoo).
// AUCUNE donnée n'est stockée ici : tout est lu en direct dans Odoo à chaque appel.
// Accès réservé à l'équipe : la route /equipe et /api/equipe est protégée par
// Cloudflare Access (politique e-mail @job.events). Ce connecteur revérifie
// l'identité injectée par Access et refuse tout appel sans identité (fail-closed).

function json(obj, status){
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type':'application/json', 'Cache-Control':'no-store' }
  });
}

// Récupère l'e-mail authentifié par Cloudflare Access. Sur les Pages Functions,
// Access ne fournit PAS l'en-tête Cf-Access-Authenticated-User-Email : l'identité
// arrive dans un jeton signé (en-tête Cf-Access-Jwt-Assertion ou cookie
// CF_Authorization). On lit donc, dans l'ordre : l'en-tête direct (origines
// self-hosted), puis la charge utile du JWT. La route étant protégée par Access,
// aucune requête n'atteint cette fonction sans jeton validé par Cloudflare ; toute
// valeur forgée par le client est écrasée en amont. Sans identité -> chaîne vide -> 403.
function b64urlDecode(str){
  str = String(str||'').replace(/-/g,'+').replace(/_/g,'/');
  while (str.length % 4) str += '=';
  try { return atob(str); } catch(e){ return ''; }
}
function cookieValue(request, name){
  const c = request.headers.get('Cookie') || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? m[1] : '';
}
function emailFromJwt(jwt){
  const parts = String(jwt||'').split('.');
  if (parts.length < 2) return '';
  try {
    const p = JSON.parse(b64urlDecode(parts[1]));
    return String(p.email || p.identity || p.sub || '');
  } catch(e){ return ''; }
}
function teamEmail(request){
  let email = (request.headers.get('Cf-Access-Authenticated-User-Email') || '').trim();
  if (!email){
    const jwt = request.headers.get('Cf-Access-Jwt-Assertion')
             || cookieValue(request, 'CF_Authorization');
    if (jwt) email = emailFromJwt(jwt).trim();
  }
  return email.toLowerCase();
}

async function rpc(url, service, method, args){
  const r = await fetch(url.replace(/\/+$/,'') + '/jsonrpc', {
    method:'POST', headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ jsonrpc:'2.0', method:'call', params:{ service, method, args } })
  });
  const j = await r.json();
  if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 300));
  return j.result;
}

const EVENT_IDS = [1,2,3,4];
// Ville de chaque événement (miroir de l'EVENTMAP du recalcul Odoo) : sert à
// restreindre la détection de l'option « 2 jours » aux produits de la bonne ville,
// car un même bon de commande national peut couvrir plusieurs villes.
const EVENT_CITY = { 1:'Toulouse', 2:'Dijon', 3:'Orléans', 4:'Lyon' };
const SUIVI_FIELDS = ['x_name','x_role','x_pros','x_tables_hautes','x_tabourets','x_tv',
  'x_interviews_cmd','x_interviews_resa','x_interviews_reste',
  'x_paniers_cmd','x_paniers_resa','x_paniers_reste',
  'x_gazette_format','x_gazettes_cmd','x_gazettes_faites','x_gazettes_reste','x_webinaires','x_autres_options',
  'x_participants','x_recruteurs','x_alerte','x_relance','x_order_ids','x_role_rank','x_company_id','x_maj'];

// Recalcul Odoo (action serveur « Suivi opérationnel VDR : recalcul », id 1191).
// Le suivi est une table recalculée depuis les commandes CONFIRMÉES (bons de
// commande), les inscriptions et les réservations. À l'origine ce recalcul ne
// tournait que la nuit : une commande confirmée en journée n'apparaissait pas
// avant le lendemain. On le relance donc à l'ouverture de la page, au plus une
// fois toutes les MAJ_THROTTLE_MS, en se servant du champ x_maj (horodatage écrit
// par le recalcul) comme horloge partagée — aucune donnée n'est stockée côté page.
const RECALC_ACTION_ID = 1191;
// Fenêtre courte : un rafraîchissement de la page relance le recalcul quasi à chaque
// fois. On garde 5 s uniquement pour dédoublonner les appels quasi simultanés d'un
// même chargement (boot + 1re requête d'événement) et les ouvertures concurrentes.
const MAJ_THROTTLE_MS = 5 * 1000; // 5 secondes

async function refreshIfStale(env, uid){
  const { ODOO_URL, ODOO_DB, ODOO_API_KEY } = env;
  try {
    const last = await rpc(ODOO_URL, 'object', 'execute_kw',
      [ODOO_DB, uid, ODOO_API_KEY, 'x_suivi_operationnel_vdr', 'search_read',
       [[]], { fields:['x_maj'], order:'x_maj desc', limit:1 }]);
    const lastStr = (last && last[0] && last[0].x_maj) || '';
    const lastMs = lastStr ? Date.parse(lastStr.replace(' ', 'T') + 'Z') : 0;
    if (!lastMs || (Date.now() - lastMs) > MAJ_THROTTLE_MS) {
      await rpc(ODOO_URL, 'object', 'execute_kw',
        [ODOO_DB, uid, ODOO_API_KEY, 'ir.actions.server', 'run', [[RECALC_ACTION_ID]]]);
    }
  } catch (e) {
    // Le rafraîchissement ne doit JAMAIS empêcher l'affichage : on ignore l'erreur
    // et la page montre les dernières valeurs recalculées (au pire, celles de la nuit).
  }
}

// ---------- Fréquentation du site (Cloudflare Web Analytics, données RUM) ----------
// Secret requis : CF_ANALYTICS_TOKEN (jeton API Cloudflare, permission Account
// Analytics : Read). Identifiants de compte / site pré-remplis (surchargables par env).
const CF_DEFAULT_ACCOUNT_TAG = '435467f1af156bcb40aee2f7b327c3c8';
const CF_DEFAULT_SITE_TAG    = 'c354fe3c33834452aa87e99180199de9'; // www.levillagedesrecruteurs.fr
const CF_GQL_URL = 'https://api.cloudflare.com/client/v4/graphql';

function ymd(d){ return d.toISOString().slice(0,10); }
// Les compteurs RUM de Cloudflare Web Analytics (count, sum{visits}) sont déjà les
// valeurs « déséchantillonnées » affichées dans le tableau de bord. On ne réapplique
// donc PAS sampleInterval (sinon on multiplie une seconde fois : écart d'environ ×10
// constaté). Le paramètre est conservé pour compatibilité mais ignoré.
function estim(count, _sampleInterval){
  return Math.round(count || 0);
}
function cfSanitize(s){ return String(s).replace(/[^A-Za-z0-9:_\- ]/g, ''); }
function cfBuildQuery(accountTag, site, since, until){
  const A = cfSanitize(accountTag), S = cfSanitize(site), F = cfSanitize(since), U = cfSanitize(until);
  const filter = `{ AND: [ { siteTag: "${S}" }, { date_geq: "${F}" }, { date_leq: "${U}" } ] }`;
  return `
  query {
    viewer {
      accounts(filter: { accountTag: "${A}" }) {
        byDay: rumPageloadEventsAdaptiveGroups(limit: 1000, filter: ${filter}, orderBy: [date_ASC]) {
          count sum { visits } avg { sampleInterval } dimensions { date }
        }
        byDevice: rumPageloadEventsAdaptiveGroups(limit: 20, filter: ${filter}, orderBy: [count_DESC]) {
          count sum { visits } avg { sampleInterval } dimensions { deviceType }
        }
        byCountry: rumPageloadEventsAdaptiveGroups(limit: 30, filter: ${filter}, orderBy: [count_DESC]) {
          count sum { visits } avg { sampleInterval } dimensions { countryName }
        }
        byPage: rumPageloadEventsAdaptiveGroups(limit: 30, filter: ${filter}, orderBy: [count_DESC]) {
          count avg { sampleInterval } dimensions { requestPath }
        }
      }
    }
  }`;
}
async function statsResponse(env, email){
  // Nom canonique attendu : CF_ANALYTICS_TOKEN. On tolère aussi le nom déjà présent
  // dans la configuration (CF_analitycs_token) pour éviter toute ressaisie du secret.
  const token = env.CF_ANALYTICS_TOKEN || env.CF_analitycs_token;
  if (!token)
    return json({ ok:false, error:'Statistiques non configurées : jeton API Cloudflare manquant (CF_ANALYTICS_TOKEN).' }, 500);
  const accountTag = env.CF_ACCOUNT_TAG || CF_DEFAULT_ACCOUNT_TAG;
  const site       = env.CF_SITE_TAG    || CF_DEFAULT_SITE_TAG;
  const now = new Date();
  const until = ymd(now);
  const sinceD = new Date(now.getTime() - 29 * 86400000);
  const since = ymd(sinceD);
  try {
    const resp = await fetch(CF_GQL_URL, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ query: cfBuildQuery(accountTag, site, since, until) })
    });
    const data = await resp.json();
    if (data.errors && data.errors.length)
      return json({ ok:false, error:'Erreur API Cloudflare : ' + (data.errors[0].message || 'inconnue') }, 502);
    const acc = data.data && data.data.viewer && data.data.viewer.accounts && data.data.viewer.accounts[0];
    if (!acc) return json({ ok:false, error:'Aucune donnée renvoyée par Cloudflare.' }, 502);

    const dayMap = {};
    (acc.byDay || []).forEach(g => {
      const si = g.avg && g.avg.sampleInterval;
      dayMap[g.dimensions.date] = { date:g.dimensions.date, visits:estim(g.sum && g.sum.visits, si), pageviews:estim(g.count, si) };
    });
    const daily = [];
    for (let i = 0; i < 30; i++){
      const d = ymd(new Date(sinceD.getTime() + i * 86400000));
      daily.push(dayMap[d] || { date:d, visits:0, pageviews:0 });
    }
    const totalVisits = daily.reduce((s,x)=>s+x.visits, 0);
    const totalPV     = daily.reduce((s,x)=>s+x.pageviews, 0);
    const devices = (acc.byDevice || []).map(g => ({ name:g.dimensions.deviceType||'inconnu',
      visits:estim(g.sum && g.sum.visits, g.avg && g.avg.sampleInterval) })).filter(x=>x.visits>0).sort((a,b)=>b.visits-a.visits);
    const countries = (acc.byCountry || []).map(g => ({ name:g.dimensions.countryName||'inconnu',
      visits:estim(g.sum && g.sum.visits, g.avg && g.avg.sampleInterval) })).filter(x=>x.visits>0).sort((a,b)=>b.visits-a.visits);
    const pages = (acc.byPage || []).map(g => ({ path:g.dimensions.requestPath||'/',
      pageviews:estim(g.count, g.avg && g.avg.sampleInterval) })).filter(x=>x.pageviews>0).sort((a,b)=>b.pageviews-a.pageviews).slice(0,12);

    return json({ ok:true, user:email, period:{ since, until },
      totals:{ visits:totalVisits, pageviews:totalPV }, daily, devices, countries, pages });
  } catch (e){
    return json({ ok:false, error:'Erreur réseau Cloudflare : ' + e.message }, 502);
  }
}

export async function onRequestGet({ request, env }){
  const { ODOO_URL, ODOO_DB, ODOO_LOGIN, ODOO_API_KEY } = env;
  const email = teamEmail(request);
  if (!email.endsWith('@job.events'))
    return json({ ok:false, error:'acces_reserve' }, 403);

  // Vue « Fréquentation du site » (audience Cloudflare Web Analytics). Servie ici,
  // sous /api/equipe déjà protégé par Cloudflare Access, plutôt que par un endpoint
  // séparé : l'identité de l'équipe est ainsi garantie sur le même chemin.
  const uStats = new URL(request.url);
  if (uStats.searchParams.has('stats'))
    return statsResponse(env, email);

  if (!ODOO_URL || !ODOO_DB || !ODOO_LOGIN || !ODOO_API_KEY)
    return json({ ok:false, error:'Connecteur non configuré.' }, 500);

  const u = new URL(request.url);
  const eventId = parseInt(u.searchParams.get('event'), 10);
  try {
    const uid = await rpc(ODOO_URL, 'common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}]);
    if (!uid) return json({ ok:false, error:'Authentification Odoo refusée.' }, 502);

    // Rafraîchissement automatique à l'ouverture (throttlé). Se déclenche aussi bien
    // sur la requête initiale (liste des événements) que sur une requête d'événement :
    // le throttle x_maj garantit un seul recalcul réel par fenêtre de 5 min.
    await refreshIfStale(env, uid);

    if (!eventId) {
      const evs = await rpc(ODOO_URL, 'object', 'execute_kw',
        [ODOO_DB, uid, ODOO_API_KEY, 'event.event', 'search_read',
         [[['id','in',EVENT_IDS]]], { fields:['id','name','date_begin','date_end'] }]);
      return json({ ok:true, user:email, events:evs });
    }

    const ev = await rpc(ODOO_URL, 'object', 'execute_kw',
      [ODOO_DB, uid, ODOO_API_KEY, 'event.event', 'read',
       [[eventId]], { fields:['id','name','date_begin','date_end','address_id','seats_taken'] }]);

    let rows = await rpc(ODOO_URL, 'object', 'execute_kw',
      [ODOO_DB, uid, ODOO_API_KEY, 'x_suivi_operationnel_vdr', 'search_read',
       [[['x_event_id','=',eventId]]], { fields:SUIVI_FIELDS, order:'x_role_rank asc, x_pros desc' }]);

    // Dédoublonnage à l'affichage : une seule ligne par société. Des lignes
    // orphelines peuvent subsister dans Odoo (même société saisie deux fois) ;
    // le recalcul n'en maintient qu'une (x_maj récent), l'autre garde un x_maj
    // ancien. On n'expose donc, par société, que la ligne au x_maj le plus récent.
    const bestId = {};
    for (const r of rows){
      const cid = (r.x_company_id && r.x_company_id[0]) || ('row' + r.id);
      const cur = bestId[cid];
      if (!cur || String(r.x_maj || '') > String(cur.x_maj || '')) bestId[cid] = r;
    }
    const keepIds = new Set(Object.values(bestId).map(r => r.id));
    rows = rows.filter(r => keepIds.has(r.id));

    // Résoudre les numéros de bons de commande (m2m -> noms) sans stocker quoi que ce soit.
    const orderIds = [...new Set(rows.reduce((a,r)=>a.concat(r.x_order_ids||[]), []))];
    const nameOf = {};
    if (orderIds.length) {
      const os = await rpc(ODOO_URL, 'object', 'execute_kw',
        [ODOO_DB, uid, ODOO_API_KEY, 'sale.order', 'read', [orderIds], { fields:['name'] }]);
      os.forEach(o => nameOf[o.id] = o.name);
    }
    // Chaque bon de commande porte son id (pour un lien direct vers la fiche Odoo)
    // en plus de son numéro affiché (S00xxx).
    rows.forEach(r => { r.orders = (r.x_order_ids||[]).map(id => ({ id, name: nameOf[id] || String(id) })); });

    // Option « 2 jours » (durée du stand/pack) : marquage LIVE par bon de commande.
    // Une société « a l'option 2 jours » si l'un de ses bons de commande confirmés
    // contient une ligne dont la variante porte l'attribut Durée = « 2 jours »
    // (packs et stands ; concerne uniquement les événements à 2 jours, Toulouse et Lyon).
    const set2j = new Set();
    const city2j = EVENT_CITY[eventId];
    if (orderIds.length && city2j) {
      try {
        const ptav2j = await rpc(ODOO_URL, 'object', 'execute_kw',
          [ODOO_DB, uid, ODOO_API_KEY, 'product.template.attribute.value', 'search',
           [[['attribute_id.name','=','Durée'], ['name','=','2 jours']]]]);
        if (ptav2j && ptav2j.length) {
          // Ligne de commande de CET événement (bonne ville) ET variante « 2 jours ».
          const lines2j = await rpc(ODOO_URL, 'object', 'execute_kw',
            [ODOO_DB, uid, ODOO_API_KEY, 'sale.order.line', 'search_read',
             [[['order_id','in',orderIds],
               ['product_id.product_template_variant_value_ids','in',ptav2j],
               ['product_id.product_template_variant_value_ids.name','=',city2j]]],
             { fields:['order_id'] }]);
          lines2j.forEach(l => { if (l.order_id) set2j.add(l.order_id[0]); });
        }
      } catch(e){ /* le marquage 2 jours ne doit jamais bloquer l'affichage */ }
    }
    rows.forEach(r => { r.deux_jours = (r.x_order_ids||[]).some(id => set2j.has(id)); });

    // Secteur / Code NAF de chaque entreprise (via x_company_id -> res.partner), sans stockage local.
    const compIds = [...new Set(rows.map(r => r.x_company_id && r.x_company_id[0]).filter(Boolean))];
    const secOf = {};
    if (compIds.length) {
      const parts = await rpc(ODOO_URL, 'object', 'execute_kw',
        [ODOO_DB, uid, ODOO_API_KEY, 'res.partner', 'read',
         [compIds], { fields:['x_studio_secteurs_vdr','x_studio_naf','x_studio_secteurs_vdr_2'] }]);
      parts.forEach(p => { secOf[p.id] = {
        secteur: p.x_studio_secteurs_vdr || '',
        naf: p.x_studio_naf || '',
        section_naf: p.x_studio_secteurs_vdr_2 || ''
      }; });
    }
    rows.forEach(r => {
      const s = (r.x_company_id && secOf[r.x_company_id[0]]) || {};
      r.secteur = s.secteur || ''; r.naf = s.naf || ''; r.section_naf = s.section_naf || '';
    });

    // Interviews réservées : comptage LIVE des rendez-vous (x_rdv_interview). Le champ de
    // suivi peut être périmé (recalcul non relancé depuis la dernière prise de rendez-vous).
    const norm = s => String(s||'').toUpperCase().normalize('NFD').replace(/[^A-Z0-9]/g,'');
    const rdvs = await rpc(ODOO_URL, 'object', 'execute_kw',
      [ODOO_DB, uid, ODOO_API_KEY, 'x_rdv_interview', 'search_read',
       [[['x_event_id','=',eventId], ['x_statut','!=','refuse']]], { fields:['x_societe'] }]);
    const idx = rows.map(r => ({ r, n: norm(r.x_name) }));
    rows.forEach(r => { r._intLive = 0; });
    rdvs.forEach(b => {
      const bn = norm(b.x_societe);
      if (bn.length < 3) return;
      const hit = idx.find(x => x.n === bn)
               || idx.find(x => x.n.startsWith(bn) || bn.startsWith(x.n))
               || idx.find(x => x.n.includes(bn) || bn.includes(x.n));
      if (hit) hit.r._intLive += 1;
    });
    rows.forEach(r => {
      const cmd = r.x_interviews_cmd || 0;
      r.x_interviews_resa = r._intLive;
      r.x_interviews_reste = Math.max(0, cmd - r._intLive);
      delete r._intLive;
    });

    return json({ ok:true, user:email, event: ev[0] || null, rows });
  } catch(e){
    return json({ ok:false, error:'Erreur Odoo : ' + e.message }, 502);
  }
}

// ---------- POST : écriture minimale et contrôlée vers Odoo (rien stocké ici) ----------
export async function onRequestPost({ request, env }){
  const { ODOO_URL, ODOO_DB, ODOO_LOGIN, ODOO_API_KEY } = env;
  const email = teamEmail(request);
  if (!email.endsWith('@job.events')) return json({ ok:false, error:'acces_reserve' }, 403);
  if (!ODOO_URL || !ODOO_DB || !ODOO_LOGIN || !ODOO_API_KEY)
    return json({ ok:false, error:'Connecteur non configuré.' }, 500);
  let data; try { data = await request.json(); } catch(e){ return json({ ok:false, error:'Requête invalide.' }, 400); }
  const id = parseInt(data.id, 10);
  const field = String(data.field || '');
  const ALLOWED = { relance: 'x_relance' };   // seuls ces champs sont modifiables depuis la page
  if (!id || !ALLOWED[field]) return json({ ok:false, error:'Champ non autorisé.' }, 400);
  try {
    const uid = await rpc(ODOO_URL, 'common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}]);
    if (!uid) return json({ ok:false, error:'Authentification Odoo refusée.' }, 502);
    const vals = {}; vals[ALLOWED[field]] = !!data.value;
    await rpc(ODOO_URL, 'object', 'execute_kw',
      [ODOO_DB, uid, ODOO_API_KEY, 'x_suivi_operationnel_vdr', 'write', [[id], vals]]);
    return json({ ok:true });
  } catch(e){ return json({ ok:false, error:'Erreur Odoo : ' + e.message }, 502); }
}
