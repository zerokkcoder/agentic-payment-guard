# Live manual test checklist

[中文版](./manual-test.zh-CN.md)

Anyone can use this checklist against **https://agentic-payment-guard.vercel.app/** without reading code. Read-only checks cost nothing and change nothing. Write checks need test funds and really change chain state.

## Test environment

| Item | Value |
|---|---|
| Site | https://agentic-payment-guard.vercel.app/ |
| Wallet | MetaMask / Rabby or another EVM wallet |
| Network | QDay Aevum testnet |
| Chain ID | `44005` |
| RPC | `https://rpc-test.qday.info` |
| Symbol | tQDAY |
| Explorer | https://explorer-test.qday.info |
| tUSD8 | `0x456569838f1d43009A91ebA4263147Afd7233483` |
| PaymentGuard | `0xBB8984Cdd7eFa0502E1FEcDEDb2e07b3080436c3` |

Add the network in your wallet first. The site also offers a `Switch network` button when it detects the wrong chain.

---

## A. Read-only checks

### A1. Home page

**Steps**: Open the site without connecting a wallet.

**Expected**

- Title `Is your setup ready for Aevum?`, lede mentions `PaymentGuard contract`.
- Five checks: `Wallet connected`, `Network`, `Gas (tQDAY)`, `tUSD8 balance`, `PaymentGuard contract`.
- `PaymentGuard contract` is green, shows `0xBB89...36c3`, detail `Deployed and reachable...`.
- No `Checkout contract` and no `not set` warning.
- Score should be `1 / 5` with `4 items to fix`.

**Evidence**: full-page screenshot.

### A2. Navigation

**Steps**: Click `Overview`, `Policies`, `Approvals`, `Agent`, `Activity`, `Docs`.

**Expected**

- Every route loads, no 404 or blank page.
- No red errors in the browser console (missing wallet extension notices aside).
- The `GitHub` link points to `https://github.com/zerokkcoder/agentic-payment-guard`.

### A3. ERC-8004 registration JSON

**Steps**: Open https://agentic-payment-guard.vercel.app/registry/agent-1.json

**Expected**

- Valid JSON.
- `registrations[0].agentRegistry` is `eip155:44005:0xAc1E8054945A73744014c4f257e49AD45E10d17F`.
- `services[0].endpoint` is the live site URL.
- `active` is `true`.

### A4. Agent console

**Steps**: Open `/agent`.

**Expected**

- Title `AI Agent 支付演示`.
- Commands `cp agent/.env.example agent/.env`, `npm --prefix agent run setup`, `npm --prefix agent run demo`.
- Seven scenarios listed in English and Chinese: `allowed`, `approval`, `cap`, `notallowlisted`, `dailycap`, `revoked`, `expired`.
- An `ERC-8004 身份 / Agent identity` section explaining the self-deployment.

### A5. Empty approval queue

**Steps**: Open `/approvals`.

**Expected**

- Title `审批队列 / Approval queue`.
- `暂无审批请求 / No requests yet.` if no `approval` scenario has run.
- `刷新 / Refresh` works.

### A6. Empty activity feed

**Steps**: Open `/activity`.

**Expected**

- Title `链上活动 / On-chain activity`.
- `No guard events yet. Run npm --prefix agent run demo.` when empty.
- No `Set NEXT_PUBLIC_GUARD_...` configuration warning.

### A7. Verification page tolerance

**Steps**: Open `/verify/0x0000000000000000000000000000000000000000000000000000000000000001`.

**Expected**

- Title `付款验证 / Verify a payment` and the same paymentId.
- No crash or blank page; a clear status or empty state.

---

## B. Wallet and network checks

### B1. Connect

**Steps**: Connect the wallet, choosing an Aevum account, then return home.

**Expected**

- `Wallet connected` green with abbreviated address.
- `Network` green, `chain 44005`.
- Funded balances show green.

### B2. Wrong network

**Steps**: Switch the wallet to Ethereum Mainnet or another chain.

**Expected**

- Red banner: `Your wallet is on another network. This app is set to QDay Aevum testnet (44005).`
- Clicking `Switch network` opens the wallet prompt; after confirming, the banner disappears and `Network` is green.

### B3. Add tUSD8

**Steps**: Click `Add tUSD8 to wallet` when the balance check is zero.

**Expected**: wallet asks to add token `0x4565...3483`, 6 decimals.

---

## C. Write checks (optional, changes live state)

Use throwaway wallets only. The owner address needs tUSD8 and tQDAY. Every transaction should leave an explorer link.

### C1. Register a policy

**Steps**

1. Open `/policies` with the OWNER wallet.
2. Fill in: session key, allowlisted recipient, deposit `1`, per-tx cap `0.5`, daily cap `1`, approval threshold `0.2`, expiry `4` hours.
3. Click `存入并注册 / Deposit & register` and confirm.

**Expected**

- Tx status component finishes with an explorer link.
- Inspecting the same session key shows Owner, Per-tx / Daily, Spent today, Expires, Active=yes.

### C2. Revoke

Click `立即撤销 / Revoke now` and confirm. `Active` becomes `no`.

### C3. Human approval

Run the `approval` scenario locally first to create a Pending payment. Then on `/approvals`, click `刷新 / Refresh`, choose `批准 / Approve` or `拒绝 / Reject`, and confirm. Status changes to `Executed` or `Rejected`.

### C4. Receipt

Take a real `paymentId` from `demo-output.txt` and open `/verify/<paymentId>`. Expected: status, decoded event, amount, recipient, confirmations and a working explorer link.

---

## D. Mobile

Open home, `/policies` and `/activity` at 375px width. Navigation must not overflow, tables must not break the layout, buttons must be tappable.

---

## Pass criteria

- [ ] A1 shows PaymentGuard, not Checkout.
- [ ] A2: all six routes load.
- [ ] A3: `agentRegistry` is a real address, not `TBD`.
- [ ] A4: all seven scenarios are documented.
- [ ] B1/B2: wallet connect and wrong-network banner work.
- [ ] If write checks were run: every tx has an explorer link.

## Troubleshooting

| Symptom | Meaning |
|---|---|
| `/api/quote` 405 | Expected; POST only. |
| `No guard events yet` | Expected until `agent run demo` runs locally. |
| Home still shows `Checkout contract not set` | Vercel is serving an old build; Redeploy. |
| Registry JSON still shows `TBD` | Same; Redeploy and recheck. |
| Transaction stuck pending | Check tQDAY balance and Aevum RPC status; do not resubmit blindly. |
