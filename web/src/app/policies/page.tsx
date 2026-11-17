"use client";

import { useState } from "react";
import { erc20Abi, guardAbi } from "@aevum-kit/aevum";
import { isAddress, parseUnits, type Address, type Hex } from "viem";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { useNetwork } from "@/lib/network";
import { explainError } from "@/lib/decodeError";
import { TxStatus } from "@/components/TxStatus";

export default function PoliciesPage() {
  const { net } = useNetwork();
  const guard = net.guard;
  const { address, isConnected, chainId } = useAccount();
  const onChain = isConnected && chainId === net.chain.id;
  const [sessionKey, setSessionKey] = useState("");
  const [recipient, setRecipient] = useState("");
  const [perTx, setPerTx] = useState("4");
  const [daily, setDaily] = useState("8");
  const [threshold, setThreshold] = useState("2.5");
  const [deposit, setDeposit] = useState("20");
  const [hours, setHours] = useState("4");
  const [hash, setHash] = useState<Hex>();
  const [error, setError] = useState("");
  const { writeContractAsync } = useWriteContract();

  const token = useReadContract({
    address: guard,
    abi: guardAbi,
    functionName: "token",
    query: { enabled: Boolean(guard) },
  });

  const policy = useReadContract({
    address: guard,
    abi: guardAbi,
    functionName: "policies",
    args: isAddress(sessionKey) ? [sessionKey as Address] : undefined,
    query: { enabled: Boolean(guard) && isAddress(sessionKey) },
  });

  async function submit() {
    setError("");
    if (!guard || !isAddress(sessionKey) || !isAddress(recipient)) {
      setError("请填写有效的 session key 和收款人地址 / Enter valid session key and recipient addresses.");
      return;
    }
    try {
      const approveHash = await writeContractAsync({
        address: token.data!,
        abi: erc20Abi,
        functionName: "approve",
        args: [guard, parseUnits(deposit, 6)],
        chainId: net.chain.id,
      });
      setHash(approveHash);

      const depositHash = await writeContractAsync({
        address: guard,
        abi: guardAbi,
        functionName: "deposit",
        args: [1n, parseUnits(deposit, 6)],
        chainId: net.chain.id,
      });
      setHash(depositHash);

      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + Number(hours) * 3600);
      const registerHash = await writeContractAsync({
        address: guard,
        abi: guardAbi,
        functionName: "registerSessionKey",
        args: [
          sessionKey as Address,
          1n,
          parseUnits(perTx, 6),
          parseUnits(daily, 6),
          parseUnits(threshold, 6),
          expiresAt,
          [recipient as Address],
        ],
        chainId: net.chain.id,
      });
      setHash(registerHash);
    } catch (e) {
      setError(explainError(e));
    }
  }

  async function revoke() {
    setError("");
    if (!guard || !isAddress(sessionKey)) return;
    try {
      setHash(await writeContractAsync({
        address: guard, abi: guardAbi, functionName: "revokeSessionKey",
        args: [sessionKey as Address], chainId: net.chain.id,
      }));
    } catch (e) { setError(explainError(e)); }
  }

  if (!guard) {
    return <main className="shell"><div className="card"><h1>Policies / 策略</h1><p className="sub">未配置 PaymentGuard 地址。部署合约后设置 NEXT_PUBLIC_GUARD_AEVUM 并重启。<br />Set NEXT_PUBLIC_GUARD_AEVUM after deployment.</p></div></main>;
  }

  return (
    <main className="shell">
      <section className="page-head">
        <div>
          <p className="eyebrow">Human control plane · 人类控制台</p>
          <h1>AI 支付策略 / Payment policies</h1>
          <p className="lede">先存钱，再给 AI 一把有边界的钥匙。存款人自动成为资金池主人。<br />Deposit first, then register a scoped key. The first depositor becomes the vault owner.</p>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2>创建新策略 / Register a scoped key</h2>
          <div className="form-grid">
            <label>Session key (AI 地址)<input value={sessionKey} onChange={(e) => setSessionKey(e.target.value)} placeholder="0x..." /></label>
            <label>收款白名单 / Allowlist<input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x..." /></label>
            <label>存款 / Deposit (tUSD8)<input value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" /></label>
            <label>单笔上限 / Per-tx cap<input value={perTx} onChange={(e) => setPerTx(e.target.value)} inputMode="decimal" /></label>
            <label>每日上限 / Daily cap<input value={daily} onChange={(e) => setDaily(e.target.value)} inputMode="decimal" /></label>
            <label>人工审批阈值 / Approval threshold<input value={threshold} onChange={(e) => setThreshold(e.target.value)} inputMode="decimal" /></label>
            <label>有效期（小时）/ Expires in (hours)<input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="numeric" /></label>
          </div>
          <button className="btn" style={{ marginTop: 16 }} disabled={!onChain || !token.data} onClick={submit}>
            存入并注册 / Deposit & register
          </button>
          {!onChain && <p className="sub">请先连接钱包并切换到 {net.chain.name}。/ Connect and switch network first.</p>}
          <TxStatus hash={hash} />
          {error && <p className="bad-text">{error}</p>}
        </div>

        <div className="stack">
          <div className="card">
            <h2>查看并撤销 / Inspect & revoke</h2>
            <label>Session key<input value={sessionKey} onChange={(e) => setSessionKey(e.target.value)} placeholder="0x..." /></label>
            {policy.data && (
              <dl className="kv">
                <dt>Owner</dt><dd>{policy.data[0]}</dd>
                <dt>Per-tx / Daily</dt><dd>{String(policy.data[2])} / {String(policy.data[3])} (6 dec)</dd>
                <dt>Spent today</dt><dd>{String(policy.data[4])}</dd>
                <dt>Expires</dt><dd>{new Date(Number(policy.data[6]) * 1000).toLocaleString()}</dd>
                <dt>Active</dt><dd>{policy.data[8] ? "yes" : "no"}</dd>
              </dl>
            )}
            <button className="btn warn" style={{ marginTop: 16 }} disabled={!onChain || !isAddress(sessionKey)} onClick={revoke}>
              立即撤销 / Revoke now
            </button>
          </div>
          <div className="card info">
            <h2>安全模型 / Safety</h2>
            <ul>
              <li>每笔上限、每日上限、白名单、到期时间都在链上强制执行。/ Caps, allowlist and expiry are enforced on-chain.</li>
              <li>超过阈值的付款进入人工审批队列。/ Larger payments enter the human approval queue.</li>
              <li>撤销立即生效，不可绕过。/ Revocation is instant and cannot be bypassed.</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
