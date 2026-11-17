# 架构设计

[English](./architecture.md)

## 组件

| 组件 | 职责 |
|---|---|
| `PaymentGuard.sol` | 按 agent 管理 tUSD8 资金池，在合约内强制执行 session key 策略，执行或拦截支付，处理人工审批，发出审计事件。 |
| `AgentIdentityRegistry.sol` | 自部署 ERC-8004 身份。ERC-721 token，`tokenId == agentId`；`agentWallet` 需要 EIP-712 / ERC-1271 签名证明；metadata 与 URI 上链。 |
| `ReputationRegistry.sol` | ERC-8004 反馈，可撤销；`getSummary(clientAddresses, ...)` 要求调用方声明可信客户端以防女巫。 |
| `ValidationRegistry.sol` | ERC-8004 验证请求与 0–100 分响应。 |
| `agent/` | TypeScript CLI 扮演 AI agent：签 EIP-712 支付意图、获取报价、提交 `pay`、打印可验证结果。 |
| `web/` | Next.js + wagmi + RainbowKit 控制台：存款、注册策略、审批、活动流、回执。 |
| `/api/quote` | 服务端 EIP-712 报价签名。报价绑定收款人、金额、有效期与 `paymentId`。 |
| `/api/relay-guard` | 可选的免 gas 意图代发，调用 `payWithSignature`。 |

## 信任模型

1. **资金池主人**先存 tUSD8。某个 `agentId` 的第一个存款人成为 `vaultOwner`，也是唯一能提款和注册密钥的地址。这防止攻击者抢先为即将注资的 `agentId` 注册密钥。
2. 主人注册带 `{单笔上限, 每日上限, 审批阈值, 到期时间, 白名单}` 的 **session key**。所有检查在合约内完成，不依赖 UI 或 agent 代码。
3. Agent 为具体 payment ID 向商户控制的 `quoteSigner` 获取**报价签名**。这是防止“用 1 单位代币买高价订单”的关键。
4. 支付结果：
   - 符合策略 → `PaymentExecuted`，从 vault 转账；
   - 超过 `approvalThreshold` → `ApprovalRequired`，由人类批准或拒绝；
   - 越界 → `PaymentBlocked(reason)`。交易**成功上链**，因此拒绝行为也可审计。
5. 主人可立即 `revokeSessionKey`。管理员可 `forceExpireSessionKey` 用于应急响应，也用于在测试网演示“过期”。
6. 所有事件可在 `https://explorer-test.qday.info` 查询。

## 支付状态机

```
None --pay()--> Executed
None --pay()--> ApprovalRequired(Pending) --approve()--> Executed
None --pay()--> Blocked(reason)
Pending --reject()--> Rejected
Pending --approve() + 策略失效--> Blocked(reason)
```

## 链上身份

`AgentIdentityRegistry` 是 [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) 参考实现。注册 JSON 位于 `docs/registry/agent-1.json` 与 `web/public/registry/agent-1.json`，`agentURI` 指向线上 HTTPS 版本。`agentRegistry` 为 `eip155:44005:<注册表地址>`。

## 为什么自部署？

QDay 官方文档称 agent wallet / session key 已在 Aevum 测试网上线，但没有公布 EntryPoint、factory、policy、bundler、paymaster 或 ERC-8004 注册表地址。自部署参考原语是目前唯一能产出完整可验证演示的方式。代码采用 MIT 许可，官方地址公布后可直接替换。
