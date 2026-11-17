# 演示视频录制教程

[English](./demo.md)

这是一份**照着做就能录出成片**的教程。目标：3–5 分钟，展示真实、可复现的端到端流程。

叙事主线只有一句话：**人类设定边界 → AI 在边界内付款 → 越界尝试被链上拦截并留痕 → 大额付款由人类批准 → 每一笔都能在浏览器验证。**

核心线上地址（录制时会反复用到）：

| 名称 | 值 |
|---|---|
| 线上站点 | https://agentic-payment-guard.vercel.app/ |
| 区块浏览器 | https://explorer-test.qday.info |
| 网络 | QDay Aevum testnet，chain ID `44005`，符号 tQDAY |
| tUSD8 | `0x456569838f1d43009A91ebA4263147Afd7233483`（6 位小数） |
| PaymentGuard | `0xBB8984Cdd7eFa0502E1FEcDEDb2e07b3080436c3` |
| 仓库 | https://github.com/zerokkcoder/agentic-payment-guard |

> 隐私红线：**任何私钥都不要出现在录屏、截图或终端可见区域。** CLI 只打印地址，网页只看地址。钱包导入私钥的界面、`.env` 文件、私钥明文——一律不录。

---

## 1. 录制前准备

### 1.1 四把一次性钱包

用一次性测试钱包，绝不用日常主钱包。四把密钥各司其职：

| 角色 | 用途 | 需要的资金 |
|---|---|---|
| **OWNER / DEPLOYER** | 部署者、资金池主人、创建策略、人工审批、撤销、强制过期 | ≥20 tUSD8 + 多笔 tQDAY gas |
| **AGENT** | AI 的 session key，发起付款 | 约 0.5 tQDAY gas |
| **QUOTE** | 只签 EIP-712 报价，不付款 | 不需要 |
| **MERCHANT** | 白名单收款人，只需地址 | 不需要 |

生成与导入（Git Bash）：

```bash
export PATH="$HOME/.foundry/bin:$PATH"
cast wallet new --json          # 运行 4 次，分别记录 address 和 privateKey
cast wallet import aevum-deployer --private-key <OWNER_PRIVATE_KEY>
cast wallet address --account aevum-deployer
```

把 **OWNER 私钥**导入浏览器钱包（MetaMask / Rabby）：导入私钥 → 添加网络 `Chain ID 44005` / RPC `https://rpc-test.qday.info` / 符号 `tQDAY`。建议用一个**独立的浏览器配置文件**专放测试钱包。

### 1.2 领测试币并查余额

https://faucet.qday.info/en 或 Discord `/faucet <地址>`，每次约 5 tUSD8 + 1 tQDAY。OWNER 通常要领多次才够 20 tUSD8。AGENT 至少领一次 gas。

```bash
cast balance <ADDR> --rpc-url https://rpc-test.qday.info
cast call 0x456569838f1d43009A91ebA4263147Afd7233483 \
  'balanceOf(address)(uint256)' <ADDR> --rpc-url https://rpc-test.qday.info
```

`balanceOf` 返回 6 位精度 wei：`20000000` = 20 tUSD8。

### 1.3 填写 `agent/.env`（逐项说明）

```bash
cd E:/zerokx/workbuddy-workspace/aevum-app
cp agent/.env.example agent/.env
```

| 变量 | 填什么 | 从哪拿 |
|---|---|---|
| `RPC_URL` | `https://rpc-test.qday.info` | 固定 |
| `CHAIN_ID` | `44005` | 固定 |
| `GUARD_ADDRESS` | `0xBB8984Cdd7eFa0502E1FEcDEDb2e07b3080436c3` | 本页表格 |
| `IDENTITY_REGISTRY_ADDRESS` | `0xAc1E8054945A73744014c4f257e49AD45E10d17F` | README 地址表 |
| `AGENT_ID` | `1` | 链上 agent #1 已注册 |
| `AGENT_SESSION_PRIVATE_KEY` | AGENT 私钥 | 1.1 生成的第 2 把 |
| `OWNER_PRIVATE_KEY` | OWNER 私钥 | 1.1 生成的第 1 把，**必须就是部署者** |
| `QUOTE_SIGNER_PRIVATE_KEY` | QUOTE 私钥 | 必须与部署时 `QUOTE_SIGNER` 地址对应 |
| `MERCHANT_ADDRESS` | MERCHANT 地址 | 1.1 生成的第 4 把的地址 |
| `EXPLORER_URL` | `https://explorer-test.qday.info` | 固定 |

`.env*` 已被 git 忽略。**不要提交，不要贴到聊天，不要录进视频。**

### 1.4 网页端配置

线上站点已配好合约地址默认值，**不需要本地 `web/.env.local`**。若你本地跑 `pnpm dev`，把 `web/.env.example` 复制为 `web/.env.local`，并确认 `NEXT_PUBLIC_GUARD_AEVUM` 等为上面的真实地址。

### 1.5 一次性初始化与预热

```bash
cd E:/zerokx/workbuddy-workspace/aevum-app
npm --prefix agent run setup     # 存 20 tUSD8，注册 3 把受限 key，重置当日额度
npm --prefix agent run init      # 看策略、余额、当日剩余额度
npm --prefix agent run demo      # 预热：确认 7 个场景全绿（先别录）
```

`setup` 会打印 owner、vault、每把 key 的策略和 tx 链接。`init` 会打印 AGENT 地址（`signer` 字段）——**记住这个地址，网页填写会用到。**

预热成功的标志：7 个场景都没有 `SCENARIO FAILED`。若有失败，先按第 6 节排障，不要开始录制。

### 1.6 录屏设置

- 分辨率 1440×900 或更高，浏览器缩放 100%，全屏 F11 录制。
- 关闭钱包扩展的通知弹窗干扰；把终端字体调大，方便看清 tx hash。
- 终端只显示 CLI JSON 输出（地址、hash、链接），不显示 `.env`。
- 每个场景录完立即把 tx hash 和 explorer 链接另存到 `takes.txt`，剪辑时要用。

---

## 2. 页面填写速查（逐页面、逐字段）

这一节是全文重点：**每个输入框填什么、值从哪来、为什么这样填。** 录制时把这一节放在手边。

### 2.1 首页 Overview（不填任何东西）

打开站点即可。观察右侧 5 个检查项：`Wallet connected`、`Network`、`Gas (tQDAY)`、`tUSD8 balance`、`PaymentGuard contract`。`PaymentGuard contract` 应为绿色 `0xBB89…36c3 / Deployed and reachable`。**不应**出现 `Checkout contract … not set`。

### 2.2 连接钱包与网络

点击右上角连接按钮，选 OWNER 钱包。若顶部出现红色横幅 `Your wallet is on another network`，点横幅里的 **Switch network**，在钱包里确认切到 44005。连接成功后首页 `Wallet connected`、`Network` 变绿。

### 2.3 `/policies` — 创建策略（逐字段）

点顶部 **Policies**。左侧卡片 `创建新策略 / Register a scoped key` 有 7 个输入框：

| # | 字段（页面标签） | 页面默认值 | 录制时填什么 | 从哪拿 / 为什么 |
|---|---|---|---|---|
| 1 | `Session key (AI 地址)` | 空 | **一把新的测试地址**（不要填 AGENT 主 key） | `cast wallet address --private-key <临时PK>`。用新地址是为了不覆盖 CLI 场景用的 AGENT 主策略。 |
| 2 | `收款白名单 / Allowlist` | 空 | MERCHANT 地址 | `agent/.env` 的 `MERCHANT_ADDRESS`。AI 只能付给这个地址。 |
| 3 | `存款 / Deposit (tUSD8)` | `20` | `1`（演示够用即可） | OWNER 钱包需有 tUSD8；填 1 省币。 |
| 4 | `单笔上限 / Per-tx cap` | `4` | `4` | 单次付款上限。 |
| 5 | `每日上限 / Daily cap` | `6` | `6` | 当日累计上限，必须 ≥ 单笔上限。 |
| 6 | `人工审批阈值 / Approval threshold` | `2.5` | `2.5` | 超过此金额进入人工审批。 |
| 7 | `有效期（小时）/ Expires in (hours)` | `4` | `4` | 到期时间 = 现在 + 4 小时。 |

**约束**：单笔上限与每日上限必须 > 0 且单笔 ≤ 每日；有效期必须 > 现在，否则交易 revert 并出现白话错误提示。

点击 **存入并注册 / Deposit & register** 后，会**连续发 3 笔交易**，钱包会弹 3 次确认：

1. `approve` — 授权 tUSD8
2. `deposit` — 存入资金池
3. `registerSessionKey` — 注册受限 key

页面底部 `TxStatus` 显示最后一笔的确认状态与浏览器链接。等出现 `已确认 / Confirmed · block …` 再切画面。

### 2.4 `/policies` — 查看并撤销

右侧 `查看并撤销 / Inspect & revoke` 只有 1 个输入框：

| 字段 | 填什么 | 从哪拿 |
|---|---|---|
| `Session key` | 2.3 第 1 步填的同一地址 | 自己刚填的 |

填对后下方出现：`Owner`、`Per-tx / Daily`、`Spent today`、`Expires`、`Active`（应为 `yes`）。金额显示是 6 位精度原始值（`4000000` = 4 tUSD8）。

点 **立即撤销 / Revoke now** 会真实撤销该 key（演示时放到最后，或只撤这把临时 key，别撤 AGENT 主 key，否则后续付款场景全被拦）。

### 2.5 `/approvals` — 人工审批（无需输入，点按钮）

这一页没有输入框，只有按钮。要让它有内容，先产生一笔 Pending 付款（见 3.4）。页面元素：

- 右上 **刷新 / Refresh**：点它重新读链上事件。
- 每条 Pending 记录有 **批准 / Approve** 和 **拒绝 / Reject** 两个按钮。按钮在 `disabled` 状态说明钱包没连或网络不对。
- 状态胶囊：`Pending`（黄）、`Executed`（绿）、`Rejected`（红）。

要点：连着 OWNER 钱包、正确网络，点 **批准 / Approve**，钱包确认后该行状态从 `Pending` 变 `Executed`。

### 2.6 `/agent` — Agent 控制台（只读）

无输入。展示 7 个场景清单、ERC-8004 身份（`agent #1 URI` 指向线上注册 JSON）、`Quote signer`。

### 2.7 `/activity` — 审计流（只读 + 点链接）

无输入。表格列：`Result`（已执行/已拦截/待审批）、`Agent key`、`Recipient`、`Amount`、`Block`、`Links`。每行两个链接：

- **Receipt** → 打开 `/verify/<paymentId>`（paymentId 自动带出，无需手填）。
- **Tx ↗** → 打开区块浏览器交易页。

被拦截的行在结果下方有白话原因（如 `超过单笔上限`）。

### 2.8 `/verify/[paymentId]` — 付款验证（URL 里的 paymentId 从哪来）

这一页的“填写”发生在 **URL** 上：`https://agentic-payment-guard.vercel.app/verify/<paymentId>`。

paymentId 有两个来源，任选其一：

1. **CLI 输出**：每个场景的 JSON 里都有 `paymentId` 字段（`0x` 开头 66 字符）。复制粘贴到 URL。
2. **Activity 表格**：点任意行的 **Receipt** 链接，浏览器自动带出。

页面展示：`状态 / Status`、`Session key`、`收款人 / Recipient`、`金额 / Amount`，被拦时还有 `拦截原因 / Block reason`（含原因码）。

---

## 3. 分镜与逐步操作

按下表顺序录。每幕都给出：**画面 → 操作 → 页面/CLI → 预期 → 抓取物 → 解说词（可照读）**。

### 3.0 开场（0:00–0:25）

- **画面**：首页 Overview。
- **操作**：已连 OWNER 钱包，展示 5 个绿色检查项。
- **解说**：「这是一个给 AI agent 用的受控支付钱包。人类先设定边界，AI 才能在链上花钱；所有越界尝试都会被拦截并留在链上。」

### 3.1 身份与控制台（0:25–0:45）

- **画面**：点 **Agent**。
- **操作**：滚动展示 7 个场景清单和 ERC-8004 身份卡；指向 `agent #1 URI` 的线上 JSON 链接。
- **抓取**：身份卡截图。

### 3.2 人类设边界（0:45–1:30）

- **画面**：点 **Policies**。
- **操作**：按 2.3 表格逐字段填写 7 个输入框（一边填一边念字段名）；点 `存入并注册`，钱包确认 3 次。
- **预期**：`已确认 / Confirmed`。
- **抓取**：填完未提交的整屏截图 + 3 笔 tx hash。
- **解说**：「我在这里存入资金，并给 AI 一把带边界的钥匙：单笔最多 4、每天最多 6、超过 2.5 要我批准、4 小时后自动失效、只能付给白名单商户。」

### 3.3 边界内付款（1:30–2:00）

- **画面**：终端 CLI + 网页 `/activity` 来回切。
- **CLI**：
  ```bash
  npm --prefix agent run scenario allowed
  ```
- **预期**：JSON 里 `status: Executed`，`explorer` 是浏览器链接。
- **操作**：复制 `paymentId`，打开 `/activity`，指向刚出现的绿色 `已执行` 行。
- **抓取**：CLI JSON 截图 + activity 行截图 + tx hash。
- **解说**：「AI 发起一笔 1 tUSD8 的付款——在边界内，链上执行成功。」

### 3.4 越界拦截（2:00–2:40）

- **CLI**（两条各跑一次）：
  ```bash
  npm --prefix agent run scenario cap          # 付 5 > 单笔上限 4 → Blocked(5)
  npm --prefix agent run scenario notallowlisted # 付给 dEaD → Blocked(4)
  ```
- **画面**：切到 `/activity`，展示两条红色 `已拦截` 行及白话原因。
- **抓取**：两个 tx hash（拦截是成功的交易，有 hash 可查）+ activity 截图。
- **解说**：「AI 尝试付 5，超过单笔上限，被拦；又尝试付给白名单外的地址，也被拦。注意——拦截不是报错消失，而是链上一笔真实交易加一个事件，任何人都能验证。」

### 3.5 人工审批（2:40–3:20）

- **CLI**（产生 Pending，注意**不要**用 `scenario approval`，因为它会自动批准）：
  ```bash
  npm --prefix agent run pay 3      # 3 > 阈值 2.5 → Pending + ApprovalRequired
  ```
- **操作**：切到 `/approvals`，点 **刷新 / Refresh**，找到 `Pending` 行（金额 3 tUSD8）。
- **画面**：连着 OWNER 钱包，点该行的 **批准 / Approve**，钱包确认。
- **预期**：该行变 `Executed`；CLI 侧可用 `npm --prefix agent run status` 看当日额度已扣。
- **抓取**：Pending 截图 + Approve 后的截图 + tx hash ×2（付款 + 批准）。
- **解说**：「大额付款不会自动执行。它停在这里等我——人类点批准，钱才真正转出。这就是 human in the loop。」

### 3.6 每日上限 / 即时撤销 / 过期（3:20–3:50）

- **CLI**（三条各跑一次）：
  ```bash
  npm --prefix agent run scenario dailycap   # 先付 2 成功，再付 1 → Blocked(6)
  npm --prefix agent run scenario revoked    # 撤销 key #2 后付款 → Blocked(3)
  npm --prefix agent run scenario expired    # 强制过期 key #3 后付款 → Blocked(2)
  ```
- **画面**：`/activity` 展示新增拦截行，白话原因分别是「超过每日上限」「授权已撤销」「授权已过期」。
- **抓取**：3 个 tx hash + 截图。
- **解说**：「每日累计超限被拦；钥匙被撤销后立即失效；到期钥匙也被拦。撤销是即时的、不可绕过的。」

> 依赖提醒：`dailycap` 依赖前面 `allowed` 与人工审批已花掉 4 tUSD8（当日累计），这样第一笔 2 才能让累计正好到 6、第二笔 1 才触发 `Blocked(6)`。所以**必须按本分镜顺序录**，或至少先跑 `allowed` 和一笔已批准的 3，再跑 `dailycap`。

### 3.7 审计回执（3:50–4:20）

- **操作**：`/activity` 点某行的 **Receipt**，打开 `/verify/<paymentId>`；再点该行 **Tx ↗** 打开浏览器。
- **画面**：回执页的状态、金额、收款人、拦截原因；浏览器页的 tx 详情。
- **抓取**：回执页截图 + 浏览器 tx 截图。
- **解说**：「每一笔都能追溯到具体交易：状态、金额、收款人、拦截原因，全部在链上，可独立验证。」

### 3.8 收尾（4:20–4:30）

- **画面**：切到仓库 README 的 Live deployment 地址表，或一张写着地址与复现命令的静态卡片。
- **解说**：「全部开源，README 有完整复现步骤和双语文档。可用 `npm --prefix agent run demo` 一键复现七个场景。」

---

## 4. CLI 命令速查

| 命令 | 作用 | 预期 |
|---|---|---|
| `npm --prefix agent run setup` | 存 20 tUSD8 + 注册 3 把 key + 重置当日额度 | 打印策略与 tx 链接 |
| `npm --prefix agent run init` | 查看策略、余额、剩余额度 | 打印 `signer`（AGENT 地址） |
| `npm --prefix agent run scenario allowed` | 边界内付 1 | `Executed` |
| `npm --prefix agent run scenario cap` | 付 5 | `Blocked(5)` |
| `npm --prefix agent run scenario notallowlisted` | 付给 dEaD | `Blocked(4)` |
| `npm --prefix agent run pay 3` | 产生 Pending（供网页批准） | `Pending` + `ApprovalRequired` |
| `npm --prefix agent run approve <paymentId>` | 用 OWNER 私钥批准（CLI 方式） | `PaymentApproved` + `Executed` |
| `npm --prefix agent run scenario approval` | 一条龙：付 3 并自动批准 | `ApprovalRequired` → `Executed` |
| `npm --prefix agent run scenario dailycap` | 付 2 再付 1 | 第二笔 `Blocked(6)` |
| `npm --prefix agent run scenario revoked` | 撤销 key #2 后付 1 | `Blocked(3)` |
| `npm --prefix agent run scenario expired` | 强制过期 key #3 后付 1 | `Blocked(2)` |
| `npm --prefix agent run demo` | 一次跑完 7 场景（预热/备份） | 无 `SCENARIO FAILED` |

---

## 5. 场景触发逻辑与参数（为什么这样填能触发）

setup 给 AGENT 主 key 注册的策略：**单笔上限 4、每日上限 6、审批阈值 2.5、白名单仅 MERCHANT、4 小时到期**。`spentToday` 只在付款真正结算时累加；超过阈值的付款先进入 Pending，不累加。

| 顺序 | 场景 | 金额 | 计算 | 结果 |
|---|---|---|---|---|
| 1 | allowed | 1 | 1 ≤ 2.5，直接执行；当日 0→1 | `Executed` |
| 2 | cap | 5 | 5 > 单笔 4 | `Blocked(5)` |
| 3 | notallowlisted | 1 → dEaD | 收款人不在白名单 | `Blocked(4)` |
| 4 | pay 3 → 网页批准 | 3 | 3 > 阈值 2.5 → Pending；批准后当日 1→4 | `Executed` |
| 5 | dailycap 第一笔 | 2 | 2 ≤ 2.5；当日 4→6 | `Executed` |
| 5 | dailycap 第二笔 | 1 | 当日 6+1=7 > 6 | `Blocked(6)` |
| 6 | revoked | 1 | key #2 已撤销 | `Blocked(3)` |
| 7 | expired | 1 | key #3 已过期 | `Blocked(2)` |

拦截原因码（回执页/CLI 会显示）：`2` 已过期、`3` 已撤销、`4` 收款人不在白名单、`5` 超过单笔上限、`6` 超过每日上限、`7` vault 余额不足、`9` 签名窗口失效、`11` 报价签名无效。

> 这是本项目的一个关键正确性点：被拦截场景是**成功的链上交易**（发 `PaymentBlocked` 事件），不是 revert。这样才有有效 tx hash 可在浏览器验证。录制时不要把“拦截”说成“交易失败”。

---

## 6. 可靠性要点

- 录制前先跑一遍 `demo` 预热 RPC；确认全绿才开始。
- 严格按分镜顺序录，尤其 `dailycap` 依赖前面的累计（见 3.6 提醒）。
- 若当日累计已被之前的预热跑满，`setup` 会重置 `spentToday=0`、`dayStart=now`——**正式录制前务必再跑一次 `setup`**。
- key 只有 4 小时有效期；若录制超过 4 小时，重跑 `setup`。
- 测试网偶发不稳：可先在 `make fork` 上录完整流程（同样合约、真实 tUSD8），再补 2–3 笔 Aevum 真实交易作为 live proof。
- 被拦截交易有 hash；若浏览器短暂查不到，等几个区块再刷新。
- 全程不显示私钥；CLI 只打印地址。

---

## 7. 剪辑与成片

- 保留每条场景的 CLI JSON 一闪而过（能看到 `status` 和 `explorer` 即可），重点停在网页与浏览器。
- tx hash 用字幕叠上去，不必逐位念。
- 结尾放 3 秒静态卡片：仓库 URL + 4 个合约地址 + `npm --prefix agent run demo`。
- 导出 1080p，控制在 5 分钟内。

---

## 8. 评委验证清单

- [ ] 所有交易在 chain ID `44005`，浏览器链接可打开。
- [ ] 至少一笔 `PaymentExecuted` 真实转移 tUSD8。
- [ ] 至少一笔 `PaymentBlocked` 显示可解码原因。
- [ ] 审批流程有 Pending → 人工点击 → `Executed` 的完整画面。
- [ ] 回执页显示状态、金额、收款人、拦截原因。
- [ ] 全程无私钥暴露。
- [ ] README 有双语文档与一键复现命令。

---

## 9. 排障

| 现象 | 处理 |
|---|---|
| `SCENARIO FAILED dailycap` 且第二笔未拦 | 当日累计不足：先跑 `allowed` 和一笔已批准的 3，或重跑 `setup` 后按序录。 |
| 策略表单报 `InvalidBounds` | 单笔上限必须为 1–每日上限之间的正数；有效期必须 > 0。 |
| 网页 Approve 按钮灰着 | 未连 OWNER 钱包或网络不是 44005，先连接并切链。 |
| `/activity` 显示 `No guard events yet` | 先跑 CLI 场景产生事件。 |
| 首页仍是 `Checkout contract not set` | Vercel 服务旧构建，去 Deployments 手动 Redeploy。 |
| 交易一直 pending | 查 tQDAY 余额与 RPC 状态，不要重复提交。 |
| `invalid opcode: MCOPY` | 编译成了 Cancun；保持 `evm_version = "shanghai"`，运行 `make build`。 |
