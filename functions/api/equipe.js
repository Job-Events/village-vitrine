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
  'x_participants','x_recruteurs','x_alerte','x_relance','x_order_ids','x_role_rank','x_company_id'];

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

    if (!eventId) {
      const evs = await rpc(ODOO_URL, 'object', 'execute_kw',
        [ODOO_DB, uid, ODOO_API_KEY, 'event.event', 'search_read',
         [[['id','in',EVENT_IDS]]], { fields:['id','name','date_begin','date_end'] }]);
      return json({ ok:true, user:email, events:evs });
    }

    const ev = await rpc(ODOO_URL, 'object', 'execute_kw',
      [ODOO_DB, uid, ODOO_API_KEY, 'event.event', 'read',
       [[eventId]], { fields:['id','name','date_begin','date_end','address_id','seats_taken'] }]);

    const rows = await rpc(ODOO_URL, 'object', 'execute_kw',
      [ODOO_DB, uid, ODOO_API_KEY, 'x_suivi_operationnel_vdr', 'search_read',
       [[['x_event_id','=',eventId]]], { fields:SUIVI_FIELDS, order:'x_role_rank asc, x_pros desc' }]);

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
