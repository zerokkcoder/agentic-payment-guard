# QDay 平台集成

[English](./integration.md)

本页说明应用如何使用 Aevum 原生能力，以及刻意偏离 starter kit 的地方。

## tUSD8

- 地址 `0x456569838f1d43009A91ebA4263147Afd7233483`，6 decimals，FiatTokenV2 风格。
- EIP-712 domain `{ name: "tUSD8", version: "2", chainId: 44005, verifyingContract: <上述地址> }`。
- 支持 EIP-2612 `permit` 和 EIP-3009 `transferWithAuthorization` / `receiveWithAuthorization`。
- `PaymentGuard.deposit` 使用标准 `approve` + `safeTransferFrom`；vault 随后直接把 tUSD8 转给白名单收款人。starter kit 原有的 EIP-3009 relayer 仍可用于 Checkout 免 gas 流程。

## EIP-712

两类 typed payload：

1. **Quote** —— 由商户控制的 `quoteSigner` 签名：`Quote(recipient, amount, validBefore, paymentId)`。`/api/quote` 与 agent CLI 通过 `guard.quoteDigest` 生成完全一致的 digest。
2. **PaymentIntent** —— 由 session key 签名用于免 gas 代发：`PaymentIntent(sessionKey, recipient, amount, validAfter, validBefore, paymentId)`。

两者都使用 domain `{name: "PaymentGuard", version: "1", chainId, verifyingContract: guard}`。`/api/quote` 与 `/api/relay-guard` 都把报价有效期限制在一小时内。

## ERC-8004

`AgentIdentityRegistry` 遵循 EIP 的三个 `register` 重载、ERC-721 token ID 作为 `agentId`、metadata key、`agentWallet` 的 EIP-712/ERC-1271 证明以及转移时清空钱包。`ReputationRegistry` 拒绝自反馈，`getSummary` 要求传入 `clientAddresses`。`ValidationRegistry` 存储 0–100 分响应。注册 JSON 托管在 `web/public/registry/agent-1.json`；Vercel 部署后需把 `agentURI` 更新为线上 HTTPS 地址。

**重要**：这些是自部署参考实现。QDay 自己的 ERC-8004 注册表仍在规划中，Aevum 上没有公布地址。

## 智能账户 / session key

QDay 文档称 ERC-4337 agent wallet 与 session key 已在 Aevum 上线，但 EntryPoint、factory、policy 模块、bundler 和 paymaster 地址均未公布。`PaymentGuard` 用一个自包含合约实现了同样的原语：受限密钥、单笔/每日支出上限、目标地址限制、到期、撤销。这是刻意权衡：今天就能验证，官方基础设施公布后可直接替换。

## Aevum 特有约束

| 约束 | 处理方式 |
|---|---|
| Shanghai EVM | `evm_version = "shanghai"`，`make build` 跑 `tools/check-shanghai.mjs`，不用 OZ `*Transient`，anvil 加 `--hardfork shanghai`。 |
| `eth_getLogs` ≤ 1000 块 | `@aevum-kit/aevum` 的 `getLogsChunked`，Activity 与 Approvals 页面调用。 |
| 无 WebSocket | 只用 HTTP 轮询，不用 WS `watchContractEvent`。 |
| Legacy 交易 | 脚本和 relayer 使用 `type: "legacy"` / `--legacy`。 |
| 浏览器验证器失效 | 用地址 + 源码 commit 替代 `forge verify-contract`。 |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11`。 |

## 修复 starter kit 的 Checkout 缺陷

官方 `Checkout.sol` 用调用方提供的任意 `orderId` 记账。任何人都可以 `pay(orderId, 1)` 用 0.000001 tUSD8 把订单标记为已付，抢在真实付款人之前。我们的修复：

1. `paymentId` 由 `keccak256(sessionKey, nonce)` 派生，无法提前选择或猜测。
2. 金额必须匹配 `quoteSigner` 的 EIP-712 报价签名。
3. 收款人必须在 session key 白名单内。
4. 即使密钥泄露，单笔和每日上限也限制损失。
5. `approve()` 重新检查整个策略，堵住“pending 期间被撤销”的竞态。

## API 示例

获取报价：

```bash
curl -X POST http://localhost:3000/api/quote \
  -H 'content-type: application/json' \
  -d '{"recipient":"0x...","amount":"1000000","validBefore":"<unix>","paymentId":"0x..."}'
```

代发签名意图：

```bash
curl -X POST http://localhost:3000/api/relay-guard \
  -H 'content-type: application/json' \
  -d '{"payment":{...},"sessionSig":"0x...","quoteSig":"0x..."}'
```

## Roadmap

- 官方 ERC-8004 地址公布后替换自部署注册表。
- 从策略守卫合约迁移到 ERC-4337 智能账户 + 原生 session key 模块 + paymaster。
- 增加 x402 支持（注册 JSON 中 `x402Support` 当前为 `false`）。
- Relayer 限流从内存迁到 Redis，并增加按商户的支出上限。
- 为 `ApprovalRequired` 事件增加 Agent Mail / webhook 通知。
