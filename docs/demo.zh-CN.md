# 演示脚本

[English](./demo.md)

目标：3–5 分钟视频演示，展示真实、可复现的端到端流程。叙事主线：**人类设定边界；AI 在边界内付款；越界尝试被链上拦截并留痕。**

## 录制前

1. 部署到 Aevum 测试网（见 [deployment.zh-CN.md](./deployment.zh-CN.md)）。
2. `npm --prefix agent run setup` —— 一次性完成确定性的存款与注册。
3. 打开 Web 应用并切到 Aevum 网络，确认控制台无报错。
4. 只在需要展示免 gas 模式时才给 relayer 充值。

## 分镜

| 时间 | 画面 | 链上动作 / 抓取物 |
|---|---|---|
| 0:00–0:30 | 仪表盘 + ERC-8004 身份卡 | 展示已注册 agent #1 与托管的注册 JSON。 |
| 0:30–1:00 | `/policies` | `deposit` + `registerSessionKey`；截图额度、白名单、倒计时；抓 tx #1。 |
| 1:00–1:45 | `/agent` → `scenario allowed` | `pay 1 → 商户`；`PaymentExecuted`；抓 tx #2 + 浏览器截图。 |
| 1:45–2:30 | `scenario cap`、`scenario notallowlisted` | 两个 `PaymentBlocked`，原因码 5 和 4；抓 tx #3/#4。 |
| 2:30–3:15 | `scenario approval` → `/approvals` | `ApprovalRequired`，人类点批准，`PaymentApproved` + `PaymentExecuted`；抓 #5/#6。 |
| 3:15–3:45 | `scenario revoked`（可选 `expired`） | 即时撤销 / 过期；抓 #7/#8。 |
| 3:45–4:15 | `/activity` → `/verify/[paymentId]` | 滚动审计流，打开回执，展示解码事件、确认数和浏览器链接。 |
| 4:15–4:30 | 收尾 | 仓库地址、合约地址表、“可用命令复现”。 |

## 可靠性要点

- 录制前先跑一遍 `npm --prefix agent run demo`，预热 RPC 并确认七个场景全部通过。
- 被拦截场景使用事件而非 revert，交易哈希有效，原因码在浏览器中可见。
- 测试网不稳定时，可在 `make fork`（同样合约、真实 tUSD8）上录完整流程，再补 2–3 笔 Aevum 真实交易作为 live proof。
- 画面中绝不要出现私钥；CLI 只打印地址。

## 评委验证清单

- [ ] 所有交易都在 chain ID `44005` 上。
- [ ] 至少一笔 `PaymentExecuted` 真实转移 tUSD8。
- [ ] 至少一笔 `PaymentBlocked` 在浏览器中显示可解码原因。
- [ ] 审批流程同时出现 `ApprovalRequired` 与 `PaymentExecuted`。
- [ ] 每个抓取的哈希都有可打开的浏览器链接。
