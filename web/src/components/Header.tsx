"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { networks, repoUrl } from "@/lib/env";
import { GitHubIcon } from "./Icons";
import { useNetwork } from "@/lib/network";

const links = [
  { href: "/", label: "Overview" },
  { href: "/policies", label: "Policies" },
  { href: "/approvals", label: "Approvals" },
  { href: "/agent", label: "Agent" },
  { href: "/activity", label: "Activity" },
  { href: "/docs", label: "Docs" },
];

export function Header() {
  const pathname = usePathname();
  const { isConnected, chainId } = useAccount();
  const { net, select, switchingTo, switchError } = useNetwork();
  const wrongNetwork = isConnected && chainId !== net.chain.id && !switchingTo;

  return (
    <>
      <header className="topbar">
        <div className="shell">
          <Link href="/" className="brand">
            <span className="brand-mark" aria-hidden="true" />
            <span className="brand-name">Agentic Payment Guard</span>
          </Link>
          <nav className="nav" aria-label="Main">
            {links.map((l) => {
              const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}>
                  {l.label}
                </Link>
              );
            })}
          </nav>
          <div className="topbar-end">
            <a className="gh-link" href={repoUrl} target="_blank" rel="noreferrer" title="Source code on GitHub">
              <GitHubIcon />
              <span>GitHub</span>
            </a>
            {networks.length > 1 && (
              <div className="net-switch" role="radiogroup" aria-label="Network">
                {networks.map((n) => (
                  <button
                    key={n.key}
                    type="button"
                    role="radio"
                    aria-checked={n.key === net.key}
                    disabled={Boolean(switchingTo)}
                    title={`${n.chain.name} · chain ${n.chain.id}`}
                    onClick={() => select(n.key)}
                  >
                    <span className={`net-dot ${n.key}`} aria-hidden="true" />
                    {n.label}
                  </button>
                ))}
              </div>
            )}
            <ConnectButton chainStatus="icon" showBalance={false} accountStatus="address" />
          </div>
        </div>
      </header>
      {switchingTo && (
        <div className="banner info" role="status">
          <div className="shell">
            <span>
              Confirm the switch to <strong>{switchingTo.chain.name}</strong> in your wallet. If no window opened, click the wallet icon in your
              browser toolbar.
            </span>
          </div>
        </div>
      )}
      {switchError && !switchingTo && (
        <div className="banner" role="alert">
          <div className="shell">
            <span>{switchError}</span>
          </div>
        </div>
      )}
      {wrongNetwork && (
        <div className="banner" role="alert">
          <div className="shell">
            <span>
              Your wallet is on another network. This app is set to <strong>{net.chain.name} ({net.chain.id})</strong>.
            </span>
            <button type="button" className="btn warn small" onClick={() => select(net.key)}>
              Switch network
            </button>
          </div>
        </div>
      )}
    </>
  );
}
