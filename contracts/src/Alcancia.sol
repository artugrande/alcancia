// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Alcancia - a single savings goal (piggy bank), deployed as an EIP-1167 clone.
/// @notice Central invariant: tokens held here can ONLY ever be transferred to `owner`.
///         The `agent` can approve an early-withdraw request (skipping the delay), but it can
///         never move funds itself, nor change where funds go.
contract Alcancia is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant DELAY = 72 hours;

    struct PendingWithdraw {
        uint256 amount;
        uint64 unlockAt;
        bool agentApproved;
    }

    struct PendingTargetDecrease {
        uint256 newTarget;
        uint64 newDeadline;
        uint64 unlockAt;
    }

    bool private _initialized;

    address public owner;
    address public agent;
    address public factory;
    IERC20 public token;
    string public name;
    uint256 public target;
    uint64 public deadline;

    PendingWithdraw public pendingWithdraw;
    PendingTargetDecrease public pendingTargetDecrease;

    // ---------------------------------------------------------------- events
    event Initialized(address indexed owner, address indexed agent, address indexed token, string name, uint256 target, uint64 deadline);
    event Deposited(address indexed from, uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);
    event EarlyWithdrawRequested(uint256 amount, uint64 unlockAt);
    event AgentApproved(address indexed agent, uint256 amount);
    event EarlyWithdrawExecuted(address indexed to, uint256 amount);
    event EarlyWithdrawCancelled();
    event TargetRaised(uint256 oldTarget, uint256 newTarget);
    event DeadlineExtended(uint64 oldDeadline, uint64 newDeadline);
    event LowerTargetRequested(uint256 newTarget, uint64 newDeadline, uint64 unlockAt);
    event LowerTargetApplied(uint256 newTarget, uint64 newDeadline);
    event LowerTargetCancelled();
    event AgentChanged(address indexed oldAgent, address indexed newAgent);

    // ---------------------------------------------------------------- errors
    error AlreadyInitialized();
    error NotOwner();
    error NotAgent();
    error ZeroAddress();
    error ZeroAmount();
    error Locked();
    error InsufficientBalance();
    error NoPendingRequest();
    error DelayNotElapsed();
    error InvalidTarget();
    error InvalidDeadline();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @dev Locks the implementation contract so it can never be initialized directly.
    ///      Clones do not run the constructor, so their `_initialized` starts as false.
    constructor() {
        _initialized = true;
    }

    /// @notice Called once by the factory right after cloning.
    function initialize(
        address owner_,
        address agent_,
        address token_,
        string calldata name_,
        uint256 target_,
        uint64 deadline_
    ) external {
        if (_initialized) revert AlreadyInitialized();
        if (owner_ == address(0) || token_ == address(0)) revert ZeroAddress();
        if (target_ == 0) revert InvalidTarget();
        if (deadline_ <= block.timestamp) revert InvalidDeadline();
        _initialized = true;

        owner = owner_;
        agent = agent_;
        factory = msg.sender;
        token = IERC20(token_);
        name = name_;
        target = target_;
        deadline = deadline_;

        emit Initialized(owner_, agent_, token_, name_, target_, deadline_);
    }

    // ---------------------------------------------------------------- views

    function balance() public view returns (uint256) {
        return token.balanceOf(address(this));
    }

    function unlocked() public view returns (bool) {
        return balance() >= target || block.timestamp >= deadline;
    }

    // ---------------------------------------------------------------- deposits

    /// @notice Anyone can deposit into this goal. Tokens are pulled from msg.sender.
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    // ---------------------------------------------------------------- withdrawals (always to owner)

    /// @notice Withdraw once the goal is reached or the deadline has passed.
    function withdraw(uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (!unlocked()) revert Locked();
        if (amount > balance()) revert InsufficientBalance();
        token.safeTransfer(owner, amount);
        emit Withdrawn(owner, amount);
    }

    /// @notice Request an early withdrawal. Overwrites (and un-approves) any previous request.
    function requestEarlyWithdraw(uint256 amount) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        uint64 unlockAt = uint64(block.timestamp + DELAY);
        pendingWithdraw = PendingWithdraw({amount: amount, unlockAt: unlockAt, agentApproved: false});
        emit EarlyWithdrawRequested(amount, unlockAt);
    }

    /// @notice The agent may approve the pending request so the owner can execute it immediately.
    function agentApprove() external {
        address a = agent;
        if (a == address(0) || msg.sender != a) revert NotAgent();
        if (pendingWithdraw.amount == 0) revert NoPendingRequest();
        pendingWithdraw.agentApproved = true;
        emit AgentApproved(a, pendingWithdraw.amount);
    }

    function executeEarlyWithdraw() external onlyOwner nonReentrant {
        PendingWithdraw memory p = pendingWithdraw;
        if (p.amount == 0) revert NoPendingRequest();
        if (!p.agentApproved && block.timestamp < p.unlockAt) revert DelayNotElapsed();
        delete pendingWithdraw;

        uint256 bal = balance();
        uint256 amount = p.amount < bal ? p.amount : bal;
        if (amount > 0) token.safeTransfer(owner, amount);
        emit EarlyWithdrawExecuted(owner, amount);
    }

    function cancelEarlyWithdraw() external onlyOwner {
        if (pendingWithdraw.amount == 0) revert NoPendingRequest();
        delete pendingWithdraw;
        emit EarlyWithdrawCancelled();
    }

    // ---------------------------------------------------------------- goal changes

    /// @notice Tightening the goal is immediate.
    function raiseTarget(uint256 newTarget) external onlyOwner {
        if (newTarget < target) revert InvalidTarget();
        emit TargetRaised(target, newTarget);
        target = newTarget;
    }

    /// @notice Pushing the deadline later is immediate.
    function extendDeadline(uint64 newDeadline) external onlyOwner {
        if (newDeadline <= deadline) revert InvalidDeadline();
        emit DeadlineExtended(deadline, newDeadline);
        deadline = newDeadline;
    }

    /// @notice Loosening the goal (lower target and/or earlier deadline) only applies after DELAY.
    ///         The agent cannot shortcut this. Overwrites any previous request.
    function requestLowerTarget(uint256 newTarget, uint64 newDeadline) external onlyOwner {
        if (newTarget == 0) revert InvalidTarget();
        uint64 unlockAt = uint64(block.timestamp + DELAY);
        pendingTargetDecrease = PendingTargetDecrease({newTarget: newTarget, newDeadline: newDeadline, unlockAt: unlockAt});
        emit LowerTargetRequested(newTarget, newDeadline, unlockAt);
    }

    function applyLowerTarget() external onlyOwner {
        PendingTargetDecrease memory p = pendingTargetDecrease;
        if (p.unlockAt == 0) revert NoPendingRequest();
        if (block.timestamp < p.unlockAt) revert DelayNotElapsed();
        delete pendingTargetDecrease;
        target = p.newTarget;
        deadline = p.newDeadline;
        emit LowerTargetApplied(p.newTarget, p.newDeadline);
    }

    function cancelLowerTarget() external onlyOwner {
        if (pendingTargetDecrease.unlockAt == 0) revert NoPendingRequest();
        delete pendingTargetDecrease;
        emit LowerTargetCancelled();
    }

    // ---------------------------------------------------------------- agent

    /// @notice Owner can change or disconnect (address(0)) the agent.
    function setAgent(address newAgent) external onlyOwner {
        emit AgentChanged(agent, newAgent);
        agent = newAgent;
    }
}
