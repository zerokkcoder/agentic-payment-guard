import { parseAbi, type Address } from "viem";

/** tUSD8 on Aevum testnet: a USDC-style token (FiatTokenV2) with 6 decimals, EIP-2612 and EIP-3009. */
export const TUSD8_ADDRESS: Address = "0x456569838f1d43009A91ebA4263147Afd7233483";
export const TUSD8_DECIMALS = 6;

/** EIP-712 domain of tUSD8. MockUSD8 (local) uses the same name and version. */
export function tusd8Domain(chainId: number, verifyingContract: Address) {
  return { name: "tUSD8", version: "2", chainId, verifyingContract } as const;
}

export const erc20Abi = parseAbi([
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

export const eip3009Abi = parseAbi([
  "function authorizationState(address authorizer, bytes32 nonce) view returns (bool)",
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
  "function receiveWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s)",
]);

/** ABI of contracts/src/Checkout.sol. */
export const checkoutAbi = parseAbi([
  "function token() view returns (address)",
  "function merchant() view returns (address)",
  "function pay(bytes32 orderId, uint256 amount)",
  "function payWithAuthorization(bytes32 orderId, address from, uint256 amount, uint256 validAfter, uint256 validBefore, uint8 v, bytes32 r, bytes32 s)",
  "function authorizationNonce(bytes32 orderId) view returns (bytes32)",
  "function isPaid(bytes32 orderId) view returns (bool)",
  "function paymentOf(bytes32 orderId) view returns ((address payer, uint64 paidAt, uint256 amount))",
  "event Paid(bytes32 indexed orderId, address indexed payer, uint256 amount)",
  "error AlreadyPaid(bytes32 orderId)",
  "error ZeroAmount()",
  "error ZeroAddress()",
]);

/** ABI of contracts/src/PaymentGuard.sol. Shared by the web app and the agent CLI. */
export const guardAbi = parseAbi([
  "function token() view returns (address)",
  "function quoteSigner() view returns (address)",
  "function admin() view returns (address)",
  "function paused() view returns (bool)",
  "function policies(address) view returns ((address,uint256,uint256,uint256,uint256,uint64,uint64,uint256,bool))",
  "function allowlist(address,address) view returns (bool)",
  "function vault(bytes32) view returns (uint256)",
  "function vaultOwner(bytes32) view returns (address)",
  "function nonces(address) view returns (uint256)",
  "function status(bytes32) view returns (uint8)",
  "function payments(bytes32) view returns ((address,address,uint256,uint256,uint256,bytes32))",
  "function agentKey(uint256) pure returns (bytes32)",
  "function nextPaymentId(address) view returns (bytes32)",
  "function dailyRemaining(address) view returns (uint256)",
  "function isKeyValid(address) view returns (bool)",
  "function quoteDigest(address,uint256,uint256,bytes32) view returns (bytes32)",
  "function intentDigest((address,address,uint256,uint256,uint256,bytes32)) view returns (bytes32)",
  "function deposit(uint256,uint256)",
  "function withdraw(uint256,uint256)",
  "function registerSessionKey(address,uint256,uint256,uint256,uint256,uint64,address[])",
  "function revokeSessionKey(address)",
  "function forceExpireSessionKey(address)",
  "function updatePolicy(address,uint256,uint256,uint256,uint64)",
  "function setAllowlist(address,address,bool)",
  "function setQuoteSigner(address)",
  "function setPaused(bool)",
  "function pay(address,uint256,uint256,bytes) returns (bytes32)",
  "function payWithSignature((address,address,uint256,uint256,uint256,bytes32),bytes,bytes) returns (bytes32)",
  "function approve(bytes32)",
  "function reject(bytes32)",
  "function BLOCK_PER_TX_CAP() view returns (uint8)",
  "function BLOCK_DAILY_CAP() view returns (uint8)",
  "event SessionKeyRegistered(address indexed sessionKey,address indexed owner,uint256 agentId,uint256 perTxCap,uint256 dailyCap,uint64 expiresAt)",
  "event SessionKeyRevoked(address indexed sessionKey)",
  "event VaultDeposited(uint256 indexed agentId,address indexed from,uint256 amount)",
  "event ApprovalRequired(bytes32 indexed paymentId,address indexed sessionKey,address indexed recipient,uint256 amount)",
  "event PaymentApproved(bytes32 indexed paymentId,address indexed approver)",
  "event PaymentRejected(bytes32 indexed paymentId,address indexed approver)",
  "event PaymentExecuted(bytes32 indexed paymentId,address indexed sessionKey,address indexed recipient,uint256 amount)",
  "event PaymentBlocked(bytes32 indexed paymentId,address indexed sessionKey,address indexed recipient,uint256 amount,uint8 reason)",
  "error NotOwner()",
  "error NotAdmin()",
  "error InvalidBounds()",
]);

/** ABI of the self-deployed ERC-8004 reference registries. */
export const identityAbi = parseAbi([
  "function register(string) returns (uint256)",
  "function register(string,(string,bytes)[]) returns (uint256)",
  "function tokenURI(uint256) view returns (string)",
  "function ownerOf(uint256) view returns (address)",
  "function getAgentWallet(uint256) view returns (address)",
  "function agentRegistry() view returns (string)",
  "event Registered(uint256 indexed agentId,string agentURI,address indexed owner)",
]);

export const reputationAbi = parseAbi([
  "function getSummary(uint256,address[],string,string) view returns (uint64,int128,uint8)",
  "function giveFeedback(uint256,int128,uint8,string,string,string,string,bytes32)",
  "event FeedbackGiven(uint256 indexed agentId,uint256 indexed feedbackIndex,address indexed client,int128 value)",
]);

export const validationAbi = parseAbi([
  "function validationRequest(address,uint256,string,bytes32)",
  "function validationResponse(bytes32,uint8,string,bytes32,string)",
  "function getSummary(uint256,address[],string) view returns (uint64,uint8)",
]);
