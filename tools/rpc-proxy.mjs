// Local plain-HTTP JSON-RPC bridge for environments where Foundry cannot reach
// an HTTPS RPC directly (for example behind a TLS-intercepting corporate proxy).
// Node's fetch honours NODE_EXTRA_CA_CERTS / proxy settings on this project's
// toolchain, while Foundry's Rust HTTP client does not.
//
//   node tools/rpc-proxy.mjs
//   cast chain-id --rpc-url http://127.0.0.1:8546
//   make test-fork AEVUM_RPC=http://127.0.0.1:8546
//
// Env: UPSTREAM_RPC (default https://rpc-test.qday.info), PORT (default 8546).
// The bridge only forwards JSON-RPC payloads. It never sees or stores keys.

import http from "node:http";

const upstream = process.env.UPSTREAM_RPC || "https://rpc-test.qday.info";
const port = Number(process.env.PORT || 8546);

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST") {
    res.writeHead(405, { "content-type": "application/json" });
    res.end(JSON.stringify({ jsonrpc: "2.0", error: { code: -32600, message: "POST required" }, id: null }));
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks);

  try {
    const response = await fetch(upstream, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    const text = await response.text();
    res.writeHead(response.status, { "content-type": "application/json" });
    res.end(text);
  } catch (error) {
    res.writeHead(502, { "content-type": "application/json" });
    res.end(JSON.stringify({
      jsonrpc: "2.0",
      error: { code: -32000, message: `upstream RPC unreachable: ${error.message}` },
      id: null,
    }));
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`RPC bridge: http://127.0.0.1:${port} -> ${upstream}`);
});
