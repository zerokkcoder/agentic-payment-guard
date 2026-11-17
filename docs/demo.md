# Demo script / 演示脚本

[中文版](./demo.zh-CN.md)

Target: a 3–5 minute video call presentation showing a live, reproducible workflow. Narrative: **humans set the boundaries; the AI pays inside them; out-of-bounds attempts are blocked and recorded on-chain.**

## Before recording

1. Deploy to Aevum testnet (see [deployment.md](./deployment.md)).
2. `npm --prefix agent run setup` — one deterministic funding + registration flow.
3. Open the web app on the Aevum network; confirm the dashboard loads with no errors.
4. Fund the relayer only if you plan to show gasless mode.

## Storyboard

| Time | Screen | On-chain action / capture |
|---|---|---|
| 0:00–0:30 | Dashboard + ERC-8004 identity card | Show registered agent #1 and its hosted registration JSON. |
| 0:30–1:00 | `/policies` | `deposit` + `registerSessionKey`; screenshot caps, allowlist, countdown; capture tx #1. |
| 1:00–1:45 | `/agent` → `scenario allowed` | `pay 1 → merchant`; `PaymentExecuted`; capture tx #2 + explorer screenshot. |
| 1:45–2:30 | `scenario cap`, `scenario notallowlisted` | Two `PaymentBlocked` events with reasons 5 and 4; capture tx #3/#4. |
| 2:30–3:15 | `scenario approval` → `/approvals` | `ApprovalRequired`, human clicks Approve, `PaymentApproved` + `PaymentExecuted`; capture #5/#6. |
| 3:15–3:45 | `scenario revoked` (and optionally `expired`) | Instant revocation / expiry; capture #7/#8. |
| 3:45–4:15 | `/activity` → `/verify/[paymentId]` | Scroll the audit feed, open one receipt, show decoded event + confirmations + explorer link. |
| 4:15–4:30 | Close | Repo URL, address table, "reproduce with `make demo`". |

## Reliability rules

- Run `npm --prefix agent run demo` once before recording to warm up the RPC and confirm all seven scenarios pass.
- Blocked scenarios use events, not reverts. The transaction hash is valid and the reason is visible in the explorer.
- If testnet is unstable, record the full flow on `make fork` (same contracts, real tUSD8), then add 2–3 live Aevum transactions as proof.
- Never show a private key on screen. The CLI prints only addresses.

## Verification checklist for judges

- [ ] All transactions are on chain ID `44005`.
- [ ] At least one `PaymentExecuted` transfers real tUSD8.
- [ ] At least one `PaymentBlocked` is visible with a decoded reason.
- [ ] An approval shows both `ApprovalRequired` and `PaymentExecuted`.
- [ ] Explorer links resolve for every captured hash.
