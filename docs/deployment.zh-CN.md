# 部署

[English](./deployment.md)

## 网络参数

| 字段 | 值 |
|---|---|
| 网络 | QDay Aevum Testnet |
| Chain ID | `44005`（`0xABE5`） |
| RPC | `https://rpc-test.qday.info`（仅 HTTPS） |
| 浏览器 | `https://explorer-test.qday.info` |
| Faucet | `https://faucet.qday.info/en` 或 Discord `/faucet <地址>` |
| Gas token | tQDAY，18 decimals，约 1 gwei |
| tUSD8 | `0x456569838f1d43009A91ebA4263147Afd7233483`，6 decimals |
| EVM | Shanghai；脚本使用 legacy（type 0）交易 |

## 部署合约栈

```bash
cast wallet import aevum-deployer --interactive
cast wallet address --account aevum-deployer   # 给这个地址充值
export QUOTE_SIGNER=<你的报价签名测试地址>
make deploy-all-aevum ACCOUNT=aevum-deployer
```

脚本一次部署 `AgentIdentityRegistry`、`ReputationRegistry`、`ValidationRegistry` 和 `PaymentGuard`，并打印地址。记录部署区块，供 Activity 页面扫描使用。

### 部署地址（部署后填写）

| 合约 | Aevum 测试网 | Fork (440050) | Local (31337) |
|---|---|---|---|
| PaymentGuard | `0xBB8984Cdd7eFa0502E1FEcDEDb2e07b3080436c3` | 用 `make deploy-all-fork` 重新部署 | 用 `make deploy-all-local` 重新部署 |
| AgentIdentityRegistry | `0xAc1E8054945A73744014c4f257e49AD45E10d17F` | 重新部署 | 重新部署 |
| ReputationRegistry | `0xEE7029AAAaFdB8108e2fACC8F0cd2704266Ee2E7` | 重新部署 | 重新部署 |
| ValidationRegistry | `0x1348E3B74C1E2b09fa44d86f7d1Aad78179Cf09f` | 重新部署 | 重新部署 |
| tUSD8 | `0x456569838f1d43009A91ebA4263147Afd7233483` | 相同 | MockUSD8 |

Aevum 部署区块：`3383476`。设置 `NEXT_PUBLIC_DEPLOY_BLOCK_AEVUM=3383476`，Activity 页面只从该区块开始扫描。线上 Demo：https://agentic-payment-guard.vercel.app/

## 环境变量

### `web/.env.local`

| 变量 | 说明 |
|---|---|
| `NEXT_PUBLIC_NETWORKS` | `aevum,fork,local`，第一个为默认。 |
| `NEXT_PUBLIC_GUARD_AEVUM` / `_FORK` / `_LOCAL` | 各网络的 PaymentGuard 地址。 |
| `NEXT_PUBLIC_IDENTITY_AEVUM` / `_FORK` / `_LOCAL` | 身份注册表地址。 |
| `NEXT_PUBLIC_REPUTATION_AEVUM` / `NEXT_PUBLIC_VALIDATION_AEVUM` | 可选注册表地址。 |
| `NEXT_PUBLIC_DEPLOY_BLOCK_AEVUM` | 事件扫描起始区块。 |
| `NEXT_PUBLIC_REPO_URL` | Docs 页面使用的 GitHub 仓库地址。 |
| `QUOTE_SIGNER_PRIVATE_KEY` | 仅服务端，必须与部署时的 `quoteSigner` 一致。 |
| `RELAYER_PRIVATE_KEY` | 仅服务端，放少量 tQDAY 的全新测试钱包。 |
| `TRUSTED_IP_HEADER` | Vercel 上为 `x-vercel-forwarded-for`。 |

### `agent/.env`

见 [agent.zh-CN.md](./agent.zh-CN.md#环境变量)。两个 `.env` 都绝不能提交。

## Vercel

导入仓库，设置 **Root Directory = `web`**，填入上述变量后部署。必须连接整个仓库：`web` 通过 pnpm workspace 引用 `packages/aevum`，Vercel 需要根目录的 `pnpm-lock.yaml`。README 中的一键部署按钮已指向 `zerokkcoder/agentic-payment-guard`；如果你 fork 了仓库，把链接里的 `repository-url` 改成你的 fork。

## 验证器限制

Aevum 的 Blockscout 验证器暂不可用，`forge verify-contract` 会失败。提交时写明部署地址、精确的源码 commit 和 ABI 哈希。验证器恢复后可执行：

```bash
forge verify-contract <address> src/PaymentGuard.sol:PaymentGuard --chain-id 44005 \
  --verifier blockscout --verifier-url https://explorer-test.qday.info/api/
```

## 代理环境：Foundry 无法直连 RPC

某些网络环境里 PowerShell / Node 能访问 `https://rpc-test.qday.info`，但 Foundry 的 Rust HTTP 客户端因 TLS 中间代理而失败。此时开一个本地 HTTP→HTTPS 桥接（只转发 JSON-RPC，不涉及私钥）：

```bash
make rpc-proxy                 # 终端 1：127.0.0.1:8546 -> Aevum RPC
make test-fork AEVUM_RPC=http://127.0.0.1:8546
# 如需在那台机器上部署，同样把 AEVUM_RPC 覆盖为桥接地址：
make deploy-all-aevum AEVUM_RPC=http://127.0.0.1:8546 ACCOUNT=aevum-deployer
```

桥接的实现见 `tools/rpc-proxy.mjs`；用 `PORT` / `UPSTREAM_RPC` 可改端口和上游。

## 排障

- `invalid opcode` → 编译成了 Cancun。保持 `evm_version = "shanghai"` 并运行 `make build`。
- `eth_getLogs` 范围错误 → 使用 `getLogsChunked`，单次最多 1000 块。
- 无 WebSocket → 用 HTTPS 轮询。
- 代理环境下 fork 测试失败 → Foundry 需要直连 RPC；改用直连网络或只跑单元测试。
- Relayer 被刷 → 只放少量 tQDAY，真实流量前把内存限流换成 Redis。
