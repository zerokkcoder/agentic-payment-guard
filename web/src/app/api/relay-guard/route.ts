import { NextResponse } from "next/server";
import { createPublicClient, createWalletClient, http, isAddress, isHex, type Address, type Hex } from "viem";
import { nonceManager, privateKeyToAccount } from "viem/accounts";
import { aevumTestnet, guardAbi } from "@aevum-kit/aevum";

/** Gasless submission of a session key's signed PaymentGuard intent. */
export const runtime = "nodejs";

const hits = new Map<string, number[]>();
function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 10;
}

export async function POST(request: Request) {
  const key = process.env.RELAYER_PRIVATE_KEY as Hex | undefined;
  const guard = (process.env.NEXT_PUBLIC_GUARD_AEVUM || process.env.GUARD_ADDRESS) as Address | undefined;
  if (!key || !guard) return NextResponse.json({ error: "relayer not configured" }, { status: 503 });

  const ip = request.headers.get(process.env.TRUSTED_IP_HEADER || "x-forwarded-for") || "unknown";
  if (limited(ip)) return NextResponse.json({ error: "rate limited" }, { status: 429 });

  let body: {
    payment?: { sessionKey?: string; recipient?: string; amount?: string; validAfter?: string; validBefore?: string; paymentId?: string };
    sessionSig?: string; quoteSig?: string;
  };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "invalid JSON" }, { status: 400 }); }
  const p = body.payment;
  if (!p || !p.sessionKey || !isAddress(p.sessionKey) || !p.recipient || !isAddress(p.recipient)
    || !p.amount || !p.validAfter || !p.validBefore || !p.paymentId || !isHex(p.paymentId)
    || !body.sessionSig || !isHex(body.sessionSig) || !body.quoteSig || !isHex(body.quoteSig)) {
    return NextResponse.json({ error: "invalid payment intent" }, { status: 400 });
  }
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (BigInt(p.validBefore) < now || BigInt(p.validBefore) > now + 3600n) {
    return NextResponse.json({ error: "signature window too long or expired" }, { status: 400 });
  }

  const account = privateKeyToAccount(key, { nonceManager });
  const client = createPublicClient({ chain: aevumTestnet, transport: http(process.env.RPC_URL || "https://rpc-test.qday.info") });
  const wallet = createWalletClient({ account, chain: aevumTestnet, transport: http(process.env.RPC_URL || "https://rpc-test.qday.info") });
  const args = [
    [
      p.sessionKey as Address,
      p.recipient as Address,
      BigInt(p.amount),
      BigInt(p.validAfter),
      BigInt(p.validBefore),
      p.paymentId as Hex,
    ],
    body.sessionSig as Hex,
    body.quoteSig as Hex,
  ] as const;

  try {
    await client.simulateContract({ address: guard, abi: guardAbi, functionName: "payWithSignature", args });
    const hash = await wallet.writeContract({ address: guard, abi: guardAbi, functionName: "payWithSignature", args, type: "legacy" });
    return NextResponse.json({ hash });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
