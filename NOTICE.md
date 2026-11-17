# Third-party notices

Aevum Starter Kit is MIT licensed (see [LICENSE](LICENSE)). It builds on the open-source projects below.
None of their code is copied into this repository: the Solidity libraries are git submodules that keep
their own LICENSE files, and the JavaScript packages are installed from npm.

## Solidity libraries (`contracts/lib`, git submodules)

| Project | Version | License | Source |
|---|---|---|---|
| forge-std | v1.9.6 | MIT or Apache-2.0 | https://github.com/foundry-rs/forge-std |
| OpenZeppelin Contracts | v5.1.0 | MIT | https://github.com/OpenZeppelin/openzeppelin-contracts |

## JavaScript packages (direct dependencies)

| Package | Version | License | Used in |
|---|---|---|---|
| next | 16.4.3 | MIT | web |
| react, react-dom | 19.2.0 | MIT | web |
| @rainbow-me/rainbowkit | 2.2.11 | MIT | web |
| wagmi | 2.19.5 | MIT | web |
| @tanstack/react-query | 5.90.2 | MIT | web |
| viem | 2.57.12 | MIT | web, examples, packages/aevum |
| tsx | 4.23.15 | MIT | examples (dev) |
| typescript | 5.9.3 | Apache-2.0 | all (dev) |

Their own dependencies carry their own licenses. To list them all, run `pnpm licenses list` in the repo root.

## Agentic Payment Guard additions

This fork adds `PaymentGuard.sol`, the ERC-8004 reference registries, the `agent/` CLI, new web routes and bilingual documentation. All new source is MIT licensed. The ERC-8004 interface follows EIP-8004 (https://eips.ethereum.org/EIPS/eip-8004, CC-BY-4.0). Additions use the same OpenZeppelin 5.1.0 contracts and viem/Next.js stack listed above; `dotenv` (MIT) and `tsx` (MIT) are used by `agent/`.

The app is derived from the official [Aevum Starter Kit](https://github.com/qday-io/aevum-starter-kit), © 2026 PQA Labs, MIT.

