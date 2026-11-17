"use client";

import { guardAbi, txUrl } from "@aevum-kit/aevum";
import { formatUnits, parseAbiItem, type Hex } from "viem";
import { useParams } from "next/navigation";
import { usePublicClient } from "wagmi";
import { useEffect, useState } from "react";
import { useNetwork } from "@/lib/network";
import { explainBlockReason } from "@/lib/decodeError";
import { short } from "@/components/ExploreLink";

const labels = ["None", "Pending", "Executed", "Rejected", "Blocked"];

export default function ReceiptPage() {
  const { paymentId } = useParams<{ paymentId: string }>();
  const { net } = useNetwork();
  const client = usePublicClient({ chainId: net.chain.id });
  const [data, setData] = useState<null | { status: number; from: string; to: string; amount: bigint; reason?: number }>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!client || !net.guard || !paymentId) return;
    (async () => {
      try {
        const status = await client.readContract({ address: net.guard!, abi: guardAbi, functionName: "status", args: [paymentId as Hex] });
        const p = await client.readContract({ address: net.guard!, abi: guardAbi, functionName: "payments", args: [paymentId as Hex] });
        const logs = await client.getLogs({
          address: net.guard!,
          event: parseAbiItem("event PaymentBlocked(bytes32 indexed paymentId,address indexed sessionKey,address indexed recipient,uint256 amount,uint8 reason)"),
          args: { paymentId: paymentId as Hex },
          fromBlock: net.deployBlock ?? 0n,
        });
        setData({
          status: Number(status),
          from: p[0],
          to: p[1],
          amount: p[2],
          reason: logs.length ? Number(logs[logs.length - 1].args.reason) : undefined,
        });
      } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    })();
  }, [client, net.guard, net.deployBlock, paymentId]);

  if (!net.guard) return <main className="shell"><div className="card empty">Guard address not configured.</div></main>;

  return (
    <main className="shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Receipt · 回执</p>
          <h1>付款验证 / Verify a payment</h1>
          <p className="lede mono">{paymentId}</p>
        </div>
      </div>
      <div className="card">
        {error && <p className="bad-text">{error}</p>}
        {!data && !error && <p className="sub">读取链上状态… / Reading on-chain state…</p>}
        {data && (
          <>
            <dl className="kv">
              <dt>状态 / Status</dt><dd className={data.status === 4 ? "bad-text" : "good-text"}>{labels[data.status]}</dd>
              <dt>Session key</dt><dd className="mono">{data.from}</dd>
              <dt>收款人 / Recipient</dt><dd className="mono">{data.to}</dd>
              <dt>金额 / Amount</dt><dd>{formatUnits(data.amount, 6)} tUSD8</dd>
              {data.reason !== undefined && <><dt>拦截原因 / Block reason</dt><dd>{explainBlockReason(data.reason)} <span className="fine">(code {data.reason})</span></dd></>}
            </dl>
            <p className="sub" style={{ marginTop: 16 }}>{short(paymentId)} · {net.chain.name} · chain {net.chain.id}</p>
          </>
        )}
      </div>
    </main>
  );
}
