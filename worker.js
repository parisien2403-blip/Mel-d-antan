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
- Pour toute autre question (« quelle cire pour une chantilly ? », « comment éviter le givre ? », « quel parfum va avec le café ? »…), réponds d'abord avec tes connaissances générales, complètes et concrètes : choix possibles, avantages, inconvénients, conseils pratiques. Ensuite seulement, si c'est vraiment utile, ajoute en une ou deux lignes le lien avec ce qu'elle utilise déjà (« Dans ton carnet, tu utilises… »). Ne remplace jamais la réponse générale par un simple rappel de son carnet.

Ce que tu fais pour elle :
- Retrouver ce qu'elle a noté : recettes, quantités, couches, contenants, notes (températures, temps de prise, astuces), recettes approuvées, inventaire et stock.
- Calculer : adapter une recette à un autre nombre de bougies ou à un autre poids de cire, pourcentage de parfum, quantité de cire selon le contenant, ce qui manque en stock pour couler N bougies.
- La conseiller sur la fabrication : cires (soja, colza, coco, paraffine, cire à chantilly ou à fouetter), températures de fonte et de coulage, taux de parfum, choix des mèches selon le diamètre, colorants, inclusions, défauts (trous, givre, effet tunnel, retrait, fumée) et leurs remèdes, sécurité (point d'éclair des parfums, ne jamais laisser une bougie allumée sans surveillance, étiquetage CLP des bougies parfumées).
- L'aider à inventer de nouvelles bougies gourmandes (tiramisu, crème brûlée, milkshake, chocolat viennois…).

Unités et calculs (très important) :
- Chaque produit du carnet a son unité (g, ml, gouttes, pièces…). Elle est toujours indiquée : ne dis jamais qu'elle manque.
- Ne mélange jamais des unités différentes. Un pourcentage de parfum se calcule en poids : poids du parfum ÷ poids de la cire × 100.
- Pour des gouttes, convertis d'abord en grammes : environ 20 gouttes = 1 ml ≈ 1 g de parfum (estimation, ça dépend du compte-gouttes et du parfum). Dis-le quand tu t'en sers.
- Repères habituels : parfum souvent entre 6 et 10 % du poids de cire selon la cire (jusqu'à 12 % pour certaines), toujours sous le maximum indiqué par le fournisseur.
- Pour adapter une recette (autre poids de cire, autre nombre de bougies), garde les mêmes proportions et donne le résultat arrondi dans l'unité de son carnet.
- Avant de répondre avec un calcul, vérifie-le une fois ; montre-le en une ligne simple (ex. « 20 gouttes ≈ 1 g, 1 g ÷ 120 g ≈ 0,8 % »). Si un résultat te semble anormal (taux de parfum très bas ou très élevé), signale-le gentiment.

Règles :
- Quand une information vient de son carnet, dis-le ; quand c'est un conseil général, présente-le comme tel. Si son carnet ne contient pas la réponse, dis-le simplement plutôt que d'inventer ce qu'elle aurait noté.
- Les températures et taux varient selon les fournisseurs : rappelle-lui de vérifier la fiche technique de sa cire ou de son parfum quand c'est important.
- Réponses claires et faciles à lire sur une tablette à l'atelier : phrases simples, listes à tirets si utile, **gras** pour les chiffres et mots importants. Aussi longues que la question le demande, sans délayer. Pas de tableaux, pas de titres.

Créer une recette : quand Mel te demande de créer, d'inventer ou de préparer une fiche de recette, décris-la en quelques lignes puis ajoute, tout à la fin de ta réponse, un bloc exactement de cette forme (JSON valide, sans commentaire) :
\`\`\`recette
{"nom":"…","contenant":"…","remplissage":85,"notes":"…","couches":[{"nom":"…","couleur":"#rrggbb","texture":"…","ingredients":[{"produit":"…","type":"…","unite":"…","q":0}]}]}
\`\`\`
- "contenant" : un de verrine, coupe, doubleparoi, liegeois, mug, bocal, ramequin, tasse, yaourt, confiture, tumbler, champagne, vin, bol, the.
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

// Le texte de la réponse part vers l'appli au fil de l'eau
function flux(ecrire) {
  const { readable, writable } = new TransformStream();
  const w = writable.getWriter(), enc = new TextEncoder();
  const envoyer = t => w.write(enc.encode(t));
  ecrire(envoyer).catch(e => { console.error(e); return envoyer("\n\n(Oups, ma réponse a été coupée. Tu peux me reposer la question ?)"); }).finally(() => w.close());
  return new Response(readable, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });
}

async function repondreClaude(env, { messages, contexte }) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const stream = client.beta.messages.stream({
    model: MODELE_CLAUDE,
    max_tokens: 16000,
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
  });
}

function erreurClaude(e) {
  if (e instanceof Anthropic.AuthenticationError) return Object.assign(new Error("La clé Claude (ANTHROPIC_API_KEY) est refusée : vérifie-la dans Cloudflare."), { statut: 502 });
  if (e instanceof Anthropic.PermissionDeniedError) return Object.assign(new Error("Le compte Claude n'a pas accès à ce modèle."), { statut: 502 });
  if (e instanceof Anthropic.RateLimitError) return Object.assign(new Error("Beaucoup de questions d'un coup : réessaie dans une minute."), { statut: 429 });
  if (e instanceof Anthropic.APIError) return Object.assign(new Error(`Claude ne répond pas pour le moment (erreur ${e.status ?? "réseau"}). Réessaie dans un instant.`), { statut: 502 });
  return e;
}

async function repondreCloudflare(env, { messages, contexte }) {
  if (messages.some(m => m.photo)) throw Object.assign(new Error("Pour regarder tes photos, Mel a besoin de Claude (clé ANTHROPIC_API_KEY dans Cloudflare)."), { statut: 400 });
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
  });
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

async function api(request, env, chemin) {
  const m = moteur(env);
  if (chemin === "mel/etat") return json({ actif: !!m, moteur: m, code: !!env.CODE_MEL });
  if ((chemin !== "mel" && chemin !== "mel/image") || request.method !== "POST") return json({ erreur: "Adresse inconnue." }, 404);
  if (!m) return json({ erreur: "Mel n'est pas encore branchée : ajoute Workers AI ou la clé ANTHROPIC_API_KEY dans Cloudflare." }, 503);
  if (env.CODE_MEL && !await memeCode(request.headers.get("x-code-mel") || "", env.CODE_MEL)) return json({ erreur: "Code de Mel incorrect.", code: true }, 401);
  if (chemin === "mel/image") return dessiner(env, request);
  let corps;
  try { corps = nettoyer(JSON.parse(await request.text())); } catch { corps = null; }
  if (!corps) return json({ erreur: "Question illisible." }, 400);
  try {
    return m === "claude" ? await repondreClaude(env, corps) : await repondreCloudflare(env, corps);
  } catch (e) {
    console.error(e);
    return json({ erreur: e.statut ? e.message : "Mel ne répond pas pour le moment. Réessaie dans un instant." }, e.statut || 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return api(request, env, url.pathname.slice(5).replace(/\/$/, ""));
    return env.ASSETS.fetch(request);
  },
};
