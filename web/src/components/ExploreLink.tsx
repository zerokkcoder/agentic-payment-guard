"use client";

import { links } from "@aevum-kit/aevum";

export function short(value: string, head = 6, tail = 4): string {
  return value.length > head + tail + 3 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

export function ExploreLink({ kind, value, label }: { kind: "tx" | "address"; value: string; label?: string }) {
  return (
    <a href={`${links.explorer}/${kind}/${value}`} target="_blank" rel="noreferrer" className="text-link">
      {label ?? short(value)} ↗
    </a>
  );
}
