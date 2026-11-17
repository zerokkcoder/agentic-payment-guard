// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PaymentGuard} from "../src/PaymentGuard.sol";
import {AgentIdentityRegistry} from "../src/AgentIdentityRegistry.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {ValidationRegistry} from "../src/ValidationRegistry.sol";
import {MockUSD8} from "../src/mocks/MockUSD8.sol";

/// @notice Deploy the whole Agentic Payment Guard stack.
///   - Aevum / fork: real tUSD8.
///   - local anvil (31337): MockUSD8 with 1,000 minted to the deployer.
///   QUOTE_SIGNER defaults to the deployer. Set it to the address whose private key is in
///   web/.env.local as QUOTE_SIGNER_PRIVATE_KEY (that server signs the EIP-712 quotes).
///
///   make deploy-all-local
///   make deploy-all-fork
///   make deploy-all-aevum ACCOUNT=<keystore>
contract DeployAll is Script {
    address constant AEVUM_TUSD8 = 0x456569838f1d43009A91ebA4263147Afd7233483;
    uint256 constant ANVIL_CHAIN = 31337;
    uint256 constant FORK_CHAIN = 440050;

    function run() external returns (PaymentGuard guard, AgentIdentityRegistry identity, ReputationRegistry reputation, ValidationRegistry validation, address token) {
        vm.startBroadcast();
        (, address deployer,) = vm.readCallers();
        address quoteSigner = vm.envOr("QUOTE_SIGNER", deployer);

        if (AEVUM_TUSD8.code.length > 0) {
            token = AEVUM_TUSD8;
        } else {
            require(block.chainid == ANVIL_CHAIN, "tUSD8 not found. Use Aevum, a fork, or local anvil.");
            MockUSD8 mock = new MockUSD8();
            mock.mint(deployer, 1_000e6);
            token = address(mock);
        }

        identity = new AgentIdentityRegistry();
        reputation = new ReputationRegistry();
        validation = new ValidationRegistry();
        reputation.initialize(address(identity));
        validation.initialize(address(identity));
        guard = new PaymentGuard(IERC20(token), quoteSigner);
        vm.stopBroadcast();

        console.log("chainId              ", block.chainid);
        console.log("token                ", token);
        console.log("quoteSigner          ", quoteSigner);
        console.log("PaymentGuard         ", address(guard));
        console.log("IdentityRegistry     ", address(identity));
        console.log("ReputationRegistry   ", address(reputation));
        console.log("ValidationRegistry   ", address(validation));
    }
}
