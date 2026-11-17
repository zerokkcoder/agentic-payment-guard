import { createPublicClient, http, isAddress, isHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { aevumTestnet, guardAbi } from "@aevum-kit/aevum";
import { NextResponse } from "next/server";

/** Signs the merchant quote that the agent must present to PaymentGuard. */
export async function POST(request: Request) {
  const key = process.env.QUOTE_SIGNER_PRIVATE_KEY as Hex | undefined;
  const guard = (process.env.NEXT_PUBLIC_GUARD_AEVUM || process.env.GUARD_ADDRESS) as Address | undefined;
  if (!key || !guard) {
    return NextResponse.json({ error: "QUOTE_SIGNER_PRIVATE_KEY and guard address are not configured" }, { status: 503 });
  }

  let body: { recipient?: string; amount?: string; validBefore?: string; paymentId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const { recipient, amount, validBefore, paymentId } = body;
  if (!recipient || !isAddress(recipient) || !amount || !validBefore || !paymentId || !isHex(paymentId)) {
    return NextResponse.json({ error: "recipient, amount, validBefore and paymentId are required" }, { status: 400 });
  }
  const value = BigInt(amount);
  const deadline = BigInt(validBefore);
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (value <= 0n || value > 1_000_000_000n) {
    return NextResponse.json({ error: "amount out of range" }, { status: 400 });
  }
  if (deadline < now || deadline > now + 3600n) {
    return NextResponse.json({ error: "quote window must be within one hour" }, { status: 400 });
  }

  try {
    const client = createPublicClient({ chain: aevumTestnet, transport: http(process.env.RPC_URL || "https://rpc-test.qday.info") });
    const digest = await client.readContract({
      address: guard,
      abi: guardAbi,
      functionName: "quoteDigest",
      args: [recipient as Address, value, deadline, paymentId as Hex],
    });
    // PaymentGuard verifies ECDSA.recover(digest, sig) on the raw EIP-712 digest.
    // Sign the hash directly — signMessage({raw}) adds an EIP-191 prefix and
    // would make every quote fail on-chain with BLOCK_BAD_QUOTE.
    const signature = await privateKeyToAccount(key).sign({ hash: digest });
    return NextResponse.json({ signature, digest, recipient, amount, validBefore, paymentId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
