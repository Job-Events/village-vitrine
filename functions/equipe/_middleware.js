// Cloudflare Pages Function — garde de l'Espace équipe (/equipe et /equipe/*).
// Cloudflare Access ne protège que le domaine www.levillagedesrecruteurs.fr :
// la copie *.pages.dev servait les pages statiques de /equipe/ (le manuel Odoo)
// sans authentification. Cette garde ferme cette porte (fail-closed) :
//  - toute requête hors du domaine principal est renvoyée vers lui, où Access
//    demande la connexion ;
//  - sur le domaine principal, une requête sans jeton Access est refusée.
const DOMAINE = 'www.levillagedesrecruteurs.fr';

function jeton(request){
  const h = request.headers.get('Cf-Access-Jwt-Assertion');
  if (h) return h;
  const c = request.headers.get('Cookie') || '';
  const m = c.match(/(?:^|;\s*)CF_Authorization=([^;]+)/);
  return m ? m[1] : '';
}

export async function onRequest(context){
  const url = new URL(context.request.url);
  if (url.hostname !== DOMAINE){
    return Response.redirect('https://' + DOMAINE + url.pathname + url.search, 302);
  }
  if (!jeton(context.request)){
    return new Response('Accès réservé à l’équipe Job Events.', {
      status: 403, headers: { 'Content-Type':'text/plain; charset=utf-8', 'Cache-Control':'no-store' }
    });
  }
  return context.next();
}
