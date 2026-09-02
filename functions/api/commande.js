// Cloudflare Pages Function — reçoit une commande de paniers repas depuis la
// page privée et l'écrit dans Odoo (onglet « Paniers repas » de l'événement),
// puis envoie l'email de confirmation. La clé API vit uniquement dans les
// variables du projet (ODOO_API_KEY, en Secret) et n'apparaît jamais côté client.

const JOURS = { mercredi: 'mercredi', jeudi: 'jeudi', mer: 'mercredi', jeu: 'jeudi' };

function esc(s){ return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function json(obj, status){ return new Response(JSON.stringify(obj), { status: status || 200, headers: { 'Content-Type':'application/json' } }); }

async function rpc(url, service, method, args){
  const r = await fetch(url.replace(/\/+$/,'') + '/jsonrpc', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc:'2.0', method:'call', params:{ service, method, args } })
  });
  const j = await r.json();
  if (j.error) throw new Error(JSON.stringify(j.error).slice(0, 300));
  return j.result;
}

export async function onRequestPost({ request, env }){
  const { ODOO_URL, ODOO_DB, ODOO_LOGIN, ODOO_API_KEY } = env;
  if (!ODOO_URL || !ODOO_DB || !ODOO_LOGIN || !ODOO_API_KEY)
    return json({ ok:false, error:'Connecteur non configuré.' }, 500);

  let data;
  try { data = await request.json(); } catch(e){ return json({ ok:false, error:'Requête invalide.' }, 400); }

  const eventId = parseInt(data.eventId, 10);
  const societe = (data.societe||'').trim();
  const commanditaire = (data.commanditaire||'').trim();
  const email = (data.email||'').trim();
  const tel = (data.tel||'').trim();
  const lignes = Array.isArray(data.lignes) ? data.lignes : [];
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!eventId || !societe || !commanditaire || !emailOk || !tel || !data.autorisation || !lignes.length)
    return json({ ok:false, error:'Champs manquants ou invalides.' }, 400);

  // référence + date (UTC)
  const ref = 'WEB-' + new Date().toISOString().slice(0,19).replace(/[-:T]/g,'');
  const now = new Date().toISOString().slice(0,19).replace('T',' ');

  const rows = [];
  for (const l of lignes){
    const jour = JOURS[(l.jour||'').toLowerCase()];
    const plat = (l.plat||'').trim(), dessert = (l.dessert||'').trim(), prenom = (l.prenom||'').trim();
    if (!jour || !plat || !dessert) continue;
    rows.push({
      x_name: societe + ' — ' + (prenom||'?') + ' — ' + (jour==='mercredi'?'Mer.':'Jeu.'),
      x_event_id: eventId, x_societe: societe, x_prenom: prenom, x_jour: jour,
      x_plat: plat, x_dessert: dessert, x_allergenes: (l.allergenes||'').trim(),
      x_commanditaire: commanditaire, x_email: email, x_tel: tel, x_autorisation: true,
      x_statut_facturation: 'a_facturer', x_commande_ref: ref, x_date_commande: now
    });
  }
  if (!rows.length) return json({ ok:false, error:'Aucune ligne complète.' }, 400);

  try {
    const uid = await rpc(ODOO_URL, 'common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}]);
    if (!uid) return json({ ok:false, error:"Authentification Odoo refusée." }, 502);

    await rpc(ODOO_URL, 'object', 'execute_kw',
      [ODOO_DB, uid, ODOO_API_KEY, 'x_panier_repas', 'create', [rows]]);

    // email de confirmation (non bloquant)
    try {
      const li = rows.map(r =>
        '<li>' + esc(r.x_prenom||'(sans prénom)') + ' — ' + (r.x_jour==='mercredi'?'Mercredi 16':'Jeudi 17') +
        ' : ' + esc(r.x_plat) + ' / ' + esc(r.x_dessert) +
        (r.x_allergenes ? ' <i>(' + esc(r.x_allergenes) + ')</i>' : '') + '</li>'
      ).join('');
      const total = rows.length;
      const body =
        '<div style="font-family:Arial,Helvetica,sans-serif;color:#241A12">' +
        '<h2 style="color:#B4005F;margin:0 0 8px">Commande de paniers repas — Toulouse 2026</h2>' +
        '<p><b>Société :</b> ' + esc(societe) + '<br>' +
        '<b>Commande passée par :</b> ' + esc(commanditaire) + '<br>' +
        '<b>Email :</b> ' + esc(email) + ' &nbsp;|&nbsp; <b>Tél :</b> ' + esc(tel) + '<br>' +
        '<b>Référence :</b> ' + esc(ref) + '</p>' +
        '<p><b>' + total + ' panier' + (total>1?'s':'') + ' — ' + (total*20) + ' € HT</b> (TVA en sus)</p>' +
        '<ul>' + li + '</ul>' +
        '<p style="color:#7A6A5B;font-size:13px">Autorisation de facturation confirmée. ' +
        'Cette commande a été enregistrée automatiquement dans Odoo.</p></div>';
      const mailId = await rpc(ODOO_URL, 'object', 'execute_kw',
        [ODOO_DB, uid, ODOO_API_KEY, 'mail.mail', 'create', [{
          subject: 'Commande paniers repas — VDR Toulouse — ' + societe,
          email_from: 'Le Village des Recruteurs <notifications@job.events>',
          email_to: 'communication@job.events',
          email_cc: email,
          reply_to: email,
          body_html: body
        }]]);
      await rpc(ODOO_URL, 'object', 'execute_kw',
        [ODOO_DB, uid, ODOO_API_KEY, 'mail.mail', 'send', [[mailId]]]);
    } catch(mailErr){ /* l'email est secondaire : la commande est déjà enregistrée */ }

    return json({ ok:true, count: rows.length, ref });
  } catch(e){
    return json({ ok:false, error: 'Erreur Odoo : ' + e.message }, 502);
  }
}

export async function onRequestGet(){ return json({ ok:true, service:'commande-paniers' }); }
