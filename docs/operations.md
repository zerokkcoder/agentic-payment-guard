# Operations guide

[中文版](./operations.zh-CN.md)

This is the complete record for reproducing the project, running the demo, going live and submitting to the hackathon. Use throwaway test wallets only. Never commit or paste private keys.

## Current state

| Item | Value |
|---|---|
| Repository | https://github.com/zerokkcoder/agentic-payment-guard |
| Live demo | https://agentic-payment-guard.vercel.app/ |
| Network | QDay Aevum testnet, chain ID `44005` |
| PaymentGuard | `0xBB8984Cdd7eFa0502E1FEcDEDb2e07b3080436c3` |
| AgentIdentityRegistry | `0xAc1E8054945A73744014c4f257e49AD45E10d17F` |
| ReputationRegistry | `0xEE7029AAAaFdB8108e2fACC8F0cd2704266Ee2E7` |
| ValidationRegistry | `0x1348E3B74C1E2b09fa44d86f7d1Aad78179Cf09f` |
| tUSD8 | `0x456569838f1d43009A91ebA4263147Afd7233483`, 6 decimals |
| Deployment block | `3383476` |
| ERC-8004 agent #1 | Registered; `tokenURI` points to the live `/registry/agent-1.json` |
| Local validation | 32 unit tests + 4 Aevum fork tests + typecheck + Next.js build all pass |

## 0. Prerequisites

- Node 22+, pnpm, Foundry.
- In this sandbox Foundry lives at `$HOME/.foundry/bin`: `export PATH="$HOME/.foundry/bin:$PATH"`.
- If Foundry cannot reach the Aevum RPC directly, start the bridge with `make rpc-proxy` and add `AEVUM_RPC=http://127.0.0.1:8546` to every Foundry command.

## 1. Test wallets and funds

Generate four throwaway wallets:

```bash
export PATH="$HOME/.foundry/bin:$PATH"
cast wallet new --json   # run four times: OWNER, AGENT, QUOTE, MERCHANT
```

| Wallet | Purpose | Funds needed |
|---|---|---|
| OWNER / DEPLOYER | Deploy, deposit 20 tUSD8, register policies, approve, revoke, force-expire | ≥20 tUSD8 + several tQDAY |
| AGENT | Scoped session key that pays | ~0.5 tQDAY |
| QUOTE | Signs EIP-712 quotes for web and agent | none |
| MERCHANT | Allowlisted recipient; address only | none |

Import the owner key into the Foundry keystore:

```bash
cast wallet import aevum-deployer --private-key <OWNER_PRIVATE_KEY>
cast wallet address --account aevum-deployer
```

Get test tokens from https://faucet.qday.info/en or Discord `/faucet <address>`. Each call gives about 5 tUSD8 + 1 tQDAY; the owner usually needs several calls. Check balances:

```bash
cast balance <ADDR> --rpc-url https://rpc-test.qday.info
cast call 0x456569838f1d43009A91ebA4263147Afd7233483 \
  'balanceOf(address)(uint256)' <ADDR> --rpc-url https://rpc-test.qday.info
```

`balanceOf` returns 6-decimal wei: `20000000` = 20 tUSD8.

## 2. Deploy contracts (reproduction only)

The live contracts already exist. Run this only when rebuilding:

```bash
cd E:/zerokx/workbuddy-workspace/aevum-app
make rpc-proxy   # terminal 1, only if Foundry cannot reach the RPC

# terminal 2
QUOTE_SIGNER=<QUOTE_ADDR> make deploy-all-aevum \
  ACCOUNT=aevum-deployer \
  AEVUM_RPC=http://127.0.0.1:8546
```

Record the four printed addresses and the deployment block (`cast block-number --rpc-url https://rpc-test.qday.info`). On a direct network, drop the `AEVUM_RPC=` override.

## 3. Environment variables

```bash
cp web/.env.example web/.env.local
cp agent/.env.example agent/.env
```

`web/.env.local`:

```
NEXT_PUBLIC_NETWORKS=aevum
NEXT_PUBLIC_GUARD_AEVUM=0xBB8984Cdd7eFa0502E1FEcDEDb2e07b3080436c3
NEXT_PUBLIC_IDENTITY_AEVUM=0xAc1E8054945A73744014c4f257e49AD45E10d17F
NEXT_PUBLIC_REPUTATION_AEVUM=0xEE7029AAAaFdB8108e2fACC8F0cd2704266Ee2E7
NEXT_PUBLIC_VALIDATION_AEVUM=0x1348E3B74C1E2b09fa44d86f7d1Aad78179Cf09f
NEXT_PUBLIC_DEPLOY_BLOCK_AEVUM=3383476
NEXT_PUBLIC_REPO_URL=https://github.com/zerokkcoder/agentic-payment-guard
QUOTE_SIGNER_PRIVATE_KEY=<QUOTE private key matching the deploy-time address>
TRUSTED_IP_HEADER=x-vercel-forwarded-for
```

`web/src/lib/env.ts` now has public address/block defaults, so a Vercel import missing a `NEXT_PUBLIC_*` variable still renders. `QUOTE_SIGNER_PRIVATE_KEY` is server-only and has no default; it must be configured.

`agent/.env`:

```
RPC_URL=https://rpc-test.qday.info
CHAIN_ID=44005
GUARD_ADDRESS=0xBB8984Cdd7eFa0502E1FEcDEDb2e07b3080436c3
IDENTITY_REGISTRY_ADDRESS=0xAc1E8054945A73744014c4f257e49AD45E10d17F
AGENT_ID=1
AGENT_SESSION_PRIVATE_KEY=<AGENT private key>
OWNER_PRIVATE_KEY=<OWNER private key; must be the deployer for force-expiry>
QUOTE_SIGNER_PRIVATE_KEY=<QUOTE private key>
MERCHANT_ADDRESS=<MERCHANT address>
EXPLORER_URL=https://explorer-test.qday.info
```

All `.env*` files are gitignored. Do not commit them or paste them anywhere.

## 4. Run the demo locally

```bash
cd E:/zerokx/workbuddy-workspace/aevum-app
npm --prefix agent run setup     # deposit 20 tUSD8 + register three scoped keys, once
npm --prefix agent run init
npm --prefix agent run demo | tee demo-output.txt
pnpm --filter web build && pnpm dev
```

| Scenario | Action | Expected |
|---|---|---|
| `allowed` | pay 1 to merchant | `PaymentExecuted` |
| `cap` | pay 5 | `PaymentBlocked(5)`, per-tx cap |
| `notallowlisted` | pay 1 to `0x...dEaD` | `PaymentBlocked(4)` |
| `approval` | pay 3 | `ApprovalRequired` → owner approves → `PaymentExecuted` |
| `dailycap` | pay 2 then 1 | first succeeds (daily total reaches 6), second `PaymentBlocked(6)` |
| `revoked` | revoke key #2, pay 1 | `PaymentBlocked(3)` |
| `expired` | force-expire key #3, pay 1 | `PaymentBlocked(2)` |

Blocked scenarios are successful transactions that emit an event instead of reverting, so their hashes are valid and the reason decodes in the explorer. `demo-output.txt` is the evidence for the video and submission.

## 5. Vercel

The live site is https://agentic-payment-guard.vercel.app/

- Keep the whole repository connected and set **Root Directory = `web`**. The app imports `packages/aevum` through the pnpm workspace, so Vercel needs the root `pnpm-lock.yaml`.
- Public addresses have code defaults; still set the `NEXT_PUBLIC_*` variables and `QUOTE_SIGNER_PRIVATE_KEY` in Vercel explicitly.
- If a push does not update the site, use Deployments → latest → `...` → **Redeploy** and check Settings → Git integration.
- `/api/quote` is POST-only; a 405 on GET is expected.

## 6. Fill in docs and commit

These are already filled; change them only when redeploying:

- Live deployment tables in `README.md` / `README.zh-CN.md`.
- Address tables and deployment block in `docs/deployment.md` / `docs/deployment.zh-CN.md`.
- `agentRegistry` in `docs/registry/agent-1.json` and `web/public/registry/agent-1.json`.

```bash
git add -A
git commit -m "docs: update deployment"
git push origin main
```

## 7. Record the video and submit

Follow `docs/demo.md`: human sets limits → agent pays → out-of-policy attempts are blocked on-chain → human approval → audit receipt. Capture every tx hash and explorer screenshot. Never show a private key on screen.

- Submission deadline: **2026-12-11 16:00 HKT**
- Demo Day: **2026-12-15**
- Submission page: https://dorahacks.io/hackathon/qday/detail

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `invalid opcode: MCOPY` | Built for Cancun. Keep `evm_version = "shanghai"` and run `make build`. |
| `eth_getLogs` range error | Max 1,000 blocks per call; use `getLogsChunked`. |
| Fork tests fail | Start `make rpc-proxy` and pass `AEVUM_RPC=http://127.0.0.1:8546`. |
| `PaymentGuard not set` on home | Check `NEXT_PUBLIC_GUARD_AEVUM` / code defaults; Redeploy on Vercel. |
| `/api/quote` 405 | Expected; POST only. |
| Explorer verifier fails | Aevum Blockscout verifier is unavailable. Submit addresses, source commit and ABI hash instead. |
