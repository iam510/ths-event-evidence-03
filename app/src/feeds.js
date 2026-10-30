import {safeUrl,invariant} from './core.js';
import {createAnalysisLimiter} from './api.js';
const ORIGIN='https://fuyao.aicubes.cn';
const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store'}});
export const feedConfig=env=>({provider:'扶摇',configured:Boolean(env.FUYAO_API_KEY),mode:'on-demand',kinds:['stock','flash']});
export function plainText(value){return String(value??'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]*>/g,' ').replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g,s=>({'&nbsp;':' ','&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&#39;':"'"}[s])).replace(/\s+/g,' ').trim();}
function time(value){if(value===null||value===undefined)return null;invariant(Number.isSafeInteger(value)&&value>0&&value<8640000000000000,'资讯时间字段无效');return new Date(value).toISOString();}
export function normalizeFeed(data,kind,code,capturedAt,requestId){
 invariant(data&&Array.isArray(data.items)&&data.items.length<=100,'资讯列表结构无效');
 const items=data.items.slice(0,20).map(row=>{
  invariant(typeof row.id==='string'&&row.id.length<=200,'资讯标识无效');
  invariant(typeof row.title==='string'&&row.title.trim()&&row.title.length<=500,'资讯标题无效');
  const url=safeUrl(kind==='flash'?row.encoded_url:row.jump_url);invariant(url,'资讯原始链接无效');
  invariant(row.summary===null||row.summary===undefined||typeof row.summary==='string','资讯摘要格式无效');
  const summary=plainText(row.summary);invariant(summary.length<=10000,'资讯摘要过长');
  return {id:row.id,title:plainText(row.title),summary,url,source:kind==='flash'?'同花顺快讯':plainText(row.source)||'扶摇资讯（来源未提供）',sourceType:'news',publishedAt:time(kind==='flash'?row.create_time_ms:row.publish_time_ms),updatedAt:kind==='flash'?time(row.update_time_ms):null,capturedAt,occurredAt:null,stockCode:kind==='stock'?code:null,independentGroup:`fuyao:${kind}:${row.id}`,provenance:{provider:'fuyao',kind,itemId:row.id,requestId,endpoint:kind==='flash'?'/api/news/flash/list':'/api/news/stock/timeline-list',fields:{title:row.title,summary:row.summary??null,source:kind==='flash'?null:row.source??null,url,publicationMs:kind==='flash'?row.create_time_ms:row.publish_time_ms,updateMs:kind==='flash'?row.update_time_ms:null}},canImport:summary.length>=8};
 });
 return {provider:'扶摇',kind,code:kind==='stock'?code:null,capturedAt,items,hasMore:Boolean(data.has_more),note:'仅本次返回的公开资讯摘要；需打开来源核对，不是完整事件库或自动订阅。'};
}
export function createFeedService({fetcher=fetch,now=Date.now,limiter=createAnalysisLimiter({perMinute:6,perDay:60,globalPerDay:200,maxConcurrent:2})}={}){
 const cache=new Map();
 return async(request,env={})=>{
  if(request.method!=='POST')return json({error:'仅接受POST'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'来源校验失败'},403);
  if(!request.headers.get('content-type')?.includes('application/json'))return json({error:'请使用JSON请求'},415);
  let slot;
  try{
   const raw=await request.text();invariant(raw.length<=1000,'资讯请求过长');const body=JSON.parse(raw);
   invariant(['stock','flash'].includes(body.kind),'资讯类型无效');
   invariant(body.kind!=='stock'||typeof body.code==='string'&&/^\d{6}\.(SH|SZ|BJ)$/.test(body.code),'请填写完整A股代码，如300033.SZ');
   if(!env.FUYAO_API_KEY)return json({error:'扶摇尚未配置，现有工作区未改变。',code:'FEED_NOT_CONFIGURED'},503);
   const key=body.kind==='flash'?'flash':body.code;const hit=cache.get(key);
   if(hit&&now()-hit.at<60000)return json({...hit.data,cached:true});
   slot=limiter.take(request.headers.get('cf-connecting-ip')||'local');
   if(!slot.allowed){const r=json({error:'资讯查询过于频繁，请稍后重试；现有材料未改变。',code:'FEED_RATE_LIMITED'},429);r.headers.set('retry-after',String(slot.retryAfter));return r;}
   const path=body.kind==='flash'?'/api/news/flash/list?tag_id=21103&seq=0':`/api/news/stock/timeline-list?thscode=${encodeURIComponent(body.code)}&offset=first&size=20`;
   const upstream=await fetcher(ORIGIN+path,{headers:{'X-api-key':env.FUYAO_API_KEY},redirect:'manual',signal:AbortSignal.timeout(20000)});
   if(!upstream.ok)return json({error:`扶摇查询失败（HTTP ${upstream.status}），未更新工作区。`,code:'FEED_UPSTREAM_ERROR'},502);
   const text=await upstream.text();invariant(text.length<=300000,'资讯响应过长');const envelope=JSON.parse(text);
   if(envelope.code!==0)return json({error:[2001,2003].includes(envelope.code)?'扶摇密钥或接口权限不足，请核对服务端配置；未更新工作区。':'扶摇返回业务错误，未更新工作区。',code:'FEED_PROVIDER_ERROR',providerCode:typeof envelope.code==='number'?envelope.code:null},502);
   const data=normalizeFeed(envelope.data,body.kind,body.code,new Date(now()).toISOString(),typeof envelope.request_id==='string'?envelope.request_id.slice(0,200):null);
   if(cache.size>=50)cache.delete(cache.keys().next().value);cache.set(key,{at:now(),data});return json({...data,cached:false});
  }catch(e){return json({error:e.name==='TimeoutError'||e.name==='AbortError'?'扶摇查询超时，现有材料未改变。':'资讯参数或返回结构无效，现有材料未改变。',code:'FEED_FAILED'},e.name==='TimeoutError'||e.name==='AbortError'?504:422);}
  finally{slot?.release?.();}
 };
}
export const feedRequest=createFeedService();
