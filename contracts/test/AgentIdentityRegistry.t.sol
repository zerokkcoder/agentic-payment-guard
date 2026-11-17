// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {AgentIdentityRegistry} from "../src/AgentIdentityRegistry.sol";
import {ReputationRegistry} from "../src/ReputationRegistry.sol";
import {ValidationRegistry} from "../src/ValidationRegistry.sol";

contract AgentIdentityTest is Test {
    uint256 constant AGENT_PK = 0xA11CE;
    AgentIdentityRegistry identity;
    ReputationRegistry reputation;
    ValidationRegistry validation;
    address agentWallet;
    address client;

    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function setUp() public {
        identity = new AgentIdentityRegistry();
        reputation = new ReputationRegistry();
        validation = new ValidationRegistry();
        reputation.initialize(address(identity));
        validation.initialize(address(identity));
        agentWallet = vm.addr(AGENT_PK);
        client = vm.addr(0x4242);
    }

    function testRegisterAndURI() public {
        AgentIdentityRegistry.MetadataEntry[] memory meta = new AgentIdentityRegistry.MetadataEntry[](1);
        meta[0] = AgentIdentityRegistry.MetadataEntry("service", bytes("web"));
        uint256 id = identity.register("ipfs://bafyTest", meta);
        assertEq(id, 1);
        assertEq(identity.ownerOf(1), address(this));
        assertEq(identity.tokenURI(1), "ipfs://bafyTest");
        assertEq(identity.getMetadata(1, "service"), bytes("web"));

        identity.setAgentURI(1, "https://example.com/agent.json");
        assertEq(identity.tokenURI(1), "https://example.com/agent.json");
    }

    function testSetAgentWalletRequiresSignature() public {
        identity.register();
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(AGENT_PK, identity.walletDigest(agentWallet, deadline));

        (bool ok,) = address(identity).call(abi.encodeWithSignature(
            "setAgentWallet(uint256,address,uint256,bytes)", 1, agentWallet, deadline, ""
        ));
        assertFalse(ok, "empty signature must fail");

        identity.setAgentWallet(1, agentWallet, deadline, abi.encodePacked(r, s, v));
        assertEq(identity.getAgentWallet(1), agentWallet);
    }

    function testWalletClearedOnTransfer() public {
        identity.register();
        uint256 deadline = block.timestamp + 1 hours;
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(AGENT_PK, identity.walletDigest(agentWallet, deadline));
        identity.setAgentWallet(1, agentWallet, deadline, abi.encodePacked(r, s, v));
        identity.transferFrom(address(this), client, 1);
        assertEq(identity.getAgentWallet(1), client);
    }

    function testReputationSummaryAndRevoke() public {
        identity.register();
        vm.prank(client);
        reputation.giveFeedback(1, 8, 0, "reliability", "", "https://client.example", "ipfs://feedback", bytes32(0));

        address[] memory clients = new address[](1);
        clients[0] = client;
        (uint64 count, int128 value,) = reputation.getSummary(1, clients, "", "");
        assertEq(count, 1);
        assertEq(value, 8);

        vm.prank(client);
        reputation.revokeFeedback(1, 0);
        (count,,) = reputation.getSummary(1, clients, "", "");
        assertEq(count, 0);
    }

    function testSelfFeedbackRejected() public {
        identity.register();
        vm.expectRevert(ReputationRegistry.SelfFeedbackNotAllowed.selector);
        reputation.giveFeedback(1, 10, 0, "", "", "", "", bytes32(0));
    }

    function testValidationFlow() public {
        identity.register();
        bytes32 requestHash = keccak256("request-1");
        validation.validationRequest(agentWallet, 1, "ipfs://request", requestHash);
        vm.prank(agentWallet);
        validation.validationResponse(requestHash, 92, "ipfs://response", bytes32(0), "security");

        address[] memory validators = new address[](1);
        validators[0] = agentWallet;
        (uint64 count, uint8 average) = validation.getSummary(1, validators, "security");
        assertEq(count, 1);
        assertEq(average, 92);
    }
}
