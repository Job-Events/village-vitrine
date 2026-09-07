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

// Cloudflare Access injecte cet en-tête pour l'utilisateur authentifié et supprime
// toute valeur envoyée par le client. Sans Access actif, l'en-tête est absent -> 403.
function teamEmail(request){
  return (request.headers.get('Cf-Access-Authenticated-User-Email') || '').trim().toLowerCase();
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
  'x_gazette_format','x_webinaires','x_autres_options',
  'x_participants','x_recruteurs','x_alerte','x_relance','x_order_ids','x_role_rank'];

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
