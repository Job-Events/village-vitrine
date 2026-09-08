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

export async function onRequestGet({ request, env }){
  const { ODOO_URL, ODOO_DB, ODOO_LOGIN, ODOO_API_KEY } = env;
  const email = teamEmail(request);
  if (!email.endsWith('@job.events'))
    return json({ ok:false, error:'acces_reserve' }, 403);
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
    rows.forEach(r => { r.orders = (r.x_order_ids||[]).map(id => nameOf[id] || String(id)); });

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
