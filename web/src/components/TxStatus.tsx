"use client";

import { useWaitForTransactionReceipt } from "wagmi";
import type { Hex } from "viem";
import { explainError } from "@/lib/decodeError";
import { ExploreLink } from "./ExploreLink";

export function TxStatus({ hash }: { hash?: Hex }) {
  const { data, isLoading, isError, error } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: Boolean(hash) },
  });

  if (!hash) return null;
  if (isLoading) return <p className="sub" role="status">签名已提交 / Submitted — waiting for confirmation…</p>;
  if (isError) return <p className="bad-text" role="alert">{explainError(error, "zh")}</p>;
  if (data?.status === "success") {
    return (
      <p className="good-text" role="status">
        已确认 / Confirmed · block {data.blockNumber.toString()} · <ExploreLink kind="tx" value={hash} />
      </p>
    );
  }
  return <p className="bad-text" role="alert">交易失败 / Transaction failed · <ExploreLink kind="tx" value={hash} /></p>;
}
