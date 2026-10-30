import assets from './assets.generated.js';
import { guardedAnalysis, publicModelConfig } from '../src/api.js';
const security = {'x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'self' https://chatgpt.com https://*.chatgpt.com https://*.openai.com"};
export default {
 async fetch(request, env={}) {
  const path = new URL(request.url).pathname;
  let response;
  if(path==='/api/analyze') response = await guardedAnalysis(request,env,{actor:request.headers.get('cf-connecting-ip')||'unknown'});
  else if(path==='/api/config') response = Response.json(publicModelConfig(env),{headers:{'cache-control':'no-store'}});
  else if(['GET','HEAD'].includes(request.method) && assets[path]) { const a = assets[path]; response=new Response(request.method==='HEAD'?null:a.body,{headers:{'content-type':a.type,'cache-control':'no-cache'}}); }
  else response=new Response('Not found',{status:404});
  for(const [key,value] of Object.entries(security)) response.headers.set(key,value);
  return response;
 }
};
