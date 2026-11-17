"use client";

import { useCallback, useEffect, useState } from "react";
import { getLogsChunked, guardAbi } from "@aevum-kit/aevum";
import { parseAbiItem, type Hex } from "viem";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { useNetwork } from "@/lib/network";
import { explainError } from "@/lib/decodeError";
import { TxStatus } from "@/components/TxStatus";
import { ExploreLink } from "@/components/ExploreLink";

const requested = parseAbiItem("event ApprovalRequired(bytes32 indexed paymentId,address indexed sessionKey,address indexed recipient,uint256 amount)");

interface Row { id: Hex; key: string; recipient: string; amount: string; status: number; tx: Hex }

export default function ApprovalsPage() {
  const { net } = useNetwork();
  const guard = net.guard;
  const publicClient = usePublicClient({ chainId: net.chain.id });
  const { isConnected, chainId } = useAccount();
  const onChain = isConnected && chainId === net.chain.id;
  const { writeContractAsync } = useWriteContract();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [hash, setHash] = useState<Hex>();
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!guard || !publicClient) return;
    setLoading(true);
    try {
      const latest = await publicClient.getBlockNumber();
      const from = net.deployBlock ?? (latest > 5000n ? latest - 5000n : 0n);
      const logs = await getLogsChunked(publicClient, { address: guard, event: requested, fromBlock: from });
      const next = await Promise.all(logs.map(async (log) => {
        const id = log.args.paymentId as Hex;
        const status = await publicClient.readContract({ address: guard, abi: guardAbi, functionName: "status", args: [id] });
        return {
          id,
          key: log.args.sessionKey as string,
          recipient: log.args.recipient as string,
          amount: (Number(log.args.amount) / 1e6).toFixed(2),
          status: Number(status),
          tx: log.transactionHash,
        };
      }));
      setRows(next.reverse());
    } catch (e) {
      setError(explainError(e));
    } finally {
      setLoading(false);
    }
  }, [guard, net.deployBlock, publicClient]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function decide(id: Hex, approve: boolean) {
    if (!guard) return;
    setError("");
    try {
      setHash(await writeContractAsync({
        address: guard,
        abi: guardAbi,
        functionName: approve ? "approve" : "reject",
        args: [id],
        chainId: net.chain.id,
      }));
      await refresh();
    } catch (e) { setError(explainError(e)); }
  }

  const labels = ["None", "Pending", "Executed", "Rejected", "Blocked"];

  return (
    <main className="shell">
      <section className="page-head">
        <div>
          <p className="eyebrow">Human in the loop · 人工审批</p>
          <h1>审批队列 / Approval queue</h1>
          <p className="lede">超过阈值的 AI 付款会停在这里，等你确认。/ AI payments above the threshold stop here until you decide.</p>
        </div>
        <button className="btn secondary" onClick={() => void refresh()} disabled={loading}>刷新 / Refresh</button>
      </section>

      <div className="card flush">
        {rows.length === 0 && <p className="sub" style={{ padding: 20 }}>{loading ? "读取链上事件… / Reading on-chain events…" : "暂无审批请求 / No requests yet."}</p>}
        {rows.map((r) => (
          <div className="check" key={r.id}>
            <div className={`chip ${r.status === 1 ? "warn" : r.status === 2 ? "ok" : "bad"}`} />
            <div className="check-body">
              <div className="check-top">
                <span className="check-title">付款 / Payment {r.amount} tUSD8</span>
                <span className="check-value">{labels[r.status]}</span>
              </div>
              <p className="check-detail">
                ID {r.id.slice(0, 18)}… · payer {r.key.slice(0, 10)}… · to {r.recipient.slice(0, 10)}… · <ExploreLink kind="tx" value={r.tx} />
              </p>
              {r.status === 1 && (
                <div className="check-action">
                  <button className="btn small" disabled={!onChain} onClick={() => void decide(r.id, true)}>批准 / Approve</button>
                  <button className="btn warn small" disabled={!onChain} onClick={() => void decide(r.id, false)}>拒绝 / Reject</button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      <TxStatus hash={hash} />
      {error && <p className="bad-text">{error}</p>}
    </main>
  );
}
