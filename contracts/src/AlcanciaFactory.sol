// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Alcancia} from "./Alcancia.sol";

/// @title AlcanciaFactory - creates savings goals and auto-sweeps a share of income into them.
/// @notice Users approve this factory to spend their income token. The agent calls `sweep`
///         to split a reported income amount across the user's goals by bps.
///         Same-currency shares go straight into the goal; foreign-currency shares are sent
///         to the agent, which swaps off-chain and deposits into the goal.
contract AlcanciaFactory is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 public constant MAX_BPS = 10_000;

    struct GoalInput {
        address token;
        string name;
        uint256 target;
        uint64 deadline;
        uint16 bps;
    }

    address public immutable implementation;
    address public admin;
    address public agent;

    mapping(address user => address[]) private _alcancias;
    mapping(address user => mapping(address alcancia => bool)) public isAlcancia;
    mapping(address alcancia => uint16) public bpsOf;
    mapping(address alcancia => address) public tokenOf;
    mapping(address user => uint256) public totalBps;
    mapping(address user => bool) public paused;
    mapping(address user => uint64) public lastSweptBlock;

    // ---------------------------------------------------------------- events
    event AlcanciaCreated(
        address indexed user,
        address indexed alcancia,
        address indexed token,
        string name,
        uint256 target,
        uint64 deadline,
        uint16 bps
    );
    event BpsSet(address indexed user, address indexed alcancia, uint16 bps);
    event PausedSet(address indexed user, bool paused);
    event Swept(address indexed user, address indexed alcancia, uint256 amount);
    event FxPulled(address indexed user, address indexed alcancia, uint256 amount);
    event SweepCompleted(address indexed user, address indexed incomeToken, uint256 income, uint64 toBlock, uint256 total);
    event AgentChanged(address indexed oldAgent, address indexed newAgent);
    event AdminChanged(address indexed oldAdmin, address indexed newAdmin);

    // ---------------------------------------------------------------- errors
    error NotAdmin();
    error NotAgent();
    error NotOwnerOfAlcancia();
    error BpsTooHigh();
    error EmptyBatch();
    error UserPaused();
    error StaleBlock();
    error FutureBlock();
    error ZeroAddress();

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(address implementation_, address agent_) {
        if (implementation_ == address(0)) revert ZeroAddress();
        implementation = implementation_;
        agent = agent_;
        admin = msg.sender;
        emit AdminChanged(address(0), msg.sender);
        emit AgentChanged(address(0), agent_);
    }

    // ---------------------------------------------------------------- admin

    function setAgent(address newAgent) external onlyAdmin {
        emit AgentChanged(agent, newAgent);
        agent = newAgent;
    }

    function setAdmin(address newAdmin) external onlyAdmin {
        if (newAdmin == address(0)) revert ZeroAddress();
        emit AdminChanged(admin, newAdmin);
        admin = newAdmin;
    }

    // ---------------------------------------------------------------- user

    function createBatch(GoalInput[] calldata goals) external returns (address[] memory created) {
        uint256 n = goals.length;
        if (n == 0) revert EmptyBatch();
        created = new address[](n);

        uint256 total = totalBps[msg.sender];
        address agent_ = agent;

        for (uint256 i = 0; i < n; i++) {
            GoalInput calldata g = goals[i];
            total += g.bps;
            if (total > MAX_BPS) revert BpsTooHigh();

            address a = Clones.clone(implementation);
            Alcancia(a).initialize(msg.sender, agent_, g.token, g.name, g.target, g.deadline);

            _alcancias[msg.sender].push(a);
            isAlcancia[msg.sender][a] = true;
            bpsOf[a] = g.bps;
            tokenOf[a] = g.token;
            created[i] = a;

            emit AlcanciaCreated(msg.sender, a, g.token, g.name, g.target, g.deadline, g.bps);
        }
        totalBps[msg.sender] = total;
    }

    function setBps(address alcancia, uint16 bps) external {
        if (!isAlcancia[msg.sender][alcancia]) revert NotOwnerOfAlcancia();
        uint256 total = totalBps[msg.sender] - bpsOf[alcancia] + bps;
        if (total > MAX_BPS) revert BpsTooHigh();
        totalBps[msg.sender] = total;
        bpsOf[alcancia] = bps;
        emit BpsSet(msg.sender, alcancia, bps);
    }

    function setPaused(bool p) external {
        paused[msg.sender] = p;
        emit PausedSet(msg.sender, p);
    }

    function alcanciasOf(address user) external view returns (address[] memory addrs, uint16[] memory bps) {
        addrs = _alcancias[user];
        bps = new uint16[](addrs.length);
        for (uint256 i = 0; i < addrs.length; i++) {
            bps[i] = bpsOf[addrs[i]];
        }
    }

    // ---------------------------------------------------------------- agent

    /// @notice Split `income` of `incomeToken` across the user's goals.
    /// @dev Goals in `incomeToken` receive their share directly. Goals in another token have their
    ///      share sent to the agent (msg.sender) for an off-chain swap + deposit (FxPulled).
    ///      Because total bps <= 10000 and each share is floored, total moved <= income.
    ///      `toBlock` must strictly increase per user (replay protection) and not be in the future.
    function sweep(address user, address incomeToken, uint256 income, uint64 toBlock)
        external
        onlyAgent
        nonReentrant
        returns (uint256 total)
    {
        if (paused[user]) revert UserPaused();
        if (toBlock <= lastSweptBlock[user]) revert StaleBlock();
        if (toBlock > block.number) revert FutureBlock();
        lastSweptBlock[user] = toBlock;

        IERC20 t = IERC20(incomeToken);
        address[] storage list = _alcancias[user];
        uint256 n = list.length;
        for (uint256 i = 0; i < n; i++) {
            address a = list[i];
            uint16 bps = bpsOf[a];
            if (bps == 0) continue;
            uint256 amount = (income * bps) / MAX_BPS;
            if (amount == 0) continue;
            total += amount;
            if (tokenOf[a] == incomeToken) {
                t.safeTransferFrom(user, a, amount);
                emit Swept(user, a, amount);
            } else {
                t.safeTransferFrom(user, msg.sender, amount);
                emit FxPulled(user, a, amount);
            }
        }
        emit SweepCompleted(user, incomeToken, income, toBlock, total);
    }
}
