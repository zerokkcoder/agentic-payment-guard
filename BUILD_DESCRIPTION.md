## Agentic Payment Guard

**Scoped, auditable tUSD8 payments for autonomous AI agents on the QDay Aevum testnet.**

---

### The Problem

AI agents are starting to hold their own wallets and pay on-chain, but today they are given either full control of a treasury or nothing at all. Handing an autonomous agent an unrestricted private key is reckless: a bug, a prompt-injection attack, or a runaway loop can drain every cent. The existing starter kit makes this worse — its `Checkout.sol` lets *anyone* pay *any* `orderId` with *any* amount and front-run the real buyer, so there is no reliable link between a payment and the intent behind it.

There is no standard way to give an agent a **limited** spending authority, make every outcome verifiable, and hold a human in the loop for the risky cases. Agents need least-privilege keys; owners need caps, expiry, and an emergency off-switch; and everyone needs an on-chain trail that shows not only what succeeded but also what was blocked and why.

---

### How It Works

A human owner deposits tUSD8 into a per-agent vault, then registers a **session key** for the agent with an explicit policy: a per-transaction cap, a daily cap, a recipient allowlist, an expiry time, and a human-approval threshold. The agent pays on-chain by signing an EIP-712 payment intent and attaching a quote signature from the merchant-controlled signer for that exact payment.

Every rule is enforced inside the `PaymentGuard` smart contract — not in the UI and not in agent code. When the agent submits a payment:

- **Within policy** → the contract transfers tUSD8 from the vault and emits `PaymentExecuted`.
- **Above the approval threshold** → the contract emits `ApprovalRequired`, and the human approves or rejects it. `approve()` re-runs all policy checks, so a key revoked while a payment was pending can never execute.
- **Outside policy** → the contract emits `PaymentBlocked(reason)`. This transaction **succeeds on purpose**: a rejection must be visible and auditable on the explorer, not a silent revert. Reason codes cover expired, revoked, unregistered, non-allowlisted recipient, per-tx cap, daily cap, insufficient vault, and more.

Payment IDs are derived as `keccak256(abi.encode(sessionKey, nonce++))` — bound to the key, unpredictable, and replay-safe. Combined with the signed quote (which pins recipient, amount, validity window, and payment ID), this structurally eliminates the "pay 1 unit for an expensive order" and front-running bugs of the starter kit. Owners can revoke a key instantly; an admin can force-expire one for incident response. The owner who deposits first becomes the vault owner, which prevents an attacker from registering a key for an agent ID you are about to fund.

---

### Key Features

- **Session-key policies** — per-tx and daily spending caps, recipient allowlist, expiry, and approval threshold, all enforced on-chain.
- **Auditable rejections** — blocked payments are successful transactions with decoded `PaymentBlocked` events, so every success and every refusal is verifiable on the explorer.
- **Replay-safe payment IDs** — nonce-derived, unpredictable IDs plus EIP-712 quotes that bind amount, recipient, and validity window.
- **Human-in-the-loop approvals** — high-value or suspicious payments queue for a human decision; approval re-validates policy.
- **Instant revocation & emergency expiry** — kill a compromised key immediately.
- **Self-deployed ERC-8004 identity** — `AgentIdentityRegistry`, `ReputationRegistry`, and `ValidationRegistry` reference implementations, so the demo does not depend on unpublished official addresses.
- **Verifiable 7-scenario demo** — an agent CLI that walks through `allowed`, `cap`, `notallowlisted`, `approval`, `dailycap`, `revoked`, and `expired`, printing a payment ID, tx hash, and explorer link for each.
- **Responsive dashboard** — fund a vault, register policies, handle approvals, browse the activity feed and receipts, with a plain-language error decoder and network guard.

---

### Tech Stack

- **Smart contracts** — Solidity `^0.8.24`, built with Foundry (Forge/Cast/Anvil), compiled for the Shanghai EVM with `via_ir`; bytecode verified by a custom `check-shanghai` script.
- **Standards** — EIP-3009 / EIP-2612 tUSD8 (real testnet stablecoin), EIP-712 typed-data signatures, ERC-8004 agent identity / reputation / validation, ERC-1271 contract signatures.
- **Frontend** — Next.js, TypeScript, wagmi, RainbowKit; server-side `/api/quote` signing endpoint and an optional `/api/relay-guard` gasless relay.
- **Agent** — TypeScript CLI that signs intents, requests quotes, submits payments, and prints verifiable results.
- **Tooling & infra** — pnpm workspace, Vercel one-click deployment, Anvil local chains and a local fork of live Aevum, Foundry tests (32 unit tests plus fork tests), and chunked `eth_getLogs` (1,000-block limit workaround).

---

### Hackathon Requirements

Built for the **Aevum Builder Challenge #1** on QDay Aevum testnet (chain ID `44005`). The app is deployed live at https://agentic-payment-guard.vercel.app/ against real tUSD8, with contracts at:

| Contract | Address |
|---|---|
| PaymentGuard | `0xBB8984Cdd7eFa0502E1FEcDEDb2e07b3080436c3` |
| AgentIdentityRegistry | `0xAc1E8054945A73744014c4f257e49AD45E10d17F` |
| ReputationRegistry | `0xEE7029AAAaFdB8108e2fACC8F0cd2704266Ee2E7` |
| ValidationRegistry | `0x1348E3B74C1E2b09fa44d86f7d1Aad78179Cf09f` |

- **Platform integration** — uses the real tUSD8 contract (EIP-3009/2612), EIP-712, and ERC-8004 primitives; handles Aevum-specific constraints: HTTPS-only RPC with no WebSocket (HTTP polling), a 1,000-block `eth_getLogs` cap, legacy transactions, and a currently non-functional explorer verifier (addresses + source commit are provided as proof).
- **Fully verifiable** — every one of the 7 demo scenarios produces an on-chain transaction and explorer link, including blocked payments.
- **Open source** — MIT licensed with a NOTICE file; ships reusable `@aevum-kit/aevum` ABIs, the agent CLI, and the Foundry test suite. Based on the official Aevum Starter Kit.
- **Reproducible** — one-command local setup (`make install`, `make build`, `make test`, `make anvil`, `make deploy-all-local`, `make dev`) needs no funds, plus full bilingual (EN/ZH) docs covering architecture, contracts, agent CLI, demo, deployment, integration, and operations.
