import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
const RAIZ = new URL('./dist/', import.meta.url).pathname;
const P=4440;
const T={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'};
const sv=createServer(async(q,r)=>{let u=decodeURIComponent(q.url.split('?')[0]);if(u.startsWith('/nexus-cargo'))u=u.slice(12);if(u===''||u==='/')u='/index.html';
 try{const b=await readFile(join(RAIZ,u));r.writeHead(200,{'content-type':T[extname(u)]||'application/octet-stream'});r.end(b);}catch{r.writeHead(404);r.end('no');}});
await new Promise(r=>sv.listen(P,r));
const nav=await chromium.launch({executablePath:process.env.CHROMIUM||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--no-sandbox']});
const pag=await(await nav.newContext({viewport:{width:1280,height:800}})).newPage();
await pag.addInitScript(()=>{window.__debugNX=true;});
await pag.goto(`http://127.0.0.1:${P}/nexus-cargo/?calidad=alto`,{waitUntil:'load'});
await pag.waitForFunction(()=>window.__escenaNX&&window.__escenaNX.fotogramas>4,null,{timeout:60000});
const r=await pag.evaluate(()=>{
  const e=window.__escenaNX; e.irA(0.68); e.escena.updateMatrixWorld(true);
  const quien=(o)=>{const R={barco:e.barco,camion:e.camion,heroe:e.heroe,puerto:e.puerto,aduanas:e.aduanas,carretera:e.carretera,centro:e.centro,destino:e.destino,mar:e.mar};
    for(const[n,x] of Object.entries(R)){if(!x)continue;let y=o;while(y){if(y===x)return n;y=y.parent;}} return o.type;};
  const out=[];
  e.escena.traverse(o=>{
    if(!o.isMesh||!o.visible)return;
    let pa=o;while(pa){if(!pa.visible)return;pa=pa.parent;}
    const c=new e.THREE.Box3().setFromObject(o);
    const t=c.getSize(new e.THREE.Vector3());
    if(t.x<200&&t.z<200)return;      // sólo lo grande
    out.push({quien:quien(o), tam:[t.x,t.y,t.z].map(v=>+v.toFixed(0)),
      centro:c.getCenter(new e.THREE.Vector3()).toArray().map(v=>+v.toFixed(0)),
      color: o.material&&o.material.color?'#'+o.material.color.getHexString():'-'});
  });
  return {cam:e.camara.position.toArray().map(v=>+v.toFixed(0)), out};
});
console.log('cámara', r.cam);
for(const o of r.out) console.log(` ${o.quien.padEnd(10)} tam ${String(o.tam).padEnd(18)} centro ${String(o.centro).padEnd(18)} ${o.color}`);
await nav.close();sv.close();
