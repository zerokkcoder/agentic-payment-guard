import { config } from "dotenv";
import type { Address, Hex } from "viem";

config({ path: new URL("../.env", import.meta.url).pathname });
config();

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Copy agent/.env.example to agent/.env and fill it in.`);
  return value;
}

export function optionalEnv(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

export const env = {
  rpcUrl: optionalEnv("RPC_URL", "https://rpc-test.qday.info"),
  chainId: Number(optionalEnv("CHAIN_ID", "44005")),
  guard: requireEnv("GUARD_ADDRESS") as Address,
  identity: (process.env.IDENTITY_REGISTRY_ADDRESS || "0x0000000000000000000000000000000000000000") as Address,
  agentId: BigInt(optionalEnv("AGENT_ID", "1")),
  agentKey: requireEnv("AGENT_SESSION_PRIVATE_KEY") as Hex,
  ownerKey: (process.env.OWNER_PRIVATE_KEY || "") as Hex,
  quoteKey: (process.env.QUOTE_SIGNER_PRIVATE_KEY || "") as Hex,
  quoteApiUrl: process.env.QUOTE_API_URL || "",
  merchant: (process.env.MERCHANT_ADDRESS || "") as Address,
  explorer: optionalEnv("EXPLORER_URL", "https://explorer-test.qday.info"),
};
