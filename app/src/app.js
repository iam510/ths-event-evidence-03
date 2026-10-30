import { KINDS, SOURCE_TYPES, STATUS, RULE_VERSION, uid, safeUrl, validTime, weight, flatten, snapshot, eventState, addMaterial, candidates, ruleDraft, validateWorkspace, freshness, fingerprint } from './core.js';
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={layers:'<path d="m3 6 9-4 9 4-9 4z"/><path d="m3 11 9 4 9-4M3 16l9 4 9-4"/>',database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5M4 12v7c0 4 16 4 16 0v-7"/>',history:'<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/>',book:'<path d="M12 5c-4-3-9-2-9-2v16s5-1 9 2c4-3 9-2 9-2V3s-5-1-9 2v16"/>',help:'<circle cx="12" cy="12" r="9"/><path d="M9.5 8a2.5 2.5 0 1 1 3 3c-.5.3-.5 1-.5 2M12 16h.01"/>',plus:'<path d="M12 5v14M5 12h14"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',shield:'<path d="m12 2 8 3v7c0 5-8 10-8 10S4 17 4 12V5z"/><path d="m8 12 3 3 5-6"/>',download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',external:'<path d="M14 3h7v7m0-7L11 13M10 3H3v18h18v-7"/>',alert:'<path d="m12 3 10 18H2zM12 9v5m0 3h.01"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',check:'<path d="m5 12 4 4L20 5"/>'};
const icon = name=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]||icons.book}</svg>`;
function paintIcons(){ $$('[data-icon]').forEach(e=>e.innerHTML=icon(e.dataset.icon)); }
paintIcons();
const STORAGE='trace.workspace.v1';
let state, seed, selected='evt-haijia', tab='timeline', filter='all', search='', sort='disclosure', replay=null, view='events', config={aiConfigured:false}, draft=null, toastTimer;
let storageAvailable=true;
function toast(message,error=false){const e=$('#toast');e.textContent=message;e.className=error?'error':'';e.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.hidden=true,error?9000:4500);}
function save(next){try{validateWorkspace(next);localStorage.setItem(STORAGE,JSON.stringify(next));state=next;$('#save-indicator').innerHTML='<i></i>已保存至此浏览器';return true;}catch(e){toast(`未保存：${e.message}。请导出备份或检查浏览器存储。`,true);return false;}}
function fmt(t, withTime=false){if(!t)return '未提供';if(/^\d{4}-\d{2}-\d{2}$/.test(t))return `${t}（仅日期）`;const d=new Date(t);if(isNaN(d))return '时间无效';return new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',...(withTime?{hour:'2-digit',minute:'2-digit',hour12:false}:{})}).format(d).replaceAll('/','-')+(withTime?' UTC+8':'');}
const badge=(status,label)=>`<span class="badge ${esc(status)}">${esc(label||STATUS[status]||KINDS[status]||status)}</span>`;
const displayClaim=c=>!c?'暂无证据':c.status==='conflict'?`冲突：${c.alternatives.join(' / ')}`:c.status==='pending'?'尚待核实（参见原始陈述）':`${c.value}${c.unit}`;
const activeEvent=()=>state.events.find(e=>e.id===selected)||state.events[0];
const visibleEvent=()=>{const e=activeEvent();return replay===null?e:{...e,materials:e.materials.slice(0,replay)};};
function labelType(e){return e.isSynthetic?'<span class="badge synthetic">构造案例</span>':'<span class="badge real">真实历史资料</span>';}
function sourceMeta(m){return `${m.isSynthetic?'构造材料':'真实来源'} · ${m.sourceCheck==='curated'?'内置已核对':'用户提供，待独立核验'}`;}
function render(){
 $('#nav-count').textContent=state.events.length;
 $('#event-count').textContent=String(state.events.length).padStart(2,'0');
 $('#workspace').hidden=view!=='events';$('#alternate-view').hidden=view==='events';
 $$('.nav-item[data-view]').forEach(b=>{b.classList.toggle('active',b.dataset.view===view);if(b.dataset.view===view)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
 const names={events:'事件工作台',sources:'来源与数据',history:'全部更新记录'};$('#view-name').textContent=names[view];
 $('#page-title').textContent=view==='events'?'每一次变化，都有证据可循。':view==='sources'?'知道来源，才知道判断的边界。':'结论会改变，依据不会消失。';
 $('#page-subtitle').textContent=view==='events'?'从最初的消息，到此刻的判断。看见事件完整的来龙去脉。':view==='sources'?'查看资料出处、核验方式与接入状态。':'回看每次录入前后，哪些主张发生了变化。';
 renderList();if(view==='events')renderDetail();else if(view==='sources')renderSources();else renderAllHistory();
}
function renderList(){
 const events=state.events.filter(e=> (!search || `${e.title} ${e.subject} ${e.object} ${e.aliases.join(' ')}`.toLowerCase().includes(search.toLowerCase())) && (filter==='all'||eventState(e)===filter||filter==='pending'&&snapshot(e).some(c=>c.status==='pending')));
 $('#event-list').innerHTML=events.length?events.map(e=>`<button class="event-card ${e.id===selected?'selected':''}" data-event="${esc(e.id)}" aria-pressed="${e.id===selected}"><div class="event-card-top"><span class="company-name">${esc(e.subject)}</span>${labelType(e)}</div><h3>${esc(e.title)}</h3><div class="event-meta">${badge(eventState(e))}<span>${e.materials.length} 份材料</span></div></button>`).join(''):'<p class="empty">没有匹配事件。<br>可调整筛选或录入新材料。</p>';
}
function renderDetail(){
 const full=activeEvent(),e=visibleEvent(),claims=snapshot(e),fresh=freshness(e),all=flatten(e);
 const current=eventState(e),independent=new Set(e.materials.map(m=>m.independentGroup)).size;
 $('#content').innerHTML=`<div class="detail-head"><div class="detail-kicker"><span class="mono">${esc(e.id.toUpperCase())}</span>${labelType(e)}<span>${esc(e.type)}</span></div><div class="detail-title-row"><h2>${esc(e.title)}</h2>${badge(current)}</div><p class="detail-subtitle"><span>${esc(e.scope)}</span><span>${e.materials.length} 份材料 / ${independent} 个来源组</span></p></div>
 <div class="summary-grid">${claims.slice(0,3).map((c,i)=>`<div class="summary-card ${c.status==='conflict'?'attention':''}"><div class="summary-label"><span class="mono">0${i+1}</span>${esc(c.label)}</div><p class="summary-value ${c.value.length>24?'long':''}">${c.status==='conflict'?esc([...new Set(all.filter(s=>c.activeIds.includes(s.id)&&s.kind==='fact'&&s.stance!=='deny').map(s=>`${s.value}${s.unit}`))].join(' / ')):esc(c.status==='pending'?'尚待证据核实':`${c.value}${c.unit}`)}</p>${badge(c.status)}<button data-claim="${esc(c.id)}">核对依据 ${icon('arrow')}</button></div>`).join('')}</div>
 <div class="detail-tabs" role="tablist" aria-label="事件详情视图"><button role="tab" aria-selected="${tab==='timeline'}" class="tab ${tab==='timeline'?'active':''}" data-tab="timeline">证据时间线 <span>${e.materials.length}</span></button><button role="tab" aria-selected="${tab==='claims'}" class="tab ${tab==='claims'?'active':''}" data-tab="claims">主张与冲突 <span>${claims.filter(c=>c.status==='conflict').length}</span></button><button role="tab" aria-selected="${tab==='history'}" class="tab ${tab==='history'?'active':''}" data-tab="history">更新记录</button></div>
 ${tab==='timeline'?`<div class="detail-body"><div class="timeline-area"><div class="timeline-toolbar"><h3>信息如何一步步演变</h3><div class="timeline-controls"><label for="time-sort">排序</label><select class="compact-select" id="time-sort"><option value="disclosure" ${sort==='disclosure'?'selected':''}>按披露时间 ↓</option><option value="occurrence" ${sort==='occurrence'?'selected':''}>按发生时间 ↓</option><option value="ingestion" ${sort==='ingestion'?'selected':''}>按录入顺序 ↓</option></select></div></div><div class="timeline-controls"><label for="replay-select">历史回放</label><select id="replay-select" class="compact-select"><option value="all">当前全部材料</option>${full.materials.map((m,i)=>`<option value="${i+1}" ${replay===i+1?'selected':''}>第 ${i+1} 份录入后 · ${esc(m.source)}</option>`).join('')}</select><span class="tiny muted">回放当时已收录的证据</span></div>${replay!==null?`<div class="replay-banner">正在回放前 ${replay} 份材料。有效期仍以今天判断。<button class="text-btn" id="exit-replay">返回当前</button></div>`:''}<div class="timeline mt18">${renderTimeline(e,claims)}</div></div>${renderAside(e,claims,fresh)}</div>`:tab==='claims'?renderClaims(e,claims):`<div class="history-list">${renderHistory(full)}</div>`}`;
}
function renderTimeline(e,claims){
 const keys={disclosure:'publishedAt',occurrence:'occurredAt',ingestion:'ingestedAt'};const key=keys[sort];
 const list=[...e.materials].sort((a,b)=>sort==='ingestion'?e.materials.indexOf(b)-e.materials.indexOf(a):Date.parse(b[key]||'1970-01-01')-Date.parse(a[key]||'1970-01-01'));
 return list.map(m=>{
 const kinds=[...new Set(m.statements.map(s=>s.kind))];const w=weight(m,m.statements[0]);const conflicting=m.statements.some(s=>claims.some(c=>c.status==='conflict'&&c.activeIds.includes(s.id)));
 const targets=m.statements.filter(s=>s.targetId).map(s=>({s,t:flatten(e).find(t=>t.id===s.targetId)}));
 return `<article class="timeline-item ${conflicting?'conflict':''}"><span class="timeline-dot"></span><div class="timeline-date"><time>${esc(fmt(m[key],Boolean(m[key]?.includes('T'))))}</time><span>${sort==='ingestion'?'录入':sort==='occurrence'?'发生':'披露'}</span></div><div class="timeline-card"><div class="source-row"><span class="source-symbol">${m.sourceType==='announcement'?'公':m.sourceType==='regulator'?'监':m.sourceType==='research'?'研':m.sourceType==='social'?'传':'讯'}</span><span>${esc(m.source)}</span><span class="source-type">${esc(SOURCE_TYPES[m.sourceType])}</span></div><h4>${esc(m.title)}</h4><p class="snippet">${esc(m.text)}</p>${m.derivedFrom?'<div class="version-note">同源转载 · 不计为新增独立佐证</div>':''}${targets.map(({s,t})=>`<div class="version-note">${s.stance==='correct'?'更正':'更新'} → ${esc(t?.material.title||'对应主张')} ${claims.some(c=>c.supersededIds.includes(s.targetId))?'· 旧版本已保留':'· 未达到覆盖条件，保留待核对'}</div>`).join('')}<div class="evidence-bottom">${kinds.map(k=>badge(k)).join('')}<span class="weight">${esc(w.level)}权重</span><button class="text-btn" data-evidence="${esc(m.id)}">查看证据 ${icon('arrow')}</button></div></div></article>`;
 }).join('')||'<div class="empty">暂无材料</div>';
}
function renderAside(e,claims,fresh){
 const conflict=claims.filter(c=>c.status==='conflict');const pending=claims.filter(c=>c.status==='pending');const first=[...e.materials].filter(m=>m.publishedAt).sort((a,b)=>Date.parse(a.publishedAt)-Date.parse(b.publishedAt))[0];
 return `<aside class="insight-aside" aria-label="当前判断与标的关系"><div class="aside-section"><h3 class="aside-title">当前需要关注 ${icon('alert')}</h3>${conflict.length?`<div class="attention-box"><strong>${icon('alert')}${conflict.length} 项证据冲突尚待核对</strong><p>${esc(conflict.map(c=>c.label).join('、'))}存在不同陈述，暂不合并为单一结论。</p></div>`:`<p class="aside-text">${claims.some(c=>c.status==='denied')?'已出现否认材料，需留意否认范围；不能将其等同于事实已彻底查明。':pending.length?`${pending.length} 项主张仍待核实，现有信息不足以确认。`:'当前已收录主张均有直接依据，仍需核对范围和来源。'}</p>`}<p class="aside-note">${pending.length?`${pending.length} 项主张只有间接信息或观点。`:'结论仅基于已收录材料。'} ${fresh.stale?'资料已陈旧，未连接实时更新。':'新鲜度按披露时间判断，未连接实时更新。'}</p></div><div class="aside-section"><h3 class="aside-title">与关注标的的关系 <span class="section-number">02</span></h3>${e.relations.map(r=>`<div class="relation"><div class="relation-head"><span>${esc(r.company)}</span></div><p>${esc(r.role)}</p><p>${esc(r.basis)}</p><button data-evidence="${esc(r.materialId)}">查看关系依据 ${icon('external')}</button></div>`).join('')||'<p class="aside-text">尚无经过核对的标的关系。提及公司不自动等于业务关联。</p>'}</div><div class="aside-section"><h3 class="aside-title">已收录最早来源 <span class="section-number">03</span></h3>${first?`<div class="source-origin"><strong>${esc(first.source)}</strong><p>${esc(fmt(first.publishedAt))}</p><button class="text-btn" data-evidence="${esc(first.id)}">回到原始材料</button></div>`:'<p class="aside-text">披露时间均缺失，无法判断。</p>'}<p class="aside-note">仅指当前资料库内最早，不代表全网首发。${e.isSynthetic?'本事件及来源均为构造。':''}</p></div><div class="aside-section"><h3 class="aside-title">四种信息，分别判断</h3><div class="legend">${Object.keys(KINDS).map(k=>badge(k)).join('')}</div><p class="aside-note">权重是可解释规则，不是真实性概率。转载不增加独立证据数。</p></div></aside>`;
}
function renderClaims(e,claims){
 const all=flatten(e);return `<div class="claim-list">${claims.map(c=>`<article class="claim-row" id="claim-${esc(c.id)}"><div class="claim-row-head"><h3>${esc(c.label)}</h3>${badge(c.status)}</div><p>${esc(c.reason)}</p><p>当前显示：<strong>${esc(c.status==='conflict'?'存在冲突，不能归一':`${c.value}${c.unit}`)}</strong> · ${c.independentCount} 个来源组</p>${c.rejectedUpdates.length?'<div class="info-callout">部分更新未达到覆盖条件（时间、范围或权重不足）。旧证据继续参与判断。</div>':''}<div class="claim-evidence">${all.filter(s=>s.claimId===c.id).map(s=>`<button data-evidence="${esc(s.material.id)}" class="${c.supersededIds.includes(s.id)?'obsolete':''}">${esc(s.material.source)} · ${esc(s.value)}${esc(s.unit)} ${c.supersededIds.includes(s.id)?'（历史版本）':!c.activeIds.includes(s.id)?'（适用期结束）':''}</button>`).join('')}</div></article>`).join('')}</div>`;
}
function histories(e){return e.materials.map((m,i)=>{const recorded=state.auditLog.find(a=>a.eventId===e.id&&a.materialId===m.id);return {material:m,before:snapshot({...e,materials:e.materials.slice(0,i)},m.ingestedAt),after:snapshot({...e,materials:e.materials.slice(0,i+1)},m.ingestedAt),at:m.ingestedAt,isUser:Boolean(recorded)};});}
function renderHistory(e){return histories(e).reverse().map(h=>{const changes=h.after.filter((a,i)=>JSON.stringify([a.status,a.value,a.unit,a.activeIds])!==JSON.stringify([h.before[i]?.status,h.before[i]?.value,h.before[i]?.unit,h.before[i]?.activeIds]));return `<article class="change-card"><div class="tag-row">${badge(h.isUser?'supported':'expired',h.isUser?'本次工作区录入':'内置样例录入')}${labelType(e)}</div><h3 class="mt10">${esc(h.material.title)}</h3><time>录入 ${esc(fmt(h.at,true))} · ${RULE_VERSION}</time>${changes.map(a=>{const b=h.before.find(c=>c.id===a.id);return `<p>${esc(a.label)}</p><div class="change-values"><span><strong>录入前 · ${esc(b?.labelStatus||'待核实')}</strong>${esc(displayClaim(b))}</span>${icon('arrow')}<span><strong>录入后 · ${esc(a.labelStatus)}</strong>${esc(displayClaim(a))}</span></div>`;}).join('')||'<p>未改变当前主张结论，仍保留本次录入与来源记录。</p>'}<button class="text-btn" data-evidence="${esc(h.material.id)}">查看触发证据 ${icon('arrow')}</button></article>`;}).join('')||'<p class="empty">暂无更新记录</p>';}
function renderSources(){
 const materials=state.events.flatMap(e=>e.materials.map(m=>({...m,event:e})));
 $('#alternate-view').innerHTML=`<div class="panel-top"><h2>数据接入与来源清单</h2><span class="tiny muted">${materials.length} 份材料</span></div><div class="info-callout">扶摇 / iFinD：尚未接入，未取得调用权限验证。模型：${config.aiConfigured?'服务端已配置，需实际调用验证':'未配置'}。手工录入可用，资料不会自动刷新。真实历史样例的资料截止日期为 2023-10-13。</div><table class="source-table"><thead><tr><th>资料类型</th><th>原始材料</th><th>核验与边界</th><th>来源入口</th></tr></thead><tbody>${materials.map(m=>`<tr><td>${labelType(m.event)}<p>${esc(SOURCE_TYPES[m.sourceType])}</p></td><td><strong>${esc(m.title)}</strong><p>${esc(m.source)} · ${esc(fmt(m.publishedAt))}</p></td><td>${esc(sourceMeta(m))}<p>${m.isSynthetic?'仅用于流程验证，无真实披露':m.sourceCheck==='curated'?'原始页面与摘录已人工核对；不保证实时完整':'用户提供，未独立核验'}</p></td><td><button class="text-btn" data-evidence="${esc(m.id)}">查看记录</button>${safeUrl(m.url)?`<a class="help-link" href="${esc(safeUrl(m.url))}" target="_blank" rel="noopener noreferrer">原始页面 ↗</a>`:''}</td></tr>`).join('')}</tbody></table>`;
}
function renderAllHistory(){ $('#alternate-view').innerHTML=`<h2>全部事件的录入与变化</h2><p class="muted tiny">记录按事件分组。内置样例与用户新增记录分别标记，前后结论由实际证据重算。</p>${state.events.map(e=>`<h3 class="mt26">${esc(e.title)}</h3>${renderHistory(e)}`).join('')}`; }
function openEvidence(id){
 let event,material;for(const e of state.events){const m=e.materials.find(m=>m.id===id);if(m){event=e;material=m;break;}}if(!material)return toast('该证据不在当前工作区',true);
 const claims=snapshot(event);const m=material;
 $('#evidence-dialog-content').innerHTML=`<div class="dialog-head"><div><div class="eyebrow">SOURCE / ${esc(m.id)}</div><h2 id="evidence-dialog-title">${esc(m.title)}</h2></div><button class="icon-btn" data-close="evidence-dialog" aria-label="关闭证据">${icon('close')}</button></div><div class="dialog-body"><div class="tag-row">${labelType(event)}${badge('expired',SOURCE_TYPES[m.sourceType])}</div><p class="tiny muted mt13">${esc(m.source)} · ${esc(sourceMeta(m))}</p>${m.url&&safeUrl(m.url)?`<a href="${esc(safeUrl(m.url))}" target="_blank" rel="noopener noreferrer">打开原始来源 ${icon('external')}</a>`:'<div class="info-callout">无外部原始链接。构造材料仅验证处理流程；用户材料缺链接时按低权重处理。</div>'}<h3 class="mt20">${m.isSynthetic?'构造原文':'已收录原文摘录'}</h3><div class="source-text">${esc(m.text)}</div>${!m.isSynthetic?'<p class="tiny muted mt7">仅保存必要摘录，并非原文全文；结论不得超出已核对范围。</p>':''}<dl class="time-grid"><div><dt>事件发生时间</dt><dd>${esc(fmt(m.occurredAt,true))}</dd></div><div><dt>披露时间</dt><dd>${esc(fmt(m.publishedAt,true))}</dd></div><div><dt>系统录入时间</dt><dd>${esc(fmt(m.ingestedAt,true))}</dd></div><div><dt>材料更新时间</dt><dd>${esc(fmt(m.updatedAt,true))}</dd></div></dl><p class="tiny muted">统一显示为北京时间；来源仅提供日期时保留日期精度。未提供的时间不作推算。</p><h3>逐条主张与权重依据</h3>${m.statements.map(s=>{const c=claims.find(c=>c.id===s.claimId);const w=weight(m,s);const t=flatten(event).find(t=>t.id===s.targetId);return `<div class="statement-detail"><div class="tag-row">${badge(s.kind)}${badge('expired',`${w.level}权重`)}${c?badge(c.status):''}</div><p><strong>${esc(c?.label)}</strong> · ${esc(s.value)}${esc(s.unit)}</p><blockquote class="review-quote">${esc(s.quote)}</blockquote><p>权重理由：${esc(w.reason)}</p><p>适用范围：${esc(s.scope)} · 有效期：${esc(fmt(s.validUntil))}</p>${t?`<p>指向证据：${esc(t.material.title)}（${esc(t.id)}）；${s.stance==='correct'?'更正':s.stance==='deny'?'否认':'更新'}关系。</p>`:''}${c?.supersededIds.includes(s.id)?'<p>此条已被符合条件的后续材料替代，保留为历史版本。</p>':''}</div>`;}).join('')}<div class="info-callout">来源组：${esc(m.independentGroup)}${m.derivedFrom?` · 转载自 ${esc(m.derivedFrom)}`:''}。同一原始来源的多次转载不视为多个独立佐证。</div></div><div class="dialog-foot"><button class="secondary" data-close="evidence-dialog">返回事件</button></div>`;
 $('#evidence-dialog').showModal();
}
const PRESETS={
 correction:{title:'公司更正海岬项目总投资金额',source:'构造公司更正公告',sourceType:'announcement',text:'澄明能源更正：海岬储能项目总投资应为8亿元，前次披露的10亿元系录入错误。框架协议签署状态不变。',publishedAt:'2026-10-24T18:00:00+08:00',isSynthetic:true,eventId:'evt-haijia',statements:[{claimId:'amount',quote:'海岬储能项目总投资应为8亿元，前次披露的10亿元系录入错误。',kind:'fact',stance:'correct',targetId:'en-a-amount',value:'8',unit:'亿元',scope:'整体',validUntil:null}]},
 denial:{title:'公司回应海岬项目业绩传闻',source:'构造公司说明',sourceType:'announcement',text:'澄明能源否认海岬储能项目将带来确定性业绩增长的传闻。项目尚需审批，无法承诺未来收益。',publishedAt:'2026-10-25T10:00:00+08:00',isSynthetic:true,eventId:'evt-haijia',statements:[{claimId:'earnings',quote:'澄明能源否认海岬储能项目将带来确定性业绩增长的传闻。',kind:'fact',stance:'deny',targetId:null,value:'否认确定性业绩增长',unit:'',scope:'整体',validUntil:null}]},
 unrelated:{title:'澄明能源另一项目进展',source:'构造公司说明',sourceType:'announcement',text:'澄明能源披露青原风电项目进入前期论证阶段。本说明不涉及海岬储能项目。',publishedAt:'2026-10-26T12:00:00+08:00',isSynthetic:true,eventId:'new',newSubject:'澄明能源',newObject:'青原风电项目',newType:'项目合作',statements:[{claimId:'new-main',quote:'澄明能源披露青原风电项目进入前期论证阶段。',kind:'fact',stance:'support',targetId:null,value:'进入前期论证阶段',unit:'',scope:'整体',validUntil:null}]}
};
function openMaterial(){
 draft={phase:'input',input:{title:'',source:'',sourceType:'news',url:'',text:'',publishedAt:'',occurredAt:'',updatedAt:'',isSynthetic:false,independentGroup:'',derivedFrom:''},preset:null,addedClaims:[],statements:[],eventId:selected,newTitle:'',newSubject:'',newObject:'',newType:'',mode:'rules',analyzedText:'',reviewed:false,error:'',busy:false};
 renderMaterial();$('#material-dialog').showModal();
}
function inputField(name,label,value,placeholder='',type='text',extra=''){return `<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" placeholder="${esc(placeholder)}" ${extra}></div>`;}
function selectOptions(map,value){return Object.entries(map).map(([k,v])=>`<option value="${esc(k)}" ${k===value?'selected':''}>${esc(v)}</option>`).join('');}
function syncInput(){if(!draft)return;const f=$('#material-form');if(!f)return;const d=new FormData(f);for(const k of ['title','source','sourceType','url','text','publishedAt','occurredAt','updatedAt','independentGroup'])draft.input[k]=String(d.get(k)||'');draft.input.isSynthetic=d.get('isSynthetic')==='on';}
function renderMaterial(){
 $('#material-dialog-content').innerHTML=`<div class="dialog-head"><div><div class="eyebrow">ADD EVIDENCE / ${draft.phase==='input'?'01':'02'}</div><h2 id="material-dialog-title">${draft.phase==='input'?'录入一份新的材料':'核对主张与事件归属'}</h2></div><button class="icon-btn" data-close="material-dialog" aria-label="关闭材料录入" ${draft.busy?'disabled':''}>${icon('close')}</button></div><div class="dialog-body"><div class="step-label"><strong>01 材料输入</strong>　→　<strong>02 核对与归属</strong>　→　03 更新结论</div><div id="form-error" class="form-error" role="alert" ${draft.error?'':'hidden'}>${esc(draft.error)}</div>${draft.phase==='input'?renderInput():renderReview()}</div><div class="dialog-foot">${draft.phase==='input'?`<button class="secondary" id="rule-analyze" ${draft.busy?'disabled':''}>${draft.busy?'分析中…':'规则分析 → 人工核对'}</button><button class="primary" id="ai-analyze" ${draft.busy?'disabled':''}>${draft.busy?'请稍候…':'AI 分析'}</button>`:`<button class="secondary" id="back-input">返回材料</button><button class="primary" id="commit-material">确认录入并更新结论</button>`}</div>`;
 paintIcons();
}
function renderInput(){
 const i=draft.input;return `<p class="tiny muted">仅录入你有权使用的资料。AI 未配置时可使用规则提取，所有建议都需要人工核对。</p><div class="example-list"><span class="tiny muted align-center">试一份构造材料：</span><button data-preset="correction">更正金额，解决冲突</button><button data-preset="denial">新增否认</button><button data-preset="unrelated">同公司不同项目</button></div><form id="material-form"><div class="form-grid">${inputField('title','材料标题 *',i.title,'如：关于项目投资额的更正说明','text','maxlength="500" required')}${inputField('source','发布者 / 来源 *',i.source,'填写原始发布主体','text','maxlength="500" required')}<div class="field"><label for="f-sourceType">来源类型</label><select id="f-sourceType" name="sourceType">${selectOptions(SOURCE_TYPES,i.sourceType)}</select></div>${inputField('url','原始来源链接',i.url,'https://…（缺失将降低权重）','url','maxlength="2000"')}<div class="field span-2"><label for="f-text">原文 / 摘录 * <small>8–12,000 字符，不能只有标题</small></label><textarea id="f-text" name="text" rows="5" maxlength="12000" required>${esc(i.text)}</textarea></div>${inputField('publishedAt','披露时间',i.publishedAt,'2026-10-30 或 2026-10-30T10:00:00+08:00')}${inputField('occurredAt','事件发生时间',i.occurredAt,'未知可留空；日期或带时区时间')}${inputField('updatedAt','材料更新时间',i.updatedAt,'未知可留空，不等于系统录入时间')}<div class="field"><label for="f-independentGroup">转载 / 来源组</label><select id="f-independentGroup" name="independentGroup"><option value="">独立材料（新来源组）</option>${state.events.flatMap(e=>e.materials).filter((m,i,all)=>all.findIndex(p=>p.independentGroup===m.independentGroup)===i).map(m=>`<option value="${esc(m.independentGroup)}" ${i.independentGroup===m.independentGroup?'selected':''}>同源：${esc(m.source)} · ${esc(m.title)}</option>`).join('')}</select></div></div><label class="check-label"><input name="isSynthetic" type="checkbox" ${i.isSynthetic?'checked':''}>此材料为构造数据（测试资料必须勾选）</label><p class="tiny muted">所有时间需保留原始精度；未填写的时间会显示缺失。录入时间由系统生成。</p></form>`;
}
function eventForDraft(){const base=draft.eventId==='new'?{id:'new',title:draft.newTitle,subject:draft.newSubject,object:draft.newObject,type:draft.newType,claims:[{id:'new-main',label:'事件进展'}],materials:[]}:state.events.find(e=>e.id===draft.eventId);return base?{...base,claims:[...base.claims,...draft.addedClaims]}:null;}
function renderReview(){
 const matches=candidates(draft.input.text,state.events);const e=eventForDraft();const prior=e?flatten(e):[];
 return `<div class="info-callout">${draft.mode==='ai'?`AI 已返回提取建议（${esc(draft.model||'未知模型')}）。`:'规则辅助结果，未调用 AI。关键词只能提供初步线索。'}请逐条核对分类、范围、事件归属与引用；确认后才写入工作区。</div>${matches.length?`<p class="tiny muted">匹配提示：${matches.map(m=>`${esc(m.title)}：${esc(m.reason)}`).join('<br>')}</p>`:'<p class="tiny muted">没有明确匹配事件，建议新建或人工选择。</p>'}<div class="field"><label for="review-event">归属事件 *</label><select id="review-event">${state.events.map(e=>`<option value="${esc(e.id)}" ${draft.eventId===e.id?'selected':''}>${esc(e.title)}</option>`).join('')}<option value="new" ${draft.eventId==='new'?'selected':''}>＋ 新建事件（不同项目或无法确认归属）</option></select></div>${draft.eventId==='new'?`<div class="form-grid">${inputField('newTitle','新事件标题 *',draft.newTitle,'概括具体事件','text','maxlength="500"')}${inputField('newSubject','主体公司 *',draft.newSubject,'如：澄明能源','text','maxlength="200"')}${inputField('newObject','事件对象 *',draft.newObject,'如：青原风电项目','text','maxlength="200"')}${inputField('newType','事件类型 *',draft.newType,'如：项目合作','text','maxlength="100"')}</div>`:''}<div class="form-grid"><div class="field"><label for="new-claim-label">需要分开核对其他事项？</label><input id="new-claim-label" placeholder="如：合同金额、交付日期" maxlength="100"></div><div class="align-center"><button class="secondary" id="add-claim">添加核对事项</button></div></div>${draft.statements.map((s,index)=>`<article class="review-card" data-review-index="${index}"><div class="review-card-head"><h3>主张 ${String(index+1).padStart(2,'0')}</h3><button class="text-btn" data-remove-statement="${index}">移除此条</button></div><blockquote class="review-quote">${esc(s.quote)}</blockquote><div class="review-grid"><div class="field"><label for="claim-${index}">核对事项</label><select id="claim-${index}" data-field="claimId">${(e?.claims||[]).map(c=>`<option value="${esc(c.id)}" ${s.claimId===c.id?'selected':''}>${esc(c.label)}</option>`).join('')}</select></div><div class="field"><label for="kind-${index}">信息类型</label><select id="kind-${index}" data-field="kind">${selectOptions(KINDS,s.kind)}</select></div><div class="field"><label for="stance-${index}">证据关系</label><select id="stance-${index}" data-field="stance">${selectOptions({support:'支持 / 新陈述',deny:'否认',correct:'更正旧证据',update:'更新旧证据'},s.stance)}</select></div></div><div class="form-grid">${reviewField(index,'value','主张值 *（数字保持原单位）',s.value)}${reviewField(index,'unit','单位（原文有数字时明确填写）',s.unit)}${reviewField(index,'scope','适用范围 *',s.scope)}${reviewField(index,'validUntil','适用期截止（可留空）',s.validUntil||'')}<div class="field span-2"><label for="target-${index}">指向的旧证据（更正/更新必须选择）</label><select id="target-${index}" data-field="targetId"><option value="">无 / 新增陈述</option>${prior.filter(p=>p.claimId===s.claimId).map(p=>`<option value="${esc(p.id)}" ${s.targetId===p.id?'selected':''}>${esc(p.material.source)}：${esc(p.value)}${esc(p.unit)} · ${esc(p.scope)}</option>`).join('')}</select></div></div></article>`).join('')}<label class="check-label"><input id="review-confirm" type="checkbox" ${draft.reviewed?'checked':''}>我已核对原文引用、信息分类、主张值与事件归属；事实陈述不等于已证实，且材料不含敏感数据。</label><p class="tiny muted">用户提供材料不会自动获得已核验来源标记；同一来源的重复转载请返回上一步设置来源组。</p>`;
}
function reviewField(index,field,label,value){return `<div class="field"><label for="review-${field}-${index}">${label}</label><input id="review-${field}-${index}" data-field="${field}" value="${esc(value)}" maxlength="${field==='value'?500:field==='unit'?40:500}"></div>`;}
function syncReview(){
 if(!draft||draft.phase!=='review')return;
 draft.eventId=$('#review-event').value;
 for(const key of ['newTitle','newSubject','newObject','newType'])if($(`#f-${key}`))draft[key]=$(`#f-${key}`).value;
 $$('[data-review-index]').forEach(el=>{const s=draft.statements[Number(el.dataset.reviewIndex)];$$('[data-field]',el).forEach(f=>s[f.dataset.field]=f.value||(['targetId','validUntil'].includes(f.dataset.field)?null:''));});
 draft.reviewed=$('#review-confirm').checked;
}
async function analyze(mode){
 syncInput();draft.error='';
 try{
  const i=draft.input;
  if(!i.title.trim()||!i.source.trim())throw new Error('请填写材料标题和发布者');
  if(i.title.length>500||i.source.length>500)throw new Error('标题或发布者过长');
  if(i.url&&!safeUrl(i.url))throw new Error('来源链接必须为 HTTP/HTTPS 地址');
  for(const t of ['publishedAt','occurredAt','updatedAt'])if(!validTime(i[t]))throw new Error('时间无效。请用 YYYY-MM-DD 或带时区的 ISO 时间，如 2026-10-30T10:00:00+08:00');
  if(i.updatedAt&&i.publishedAt&&Date.parse(i.updatedAt)<Date.parse(i.publishedAt))throw new Error('材料更新时间不能早于披露时间');
  if(state.events.some(e=>e.materials.some(m=>fingerprint(m.text)===fingerprint(i.text))))throw new Error('检测到重复原文，当前工作区已收录这份材料');
  let statements=ruleDraft(i.text);if(!statements.length)throw new Error('原文无法提取完整主张，请补充正文。');
  let suggested=null;
  if(mode==='ai'){
   draft.busy=true;renderMaterial();
   const response=await fetch('/api/analyze',{method:'POST',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(30000),body:JSON.stringify({text:i.text,events:state.events.map(e=>({id:e.id,title:e.title}))})});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'AI 调用失败，现有结论未改变');
   statements=data.statements;draft.model=data.model;draft.promptVersion=data.promptVersion;suggested=data.eventId;
  }
  const preset=draft.preset&&PRESETS[draft.preset];
  const matches=candidates(i.text,state.events);
  draft.eventId=preset?preset.eventId:suggested||matches.find(m=>m.score>=7)?.id||'new';
  if(preset){draft.newSubject=preset.newSubject||'';draft.newObject=preset.newObject||'';draft.newType=preset.newType||'';draft.newTitle=preset.newObject?`${preset.newSubject} · ${preset.newObject}`:'';}
  const e=eventForDraft();
  draft.statements=(preset&&i.text===preset.text?structuredClone(preset.statements):statements).map(s=>({...s,id:uid('statement'),claimId:s.claimId||(e?.claims.find(c=>/金额|投资/.test(c.label)&&/亿元|万元|金额|投资/.test(s.quote))?.id||e?.claims.find(c=>/业绩/.test(c.label)&&/业绩|收益|业务结构/.test(s.quote))?.id||e?.claims[0].id||'new-main'),unit:s.unit||'',scope:s.scope||'整体'}));
  draft.mode=mode;draft.analyzedText=i.text;draft.phase='review';draft.reviewed=false;
 }catch(e){draft.error=e.name==='TimeoutError'?'分析超时，请重试或使用规则分析。':e.message;}
 finally{draft.busy=false;renderMaterial();if(draft.error)$('#form-error').scrollIntoView({block:'nearest'});}
}
function commit(){
 syncReview();draft.error='';
 try{
  if(!draft.reviewed)throw new Error('请先勾选已核对原文与事件归属');
  if(!draft.statements.length)throw new Error('至少保留一条有效主张');
  const next=structuredClone(state);let event=next.events.find(e=>e.id===draft.eventId);
  if(draft.eventId==='new'){
   for(const key of ['newTitle','newSubject','newObject','newType'])if(!draft[key].trim())throw new Error('请完整填写新事件标题、主体公司、事件对象与类型');
   event={id:uid('evt'),title:draft.newTitle,subject:draft.newSubject,object:draft.newObject,type:draft.newType,aliases:[],scope:draft.input.isSynthetic?'用户构造案例':'用户录入 · 待独立核验',isSynthetic:draft.input.isSynthetic,claims:[{id:'new-main',label:'事件进展'}],materials:[],relations:[]};next.events.push(event);
  }
  if(!event)throw new Error('未找到归属事件');
  event.claims.push(...structuredClone(draft.addedClaims));
  // Avoid mixing real and synthetic material into a single event without a clear boundary.
  if(Boolean(event.isSynthetic)!==draft.input.isSynthetic)throw new Error('真实与构造材料不能合并到同一事件。请更改材料标记或新建独立事件。');
  const preset=draft.preset&&PRESETS[draft.preset];
  const coreFields=['title','source','sourceType','text','publishedAt','isSynthetic'];
  const verifiedPreset=preset&&coreFields.every(k=>preset[k]===draft.input[k])&&!draft.input.url&&!draft.input.independentGroup&&!draft.input.updatedAt&&!draft.input.occurredAt&&draft.eventId===preset.eventId&&JSON.stringify(draft.statements.map(({id,text,...s})=>s))===JSON.stringify(preset.statements.map(s=>({ ...s })));
  const material={...draft.input,id:uid('material'),ingestedAt:new Date().toISOString(),sourceCheck:verifiedPreset?'curated':'user',independentGroup:draft.input.independentGroup||uid('origin'),derivedFrom:draft.input.independentGroup?state.events.flatMap(e=>e.materials).find(m=>m.independentGroup===draft.input.independentGroup)?.id:null,statements:draft.statements.map(s=>({...s,text:s.quote,unit:s.unit||'',validUntil:s.validUntil||null,targetId:s.targetId||null})),analysis:{mode:draft.mode,model:draft.mode==='ai'?draft.model:null,promptVersion:draft.mode==='ai'?draft.promptVersion:null,reviewed:true}};
  const result=addMaterial(event,material);next.events=next.events.map(e=>e.id===event.id?result.event:e);next.auditLog.push(result.change);
  if(save(next)) {selected=event.id;replay=null;tab='timeline';view='events';$('#material-dialog').close();render();toast('材料已保存，主张结论已重新计算。');}
 }catch(e){draft.error=e.message;renderMaterial();$('#form-error').scrollIntoView({block:'nearest'});}
}
function exportWorkspace(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`TRACE-工作区-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('工作区已导出，内含原文，请妥善保存。');}
// All interpolated source text is HTML-escaped. No source HTML is executed.
document.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b||b.disabled)return;
 if(b.dataset.close){$('#'+b.dataset.close).close();return;}
 if(b.dataset.event){selected=b.dataset.event;replay=null;tab='timeline';renderDetail();renderList();return;}
 if(b.dataset.evidence){openEvidence(b.dataset.evidence);return;}
 if(b.dataset.tab){tab=b.dataset.tab;renderDetail();return;}
 if(b.dataset.claim){tab='claims';renderDetail();$(`#claim-${CSS.escape(b.dataset.claim)}`)?.scrollIntoView({block:'nearest'});return;}
 if(b.dataset.view){view=b.dataset.view;render();return;}
 if(b.dataset.filter){filter=b.dataset.filter;$$('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderList();return;}
 if(b.dataset.preset){syncInput();const p=PRESETS[b.dataset.preset];draft.input={title:p.title,source:p.source,sourceType:p.sourceType,url:'',text:p.text,publishedAt:p.publishedAt,occurredAt:'',updatedAt:'',independentGroup:'',derivedFrom:'',isSynthetic:p.isSynthetic};draft.preset=b.dataset.preset;draft.error='';renderMaterial();return;}
 if(b.dataset.removeStatement!==undefined){syncReview();draft.statements.splice(Number(b.dataset.removeStatement),1);draft.reviewed=false;renderMaterial();return;}
 const actions={'help-button':()=>$('#info-dialog').showModal(),'method-button':()=>$('#info-dialog').showModal(),'add-button':openMaterial,'export-button':exportWorkspace,'import-button':()=>$('#import-file').click(),'reset-button':()=>$('#confirm-dialog').showModal(),'confirm-reset':()=>{if(save(structuredClone(seed))){selected=state.events[0].id;replay=null;$('#confirm-dialog').close();render();toast('已恢复内置样例。');}},'add-claim':()=>{syncReview();const name=$('#new-claim-label').value.trim();if(!name)return toast('请填写新核对事项名称',true);if(eventForDraft().claims.some(c=>c.label===name))return toast('该核对事项已存在',true);draft.addedClaims.push({id:uid('claim'),label:name});draft.reviewed=false;renderMaterial();},'rule-analyze':()=>analyze('rules'),'ai-analyze':()=>analyze('ai'),'commit-material':commit,'back-input':()=>{syncReview();draft.phase='input';draft.error='';renderMaterial();},'exit-replay':()=>{replay=null;renderDetail();}};
 actions[b.id]?.();
});
document.addEventListener('change',event=>{
 const t=event.target;
 if(t.id==='time-sort'){sort=t.value;renderDetail();}
 if(t.id==='replay-select'){replay=t.value==='all'?null:Number(t.value);renderDetail();}
 if(t.id==='review-event'){syncReview();const e=eventForDraft();draft.statements.forEach(s=>{s.claimId=e.claims[0].id;s.targetId=null;});draft.reviewed=false;renderMaterial();}
 if(t.dataset.field){const row=t.closest('[data-review-index]');syncReview();if(t.dataset.field==='claimId'){draft.statements[Number(row.dataset.reviewIndex)].targetId=null;renderMaterial();}}
});
$('#event-search').addEventListener('input',e=>{search=e.target.value;renderList();});
$('#import-file').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>2000000)throw new Error('文件超过 2 MB 上限');const imported=validateWorkspace(JSON.parse(await file.text()));if(save(imported)){selected=state.events[0].id;replay=null;render();toast('已恢复导入工作区，结论根据证据重新计算。');}}catch(error){toast(`导入失败，当前数据未改变：${error.message}`,true);}finally{e.target.value='';}});
document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!$$('dialog[open]').length){e.preventDefault();$('#event-search').focus();}});
// Native dialogs provide Escape, focus containment and focus restoration.
async function init(){
 try{
  const response=await fetch('/seed.json');if(!response.ok)throw new Error('样例资料加载失败');seed=validateWorkspace(await response.json());
  try{const saved=localStorage.getItem(STORAGE);state=saved?validateWorkspace(JSON.parse(saved)):structuredClone(seed);}catch(e){state=structuredClone(seed);storageAvailable=false;toast('本地记录不可读取或格式损坏，已载入内置样例；原记录未覆盖。可导出本次工作区。',true);}
  selected=state.events[0].id;render();
  try{const r=await fetch('/api/config');if(!r.ok)throw new Error();config=await r.json();$('#model-status').textContent=config.aiConfigured?'AI 服务端已配置':'AI 未配置';}catch{$('#model-status').textContent='AI 配置状态未知';toast('无法读取服务配置，规则分析仍可使用。',true);}
  if(!storageAvailable)$('#save-indicator').textContent='存储异常，需导出备份';
 }catch(e){$('#content').innerHTML=`<div class="initial-error" role="alert"><h2>工作区未能载入</h2><p>${esc(e.message)}</p><button class="secondary" id="reload-app">重新加载</button></div>`;$('#reload-app').onclick=()=>location.reload();$('#add-button').disabled=true;}
}
init();
