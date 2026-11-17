# Deployment / 部署

[中文版](./deployment.zh-CN.md)

## Network facts

| Field | Value |
|---|---|
| Network | QDay Aevum Testnet |
| Chain ID | `44005` (`0xABE5`) |
| RPC | `https://rpc-test.qday.info` (HTTPS only) |
| Explorer | `https://explorer-test.qday.info` |
| Faucet | `https://faucet.qday.info/en` or Discord `/faucet <address>` |
| Gas token | tQDAY, 18 decimals, ~1 gwei |
| tUSD8 | `0x456569838f1d43009A91ebA4263147Afd7233483`, 6 decimals |
| EVM | Shanghai; legacy (type 0) transactions from scripts |

## Deploy the stack

```bash
cast wallet import aevum-deployer --interactive
cast wallet address --account aevum-deployer   # fund this address
export QUOTE_SIGNER=<address of your quote-signing test key>
make deploy-all-aevum ACCOUNT=aevum-deployer
```

The script deploys `AgentIdentityRegistry`, `ReputationRegistry`, `ValidationRegistry` and `PaymentGuard` in one transaction batch and prints their addresses. Record the deployment block for the Activity page.

### Deployed addresses (fill after deployment)

| Contract | Aevum testnet | Fork (440050) | Local (31337) |
|---|---|---|---|
| PaymentGuard | `TBD` | `TBD` | `TBD` |
| AgentIdentityRegistry | `TBD` | `TBD` | `TBD` |
| ReputationRegistry | `TBD` | `TBD` | `TBD` |
| ValidationRegistry | `TBD` | `TBD` | `TBD` |
| tUSD8 | `0x456569838f1d43009A91ebA4263147Afd7233483` | same | MockUSD8 |

## Environment variables

### `web/.env.local`

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_NETWORKS` | `aevum,fork,local` (first is default). |
| `NEXT_PUBLIC_GUARD_AEVUM` / `_FORK` / `_LOCAL` | PaymentGuard address per network. |
| `NEXT_PUBLIC_IDENTITY_AEVUM` / `_FORK` / `_LOCAL` | Identity registry address. |
| `NEXT_PUBLIC_REPUTATION_AEVUM` / `NEXT_PUBLIC_VALIDATION_AEVUM` | Optional registry addresses. |
| `NEXT_PUBLIC_DEPLOY_BLOCK_AEVUM` | Block to start scanning events from. |
| `NEXT_PUBLIC_REPO_URL` | GitHub repo URL used by the Docs page. |
| `QUOTE_SIGNER_PRIVATE_KEY` | Server-only. Must match the deployed `quoteSigner`. |
| `RELAYER_PRIVATE_KEY` | Server-only. Fresh test wallet with a little tQDAY. |
| `TRUSTED_IP_HEADER` | `x-vercel-forwarded-for` on Vercel. |

### `agent/.env`

See [agent.md](./agent.md#environment-variables). Never commit either `.env` file.

## Vercel

Import the repo, set **Root Directory = `web`**, add the variables above, deploy. The whole repo must remain connected because `web` imports `packages/aevum` through the pnpm workspace and Vercel reads `pnpm-lock.yaml` at the root. The README's one-click deploy button already points at `zerokkcoder/agentic-payment-guard`; if you fork it, change the `repository-url` query parameter to your fork.

## Verification caveat

The Blockscout verifier on Aevum is not working; `forge verify-contract` fails. Include the deployed address, the exact source commit and the ABI hash in your submission. When the verifier is back:

```bash
forge verify-contract <address> src/PaymentGuard.sol:PaymentGuard --chain-id 44005 \
  --verifier blockscout --verifier-url https://explorer-test.qday.info/api/
```

## Foundry behind a TLS proxy

In some networks PowerShell / Node can reach `https://rpc-test.qday.info` but Foundry's Rust HTTP client cannot, because of a TLS-intercepting proxy. Start a local HTTP→HTTPS JSON-RPC bridge (it forwards payloads only, never keys):

```bash
make rpc-proxy                 # terminal 1: 127.0.0.1:8546 -> Aevum RPC
make test-fork AEVUM_RPC=http://127.0.0.1:8546
# To deploy from that machine, override AEVUM_RPC the same way:
make deploy-all-aevum AEVUM_RPC=http://127.0.0.1:8546 ACCOUNT=aevum-deployer
```

The bridge is `tools/rpc-proxy.mjs`; `PORT` and `UPSTREAM_RPC` can override its endpoint.

## Troubleshooting

- `invalid opcode` → compiled for Cancun. Keep `evm_version = "shanghai"` and run `make build`.
- `eth_getLogs` range error → use `getLogsChunked`, max 1,000 blocks.
- No WebSocket → poll over HTTPS.
- Fork tests fail behind a proxy → use `make rpc-proxy` above.
- Relayer drained → keep only a little tQDAY and replace in-memory limits with Redis for real traffic.
