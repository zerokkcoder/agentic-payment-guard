import { createPublicClient, createWalletClient, decodeEventLog, defineChain, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { aevumTestnet, guardAbi, identityAbi } from "@aevum-kit/aevum";
import { env } from "./env.js";

export const chain = defineChain({
  ...aevumTestnet,
  id: env.chainId,
  rpcUrls: { default: { http: [env.rpcUrl] } },
});

export const publicClient = createPublicClient({ chain, transport: http(env.rpcUrl) });

export function walletFor(key: Hex) {
  const account = privateKeyToAccount(key);
  return { account, client: createWalletClient({ account, chain, transport: http(env.rpcUrl) }) };
}

export const agentAccount = privateKeyToAccount(env.agentKey);

export function txLink(hash: Hex): string {
  return `${env.explorer}/tx/${hash}`;
}

export function addressLink(address: Address): string {
  return `${env.explorer}/address/${address}`;
}

export const statusNames = ["None", "Pending", "Executed", "Rejected", "Blocked"] as const;
export const blockReasons: Record<number, string> = {
  1: "未注册的 session key / unregistered session key",
  2: "授权已过期 / session expired",
  3: "授权已撤销 / session revoked",
  4: "收款人不在白名单 / recipient not allowlisted",
  5: "超过单笔上限 / per-transaction cap exceeded",
  6: "超过每日上限 / daily cap exceeded",
  7: "vault 余额不足 / insufficient vault balance",
  8: "金额为零 / zero amount",
  9: "签名窗口已失效 / intent window expired",
  10: "合约已暂停 / contract paused",
  11: "报价签名无效 / invalid merchant quote",
};

export async function readPolicy(sessionKey: Address) {
  const p = await publicClient.readContract({
    address: env.guard,
    abi: guardAbi,
    functionName: "policies",
    args: [sessionKey],
  });
  return {
    owner: p[0],
    agentId: p[1],
    perTxCap: p[2],
    dailyCap: p[3],
    spentToday: p[4],
    expiresAt: p[6],
    approvalThreshold: p[7],
    active: p[8],
  };
}

export async function readPaymentId(): Promise<Hex> {
  return publicClient.readContract({
    address: env.guard,
    abi: guardAbi,
    functionName: "nextPaymentId",
    args: [agentAccount.address],
  }) as Promise<Hex>;
}

export async function readStatus(paymentId: Hex): Promise<number> {
  return Number(await publicClient.readContract({
    address: env.guard,
    abi: guardAbi,
    functionName: "status",
    args: [paymentId],
  }));
}

/** Decode a PaymentBlocked event from a receipt, if present. */
export async function blockedReason(hash: Hex): Promise<number | null> {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== env.guard.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: guardAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName !== "PaymentBlocked") continue;
      return Number((decoded.args as { reason: number | bigint }).reason);
    } catch {
      // not this event
    }
  }
  return null;
}

export const identity = { address: env.identity, abi: identityAbi };
