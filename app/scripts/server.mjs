import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { analyzeRequest, modelConfig } from '../src/api.js';
const routes={'/':['public/index.html','text/html; charset=utf-8'],'/app.js':['src/app.js','text/javascript; charset=utf-8'],'/core.js':['src/core.js','text/javascript; charset=utf-8'],'/styles.css':['public/styles.css','text/css; charset=utf-8'],'/seed.json':['data/seed.json','application/json; charset=utf-8']};
const port=Number(process.env.PORT || 4303);
http.createServer(async(req,res)=>{
 try {
  const host=req.headers.host;if(![`127.0.0.1:${port}`,`localhost:${port}`].includes(host)){res.writeHead(403);res.end('Invalid host');return;}
  const url = new URL(req.url,`http://${host}`); let response;
  if(url.pathname==='/api/analyze') {
   let body=''; for await(const chunk of req) {body+=chunk; if(body.length>30000){res.writeHead(413);res.end('Request too large');return;}}
   response=await analyzeRequest(new Request(url,{method:req.method,headers:req.headers,...(req.method==='POST'?{body}: {})}),process.env);
  } else if(url.pathname==='/api/config') response=Response.json({aiConfigured:modelConfig(process.env),storage:'browser-local',liveFeeds:false,version:'1.0.0'},{headers:{'cache-control':'no-store'}});
  else if(req.method==='GET' && routes[url.pathname]) { const [p,type]=routes[url.pathname];response=new Response(await readFile(new URL(`../${p}`,import.meta.url)),{headers:{'content-type':type,'cache-control':'no-cache'}}); }
  else response=new Response('Not found',{status:404});
  response.headers.set('x-content-type-options','nosniff');response.headers.set('referrer-policy','no-referrer');
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
 } catch { res.writeHead(500); res.end('Server error'); }
}).listen(port,'127.0.0.1',()=>console.log(`TRACE Local: http://127.0.0.1:${port}`));
