import { formatUnits, parseUnits, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { erc20Abi, guardAbi } from "@aevum-kit/aevum";
import { agentAccount, chain, publicClient, readPaymentId, readPolicy, readStatus, statusNames, blockedReason, txLink, walletFor, addressLink } from "./client.js";
import { env } from "./env.js";

const REVOKED_PK = "0x00000000000000000000000000000000000000000000000000000000000000d2" as Hex;
const EXPIRED_PK = "0x00000000000000000000000000000000000000000000000000000000000000d3" as Hex;
const DEAD_ADDRESS = "0x000000000000000000000000000000000000dEaD" as Address;

function log(obj: unknown) {
  console.log(JSON.stringify(obj, null, 2));
}

async function quoteSignature(recipient: Address, amount: bigint, validBefore: bigint, paymentId: Hex): Promise<Hex> {
  if (env.quoteKey) {
    const digest = await publicClient.readContract({
      address: env.guard,
      abi: guardAbi,
      functionName: "quoteDigest",
      args: [recipient, amount, validBefore, paymentId],
    });
    return privateKeyToAccount(env.quoteKey).signMessage({ message: { raw: digest } });
  }
  if (!env.quoteApiUrl) throw new Error("Set QUOTE_SIGNER_PRIVATE_KEY or QUOTE_API_URL");
  const res = await fetch(env.quoteApiUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      recipient,
      amount: amount.toString(),
      validBefore: validBefore.toString(),
      paymentId,
    }),
  });
  if (!res.ok) throw new Error(`Quote API failed: ${res.status} ${await res.text()}`);
  return ((await res.json()) as { signature: Hex }).signature;
}

async function payFrom(key: Hex, recipient: Address, humanAmount: string, scenario: string) {
  const account = privateKeyToAccount(key);
  const amount = parseUnits(humanAmount, 6);
  const paymentId = await publicClient.readContract({
    address: env.guard,
    abi: guardAbi,
    functionName: "nextPaymentId",
    args: [account.address],
  }) as Hex;
  const validBefore = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const quoteSig = await quoteSignature(recipient, amount, validBefore, paymentId);
  const { client } = walletFor(key);
  const hash = await client.writeContract({
    address: env.guard,
    abi: guardAbi,
    functionName: "pay",
    args: [recipient, amount, validBefore, quoteSig],
    chain,
    type: "legacy",
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const status = await readStatus(paymentId);
  const reason = await blockedReason(hash);
  const result = {
    scenario,
    from: account.address,
    recipient,
    amount: `${humanAmount} tUSD8`,
    paymentId,
    txHash: hash,
    block: receipt.blockNumber.toString(),
    status: statusNames[status] ?? "Unknown",
    reason: reason === null ? null : `${reason} — see docs/contracts for codes`,
    explorer: txLink(hash),
  };
  log(result);
  return result;
}

async function ownerCall(functionName: "approve" | "reject", paymentId: Hex) {
  if (!env.ownerKey) throw new Error("OWNER_PRIVATE_KEY is required");
  const { client } = walletFor(env.ownerKey);
  const hash = await client.writeContract({
    address: env.guard,
    abi: guardAbi,
    functionName,
    args: [paymentId],
    chain,
    type: "legacy",
  });
  await publicClient.waitForTransactionReceipt({ hash });
  log({ action: functionName, paymentId, txHash: hash, explorer: txLink(hash) });
}

async function setup() {
  if (!env.ownerKey || !env.merchant) throw new Error("OWNER_PRIVATE_KEY and MERCHANT_ADDRESS are required");
  const { account, client } = walletFor(env.ownerKey);
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 4 * 3600);

  const approveHash = await client.writeContract({
    address: (await publicClient.readContract({ address: env.guard, abi: guardAbi, functionName: "token" })) as Address,
    abi: erc20Abi,
    functionName: "approve",
    args: [env.guard, parseUnits("20", 6)],
    chain,
    type: "legacy",
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });

  const depositHash = await client.writeContract({
    address: env.guard, abi: guardAbi, functionName: "deposit",
    args: [env.agentId, parseUnits("20", 6)], chain, type: "legacy",
  });
  await publicClient.waitForTransactionReceipt({ hash: depositHash });

  const keys = [
    { session: agentAccount.address, label: "main" },
    { session: privateKeyToAccount(REVOKED_PK).address, label: "revoked" },
    { session: privateKeyToAccount(EXPIRED_PK).address, label: "expired" },
  ];
  for (const k of keys) {
    const hash = await client.writeContract({
      address: env.guard, abi: guardAbi, functionName: "registerSessionKey",
      args: [k.session, env.agentId, parseUnits("4", 6), parseUnits("8", 6), parseUnits("2.5", 6), expiresAt, [env.merchant]],
      chain, type: "legacy",
    });
    await publicClient.waitForTransactionReceipt({ hash });
    log({ action: "registerSessionKey", label: k.label, session: k.session, txHash: hash, explorer: txLink(hash) });
  }
  log({ owner: account.address, vault: "20 tUSD8", perTxCap: "4 tUSD8", dailyCap: "8 tUSD8", approvalThreshold: "2.5 tUSD8" });
}

async function init() {
  const policy = await readPolicy(agentAccount.address);
  const v = await publicClient.readContract({
    address: env.guard, abi: guardAbi, functionName: "vault",
    args: [await publicClient.readContract({ address: env.guard, abi: guardAbi, functionName: "agentKey", args: [env.agentId] })],
  });
  const remaining = await publicClient.readContract({ address: env.guard, abi: guardAbi, functionName: "dailyRemaining", args: [agentAccount.address] });
  log({
    chainId: await publicClient.getChainId(),
    guard: env.guard,
    explorer: addressLink(env.guard),
    signer: agentAccount.address,
    policy: {
      owner: policy.owner,
      perTxCap: formatUnits(policy.perTxCap, 6),
      dailyCap: formatUnits(policy.dailyCap, 6),
      spentToday: formatUnits(policy.spentToday, 6),
      remaining: formatUnits(remaining, 6),
      approvalThreshold: formatUnits(policy.approvalThreshold, 6),
      expiresAt: new Date(Number(policy.expiresAt) * 1000).toISOString(),
      active: policy.active,
    },
    vault: formatUnits(v, 6),
  });
}

async function scenario(name: string) {
  switch (name) {
    case "allowed":
      return payFrom(env.agentKey, env.merchant, "1", "allowed");
    case "approval": {
      const result = await payFrom(env.agentKey, env.merchant, "3", "approval-requested");
      if (statusNames[(await readStatus(result.paymentId))] === "Pending") await ownerCall("approve", result.paymentId);
      return result;
    }
    case "cap":
      return payFrom(env.agentKey, env.merchant, "5", "per-tx-cap-blocked");
    case "notallowlisted":
      return payFrom(env.agentKey, DEAD_ADDRESS, "1", "recipient-blocked");
    case "dailycap": {
      await payFrom(env.agentKey, env.merchant, "4", "dailycap-spend");
      return payFrom(env.agentKey, env.merchant, "1", "dailycap-blocked");
    }
    case "revoked": {
      if (!env.ownerKey) throw new Error("OWNER_PRIVATE_KEY required");
      const { client } = walletFor(env.ownerKey);
      const hash = await client.writeContract({
        address: env.guard, abi: guardAbi, functionName: "revokeSessionKey",
        args: [privateKeyToAccount(REVOKED_PK).address], chain, type: "legacy",
      });
      await publicClient.waitForTransactionReceipt({ hash });
      log({ action: "revokeSessionKey", txHash: hash, explorer: txLink(hash) });
      return payFrom(REVOKED_PK, env.merchant, "1", "revoked-blocked");
    }
    case "expired": {
      if (!env.ownerKey) throw new Error("OWNER_PRIVATE_KEY required (must be the deployer/admin)");
      const { client } = walletFor(env.ownerKey);
      const hash = await client.writeContract({
        address: env.guard, abi: guardAbi, functionName: "forceExpireSessionKey",
        args: [privateKeyToAccount(EXPIRED_PK).address], chain, type: "legacy",
      });
      await publicClient.waitForTransactionReceipt({ hash });
      log({ action: "forceExpireSessionKey", txHash: hash, explorer: txLink(hash) });
      return payFrom(EXPIRED_PK, env.merchant, "1", "expired-blocked");
    }
    default:
      throw new Error(`Unknown scenario: ${name}. Use allowed|approval|cap|notallowlisted|dailycap|revoked|expired`);
  }
}

async function main() {
  const [command, arg] = process.argv.slice(2);
  switch (command) {
    case "init": return init();
    case "setup": return setup();
    case "status": return init();
    case "pay": {
      if (!arg || !env.merchant) throw new Error("Usage: pay <amount> (MERCHANT_ADDRESS required)");
      return payFrom(env.agentKey, env.merchant, arg, "manual-pay");
    }
    case "approve": {
      if (!arg) throw new Error("Usage: approve <paymentId>");
      return ownerCall("approve", arg as Hex);
    }
    case "scenario": {
      if (!arg) throw new Error("Usage: scenario <name>");
      return scenario(arg);
    }
    case "demo": {
      for (const name of ["allowed", "cap", "notallowlisted", "approval", "dailycap", "revoked", "expired"]) {
        console.log(`\n===== ${name} =====`);
        try {
          await scenario(name);
        } catch (e) {
          console.error(`SCENARIO FAILED ${name}: ${e instanceof Error ? e.message : String(e)}`);
          process.exitCode = 1;
        }
      }
      return;
    }
    default:
      console.log("Commands: init | status | setup | pay <amount> | approve <paymentId> | scenario <name> | demo");
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
