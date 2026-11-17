// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title PaymentGuard
/// @notice A policy-controlled tUSD8 vault for autonomous agents. A human deposits funds and
///         registers a scoped session key with per-transaction / daily caps, a recipient
///         allowlist, an expiry and a human-approval threshold. The agent can then spend
///         within those bounds. Every outcome, including a blocked payment, is an on-chain
///         event so the demo is fully verifiable on the Aevum explorer.
/// @dev Deliberately self-contained: no EntryPoint, bundler, paymaster or QDay agent
///      registry address is required. Those are not published on Aevum testnet yet.
contract PaymentGuard is EIP712 {
    using SafeERC20 for IERC20;

    bytes32 private constant QUOTE_TYPEHASH =
        keccak256("Quote(address recipient,uint256 amount,uint256 validBefore,bytes32 paymentId)");
    bytes32 private constant INTENT_TYPEHASH = keccak256(
        "PaymentIntent(address sessionKey,address recipient,uint256 amount,uint256 validAfter,uint256 validBefore,bytes32 paymentId)"
    );

    // Block reason codes emitted in PaymentBlocked. Kept as events (not reverts) so a
    // rejected agent action still produces a verifiable transaction.
    uint8 public constant BLOCK_PAUSED = 10;
    uint8 public constant BLOCK_UNAUTHORIZED = 1;
    uint8 public constant BLOCK_REVOKED = 3;
    uint8 public constant BLOCK_EXPIRED = 2;
    uint8 public constant BLOCK_RECIPIENT = 4;
    uint8 public constant BLOCK_PER_TX_CAP = 5;
    uint8 public constant BLOCK_DAILY_CAP = 6;
    uint8 public constant BLOCK_INSUFFICIENT = 7;
    uint8 public constant BLOCK_ZERO_AMOUNT = 8;
    uint8 public constant BLOCK_INTENT_EXPIRED = 9;
    uint8 public constant BLOCK_BAD_QUOTE = 11;

    enum Status {None, Pending, Executed, Rejected, Blocked}

    struct Policy {
        address owner;
        uint256 agentId;
        uint256 perTxCap;
        uint256 dailyCap;
        uint256 spentToday;
        uint64 dayStart;
        uint64 expiresAt;
        uint256 approvalThreshold;
        bool active;
    }

    struct Payment {
        address sessionKey;
        address recipient;
        uint256 amount;
        uint256 validAfter;
        uint256 validBefore;
        bytes32 paymentId;
    }

    IERC20 public immutable token;
    address public admin;
    address public quoteSigner;
    bool public paused;

    mapping(address sessionKey => Policy) public policies;
    mapping(address sessionKey => mapping(address recipient => bool)) public allowlist;
    mapping(bytes32 agentKey => uint256) public vault;
    mapping(bytes32 agentKey => address) public vaultOwner;
    mapping(address sessionKey => uint256) public nonces;
    mapping(bytes32 paymentId => Status) public status;
    mapping(bytes32 paymentId => Payment) public payments;

    event SessionKeyRegistered(
        address indexed sessionKey, address indexed owner, uint256 agentId,
        uint256 perTxCap, uint256 dailyCap, uint64 expiresAt
    );
    event SessionKeyRevoked(address indexed sessionKey);
    event PolicyUpdated(
        address indexed sessionKey, uint256 perTxCap, uint256 dailyCap,
        uint256 approvalThreshold, uint64 expiresAt
    );
    event AllowlistUpdated(address indexed sessionKey, address indexed recipient, bool allowed);
    event VaultDeposited(uint256 indexed agentId, address indexed from, uint256 amount);
    event VaultWithdrawn(uint256 indexed agentId, address indexed to, uint256 amount);
    event ApprovalRequired(
        bytes32 indexed paymentId, address indexed sessionKey, address indexed recipient, uint256 amount
    );
    event PaymentApproved(bytes32 indexed paymentId, address indexed approver);
    event PaymentRejected(bytes32 indexed paymentId, address indexed approver);
    event PaymentExecuted(
        bytes32 indexed paymentId, address indexed sessionKey, address indexed recipient, uint256 amount
    );
    event PaymentBlocked(
        bytes32 indexed paymentId, address indexed sessionKey, address indexed recipient,
        uint256 amount, uint8 reason
    );
    event DailyReset(address indexed sessionKey, uint256 spentToday);

    error NotOwner();
    error NotAdmin();
    error UnauthorizedSession();
    error ZeroAddress();
    error ZeroAmount();
    error InvalidBounds();
    error AlreadyProcessed();
    error InvalidSignature();
    error SignatureExpired();
    error InvalidNonce();
    error NotPending();

    constructor(IERC20 token_, address quoteSigner_) EIP712("PaymentGuard", "1") {
        if (address(token_) == address(0) || quoteSigner_ == address(0)) revert ZeroAddress();
        token = token_;
        quoteSigner = quoteSigner_;
        admin = msg.sender;
    }

    // ---------------------------------------------------------------- funding

    /// @notice Deposit tUSD8 for an agent. The first depositor becomes the vault owner and
    ///         is the only address allowed to register keys or withdraw this agent's funds.
    ///         Deposit BEFORE registering a key, otherwise anyone could register a key for
    ///         an agentId you are about to fund.
    function deposit(uint256 agentId, uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        bytes32 key = agentKey(agentId);
        if (vaultOwner[key] == address(0)) vaultOwner[key] = msg.sender;
        vault[key] += amount;
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit VaultDeposited(agentId, msg.sender, amount);
    }

    /// @notice Withdraw unused funds. Only the vault owner can do this.
    function withdraw(uint256 agentId, uint256 amount) external {
        bytes32 key = agentKey(agentId);
        if (vaultOwner[key] != msg.sender) revert NotOwner();
        if (amount == 0 || vault[key] < amount) revert ZeroAmount();
        vault[key] -= amount;
        token.safeTransfer(msg.sender, amount);
        emit VaultWithdrawn(agentId, msg.sender, amount);
    }

    // ------------------------------------------------------------ policy admin

    /// @notice Register a scoped session key. Only the vault owner or the contract admin.
    function registerSessionKey(
        address sessionKey,
        uint256 agentId,
        uint256 perTxCap,
        uint256 dailyCap,
        uint256 approvalThreshold,
        uint64 expiresAt,
        address[] calldata recipients
    ) external {
        if (sessionKey == address(0)) revert ZeroAddress();
        bytes32 key = agentKey(agentId);
        if (vaultOwner[key] != msg.sender && admin != msg.sender) revert NotOwner();
        if (perTxCap == 0 || dailyCap == 0 || perTxCap > dailyCap || expiresAt <= block.timestamp) {
            revert InvalidBounds();
        }
        Policy storage p = policies[sessionKey];
        p.owner = msg.sender;
        p.agentId = agentId;
        p.perTxCap = perTxCap;
        p.dailyCap = dailyCap;
        p.spentToday = 0;
        p.dayStart = uint64(block.timestamp);
        p.expiresAt = expiresAt;
        p.approvalThreshold = approvalThreshold;
        p.active = true;
        for (uint256 i = 0; i < recipients.length; i++) {
            allowlist[sessionKey][recipients[i]] = true;
            emit AllowlistUpdated(sessionKey, recipients[i], true);
        }
        emit SessionKeyRegistered(sessionKey, msg.sender, agentId, perTxCap, dailyCap, expiresAt);
    }

    /// @notice Instantly revoke a session key. Cannot be undone without re-registration.
    function revokeSessionKey(address sessionKey) external {
        Policy storage p = policies[sessionKey];
        if (p.owner != msg.sender && admin != msg.sender) revert NotOwner();
        p.active = false;
        emit SessionKeyRevoked(sessionKey);
    }

    function updatePolicy(
        address sessionKey,
        uint256 perTxCap,
        uint256 dailyCap,
        uint256 approvalThreshold,
        uint64 expiresAt
    ) external {
        Policy storage p = policies[sessionKey];
        if (p.owner != msg.sender) revert NotOwner();
        if (perTxCap == 0 || dailyCap == 0 || perTxCap > dailyCap || expiresAt <= block.timestamp) {
            revert InvalidBounds();
        }
        p.perTxCap = perTxCap;
        p.dailyCap = dailyCap;
        p.approvalThreshold = approvalThreshold;
        p.expiresAt = expiresAt;
        emit PolicyUpdated(sessionKey, perTxCap, dailyCap, approvalThreshold, expiresAt);
    }

    /// @notice Admin-only emergency expiry. Useful for incident response and for demonstrating
    ///         the expired-key path on a live testnet without waiting for a natural expiry.
    function forceExpireSessionKey(address sessionKey) external {
        if (msg.sender != admin) revert NotAdmin();
        Policy storage p = policies[sessionKey];
        if (p.owner == address(0)) revert UnauthorizedSession();
        p.expiresAt = uint64(block.timestamp);
        emit PolicyUpdated(sessionKey, p.perTxCap, p.dailyCap, p.approvalThreshold, p.expiresAt);
    }

    function setAllowlist(address sessionKey, address recipient, bool allowed) external {
        if (policies[sessionKey].owner != msg.sender) revert NotOwner();
        allowlist[sessionKey][recipient] = allowed;
        emit AllowlistUpdated(sessionKey, recipient, allowed);
    }

    function setQuoteSigner(address signer) external {
        if (msg.sender != admin) revert NotAdmin();
        if (signer == address(0)) revert ZeroAddress();
        quoteSigner = signer;
    }

    function setPaused(bool value) external {
        if (msg.sender != admin) revert NotAdmin();
        paused = value;
    }

    // ------------------------------------------------------------- agent pay

    /// @notice Direct payment. `msg.sender` must be the registered session key.
    function pay(address recipient, uint256 amount, uint256 validBefore, bytes calldata quoteSig)
        external
        returns (bytes32 paymentId)
    {
        paymentId = nextPaymentId(msg.sender);
        _record(msg.sender, recipient, amount, 0, validBefore, paymentId, quoteSig);
    }

    /// @notice Gasless payment. Anyone may submit a session key's EIP-712 signed intent.
    function payWithSignature(Payment calldata p, bytes calldata sessionSig, bytes calldata quoteSig)
        external
        returns (bytes32 paymentId)
    {
        if (p.sessionKey == address(0)) revert ZeroAddress();
        paymentId = nextPaymentId(p.sessionKey);
        if (p.paymentId != paymentId) revert InvalidNonce();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            INTENT_TYPEHASH, p.sessionKey, p.recipient, p.amount,
            p.validAfter, p.validBefore, p.paymentId
        )));
        if (ECDSA.recover(digest, sessionSig) != p.sessionKey) revert InvalidSignature();
        _record(p.sessionKey, p.recipient, p.amount, p.validAfter, p.validBefore, p.paymentId, quoteSig);
    }

    /// @notice Human approval for a pending high-value payment.
    function approve(bytes32 paymentId) external {
        if (status[paymentId] != Status.Pending) revert NotPending();
        Payment memory p = payments[paymentId];
        if (policies[p.sessionKey].owner != msg.sender) revert NotOwner();
        uint8 reason = _check(p.sessionKey, p.recipient, p.amount, p.validAfter, p.validBefore, p.paymentId);
        if (reason != 0) {
            status[paymentId] = Status.Blocked;
            emit PaymentBlocked(paymentId, p.sessionKey, p.recipient, p.amount, reason);
            return;
        }
        emit PaymentApproved(paymentId, msg.sender);
        status[paymentId] = Status.Executed;
        _settle(paymentId, p);
    }

    /// @notice Human rejection for a pending high-value payment.
    function reject(bytes32 paymentId) external {
        if (status[paymentId] != Status.Pending) revert NotPending();
        Payment memory p = payments[paymentId];
        if (policies[p.sessionKey].owner != msg.sender) revert NotOwner();
        status[paymentId] = Status.Rejected;
        emit PaymentRejected(paymentId, msg.sender);
    }

    // --------------------------------------------------------------- views

    function agentKey(uint256 agentId) public pure returns (bytes32) {
        return keccak256(abi.encode(agentId));
    }

    function nextPaymentId(address sessionKey) public view returns (bytes32) {
        return keccak256(abi.encode(sessionKey, nonces[sessionKey]));
    }

    function dailyRemaining(address sessionKey) external view returns (uint256) {
        Policy memory p = policies[sessionKey];
        if (block.timestamp >= p.dayStart + 1 days) return p.dailyCap;
        uint256 spent = p.spentToday > p.dailyCap ? p.dailyCap : p.spentToday;
        return p.dailyCap - spent;
    }

    function isKeyValid(address sessionKey) external view returns (bool) {
        Policy memory p = policies[sessionKey];
        return p.active && p.owner != address(0) && p.expiresAt > block.timestamp && !paused;
    }

    function quoteDigest(address recipient, uint256 amount, uint256 validBefore, bytes32 paymentId)
        public
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(abi.encode(QUOTE_TYPEHASH, recipient, amount, validBefore, paymentId)));
    }

    /// @notice EIP-712 digest a session key must sign for `payWithSignature`.
    function intentDigest(Payment calldata p) external view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(
            INTENT_TYPEHASH, p.sessionKey, p.recipient, p.amount, p.validAfter, p.validBefore, p.paymentId
        )));
    }

    // ------------------------------------------------------------- internals

    function _record(
        address sessionKey,
        address recipient,
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 paymentId,
        bytes calldata quoteSig
    ) private {
        nonces[sessionKey]++;
        if (status[paymentId] != Status.None) revert AlreadyProcessed();
        Payment memory p = Payment(sessionKey, recipient, amount, validAfter, validBefore, paymentId);
        payments[paymentId] = p;

        uint8 reason = _check(sessionKey, recipient, amount, validAfter, validBefore, paymentId, quoteSig);
        if (reason != 0) {
            status[paymentId] = Status.Blocked;
            emit PaymentBlocked(paymentId, sessionKey, recipient, amount, reason);
            return;
        }
        if (amount > policies[sessionKey].approvalThreshold) {
            status[paymentId] = Status.Pending;
            emit ApprovalRequired(paymentId, sessionKey, recipient, amount);
            return;
        }
        status[paymentId] = Status.Executed;
        _settle(paymentId, p);
    }

    /// @dev Returns 0 when allowed, otherwise a stable reason code. Never reverts: a blocked
    ///      agent action must still produce an explorer-verifiable transaction.
    function _check(
        address sessionKey,
        address recipient,
        uint256 amount,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 paymentId,
        bytes calldata quoteSig
    ) private returns (uint8) {
        if (paused) return BLOCK_PAUSED;
        Policy storage p = policies[sessionKey];
        if (p.owner == address(0)) return BLOCK_UNAUTHORIZED;
        if (!p.active) return BLOCK_REVOKED;
        if (p.expiresAt <= block.timestamp) return BLOCK_EXPIRED;
        if (recipient == address(0) || !allowlist[sessionKey][recipient]) return BLOCK_RECIPIENT;
        if (amount == 0) return BLOCK_ZERO_AMOUNT;
        if (amount > p.perTxCap) return BLOCK_PER_TX_CAP;
        if (validAfter > block.timestamp || validBefore < block.timestamp) return BLOCK_INTENT_EXPIRED;
        _maybeResetDay(sessionKey, p);
        if (p.spentToday + amount > p.dailyCap) return BLOCK_DAILY_CAP;
        if (vault[agentKey(p.agentId)] < amount) return BLOCK_INSUFFICIENT;
        if (!_validQuote(recipient, amount, validBefore, paymentId, quoteSig)) return BLOCK_BAD_QUOTE;
        return 0;
    }

    function _check(
        address sessionKey,
        address recipient,
        uint256 amount,
        uint256,
        uint256 validBefore,
        bytes32 paymentId
    ) private returns (uint8) {
        if (status[paymentId] != Status.Pending) return BLOCK_UNAUTHORIZED;
        // Quote was already verified when the request was created.
        if (paused) return BLOCK_PAUSED;
        Policy storage p = policies[sessionKey];
        if (!p.active) return BLOCK_REVOKED;
        if (p.expiresAt <= block.timestamp) return BLOCK_EXPIRED;
        if (!allowlist[sessionKey][recipient]) return BLOCK_RECIPIENT;
        if (amount > p.perTxCap) return BLOCK_PER_TX_CAP;
        if (validBefore < block.timestamp) return BLOCK_INTENT_EXPIRED;
        _maybeResetDay(sessionKey, p);
        if (p.spentToday + amount > p.dailyCap) return BLOCK_DAILY_CAP;
        if (vault[agentKey(p.agentId)] < amount) return BLOCK_INSUFFICIENT;
        return 0;
    }

    function _validQuote(
        address recipient,
        uint256 amount,
        uint256 validBefore,
        bytes32 paymentId,
        bytes calldata sig
    ) private view returns (bool) {
        if (sig.length != 65) return false;
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            QUOTE_TYPEHASH, recipient, amount, validBefore, paymentId
        )));
        return ECDSA.recover(digest, sig) == quoteSigner;
    }

    function _maybeResetDay(address sessionKey, Policy storage p) private {
        if (block.timestamp < p.dayStart + 1 days) return;
        uint64 elapsed = uint64((block.timestamp - p.dayStart) / 1 days);
        p.dayStart += elapsed * 1 days;
        p.spentToday = 0;
        emit DailyReset(sessionKey, 0);
    }

    function _settle(bytes32 paymentId, Payment memory p) private {
        Policy storage policy = policies[p.sessionKey];
        policy.spentToday += p.amount;
        vault[agentKey(policy.agentId)] -= p.amount;
        token.safeTransfer(p.recipient, p.amount);
        emit PaymentExecuted(paymentId, p.sessionKey, p.recipient, p.amount);
    }
}
