# 操作手册

[English](./operations.md)

本文是从零复现本项目、跑演示、上线和提交黑客松的完整操作记录。所有私钥都只能用于一次性测试钱包，绝不要提交或贴到聊天里。

## 当前状态

| 项目 | 值 |
|---|---|
| 仓库 | https://github.com/zerokkcoder/agentic-payment-guard |
| 线上 Demo | https://agentic-payment-guard.vercel.app/ |
| 网络 | QDay Aevum testnet，chain ID `44005` |
| PaymentGuard | `0xBB8984Cdd7eFa0502E1FEcDEDb2e07b3080436c3` |
| AgentIdentityRegistry | `0xAc1E8054945A73744014c4f257e49AD45E10d17F` |
| ReputationRegistry | `0xEE7029AAAaFdB8108e2fACC8F0cd2704266Ee2E7` |
| ValidationRegistry | `0x1348E3B74C1E2b09fa44d86f7d1Aad78179Cf09f` |
| tUSD8 | `0x456569838f1d43009A91ebA4263147Afd7233483`，6 decimals |
| 部署区块 | `3383476` |
| ERC-8004 agent #1 | 已注册；`tokenURI` 指向线上 `/registry/agent-1.json` |
| 本地验证 | 32 个单元测试 + 4 个 Aevum fork 测试 + typecheck + Next.js build 全部通过 |

## 0. 前置条件

- Node 22+、pnpm、Foundry。
- 当前沙箱里 Foundry 在 `$HOME/.foundry/bin`，需要 `export PATH="$HOME/.foundry/bin:$PATH"`。
- 本机 Foundry 若无法直连 Aevum RPC，先开桥：`make rpc-proxy`，后续所有 Foundry 命令加 `AEVUM_RPC=http://127.0.0.1:8546`。

## 1. 准备测试钱包和资金

生成 4 个一次性钱包（不是真实资产钱包）：

```bash
export PATH="$HOME/.foundry/bin:$PATH"
cast wallet new --json   # OWNER / DEPLOYER，重复运行共 4 次
```

用途：

| 钱包 | 用途 | 需要资金 |
|---|---|---|
| OWNER / DEPLOYER | 部署合约、存 20 tUSD8、注册策略、审批、撤销、强制过期 | ≥20 tUSD8 + 多笔 tQDAY |
| AGENT | 受限 session key，发起付款 | 少量 tQDAY（约 0.5） |
| QUOTE | 签 EIP-712 报价，私钥给 web 和 agent 用 | 不需要 |
| MERCHANT | 白名单收款人，只需地址 | 不需要 |

把 OWNER 私钥导入 Foundry keystore：

```bash
cast wallet import aevum-deployer --private-key <OWNER_PRIVATE_KEY>
cast wallet address --account aevum-deployer
```

去 https://faucet.qday.info/en 或 Discord `/faucet <地址>` 领测试币。每次约 5 tUSD8 + 1 tQDAY；OWNER 通常要领多次才够 20 tUSD8。查余额：

```bash
cast balance <ADDR> --rpc-url https://rpc-test.qday.info
cast call 0x456569838f1d43009A91ebA4263147Afd7233483 \
  'balanceOf(address)(uint256)' <ADDR> --rpc-url https://rpc-test.qday.info
```

`balanceOf` 返回 6 位精度 wei：`20000000` = 20 tUSD8。

## 2. 部署合约（复现步骤）

当前线上合约已经部署，不需要重复部署。只有在重建 Demo 时才执行：

```bash
cd E:/zerokx/workbuddy-workspace/aevum-app
make rpc-proxy   # 终端 1，仅在 Foundry 连不上 RPC 时执行

# 终端 2
QUOTE_SIGNER=<QUOTE_ADDR> make deploy-all-aevum \
  ACCOUNT=aevum-deployer \
  AEVUM_RPC=http://127.0.0.1:8546
```

脚本会打印 4 个合约地址。记录部署区块：`cast block-number --rpc-url https://rpc-test.qday.info`。直连网络可去掉 `AEVUM_RPC=` 覆盖。

## 3. 配置环境变量

```bash
cp web/.env.example web/.env.local
cp agent/.env.example agent/.env
```

`web/.env.local` 必填：

```
NEXT_PUBLIC_NETWORKS=aevum
NEXT_PUBLIC_GUARD_AEVUM=0xBB8984Cdd7eFa0502E1FEcDEDb2e07b3080436c3
NEXT_PUBLIC_IDENTITY_AEVUM=0xAc1E8054945A73744014c4f257e49AD45E10d17F
NEXT_PUBLIC_REPUTATION_AEVUM=0xEE7029AAAaFdB8108e2fACC8F0cd2704266Ee2E7
NEXT_PUBLIC_VALIDATION_AEVUM=0x1348E3B74C1E2b09fa44d86f7d1Aad78179Cf09f
NEXT_PUBLIC_DEPLOY_BLOCK_AEVUM=3383476
NEXT_PUBLIC_REPO_URL=https://github.com/zerokkcoder/agentic-payment-guard
QUOTE_SIGNER_PRIVATE_KEY=<QUOTE 私钥，必须与部署时 QUOTE_SIGNER 对应>
TRUSTED_IP_HEADER=x-vercel-forwarded-for
```

注意：`web/src/lib/env.ts` 已把上述公开地址和区块号写成默认值，Vercel 漏配也能显示；但 `QUOTE_SIGNER_PRIVATE_KEY` 是服务端私钥，没有默认值，必须配置。

`agent/.env` 必填：

```
RPC_URL=https://rpc-test.qday.info
CHAIN_ID=44005
GUARD_ADDRESS=0xBB8984Cdd7eFa0502E1FEcDEDb2e07b3080436c3
IDENTITY_REGISTRY_ADDRESS=0xAc1E8054945A73744014c4f257e49AD45E10d17F
AGENT_ID=1
AGENT_SESSION_PRIVATE_KEY=<AGENT 私钥>
OWNER_PRIVATE_KEY=<OWNER 私钥，必须就是部署者，否则强制过期场景无权执行>
QUOTE_SIGNER_PRIVATE_KEY=<QUOTE 私钥>
MERCHANT_ADDRESS=<MERCHANT 地址>
EXPLORER_URL=https://explorer-test.qday.info
```

所有 `.env*` 已被 git 忽略。不要提交，不要贴到聊天。

## 4. 本地跑通演示

```bash
cd E:/zerokx/workbuddy-workspace/aevum-app
npm --prefix agent run setup     # 存款 20 tUSD8 + 注册 3 把受限 key（一次性）
npm --prefix agent run init      # 查看策略、余额、当日剩余额度
npm --prefix agent run demo | tee demo-output.txt
pnpm --filter web build && pnpm dev
```

7 个场景及预期：

| 场景 | 动作 | 预期 |
|---|---|---|
| `allowed` | 向商户付 1 | `PaymentExecuted` |
| `cap` | 付 5 | `PaymentBlocked(5)` 单笔超限 |
| `notallowlisted` | 向 `0x...dEaD` 付 1 | `PaymentBlocked(4)` |
| `approval` | 付 3 | `ApprovalRequired` → owner 批准 → `PaymentExecuted` |
| `dailycap` | 先付 2，再付 1 | 第一笔成功（当日累计到 6），第二笔 `PaymentBlocked(6)` |
| `revoked` | 撤销 key #2 后付 1 | `PaymentBlocked(3)` |
| `expired` | 强制过期 key #3 后付 1 | `PaymentBlocked(2)` |

被拦截场景是成功的链上交易，只是发了事件而不是 revert，所以 tx hash 有效、原因可在浏览器解码。`demo-output.txt` 是视频和提交材料要用的证据。

## 5. 线上 Vercel

线上站点已经存在：https://agentic-payment-guard.vercel.app/

- 项目必须连接整个仓库，**Root Directory = `web`**。应用通过 pnpm workspace 引用 `packages/aevum`，Vercel 需要根目录的 `pnpm-lock.yaml`。
- 公开地址已有代码默认值；仍建议在 Vercel 环境变量里显式配置 `NEXT_PUBLIC_*` 和 `QUOTE_SIGNER_PRIVATE_KEY`。
- 若 push 后线上没更新，去 Deployments → 最新部署 → `...` → **Redeploy**，并在 Settings → Git 确认集成已开启。
- `/api/quote` 只接受 POST；GET 返回 405 是正常的。

## 6. 回填文档与提交

部署完成后这些地方已填好，重建时才需要改：

- `README.md` / `README.zh-CN.md` 的 Live deployment 表。
- `docs/deployment.md` / `docs/deployment.zh-CN.md` 的地址表和部署区块。
- `docs/registry/agent-1.json` 和 `web/public/registry/agent-1.json` 的 `agentRegistry`。

改动后：

```bash
git add -A
git commit -m "docs: update deployment"
git push origin main
```

## 7. 录视频与提交黑客松

按 `docs/demo.zh-CN.md` 分镜录 3–5 分钟：人类设边界 → Agent 正常付款 → 越界被链上拦截 → 人工审批 → 审计回执。抓每笔 tx hash 和浏览器截图。画面里不要出现私钥。

- 提交截止：**2026-12-11 16:00 HKT**
- Demo Day：**2026-12-15**
- 提交地址：https://dorahacks.io/hackathon/qday/detail

## 8. 常见问题

| 现象 | 处理 |
|---|---|
| `invalid opcode: MCOPY` | 编译成了 Cancun。保持 `evm_version = "shanghai"`，运行 `make build`。 |
| `eth_getLogs` 范围错误 | 单次最多 1000 块，用 `getLogsChunked`。 |
| fork 测试失败 | 开 `make rpc-proxy`，传 `AEVUM_RPC=http://127.0.0.1:8546`。 |
| 首页显示 `PaymentGuard not set` | 检查 `NEXT_PUBLIC_GUARD_AEVUM` 或代码默认值；线上需 Redeploy。 |
| `/api/quote` 405 | 正常，它只接受 POST。 |
| 浏览器验证器失败 | Aevum Blockscout 验证器暂不可用；提交地址、源码 commit 和 ABI 哈希即可。 |
