import { writeFile } from 'node:fs/promises';
const captured = '2026-10-30T14:10:00Z';
const s = (id, claimId, text, value, extra = {}) => ({ id, claimId, text, value, quote: text, kind: 'fact', stance: 'support', scope: '整体', unit: '', targetId: null, validUntil: null, ...extra });
const m = (id, title, source, sourceType, text, publishedAt, statements, extra = {}) => ({ id, title, source, sourceType, text, publishedAt, occurredAt: null, updatedAt: null, ingestedAt: captured, independentGroup: id, url: '', sourceCheck: 'curated', isSynthetic: true, statements, ...extra });
const energy = {
 id: 'evt-haijia', title: '海岬储能项目合作与投资口径', subject: '澄明能源', object: '海岬储能项目', type: '项目合作', aliases: ['澄明'], scope: '构造案例 · 无真实证券代码', isSynthetic: true,
 claims: [{id:'agreement',label:'协议签署状态'},{id:'amount',label:'项目总投资口径'},{id:'earnings',label:'业绩影响判断'}],
 relations: [{company:'澄明能源',role:'项目合作主体',basis:'构造公告中披露签署框架协议',materialId:'en-ann'},{company:'海岬产业发展',role:'交易对方',basis:'构造合作方说明中的项目参与方',materialId:'en-counter'}],
 materials: [
  m('en-rumor','社交平台出现项目合作传闻','构造社交帖','social','网传澄明能源已签署海岬储能项目协议，总投资10亿元。未经证实。','2026-10-21T09:00:00+08:00',[s('en-r-agreement','agreement','网传澄明能源已签署海岬储能项目协议，总投资10亿元。','已签署框架协议',{kind:'rumor'}),s('en-r-amount','amount','网传澄明能源已签署海岬储能项目协议，总投资10亿元。','10',{kind:'rumor',unit:'亿元'})]),
  m('en-repost','资讯站转载同一传闻','构造资讯站','news','转载构造社交帖：网传澄明能源已签署海岬储能项目协议，总投资10亿元；仍待公告确认。','2026-10-21T10:30:00+08:00',[s('en-rp-amount','amount','网传澄明能源已签署海岬储能项目协议，总投资10亿元；','10',{kind:'rumor',unit:'亿元'})],{independentGroup:'en-rumor',derivedFrom:'en-rumor'}),
  m('en-ann','公司披露框架协议，投资口径为10亿元','构造公司公告','announcement','澄明能源已签署海岬储能项目框架协议。项目总投资10亿元，尚需履行后续审批，框架协议不构成业绩承诺。','2026-10-22T18:00:00+08:00',[s('en-a-agreement','agreement','澄明能源已签署海岬储能项目框架协议。','已签署框架协议'),s('en-a-amount','amount','项目总投资10亿元，尚需履行后续审批，框架协议不构成业绩承诺。','10',{unit:'亿元'})],{occurredAt:'2026-10-22'}),
  m('en-counter','合作方披露投资额8亿元，口径出现冲突','构造合作方说明','announcement','海岬产业发展说明：参与的海岬储能项目总投资8亿元，为项目整体计划金额，仍待审批。','2026-10-23T10:00:00+08:00',[s('en-c-amount','amount','参与的海岬储能项目总投资8亿元，为项目整体计划金额，仍待审批。','8',{unit:'亿元'})]),
  m('en-research','研究观点讨论未来业绩影响','构造研究札记','research','我们认为海岬储能项目有望改善澄明能源未来业务结构，但项目审批、建设和收入确认仍有不确定性。','2026-10-23T15:30:00+08:00',[s('en-view','earnings','我们认为海岬储能项目有望改善澄明能源未来业务结构，但项目审批、建设和收入确认仍有不确定性。','有望改善业务结构，尚未核实',{kind:'opinion'})])
 ]
};
const medical = {
 id:'evt-lichen',title:'临川一期采购传闻与否认',subject:'临川医疗',object:'一期采购项目',type:'采购合同',aliases:['临川'],scope:'构造案例 · 否认与有效期边界',isSynthetic:true,
 claims:[{id:'purchase',label:'采购合同是否签订'},{id:'window',label:'意向沟通有效期'}],
 relations:[{company:'临川医疗',role:'传闻涉及主体',basis:'构造公司澄清材料明确回应该采购事项',materialId:'med-deny'}],
 materials:[m('med-rumor','一期采购项目签约传闻','构造社交帖','social','网传临川医疗已签订一期采购项目合同，金额尚不明确。','2026-10-18T08:30:00+08:00',[s('med-r','purchase','网传临川医疗已签订一期采购项目合同，金额尚不明确。','已签订采购合同',{kind:'rumor'})]),m('med-deny','公司称尚未签订采购合同','构造公司澄清','announcement','截至本说明披露日，临川医疗尚未签订一期采购项目合同。双方意向沟通有效期至2026年10月20日，期满不代表永久停止合作。','2026-10-19T12:00:00+08:00',[s('med-d','purchase','临川医疗尚未签订一期采购项目合同。','尚未签订采购合同',{stance:'deny'}),s('med-window','window','双方意向沟通有效期至2026年10月20日，期满不代表永久停止合作。','意向沟通窗口',{validUntil:'2026-10-20'})])]
};
const ms = {
 id:'evt-msft',title:'微软收购动视暴雪：监管与交割进程',subject:'微软',object:'动视暴雪',type:'并购',aliases:['Microsoft','MSFT','Activision'],scope:'真实历史案例 · 资料截至 2023-10-13，非实时新闻',isSynthetic:false,
 claims:[{id:'deal',label:'交易计划'},{id:'uk',label:'英国监管进展'},{id:'closed',label:'交易交割状态'}],
 relations:[{company:'微软 · MSFT',role:'收购方',basis:'微软原始披露宣布拟收购动视暴雪',materialId:'ms-plan'},{company:'动视暴雪 · 原 ATVI',role:'被收购方（历史标的）',basis:'Xbox 原始披露欢迎动视暴雪团队加入',materialId:'ms-close'}],
 materials:[
 m('ms-plan','微软宣布拟收购动视暴雪','Microsoft Source','announcement','Microsoft will acquire Activision Blizzard for $95.00 per share, in an all-cash transaction valued at $68.7 billion,','2022-01-18',[s('ms-plan-s','deal','Microsoft will acquire Activision Blizzard for $95.00 per share, in an all-cash transaction valued at $68.7 billion,','宣布收购计划；原始披露估值687亿美元（包含净现金）')],{isSynthetic:false,url:'https://news.microsoft.com/source/2022/01/18/microsoft-to-acquire-activision-blizzard-to-bring-the-joy-and-community-of-gaming-to-everyone-across-every-device/'}),
 m('ms-block','CMA 阻止原交易方案','英国竞争与市场管理局 CMA','regulator','The CMA has prevented Microsoft’s proposed purchase of Activision over concerns the deal would alter the future','2023-04-26',[s('ms-block-s','uk','The CMA has prevented Microsoft’s proposed purchase of Activision over concerns the deal would alter the future','原交易方案被阻止',{scope:'英国监管审查'})],{isSynthetic:false,occurredAt:'2023-04-26',url:'https://www.gov.uk/government/news/microsoft-activision-deal-prevented-to-protect-innovation-and-choice-in-cloud-gaming'}),
 m('ms-clear','CMA 批准剥离云游戏权利后的较窄交易','英国竞争与市场管理局 CMA','regulator','The new deal for Microsoft to buy Activision without cloud gaming rights has been cleared','2023-10-13',[s('ms-clear-s','uk','The new deal for Microsoft to buy Activision without cloud gaming rights has been cleared','调整后的较窄交易获批准',{stance:'update',targetId:'ms-block-s',scope:'英国监管审查'})],{isSynthetic:false,occurredAt:'2023-10-13',url:'https://www.gov.uk/government/news/microsoft-concession-a-gamechanger-that-will-promote-competition'}),
 m('ms-close','Xbox 披露动视暴雪团队正式加入','Xbox Wire · Phil Spencer','announcement','And today, we officially welcome Activision Blizzard and their teams to Xbox.','2023-10-13',[s('ms-close-s','closed','And today, we officially welcome Activision Blizzard and their teams to Xbox.','动视暴雪团队正式加入 Xbox')],{isSynthetic:false,occurredAt:'2023-10-13',url:'https://news.xbox.com/en-us/2023/10/13/xbox-activision-blizzard/'})
 ]
};
await writeFile(new URL('../data/seed.json', import.meta.url), JSON.stringify({version:1,events:[energy,medical,ms],auditLog:[]},null,2)+'\n');
