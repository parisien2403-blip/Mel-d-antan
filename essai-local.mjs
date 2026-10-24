// Essai local sans compte Cloudflare : node essai-local.mjs puis http://localhost:8780 (Mel répond avec une fausse IA)
import http from "node:http";import fs from "node:fs";import path from "node:path";
import worker from "./worker.js";
const dir=path.dirname(new URL(import.meta.url).pathname);
const types={".html":"text/html",".js":"text/javascript",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".webmanifest":"application/json"};
let derniere=null;
const env={
  CODE_MEL:process.env.CODE_MEL||undefined,
  ANTHROPIC_API_KEY:process.env.ANTHROPIC_API_KEY||undefined,
  AI:{async run(modele,opts){derniere=opts;
    if(modele.includes("flux"))return{image:fs.readFileSync(path.join(dir,"logo.jpg")).toString("base64")};const morceaux=["Bonjour Mel ! ","D’après ton carnet, ta **chantilly** se fouette à **50 °C**.\n\n","- Fouette 2 min\n- Pose à la poche douille\n\n","Voici une idée :\n```recette\n",'{"nom":"Tiramisu","contenant":"verrine","remplissage":85,"notes":"Couler à 65 °C","couches":[{"nom":"Biscuit café","couleur":"#6f4326","texture":"lisse","ingredients":[{"produit":"Cire de soja","type":"cire","unite":"g","q":100},{"produit":"Parfum mascarpone","type":"parfum","unite":"gouttes","q":15}]},{"nom":"Crème","couleur":"#f6ecd8","texture":"chantilly","ingredients":[{"produit":"Cire à chantilly","type":"cire","unite":"g","q":60}]}]}',"\n```\n\nEt voici à quoi elle pourrait ressembler :\n```image\nA tiramisu candle in a glass verrine, coffee layer, mascarpone whipped top dusted with cocoa\n```"];
    const enc=new TextEncoder();return new ReadableStream({async start(c){for(const m of morceaux){c.enqueue(enc.encode(`data: ${JSON.stringify({response:m})}\n\n`));await new Promise(r=>setTimeout(r,120))}c.enqueue(enc.encode("data: [DONE]\n\n"));c.close()}})}},
  ASSETS:{async fetch(req){const u=new URL(req.url);let f=path.join(dir,decodeURIComponent(u.pathname));if(f.endsWith("/"))f+="index.html";
    try{return new Response(fs.readFileSync(f),{headers:{"content-type":types[path.extname(f)]||"application/octet-stream"}})}catch{return new Response("introuvable",{status:404})}}},
};
http.createServer(async(q,s)=>{
  if(q.url==="/__derniere"){s.end(JSON.stringify(derniere));return}
  const corps=await new Promise(r=>{const b=[];q.on("data",x=>b.push(x));q.on("end",()=>r(Buffer.concat(b)))});
  const req=new Request("http://localhost:8780"+q.url,{method:q.method,headers:q.headers,body:q.method==="POST"?corps:undefined});
  const r=await worker.fetch(req,env);s.writeHead(r.status,Object.fromEntries(r.headers));
  if(r.body){const l=r.body.getReader();for(;;){const{done,value}=await l.read();if(done)break;s.write(value)}}s.end();
}).listen(+process.env.PORT||8780,()=>console.log("prêt"));
