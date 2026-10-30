# MiniMax 配置与联调

日期：2026-10-30。状态：**接口与Secrets已部署；真实分析仍被MiniMax账户余额不足阻断。**

## 配置

- 密钥：用户指定已有记录 `wym`，密钥值省略。
- 端点：`https://api.minimax.cn/v1/chat/completions`。
- 模型：`MiniMax-M3.1-Flash`。
- 环境变量：`MODEL_BASE_URL`、`MODEL_NAME`、`MODEL_API_KEY`，均设置为Sites服务端Secret，revision 1。
- 公开配置接口只返回提供商、模型与限流说明，不返回密钥。
- 提示词：`extract-v1.1`。MiniMax使用 `reasoning_effort=low`、`reasoning_split=true`、`max_completion_tokens=4096`；不依赖未验证的JSON模式，逐字验证引文。

依据：[官方OpenAI兼容接口](https://platform.minimax.cn/docs/api-reference/text-openai-api)、[对话补全参数](https://platform.minimax.cn/docs/api-reference/text-chat-openai)。这些设置已按文档适配；由于余额不足，尚未证明该账户成功完成推理。

## 实际结果

| 验证 | 结果 | 证据 |
| --- | --- | --- |
| 本地真实供应商请求 | HTTP402，`insufficient balance (1008)` | [脱敏请求记录](./evidence/minimax-live-test.json) |
| Sites Secret设置与公开部署 | 成功，版本4，环境revision1 | [配置元数据](./evidence/minimax-configuration.json) |
| 线上 `/api/config` | aiConfigured=true，提供商MiniMax，模型M3.1-Flash；不表示余额可用 | 配置元数据及线上页面 |
| Chrome真实点击AI分析 | 显示余额不足；输入保留，旧结论不变，无材料写入 | [截图](./evidence/minimax-balance-error.jpg) |
| 自动化 | 68/68通过；模型成功返回使用mock | [测试输出](./evidence/自动化测试.txt) |

用户表示自行处理余额。没有代为充值、改套餐、旋转密钥或循环重试。余额处理后，需要再次实际调用并核对引用、类型、事件归属和保存结果，才可标记成功链路通过。

## 费用与数据边界

每个Worker运行实例内：每访问来源每分钟3次/每天30次，实例每天100次、并发2次。实例重启或跨实例不共享计数，属于尽力保护，不是账户级硬账单上限。原文仅在用户点击AI时提交给供应商；模型结果必须人工核对。

密钥未写入本地 `.env` 或任何提交材料。提交包不含线上Secret，因此解压运行后仍需使用自己的合法密钥配置本地AI；规则分析无需密钥。

## 后续复测

最直接的方式是在公开产品中录入一份新的构造原文，再点击AI。余额已处理时应返回待核对主张；否则会保留明确错误。也可在自己配置了环境变量的环境中运行 `node --env-file-if-exists=.env scripts/verify-model.mjs`（在app目录下），该命令会发送一次真实请求，可能产生供应商计费，不能把它当作离线测试。
