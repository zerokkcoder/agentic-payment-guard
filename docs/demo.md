# Video recording guide

[中文版](./demo.zh-CN.md)

This is a **follow-along guide** to produce a finished video. Target: 3–5 minutes, a real and reproducible end-to-end flow.

The story is one sentence: **a human sets the boundaries → the AI pays inside them → out-of-bounds attempts are blocked and recorded on-chain → large payments wait for human approval → every payment is verifiable on the explorer.**

Live addresses you will use throughout:

| Name | Value |
|---|---|
| Live site | https://agentic-payment-guard.vercel.app/ |
| Explorer | https://explorer-test.qday.info |
| Network | QDay Aevum testnet, chain ID `44005`, symbol tQDAY |
| tUSD8 | `0x456569838f1d43009A91ebA4263147Afd7233483` (6 decimals) |
| PaymentGuard | `0xBB8984Cdd7eFa0502E1FEcDEDb2e07b3080436c3` |
| Repository | https://github.com/zerokkcoder/agentic-payment-guard |

> Privacy red line: **never let a private key appear in the recording, a screenshot, or the visible terminal.** The CLI prints only addresses; the web app only shows addresses. The wallet-import screen, `.env` files, and plaintext keys must never be recorded.

---

## 1. Before you record

### 1.1 Four throwaway wallets

Use throwaway test wallets, never your main wallet. Four keys, four jobs:

| Role | Purpose | Needs funds |
|---|---|---|
| **OWNER / DEPLOYER** | deployer, vault owner, creates policies, approves, revokes, force-expires | ≥20 tUSD8 + plenty of tQDAY gas |
| **AGENT** | the AI's session key, sends payments | ~0.5 tQDAY gas |
| **QUOTE** | only signs EIP-712 quotes, never pays | none |
| **MERCHANT** | allowlisted recipient, address only | none |

Generate and import (Git Bash):

```bash
export PATH="$HOME/.foundry/bin:$PATH"
cast wallet new --json          # run 4 times, record each address and privateKey
cast wallet import aevum-deployer --private-key <OWNER_PRIVATE_KEY>
cast wallet address --account aevum-deployer
```

Import the **OWNER private key** into a browser wallet (MetaMask / Rabby): import key → add network `Chain ID 44005` / RPC `https://rpc-test.qday.info` / symbol `tQDAY`. Use a **separate browser profile** dedicated to the test wallet.

### 1.2 Get test funds and check balances

https://faucet.qday.info/en or Discord `/faucet <address>`, about 5 tUSD8 + 1 tQDAY per request. OWNER usually needs several requests to reach 20 tUSD8. AGENT needs at least one for gas.

```bash
cast balance <ADDR> --rpc-url https://rpc-test.qday.info
cast call 0x456569838f1d43009A91ebA4263147Afd7233483 \
  'balanceOf(address)(uint256)' <ADDR> --rpc-url https://rpc-test.qday.info
```

`balanceOf` returns 6-decimal wei: `20000000` = 20 tUSD8.

### 1.3 Fill `agent/.env` (field by field)

```bash
cd E:/zerokx/workbuddy-workspace/aevum-app
cp agent/.env.example agent/.env
```

| Variable | Value | Where it comes from |
|---|---|---|
| `RPC_URL` | `https://rpc-test.qday.info` | fixed |
| `CHAIN_ID` | `44005` | fixed |
| `GUARD_ADDRESS` | `0xBB8984Cdd7eFa0502E1FEcDEDb2e07b3080436c3` | table above |
| `IDENTITY_REGISTRY_ADDRESS` | `0xAc1E8054945A73744014c4f257e49AD45E10d17F` | README address table |
| `AGENT_ID` | `1` | on-chain agent #1 is registered |
| `AGENT_SESSION_PRIVATE_KEY` | AGENT private key | wallet #2 from 1.1 |
| `OWNER_PRIVATE_KEY` | OWNER private key | wallet #1 from 1.1, **must be the deployer** |
| `QUOTE_SIGNER_PRIVATE_KEY` | QUOTE private key | must match the `QUOTE_SIGNER` address used at deployment |
| `MERCHANT_ADDRESS` | MERCHANT address | address of wallet #4 from 1.1 |
| `EXPLORER_URL` | `https://explorer-test.qday.info` | fixed |

`.env*` is git-ignored. **Do not commit it, paste it into chat, or record it.**

### 1.4 Web configuration

The live site already has contract address defaults — **you do not need a local `web/.env.local`**. If you run `pnpm dev` locally, copy `web/.env.example` to `web/.env.local` and make sure `NEXT_PUBLIC_GUARD_AEVUM` etc. are the real addresses above.

### 1.5 One-time setup and warm-up

```bash
cd E:/zerokx/workbuddy-workspace/aevum-app
npm --prefix agent run setup     # deposit 20 tUSD8, register 3 scoped keys, reset daily spend
npm --prefix agent run init      # view policy, balances, daily remaining
npm --prefix agent run demo      # warm-up: confirm all 7 scenarios pass (do NOT record yet)
```

`setup` prints the owner, vault, each key's policy, and tx links. `init` prints the AGENT address (the `signer` field) — **remember it, you will need it for the web form.**

Warm-up is successful when no scenario shows `SCENARIO FAILED`. If any fails, troubleshoot with section 6 before recording.

### 1.6 Recording setup

- 1440×900 or higher, browser zoom 100%, fullscreen (F11).
- Close distracting wallet notifications; enlarge terminal font so tx hashes are readable.
- The terminal should show only CLI JSON output (addresses, hashes, links), never `.env`.
- After each scene, save the tx hash and explorer link to `takes.txt` for editing.

---

## 2. Page fill-in reference (every page, every field)

This is the core of the guide: **what to type in each input, where the value comes from, and why.** Keep this section open while recording.

### 2.1 Home / Overview (nothing to fill)

Just open the site. Five checks appear on the right: `Wallet connected`, `Network`, `Gas (tQDAY)`, `tUSD8 balance`, `PaymentGuard contract`. `PaymentGuard contract` should be green: `0xBB89…36c3 / Deployed and reachable`. There should be **no** `Checkout contract … not set`.

### 2.2 Connect wallet and network

Click Connect in the top right, choose the OWNER wallet. If a red banner says `Your wallet is on another network`, click **Switch network** in the banner and confirm 44005 in the wallet. Once connected, `Wallet connected` and `Network` turn green.

### 2.3 `/policies` — create a policy (field by field)

Click **Policies** in the nav. The left card `创建新策略 / Register a scoped key` has 7 inputs:

| # | Field (page label) | Default | Fill with | Source / why |
|---|---|---|---|---|
| 1 | `Session key (AI 地址)` | empty | **a new test address** (not the main AGENT key) | `cast wallet address --private-key <tempPK>`. A fresh address avoids overwriting the main AGENT policy used by the CLI scenarios. |
| 2 | `收款白名单 / Allowlist` | empty | MERCHANT address | `MERCHANT_ADDRESS` in `agent/.env`. The AI can only pay this address. |
| 3 | `存款 / Deposit (tUSD8)` | `20` | `1` (enough for the demo) | OWNER needs tUSD8; `1` conserves funds. |
| 4 | `单笔上限 / Per-tx cap` | `4` | `4` | Per-payment cap. |
| 5 | `每日上限 / Daily cap` | `6` | `6` | Daily total cap; must be ≥ per-tx cap. |
| 6 | `人工审批阈值 / Approval threshold` | `2.5` | `2.5` | Above this, a payment needs human approval. |
| 7 | `有效期（小时）/ Expires in (hours)` | `4` | `4` | Expiry = now + 4 hours. |

**Constraints**: per-tx and daily caps must be > 0 and per-tx ≤ daily; expiry must be in the future, otherwise the transaction reverts with a plain-language error.

Clicking **存入并注册 / Deposit & register** sends **3 transactions in a row**, so the wallet will ask for 3 confirmations:

1. `approve` — approve tUSD8
2. `deposit` — fund the vault
3. `registerSessionKey` — register the scoped key

The bottom `TxStatus` shows the last transaction's confirmation and explorer link. Wait for `已确认 / Confirmed · block …` before switching scenes.

### 2.4 `/policies` — inspect and revoke

The right card `查看并撤销 / Inspect & revoke` has 1 input:

| Field | Fill with | Source |
|---|---|---|
| `Session key` | the same address from 2.3 step 1 | what you just typed |

Once valid, it shows `Owner`, `Per-tx / Daily`, `Spent today`, `Expires`, `Active` (should be `yes`). Amounts are raw 6-decimal values (`4000000` = 4 tUSD8).

**立即撤销 / Revoke now** really revokes that key — do this last, or only revoke the temporary key. Do not revoke the main AGENT key or later payment scenes will all be blocked.

### 2.5 `/approvals` — human approval (no input, just buttons)

No inputs on this page, only buttons. To give it content, first create one Pending payment (see 3.5). Page elements:

- **刷新 / Refresh** (top right): re-read on-chain events.
- Each Pending row has **批准 / Approve** and **拒绝 / Reject**. A greyed-out button means the wallet is not connected or the network is wrong.
- Status chips: `Pending` (yellow), `Executed` (green), `Rejected` (red).

With the OWNER wallet connected on the right chain, click **批准 / Approve**; after wallet confirmation the row changes from `Pending` to `Executed`.

### 2.6 `/agent` — Agent console (read-only)

No input. Shows the 7-scenario list, ERC-8004 identity (`agent #1 URI` points to the live registration JSON), and `Quote signer`.

### 2.7 `/activity` — audit feed (read-only + links)

No input. Table columns: `Result` (Executed/Blocked/Pending), `Agent key`, `Recipient`, `Amount`, `Block`, `Links`. Two links per row:

- **Receipt** → opens `/verify/<paymentId>` (paymentId filled in automatically, nothing to type).
- **Tx ↗** → opens the explorer transaction page.

Blocked rows show a plain-language reason (e.g. `per-transaction cap exceeded`).

### 2.8 `/verify/[paymentId]` — where the URL's paymentId comes from

The "fill-in" here happens in the **URL**: `https://agentic-payment-guard.vercel.app/verify/<paymentId>`.

Two sources, pick either:

1. **CLI output**: each scenario's JSON has a `paymentId` field (`0x`, 66 chars). Copy it into the URL.
2. **Activity table**: click **Receipt** on any row; the browser fills it in.

The page shows `状态 / Status`, `Session key`, `收款人 / Recipient`, `金额 / Amount`, and when blocked, `拦截原因 / Block reason` (with reason code).

---

## 3. Storyboard and step-by-step actions

Record in this order. Each scene lists: **screen → action → page/CLI → expected → captures → narration (readable aloud)**.

### 3.0 Opening (0:00–0:25)

- **Screen**: home / Overview.
- **Action**: OWNER wallet connected, show the five green checks.
- **Narration**: "This is a controlled-payment wallet for an AI agent. A human sets the boundaries first; the agent can only spend on-chain inside them, and every out-of-bounds attempt is blocked and recorded on-chain."

### 3.1 Identity and console (0:25–0:45)

- **Screen**: click **Agent**.
- **Action**: scroll through the 7 scenarios and the ERC-8004 identity card; point at the live JSON link in `agent #1 URI`.
- **Capture**: identity card screenshot.

### 3.2 Human sets boundaries (0:45–1:30)

- **Screen**: click **Policies**.
- **Action**: fill the 7 inputs per the 2.3 table (say each field name as you type); click `存入并注册`, confirm 3 wallet prompts.
- **Expected**: `已确认 / Confirmed`.
- **Capture**: full-screen screenshot before submitting + 3 tx hashes.
- **Narration**: "I deposit funds and give the AI a key with boundaries: at most 4 per payment, 6 per day, anything over 2.5 needs my approval, it expires in 4 hours, and it can only pay the allowlisted merchant."

### 3.3 Payment inside the boundaries (1:30–2:00)

- **Screen**: alternate between CLI and web `/activity`.
- **CLI**:
  ```bash
  npm --prefix agent run scenario allowed
  ```
- **Expected**: JSON has `status: Executed`, `explorer` is a link.
- **Action**: copy `paymentId`, open `/activity`, point at the new green `已执行` row.
- **Capture**: CLI JSON screenshot + activity row screenshot + tx hash.
- **Narration**: "The AI makes a 1 tUSD8 payment — inside the boundaries, executed successfully on-chain."

### 3.4 Out-of-bounds blocks (2:00–2:40)

- **CLI** (run each once):
  ```bash
  npm --prefix agent run scenario cap             # pay 5 > per-tx cap 4 → Blocked(5)
  npm --prefix agent run scenario notallowlisted  # pay to dEaD → Blocked(4)
  ```
- **Screen**: switch to `/activity`, show the two red `已拦截` rows and their plain-language reasons.
- **Capture**: two tx hashes (a block is a successful transaction with a hash) + activity screenshot.
- **Narration**: "The AI tries to pay 5 — over the per-tx cap, blocked. It tries a non-allowlisted address — blocked too. Notice a block is not a silent failure: it is a real on-chain transaction plus an event that anyone can verify."

### 3.5 Human approval (2:40–3:20)

- **CLI** (create a Pending — do **not** use `scenario approval`, which auto-approves):
  ```bash
  npm --prefix agent run pay 3      # 3 > threshold 2.5 → Pending + ApprovalRequired
  ```
- **Action**: go to `/approvals`, click **刷新 / Refresh**, find the `Pending` row (3 tUSD8).
- **Screen**: with the OWNER wallet connected, click **批准 / Approve** on that row, confirm in the wallet.
- **Expected**: row becomes `Executed`; on the CLI side `npm --prefix agent run status` shows the daily allowance reduced.
- **Capture**: Pending screenshot + post-Approve screenshot + 2 tx hashes (payment + approval).
- **Narration**: "A large payment is not executed automatically. It stops here and waits for me — when the human clicks Approve, the money actually moves. This is human in the loop."

### 3.6 Daily cap / instant revoke / expiry (3:20–3:50)

- **CLI** (run each once):
  ```bash
  npm --prefix agent run scenario dailycap   # pay 2 succeeds, then pay 1 → Blocked(6)
  npm --prefix agent run scenario revoked    # revoke key #2, then pay 1 → Blocked(3)
  npm --prefix agent run scenario expired    # force-expire key #3, then pay 1 → Blocked(2)
  ```
- **Screen**: `/activity` shows the new blocked rows with reasons "daily cap exceeded", "session revoked", "session expired".
- **Capture**: 3 tx hashes + screenshots.
- **Narration**: "The daily cumulative cap blocks it; a revoked key stops immediately; an expired key is blocked too. Revocation is instant and cannot be bypassed."

> Dependency note: `dailycap` relies on 4 tUSD8 already spent by `allowed` and the approved payment (daily total), so the first payment of 2 brings the total to exactly 6 and the second payment of 1 triggers `Blocked(6)`. **Record in storyboard order**, or at least run `allowed` and one approved payment of 3 before `dailycap`.

### 3.7 Audit receipt (3:50–4:20)

- **Action**: on `/activity` click **Receipt** on a row to open `/verify/<paymentId>`; then click **Tx ↗** on that row to open the explorer.
- **Screen**: the receipt page's status, amount, recipient, block reason; the explorer tx details.
- **Capture**: receipt screenshot + explorer tx screenshot.
- **Narration**: "Every payment can be traced to a specific transaction: status, amount, recipient, block reason — all on-chain and independently verifiable."

### 3.8 Closing (4:20–4:30)

- **Screen**: the repo README's Live deployment table, or a static card with addresses and reproduction commands.
- **Narration**: "Everything is open source, the README has full reproduction steps and bilingual docs. Reproduce all seven scenarios with `npm --prefix agent run demo`."

---

## 4. CLI command quick reference

| Command | Purpose | Expected |
|---|---|---|
| `npm --prefix agent run setup` | deposit 20 tUSD8 + register 3 keys + reset daily spend | prints policies and tx links |
| `npm --prefix agent run init` | view policy, balances, remaining | prints `signer` (AGENT address) |
| `npm --prefix agent run scenario allowed` | pay 1 inside policy | `Executed` |
| `npm --prefix agent run scenario cap` | pay 5 | `Blocked(5)` |
| `npm --prefix agent run scenario notallowlisted` | pay to dEaD | `Blocked(4)` |
| `npm --prefix agent run pay 3` | create a Pending for web approval | `Pending` + `ApprovalRequired` |
| `npm --prefix agent run approve <paymentId>` | approve with OWNER key (CLI path) | `PaymentApproved` + `Executed` |
| `npm --prefix agent run scenario approval` | all-in-one: pay 3 and auto-approve | `ApprovalRequired` → `Executed` |
| `npm --prefix agent run scenario dailycap` | pay 2 then 1 | second `Blocked(6)` |
| `npm --prefix agent run scenario revoked` | revoke key #2 then pay 1 | `Blocked(3)` |
| `npm --prefix agent run scenario expired` | force-expire key #3 then pay 1 | `Blocked(2)` |
| `npm --prefix agent run demo` | run all 7 scenarios (warm-up/backup) | no `SCENARIO FAILED` |

---

## 5. Why the scenarios trigger (logic and parameters)

`setup` registers the AGENT main key with: **per-tx cap 4, daily cap 6, approval threshold 2.5, allowlist = MERCHANT only, 4-hour expiry.** `spentToday` increases only when a payment settles; a payment above the threshold first goes Pending and does not count.

| Order | Scenario | Amount | Calculation | Result |
|---|---|---|---|---|
| 1 | allowed | 1 | 1 ≤ 2.5, executes; daily 0→1 | `Executed` |
| 2 | cap | 5 | 5 > per-tx 4 | `Blocked(5)` |
| 3 | notallowlisted | 1 → dEaD | recipient not allowlisted | `Blocked(4)` |
| 4 | pay 3 → web approve | 3 | 3 > threshold 2.5 → Pending; after approval daily 1→4 | `Executed` |
| 5 | dailycap first | 2 | 2 ≤ 2.5; daily 4→6 | `Executed` |
| 5 | dailycap second | 1 | daily 6+1=7 > 6 | `Blocked(6)` |
| 6 | revoked | 1 | key #2 already revoked | `Blocked(3)` |
| 7 | expired | 1 | key #3 already expired | `Blocked(2)` |

Block reason codes (shown in the receipt page / CLI): `2` expired, `3` revoked, `4` recipient not allowlisted, `5` per-tx cap, `6` daily cap, `7` insufficient vault, `9` intent window expired, `11` invalid quote.

> Key correctness point: a blocked scenario is a **successful on-chain transaction** (it emits `PaymentBlocked`), not a revert. That is what gives a valid tx hash verifiable on the explorer. Do not describe a "block" as a "failed transaction" in the video.

---

## 6. Reliability

- Warm up with `demo` before recording; make sure everything is green.
- Record in storyboard order, especially `dailycap` which depends on prior spend (see 3.6 note).
- If the daily total is already used up by a warm-up run, `setup` resets `spentToday=0` and `dayStart=now` — **run `setup` again right before the real recording**.
- Keys expire after 4 hours; if recording runs long, re-run `setup`.
- If the testnet is flaky: record the full flow on `make fork` (same contracts, real tUSD8), then add 2–3 live Aevum transactions as live proof.
- Blocked transactions have hashes; if the explorer is slow, wait a few blocks and refresh.
- Never show a private key; the CLI prints only addresses.

---

## 7. Editing and final output

- Let each scenario's CLI JSON flash briefly (enough to see `status` and `explorer`), then dwell on the web app and explorer.
- Overlay tx hashes as subtitles; no need to read them digit by digit.
- End with a 3-second static card: repo URL + 4 contract addresses + `npm --prefix agent run demo`.
- Export 1080p, keep it under 5 minutes.

---

## 8. Judge verification checklist

- [ ] All transactions on chain ID `44005`, explorer links open.
- [ ] At least one `PaymentExecuted` transfers real tUSD8.
- [ ] At least one `PaymentBlocked` shows a decodable reason.
- [ ] Approval flow shows Pending → human click → `Executed` end to end.
- [ ] Receipt page shows status, amount, recipient, block reason.
- [ ] No private key exposure anywhere.
- [ ] README has bilingual docs and a one-command reproduction.

---

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| `SCENARIO FAILED dailycap`, second payment not blocked | daily total too low: run `allowed` and one approved 3 first, or re-run `setup` and record in order. |
| Policy form reports `InvalidBounds` | per-tx cap must be a positive number ≤ daily cap; expiry must be > 0. |
| Web Approve button is greyed out | OWNER wallet not connected or network is not 44005 — connect and switch chain. |
| `/activity` shows `No guard events yet` | run CLI scenarios first to produce events. |
| Home still shows `Checkout contract not set` | Vercel is serving an old build — Redeploy from Deployments. |
| Transaction stuck pending | check tQDAY balance and RPC status; do not resubmit. |
| `invalid opcode: MCOPY` | compiled for Cancun; keep `evm_version = "shanghai"` and run `make build`. |
