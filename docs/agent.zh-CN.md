# Agent CLI（代理命令行）

[English](./agent.md)

`agent/` 是 pnpm workspace 中的独立 TypeScript 包，使用 viem + `@aevum-kit/aevum`，在演示中扮演 AI agent。

## 准备

```bash
cp agent/.env.example agent/.env
# 填入 GUARD_ADDRESS、已部署地址和三个测试私钥
npm --prefix agent run setup
npm --prefix agent run init
```

绝不要使用持有真实资产的私钥。agent key 需要少量 tQDAY 支付直接交易的 gas；owner key 需要 tUSD8 和 tQDAY；quote key 必须与部署时传给 `PaymentGuard` 的地址一致。

## 命令

| 命令 | 用途 |
|---|---|
| `init` / `status` | 打印 chain ID、策略、vault 余额、当日剩余额度、到期时间、报价签名者。 |
| `setup` | approve + 存入 20 tUSD8，注册主密钥、待撤销密钥和待过期密钥。 |
| `pay <amount>` | 用主 session key 向配置的商户付款。 |
| `approve <paymentId>` | owner 批准 pending 支付。 |
| `scenario <name>` | 运行单个场景。 |
| `demo` | 依次运行七个场景，每步打印结果。 |

## 环境变量

| 变量 | 说明 |
|---|---|
| `RPC_URL` | `https://rpc-test.qday.info`（或本地 fork URL）。 |
| `CHAIN_ID` | Aevum 为 `44005`，`make fork` 为 `440050`。 |
| `GUARD_ADDRESS` | 已部署的 `PaymentGuard`。 |
| `IDENTITY_REGISTRY_ADDRESS` | 已部署的 ERC-8004 身份注册表。 |
| `AGENT_ID` | 数字 agent ID，默认 `1`。 |
| `AGENT_SESSION_PRIVATE_KEY` | 授予 agent 的受限 session key。 |
| `OWNER_PRIVATE_KEY` | vault 主人：存款、注册、审批、撤销、过期。 |
| `QUOTE_SIGNER_PRIVATE_KEY` | 本地报价签名；也可改用 `QUOTE_API_URL`。 |
| `QUOTE_API_URL` | 可选服务端报价接口，返回 `{signature}`。 |
| `MERCHANT_ADDRESS` | 场景使用的白名单收款人。 |
| `EXPLORER_URL` | 用于打印交易链接。 |

## 场景与预期结果

演示配置：`perTxCap = 4`、`dailyCap = 8`、`approvalThreshold = 2.5`、`vault = 20`、`expiresAt = now + 4h`、白名单 = `[merchant]`。

| 场景 | 动作 | 预期 |
|---|---|---|
| `allowed` | 向商户付 1 | `PaymentExecuted`，商户 +1 |
| `cap` | 付 5 | `PaymentBlocked(5)` 单笔超限 |
| `notallowlisted` | 向 0x…dEaD 付 1 | `PaymentBlocked(4)` |
| `approval` | 付 3 | `ApprovalRequired`；CLI 随后用 owner key 调 `approve` → `PaymentExecuted` |
| `dailycap` | 付 4，再付 1 | 第一笔成功，第二笔 `PaymentBlocked(6)`（当日累计达到 8） |
| `revoked` | 撤销密钥 #2，付 1 | `PaymentBlocked(3)` |
| `expired` | 强制过期密钥 #3，付 1 | `PaymentBlocked(2)` |

每行输出包含 `paymentId`、`txHash`、`block`、`status`、`reason` 和浏览器链接。被拦截场景也是成功交易，因为合约发事件而非 revert。

## 免 gas 路径

Foundry 的 `testGaslessPayment` 覆盖 `PaymentGuard.payWithSignature`。服务端代发时把 payment 结构体、`sessionSig`、`quoteSig` POST 到 `/api/relay-guard`；该路由会先模拟、按 IP 限流，并要求 `RELAYER_PRIVATE_KEY`。
