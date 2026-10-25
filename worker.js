// Mel d'antan sur Cloudflare : l'appli (fichiers du dépôt) + Mel, l'assistante (/api/mel).
// Mel répond avec Claude si le secret ANTHROPIC_API_KEY est réglé dans Cloudflare,
// sinon avec l'IA gratuite de Cloudflare (Workers AI). Secret facultatif : CODE_MEL, le code demandé à l'appli.
import Anthropic from "@anthropic-ai/sdk";

const MODELE_CLAUDE = "claude-opus-5-5";
const MODELE_CLOUDFLARE = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MODELE_IMAGE = "@cf/black-forest-labs/flux-1-schnell";
const MAX_PHOTO = 2500000;
const MAX_MESSAGES = 30, MAX_TEXTE = 8000, MAX_CONTEXTE = 150000;

// Qui est Mel : texte fixe, gardé en cache par Claude d'une question à l'autre
const PERSONNAGE = `Tu es Mel, la mascotte et l'assistante de l'appli « Mel d'antan », le carnet de recettes de bougies de Mel.
Mel (Mélanie) fabrique à la main des bougies gourmandes à l'ancienne : bougies gâteau, café liégeois, cappuccino, verrines, coupes de glace, pots de yaourt en verre…
Elle est la seule à te parler. Tu la tutoies, tu l'appelles Mel, tu es toujours courtoise, polie, chaleureuse et encourageante, avec une touche de gourmandise. Tu réponds en français.

Tu es avant tout une vraie assistante, avec toutes tes connaissances : Mel peut te demander n'importe quoi, sur la fabrication des bougies ou sur tout autre sujet, et tu y réponds pleinement comme tu le ferais sans carnet.

Son carnet (recettes, notes, inventaire, stock) t'est donné plus bas comme une aide en plus, pas comme une limite :
- Si la question porte sur SES recettes, SON stock ou ce qu'elle a noté (« ma recette », « il me reste combien », « qu'est-ce qui me manque », « rappelle-moi »…), réponds à partir du carnet et cite le nom de la recette.
- Pour toute autre question (« quelle cire pour une chantilly ? », « comment éviter le givre ? », « quel parfum va avec le café ? »…), réponds avec tes connaissances générales, de façon concrète. Ensuite seulement, si c'est vraiment utile, ajoute en une ligne le lien avec ce qu'elle utilise déjà (« Dans ton carnet, tu utilises… »). Ne remplace jamais la réponse générale par un simple rappel de son carnet.

Ce que tu fais pour elle :
- Retrouver ce qu'elle a noté : recettes, quantités, couches, contenants, notes (températures, temps de prise, astuces), recettes approuvées, inventaire et stock.
- Calculer : adapter une recette à un autre nombre de bougies ou à un autre poids de cire, pourcentage de parfum, quantité de cire selon le contenant, ce qui manque en stock pour couler N bougies.
- La conseiller sur la fabrication : cires (soja, colza, coco, paraffine, cire à chantilly ou à fouetter), températures de fonte et de coulage, taux de parfum, choix des mèches selon le diamètre, colorants, inclusions, défauts (trous, givre, effet tunnel, retrait, fumée) et leurs remèdes, sécurité (point d'éclair des parfums, ne jamais laisser une bougie allumée sans surveillance, étiquetage CLP des bougies parfumées).
- L'aider à inventer de nouvelles bougies gourmandes (tiramisu, crème brûlée, milkshake, chocolat viennois…).

Exactitude (très important) :
- Mieux vaut une réponse courte et juste qu'une réponse sûre d'elle et fausse. N'invente jamais un chiffre, une marque, une température ou une règle : si tu n'es pas sûre, dis-le simplement (« je ne suis pas certaine, vérifie sur la fiche de ta cire ») et donne ce que tu sais de façon fiable.
- Les « Corrections de Mel » données avec son carnet sont des vérités qu'elle t'a apprises : respecte-les en priorité, même si tu pensais autre chose.
- Relis ta réponse avant de l'envoyer : est-ce qu'elle répond bien à la question posée, et chaque chiffre est-il juste ?

Unités et calculs (très important) :
- Chaque produit du carnet a son unité (g, ml, gouttes, pièces…). Elle est toujours indiquée : ne dis jamais qu'elle manque.
- Ne mélange jamais des unités différentes. Un pourcentage de parfum se calcule en poids : poids du parfum ÷ poids de la cire × 100.
- Pour des gouttes, convertis d'abord en grammes : environ 20 gouttes = 1 ml ≈ 1 g de parfum (estimation, ça dépend du compte-gouttes et du parfum). Dis-le quand tu t'en sers.
- Repères habituels : parfum souvent entre 6 et 10 % du poids de cire selon la cire (jusqu'à 12 % pour certaines), toujours sous le maximum indiqué par le fournisseur.
- Chaque recette indique la contenance du contenant (en grammes de cire) et le poids de la recette : sers-t'en pour dire s'il en faut plus ou moins, ou pour adapter une recette à un autre contenant.
- Pour adapter une recette (autre poids de cire, autre nombre de bougies), garde les mêmes proportions et donne le résultat arrondi dans l'unité de son carnet.
- Avant de répondre avec un calcul, vérifie-le une fois ; montre-le en une ligne simple (ex. « 20 gouttes ≈ 1 g, 1 g ÷ 120 g ≈ 0,8 % »). Si un résultat te semble anormal (taux de parfum très bas ou très élevé), signale-le gentiment.

Règles :
- Quand une information vient de son carnet, dis-le ; quand c'est un conseil général, présente-le comme tel. Si son carnet ne contient pas la réponse, dis-le simplement plutôt que d'inventer ce qu'elle aurait noté.
- Les températures et taux varient selon les fournisseurs : rappelle-lui de vérifier la fiche technique de sa cire ou de son parfum quand c'est important.
- Va droit à l'essentiel, comme une amie d'atelier qui répond en passant : la réponse d'abord, dès la première phrase, puis seulement ce qui est utile pour agir.
- Court : 2 à 5 phrases, ou une petite liste de 3 à 5 tirets au plus. Pas d'introduction (« Bonne question ! »), pas de récapitulatif final, pas de liste d'options interminable : donne la meilleure solution et, au besoin, une alternative.
- Développe seulement si Mel demande plus de détails, une explication complète ou une fiche de recette.
- Phrases simples, **gras** pour les chiffres et mots importants. Pas de tableaux, pas de titres.

Créer une recette : quand Mel te demande de créer, d'inventer ou de préparer une fiche de recette, décris-la en quelques lignes puis ajoute, tout à la fin de ta réponse, un bloc exactement de cette forme (JSON valide, sans commentaire) :
\`\`\`recette
{"nom":"…","contenant":"…","remplissage":85,"notes":"…","couches":[{"nom":"…","couleur":"#rrggbb","texture":"…","ingredients":[{"produit":"…","type":"…","unite":"…","q":0}]}]}
\`\`\`
- "contenant" : pour une bougie coulée dans un contenant, un de verrine, coupe, doubleparoi, liegeois, mug, bocal, ramequin, tasse, yaourt, confiture, tumbler, champagne, vin, bol, the ; pour une bougie moulée en forme de pâtisserie, un de macaron, tarte, cupcake, gateau, donut, eclair, buche, cookie, madeleine, religieuse, canele, fraise, pomme, citron, cerise (les couches remplissent alors la forme du bas vers le haut, ex. coque / ganache / coque pour un macaron, pâte / crème / fruits pour une tartelette).
- "texture" : un de lisse, chantilly, mousse, marbre, paillettes, morceaux, granite.
- Couches du bas vers le haut. "produit" : reprends exactement le nom d'un produit de son inventaire quand il convient, sinon un nom court.
- "type" : un de cire, colorant, parfum, meche, deco, additif, autre. "unite" : un de g, ml, gouttes, pieces, cuilleres, pincees, pourcent.
L'appli transforme ce bloc en bouton « Ouvrir dans l'éditeur » : ne parle pas du bloc lui-même dans ton texte.

Photos : Mel peut t'envoyer une photo de sa bougie ou de son atelier. Regarde-la attentivement et décris ce que tu vois avant de conseiller (surface, couleurs, couches, chantilly, mèche, défauts comme les trous, le givre, les bulles ou le retrait, présentation pour la vente).

Dessiner : quand Mel te demande de dessiner, d'imaginer en image ou de montrer à quoi ressemblerait une bougie, réponds en une ou deux phrases chaleureuses, puis ajoute tout à la fin un bloc exactement de cette forme :
\`\`\`image
(description en anglais, détaillée, pour un générateur d'images : la bougie gourmande, son contenant, les couleurs et l'aspect de chaque couche, la décoration du dessus, la mèche, style photo de produit artisanal, fond et lumière douce)
\`\`\`
L'appli dessine alors l'image : ne parle pas du bloc lui-même et préviens simplement que l'image est une inspiration, pas une photo exacte.`;

const json = (data, statut = 200) => new Response(JSON.stringify(data), {
  status: statut, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

// Comparaison sans fuite de temps du code de Mel
async function memeCode(a, b) {
  const h = async s => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("mel:" + s)));
  const [x, y] = await Promise.all([h(a), h(b)]);
  let d = 0; for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

const moteur = env => env.ANTHROPIC_API_KEY ? "claude" : env.AI ? "cloudflare" : null;

// Photo jointe par Mel : JPEG, PNG ou WebP en base64, de taille raisonnable
function photo(p) {
  const m = typeof p === "string" && p.length <= MAX_PHOTO && p.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  return m ? { type: m[1], data: m[2] } : null;
}
function nettoyer(corps) {
  if (!corps || !Array.isArray(corps.messages)) return null;
  const messages = corps.messages.slice(-MAX_MESSAGES)
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && (m.content.trim() || m.image))
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_TEXTE) || "Regarde ma photo.", photo: m.role === "user" ? photo(m.image) : null }));
  // La conversation commence par Mel (la créatrice) et finit par sa question
  while (messages.length && messages[0].role !== "user") messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== "user") return null;
  return { messages, contexte: String(corps.contexte || "").slice(0, MAX_CONTEXTE) };
}

// Réponse donnée par l'IA de Cloudflare à la place de Claude : l'appli l'affiche
const relais = (r, pourquoi = "credits") => { const h = new Headers(r.headers); h.set("x-mel-relais", pourquoi === "panne" ? "panne" : "1"); return new Response(r.body, { status: r.status, headers: h }); };
// Le texte de la réponse part vers l'appli au fil de l'eau
function flux(ecrire, moteurReponse) {
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter(), enc = new TextEncoder();
  const envoyer = t => w.write(enc.encode(t));
  ecrire(envoyer).catch(e => { console.error(e); return envoyer("\n\n(Oups, ma réponse a été coupée. Tu peux me reposer la question ?)"); }).finally(() => w.close());
  return new Response(readable, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-mel-moteur": moteurReponse } });
}

async function repondreClaude(env, { messages, contexte }) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const stream = client.beta.messages.stream({
    model: MODELE_CLAUDE,
    // La réflexion de Claude compte aussi dans cette limite : marge large, la longueur du texte est réglée par les consignes
    max_tokens: 12000,
    // Si un filtre de sécurité refuse à tort, Claude réessaie tout seul avec le modèle de secours recommandé
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "high" },
    system: [
      { type: "text", text: PERSONNAGE },
      { type: "text", text: "Le carnet de Mel, tel qu'il est en ce moment :\n\n" + (contexte || "(carnet vide)"), cache_control: { type: "ephemeral" } },
    ],
    messages: messages.map(m => m.photo
      ? { role: "user", content: [{ type: "image", source: { type: "base64", media_type: m.photo.type, data: m.photo.data } }, { type: "text", text: m.content }] }
      : { role: m.role, content: m.content }),
  });
  // Première lecture avant d'ouvrir le flux : une clé refusée devient un message clair
  const iterateur = stream[Symbol.asyncIterator]();
  let premier;
  try { premier = await iterateur.next(); }
  catch (e) { throw erreurClaude(e); }
  return flux(async envoyer => {
    for (let r = premier; !r.done; r = await iterateur.next()) {
      const ev = r.value;
      if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") await envoyer(ev.delta.text);
    }
    const fin = await stream.finalMessage();
    if (fin.stop_reason === "refusal") await envoyer("\n\nDésolée Mel, je ne peux pas t'aider sur ce point-là. Tu veux me demander autre chose ?");
    else if (fin.stop_reason === "max_tokens") await envoyer("\n\n(Ma réponse était trop longue, je me suis arrêtée là. Demande-moi la suite !)");
  }, "claude");
}

// Crédits Claude épuisés ou limite de dépense atteinte : Claude se met en pause, l'IA gratuite de Cloudflare prend le relais
const CREDIT_EPUISE = /credit balance|insufficient|billing|usage limit|spend(ing)? limit|quota/i;
const creditEpuise = e => e instanceof Anthropic.APIError && [400, 402, 403, 429].includes(e.status) && CREDIT_EPUISE.test(String(e.message || ""));
const REESSAI_CLAUDE = 6 * 3600 * 1000;   // on réessaie Claude toutes les 6 heures (crédits renouvelés, limite relevée…)
let pauseClaudeMemoire = 0;
async function pauseClaude(env) {
  if (Date.now() - pauseClaudeMemoire < REESSAI_CLAUDE) return true;
  if (!env.DB) return false;
  try { await preparer(env); const l = await env.DB.prepare("SELECT v FROM reglages WHERE k = 'claude_pause'").first(); pauseClaudeMemoire = l ? +l.v : 0; } catch { return false; }
  return Date.now() - pauseClaudeMemoire < REESSAI_CLAUDE;
}
async function mettreClaudeEnPause(env, oui) {
  pauseClaudeMemoire = oui ? Date.now() : 0;
  if (!env.DB) return;
  try {
    await preparer(env);
    if (oui) await env.DB.prepare("INSERT INTO reglages (k, v) VALUES ('claude_pause', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(String(pauseClaudeMemoire)).run();
    else await env.DB.prepare("DELETE FROM reglages WHERE k = 'claude_pause'").run();
  } catch (e) { console.error("pause Claude", e); }
}
// Moteur réellement utilisé maintenant
async function moteurActuel(env) {
  const m = moteur(env);
  return m === "claude" && env.AI && await pauseClaude(env) ? "cloudflare" : m;
}

function erreurClaude(e) {
  if (creditEpuise(e)) return Object.assign(new Error("Les crédits Claude sont épuisés pour ce mois."), { statut: 402, cause: e });
  if (e instanceof Anthropic.APIError && (e.status >= 500 || e.status === 529)) return Object.assign(new Error(`Claude ne répond pas pour le moment (erreur ${e.status}). Réessaie dans un instant.`), { statut: 502, cause: e });
  if (e instanceof Anthropic.AuthenticationError) return Object.assign(new Error("La clé Claude (ANTHROPIC_API_KEY) est refusée : vérifie-la dans Cloudflare."), { statut: 502 });
  if (e instanceof Anthropic.PermissionDeniedError) return Object.assign(new Error("Le compte Claude n'a pas accès à ce modèle."), { statut: 502 });
  if (e instanceof Anthropic.RateLimitError) return Object.assign(new Error("Beaucoup de questions d'un coup : réessaie dans une minute."), { statut: 429 });
  if (e instanceof Anthropic.APIError) return Object.assign(new Error(`Claude ne répond pas pour le moment (erreur ${e.status ?? "réseau"}). Réessaie dans un instant.`), { statut: 502 });
  return e;
}

async function repondreCloudflare(env, { messages, contexte }) {
  if (messages.length && messages[messages.length - 1].photo) throw Object.assign(new Error(env.ANTHROPIC_API_KEY ? "Les crédits Claude du mois sont épuisés : Mel ne peut pas regarder les photos avant leur renouvellement. Pose-moi ta question par écrit !" : "Pour regarder tes photos, Mel a besoin de Claude (clé ANTHROPIC_API_KEY dans Cloudflare)."), { statut: 400 });
  messages = messages.map(({ role, content }) => ({ role, content }));
  const sortie = await env.AI.run(MODELE_CLOUDFLARE, {
    messages: [{ role: "system", content: PERSONNAGE + "\n\nLe carnet de Mel, tel qu'il est en ce moment :\n\n" + (contexte || "(carnet vide)") }, ...messages],
    stream: true, max_tokens: 2048,
  });
  // Flux SSE de Workers AI : lignes « data: {"response":"…"} », puis « data: [DONE] »
  return flux(async envoyer => {
    const lecteur = sortie.getReader(), dec = new TextDecoder();
    let reste = "";
    for (;;) {
      const { done, value } = await lecteur.read();
      if (done) break;
      reste += dec.decode(value, { stream: true });
      const lignes = reste.split("\n"); reste = lignes.pop();
      for (const l of lignes) {
        if (!l.startsWith("data:")) continue;
        const d = l.slice(5).trim();
        if (!d || d === "[DONE]") continue;
        try { const o = JSON.parse(d); if (o.response) await envoyer(o.response); } catch { /* morceau incomplet */ }
      }
    }
  }, "cloudflare");
}

// Mel dessine : image d'inspiration créée par l'IA d'images gratuite de Cloudflare (Workers AI)
async function dessiner(env, request) {
  if (!env.AI) return json({ erreur: "Pour dessiner, Mel a besoin de Workers AI dans Cloudflare." }, 503);
  let description = "";
  try { description = String((JSON.parse(await request.text()) || {}).description || "").trim().slice(0, 1500); } catch { /* vide */ }
  if (!description) return json({ erreur: "Rien à dessiner." }, 400);
  try {
    const r = await env.AI.run(MODELE_IMAGE, { prompt: `${description}. Handmade artisanal scented candle, gourmet dessert candle, vintage French patisserie style, soft natural light, warm cream and coffee tones, professional product photo, highly detailed.`, steps: 6 });
    if (!r || !r.image) throw new Error("image vide");
    return json({ image: "data:image/jpeg;base64," + r.image });
  } catch (e) {
    console.error(e);
    return json({ erreur: "Mel n'a pas réussi à dessiner cette fois (quota du jour atteint ou service occupé). Réessaie un peu plus tard." }, 502);
  }
}

// ---------- Carnet partagé entre les appareils (base D1 de Cloudflare) ----------
// Chaque produit et chaque recette est rangé à part ; les photos le sont une seule fois, sous leur empreinte.
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS elements (id TEXT PRIMARY KEY, genre TEXT NOT NULL, data TEXT NOT NULL, maj INTEGER NOT NULL, supprime INTEGER NOT NULL DEFAULT 0)",
  "CREATE TABLE IF NOT EXISTS photos (hash TEXT PRIMARY KEY, data TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS reglages (k TEXT PRIMARY KEY, v TEXT NOT NULL)",
  // Appareils qui reçoivent les notifications de Mel, même appli fermée
  "CREATE TABLE IF NOT EXISTS abonnements (endpoint TEXT PRIMARY KEY, cles TEXT NOT NULL, cree TEXT)",
];
let basePrete = null;
const preparer = env => basePrete || (basePrete = env.DB.batch(SCHEMA.map(s => env.DB.prepare(s))).catch(e => { basePrete = null; throw e; }));
const GENRES = ["produit", "recette", "note"], MAX_ELEMENT = 200000, MAX_PHOTO_CARNET = 1900000;
async function empreinteHex(t) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join("");
}
async function lireCarnet(env) {
  const { results } = await env.DB.prepare("SELECT id, genre, data, maj FROM elements WHERE supprime = 0").all();
  return results.map(r => ({ id: r.id, genre: r.genre, data: JSON.parse(r.data), maj: r.maj }));
}
async function synchroniser(env, request) {
  let corps = {};
  try { corps = JSON.parse(await request.text()) || {}; } catch { return json({ erreur: "Requête illisible." }, 400); }
  const changes = Array.isArray(corps.changes) ? corps.changes.slice(0, 3000) : [];
  const suppressions = Array.isArray(corps.suppressions) ? corps.suppressions.slice(0, 3000) : [];
  const maintenant = Date.now(), ordres = [];
  const avant = changes.some(c => c && c.genre === "produit") ? await lireCarnet(env) : null;
  for (const c of changes) {
    if (!c || typeof c.id !== "string" || !/^[\w-]{1,40}$/.test(c.id) || !GENRES.includes(c.genre) || !c.data || typeof c.data !== "object") continue;
    const texte = JSON.stringify({ ...c.data, id: c.id });
    // Les photos voyagent à part (/api/photo) : jamais dans un élément
    if (texte.length > MAX_ELEMENT || texte.includes("data:image")) return json({ erreur: "Élément trop lourd." }, 413);
    ordres.push(env.DB.prepare("INSERT INTO elements (id, genre, data, maj, supprime) VALUES (?, ?, ?, ?, 0) ON CONFLICT(id) DO UPDATE SET genre = excluded.genre, data = excluded.data, maj = excluded.maj, supprime = 0")
      .bind(c.id, c.genre, texte, maintenant));
  }
  for (const id of suppressions)
    if (typeof id === "string" && /^[\w-]{1,40}$/.test(id)) ordres.push(env.DB.prepare("UPDATE elements SET supprime = 1, maj = ? WHERE id = ?").bind(maintenant, id));
  if (ordres.length) await env.DB.batch(ordres);
  const elements = await lireCarnet(env);
  if (avant) attendre(alerterStock(env, avant, elements).catch(e => console.error("alerte stock", e)));
  return json({ elements });
}
// Un produit qui vient de passer sous son seuil (ou d'être épuisé) : Mel prévient tous les appareils
const sousSeuil = p => p && p.stock != null && p.stock !== "" && p.alerte != null && p.alerte !== "" && +p.stock <= +p.alerte;
const uniteTexte = u => ({ g: "g", ml: "ml", gouttes: "gouttes", pieces: "pièce(s)", cuilleres: "cuillère(s)", pincees: "pincée(s)", pourcent: "%" }[u] || "");
async function alerterStock(env, avant, apres) {
  const ancien = {}; for (const e of avant) if (e.genre === "produit") ancien[e.id] = e.data;
  const nouveaux = apres.filter(e => e.genre === "produit").map(e => e.data)
    .filter(p => sousSeuil(p) && (!sousSeuil(ancien[p.id]) || (+p.stock === 0 && +ancien[p.id].stock !== 0)));
  if (!nouveaux.length) return;
  const nom = p => String(p.nom || "");
  const titre = nouveaux.length > 1 ? "Mel : il commence à manquer des produits" : `Mel : il commence à manquer de ${nom(nouveaux[0]).charAt(0).toLowerCase() + nom(nouveaux[0]).slice(1)}`;
  const texte = nouveaux.map(p => +p.stock === 0 ? `${nom(p)} : épuisé` : `${nom(p)} : plus que ${+p.stock} ${uniteTexte(p.unite)}`).join(" · ") + ". Pense à en recommander !";
  await pousser(env, { titre, texte, vue: "inventaire", tag: "stock" });
}
async function envoyerPhoto(env, request) {
  let corps = {};
  try { corps = JSON.parse(await request.text()) || {}; } catch { return json({ erreur: "Requête illisible." }, 400); }
  const data = String(corps.data || "");
  if (data.length > MAX_PHOTO_CARNET || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(data)) return json({ erreur: "Photo illisible ou trop lourde." }, 400);
  const hash = await empreinteHex(data);
  if (hash !== corps.hash) return json({ erreur: "Photo abîmée pendant l'envoi." }, 400);
  await env.DB.prepare("INSERT OR IGNORE INTO photos (hash, data) VALUES (?, ?)").bind(hash, data).run();
  return json({ ok: true });
}
async function lirePhoto(env, hash) {
  const r = await env.DB.prepare("SELECT data FROM photos WHERE hash = ?").bind(hash).first();
  if (!r) return json({ erreur: "Photo introuvable." }, 404);
  return new Response(JSON.stringify({ data: r.data }), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, max-age=31536000, immutable" } });
}

// ---------- Notifications envoyées par le serveur (Web Push, RFC 8291 aes128gcm + VAPID) ----------
let attendre = p => p;   // remplacé à chaque requête par ctx.waitUntil : l'envoi ne retarde pas la réponse
const b64url = o => btoa(String.fromCharCode(...o)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function depuisB64url(t) { const s = atob(String(t).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(t).length + 3) % 4)); return Uint8Array.from(s, c => c.charCodeAt(0)); }
const concat = (...p) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };
async function hkdf(sel, ikm, info, n) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: sel, info }, k, n * 8));
}
// Clés VAPID créées à la première utilisation, gardées dans la base
async function clesVapid(env) {
  let l = await env.DB.prepare("SELECT v FROM reglages WHERE k = 'vapid'").first();
  if (!l) {
    const k = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const v = { prive: await crypto.subtle.exportKey("jwk", k.privateKey), pub: b64url(new Uint8Array(await crypto.subtle.exportKey("raw", k.publicKey))) };
    await env.DB.prepare("INSERT INTO reglages (k, v) VALUES ('vapid', ?) ON CONFLICT(k) DO NOTHING").bind(JSON.stringify(v)).run();
    l = await env.DB.prepare("SELECT v FROM reglages WHERE k = 'vapid'").first();
  }
  return JSON.parse(l.v);
}
async function envoyerPush(env, ab, message) {
  const vapid = await clesVapid(env), t = new TextEncoder();
  const tete = b64url(t.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corpsJwt = b64url(t.encode(JSON.stringify({ aud: new URL(ab.endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "mailto:mel@mel-dantan.invalid" })));
  const cleSig = await crypto.subtle.importKey("jwk", vapid.prive, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, cleSig, t.encode(tete + "." + corpsJwt)));
  const uaPub = depuisB64url(ab.cles.p256dh), auth = depuisB64url(ab.cles.auth);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaCle = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const partage = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaCle }, eph.privateKey, 256));
  const ikm = await hkdf(auth, partage, concat(t.encode("WebPush: info\0"), uaPub, asPub), 32);
  const sel = crypto.getRandomValues(new Uint8Array(16));
  const cle = await crypto.subtle.importKey("raw", await hkdf(sel, ikm, t.encode("Content-Encoding: aes128gcm\0"), 16), "AES-GCM", false, ["encrypt"]);
  const nonce = await hkdf(sel, ikm, t.encode("Content-Encoding: nonce\0"), 12);
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, cle, concat(t.encode(JSON.stringify(message)), new Uint8Array([2]))));
  return fetch(ab.endpoint, { method: "POST", body: concat(sel, new Uint8Array([0, 0, 16, 0, 65]), asPub, chiffre), headers: {
    Authorization: `vapid t=${tete}.${corpsJwt}.${b64url(sig)}, k=${vapid.pub}`, "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream", TTL: "86400", Urgency: "high" } });
}
// Seuls les services de notification des navigateurs sont acceptés (jamais une adresse quelconque)
function serviceDePush(adresse) {
  let u; try { u = new URL(adresse); } catch { return false; }
  return u.protocol === "https:" && String(adresse).length < 900 &&
    /(^|\.)(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/.test(u.hostname);
}
// Envoie à tous les appareils abonnés ; un abonnement expiré (404/410) est oublié
async function pousser(env, message) {
  const { results } = await env.DB.prepare("SELECT * FROM abonnements").all();
  await Promise.all(results.map(async a => {
    try {
      const r = await envoyerPush(env, { endpoint: a.endpoint, cles: JSON.parse(a.cles) }, message);
      if (r.status === 404 || r.status === 410) await env.DB.prepare("DELETE FROM abonnements WHERE endpoint = ?").bind(a.endpoint).run();
    } catch (e) { console.error("notification", e); }
  }));
}
// Tâche planifiée : une nouvelle version de l'appli (version.json) est annoncée une seule fois
async function annoncerVersion(env) {
  if (!env.DB) return;
  await preparer(env);
  const v = await (await env.ASSETS.fetch(new Request("https://assets/version.json"))).json();
  const deja = await env.DB.prepare("SELECT v FROM reglages WHERE k = 'version_annoncee'").first();
  if (deja && deja.v === v.version) return;
  await env.DB.prepare("INSERT INTO reglages (k, v) VALUES ('version_annoncee', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v").bind(String(v.version)).run();
  if (!deja) return;   // tout premier passage : rien à annoncer
  await pousser(env, { titre: "Mel : une nouvelle version est prête", texte: `La version ${v.version} de Mel d’antan est prête${v.notes && v.notes[0] ? " : " + v.notes[0] : ""}. Ouvre l’appli pour l’installer.`, tag: "maj" });
}
async function notifs(env, request, chemin) {
  let corps = {};
  if (request.method === "POST") try { corps = JSON.parse(await request.text()) || {}; } catch { return json({ erreur: "Requête illisible." }, 400); }
  if (chemin === "notifs/cle") return json({ cle: (await clesVapid(env)).pub });
  if (chemin === "notifs/abonner") {
    const ab = corps.abonnement || {};
    if (!serviceDePush(ab.endpoint) || !ab.keys || !ab.keys.p256dh || !ab.keys.auth) return json({ erreur: "Abonnement illisible." }, 400);
    await env.DB.prepare("INSERT INTO abonnements (endpoint, cles, cree) VALUES (?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET cles = excluded.cles")
      .bind(ab.endpoint, JSON.stringify({ p256dh: String(ab.keys.p256dh).slice(0, 200), auth: String(ab.keys.auth).slice(0, 100) }), new Date().toISOString()).run();
    return json({ ok: true });
  }
  if (chemin === "notifs/desabonner") {
    await env.DB.prepare("DELETE FROM abonnements WHERE endpoint = ?").bind(String(corps.endpoint || "").slice(0, 900)).run();
    return json({ ok: true });
  }
  if (chemin === "notifs/essai") {
    const a = await env.DB.prepare("SELECT * FROM abonnements WHERE endpoint = ?").bind(String(corps.endpoint || "").slice(0, 900)).first();
    if (!a) return json({ erreur: "Cet appareil n'est pas encore abonné aux notifications." }, 404);
    const r = await envoyerPush(env, { endpoint: a.endpoint, cles: JSON.parse(a.cles) }, { titre: "Mel : coucou !", texte: "C’est comme ça que je te préviendrai, même quand l’appli est fermée.", tag: "essai" });
    if (!r.ok) return json({ erreur: "Le service de notification de l'appareil a refusé l'envoi (" + r.status + ")." }, 502);
    return json({ ok: true });
  }
  return json({ erreur: "Adresse inconnue." }, 404);
}

async function api(request, env, chemin) {
  const m = moteur(env);
  if (chemin === "mel/etat") { const ma = await moteurActuel(env); return json({ actif: !!m, moteur: ma, relais: m === "claude" && ma === "cloudflare", code: !!env.CODE_MEL, sync: !!env.DB }); }
  // Carnet partagé : même code que Mel
  const photo = chemin.match(/^photo\/([0-9a-f]{64})$/);
  if (chemin.startsWith("notifs/")) {
    if (!env.DB) return json({ erreur: "La base n'est pas encore branchée." }, 503);
    if (env.CODE_MEL && !await memeCode(request.headers.get("x-code-mel") || "", env.CODE_MEL)) return json({ erreur: "Code de Mel incorrect.", code: true }, 401);
    try { await preparer(env); return await notifs(env, request, chemin); }
    catch (e) { console.error(e); return json({ erreur: "Les notifications ne répondent pas pour le moment." }, 500); }
  }
  if (chemin === "sync" || chemin === "photo" || photo) {
    if (!env.DB) return json({ erreur: "La base du carnet n'est pas encore branchée." }, 503);
    if (env.CODE_MEL && !await memeCode(request.headers.get("x-code-mel") || "", env.CODE_MEL)) return json({ erreur: "Code de Mel incorrect.", code: true }, 401);
    try {
      await preparer(env);
      if (photo && request.method === "GET") return await lirePhoto(env, photo[1]);
      if (request.method !== "POST") return json({ erreur: "Adresse inconnue." }, 404);
      return chemin === "sync" ? await synchroniser(env, request) : await envoyerPhoto(env, request);
    } catch (e) { console.error(e); return json({ erreur: "Le carnet en ligne ne répond pas pour le moment." }, 500); }
  }
  if ((chemin !== "mel" && chemin !== "mel/image") || request.method !== "POST") return json({ erreur: "Adresse inconnue." }, 404);
  if (!m) return json({ erreur: "Mel n'est pas encore branchée : ajoute Workers AI ou la clé ANTHROPIC_API_KEY dans Cloudflare." }, 503);
  if (env.CODE_MEL && !await memeCode(request.headers.get("x-code-mel") || "", env.CODE_MEL)) return json({ erreur: "Code de Mel incorrect.", code: true }, 401);
  if (chemin === "mel/image") return dessiner(env, request);
  let corps;
  try { corps = nettoyer(JSON.parse(await request.text())); } catch { corps = null; }
  if (!corps) return json({ erreur: "Question illisible." }, 400);
  try {
    if (m === "claude" && env.AI && await pauseClaude(env)) return relais(await repondreCloudflare(env, corps));
    if (m !== "claude") return await repondreCloudflare(env, corps);
    try {
      const r = await repondreClaude(env, corps);
      if (pauseClaudeMemoire) await mettreClaudeEnPause(env, false);   // Claude répond de nouveau : fin de la pause
      return r;
    } catch (e) {
      const cause = e && e.cause;
      // Claude surchargé ou en panne un instant : Cloudflare répond à cette question, sans pause
      if (env.AI && cause instanceof Anthropic.APIError && (cause.status >= 500 || cause.status === 529)) return relais(await repondreCloudflare(env, corps), "panne");
      if (!env.AI || !creditEpuise(cause || e)) throw e;
      console.warn("Crédits Claude épuisés : relais par l'IA de Cloudflare", String((cause || e).message));
      await mettreClaudeEnPause(env, true);
      return relais(await repondreCloudflare(env, corps));
    }
  } catch (e) {
    console.error(e);
    return json({ erreur: e.statut ? e.message : "Mel ne répond pas pour le moment. Réessaie dans un instant." }, e.statut || 500);
  }
}

export default {
  async fetch(request, env, ctx) {
    attendre = p => (ctx && ctx.waitUntil ? ctx.waitUntil(p) : p);
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return api(request, env, url.pathname.slice(5).replace(/\/$/, ""));
    return env.ASSETS.fetch(request);
  },
  // Tâche planifiée (wrangler.jsonc › triggers) : annonce d'une nouvelle version de l'appli
  async scheduled(event, env, ctx) {
    attendre = p => ctx.waitUntil(p);
    ctx.waitUntil(annoncerVersion(env).catch(e => console.error("annonce version", e)));
  },
};
