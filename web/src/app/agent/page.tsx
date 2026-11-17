"use client";

import { guardAbi, identityAbi } from "@aevum-kit/aevum";
import { useReadContract } from "wagmi";
import { useNetwork } from "@/lib/network";
import { ExploreLink } from "@/components/ExploreLink";

const scenarios = [
  { name: "allowed", zh: "边界内付款，链上执行", en: "Pay inside the policy" },
  { name: "cap", zh: "超过单笔上限，被拦截", en: "Per-tx cap blocks it" },
  { name: "notallowlisted", zh: "收款人不在白名单，被拦截", en: "Recipient not allowlisted" },
  { name: "approval", zh: "大额付款进入人工审批", en: "Large payment waits for a human" },
  { name: "dailycap", zh: "每日累计上限生效", en: "Daily cap kicks in" },
  { name: "revoked", zh: "撤销后立即失效", en: "Revoked key stops immediately" },
  { name: "expired", zh: "过期钥匙被拦截", en: "Expired key is blocked" },
];

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
          <p className="lede">真实 AI agent CLI 在链上执行 7 个场景。/ A real agent CLI executes seven scenarios on-chain.</p>
        </div>
      </section>

      <section className="grid-2">
        <div className="card">
          <h2>运行演示 / Run the demo</h2>
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
