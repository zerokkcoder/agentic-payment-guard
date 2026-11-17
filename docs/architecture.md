# Architecture / 架构设计

[中文版](./architecture.zh-CN.md)

## Components

| Component | Role |
|---|---|
| `PaymentGuard.sol` | Holds tUSD8 in a per-agent vault, enforces session-key policy, executes or blocks payments, manages human approvals, emits audit events. |
| `AgentIdentityRegistry.sol` | Self-deployed ERC-8004 identity. ERC-721 token where `tokenId == agentId`; `agentWallet` requires EIP-712 / ERC-1271 proof; metadata and URI are on-chain. |
| `ReputationRegistry.sol` | ERC-8004 feedback with revocation and `getSummary(clientAddresses, ...)` Sybil resistance. |
| `ValidationRegistry.sol` | ERC-8004 validator requests and 0–100 responses. |
| `agent/` | TypeScript CLI that acts as the AI agent: signs an EIP-712 payment intent, requests a quote, submits `pay`, prints verifiable results. |
| `web/` | Next.js + wagmi + RainbowKit dashboard: funding, policy registration, approvals, activity feed, receipts. |
| `/api/quote` | Server-side EIP-712 quote signer. The quote binds recipient, amount, validity window and `paymentId`. |
| `/api/relay-guard` | Optional gasless submission of signed intents via `payWithSignature`. |

## Trust model

1. **Owner** deposits tUSD8 first. The first depositor for an `agentId` becomes `vaultOwner` and the only address allowed to withdraw or register keys. This prevents an attacker from registering a key for an `agentId` you are about to fund.
2. The owner registers a **session key** with `{perTxCap, dailyCap, approvalThreshold, expiresAt, allowlist}`. All checks run in the contract, not in the UI or agent code.
3. The agent obtains a **quote signature** from the merchant-controlled `quoteSigner` for the exact payment ID. This is what prevents "pay 1 unit for an expensive order".
4. Payment outcomes:
   - within policy → `PaymentExecuted`, token transfer from the vault;
   - above `approvalThreshold` → `ApprovalRequired`, human approves or rejects;
   - outside policy → `PaymentBlocked(reason)`. The transaction **succeeds** so the rejection is auditable.
5. The owner can `revokeSessionKey` instantly. The admin can `forceExpireSessionKey` for incident response and for demonstrating expiry on a live testnet.
6. All events are readable at `https://explorer-test.qday.info`.

## Payment state machine

```
None --pay()--> Executed
None --pay()--> ApprovalRequired(Pending) --approve()--> Executed
None --pay()--> Blocked(reason)
Pending --reject()--> Rejected
Pending --approve() + invalid policy--> Blocked(reason)
```

## On-chain identity

`AgentIdentityRegistry` is a reference implementation of [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004). The registration JSON lives at `docs/registry/agent-1.json` and `web/public/registry/agent-1.json`, and `agentURI` points to the hosted HTTPS copy. `agentRegistry` is `eip155:44005:<registry address>`.

## Why self-deploy?

QDay's official docs say agent wallets / session keys are live on Aevum testnet but do not publish EntryPoint, factory, policy, bundler, paymaster or ERC-8004 registry addresses. Deploying our own reference primitives is the only way to produce a fully verifiable demo today. The code is MIT-licensed and intended to be replaced by official registries once published.
