# Agent CLI

[中文版](./agent.zh-CN.md)

`agent/` is a standalone TypeScript package in the pnpm workspace. It uses viem + `@aevum-kit/aevum` and acts as the AI agent in the demo.

## Setup

```bash
cp agent/.env.example agent/.env
# fill in GUARD_ADDRESS, deployed addresses, and three TEST private keys
npm --prefix agent run setup
npm --prefix agent run init
```

Never use a key holding real value. The agent key needs a little tQDAY for direct `pay`; the owner key needs tUSD8 and tQDAY; the quote key must match the address passed to `PaymentGuard` at deployment.

## Commands

| Command | Purpose |
|---|---|
| `init` / `status` | Print chain ID, policy, vault balance, daily remaining, expiry, quote signer. |
| `setup` | Approve + deposit 20 tUSD8, register the main, revoked and expired session keys. |
| `pay <amount>` | Pay the configured merchant from the main session key. |
| `approve <paymentId>` | Owner approves a pending payment. |
| `scenario <name>` | Run one scenario. |
| `demo` | Run all seven scenarios in order, printing results after each. |

## Environment variables

| Variable | Description |
|---|---|
| `RPC_URL` | `https://rpc-test.qday.info` (or local fork URL). |
| `CHAIN_ID` | `44005` on Aevum, `440050` on `make fork`. |
| `GUARD_ADDRESS` | Deployed `PaymentGuard`. |
| `IDENTITY_REGISTRY_ADDRESS` | Deployed ERC-8004 identity registry. |
| `AGENT_ID` | Numeric agent ID; default `1`. |
| `AGENT_SESSION_PRIVATE_KEY` | The scoped session key granted to the agent. |
| `OWNER_PRIVATE_KEY` | Vault owner; deposits, registers, approves, revokes, expires. |
| `QUOTE_SIGNER_PRIVATE_KEY` | Local quote signing. Alternatively set `QUOTE_API_URL`. |
| `QUOTE_API_URL` | Optional server endpoint that returns `{signature}`. |
| `MERCHANT_ADDRESS` | Allowlisted recipient used by scenarios. |
| `EXPLORER_URL` | Used to print tx links. |

## Scenarios and expected results

Demo setup uses `perTxCap = 4`, `dailyCap = 8`, `approvalThreshold = 2.5`, `vault = 20`, `expiresAt = now + 4h`, allowlist = `[merchant]`.

| Scenario | Action | Expected |
|---|---|---|
| `allowed` | pay 1 to merchant | `PaymentExecuted`, merchant +1 |
| `cap` | pay 5 | `PaymentBlocked(5)` per-tx cap |
| `notallowlisted` | pay 1 to 0x…dEaD | `PaymentBlocked(4)` |
| `approval` | pay 3 | `ApprovalRequired`; CLI then calls `approve` with owner key → `PaymentExecuted` |
| `dailycap` | pay 2, then pay 1 | first executes (daily total reaches 6), second `PaymentBlocked(6)` |
| `revoked` | revoke key #2, pay 1 | `PaymentBlocked(3)` |
| `expired` | force-expire key #3, pay 1 | `PaymentBlocked(2)` |

Each output line contains `paymentId`, `txHash`, `block`, `status`, `reason` and an explorer link. Blocked scenarios are successful transactions because the contract emits rather than reverts.

## Gasless path

`PaymentGuard.payWithSignature` is covered by `testGaslessPayment` in Foundry. To relay it from a server, POST the payment struct, `sessionSig` and `quoteSig` to `/api/relay-guard`; the route simulates first, rate-limits per IP and requires `RELAYER_PRIVATE_KEY`.
