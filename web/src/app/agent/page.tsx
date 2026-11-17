"use client";

import { useState } from "react";
import { guardAbi, identityAbi } from "@aevum-kit/aevum";
import { formatUnits, isAddress, parseUnits, type Address, type Hash, type PublicClient } from "viem";
import { useAccount, usePublicClient, useReadContract, useWriteContract } from "wagmi";
import { useNetwork } from "@/lib/network";
import { explainError } from "@/lib/decodeError";
import { ExploreLink } from "@/components/ExploreLink";
import { TxStatus } from "@/components/TxStatus";

const scenarios = [
  { name: "allowed", zh: "边界内付款，链上执行", en: "Pay inside the policy" },
  { name: "cap", zh: "超过单笔上限，被拦截", en: "Per-tx cap blocks it" },
  { name: "notallowlisted", zh: "收款人不在白名单，被拦截", en: "Recipient not allowlisted" },
  { name: "approval", zh: "大额付款进入人工审批", en: "Large payment waits for a human" },
  { name: "dailycap", zh: "每日累计上限生效", en: "Daily cap kicks in" },
  { name: "revoked", zh: "撤销后立即失效", en: "Revoked key stops immediately" },
  { name: "expired", zh: "过期钥匙被拦截", en: "Expired key is blocked" },
];

function BrowserPayment() {
  const { net } = useNetwork();
  const guard = net.guard;
  const { address, isConnected, chainId } = useAccount();
  const onChain = isConnected && chainId === net.chain.id;
  const publicClient = usePublicClient({ chainId: net.chain.id }) as PublicClient | undefined;
  const { writeContractAsync } = useWriteContract();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("3");
  const [hash, setHash] = useState<Hash>();
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // The connected wallet is the session key. Show its live policy so the form can guide the user.
  const policy = useReadContract({
    address: guard,
    abi: guardAbi,
    functionName: "policies",
    args: isAddress(address ?? "") ? [address as Address] : undefined,
    query: { enabled: Boolean(guard && address) },
  });
  const remaining = useReadContract({
    address: guard,
    abi: guardAbi,
    functionName: "dailyRemaining",
    args: isAddress(address ?? "") ? [address as Address] : undefined,
    query: { enabled: Boolean(guard && address) },
  });

  async function send() {
    setError("");
    setNote("");
    setHash(undefined);
    if (!guard || !publicClient || !address || !onChain) {
      setError("请先连接钱包并切换到 Aevum 测试网。/ Connect your wallet on Aevum testnet first.");
      return;
    }
    if (!isAddress(recipient)) {
      setError("请填写有效的收款人地址，且它必须在 /policies 注册的白名单里。/ Enter a valid allowlisted recipient.");
      return;
    }
    let value: bigint;
    try {
      value = parseUnits(amount, 6);
      if (value <= 0n) throw new Error();
    } catch {
      setError("金额必须是大于 0 的数字（最多 6 位小数）。/ Amount must be a positive number with up to 6 decimals.");
      return;
    }
    setBusy(true);
    try {
      const paymentId = await publicClient.readContract({
        address: guard,
        abi: guardAbi,
        functionName: "nextPaymentId",
        args: [address as Address],
      });
      const validBefore = BigInt(Math.floor(Date.now() / 1000) + 1800);
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipient,
          amount: value.toString(),
          validBefore: validBefore.toString(),
          paymentId,
        }),
      });
      if (!res.ok) throw new Error(`报价服务失败 / Quote service failed: ${res.status} ${(await res.text()).slice(0, 160)}`);
      const quoteSig = (await res.json() as { signature: Hash }).signature;

      const tx = await writeContractAsync({
        address: guard,
        abi: guardAbi,
        functionName: "pay",
        args: [recipient as Address, value, validBefore, quoteSig],
        chainId: net.chain.id,
      });
      setHash(tx);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      const threshold = policy.data?.[7] ?? 0n;
      setNote(value > threshold
        ? `这笔金额高于审批阈值，已进入审批队列。去「审批队列」用主人钱包批准：/approvals · paymentId ${paymentId.slice(0, 18)}…\nAbove the approval threshold — go to /approvals to approve it.`
        : `付款已执行。查看回执：/verify/${paymentId}\nPayment executed. See /verify/${paymentId}`);
    } catch (e) {
      setError(explainError(e));
    } finally {
      setBusy(false);
    }
  }

  const p = policy.data;
  const threshold = p?.[7];
  const active = p?.[8];

  return (
    <div className="card">
      <h2>浏览器付款 / Pay from the browser</h2>
      <p className="sub">
        用当前连接的钱包作为 AI session key 直接付款，无需 CLI。先在 <a href="/policies">策略页</a> 把「这个钱包地址」注册为 session key，并把收款人加入白名单。
        Pay directly from the connected wallet as the AI session key — no CLI needed. First register this wallet as a session key and allowlist the recipient on the Policies page.
      </p>
      {!onChain && <p className="sub">连接钱包并切换到 Aevum 后再操作。/ Connect and switch to Aevum first.</p>}
      {onChain && p && (
        <dl className="kv">
          <dt>Session key</dt><dd className="mono">{address ? <ExploreLink kind="address" value={address} /> : "—"}</dd>
          <dt>Active</dt><dd>{active ? "yes" : "no — go to /policies to register"}</dd>
          <dt>Per-tx / Daily cap</dt><dd>{threshold !== undefined ? `${formatUnits(p[2], 6)} / ${formatUnits(p[3], 6)} tUSD8` : "—"}</dd>
          <dt>Approval threshold</dt><dd>{threshold !== undefined ? `${formatUnits(threshold, 6)} tUSD8` : "—"}</dd>
          <dt>Remaining today</dt><dd>{remaining.data !== undefined ? `${formatUnits(remaining.data, 6)} tUSD8` : "—"}</dd>
        </dl>
      )}
      <div className="form-grid" style={{ marginTop: 14 }}>
        <label>收款人 / Recipient<input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="0x… (must be allowlisted)" /></label>
        <label>金额 / Amount (tUSD8)<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" /></label>
      </div>
      <p className="fine" style={{ marginTop: 8 }}>
        填一个高于审批阈值的金额（默认 3 &gt; 2.5）会生成审批请求；≤ 阈值则直接执行。
        An amount above the threshold (default 3 &gt; 2.5) creates an approval request; at or below it executes immediately.
      </p>
      <button className="btn" style={{ marginTop: 12 }} disabled={!onChain || busy || !p} onClick={() => void send()}>
        {busy ? "提交中 / Submitting…" : "发起付款 / Send payment"}
      </button>
      <TxStatus hash={hash} />
      {note && <p className="good-text" style={{ whiteSpace: "pre-line" }}>{note}</p>}
      {error && <p className="bad-text">{error}</p>}
    </div>
  );
}

export default function AgentPage() {
  const { net } = useNetwork();
  const identity = useReadContract({
    address: net.identity,
    abi: identityAbi,
    functionName: "tokenURI",
    args: [1n],
    query: { enabled: Boolean(net.identity) },
  });
  const registry = useReadContract({
    address: net.identity,
    abi: identityAbi,
    functionName: "agentRegistry",
    query: { enabled: Boolean(net.identity) },
  });
  const signer = useReadContract({
    address: net.guard,
    abi: guardAbi,
    functionName: "quoteSigner",
    query: { enabled: Boolean(net.guard) },
  });

  return (
    <main className="shell">
      <section className="page-head">
        <div>
          <p className="eyebrow">Agent console · 代理控制台</p>
          <h1>AI Agent 支付演示</h1>
          <p className="lede">在浏览器里发起一笔付款，或用真实 agent CLI 在链上执行 7 个场景。/ Send a payment in the browser, or run seven scenarios with the real agent CLI.</p>
        </div>
      </section>

      <section className="grid-2">
        <div className="stack">
          <BrowserPayment />
          <div className="card">
            <h2>运行 CLI 演示 / Run the CLI demo</h2>
            <pre className="code-block">{`cp agent/.env.example agent/.env
# fill in the test keys and deployed addresses
npm --prefix agent run setup
npm --prefix agent run demo`}</pre>
            <p className="sub">每个场景都会打印 paymentId、交易哈希和区块浏览器链接。<br />Each scenario prints a paymentId, tx hash and explorer link.</p>
            <h3 style={{ marginTop: 20 }}>场景 / Scenarios</h3>
            <ol>
              {scenarios.map((s) => <li key={s.name}><code>{s.name}</code> — {s.zh} / {s.en}</li>)}
            </ol>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h2>ERC-8004 身份 / Agent identity</h2>
            <dl className="kv">
              <dt>Registry</dt><dd>{net.identity ? <ExploreLink kind="address" value={net.identity} /> : "not configured"}</dd>
              <dt>agentRegistry</dt><dd className="mono">{String(registry.data ?? "—")}</dd>
              <dt>agent #1 URI</dt><dd className="mono">{String(identity.data ?? "—")}</dd>
              <dt>Quote signer</dt><dd className="mono">{String(signer.data ?? "—")}</dd>
            </dl>
          </div>
          <div className="card info">
            <h2>为什么自部署？/ Why self-deploy?</h2>
            <p>QDay 官方 ERC-8004 注册表和 ERC-4337 会话密钥地址尚未公布。本项目在 Aevum 上自部署参考实现，所有原语都可立即验证。<br />QDay has not published official ERC-8004 or ERC-4337 addresses yet. This app deploys reference implementations on Aevum so every primitive is verifiable today.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
