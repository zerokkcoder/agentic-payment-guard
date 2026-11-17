// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PaymentGuard} from "../src/PaymentGuard.sol";
import {MockUSD8} from "../src/mocks/MockUSD8.sol";

contract PaymentGuardTest is Test {
    uint256 constant AGENT_PK = 0xA11CE;
    uint256 constant QUOTE_PK = 0xBEEF;
    uint256 constant WRONG_PK = 0xDEAD;

    MockUSD8 token;
    PaymentGuard guard;
    address agent;
    address merchant;
    address recipient2;
    address quoteSigner;

    function setUp() public {
        quoteSigner = vm.addr(QUOTE_PK);
        token = new MockUSD8();
        guard = new PaymentGuard(token, quoteSigner);
        agent = vm.addr(AGENT_PK);
        merchant = vm.addr(0x1234);
        recipient2 = vm.addr(0x9999);

        token.mint(address(this), 100e6);
        token.approve(address(guard), 100e6);
        guard.deposit(1, 10e6);
        address[] memory recipients = new address[](1);
        recipients[0] = merchant;
        guard.registerSessionKey(agent, 1, 2e6, 5e6, 1.5e6, uint64(block.timestamp + 2 hours), recipients);
    }

    function _quote(address to, uint256 amount, uint256 validBefore) internal view returns (bytes memory) {
        bytes32 id = guard.nextPaymentId(agent);
        bytes32 digest = guard.quoteDigest(to, amount, validBefore, id);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(QUOTE_PK, digest);
        return abi.encodePacked(r, s, v);
    }

    function _payDirect(address to, uint256 amount) internal returns (bytes32 id) {
        uint256 validBefore = block.timestamp + 1 hours;
        bytes memory sig = _quote(to, amount, validBefore);
        vm.prank(agent);
        id = guard.pay(to, amount, validBefore, sig);
    }

    function testAllowedPayment() public {
        bytes32 id = _payDirect(merchant, 1e6);
        assertEq(uint256(guard.status(id)), uint256(PaymentGuard.Status.Executed));
        assertEq(token.balanceOf(merchant), 1e6);
        assertEq(guard.vault(guard.agentKey(1)), 9e6);
    }

    function testPerTxCapBlocked() public {
        vm.expectEmit(true, true, true, true);
        emit PaymentGuard.PaymentBlocked(guard.nextPaymentId(agent), agent, merchant, 3e6, guard.BLOCK_PER_TX_CAP());
        bytes32 id = _payDirect(merchant, 3e6);
        assertEq(uint256(guard.status(id)), uint256(PaymentGuard.Status.Blocked));
        assertEq(token.balanceOf(merchant), 0);
    }

    function testRecipientNotAllowed() public {
        bytes32 id = _payDirect(recipient2, 1e6);
        assertEq(uint256(guard.status(id)), uint256(PaymentGuard.Status.Blocked));
        assertEq(token.balanceOf(recipient2), 0);
    }

    function testApprovalFlow() public {
        bytes32 id = _payDirect(merchant, 1.8e6);
        assertEq(uint256(guard.status(id)), uint256(PaymentGuard.Status.Pending));
        assertEq(token.balanceOf(merchant), 0);

        guard.approve(id);
        assertEq(uint256(guard.status(id)), uint256(PaymentGuard.Status.Executed));
        assertEq(token.balanceOf(merchant), 1.8e6);
    }

    function testRejectFlow() public {
        bytes32 id = _payDirect(merchant, 1.8e6);
        guard.reject(id);
        assertEq(uint256(guard.status(id)), uint256(PaymentGuard.Status.Rejected));
        assertEq(token.balanceOf(merchant), 0);
    }

    function testRevokedKeyBlocked() public {
        guard.revokeSessionKey(agent);
        bytes32 id = _payDirect(merchant, 1e6);
        assertEq(uint256(guard.status(id)), uint256(PaymentGuard.Status.Blocked));
        assertEq(token.balanceOf(merchant), 0);
    }

    function testExpiredKeyBlocked() public {
        vm.warp(block.timestamp + 3 hours);
        bytes32 id = _payDirect(merchant, 1e6);
        assertEq(uint256(guard.status(id)), uint256(PaymentGuard.Status.Blocked));
    }

    function testDailyCapBlocked() public {
        guard.updatePolicy(agent, 2e6, 5e6, 3e6, uint64(block.timestamp + 10 days));
        _payDirect(merchant, 2e6);
        _payDirect(merchant, 2e6);
        _payDirect(merchant, 1e6);
        bytes32 id = _payDirect(merchant, 1e6);
        assertEq(uint256(guard.status(id)), uint256(PaymentGuard.Status.Blocked));
        assertEq(token.balanceOf(merchant), 5e6);
    }

    function testDailyReset() public {
        _payDirect(merchant, 2e6);
        vm.warp(block.timestamp + 1 days + 1);
        guard.updatePolicy(agent, 2e6, 5e6, 3e6, uint64(block.timestamp + 10 days));
        assertEq(guard.dailyRemaining(agent), 5e6);
        bytes32 id = _payDirect(merchant, 2e6);
        assertEq(uint256(guard.status(id)), uint256(PaymentGuard.Status.Executed));
    }

    function testWrongQuoteSignerBlocked() public {
        uint256 validBefore = block.timestamp + 1 hours;
        bytes32 id = guard.nextPaymentId(agent);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(WRONG_PK, guard.quoteDigest(merchant, 1e6, validBefore, id));
        vm.prank(agent);
        bytes32 paymentId = guard.pay(merchant, 1e6, validBefore, abi.encodePacked(r, s, v));
        assertEq(uint256(guard.status(paymentId)), uint256(PaymentGuard.Status.Blocked));
    }

    function testNonceAdvancesAndPaymentIdCannotBeReused() public {
        bytes32 first = _payDirect(merchant, 1e6);
        assertEq(guard.nonces(agent), 1);
        assertNotEq(first, bytes32(0));
        bytes32 second = _payDirect(merchant, 1e6);
        assertNotEq(first, second);
        assertEq(guard.nonces(agent), 2);
    }

    function testWithdrawOnlyVaultOwner() public {
        vm.prank(merchant);
        vm.expectRevert(PaymentGuard.NotOwner.selector);
        guard.withdraw(1, 1e6);
        guard.withdraw(1, 1e6);
        assertEq(token.balanceOf(address(this)), 91e6);
    }

    function testRegisterBeforeDepositIsRejected() public {
        address[] memory empty = new address[](1);
        empty[0] = merchant;
        vm.prank(merchant);
        vm.expectRevert(PaymentGuard.NotOwner.selector);
        guard.registerSessionKey(vm.addr(0x777), 999, 1e6, 2e6, 1e6, uint64(block.timestamp + 1 hours), empty);
    }

    function testGaslessPayment() public {
        uint256 validBefore = block.timestamp + 1 hours;
        bytes32 id = guard.nextPaymentId(agent);
        PaymentGuard.Payment memory p = PaymentGuard.Payment({
            sessionKey: agent,
            recipient: merchant,
            amount: 1e6,
            validAfter: block.timestamp - 1,
            validBefore: validBefore,
            paymentId: id
        });
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(AGENT_PK, guard.intentDigest(p));
        bytes memory sessionSig = abi.encodePacked(r, s, v);
        (v, r, s) = vm.sign(QUOTE_PK, guard.quoteDigest(merchant, 1e6, validBefore, id));
        bytes memory quoteSig = abi.encodePacked(r, s, v);

        vm.prank(merchant); // relayer
        bytes32 paymentId = guard.payWithSignature(p, sessionSig, quoteSig);
        assertEq(uint256(guard.status(paymentId)), uint256(PaymentGuard.Status.Executed));
        assertEq(token.balanceOf(merchant), 1e6);
    }

    function testGaslessBadSessionSignatureReverts() public {
        uint256 validBefore = block.timestamp + 1 hours;
        bytes32 id = guard.nextPaymentId(agent);
        PaymentGuard.Payment memory p = PaymentGuard.Payment(agent, merchant, 1e6, 0, validBefore, id);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(WRONG_PK, guard.intentDigest(p));
        (v, r, s) = vm.sign(QUOTE_PK, guard.quoteDigest(merchant, 1e6, validBefore, id));
        vm.expectRevert(PaymentGuard.InvalidSignature.selector);
        guard.payWithSignature(p, abi.encodePacked(r, s, v), abi.encodePacked(r, s, v));
    }
}
