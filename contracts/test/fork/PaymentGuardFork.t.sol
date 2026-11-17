// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {PaymentGuard} from "../../src/PaymentGuard.sol";

/// @notice Runs against a local fork of Aevum with the REAL tUSD8 contract.
///   anvil --fork-url https://rpc-test.qday.info --hardfork shanghai --chain-id 440050 --port 8555
///   forge test --match-path 'test/fork/*' --fork-url https://rpc-test.qday.info -vv
contract PaymentGuardForkTest is Test {
    uint256 constant AGENT_PK = 0xA11CE;
    uint256 constant QUOTE_PK = 0xBEEF;
    address constant TUSD8 = 0x456569838f1d43009A91ebA4263147Afd7233483;
    address constant TUSD8_MM = 0x4d4b7031D35B74215bebe33F6AF6e682Ea99d0b1;

    function setUp() public {
        require(block.chainid == 44005 || TUSD8.code.length > 0, "run against an Aevum fork");
        // The master minter is not prefunded on the fork: give it a minting
        // allowance and mint test tokens, exactly like `make deal` does.
        vm.startPrank(TUSD8_MM);
        (bool configured, ) = TUSD8.call(
            abi.encodeWithSignature("configureMinter(address,uint256)", TUSD8_MM, 100e6)
        );
        require(configured, "configureMinter failed");
        (bool minted, ) = TUSD8.call(
            abi.encodeWithSignature("mint(address,uint256)", address(this), 10e6)
        );
        require(minted, "mint failed");
        vm.stopPrank();
    }

    function testRealTusd8Payment() public {
        address quoteSigner = vm.addr(QUOTE_PK);
        PaymentGuard guard = new PaymentGuard(IERC20(TUSD8), quoteSigner);
        address agent = vm.addr(AGENT_PK);
        address merchant = vm.addr(0x1234);

        IERC20(TUSD8).approve(address(guard), 10e6);
        guard.deposit(7, 10e6);
        address[] memory recipients = new address[](1);
        recipients[0] = merchant;
        guard.registerSessionKey(agent, 7, 2e6, 5e6, 1e6, uint64(block.timestamp + 2 hours), recipients);

        uint256 validBefore = block.timestamp + 1 hours;
        bytes32 id = guard.nextPaymentId(agent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(QUOTE_PK, guard.quoteDigest(merchant, 1e6, validBefore, id));
        vm.prank(agent);
        guard.pay(merchant, 1e6, validBefore, abi.encodePacked(r, s, v));

        assertEq(uint256(guard.status(id)), uint256(PaymentGuard.Status.Executed));
        assertEq(IERC20(TUSD8).balanceOf(merchant), 1e6);
    }
}
