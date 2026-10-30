# MiniMax 配置与联调

日期：2026-10-30。状态：**订阅 Key 已替换并部署，单次真实 AI 分析与人工复核保存链路通过。**

## 当前配置

- 密钥：用户指定个人 M Plan 订阅 Key，值省略；仅存于 Sites 服务端 Secret。
- 端点：`https://api.minimax.cn/v1/chat/completions`。
- 模型：`MiniMax-M3.1-Flash`。
- 环境变量：`MODEL_BASE_URL`、`MODEL_NAME`、`MODEL_API_KEY`，均为 Secret；MiniMax密钥在环境revision2更换，v1.2增加扶摇Secret后整体环境为revision3。
- MiniMax原始成功验证为运行版本4；当前v1.2运行版本5增加扶摇资讯，保留同一模型配置，另有真实资讯到AI分析成功记录，见[扶摇接入与验证](./扶摇接入与验证.md)。
- 公开配置接口只返回提供商、模型与限流说明，不返回密钥。
- 提示词：`extract-v1.1`。参数为 `reasoning_effort=low`、`reasoning_split=true`、`max_completion_tokens=4096`；逐字验证引文。

依据：[官方对话补全参数](https://platform.minimax.cn/docs/api-reference/text-chat-openai)、[M Plan FAQ](https://platform.minimax.cn/docs/m-plan/faq)。订阅 Key 使用套餐额度，与普通 API 按量余额分开；单次成功不保证后续额度始终可用。

## 当前真实验证

通过 Chrome 在公开产品正常输入新的构造原文并点击 AI：

> 澄明能源公告：海岬储能项目总投资8亿元，仍须审批。公司预计该项目可能改善未来业务结构，但不作收益承诺。

页面显示“AI 已返回提取建议（MiniMax-M3.1-Flash）”，返回4条逐字引用。人工复核将金额规范为8亿元；删除误归属到协议签署的“仍须审批”，以及不宜直接作为业绩证据的“不作收益承诺”。最终保存金额事实陈述与业务影响推测两条主张。这些修正由人工完成，不属于模型自动提取结果。

保存后海岬事件材料数5→6。刷新后可打开新材料原文与2条引用、四类时间。金额仍显示10/8亿元冲突，业绩影响仍待核实。导出文件包含新增材料和状态前后记录。此次未捕获上游原始响应或HTTP状态，成功依据为实际复核页面、保存、刷新和导出数据。

| 验证 | 结果 | 证据 |
| --- | --- | --- |
| Secret与重新部署 | 版本4，环境revision2，succeeded | [脱敏配置](./evidence/minimax-subscription-configuration.json)、[部署结果](./evidence/部署结果.json) |
| 真实AI提取 | 返回4条建议，需人工纠正归属与金额规范化 | [复核页面](./evidence/minimax-subscription-review.jpg) |
| 保存与刷新追溯 | 保存2条主张，原文引用可打开，状态合理保留 | [原文截图](./evidence/minimax-subscription-saved.jpg)、[测试记录](./evidence/minimax-subscription-ui-test.json) |
| 导出 | 新材料、引用及审计前后状态保留 | [可导入工作区](./evidence/minimax-subscription-workspace.json) |
| 自动化 | 68/68通过，接口测试使用mock | [测试输出](./evidence/自动化测试.txt) |

这是单份构造材料的真实成功链路，不代表模型提取准确率、全网覆盖率或实时金融数据接入通过。

## 历史失败记录

此前普通 `wym` 密钥真实请求返回HTTP402，`insufficient balance (1008)`；环境revision1下的Chrome复测也显示余额不足，输入保留，未写入材料。保留[原始脱敏记录](./evidence/minimax-live-test.json)、[旧配置元数据](./evidence/minimax-configuration.json)、[失败截图](./evidence/minimax-balance-error.jpg)，作为失败路径证据，不代表当前状态。未代为充值、修改套餐、创建或重置平台Key。

## 费用与数据边界

每个Worker运行实例内：每访问来源每分钟3次/每天30次，实例每天100次、并发2次。实例重启或跨实例不共享计数，属于尽力保护，不是账户级硬账单上限。原文仅在用户点击AI时提交给供应商；模型结果必须人工核对。

密钥未写入本地 `.env` 或提交材料。提交包不含线上Secret，解压后需配置自己的合法密钥；规则分析无需密钥。M Plan额度与限额以平台实时状态为准。

## 复测方式

在公开产品录入一份新的构造原文，再点击AI并人工核对。也可在自己配置环境变量后，于app目录执行 `node --env-file-if-exists=.env scripts/verify-model.mjs`。该命令会发送一次真实请求并使用供应商额度，不属于离线测试。
