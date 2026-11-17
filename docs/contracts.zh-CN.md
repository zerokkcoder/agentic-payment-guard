# 合约说明

[English](./contracts.md)

所有合约使用 `pragma solidity ^0.8.24`、`evm_version = "shanghai"`、`via_ir = true`，字节码由 `tools/check-shanghai.mjs` 检查。

## PaymentGuard

### 资金

| 函数 | 权限 | 说明 |
|---|---|---|
| `deposit(uint256 agentId, uint256 amount)` | 任何人；首个调用者成为 vault owner | 通过 `safeTransferFrom` 拉取 tUSD8。必须**先存款再注册密钥**。 |
| `withdraw(uint256 agentId, uint256 amount)` | `vaultOwner` | 取回未使用资金。 |

### 策略

| 函数 | 权限 | 说明 |
|---|---|---|
| `registerSessionKey(sessionKey, agentId, perTxCap, dailyCap, approvalThreshold, expiresAt, recipients)` | vault owner 或 admin | 创建受限密钥和白名单。 |
| `updatePolicy(...)` | 策略 owner | 修改额度、阈值和到期时间。 |
| `setAllowlist(sessionKey, recipient, allowed)` | 策略 owner | 增删单个收款人。 |
| `revokeSessionKey(sessionKey)` | 策略 owner 或 admin | 即时撤销。 |
| `forceExpireSessionKey(sessionKey)` | 仅 admin | 紧急过期；演示中用于展示“已过期”。 |
| `setQuoteSigner(signer)`、`setPaused(bool)` | 仅 admin | 运维控制。 |

### 支付

| 函数 | 说明 |
|---|---|
| `pay(recipient, amount, validBefore, quoteSig)` | `msg.sender` 必须是 session key。 |
| `payWithSignature(Payment p, sessionSig, quoteSig)` | 免 gas 路径，验证 session key 的 EIP-712 意图。 |
| `approve(paymentId)` / `reject(paymentId)` | 策略 owner 处理 pending 支付。 |
| `nextPaymentId(sessionKey)` | 构造报价前预测下一个 ID。 |
| `quoteDigest(recipient, amount, validBefore, paymentId)` | 报价签名者要签的 EIP-712 digest。 |
| `intentDigest(Payment p)` | session key 要签的 EIP-712 digest。 |
| `dailyRemaining(sessionKey)`、`isKeyValid(sessionKey)` | 界面辅助视图。 |

### EIP-712 类型

```
Quote(address recipient,uint256 amount,uint256 validBefore,bytes32 paymentId)
PaymentIntent(address sessionKey,address recipient,uint256 amount,uint256 validAfter,uint256 validBefore,bytes32 paymentId)
```

Domain：`{name: "PaymentGuard", version: "1", chainId: 44005, verifyingContract: <guard>}`。

### 事件与原因码

`SessionKeyRegistered`、`SessionKeyRevoked`、`PolicyUpdated`、`AllowlistUpdated`、`VaultDeposited`、`VaultWithdrawn`、`ApprovalRequired`、`PaymentApproved`、`PaymentRejected`、`PaymentExecuted`、`PaymentBlocked`、`DailyReset`。

`PaymentBlocked.reason`：`1` 未注册、`2` 已过期、`3` 已撤销、`4` 收款人不在白名单、`5` 超过单笔上限、`6` 超过每日上限、`7` vault 余额不足、`8` 金额为零、`9` 签名窗口失效、`10` 已暂停、`11` 报价签名无效。

### 安全说明

- 违反策略时发出事件并返回，而不是 revert。这是刻意设计：拒绝行为必须在链上可见。
- payment ID 由 session key 的 nonce 派生，报价签名无法被重放到另一笔支付。
- `approve()` 会重新跑一遍策略检查，因此支付 pending 期间被撤销的密钥无法执行。
- 合约没有任意外部调用入口，token 只会从 agent 自己的 vault 转到白名单地址。

## ERC-8004 注册表

- `AgentIdentityRegistry`：`register(...)` 三个重载、`setAgentURI`、`getMetadata` / `setMetadata`、`setAgentWallet(agentId, newWallet, deadline, signature)`（EOA 用 EIP-712，合约钱包用 ERC-1271）、`getAgentWallet`、`unsetAgentWallet`、`agentRegistry()`。`agentWallet` 是保留 metadata key，NFT 转移时自动清空。
- `ReputationRegistry`：`initialize(identityRegistry)`、`giveFeedback(...)`、`getSummary(agentId, clientAddresses, tag1, tag2)`、`readAllFeedback`、`readFeedback`、`revokeFeedback`、`appendResponse`。禁止自反馈。
- `ValidationRegistry`：`validationRequest(...)`、`validationResponse(requestHash, 0..100, ...)`、`getValidationStatus`、`getSummary`、`getAgentValidations`、`getValidatorRequests`。

## 已知限制

- 浏览器验证器不可用：用地址 + 精确源码 commit 链接代替。
- `getLogs` 单次最多 1000 块，使用 `@aevum-kit/aevum` 的 `getLogsChunked`。
- Reputation/Validation 是参考实现，不是审计过的生产级注册表。
