import { isAddress, type Address, type Chain } from "viem";
import { aevumFork, aevumTestnet, localAnvil } from "@aevum-kit/aevum";

export type NetworkKey = "aevum" | "fork" | "local";

export interface Network {
  key: NetworkKey;
  /** Short name for the network switcher. */
  label: string;
  chain: Chain;
  /** Your Checkout on this network, if you deployed one. */
  checkout?: Address;
  /** Agentic Payment Guard stack. */
  guard?: Address;
  identity?: Address;
  reputation?: Address;
  validation?: Address;
  /** Only scan events from this block onward on the Activity page. */
  deployBlock?: bigint;
  /** Explorer links only make sense on the real testnet. */
  hasExplorer: boolean;
}

const address = (v: string | undefined): Address | undefined => (v && isAddress(v.trim()) ? (v.trim() as Address) : undefined);
const block = (v: string | undefined): bigint | undefined => (v && /^\d+$/.test(v.trim()) ? BigInt(v.trim()) : undefined);

// Public demo defaults. Env vars still win, but the live Aevum UI must work
// even when a Vercel import missed one of the NEXT_PUBLIC_* variables.
const LIVE_AEVUM = {
  guard: "0xBB8984Cdd7eFa0502E1FEcDEDb2e07b3080436c3" as Address,
  identity: "0xAc1E8054945A73744014c4f257e49AD45E10d17F" as Address,
  reputation: "0xEE7029AAAaFdB8108e2fACC8F0cd2704266Ee2E7" as Address,
  validation: "0x1348E3B74C1E2b09fa44d86f7d1Aad78179Cf09f" as Address,
  deployBlock: 3383476n,
};

// NEXT_PUBLIC_* values must be written out in full so Next.js can inline them into the browser bundle.
const all: Record<NetworkKey, Network> = {
  aevum: {
    key: "aevum",
    label: "Aevum testnet",
    chain: aevumTestnet,
    checkout: address(process.env.NEXT_PUBLIC_CHECKOUT_AEVUM),
    guard: address(process.env.NEXT_PUBLIC_GUARD_AEVUM) ?? LIVE_AEVUM.guard,
    identity: address(process.env.NEXT_PUBLIC_IDENTITY_AEVUM) ?? LIVE_AEVUM.identity,
    reputation: address(process.env.NEXT_PUBLIC_REPUTATION_AEVUM) ?? LIVE_AEVUM.reputation,
    validation: address(process.env.NEXT_PUBLIC_VALIDATION_AEVUM) ?? LIVE_AEVUM.validation,
    deployBlock: block(process.env.NEXT_PUBLIC_DEPLOY_BLOCK_AEVUM) ?? LIVE_AEVUM.deployBlock,
    hasExplorer: true,
  },
  fork: {
    key: "fork",
    label: "Local fork",
    chain: aevumFork,
    checkout: address(process.env.NEXT_PUBLIC_CHECKOUT_FORK),
    guard: address(process.env.NEXT_PUBLIC_GUARD_FORK),
    identity: address(process.env.NEXT_PUBLIC_IDENTITY_FORK),
    reputation: address(process.env.NEXT_PUBLIC_REPUTATION_FORK),
    validation: address(process.env.NEXT_PUBLIC_VALIDATION_FORK),
    deployBlock: block(process.env.NEXT_PUBLIC_DEPLOY_BLOCK_FORK),
    hasExplorer: false,
  },
  local: {
    key: "local",
    label: "Local anvil",
    chain: localAnvil,
    checkout: address(process.env.NEXT_PUBLIC_CHECKOUT_LOCAL),
    guard: address(process.env.NEXT_PUBLIC_GUARD_LOCAL),
    identity: address(process.env.NEXT_PUBLIC_IDENTITY_LOCAL),
    reputation: address(process.env.NEXT_PUBLIC_REPUTATION_LOCAL),
    validation: address(process.env.NEXT_PUBLIC_VALIDATION_LOCAL),
    deployBlock: undefined,
    hasExplorer: false,
  },
};

const requested = (process.env.NEXT_PUBLIC_NETWORKS ?? "aevum")
  .split(",")
  .map((k) => k.trim())
  .filter((k): k is NetworkKey => k in all);

/** The networks the app offers, in the order of NEXT_PUBLIC_NETWORKS. The first one is the default. */
export const networks: [Network, ...Network[]] = (() => {
  const keys = [...new Set(requested)];
  const list = (keys.length ? keys : (["aevum"] as NetworkKey[])).map((k) => all[k]);
  return list as [Network, ...Network[]];
})();

export const defaultNetwork = networks[0];

export function networkByChainId(chainId: number | undefined): Network | undefined {
  return networks.find((n) => n.chain.id === chainId);
}

export function networkByKey(key: string | null | undefined): Network | undefined {
  return networks.find((n) => n.key === key);
}

export const walletConnectProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || undefined;

/** Where the "Source" links and the clone command on the Docs page point. Override it for a fork or a preview deploy. */
export const repoUrl = (process.env.NEXT_PUBLIC_REPO_URL?.trim() || "https://github.com/zerokkcoder/agentic-payment-guard").replace(/\.git$|\/+$/g, "");
