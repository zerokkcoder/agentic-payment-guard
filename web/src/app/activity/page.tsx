"use client";

import { getAllLogsChunked, guardAbi, txUrl } from "@aevum-kit/aevum";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { decodeEventLog, formatUnits, type Hash, type Log, type PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { useNetwork } from "@/lib/network";
import { explainBlockReason } from "@/lib/decodeError";
import { short } from "@/components/ExploreLink";

type Kind =
  | "executed" | "blocked" | "approval" | "approved" | "rejected"
  | "deposit" | "withdraw" | "registered" | "revoked" | "policy" | "allowlist" | "reset";

interface Item {
  kind: Kind;
  id: string;
  key: string;
  recipient: string;
  amount?: bigint;
  reason?: number;
  detail: string;
  block: bigint;
  tx: Hash;
}

const labels: Record<Kind, string> = {
  executed: "已执行 / Executed",
  blocked: "已拦截 / Blocked",
  approval: "待审批 / Pending",
  approved: "已批准 / Approved",
  rejected: "已拒绝 / Rejected",
  deposit: "存入资金 / Deposit",
  withdraw: "取出资金 / Withdraw",
  registered: "注册密钥 / Key registered",
  revoked: "撤销密钥 / Key revoked",
  policy: "更新策略 / Policy updated",
  allowlist: "白名单变更 / Allowlist",
  reset: "每日重置 / Daily reset",
};

const chipClass: Record<Kind, string> = {
  executed: "ok",
  approved: "ok",
  registered: "ok",
  deposit: "ok",
  blocked: "bad",
  rejected: "bad",
  revoked: "bad",
  approval: "warn",
  policy: "warn",
  allowlist: "warn",
  withdraw: "warn",
  reset: "idle",
};

function decode(log: Log): Item | null {
  try {
    if (!log.transactionHash) return null;
    const d = decodeEventLog({ abi: guardAbi, data: log.data, topics: log.topics as [] });
    const a = d.args as Record<string, unknown>;
    const base = {
      block: log.blockNumber ?? 0n,
      tx: log.transactionHash as Hash,
      key: "",
      recipient: "",
    };
    switch (d.eventName) {
      case "PaymentExecuted":
        return { ...base, kind: "executed", id: String(a.paymentId), key: String(a.sessionKey), recipient: String(a.recipient), amount: a.amount as bigint, detail: "" };
      case "PaymentBlocked":
        return { ...base, kind: "blocked", id: String(a.paymentId), key: String(a.sessionKey), recipient: String(a.recipient), amount: a.amount as bigint, reason: Number(a.reason), detail: "" };
      case "ApprovalRequired":
        return { ...base, kind: "approval", id: String(a.paymentId), key: String(a.sessionKey), recipient: String(a.recipient), amount: a.amount as bigint, detail: "" };
      case "PaymentApproved":
        return { ...base, kind: "approved", id: String(a.paymentId), key: String(a.approver), detail: "" };
      case "PaymentRejected":
        return { ...base, kind: "rejected", id: String(a.paymentId), key: String(a.approver), detail: "" };
      case "VaultDeposited":
        return { ...base, kind: "deposit", id: `agent-${a.agentId}`, key: String(a.from), amount: a.amount as bigint, detail: `agentId ${a.agentId}` };
      case "VaultWithdrawn":
        return { ...base, kind: "withdraw", id: `agent-${a.agentId}`, key: String(a.to), amount: a.amount as bigint, detail: `agentId ${a.agentId}` };
      case "SessionKeyRegistered":
        return { ...base, kind: "registered", id: String(a.sessionKey), key: String(a.sessionKey), detail: `agentId ${a.agentId}` };
      case "SessionKeyRevoked":
        return { ...base, kind: "revoked", id: String(a.sessionKey), key: String(a.sessionKey), detail: "" };
      case "PolicyUpdated":
        return { ...base, kind: "policy", id: String(a.sessionKey), key: String(a.sessionKey), detail: "" };
      case "AllowlistUpdated":
        return { ...base, kind: "allowlist", id: String(a.sessionKey), key: String(a.sessionKey), recipient: String(a.recipient), detail: a.allowed ? "added" : "removed" };
      case "DailyReset":
        return { ...base, kind: "reset", id: String(a.sessionKey), key: String(a.sessionKey), amount: a.spentToday as bigint, detail: "" };
      default:
        return null;
    }
  } catch {
    return null;
  }
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
      const all = await getAllLogsChunked(client!, { address: guard!, fromBlock: from, toBlock: head });
      const items = all
        .map((l) => decode(l))
        .filter((i): i is Item => i !== null)
        .sort((a, b) => (a.block < b.block ? 1 : a.block > b.block ? -1 : 0));
      return { from, head, items };
    },
  });

  return (
    <main className="shell">
      <div className="page-head">
        <div>
          <p className="eyebrow">Verifiable audit trail · 可验证审计轨迹</p>
          <h1>链上活动 / On-chain activity</h1>
          <p className="lede">每一笔付款、每一次密钥或策略变更都有链上事件。/ Every payment and every key or policy change has an on-chain event.</p>
        </div>
        {logs.data && <div className="score"><span className="score-num">{logs.data.items.length}</span><span className="fine">events</span></div>}
      </div>

      {!guard ? (
        <div className="card empty">Set <code>NEXT_PUBLIC_GUARD_{net.key.toUpperCase()}</code> in <code>web/.env.local</code>.</div>
      ) : (
        <section className="card flush">
          {logs.isFetching && <p className="empty">读取链上事件… / Reading on-chain events…</p>}
          {logs.error && <p className="empty">Couldn&apos;t read events: {(logs.error as Error).message}</p>}
          {logs.data && logs.data.items.length === 0 && !logs.isFetching && !logs.error && (
            <p className="empty">还没有事件。先在 <Link href="/policies">策略页</Link> 存钱并注册密钥，再在 <Link href="/agent">Agent 页</Link> 发起一笔付款。<br />No events yet. Deposit and register a key on <Link href="/policies">Policies</Link>, then send a payment from the <Link href="/agent">Agent</Link> page.</p>
          )}
          {logs.data && logs.data.items.length > 0 && (
            <div className="table-wrap">
              <table className="data">
                <thead><tr><th>Result</th><th>Actor / key</th><th>Recipient</th><th className="right">Amount</th><th className="right">Block</th><th>Links</th></tr></thead>
                <tbody>
                  {logs.data.items.map((l) => (
                    <tr key={`${l.tx}-${l.id}-${l.kind}`}>
                      <td>
                        <span className={`chip ${chipClass[l.kind]}`} />
                        {labels[l.kind]}
                        {l.kind === "blocked" && <div className="fine">{explainBlockReason(l.reason)}</div>}
                        {l.detail && <div className="fine">{l.detail}</div>}
                      </td>
                      <td className="mono">{l.key ? short(l.key) : "—"}</td>
                      <td className="mono">{l.recipient ? short(l.recipient) : "—"}</td>
                      <td className="right num">{l.amount !== undefined ? `${formatUnits(l.amount, 6)} tUSD8` : "—"}</td>
                      <td className="right num">{l.block.toString()}</td>
                      <td style={{ display: "flex", gap: 14 }}>
                        {(l.kind === "executed" || l.kind === "blocked" || l.kind === "approval" || l.kind === "approved" || l.kind === "rejected") && l.id.startsWith("0x") && <Link href={`/verify/${l.id}`}>Receipt</Link>}
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
