# Contract reference / 合约说明

[中文版](./contracts.zh-CN.md)

All contracts use `pragma solidity ^0.8.24`, `evm_version = "shanghai"`, `via_ir = true`. Bytecode is checked by `tools/check-shanghai.mjs`.

## PaymentGuard

### Funding

| Function | Access | Description |
|---|---|---|
| `deposit(uint256 agentId, uint256 amount)` | anyone; first caller becomes vault owner | Pulls tUSD8 via `safeTransferFrom`. Deposit **before** registering a key. |
| `withdraw(uint256 agentId, uint256 amount)` | `vaultOwner` | Returns unused funds. |

### Policy

| Function | Access | Description |
|---|---|---|
| `registerSessionKey(sessionKey, agentId, perTxCap, dailyCap, approvalThreshold, expiresAt, recipients)` | vault owner or admin | Creates the scoped key and allowlist. |
| `updatePolicy(...)` | policy owner | Changes caps, threshold and expiry. |
| `setAllowlist(sessionKey, recipient, allowed)` | policy owner | Adds/removes one recipient. |
| `revokeSessionKey(sessionKey)` | policy owner or admin | Instant revocation. |
| `forceExpireSessionKey(sessionKey)` | admin only | Emergency expiry; also used in the demo. |
| `setQuoteSigner(signer)`, `setPaused(bool)` | admin only | Operational controls. |

### Payments

| Function | Description |
|---|---|
| `pay(recipient, amount, validBefore, quoteSig)` | `msg.sender` must be the session key. |
| `payWithSignature(Payment p, sessionSig, quoteSig)` | Gasless path; verifies the session key's EIP-712 intent. |
| `approve(paymentId)` / `reject(paymentId)` | Policy owner decides a pending payment. |
| `nextPaymentId(sessionKey)` | Predict next ID for quote construction. |
| `quoteDigest(recipient, amount, validBefore, paymentId)` | EIP-712 digest the quote signer signs. |
| `intentDigest(Payment p)` | EIP-712 digest the session key signs. |
| `dailyRemaining(sessionKey)`, `isKeyValid(sessionKey)` | UI helpers. |

### EIP-712 types

```
Quote(address recipient,uint256 amount,uint256 validBefore,bytes32 paymentId)
PaymentIntent(address sessionKey,address recipient,uint256 amount,uint256 validAfter,uint256 validBefore,bytes32 paymentId)
```

Domain: `{name: "PaymentGuard", version: "1", chainId: 44005, verifyingContract: <guard>}`.

### Events and reason codes

`SessionKeyRegistered`, `SessionKeyRevoked`, `PolicyUpdated`, `AllowlistUpdated`, `VaultDeposited`, `VaultWithdrawn`, `ApprovalRequired`, `PaymentApproved`, `PaymentRejected`, `PaymentExecuted`, `PaymentBlocked`, `DailyReset`.

`PaymentBlocked.reason`: `1` unregistered, `2` expired, `3` revoked, `4` recipient not allowlisted, `5` per-tx cap, `6` daily cap, `7` insufficient vault, `8` zero amount, `9` intent window expired, `10` paused, `11` invalid quote.

### Security notes

- Policy violations emit an event and return instead of reverting. This is deliberate: the rejection must be visible on-chain.
- The payment ID is derived from the session key's nonce. Quote signatures cannot be replayed for a different payment.
- `approve()` re-runs all policy checks, so a key revoked while a payment was pending cannot be executed.
- The contract has no arbitrary external call surface. Tokens go only to allowlisted recipients from the agent's own vault.

## ERC-8004 registries

- `AgentIdentityRegistry`: `register(...)` overloads, `setAgentURI`, `getMetadata` / `setMetadata`, `setAgentWallet(agentId, newWallet, deadline, signature)` (EIP-712 for EOA, ERC-1271 for contracts), `getAgentWallet`, `unsetAgentWallet`, `agentRegistry()`. `agentWallet` is a reserved metadata key and is cleared on NFT transfer.
- `ReputationRegistry`: `initialize(identityRegistry)`, `giveFeedback(...)`, `getSummary(agentId, clientAddresses, tag1, tag2)`, `readAllFeedback`, `readFeedback`, `revokeFeedback`, `appendResponse`. Self-feedback is rejected.
- `ValidationRegistry`: `validationRequest(...)`, `validationResponse(requestHash, 0..100, ...)`, `getValidationStatus`, `getSummary`, `getAgentValidations`, `getValidatorRequests`.

## Known limitations

- The explorer verifier is not working. Document the address + exact source commit instead.
- `getLogs` is limited to 1,000 blocks. Use `getLogsChunked` from `@aevum-kit/aevum`.
- Reputation/Validation are reference implementations, not audited production registries.
