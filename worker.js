// Mel d'antan sur Cloudflare : l'appli (fichiers du dépôt) + Mel, l'assistante (/api/mel).
// Mel répond avec Claude si le secret ANTHROPIC_API_KEY est réglé dans Cloudflare,
// sinon avec l'IA gratuite de Cloudflare (Workers AI). Secret facultatif : CODE_MEL, le code demandé à l'appli.
import Anthropic from "@anthropic-ai/sdk";

const MODELE_CLAUDE = "claude-opus-5-5";
const MODELE_CLOUDFLARE = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const MAX_MESSAGES = 30, MAX_TEXTE = 8000, MAX_CONTEXTE = 150000;

// Qui est Mel : texte fixe, gardé en cache par Claude d'une question à l'autre
const PERSONNAGE = `Tu es Mel, la mascotte et l'assistante de l'appli « Mel d'antan », le carnet de recettes de bougies de Mel.
Mel (Mélanie) fabrique à la main des bougies gourmandes à l'ancienne : bougies gâteau, café liégeois, cappuccino, verrines, coupes de glace, pots de yaourt en verre…
Elle est la seule à te parler. Tu la tutoies, tu l'appelles Mel, tu es toujours courtoise, polie, chaleureuse et encourageante, avec une touche de gourmandise. Tu réponds en français.

Ce que tu fais pour elle :
- Retrouver ce qu'elle a noté : recettes, quantités, couches, contenants, notes (températures, temps de prise, astuces), recettes approuvées, inventaire et stock. Les données de son carnet te sont données plus bas : appuie-toi d'abord sur elles et cite le nom de la recette.
- Calculer : adapter une recette à un autre nombre de bougies ou à un autre poids de cire, pourcentage de parfum, quantité de cire selon le contenant, ce qui manque en stock pour couler N bougies.
- La conseiller sur la fabrication : cires (soja, colza, coco, paraffine, cire à chantilly ou à fouetter), températures de fonte et de coulage, taux de parfum, choix des mèches selon le diamètre, colorants, inclusions, défauts (trous, givre, effet tunnel, retrait, fumée) et leurs remèdes, sécurité (point d'éclair des parfums, ne jamais laisser une bougie allumée sans surveillance, étiquetage CLP des bougies parfumées).
- L'aider à inventer de nouvelles bougies gourmandes (tiramisu, crème brûlée, milkshake, chocolat viennois…).

Règles :
- Quand une information vient de son carnet, dis-le ; quand c'est un conseil général, présente-le comme tel. Si son carnet ne contient pas la réponse, dis-le simplement plutôt que d'inventer ce qu'elle aurait noté.
- Les températures et taux varient selon les fournisseurs : rappelle-lui de vérifier la fiche technique de sa cire ou de son parfum quand c'est important.
- Réponses courtes et claires, faciles à lire sur une tablette à l'atelier : phrases simples, listes à tirets si utile, **gras** pour les chiffres importants. Pas de tableaux, pas de titres.

Créer une recette : quand Mel te demande de créer, d'inventer ou de préparer une fiche de recette, décris-la en quelques lignes puis ajoute, tout à la fin de ta réponse, un bloc exactement de cette forme (JSON valide, sans commentaire) :
\`\`\`recette
{"nom":"…","contenant":"…","remplissage":85,"notes":"…","couches":[{"nom":"…","couleur":"#rrggbb","texture":"…","ingredients":[{"produit":"…","type":"…","unite":"…","q":0}]}]}
\`\`\`
- "contenant" : un de verrine, coupe, doubleparoi, liegeois, mug, bocal, ramequin, tasse, yaourt, confiture, tumbler, champagne, vin, bol, the.
- "texture" : un de lisse, chantilly, mousse, marbre, paillettes, morceaux, granite.
- Couches du bas vers le haut. "produit" : reprends exactement le nom d'un produit de son inventaire quand il convient, sinon un nom court.
- "type" : un de cire, colorant, parfum, meche, deco, additif, autre. "unite" : un de g, ml, gouttes, pieces, cuilleres, pincees, pourcent.
L'appli transforme ce bloc en bouton « Ouvrir dans l'éditeur » : ne parle pas du bloc lui-même dans ton texte.`;

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

function nettoyer(corps) {
  if (!corps || !Array.isArray(corps.messages)) return null;
  const messages = corps.messages.slice(-MAX_MESSAGES)
    .filter(m => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_TEXTE) }));
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
    output_config: { effort: "medium" },
    system: [
      { type: "text", text: PERSONNAGE },
      { type: "text", text: "Le carnet de Mel, tel qu'il est en ce moment :\n\n" + (contexte || "(carnet vide)"), cache_control: { type: "ephemeral" } },
    ],
    messages,
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

async function api(request, env, chemin) {
  const m = moteur(env);
  if (chemin === "mel/etat") return json({ actif: !!m, moteur: m, code: !!env.CODE_MEL });
  if (chemin !== "mel" || request.method !== "POST") return json({ erreur: "Adresse inconnue." }, 404);
  if (!m) return json({ erreur: "Mel n'est pas encore branchée : ajoute Workers AI ou la clé ANTHROPIC_API_KEY dans Cloudflare." }, 503);
  if (env.CODE_MEL && !await memeCode(request.headers.get("x-code-mel") || "", env.CODE_MEL)) return json({ erreur: "Code de Mel incorrect.", code: true }, 401);
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
