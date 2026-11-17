"use client";

import { guardAbi, getLogsChunked, txUrl } from "@aevum-kit/aevum";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { formatUnits, getAbiItem, type PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { useNetwork } from "@/lib/network";
import { explainBlockReason } from "@/lib/decodeError";
import { short } from "@/components/ExploreLink";

const executed = getAbiItem({ abi: guardAbi, name: "PaymentExecuted" });
const blocked = getAbiItem({ abi: guardAbi, name: "PaymentBlocked" });
const approval = getAbiItem({ abi: guardAbi, name: "ApprovalRequired" });

interface Item {
  kind: "executed" | "blocked" | "approval";
  id: string;
  key: string;
  recipient: string;
  amount: bigint;
  reason?: number;
  block: bigint;
  tx: `0x${string}`;
}

export default function ActivityPage() {
  const { net } = useNetwork();
  const guard = net.guard;
  const client = usePublicClient({ chainId: net.chain.id }) as PublicClient | undefined;

  const logs = useQuery({
    queryKey: ["guard-activity", net.chain.id, guard, net.deployBlock?.toString()],
    enabled: Boolean(client && guard),
    queryFn: async () => {
      const head = await client!.getBlockNumber();
      const from = net.deployBlock ?? (head > 5000n ? head - 5000n : 0n);
      const common = { address: guard!, fromBlock: from, toBlock: head };
      const [ok, no, ap] = await Promise.all([
        getLogsChunked(client!, { ...common, event: executed }),
        getLogsChunked(client!, { ...common, event: blocked }),
        getLogsChunked(client!, { ...common, event: approval }),
      ]);
      const items: Item[] = [
        ...ok.map((l) => ({ kind: "executed" as const, id: l.args.paymentId!, key: l.args.sessionKey!, recipient: l.args.recipient!, amount: l.args.amount!, block: l.blockNumber, tx: l.transactionHash })),
        ...no.map((l) => ({ kind: "blocked" as const, id: l.args.paymentId!, key: l.args.sessionKey!, recipient: l.args.recipient!, amount: l.args.amount!, reason: Number(l.args.reason), block: l.blockNumber, tx: l.transactionHash })),
        ...ap.map((l) => ({ kind: "approval" as const, id: l.args.paymentId!, key: l.args.sessionKey!, recipient: l.args.recipient!, amount: l.args.amount!, block: l.blockNumber, tx: l.transactionHash })),
      ];
      return { from, head, items: items.sort((a, b) => (a.block < b.block ? 1 : -1)) };
    },
  });

  const labels = { executed: "已执行 / Executed", blocked: "已拦截 / Blocked", approval: "待审批 / Pending" };

  return (
    <main className="shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Verifiable audit trail · 可验证审计轨迹</p>
          <h1>链上活动 / On-chain activity</h1>
          <p className="lede">每一笔 AI 付款，包括被拦截的，都有链上事件。/ Every AI payment, including blocked ones, has an on-chain event.</p>
        </div>
        {logs.data && <div className="score"><span className="score-num">{logs.data.items.length}</span><span className="fine">events</span></div>}
      </div>

      {!guard ? (
        <div className="card empty">Set <code>NEXT_PUBLIC_GUARD_{net.key.toUpperCase()}</code> in <code>web/.env.local</code>.</div>
      ) : (
        <section className="card flush">
          {logs.error && <p className="empty">Couldn&apos;t read events: {(logs.error as Error).message}</p>}
          {logs.data && logs.data.items.length === 0 && !logs.isFetching && <p className="empty">No guard events yet. Run <code>npm --prefix agent run demo</code>.</p>}
          {logs.data && logs.data.items.length > 0 && (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Result</th><th>Agent key</th><th>Recipient</th><th className="right">Amount</th><th className="right">Block</th><th>Links</th></tr></thead>
                <tbody>
                  {logs.data.items.map((l) => (
                    <tr key={`${l.tx}-${l.id}-${l.kind}`}>
                      <td>
                        <span className={`chip ${l.kind === "executed" ? "ok" : l.kind === "blocked" ? "bad" : "warn"}`} />
                        {labels[l.kind]}
                        {l.kind === "blocked" && <div className="fine">{explainBlockReason(l.reason)}</div>}
                      </td>
                      <td className="mono">{short(l.key)}</td>
                      <td className="mono">{short(l.recipient)}</td>
                      <td className="right num">{formatUnits(l.amount, 6)} tUSD8</td>
                      <td className="right num">{l.block.toString()}</td>
                      <td style={{ display: "flex", gap: 14 }}>
                        <Link href={`/verify/${l.id}`}>Receipt</Link>
                        {net.hasExplorer && <a href={txUrl(l.tx)} target="_blank" rel="noreferrer">Tx ↗</a>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
