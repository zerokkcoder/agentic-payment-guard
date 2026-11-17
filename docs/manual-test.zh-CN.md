# 线上手工测试清单

[English](./manual-test.md)

目标：任何人都能按本文在 **https://agentic-payment-guard.vercel.app/** 上完成验收，不需要读代码。测试分两类：**只读验收**不花钱、不改链；**写操作验收**需要测试币，会真实改变链上状态。

## 测试环境

| 项目 | 值 |
|---|---|
| 站点 | https://agentic-payment-guard.vercel.app/ |
| 钱包 | MetaMask / Rabby 等 EVM 钱包 |
| 网络 | QDay Aevum testnet |
| Chain ID | `44005` |
| RPC | `https://rpc-test.qday.info` |
| 符号 | tQDAY |
| 浏览器 | https://explorer-test.qday.info |
| tUSD8 | `0x456569838f1d43009A91ebA4263147Afd7233483` |
| PaymentGuard | `0xBB8984Cdd7eFa0502E1FEcDEDb2e07b3080436c3` |

先在钱包里添加上面的网络。站点在检测到错误网络时也会给出 “Switch network” 按钮。

---

## A. 只读验收（不花钱）

### A1. 首页检查项

**步骤**

1. 打开站点首页，先不要连接钱包。
2. 观察右侧检查卡片和分数。

**预期**

- 标题为 `Is your setup ready for Aevum?`，副标题提到 `PaymentGuard contract`。
- 出现 5 个检查项：`Wallet connected`、`Network`、`Gas (tQDAY)`、`tUSD8 balance`、`PaymentGuard contract`。
- `PaymentGuard contract` 显示绿色，`0xBB89...36c3`，详情为 `Deployed and reachable...`。
- **不应**出现 `Checkout contract` 或 `not set` 提示。
- 未连接钱包时分数应为 `1 / 5`，并提示 `4 items to fix`。

**证据**：首页整屏截图。

### A2. 导航和路由

**步骤**：依次点击顶部 `Overview`、`Policies`、`Approvals`、`Agent`、`Activity`、`Docs`。

**预期**

- 每个页面都加载，无 404、无白屏。
- 浏览器控制台无红色错误（钱包未安装扩展的提示除外）。
- 右上角 `GitHub` 链接指向 `https://github.com/zerokkcoder/agentic-payment-guard`。

**证据**：每个页面各一张截图，或录屏走一遍。

### A3. ERC-8004 注册信息

**步骤**：浏览器直接打开 https://agentic-payment-guard.vercel.app/registry/agent-1.json

**预期**

- 返回合法 JSON。
- `registrations[0].agentRegistry` 等于 `eip155:44005:0xAc1E8054945A73744014c4f257e49AD45E10d17F`。
- `services[0].endpoint` 等于本站地址。
- `active` 为 `true`。

**证据**：JSON 页面截图。

### A4. Agent 控制台说明

**步骤**：打开 `/agent`。

**预期**

- 标题 `AI Agent 支付演示`。
- 显示 `cp agent/.env.example agent/.env`、`npm --prefix agent run setup`、`npm --prefix agent run demo` 三段命令。
- 列出 7 个场景：`allowed`、`approval`、`cap`、`notallowlisted`、`dailycap`、`revoked`、`expired`，每个都有中英文说明。
- 有 `ERC-8004 身份 / Agent identity` 区块，说明为何自部署。

### A5. 审批队列空态

**步骤**：打开 `/approvals`。

**预期**

- 标题 `审批队列 / Approval queue`。
- 若本地从未跑过 `approval` 场景，显示 `暂无审批请求 / No requests yet.`。
- 右上角 `刷新 / Refresh` 按钮可点击，点击后状态不变或更新。

### A6. 活动流水空态

**步骤**：打开 `/activity`。

**预期**

- 标题 `链上活动 / On-chain activity`。
- 若无演示交易，显示 `No guard events yet. Run npm --prefix agent run demo.`。
- 不应出现 `Set NEXT_PUBLIC_GUARD_...` 的未配置提示。

### A7. 付款验证页容错

**步骤**：打开 `/verify/0x0000000000000000000000000000000000000000000000000000000000000001`。

**预期**

- 页面标题 `付款验证 / Verify a payment`，并原样显示该 paymentId。
- 不崩溃、不白屏；找不到事件时给出明确状态或空状态。

---

## B. 钱包与网络验收（需要钱包，不需要资金）

### B1. 连接钱包

**步骤**

1. 点击右上角连接钱包，选择 Aevum 网络账户。
2. 回到首页。

**预期**

- `Wallet connected` 变绿，显示缩写地址。
- `Network` 变绿，显示 `chain 44005`。
- 钱包里若有 tQDAY / tUSD8，对应检查项变绿并显示余额。

### B2. 错误网络提示

**步骤**：在钱包里把网络切到 Ethereum Mainnet 或其他链。

**预期**

- 顶部出现红色横幅：`Your wallet is on another network. This app is set to QDay Aevum testnet (44005).`
- 点击横幅里的 `Switch network`，钱包弹窗请求切链；确认后横幅消失，`Network` 检查项变绿。

**证据**：错误网络横幅截图 + 切换后首页截图。

### B3. 添加 tUSD8 到钱包

**步骤**：首页 `tUSD8 balance` 检查项若余额为 0，点击 `Add tUSD8 to wallet`。

**预期**：钱包弹出添加代币确认，地址为 `0x4565...3483`，精度 6。

---

## C. 写操作验收（可选，会真实改链）

> 只在一次性测试钱包上做。OWNER 地址需要有 tUSD8 和 tQDAY。每笔操作都要在浏览器里留下可打开的 tx 链接。

### C1. 创建策略

**步骤**

1. 打开 `/policies`，连接 OWNER 钱包。
2. 填写：
   - Session key：一个你能控制的测试地址
   - 收款白名单：MERCHANT 地址
   - 存款：`1`
   - 单笔上限：`0.5`
   - 每日上限：`1`
   - 审批阈值：`0.2`
   - 有效期：`4`
3. 点击 `存入并注册 / Deposit & register`，确认钱包交易。

**预期**

- 出现交易状态组件，结束后给出浏览器链接。
- 在 `查看并撤销 / Inspect & revoke` 输入同一个 session key，能看到 Owner、Per-tx / Daily、Spent today、Expires、Active=yes。

### C2. 撤销密钥

**步骤**：在 C1 的 `Inspect & revoke` 中点击 `立即撤销 / Revoke now`，确认交易。

**预期**：交易成功；再次查询该 session key，`Active` 变为 `no`。

### C3. 人工审批

**前置**：在本地执行 `npm --prefix agent run demo` 中的 `approval` 场景，产生一笔 Pending 付款。

**步骤**

1. 打开 `/approvals`，点击 `刷新 / Refresh`。
2. 找到状态为 `Pending` 的记录，点击 `批准 / Approve` 或 `拒绝 / Reject`，确认交易。

**预期**

- 交易成功后状态从 `Pending` 变为 `Executed` 或 `Rejected`。
- 记录里的浏览器链接可打开。

### C4. 审计回执

**前置**：从 `demo-output.txt` 里取一个真实 `paymentId`。

**步骤**：打开 `/verify/<paymentId>`。

**预期**

- 显示 `Executed` 或 `Blocked` 状态。
- 解码出事件、金额、收款人、确认数。
- `View on explorer` 链接可打开且交易存在。

---

## D. 移动端

**步骤**：用手机或浏览器响应式模式（宽度 375px）打开首页、`/policies`、`/activity`。

**预期**：导航不溢出、表格不横向撑破、按钮可点击、文字可读。

---

## 通过标准

一次合格验收至少满足：

- [ ] A1：首页显示 PaymentGuard，不出现 Checkout 未配置。
- [ ] A2：6 个路由全部可访问。
- [ ] A3：注册 JSON 的 `agentRegistry` 是真实地址，不是 `TBD`。
- [ ] A4：7 个演示场景说明完整。
- [ ] B1/B2：钱包连接与错误网络提示正常。
- [ ] 若做写操作：每笔交易都有可打开的浏览器链接。

## 常见问题

| 现象 | 判断 |
|---|---|
| `/api/quote` 返回 405 | 正常，该接口只接受 POST。 |
| 页面显示 `No guard events yet` | 正常，先跑本地 `agent run demo` 才会产生事件。 |
| 首页仍是 `Checkout contract not set` | Vercel 还在服务旧构建，去 Deployments 手动 Redeploy。 |
| 注册 JSON 仍是 `TBD` | 同上，Redeploy 后复查。 |
| 交易一直 pending | 检查 tQDAY 余额和 Aevum RPC 状态；不要重复提交。 |
