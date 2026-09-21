// Cloudflare Pages Function — Fréquentation du site (Espace équipe).
// Lit en direct l'API GraphQL Analytics de Cloudflare (données RUM du beacon Web
// Analytics) et renvoie : visites par jour, types d'appareils, provenance (pays)
// et pages les plus vues, pour le site vitrine (www.levillagedesrecruteurs.fr).
//
// AUCUNE donnée n'est stockée ici. Accès réservé à l'équipe : la route /api/stats
// est protégée par Cloudflare Access (politique e-mail @job.events) ; ce connecteur
// revérifie l'identité injectée par Access et refuse tout appel sans identité.
//
// Secret requis (variable de projet Cloudflare Pages) :
//   CF_ANALYTICS_TOKEN — jeton API Cloudflare avec la permission « Account Analytics : Read ».
// Facultatif (valeurs par défaut ci-dessous) :
//   CF_ACCOUNT_TAG, CF_SITE_TAG.

const DEFAULT_ACCOUNT_TAG = '435467f1af156bcb40aee2f7b327c3c8';
const DEFAULT_SITE_TAG    = 'c354fe3c33834452aa87e99180199de9'; // www.levillagedesrecruteurs.fr (vitrine)
const GQL_URL = 'https://api.cloudflare.com/client/v4/graphql';

function json(obj, status){
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { 'Content-Type':'application/json', 'Cache-Control':'no-store' }
  });
}

// --- Identité Cloudflare Access (même logique que le connecteur Espace équipe) ---
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

function ymd(d){ return d.toISOString().slice(0,10); }

// Estimation « déséchantillonnée » : chaque ligne RUM représente sampleInterval
// événements réels (1 quand il n'y a pas d'échantillonnage). On multiplie donc les
// compteurs par l'intervalle moyen, comme le fait le tableau de bord Cloudflare.
function estim(count, sampleInterval){
  const si = (sampleInterval && sampleInterval > 0) ? sampleInterval : 1;
  return Math.round((count || 0) * si);
}

// Valeurs injectées directement dans la requête (pas de variables GraphQL, pour
// éviter les soucis de scalaires personnalisés du schéma Cloudflare). Les valeurs
// sont contrôlées (dates AAAA-MM-JJ, identifiants hexadécimaux) — on échappe malgré tout.
function q(s){ return String(s).replace(/[^A-Za-z0-9:_\- ]/g, ''); }
function buildQuery(accountTag, site, since, until){
  const A = q(accountTag), S = q(site), F = q(since), U = q(until);
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

export async function onRequestGet({ request, env }){
  const email = teamEmail(request);
  if (!email.endsWith('@job.events'))
    return json({ ok:false, error:'acces_reserve' }, 403);

  const token = env.CF_ANALYTICS_TOKEN;
  if (!token)
    return json({ ok:false, error:'Connecteur non configuré : jeton API Cloudflare manquant (CF_ANALYTICS_TOKEN).' }, 500);

  const accountTag = env.CF_ACCOUNT_TAG || DEFAULT_ACCOUNT_TAG;
  const site       = env.CF_SITE_TAG    || DEFAULT_SITE_TAG;

  // Fenêtre : 30 derniers jours (jour courant inclus).
  const now = new Date();
  const until = ymd(now);
  const sinceD = new Date(now.getTime() - 29 * 86400000);
  const since = ymd(sinceD);

  try {
    const resp = await fetch(GQL_URL, {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ query: buildQuery(accountTag, site, since, until) })
    });
    const data = await resp.json();
    if (data.errors && data.errors.length)
      return json({ ok:false, error:'Erreur API Cloudflare : ' + (data.errors[0].message || 'inconnue') }, 502);

    const acc = data.data && data.data.viewer && data.data.viewer.accounts && data.data.viewer.accounts[0];
    if (!acc) return json({ ok:false, error:'Aucune donnée renvoyée par Cloudflare.' }, 502);

    // Visites par jour (série continue, y compris jours à 0).
    const dayMap = {};
    (acc.byDay || []).forEach(g => {
      const si = g.avg && g.avg.sampleInterval;
      dayMap[g.dimensions.date] = {
        date: g.dimensions.date,
        visits: estim(g.sum && g.sum.visits, si),
        pageviews: estim(g.count, si)
      };
    });
    const daily = [];
    for (let i = 0; i < 30; i++){
      const d = ymd(new Date(sinceD.getTime() + i * 86400000));
      daily.push(dayMap[d] || { date:d, visits:0, pageviews:0 });
    }
    const totalVisits = daily.reduce((s,x)=>s+x.visits, 0);
    const totalPV     = daily.reduce((s,x)=>s+x.pageviews, 0);

    const devices = (acc.byDevice || []).map(g => ({
      name: g.dimensions.deviceType || 'inconnu',
      visits: estim(g.sum && g.sum.visits, g.avg && g.avg.sampleInterval)
    })).filter(x=>x.visits>0).sort((a,b)=>b.visits-a.visits);

    const countries = (acc.byCountry || []).map(g => ({
      name: g.dimensions.countryName || 'inconnu',
      visits: estim(g.sum && g.sum.visits, g.avg && g.avg.sampleInterval)
    })).filter(x=>x.visits>0).sort((a,b)=>b.visits-a.visits);

    const pages = (acc.byPage || []).map(g => ({
      path: g.dimensions.requestPath || '/',
      pageviews: estim(g.count, g.avg && g.avg.sampleInterval)
    })).filter(x=>x.pageviews>0).sort((a,b)=>b.pageviews-a.pageviews).slice(0, 12);

    return json({
      ok:true, user:email,
      period: { since, until },
      totals: { visits: totalVisits, pageviews: totalPV },
      daily, devices, countries, pages
    });
  } catch (e){
    return json({ ok:false, error:'Erreur réseau Cloudflare : ' + e.message }, 502);
  }
}
