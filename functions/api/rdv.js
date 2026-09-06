// Cloudflare Pages Function — réservation de créneaux d'interview.
// GET  : renvoie les créneaux déjà pris d'un événement (pour l'affichage des dispos).
// POST : réserve un créneau, avec double unicité (un par créneau, un par entreprise)
//        + garde-fou anti-collision, puis email de confirmation.
// La clé API vit uniquement dans les variables du projet (ODOO_API_KEY, Secret).

const CRENEAUX_RESERVABLES = ['10:00','10:30','11:00','11:30','12:00','13:30','14:00','14:30','15:00','15:30','16:00','16:30'];

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

// ---------- GET : disponibilité ----------
export async function onRequestGet({ request, env }){
  const { ODOO_URL, ODOO_DB, ODOO_LOGIN, ODOO_API_KEY } = env;
  const u = new URL(request.url);
  const eventId = parseInt(u.searchParams.get('event'), 10);
  const jour = (u.searchParams.get('jour') || '').trim();
  if (!eventId) return json({ ok:true, service:'reservation-interviews' });
  if (!ODOO_URL || !ODOO_DB || !ODOO_LOGIN || !ODOO_API_KEY)
    return json({ ok:false, error:'Connecteur non configuré.' }, 500);
  try {
    const uid = await rpc(ODOO_URL, 'common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}]);
    if (!uid) return json({ ok:false, error:'Authentification Odoo refusée.' }, 502);
    const domain = [['x_event_id','=',eventId], ['x_statut','!=','refuse']];
    if (jour) domain.push(['x_jour','=',jour]);
    const recs = await rpc(ODOO_URL, 'object', 'execute_kw',
      [ODOO_DB, uid, ODOO_API_KEY, 'x_rdv_interview', 'search_read', [domain], { fields:['x_creneau'] }]);
    const taken = recs.map(r => r.x_creneau).filter(Boolean);
    return json({ ok:true, taken });
  } catch(e){
    return json({ ok:false, error:'Erreur Odoo : ' + e.message }, 502);
  }
}

// ---------- POST : réservation ----------
export async function onRequestPost({ request, env }){
  const { ODOO_URL, ODOO_DB, ODOO_LOGIN, ODOO_API_KEY } = env;
  if (!ODOO_URL || !ODOO_DB || !ODOO_LOGIN || !ODOO_API_KEY)
    return json({ ok:false, error:'Connecteur non configuré.' }, 500);

  let data;
  try { data = await request.json(); } catch(e){ return json({ ok:false, error:'Requête invalide.' }, 400); }

  const eventId    = parseInt(data.eventId, 10);
  const jour       = (data.jour||'').trim();
  const creneau    = (data.creneau||'').trim();
  const societe    = (data.societe||'').trim();
  const refNom     = (data.refNom||'').trim();
  const refEmail   = (data.refEmail||'').trim();
  const refTel     = (data.refTel||'').trim();
  const imgNom     = (data.imgNom||'').trim();
  const imgFonction= (data.imgFonction||'').trim();
  const imgTel     = (data.imgTel||'').trim();
  const sujet      = (data.sujet||'').trim();
  const commentaires = (data.commentaires||'').trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(refEmail);

  if (!eventId || !jour || CRENEAUX_RESERVABLES.indexOf(creneau) === -1 || !societe ||
      !refNom || !emailOk || !refTel || !imgNom || !imgFonction || !imgTel)
    return json({ ok:false, error:'Champs manquants ou invalides.' }, 400);

  const ref = 'WEB-' + new Date().toISOString().slice(0,19).replace(/[-:T]/g,'');
  const now = new Date().toISOString().slice(0,19).replace('T',' ');

  try {
    const uid = await rpc(ODOO_URL, 'common', 'authenticate', [ODOO_DB, ODOO_LOGIN, ODOO_API_KEY, {}]);
    if (!uid) return json({ ok:false, error:'Authentification Odoo refusée.' }, 502);

    // 1) créneau encore libre ?
    const slotBusy = await rpc(ODOO_URL, 'object', 'execute_kw',
      [ODOO_DB, uid, ODOO_API_KEY, 'x_rdv_interview', 'search_count',
       [[['x_event_id','=',eventId], ['x_jour','=',jour], ['x_creneau','=',creneau], ['x_statut','!=','refuse']]]]);
    if (slotBusy > 0) return json({ ok:false, error:'creneau_pris' }, 409);

    // 2) l'entreprise a-t-elle déjà réservé ?
    const compBusy = await rpc(ODOO_URL, 'object', 'execute_kw',
      [ODOO_DB, uid, ODOO_API_KEY, 'x_rdv_interview', 'search_count',
       [[['x_event_id','=',eventId], ['x_statut','!=','refuse'],
         '|', ['x_societe','=ilike',societe], ['x_ref_email','=ilike',refEmail]]]]);
    if (compBusy > 0) return json({ ok:false, error:'deja_reserve' }, 409);

    // 3) création
    const id = await rpc(ODOO_URL, 'object', 'execute_kw',
      [ODOO_DB, uid, ODOO_API_KEY, 'x_rdv_interview', 'create', [{
        x_name: societe + ' · ' + creneau,
        x_event_id: eventId, x_jour: jour, x_creneau: creneau,
        x_societe: societe,
        x_ref_nom: refNom, x_ref_email: refEmail, x_ref_tel: refTel,
        x_img_nom: imgNom, x_img_fonction: imgFonction, x_img_tel: imgTel,
        x_sujet: sujet, x_commentaires: commentaires,
        x_statut: 'a_valider', x_reference: ref, x_date_reservation: now
      }]]);

    // 4) garde-fou anti-collision : en cas de réservation quasi simultanée du même
    //    créneau, le plus ancien id gagne ; on retire le nôtre s'il fait doublon.
    const sameSlot = await rpc(ODOO_URL, 'object', 'execute_kw',
      [ODOO_DB, uid, ODOO_API_KEY, 'x_rdv_interview', 'search',
       [[['x_event_id','=',eventId], ['x_jour','=',jour], ['x_creneau','=',creneau], ['x_statut','!=','refuse']]],
       { order:'id asc' }]);
    if (sameSlot.length > 1 && sameSlot[0] !== id) {
      await rpc(ODOO_URL, 'object', 'execute_kw',
        [ODOO_DB, uid, ODOO_API_KEY, 'x_rdv_interview', 'unlink', [[id]]]);
      return json({ ok:false, error:'creneau_pris' }, 409);
    }

    // 5) email de confirmation (non bloquant)
    try {
      const jourLabel = jour;
      const body =
        '<div style="background:#F4EEE5;padding:24px 0;font-family:Arial,Helvetica,sans-serif">' +
        '<table role="presentation" cellpadding="0" cellspacing="0" width="640" align="center" style="width:640px;max-width:94%;margin:0 auto;background:#FFFFFF;border-radius:12px;overflow:hidden;border:1px solid #E7DFD4">' +
        '<tr><td style="background:#FFFFFF;padding:16px 28px;text-align:center;border-bottom:1px solid #ECE6DE">' +
          '<img src="https://www.levillagedesrecruteurs.fr/img/logo-village.png" alt="Le Village des Recruteurs" width="180" style="height:auto;width:180px;max-width:60%"/>' +
        '</td></tr>' +
        '<tr><td style="background:#08324F;padding:22px 28px">' +
          '<div style="font:700 11px Arial,Helvetica,sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#F8B322">Le Village des Recruteurs</div>' +
          '<div style="font:700 21px Arial,Helvetica,sans-serif;color:#FFFFFF;margin-top:4px">Votre créneau d\'interview est réservé</div>' +
          '<div style="font:400 14px Arial,Helvetica,sans-serif;color:#C7D3DC;margin-top:2px">Toulouse · ' + esc(jourLabel) + '</div>' +
        '</td></tr>' +
        '<tr><td style="padding:26px 28px 8px">' +
          '<p style="font:400 15px/1.55 Arial,Helvetica,sans-serif;color:#241A12;margin:0 0 14px">Bonjour,</p>' +
          '<p style="font:400 15px/1.55 Arial,Helvetica,sans-serif;color:#241A12;margin:0 0 18px">Nous avons bien enregistré votre demande de créneau pour une interview vidéo au Village des Recruteurs. Elle est <b>en cours de validation</b> par l\'équipe Job Events, qui reviendra vers vous si besoin.</p>' +
          '<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#FBF7F0;border:1px solid #ECE6DE;border-radius:8px;margin:0 0 18px">' +
            '<tr><td style="padding:14px 16px;font:400 14px/1.7 Arial,Helvetica,sans-serif;color:#241A12">' +
              '<b>Créneau :</b> ' + esc(jourLabel) + ' à ' + esc(creneau) + '<br>' +
              '<b>Société :</b> ' + esc(societe) + '<br>' +
              '<b>Personne à l\'image :</b> ' + esc(imgNom) + ' (' + esc(imgFonction) + ') &nbsp;·&nbsp; ' + esc(imgTel) + '<br>' +
              '<b>Référent :</b> ' + esc(refNom) + ' &nbsp;·&nbsp; ' + esc(refEmail) + ' &nbsp;·&nbsp; ' + esc(refTel) + '<br>' +
              (sujet ? ('<b>Sujet :</b> ' + esc(sujet) + '<br>') : '') +
              (commentaires ? ('<b>Remarques :</b> ' + esc(commentaires) + '<br>') : '') +
              '<b>Référence :</b> ' + esc(ref) +
            '</td></tr>' +
          '</table>' +
          '<p style="font:400 13px/1.55 Arial,Helvetica,sans-serif;color:#7A6A5B;margin:6px 0 0">Pour toute modification de votre créneau, écrivez-nous à communication@job.events.</p>' +
        '</td></tr>' +
        '<tr><td style="padding:18px 28px 24px;border-top:1px solid #ECE6DE">' +
          '<p style="font:400 14px/1.6 Arial,Helvetica,sans-serif;color:#241A12;margin:0 0 4px">Bien cordialement,</p>' +
          '<p style="font:700 14px Arial,Helvetica,sans-serif;color:#08324F;margin:0">L\'équipe Job Events</p>' +
          '<p style="font:400 13px/1.6 Arial,Helvetica,sans-serif;color:#7A6A5B;margin:8px 0 0"><a href="mailto:communication@job.events" style="color:#B4005F;text-decoration:none">communication@job.events</a> · <a href="https://www.levillagedesrecruteurs.fr" style="color:#B4005F;text-decoration:none">levillagedesrecruteurs.fr</a></p>' +
        '</td></tr>' +
        '</table></div>';
      const mailId = await rpc(ODOO_URL, 'object', 'execute_kw',
        [ODOO_DB, uid, ODOO_API_KEY, 'mail.mail', 'create', [{
          subject: 'Réservation interview · VDR Toulouse · ' + societe,
          email_from: 'Le Village des Recruteurs <notifications@job.events>',
          email_to: 'communication@job.events, ' + refEmail,
          reply_to: refEmail,
          body_html: body
        }]]);
      await rpc(ODOO_URL, 'object', 'execute_kw',
        [ODOO_DB, uid, ODOO_API_KEY, 'mail.mail', 'send', [[mailId]]]);
    } catch(mailErr){ /* l'email est secondaire : la réservation est enregistrée */ }

    return json({ ok:true, ref, creneau });
  } catch(e){
    return json({ ok:false, error:'Erreur Odoo : ' + e.message }, 502);
  }
}
