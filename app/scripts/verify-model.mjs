/** Explicit opt-in real provider test. No key values are logged or written. */
import { analyzeRequest, PROMPT_VERSION } from '../src/api.js';
import { writeFile, readFile } from 'node:fs/promises';
let env=process.env;
if(process.argv.includes('--stdin')){
 process.stdin.setRawMode?.(true);process.stdin.setEncoding('utf8');
 const raw=await new Promise(resolve=>{let buffer='';process.stdin.on('data',chunk=>{buffer+=chunk;if(buffer.includes('\n')){process.stdin.setRawMode?.(false);process.stdin.pause();resolve(buffer.split('\n')[0]);}});});
 env={...process.env,...JSON.parse(raw)};
}
if(!env.MODEL_API_KEY||!env.MODEL_BASE_URL||!env.MODEL_NAME)throw new Error('请在本地环境或服务端秘密变量配置模型；此测试不会自动获取密钥。');
const source='澄明能源公告：海岬储能项目总投资8亿元，仍须审批。公司预计该项目可能改善未来业务结构，但不作收益承诺。';
const seed=JSON.parse(await readFile(new URL('../data/seed.json',import.meta.url)));
const started=Date.now();let upstream={};
const fetcher=async(...args)=>{const response=await fetch(...args);const data=await response.clone().json();upstream={httpStatus:response.status,requestId:data.id||null,providerCode:data.base_resp?.status_code??null,finishReason:data.choices?.[0]?.finish_reason||null,usage:data.usage||null,providerError:response.ok?null:String(data.error?.message||data.error?.msg||data.base_resp?.status_msg||data.message||'').replaceAll(env.MODEL_API_KEY,'[redacted]').slice(0,500)};return response;};
const request=new Request('http://localhost:4303/api/analyze',{method:'POST',headers:{origin:'http://localhost:4303','content-type':'application/json'},body:JSON.stringify({text:source,events:seed.events.map(e=>({id:e.id,title:e.title}))})});
const response=await analyzeRequest(request,env,fetcher);const result=await response.json();
const report={verifiedAt:new Date().toISOString(),provider:'MiniMax',model:env.MODEL_NAME,promptVersion:PROMPT_VERSION,credential:'server-only / configured credential (value omitted)',durationMs:Date.now()-started,productHttpStatus:response.status,upstream,input:source,result,sourceQuotesMatch:result.statements?.every(s=>source.includes(s.quote))??false,scope:'Single explicit real-provider contract test. No accuracy or coverage claim.'};
await writeFile(new URL('../../docs/evidence/minimax-live-test.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));process.exit(response.ok?0:1);
