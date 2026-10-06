# CLAUDE.md: Network of Trust v2

Read `docs/ARCHITECTURE.md` before any change. Current phase and acceptance criteria: `docs/ROADMAP.md`. Detailed plans: `docs/plans/`.

## Non-negotiable rules

1. Never put personal data on-chain: no names, national IDs, emails, phones, grades. Only hashes, roots, addresses, timestamps, reason codes.
2. Every institution-owned table has `institutionId`; every query filters by the caller's institution. Every new endpoint gets an e2e test showing another institution gets 404.
3. The server never stores or uses an institution's private key. Institutions sign in MetaMask.
4. Do not change `computeCredentialHash`, `canonicalJson` or the Merkle leaf format. The frozen test vector must never be edited to make a test pass.
5. Anchored credentials are immutable. Corrections = revoke `SUPERSEDED` + reissue.
6. Grade changes after a term is published go through the `GRADE_CHANGE_AFTER_PUBLISH` workflow with a reason, and always write `GradeAudit`.
7. Totals, letters, GPA, earned credits and graduation eligibility are always computed on the server from component marks and the student's bylaw version. Never accept them from a request body.
8. Nothing is issued automatically. Eligibility only fills the approval queue; a human presses Approve & issue.
9. Check permissions with `can(user, permission, target)` / `@RequirePermission`, never by position name, and never hardcode a university's structure.
10. Extend, don't modify: new policies, rules, templates, networks, storage and channels are new classes registered at an extension point (ARCHITECTURE section 9). No `if (university === ...)` or growing `switch (type)` blocks.
11. Modules never read another module's tables. React to other modules through domain events written to the outbox.
12. Features (`src/features/*`) import only from `src/sdk/`. Core never imports a feature; a feature never imports another feature. Features keep their tables in their own PostgreSQL schema and ship behind a feature flag.
13. Core never waits for a feature: feature work runs in event handlers in the worker. Only critical extension points (grading, retake, pass, eligibility) may stop a core operation when they fail.
14. The smart contract is not upgradeable. Never add a proxy or upgrade mechanism.
15. Nothing in `legacy/` is imported, built or tested. It is reference only.

## Working style

### Teach while you build (the team wants to learn from every step)

- Talk to the team in Egyptian Arabic; keep technical terms in English. The first time any term or abbreviation appears, explain it in the same sentence (e.g. "LRU (Least Recently Used): cache بيشيل أقدم عنصر اتستخدم").
- Before each task: explain in at most 10 lines what you are about to build, how, why this approach, and which alternative you rejected.
- After each task: point to the 1 to 3 places in the diff worth reading and what to notice there.
- Never use the long dash character (Unicode U+2014, the em dash) in anything you write for the team.

### Choose the right tool, and prove it

- For every non-trivial choice (library, pattern, index, cache, data structure, rendering mode), compare at least two options in this order: correctness and security, measured performance, simplicity, team familiarity, cost. Prefer proven, boring technology unless a measurement shows a need.
- Hard-to-reverse or surprising decisions get an ADR in `docs/decisions/` (template there).
- **You own the measurements.** The numbers in ARCHITECTURE section 10.1 marked "starting target" are guesses made before any code existed. Measure the real baseline on the real code (k6, query counts, Lighthouse, gas reporter), then confirm or change each budget in an ADR with the measurement attached, and update the table.
- Base every performance decision on your own measurements: adding a cache, Redis, an index, denormalizing, moving work to the worker, changing a rendering mode. Before and after numbers go in the phase report.
- Never loosen a budget just to make CI pass. Changing a budget needs an ADR explaining what was measured and why the old target was wrong.

### End of every phase (from Phase 2 on)

- Write `docs/reports/phase-N.md` from `docs/reports/TEMPLATE.md`: what was built in backend and frontend and why, decisions and alternatives, measured performance against budgets, security and isolation tests, extension points, what to learn, tech debt, how to try it. A phase without its report is not done.

### Code comments

- Default: no comment. Good names and small functions explain *what* the code does.
- Write a comment only for a *why* the code cannot say: a business rule ("retake capped at C+ per bylaw 2018"), a non-obvious constraint, a security reason, a workaround with a link. One or two lines, never more.
- Forbidden: comments that repeat the code, section banner lines (`// -----`), commented-out code, step-by-step narration, "// Added for X" history (that belongs in git), long JSDoc on private or obvious functions.
- Public contract functions keep one short NatSpec line (`/// @notice ...`) because block explorers show it.
- Teaching explanations go in the chat and in the phase report, never inside the code.
- Review check before every commit: if a file has more comment lines than about 10% of its code lines, delete the ones that are not a *why*.

### Execution

- Use the project agents in `.claude/agents/` as described in `docs/ROADMAP.md` ("How to run a phase"). Reviewers never edit code; only `implementer` does.

- Follow the plan in `docs/plans/` task by task. Test first, then code, then commit.
- If a plan step is wrong or missing something, stop and say so instead of improvising a different design.
- Small commits with clear messages (`feat(contracts): ...`, `fix(api): ...`).
- Never commit `.env`, private keys, `node_modules`, `dist`, `artifacts`, `cache`, `typechain-types`.

## Commands

```bash
npm ci                                   # install all workspaces
npm test                                 # build + test everything
npm test -w @not/credential-core         # one package
npm test -w @not/contracts
npx hardhat node                         # (in packages/contracts) local chain on :8545
npm run deploy:local -w @not/contracts   # deploy to that local chain
npm run deploy:sepolia -w @not/contracts # needs SEPOLIA_RPC_URL + DEPLOYER_PRIVATE_KEY in packages/contracts/.env
```
