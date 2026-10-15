# Alcancía contracts

- `src/AlcanciaFactory.sol`: registers users and their income currency, clones one `Alcancia` per goal, stores each goal's share (bps) and the per-user sweep cursor. `sweep()` (agent only) splits a paycheck: same-currency shares go to the alcancías, foreign-currency shares go to the agent for conversion.
- `src/Alcancia.sol`: one per goal, owned by the user. Funds can only leave to the owner. Free withdrawal at target or deadline; early withdrawal after a 72 h delay or `agentApprove()`; lowering a target also waits 72 h.

```bash
forge test        # 27 tests incl. fuzz
```

Deployed on Celo mainnet (verified on Blockscout):
- AlcanciaFactory `0xbbab1b684212fc4cde02eafc69bba993934e2218`
- Alcancia implementation `0x290c3c5404f34bcb8f06520a8be31fc65bd786d4`

Deploys go through `../scripts/deploy.mts` (viem) so the creation tx carries the ERC-8021 attribution suffix.
