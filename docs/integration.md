# QDay platform integration / 平台集成

[中文版](./integration.zh-CN.md)

This page documents exactly how the app uses Aevum-native primitives and where it deliberately deviates from the starter kit.

## tUSD8

- Address `0x456569838f1d43009A91ebA4263147Afd7233483`, 6 decimals, FiatTokenV2-style.
- EIP-712 domain `{ name: "tUSD8", version: "2", chainId: 44005, verifyingContract: <above> }`.
- Supports EIP-2612 `permit` and EIP-3009 `transferWithAuthorization` / `receiveWithAuthorization`.
- `PaymentGuard.deposit` uses standard `approve` + `safeTransferFrom`; the vault then transfers tUSD8 directly to allowlisted recipients. The starter kit's EIP-3009 relayer remains available for the original Checkout gasless flow.

## EIP-712

Two typed payloads:

1. **Quote** — signed by the merchant-controlled `quoteSigner`: `Quote(recipient, amount, validBefore, paymentId)`. `/api/quote` and the agent CLI produce identical digests via `guard.quoteDigest`.
2. **PaymentIntent** — signed by the session key for gasless submission: `PaymentIntent(sessionKey, recipient, amount, validAfter, validBefore, paymentId)`.

Both use domain `{name: "PaymentGuard", version: "1", chainId, verifyingContract: guard}`. Quote validity is capped at one hour by `/api/quote` and `/api/relay-guard`.

## ERC-8004

`AgentIdentityRegistry` follows the EIP's three-function register overloads, ERC-721 token IDs as `agentId`, metadata keys, `agentWallet` with EIP-712/ERC-1271 proof, and wallet clearing on transfer. `ReputationRegistry` rejects self-feedback and requires `clientAddresses` in `getSummary`. `ValidationRegistry` stores 0–100 responses. The registration JSON is hosted in `web/public/registry/agent-1.json`; `agentURI` must be updated to the deployed HTTPS URL after Vercel deployment.

**Important:** these are self-deployed reference implementations. QDay's own ERC-8004 registries are planned but no Aevum addresses are published.

## smart accounts / session keys

QDay docs state that ERC-4337 agent wallets and session keys are live on Aevum, but EntryPoint, factory, policy module, bundler and paymaster addresses are unpublished. `PaymentGuard` implements the same primitives — scoped keys, per-tx/daily spending limits, target restrictions, expiry, revocation — as a self-contained contract. This is a deliberate, documented trade-off: verifiable today, swappable for official infrastructure later.

## Aevum-specific constraints

| Constraint | Handling |
|---|---|
| Shanghai EVM | `evm_version = "shanghai"`, `tools/check-shanghai.mjs` in `make build`, no `*Transient` OZ contracts, anvil `--hardfork shanghai`. |
| `eth_getLogs` ≤ 1,000 blocks | `getLogsChunked` in `@aevum-kit/aevum`, called by Activity and Approvals pages. |
| No WebSocket | HTTP polling only; no `watchContractEvent` over WS. |
| Legacy tx type | Scripts and relayer use `type: "legacy"` / `--legacy`. |
| Explorer verifier broken | Document addresses + source commit instead of `forge verify-contract`. |
| Multicall3 | `0xcA11bde05977b3631167028862bE2a173976CA11`. |

## Fixing the starter-kit `Checkout` flaw

The official `Checkout.sol` records payment by an arbitrary caller-supplied `orderId`. Anyone can call `pay(orderId, 1)` and mark an order paid for 0.000001 tUSD8, front-running the real buyer. Our fix:

1. `paymentId` is derived from `keccak256(sessionKey, nonce)`. It cannot be chosen or guessed in advance.
2. The amount must match an EIP-712 quote signed by `quoteSigner`.
3. The recipient must be on the session key's allowlist.
4. Per-transaction and daily caps bound the damage even if a key leaks.
5. `approve()` re-checks the whole policy, closing the "pending then revoked" race.

## API examples

Get a quote:

```bash
curl -X POST http://localhost:3000/api/quote \
  -H 'content-type: application/json' \
  -d '{"recipient":"0x...","amount":"1000000","validBefore":"<unix>","paymentId":"0x..."}'
```

Relay a signed intent:

```bash
curl -X POST http://localhost:3000/api/relay-guard \
  -H 'content-type: application/json' \
  -d '{"payment":{...},"sessionSig":"0x...","quoteSig":"0x..."}'
```

## Roadmap

- Replace self-deployed registries with QDay official ERC-8004 registries once addresses are published.
- Move from policy-guard contract to ERC-4337 smart accounts with native session-key modules and a paymaster.
- Add x402 support (`x402Support` in the registration JSON is currently `false`).
- Move relayer rate limits from memory to Redis and add spend caps per merchant.
- Add Agent Mail / webhook notifications for `ApprovalRequired` events.
