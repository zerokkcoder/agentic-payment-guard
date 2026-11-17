"use client";

import { links, TUSD8_ADDRESS, erc20Abi } from "@aevum-kit/aevum";
import { formatEther, formatUnits } from "viem";
import { useAccount, useBalance, useBytecode, useReadContract, useWatchAsset } from "wagmi";
import { CheckIcon, CrossIcon, WarnIcon } from "@/components/Icons";
import { useToken } from "@/components/useToken";
import { useNetwork } from "@/lib/network";
import { short } from "@/lib/order";

type Status = "ok" | "warn" | "bad" | "idle";
interface Check {
  title: string;
  status: Status;
  value: string;
  detail: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

const DISCORD_FAUCET = "Verify in the QDay Discord, then run /faucet <your address> (1 tQDAY + 5 tUSD8, once). Docs › Get test tokens has the steps.";

// Shown on a fork, where balances surprise people: they are the real testnet balances.
const FORK_COPY = "Copied from Aevum testnet when the fork started. Spending it here doesn't touch the real testnet.";

export default function SetupPage() {
  const { net, select } = useNetwork();
  const appChain = net.chain;
  const chainMode = net.key;
  const guardAddress = net.guard;
  const { address, isConnected, chainId, connector } = useAccount();
  const onChain = isConnected && chainId === appChain.id;
  const token = useToken();

  const gas = useBalance({ address, chainId: appChain.id, query: { enabled: onChain } });
  const tokenBal = useReadContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: appChain.id,
    query: { enabled: onChain && Boolean(token.address) },
  });
  const code = useBytecode({ address: guardAddress, chainId: appChain.id, query: { enabled: Boolean(guardAddress) } });

  // Wallets don't list tokens on custom networks by themselves. This asks the wallet to show it
  // on the network it is on now (the app's network, since the button only shows when onChain).
  const { watchAsset } = useWatchAsset();
  const addToken =
    onChain && token.address
      ? {
          label: `Add ${token.symbol} to wallet`,
          onClick: () =>
            watchAsset({ type: "ERC20", options: { address: token.address!, symbol: token.symbol, decimals: token.decimals } }),
        }
      : undefined;

  const gasValue = gas.data?.value;
  const tokenValue = tokenBal.data;

  const checks: Check[] = [
    isConnected
      ? { title: "Wallet connected", status: "ok", value: short(address ?? ""), detail: `${connector?.name ?? "Wallet"} is connected.` }
      : { title: "Wallet connected", status: "bad", value: "not connected", detail: "Connect MetaMask, Rabby or any browser wallet with the button at the top right." },
    !isConnected
      ? { title: "Network", status: "idle", value: "—", detail: `Needs ${appChain.name} (${appChain.id}).` }
      : onChain
        ? { title: "Network", status: "ok", value: `chain ${appChain.id}`, detail: `Connected to ${appChain.rpcUrls.default.http[0]}.` }
        : {
            title: "Network",
            status: "bad",
            value: `chain ${chainId}`,
            detail: `Switch to ${appChain.name} (${appChain.id}). Your wallet will offer to add it.`,
            action: { label: "Switch network", onClick: () => select(net.key) },
          },
    !onChain || gasValue === undefined
      ? { title: `Gas (${appChain.nativeCurrency.symbol})`, status: "idle", value: "—", detail: "Pays for transactions. Session-key payments need a little." }
      : gasValue > 0n
        ? { title: `Gas (${appChain.nativeCurrency.symbol})`, status: "ok", value: `${Number(formatEther(gasValue)).toFixed(4)} ${appChain.nativeCurrency.symbol}`, detail: chainMode === "fork" ? FORK_COPY : "1 tQDAY covers hundreds of contract calls at 1 gwei." }
        : chainMode === "aevum"
          ? { title: "Gas (tQDAY)", status: "warn", value: "0 tQDAY", detail: DISCORD_FAUCET, action: { label: "Open web faucet", href: links.faucetWeb } }
          : { title: "Gas", status: "warn", value: "0", detail: chainMode === "fork" ? "Give yourself tQDAY and tUSD8 with `make deal TO=<address>`." : "Import one of anvil's default accounts into your wallet (local chain only)." },
    !onChain || tokenValue === undefined
      ? { title: `${token.symbol} balance`, status: "idle", value: "—", detail: "The stablecoin the guard pays (6 decimals)." }
      : tokenValue > 0n
        ? { title: `${token.symbol} balance`, status: "ok", value: `${formatUnits(tokenValue, token.decimals)} ${token.symbol}`, detail: chainMode === "fork" ? "Ready to pay. Also copied from Aevum testnet." : "Ready to pay.", action: addToken }
        : chainMode === "aevum"
          ? { title: "tUSD8 balance", status: "warn", value: "0 tUSD8", detail: DISCORD_FAUCET, action: addToken }
          : { title: `${token.symbol} balance`, status: "warn", value: "0", detail: chainMode === "fork" ? "On a fork, give yourself tUSD8 with `make deal TO=<address>`." : "MockUSD8 lets anyone mint: `make mint TO=<address>`.", action: addToken },
    !guardAddress
      ? { title: "PaymentGuard contract", status: "warn", value: "not set", detail: chainMode === "aevum" ? "Deploy it with `make deploy-all-aevum`, then set NEXT_PUBLIC_GUARD_AEVUM in web/.env.local." : chainMode === "fork" ? "Deploy it with `make deploy-all-fork`, then set NEXT_PUBLIC_GUARD_FORK in web/.env.local." : "Deploy it with `make deploy-all-local`, then set NEXT_PUBLIC_GUARD_LOCAL in web/.env.local." }
      : code.isLoading
        ? { title: "PaymentGuard contract", status: "idle", value: short(guardAddress), detail: "Looking it up…" }
        : code.data && code.data !== "0x"
          ? { title: "PaymentGuard contract", status: "ok", value: short(guardAddress), detail: "Deployed and reachable. This is the contract that enforces the agent's spending policy." }
          : { title: "PaymentGuard contract", status: "bad", value: short(guardAddress), detail: `No contract at this address on ${appChain.name}. Check the address in web/.env.local.` },
  ];

  const passed = checks.filter((c) => c.status === "ok").length;
  const left = checks.length - passed;

  return (
    <main className="shell">
      <section className="page-head">
        <div>
          <p className="eyebrow">Step 0 · Before you demo</p>
          <h1>Is your setup ready for Aevum?</h1>
          <p className="lede">We check your wallet, network, balances and PaymentGuard contract, then tell you exactly what to fix.</p>
        </div>
        <div className="score" aria-live="polite">
          <span className="score-num">
            {passed}
            <small> / {checks.length}</small>
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: left ? "var(--warn)" : "var(--good)" }}>
            {left ? `${left} item${left > 1 ? "s" : ""} to fix` : "Ready to demo"}
          </span>
        </div>
      </section>

      <section className="grid-2" aria-label="Checks">
        <div className="card flush">
          {checks.map((c) => (
            <div className="check" key={c.title}>
              <div className={`chip ${c.status}`}>
                {c.status === "ok" ? <CheckIcon /> : c.status === "bad" ? <CrossIcon /> : c.status === "warn" ? <WarnIcon /> : null}
              </div>
              <div className="check-body">
                <div className="check-top">
                  <span className="check-title">{c.title}</span>
                  <span className={`check-value ${c.status === "warn" ? "warn" : c.status === "bad" ? "bad" : ""}`}>{c.value}</span>
                </div>
                <p className="check-detail">{c.detail}</p>
                {c.action && (
                  <div className="check-action">
                    {c.action.href ? (
                      <a className="btn small" href={c.action.href} target="_blank" rel="noreferrer">
                        {c.action.label}
                      </a>
                    ) : (
                      <button type="button" className="btn small" onClick={c.action.onClick}>
                        {c.action.label}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="stack">
          <div className="card">
            <h2>Network details</h2>
            <p className="sub">
              Already set in <code>packages/aevum/src/chain.ts</code>.
              {chainMode === "fork" && " Balances start as a copy of Aevum testnet; what you spend here stays on your machine."}
            </p>
            <dl className="kv">
              <dt>Name</dt>
              <dd>{appChain.name}</dd>
              <dt>Chain ID</dt>
              <dd>{appChain.id}</dd>
              <dt>RPC</dt>
              <dd>{appChain.rpcUrls.default.http[0]}</dd>
              <dt>Explorer</dt>
              <dd>{net.hasExplorer ? links.explorer.replace("https://", "") : "none (local chain)"}</dd>
              <dt>tUSD8</dt>
              <dd>{chainMode === "local" ? "MockUSD8 (local)" : `${short(TUSD8_ADDRESS)} · 6 dec`}</dd>
              <dt>EVM</dt>
              <dd>shanghai</dd>
            </dl>
            {isConnected && !onChain && (
              <button type="button" className="btn secondary block" style={{ marginTop: 16 }} onClick={() => select(net.key)}>
                Add {appChain.name} to wallet
              </button>
            )}
          </div>

          <div className="card info">
            <h2>Known gotchas</h2>
            <ul>
              <li>
                Compile with <code>evm_version = &quot;shanghai&quot;</code>. Cancun builds deploy, then fail with <em>invalid opcode: MCOPY</em>.
              </li>
              <li>
                <code>eth_getLogs</code> accepts at most 1,000 blocks per call. Use <code>getLogsChunked</code> from the kit.
              </li>
              <li>No WebSocket RPC. Poll over HTTPS.</li>
              <li>Contract verification on the explorer isn&apos;t available yet. Link your repo and deployment in your submission instead.</li>
              <li>
                Judging counts activity <strong>on Aevum</strong>. Payments that settle only on another chain don&apos;t count.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
