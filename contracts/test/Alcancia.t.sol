// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Alcancia} from "../src/Alcancia.sol";
import {AlcanciaFactory} from "../src/AlcanciaFactory.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract AlcanciaTest is Test {
    MockERC20 usd;
    MockERC20 eur;
    Alcancia impl;
    AlcanciaFactory factory;

    address admin = address(this);
    address agent = makeAddr("agent");
    address user = makeAddr("user");
    address other = makeAddr("other");

    uint256 constant E18 = 1e18;

    function setUp() public {
        vm.roll(100);
        vm.warp(1_700_000_000);
        usd = new MockERC20("USD", "USD");
        eur = new MockERC20("EUR", "EUR");
        impl = new Alcancia();
        factory = new AlcanciaFactory(address(impl), agent);

        usd.mint(user, 1_000_000 * E18);
        eur.mint(user, 1_000_000 * E18);
        vm.prank(user);
        usd.approve(address(factory), type(uint256).max);
        vm.prank(user);
        factory.setIncomeToken(address(usd));
    }

    // ------------------------------------------------------------ helpers

    function _goal(address token, uint256 target, uint64 deadline, uint16 bps)
        internal
        pure
        returns (AlcanciaFactory.GoalInput memory)
    {
        return AlcanciaFactory.GoalInput({token: token, name: "goal", target: target, deadline: deadline, bps: bps});
    }

    function _createOne(uint256 target, uint64 deadline) internal returns (Alcancia a) {
        AlcanciaFactory.GoalInput[] memory g = new AlcanciaFactory.GoalInput[](1);
        g[0] = _goal(address(usd), target, deadline, 1000);
        vm.prank(user);
        a = Alcancia(factory.createBatch(g)[0]);
    }

    function _fund(Alcancia a, uint256 amount) internal {
        vm.startPrank(user);
        usd.approve(address(a), amount);
        a.deposit(amount);
        vm.stopPrank();
    }

    function _deadline() internal view returns (uint64) {
        return uint64(block.timestamp + 365 days);
    }

    // ------------------------------------------------------------ factory: create + bps

    function test_createBatch_storesGoals() public {
        AlcanciaFactory.GoalInput[] memory g = new AlcanciaFactory.GoalInput[](2);
        g[0] = _goal(address(usd), 100 * E18, _deadline(), 2000);
        g[1] = _goal(address(eur), 200 * E18, _deadline(), 3000);
        vm.prank(user);
        address[] memory created = factory.createBatch(g);

        (address[] memory addrs, uint16[] memory bps) = factory.alcanciasOf(user);
        assertEq(addrs.length, 2);
        assertEq(addrs[0], created[0]);
        assertEq(bps[0], 2000);
        assertEq(bps[1], 3000);
        assertEq(factory.totalBps(user), 5000);
        assertTrue(factory.isAlcancia(user, created[1]));

        Alcancia a = Alcancia(created[1]);
        assertEq(a.owner(), user);
        assertEq(a.agent(), agent);
        assertEq(a.factory(), address(factory));
        assertEq(address(a.token()), address(eur));
        assertEq(a.target(), 200 * E18);
        assertEq(a.name(), "goal");
    }

    function test_createBatch_bpsCap() public {
        AlcanciaFactory.GoalInput[] memory g = new AlcanciaFactory.GoalInput[](2);
        g[0] = _goal(address(usd), 100 * E18, _deadline(), 6000);
        g[1] = _goal(address(usd), 100 * E18, _deadline(), 4001);
        vm.prank(user);
        vm.expectRevert(AlcanciaFactory.BpsTooHigh.selector);
        factory.createBatch(g);

        // Cap applies across multiple batches too.
        g[1].bps = 4000;
        vm.prank(user);
        factory.createBatch(g);
        assertEq(factory.totalBps(user), 10000);

        AlcanciaFactory.GoalInput[] memory g2 = new AlcanciaFactory.GoalInput[](1);
        g2[0] = _goal(address(usd), 100 * E18, _deadline(), 1);
        vm.prank(user);
        vm.expectRevert(AlcanciaFactory.BpsTooHigh.selector);
        factory.createBatch(g2);

        // A 0-bps goal is still allowed.
        g2[0].bps = 0;
        vm.prank(user);
        factory.createBatch(g2);
    }

    function test_setBps() public {
        Alcancia a = _createOne(100 * E18, _deadline());
        vm.prank(user);
        factory.setBps(address(a), 9000);
        assertEq(factory.bpsOf(address(a)), 9000);
        assertEq(factory.totalBps(user), 9000);

        vm.prank(user);
        vm.expectRevert(AlcanciaFactory.BpsTooHigh.selector);
        factory.setBps(address(a), 10001);

        vm.prank(other);
        vm.expectRevert(AlcanciaFactory.NotOwnerOfAlcancia.selector);
        factory.setBps(address(a), 1);
    }

    function test_implementationCannotBeInitialized() public {
        vm.expectRevert(Alcancia.AlreadyInitialized.selector);
        impl.initialize(user, agent, address(usd), "x", 1, _deadline());
    }

    function test_cloneCannotBeReinitialized() public {
        Alcancia a = _createOne(100 * E18, _deadline());
        vm.expectRevert(Alcancia.AlreadyInitialized.selector);
        a.initialize(other, other, address(usd), "x", 1, _deadline());
    }

    // ------------------------------------------------------------ sweep

    function test_sweep_distribution_withFx() public {
        AlcanciaFactory.GoalInput[] memory g = new AlcanciaFactory.GoalInput[](3);
        g[0] = _goal(address(usd), 100 * E18, _deadline(), 1000); // 10%
        g[1] = _goal(address(eur), 100 * E18, _deadline(), 2500); // 25% foreign
        g[2] = _goal(address(usd), 100 * E18, _deadline(), 0); // 0%
        vm.prank(user);
        address[] memory c = factory.createBatch(g);

        uint256 before = usd.balanceOf(user);
        vm.prank(agent);
        uint256 total = factory.sweep(user, address(usd), 1000 * E18, 99);

        assertEq(total, 350 * E18);
        assertEq(usd.balanceOf(c[0]), 100 * E18);
        assertEq(usd.balanceOf(c[1]), 0);
        assertEq(usd.balanceOf(agent), 250 * E18); // FX share to agent
        assertEq(usd.balanceOf(c[2]), 0);
        assertEq(usd.balanceOf(user), before - 350 * E18);
        assertEq(factory.lastSweptBlock(user), 99);

        // Agent swaps off-chain and deposits EUR into the foreign goal.
        eur.mint(agent, 230 * E18);
        vm.startPrank(agent);
        eur.approve(c[1], 230 * E18);
        Alcancia(c[1]).deposit(230 * E18);
        vm.stopPrank();
        assertEq(Alcancia(c[1]).balance(), 230 * E18);
    }

    function test_sweep_replayProtection() public {
        _createOne(100 * E18, _deadline());
        vm.startPrank(agent);
        factory.sweep(user, address(usd), 100 * E18, 50);
        vm.expectRevert(AlcanciaFactory.StaleBlock.selector);
        factory.sweep(user, address(usd), 100 * E18, 50);
        vm.expectRevert(AlcanciaFactory.StaleBlock.selector);
        factory.sweep(user, address(usd), 100 * E18, 49);
        vm.expectRevert(AlcanciaFactory.FutureBlock.selector);
        factory.sweep(user, address(usd), 100 * E18, uint64(block.number + 1));
        factory.sweep(user, address(usd), 100 * E18, 51);
        vm.stopPrank();
    }

    function test_sweep_paused() public {
        _createOne(100 * E18, _deadline());
        vm.prank(user);
        factory.setPaused(true);
        vm.prank(agent);
        vm.expectRevert(AlcanciaFactory.UserPaused.selector);
        factory.sweep(user, address(usd), 100 * E18, 50);

        vm.prank(user);
        factory.setPaused(false);
        vm.prank(agent);
        factory.sweep(user, address(usd), 100 * E18, 50);
    }

    function test_sweep_onlyAgent() public {
        _createOne(100 * E18, _deadline());
        vm.prank(other);
        vm.expectRevert(AlcanciaFactory.NotAgent.selector);
        factory.sweep(user, address(usd), 100 * E18, 50);
        vm.prank(user);
        vm.expectRevert(AlcanciaFactory.NotAgent.selector);
        factory.sweep(user, address(usd), 100 * E18, 50);
    }

    function test_factory_setAgent_onlyAdmin() public {
        vm.prank(other);
        vm.expectRevert(AlcanciaFactory.NotAdmin.selector);
        factory.setAgent(other);

        factory.setAgent(other); // admin = this
        assertEq(factory.agent(), other);
        vm.prank(agent);
        vm.expectRevert(AlcanciaFactory.NotAgent.selector);
        factory.sweep(user, address(usd), 1, 50);
    }

    function testFuzz_sweepNeverExceedsIncome(uint256 income, uint16 b1, uint16 b2, uint16 b3, bool fx) public {
        income = bound(income, 0, 1_000_000 * E18);
        b1 = uint16(bound(b1, 0, 10000));
        b2 = uint16(bound(b2, 0, 10000 - b1));
        b3 = uint16(bound(b3, 0, 10000 - b1 - b2));

        AlcanciaFactory.GoalInput[] memory g = new AlcanciaFactory.GoalInput[](3);
        g[0] = _goal(address(usd), 1, _deadline(), b1);
        g[1] = _goal(fx ? address(eur) : address(usd), 1, _deadline(), b2);
        g[2] = _goal(address(usd), 1, _deadline(), b3);
        vm.prank(user);
        factory.createBatch(g);

        uint256 before = usd.balanceOf(user);
        vm.prank(agent);
        uint256 total = factory.sweep(user, address(usd), income, 50);
        assertLe(total, income);
        assertEq(before - usd.balanceOf(user), total);
    }

    // ------------------------------------------------------------ withdraw

    function test_withdraw_lockedThenTarget() public {
        Alcancia a = _createOne(100 * E18, _deadline());
        _fund(a, 50 * E18);
        assertFalse(a.unlocked());
        vm.prank(user);
        vm.expectRevert(Alcancia.Locked.selector);
        a.withdraw(1);

        _fund(a, 50 * E18);
        assertTrue(a.unlocked());
        vm.prank(user);
        a.withdraw(100 * E18);
        assertEq(a.balance(), 0);
        assertEq(usd.balanceOf(user), 1_000_000 * E18);
    }

    function test_withdraw_afterDeadline() public {
        Alcancia a = _createOne(100 * E18, _deadline());
        _fund(a, 10 * E18);
        vm.warp(a.deadline());
        assertTrue(a.unlocked());
        vm.prank(user);
        a.withdraw(10 * E18);
        assertEq(a.balance(), 0);
    }

    function test_withdraw_onlyOwner() public {
        Alcancia a = _createOne(100 * E18, _deadline());
        _fund(a, 100 * E18);
        vm.prank(other);
        vm.expectRevert(Alcancia.NotOwner.selector);
        a.withdraw(1);
    }

    // ------------------------------------------------------------ early withdraw

    function test_earlyWithdraw_delayPath() public {
        Alcancia a = _createOne(100 * E18, _deadline());
        _fund(a, 40 * E18);
        vm.prank(user);
        a.requestEarlyWithdraw(30 * E18);

        vm.warp(block.timestamp + a.DELAY() - 1);
        vm.prank(user);
        vm.expectRevert(Alcancia.DelayNotElapsed.selector);
        a.executeEarlyWithdraw();

        vm.warp(block.timestamp + 1);
        vm.prank(user);
        a.executeEarlyWithdraw();
        assertEq(a.balance(), 10 * E18);
        (uint256 amt,,) = a.pendingWithdraw();
        assertEq(amt, 0);

        vm.prank(user);
        vm.expectRevert(Alcancia.NoPendingRequest.selector);
        a.executeEarlyWithdraw();
    }

    function test_earlyWithdraw_capsAtBalance() public {
        Alcancia a = _createOne(100 * E18, _deadline());
        _fund(a, 5 * E18);
        vm.prank(user);
        a.requestEarlyWithdraw(50 * E18);
        vm.warp(block.timestamp + a.DELAY());
        vm.prank(user);
        a.executeEarlyWithdraw();
        assertEq(a.balance(), 0);
    }

    function test_earlyWithdraw_agentApprovePath() public {
        Alcancia a = _createOne(100 * E18, _deadline());
        _fund(a, 40 * E18);

        vm.prank(agent);
        vm.expectRevert(Alcancia.NoPendingRequest.selector);
        a.agentApprove();

        vm.prank(user);
        a.requestEarlyWithdraw(30 * E18);

        vm.prank(other);
        vm.expectRevert(Alcancia.NotAgent.selector);
        a.agentApprove();

        vm.prank(agent);
        a.agentApprove();
        vm.prank(user);
        a.executeEarlyWithdraw();
        assertEq(a.balance(), 10 * E18);
        assertEq(usd.balanceOf(agent), 0);
    }

    function test_earlyWithdraw_newRequestResetsApproval() public {
        Alcancia a = _createOne(100 * E18, _deadline());
        _fund(a, 40 * E18);
        vm.prank(user);
        a.requestEarlyWithdraw(1 * E18);
        vm.prank(agent);
        a.agentApprove();
        vm.prank(user);
        a.requestEarlyWithdraw(40 * E18);
        vm.prank(user);
        vm.expectRevert(Alcancia.DelayNotElapsed.selector);
        a.executeEarlyWithdraw();
    }

    function test_earlyWithdraw_cancel() public {
        Alcancia a = _createOne(100 * E18, _deadline());
        _fund(a, 40 * E18);
        vm.prank(user);
        a.requestEarlyWithdraw(30 * E18);
        vm.prank(user);
        a.cancelEarlyWithdraw();
        vm.warp(block.timestamp + a.DELAY());
        vm.prank(user);
        vm.expectRevert(Alcancia.NoPendingRequest.selector);
        a.executeEarlyWithdraw();
        assertEq(a.balance(), 40 * E18);
    }

    // ------------------------------------------------------------ agent cannot steal

    function test_agentCannotMoveFunds() public {
        Alcancia a = _createOne(100 * E18, _deadline());
        _fund(a, 100 * E18); // unlocked
        vm.prank(user);
        a.requestEarlyWithdraw(50 * E18);
        vm.prank(agent);
        a.agentApprove();
        vm.warp(block.timestamp + 400 days);

        vm.startPrank(agent);
        vm.expectRevert(Alcancia.NotOwner.selector);
        a.withdraw(1);
        vm.expectRevert(Alcancia.NotOwner.selector);
        a.executeEarlyWithdraw();
        vm.expectRevert(Alcancia.NotOwner.selector);
        a.requestEarlyWithdraw(1);
        vm.expectRevert(Alcancia.NotOwner.selector);
        a.cancelEarlyWithdraw();
        vm.expectRevert(Alcancia.NotOwner.selector);
        a.requestLowerTarget(1, 1);
        vm.expectRevert(Alcancia.NotOwner.selector);
        a.applyLowerTarget();
        vm.expectRevert(Alcancia.NotOwner.selector);
        a.raiseTarget(type(uint256).max);
        vm.expectRevert(Alcancia.NotOwner.selector);
        a.extendDeadline(type(uint64).max);
        vm.expectRevert(Alcancia.NotOwner.selector);
        a.setAgent(agent);
        vm.expectRevert(Alcancia.AlreadyInitialized.selector);
        a.initialize(agent, agent, address(usd), "x", 1, type(uint64).max);
        vm.stopPrank();

        // The factory admin cannot touch funds either.
        vm.expectRevert(Alcancia.NotOwner.selector);
        a.withdraw(1);

        assertEq(a.balance(), 100 * E18);
        assertEq(usd.balanceOf(agent), 0);
        assertEq(a.owner(), user);
    }

    // ------------------------------------------------------------ targets

    function test_raiseTarget() public {
        Alcancia a = _createOne(100 * E18, _deadline());
        _fund(a, 100 * E18);
        assertTrue(a.unlocked());
        vm.prank(user);
        a.raiseTarget(200 * E18);
        assertEq(a.target(), 200 * E18);
        assertFalse(a.unlocked());

        vm.prank(user);
        vm.expectRevert(Alcancia.InvalidTarget.selector);
        a.raiseTarget(199 * E18);
    }

    function test_extendDeadline() public {
        Alcancia a = _createOne(100 * E18, _deadline());
        uint64 d = a.deadline();
        vm.prank(user);
        vm.expectRevert(Alcancia.InvalidDeadline.selector);
        a.extendDeadline(d);
        vm.prank(user);
        a.extendDeadline(d + 1);
        assertEq(a.deadline(), d + 1);
    }

    function test_lowerTarget_requiresDelay() public {
        Alcancia a = _createOne(100 * E18, _deadline());
        _fund(a, 50 * E18);
        uint64 d = a.deadline();
        vm.prank(user);
        a.requestLowerTarget(50 * E18, d);

        // agentApprove does not affect target changes (no pending withdraw -> reverts)
        vm.prank(agent);
        vm.expectRevert(Alcancia.NoPendingRequest.selector);
        a.agentApprove();

        vm.prank(user);
        vm.expectRevert(Alcancia.DelayNotElapsed.selector);
        a.applyLowerTarget();
        assertEq(a.target(), 100 * E18);

        vm.warp(block.timestamp + a.DELAY());
        vm.prank(user);
        a.applyLowerTarget();
        assertEq(a.target(), 50 * E18);
        assertTrue(a.unlocked());

        vm.prank(user);
        vm.expectRevert(Alcancia.NoPendingRequest.selector);
        a.applyLowerTarget();
    }

    function test_lowerTarget_cancel() public {
        Alcancia a = _createOne(100 * E18, _deadline());
        vm.prank(user);
        a.requestLowerTarget(1, 0);
        vm.prank(user);
        a.cancelLowerTarget();
        vm.warp(block.timestamp + a.DELAY());
        vm.prank(user);
        vm.expectRevert(Alcancia.NoPendingRequest.selector);
        a.applyLowerTarget();
    }

    // ------------------------------------------------------------ agent disconnect

    function test_setAgentZero_disablesApprove() public {
        Alcancia a = _createOne(100 * E18, _deadline());
        _fund(a, 40 * E18);
        vm.prank(user);
        a.setAgent(address(0));
        vm.prank(user);
        a.requestEarlyWithdraw(10 * E18);

        vm.prank(agent);
        vm.expectRevert(Alcancia.NotAgent.selector);
        a.agentApprove();

        vm.prank(address(0));
        vm.expectRevert(Alcancia.NotAgent.selector);
        a.agentApprove();
    }

    // ------------------------------------------------------------ income token

    function test_sweep_rejectsOtherIncomeToken() public {
        _createOne(100 * E18, uint64(block.timestamp + 30 days));
        vm.roll(block.number + 1);
        vm.prank(agent);
        vm.expectRevert(AlcanciaFactory.WrongIncomeToken.selector);
        factory.sweep(user, address(eur), 10 * E18, uint64(block.number));
    }

    function test_createBatchWithIncome_setsToken() public {
        AlcanciaFactory.GoalInput[] memory g = new AlcanciaFactory.GoalInput[](1);
        g[0] = _goal(address(eur), 100 * E18, uint64(block.timestamp + 30 days), 1000);
        address other = makeAddr("other");
        vm.prank(other);
        factory.createBatchWithIncome(address(eur), g);
        assertEq(factory.incomeTokenOf(other), address(eur));
    }
}
