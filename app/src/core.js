/** Shared browser/server domain logic. No provider or browser dependencies. */
export const RULE_VERSION = 'claims-v1.0';
export const KINDS = { fact: '事实陈述', opinion: '观点', inference: '推测', rumor: '传闻' };
export const SOURCE_TYPES = { announcement: '公司公告', regulator: '监管披露', news: '新闻报道', research: '研究观点', social: '社交传闻' };
export const STATUS = { supported: '有直接依据', denied: '存在否认', conflict: '证据冲突', pending: '待核实', expired: '适用期已结束' };
export function invariant(ok, message) { if (!ok) throw new Error(message); }
export function uid(prefix = 'id') { return `${prefix}-${crypto.randomUUID()}`; }
export function safeUrl(value) { try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password ? u.href : ''; } catch { return ''; } }
export function validTime(v) { if (v === null || v === '' || v === undefined) return true; if (typeof v !== 'string') return false; if (/^\d{4}-\d{2}-\d{2}$/.test(v)) { const t = new Date(`${v}T00:00:00Z`); return !isNaN(t) && t.toISOString().slice(0, 10) === v; } return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && validTime(v.slice(0, 10)) && !isNaN(Date.parse(v)); }
export function normalize(text) { return String(text).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, ''); }
export function fingerprint(text) { return String(text).normalize('NFKC').toLowerCase().replace(/\s+/gu, ''); }
export function restrictedClaim(text) { return /建议.{0,8}(买入|卖出)|保证.{0,8}(收益|上涨|下跌)|稳赚|必涨|必跌|确定.{0,4}(涨停|跌停)|guaranteed return|should buy|should sell/i.test(text) && !/不构成|不得|不能保证|否认|不承诺/.test(text); }
export function weight(material, statement) {
  if (statement.kind !== 'fact') return { level: '低', rank: 1, reason: '观点、推测或传闻不直接证明事件事实' };
  if (!material.url && !material.isSynthetic) return { level: '低', rank: 1, reason: '缺少可核对的原始来源链接' };
  if (['announcement', 'regulator'].includes(material.sourceType) && material.sourceCheck === 'curated') return { level: '高', rank: 3, reason: material.isSynthetic ? '构造情境内的直接原始材料；不代表真实披露' : '已人工核对的公司或监管原始披露；仅适用于本主张' };
  return { level: '中', rank: 2, reason: material.sourceCheck === 'curated' ? '有来源记录的间接材料，需结合原始披露' : '用户提供的来源，尚未经独立核验；选择公告类型不自动获得高权重' };
}
export function flatten(event) { return event.materials.flatMap(m => m.statements.map(s => ({ ...s, material: m, weight: weight(m, s) }))); }
export function validateMaterial(m, event, existing = true) {
  invariant(m && typeof m === 'object', '材料格式无效');
  for (const key of ['id', 'title', 'source', 'text', 'independentGroup']) invariant(typeof m[key] === 'string' && m[key].trim() && m[key].length <= (key === 'text' ? 12000 : 500), `材料字段 ${key} 缺失或过长`);
  invariant(m.text.trim().length >= 8, '原文至少需要 8 个字符');
  invariant(Object.hasOwn(SOURCE_TYPES, m.sourceType), '来源类型无效');
  invariant(!m.url || safeUrl(m.url), '来源链接必须为 HTTP/HTTPS 地址');
  invariant(['curated', 'user'].includes(m.sourceCheck), '来源核验标记无效');
  invariant(typeof m.isSynthetic === 'boolean', '缺少真实/构造标记');
  for (const key of ['publishedAt', 'occurredAt', 'updatedAt', 'ingestedAt']) invariant(validTime(m[key]), `${key} 时间无效或缺少时区`);
  invariant(m.ingestedAt, '录入时间不可缺失');
  invariant(!m.updatedAt || !m.publishedAt || Date.parse(m.updatedAt) >= Date.parse(m.publishedAt), '材料更新时间早于披露时间，请核对');
  invariant(Array.isArray(m.statements) && m.statements.length > 0 && m.statements.length <= 20, '每份材料需有 1–20 条主张');
  const prior = flatten(event);
  const seen = new Set(prior.map(s => s.id));
  if (existing) invariant(!event.materials.some(x => x.id === m.id), '材料编号重复');
  for (const s of m.statements) {
    invariant(typeof s.id === 'string' && !seen.has(s.id), '主张证据编号重复'); seen.add(s.id);
    invariant(event.claims.some(c => c.id === s.claimId), '未找到对应的事件主张');
    invariant(typeof s.text === 'string' && s.text.trim() && s.text.length <= 2000, '主张正文缺失或过长');
    invariant(Object.hasOwn(KINDS, s.kind), '信息类型无效');
    invariant(s.kind !== 'fact' || !restrictedClaim(s.value), '买卖建议或确定性收益承诺不能作为事实结论');
    invariant(typeof s.quote === 'string' && s.quote.length >= 2 && m.text.includes(s.quote), '引用必须逐字出现在材料原文中');
    invariant(['support', 'deny', 'correct', 'update'].includes(s.stance), '证据关系无效');
    invariant(typeof s.value === 'string' && s.value.trim() && s.value.length <= 500, '请填写用于核对的主张值');
    if (/^-?\d+(?:\.\d+)?$/.test(s.value)) invariant((s.quote.match(/-?\d+(?:[,.]\d+)*/g) || []).some(n => Number(n.replaceAll(',', '')) === Number(s.value)), '数字主张值无法在引用原文定位');
    invariant(typeof s.scope === 'string' && s.scope.trim() && s.scope.length <= 500, '请注明适用范围');
    invariant(validTime(s.validUntil), '有效期时间格式无效');
    if (s.unit) invariant(typeof s.unit === 'string' && s.unit.length <= 40 && s.quote.includes(s.unit), '单位必须出现在引用原文中');
    if (s.stance === 'correct' || s.stance === 'update') {
      const t = prior.find(p => p.id === s.targetId);
      invariant(t && t.claimId === s.claimId, '更新/更正必须指向同一主张的已有证据');
      invariant(t.scope === s.scope, '更新/更正的适用范围必须与目标一致');
      invariant(s.kind === 'fact', '观点、推测或传闻不能覆盖事实版本');
    } else if (s.targetId) {
      invariant(prior.some(p => p.id === s.targetId && p.claimId === s.claimId), '关系指向的证据不在同一主张中');
    }
  }
  return m;
}
export function snapshot(event, asOf = new Date().toISOString()) {
  const all = flatten(event);
  const superseded = new Set();
  const rejected = [];
  for (const s of all) if (['update', 'correct'].includes(s.stance)) {
    const target = all.find(t => t.id === s.targetId);
    const isLater = target && s.material.publishedAt && target.material.publishedAt && Date.parse(s.material.updatedAt || s.material.publishedAt) >= Date.parse(target.material.updatedAt || target.material.publishedAt);
    if (target && target.claimId === s.claimId && target.scope === s.scope && s.kind === 'fact' && s.weight.rank >= target.weight.rank && isLater) superseded.add(target.id);
    else rejected.push(s.id);
  }
  return event.claims.map(claim => {
    const evidence = all.filter(s => s.claimId === claim.id);
    const active = evidence.filter(s => !superseded.has(s.id));
    const current = active.filter(s => !s.validUntil || Date.parse(s.validUntil.length === 10 ? `${s.validUntil}T23:59:59.999+08:00` : s.validUntil) >= Date.parse(asOf));
    const direct = current.filter(s => s.kind === 'fact' && s.weight.rank >= 2 && ['announcement', 'regulator'].includes(s.material.sourceType));
    const scope = [...new Set(direct.map(s => s.scope))];
    const conflict = scope.some(sc => new Set(direct.filter(s => s.scope === sc && s.stance !== 'deny').map(s => fingerprint(s.value) + '|' + fingerprint(s.unit || ''))).size > 1 || (direct.some(s => s.scope === sc && s.stance === 'deny') && direct.some(s => s.scope === sc && s.stance !== 'deny')));
    let status = !current.length && active.length ? 'expired' : conflict ? 'conflict' : direct.some(s => s.stance === 'deny') ? 'denied' : direct.length ? 'supported' : 'pending';
    const latest = [...current].sort((a, b) => Date.parse(b.material.updatedAt || b.material.publishedAt || 0) - Date.parse(a.material.updatedAt || a.material.publishedAt || 0));
    const selected = (direct.length ? [...direct].sort((a, b) => b.weight.rank - a.weight.rank || latest.indexOf(a) - latest.indexOf(b)) : latest)[0];
    const groups = [...new Set(current.map(s => s.material.independentGroup))];
    const alternatives = [...new Set(direct.filter(s => s.stance !== 'deny').map(s => `${s.value}${s.unit || ''}（${s.scope}）`))];
    return { ...claim, status, labelStatus: STATUS[status], value: selected?.value || '暂无可用结论', unit: selected?.unit || '', scope: selected?.scope || '', alternatives, evidenceIds: evidence.map(s => s.id), activeIds: current.map(s => s.id), supersededIds: evidence.filter(s => superseded.has(s.id)).map(s => s.id), independentCount: groups.length, rejectedUpdates: rejected.filter(id => evidence.some(s => s.id === id)), reason: status === 'conflict' ? '同一适用范围存在相反事实陈述或不同数值，需人工核对。' : status === 'denied' ? '已收录直接否认陈述；否认本身不等于客观事实已查明。' : status === 'supported' ? '存在可定位的直接事实陈述；仍受来源核验和适用范围约束。' : status === 'expired' ? '证据的适用期已结束，不代表历史事实为假。' : '现有信息不足以核实，观点、推测和传闻不构成事实确认。' };
  });
}
export function eventState(event, asOf) { const claims = snapshot(event, asOf); return claims.some(c => c.status === 'conflict') ? 'conflict' : claims.some(c => c.status === 'denied') ? 'denied' : claims.every(c => c.status === 'supported') ? 'supported' : claims.every(c => c.status === 'expired') ? 'expired' : 'pending'; }
export function addMaterial(event, material) {
  validateMaterial(material, event);
  invariant(!event.materials.some(m => fingerprint(m.text) === fingerprint(material.text)), '检测到重复原文，本次未重复录入');
  const before = snapshot(event, material.ingestedAt);
  const next = { ...event, materials: [...event.materials, material] };
  const after = snapshot(next, material.ingestedAt);
  return { event: next, change: { id: uid('change'), eventId: event.id, materialId: material.id, at: material.ingestedAt, ruleVersion: RULE_VERSION, before, after } };
}
export function candidates(text, events) {
  const n = normalize(text);
  return events.map(e => {
    const subject = [e.subject, ...(e.aliases || [])].filter(Boolean).some(a => n.includes(normalize(a)));
    const objectName = normalize(e.object || '');
    const object = Boolean(objectName && n.includes(objectName) && !['不涉及', '无关'].some(prefix => n.includes(prefix + objectName)));
    const category = Boolean(e.type && n.includes(normalize(e.type)));
    return { id: e.id, title: e.title, score: (subject ? 3 : 0) + (object ? 4 : 0) + (category ? 1 : 0), reason: `${subject ? '主体匹配' : '主体未明确'} · ${object ? '事件对象匹配' : '对象未匹配'}；${subject && object ? '建议复核后合并' : '证据不足，勿自动合并'}` };
  }).filter(e => e.score >= 3).sort((a, b) => b.score - a.score);
}
export function ruleDraft(text) {
  invariant(typeof text === 'string' && text.trim().length >= 8, '请提供至少 8 个字符的原文');
  invariant(text.length <= 12000, '原文最多 12,000 字符，请拆分材料');
  return text.split(/(?<=[。！？!?\n])/u).map(t => t.trim()).filter(t => t.length >= 5).slice(0, 8).map(quote => {
    const kind = restrictedClaim(quote) ? 'opinion' : /传闻|网传|据传|rumou?r|未经证实/i.test(quote) ? 'rumor' : /认为|看好|观点|建议|believe/i.test(quote) ? 'opinion' : /预计|可能|或将|有望|预期|could|expect|may\b/i.test(quote) ? 'inference' : 'fact';
    const stance = /否认|尚未签署|不属实|未签订|denied|not signed/i.test(quote) ? 'deny' : /更正|修正|corrected/i.test(quote) ? 'correct' : /更新|改为|现已|approved|cleared/i.test(quote) ? 'update' : 'support';
    return { id: uid('statement'), quote, text: quote, kind, stance, value: quote, unit: '', scope: '整体', validUntil: null, targetId: null };
  });
}
export function validateWorkspace(w) {
  invariant(w?.version === 1 && Array.isArray(w.events) && w.events.length > 0 && w.events.length <= 50 && Array.isArray(w.auditLog), '工作区文件格式不正确');
  invariant(JSON.stringify(w).length <= 2000000, '工作区超过 2 MB 上限');
  const eventIds = new Set();
  for (const e of w.events) {
    for (const key of ['id', 'title', 'subject', 'object', 'type', 'scope']) invariant(typeof e[key] === 'string' && e[key].length <= 500, '事件字段无效');
    invariant(e.id && !eventIds.has(e.id), '事件编号重复'); eventIds.add(e.id);
    invariant(typeof e.isSynthetic === 'boolean', '事件缺少真实/构造标记');
    invariant(Array.isArray(e.claims) && e.claims.length > 0 && e.claims.length <= 30, '事件主张结构无效');
    const claimIds = new Set();
    for (const c of e.claims) { invariant(typeof c.id === 'string' && !claimIds.has(c.id) && typeof c.label === 'string' && c.label.length <= 500, '主张定义无效'); claimIds.add(c.id); }
    invariant(Array.isArray(e.materials) && e.materials.length <= 200, '事件材料结构无效');
    invariant(Array.isArray(e.relations) && Array.isArray(e.aliases), '事件关系结构无效');
    const partial = { ...e, materials: [] };
    for (const m of e.materials) { validateMaterial(m, partial); invariant(m.isSynthetic === e.isSynthetic, '真实与构造材料不能混在同一事件'); invariant(!partial.materials.some(p => fingerprint(p.text) === fingerprint(m.text)), '工作区包含重复原文'); partial.materials.push(m); }
    for (const r of e.relations) invariant(typeof r.company === 'string' && typeof r.role === 'string' && typeof r.basis === 'string' && e.materials.some(m => m.id === r.materialId), '标的关系缺少可定位依据');
  }
  // Imported audit summaries are untrusted: reconstruct snapshots from actual materials.
  w.auditLog = w.auditLog.filter(a => w.events.some(e => e.id === a.eventId && e.materials.some(m => m.id === a.materialId))).slice(-500).map(a => {
    const e = w.events.find(e => e.id === a.eventId); const index = e.materials.findIndex(m => m.id === a.materialId);
    return { id: typeof a.id === 'string' ? a.id : uid('change'), eventId: e.id, materialId: e.materials[index].id, at: e.materials[index].ingestedAt, ruleVersion: RULE_VERSION, before: snapshot({ ...e, materials: e.materials.slice(0, index) }, e.materials[index].ingestedAt), after: snapshot({ ...e, materials: e.materials.slice(0, index + 1) }, e.materials[index].ingestedAt) };
  });
  return w;
}
export function freshness(event, now = Date.now()) { const times = event.materials.map(m => m.updatedAt || m.publishedAt).filter(Boolean).map(Date.parse); const last = times.length ? Math.max(...times) : null; return { last, stale: !last || now - last > 30 * 86400000, days: last ? Math.floor((now - last) / 86400000) : null }; }
