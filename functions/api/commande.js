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
      const total = rows.length;
      const th = 'padding:9px 12px;text-align:left;font:600 12px Arial,Helvetica,sans-serif;color:#FFFFFF;text-transform:uppercase;letter-spacing:.04em';
      const td = 'padding:9px 12px;font:400 14px Arial,Helvetica,sans-serif;color:#241A12;border-bottom:1px solid #ECE6DE;vertical-align:top';
      const rowsHtml = rows.map((r, i) => {
        const bg = (i % 2) ? '#FBF7F0' : '#FFFFFF';
        return '<tr style="background:' + bg + '">' +
          '<td style="' + td + '"><b>' + esc(r.x_prenom || '—') + '</b></td>' +
          '<td style="' + td + '">' + (r.x_jour === 'mercredi' ? 'Mercredi 16 sept.' : 'Jeudi 17 sept.') + '</td>' +
          '<td style="' + td + '">' + esc(r.x_plat) + '</td>' +
          '<td style="' + td + '">' + esc(r.x_dessert) + '</td>' +
          '<td style="' + td + ';color:#7A6A5B">' + (r.x_allergenes ? esc(r.x_allergenes) : '—') + '</td>' +
        '</tr>';
      }).join('');
      const body =
        '<div style="background:#F4EEE5;padding:24px 0;font-family:Arial,Helvetica,sans-serif">' +
        '<table role="presentation" cellpadding="0" cellspacing="0" width="640" align="center" style="width:640px;max-width:94%;margin:0 auto;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E7DFD4">' +
        // bandeau logo
        '<tr><td style="background:#FFFFFF;padding:16px 28px;text-align:center;border-bottom:1px solid #ECE6DE">' +
          '<img src="https://www.levillagedesrecruteurs.fr/img/logo-village.png" alt="Le Village des Recruteurs" width="180" style="height:auto;width:180px;max-width:60%"/>' +
        '</td></tr>' +
        // en-tête
        '<tr><td style="background:#08324F;padding:22px 28px">' +
          '<div style="font:700 11px Arial,Helvetica,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#F8B322">Le Village des Recruteurs</div>' +
          '<div style="font:700 21px Arial,Helvetica,sans-serif;color:#FFFFFF;margin-top:4px">Confirmation de commande — Paniers repas</div>' +
          '<div style="font:400 14px Arial,Helvetica,sans-serif;color:#C7D3DC;margin-top:2px">Toulouse · 16 &amp; 17 septembre 2026</div>' +
        '</td></tr>' +
        // corps
        '<tr><td style="padding:26px 28px 8px">' +
          '<p style="font:400 15px/1.55 Arial,Helvetica,sans-serif;color:#241A12;margin:0 0 14px">Bonjour,</p>' +
          '<p style="font:400 15px/1.55 Arial,Helvetica,sans-serif;color:#241A12;margin:0 0 18px">Nous accusons réception de votre commande de paniers repas pour le Village des Recruteurs de Toulouse. Vous en trouverez le détail ci-dessous. Les paniers seront livrés directement sur votre stand les jours concernés.</p>' +
          // bloc coordonnées
          '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#FBF7F0;border:1px solid #ECE6DE;border-radius:8px;margin:0 0 20px">' +
            '<tr><td style="padding:14px 16px;font:400 14px/1.7 Arial,Helvetica,sans-serif;color:#241A12">' +
              '<b>Société :</b> ' + esc(societe) + '<br>' +
              '<b>Commande passée par :</b> ' + esc(commanditaire) + '<br>' +
              '<b>Contact :</b> ' + esc(email) + ' &nbsp;·&nbsp; ' + esc(tel) + '<br>' +
              '<b>Référence :</b> ' + esc(ref) +
            '</td></tr>' +
          '</table>' +
          // tableau des paniers
          '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;border:1px solid #ECE6DE;border-radius:8px;overflow:hidden">' +
            '<tr style="background:#0FAE9E">' +
              '<th style="' + th + '">Prénom</th>' +
              '<th style="' + th + '">Jour</th>' +
              '<th style="' + th + '">Plat</th>' +
              '<th style="' + th + '">Dessert</th>' +
              '<th style="' + th + '">Allergènes / précisions</th>' +
            '</tr>' + rowsHtml +
          '</table>' +
          // total
          '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:16px 0 4px"><tr>' +
            '<td style="font:700 16px Arial,Helvetica,sans-serif;color:#08324F">Total : ' + total + ' panier' + (total>1?'s':'') + '</td>' +
            '<td align="right" style="font:700 16px Arial,Helvetica,sans-serif;color:#B4005F">' + (total*20) + ' € HT</td>' +
          '</tr></table>' +
          '<p style="font:400 13px/1.55 Arial,Helvetica,sans-serif;color:#7A6A5B;margin:6px 0 0">Montants hors taxes. L\'autorisation de facturation a été confirmée lors de la commande ; une facture sera adressée à votre société pour la part non déjà réglée. Toute modification reste possible jusqu\'au 10 septembre.</p>' +
        '</td></tr>' +
        // pied
        '<tr><td style="padding:18px 28px 24px;border-top:1px solid #ECE6DE">' +
          '<p style="font:400 14px/1.6 Arial,Helvetica,sans-serif;color:#241A12;margin:0 0 4px">Bien cordialement,</p>' +
          '<p style="font:700 14px Arial,Helvetica,sans-serif;color:#08324F;margin:0">L\'équipe Job Events</p>' +
          '<p style="font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#7A6A5B;margin:8px 0 0">Une question ? <a href="mailto:communication@job.events" style="color:#B4005F;text-decoration:none">communication@job.events</a> · <a href="https://www.levillagedesrecruteurs.fr" style="color:#B4005F;text-decoration:none">levillagedesrecruteurs.fr</a></p>' +
        '</td></tr>' +
        '</table></div>';
      const mailId = await rpc(ODOO_URL, 'object', 'execute_kw',
        [ODOO_DB, uid, ODOO_API_KEY, 'mail.mail', 'create', [{
          subject: 'Commande paniers repas — VDR Toulouse — ' + societe,
          email_from: 'Le Village des Recruteurs <notifications@job.events>',
          email_to: 'communication@job.events, ' + email,
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
