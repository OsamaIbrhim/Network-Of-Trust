# NoT v2 Roadmap

Spec: `docs/ARCHITECTURE.md`. Each phase ends with working, tested software.

## How to run a phase with an AI coding session

1. Phase 0+1 already has a detailed plan: `docs/plans/2026-09-28-phase-0-1-foundation-and-registry.md`.
2. For every later phase, first ask the session to **write the detailed plan** for that phase only, using this section as the spec, and save it in `docs/plans/`. Review the plan together before any code is written.
3. Execute the plan task by task with the project agents in `.claude/agents/` (loop below). Every task: failing test, implementation, passing test, commit.

   **Per task:** `implementer` → `spec-reviewer` → (`tenant-isolation-reviewer` if the diff touches endpoints, queries, jobs, handlers or permissions) → (`performance-reviewer` if it touches queries, endpoints, jobs, pages, bundles or the contract) → `comment-police`. Any `CHANGES NEEDED` / `BLOCK` goes back to `implementer` before the next task.

   **Per phase:** all reviewers on the whole phase diff, `performance-reviewer` with k6 and Lighthouse, then `report-writer`.

   **Parallel lanes** (only for tasks that touch different files, e.g. a backend module and its web pages): run two `implementer`s with worktree isolation, then merge and review the merged result.
4. Before merging a phase, both of you read the diff. You will be asked about any line in the graduation discussion.
5. Every phase from Phase 2 on ends with a **phase report** (`docs/reports/phase-N.md`, template in `docs/reports/TEMPLATE.md`) and one ADR per important decision (`docs/decisions/`, template inside). A phase is not done without them.
6. Every phase lists the performance budgets (ARCHITECTURE section 10.1) it touches. The session measures them on the real code, turns every "starting target" it touches into a confirmed budget through an ADR, and reports the numbers.
7. Every phase plan must name the extension points (ARCHITECTURE section 9) it adds or plugs into. If a plan edits working code from an earlier phase for anything other than a bug fix, it must say why no extension point fits.

Suggested split: one person owns chain + credentials (Phases 1, 4, 5, 6), the other owns API + academics (Phases 2, 3, 7). Web pages for a feature are built in the same phase as the feature (vertical slices), by the feature owner.

## Milestones

| Milestone | Phases | What a real user can do |
|---|---|---|
| Foundation | 0, 1 | Nothing yet. Contract and hashing library tested and deployed. No screens, no users. |
| **MVP** | 0 to 5, without items tagged `[post-MVP]` | The full story end to end: a university registers and gets approved, sets up its programs and bylaws, instructors enter component marks, results are published per term, eligible graduates appear automatically, one button issues the whole cohort's degrees, and an employer scans a QR and sees VALID or REVOKED. |
| Real-world ready | 6 | Universities with zero ETH can issue (gas sponsorship). |
| Learning features | 7 | Video lessons, assignments, online quizzes with submission receipts. |
| Demo | 8, 9 | Polished, seeded, deployed, ready for the discussion. |

MVP means Minimum Viable Product: the smallest version real users can use from start to finish. Phase 1 alone is not the MVP.

---

## Phase 0: Repo reset (detailed plan exists)

- Move v1 into `legacy/`, stop tracking `node_modules`, `dist`, `artifacts`, `cache`, `.env`.
- npm workspaces root. Node 22 LTS.
- GitHub Actions CI: install, build, test all workspaces on every push and PR.

**Done when:** fresh clone, `npm ci && npm test` passes; `git ls-files | grep node_modules` is empty.

## Phase 1: Registry contract + credential-core (detailed plan exists)

- `packages/credential-core`: `canonicalJson`, `computeCredentialHash`, `generateSalt`, `buildBatch`, `verifyProofLocally`, frozen test vector.
- `packages/contracts`: `CredentialRegistry.sol` with anchor, revoke, verify, pause, roles.
- Integration test: hashes built with credential-core verify on-chain.
- Deploy script for `localhost` and `sepolia`.

**Done when:** all tests pass; contract deployed to Sepolia and address committed in `packages/contracts/deployments/sepolia.json`.

## Phase 2: API + web foundation, identity and institutions

- `apps/api`: NestJS, Prisma, PostgreSQL via `docker-compose.yml`, config validation, structured logging, health endpoint.
- Auth: register, login, refresh, logout. Password reset (email via console transport in dev) `[post-MVP]`. Account types from ARCHITECTURE section 11.
- Tenant guard + `@CurrentInstitution()` decorator; Prisma queries always filtered by `institutionId`.
- **Positions and scoped permissions** (ARCHITECTURE section 8.1): permission catalog in code, `Position` and `PositionAssignment` tables, one `can(user, permission, target)` service, `@RequirePermission('...')` guard, list queries filtered by the caller's scopes.
- **Workflow engine** (section 8.2): definitions (versioned), instances, actions, four-eyes rule, reject-to-start; generic, with no action-specific code inside the engine.
- **Default Egyptian faculty template**: seeded positions and default workflows, copied into each new university on creation.
- **Domain events + outbox** (section 9): `OutboxEvent` + per-handler `EventDelivery` with retries, timeout and dead-letter; later phases only add event types and handlers.
- **Performance baseline**: after the tooling is in place, measure the API and web baselines on seed data and confirm or revise the starting targets of section 10.1 (ADR `0006-performance-budgets`).
- **Performance tooling** (section 10.5): Fastify adapter (ADR with benchmark vs Express), pg-boss queue in the worker, SQL query-count test helper, slow-query log, `pg_stat_statements`, k6 script + seed data, `size-limit` and Lighthouse CI in the web app, gas budget assertions in the contracts suite.
- **Plugin foundation** (section 9.1): `core/`, `features/`, `sdk/` split in api and web; `apps/worker` process for event handlers and heavy jobs; `FeatureFlag` per university with admin screen; `dependency-cruiser` rules in CI; UI error boundary and menu/route slots. Prove it with a tiny `features/hello` plugin (one page, one event handler) that is deleted before merge.
- Institutions (universities): register, profile (logo, seal upload), faculties and departments, staff invitations with assignments, SIWE wallet link, platform-admin approval queue, suspension.
- Chain listener skeleton: reads `InstitutionRegistered`, `InstitutionSuspended`, `InstitutionReinstated`, `SignerAdded`, `SignerRemoved`, stores last processed block, idempotent. Any `SignerAdded` / `SignerRemoved` our database did not initiate raises a high-priority alert (ADR 0005).
- `apps/web`: Next.js, auth pages, role-based redirect after login, admin approval page (calls `registerInstitution` + `addSigner` via MetaMask), wallet change request and approval (`addSigner` / `removeSigner`), institution profile page. Arabic + English with RTL from day one.
- Audit log for every write.

**Done when:** performance CI checks run on every PR and fail on a budget breach; CI fails if core imports a feature or a feature imports another feature; a feature event handler that always throws ends in dead-letter while the core action that emitted the event succeeds; turning a feature flag off hides its routes (404) and menu items; e2e tests cover: login per role; institution B gets 404 on A's profile and cannot update it; a Level 1 Mathematics officer gets 404 on a Level 2 or Chemistry student while a Level 1 all-departments officer sees both Level 1 students; an ended assignment grants nothing; the same user cannot approve two steps of one workflow instance; a rejected instance returns to step 1; platform admin approval flips status to `ISSUER_ACTIVE` after the listener sees `InstitutionRegistered` and `SignerAdded` on a local Hardhat node; a wallet change (add new, remove old) leaves previously issued test credentials VALID and the listener marks the old signer `REMOVED`.

## Phase 3: Academic core and results publishing (the LMS part)

Spec: ARCHITECTURE section 7.2, section 9 (extension points `GradingPolicy`, `RetakePolicy`, `PassRule`, `MarkSource`), section 11 "Programs and bylaws" + "Teaching and results".

- Programs and **bylaw versions**: total credit hours, course categories with minimum credits, grading scale, retake rule, optional minimum GPA. Students are linked to the bylaw version of their intake year.
- Courses with credit hours; academic years and terms (Fall, Spring, Summer); offerings with instructor.
- Students: create one, CSV import (validate every row, report errors per row, all-or-nothing), invite email to claim account, statuses ACTIVE / GRADUATED / INACTIVE.
- Enrollments per offering (with attempt number for retakes).
- **Assessment components** per offering (e.g. Midterm 20, Practical 20, Oral 10, Final 50; must sum to 100). Instructors enter component marks only.
- Results computed by the system: total %, letter, points, pass/fail (including the per-component minimum rule), term GPA, cumulative GPA, earned credits, credits per category. Saved as `TermSnapshot`.
- **Publishing** through the `RESULTS_PUBLISH` workflow; before that students see nothing. Publishing emits `TermPublished`. After publishing, edits go through `GRADE_CHANGE_AFTER_PUBLISH` with a reason, write `GradeAudit`, and snapshots are recomputed.
- Student results page like Ibn Al-Haytham: per term and per academic year, each course with its components, credit hours, letter, points; term and cumulative GPA; earned credits vs required.
- Exams: schedule (date, duration, room) and link an exam to a component so its marks feed that component; statistics per offering (count, pass rate, average, distribution) computed in SQL.
- Web: registrar, instructor and student screens for all of the above, Arabic and English.

**Done when:** e2e tests prove: an instructor only sees their offerings; component maxima that do not sum to 100 are rejected; a student sees nothing before publishing; a post-publish edit without a reason is rejected; GPA and earned credits match hand-computed fixtures for at least 3 students over 2 academic years, including a failed-then-passed course under both retake rules and a failed per-component minimum; two students of the same program on different bylaw versions get different credit totals; cross-institution access returns 404 for every resource in this phase.

## Phase 4: Graduation eligibility, approval and credential issuance

Spec: ARCHITECTURE sections 7.2 (eligibility, approval queue), 7.3, 7.5, 7.6, 8.2 (`GRADUATION_ISSUE`, `CREDENTIAL_REVOKE` workflows), 9 (extension points `EligibilityRule`, `CredentialTemplate`, `AnchoringStrategy` with `DirectWallet`).

- **Non-credit requirements** (e.g. Military Education, summer training): defined by the university or faculty; recorded per student by `UNIVERSITY_OFFICE` or faculty staff as COMPLETED or EXEMPT (with reason). Bulk update from CSV.
- **Eligibility engine**: runs on term publish and on every requirement change; writes `GraduationCheck` with status NOT_YET / BLOCKED / ELIGIBLE and readable reasons ("Major electives: 9 of 12 credits", "Military Education: pending").
- **Approval queue** driven by the `GRADUATION_ISSUE` workflow: per program and graduation term, eligible and blocked lists, student drill-down, exclude with reason, one **Approve** button per step; the last step signs and anchors.
- Issuance: payloads (with program, bylaw version, earned credits, cumulative GPA), salts, hashes, one Merkle tree per approval via credential-core; store proofs; MetaMask `anchorBatch`.
- Listener: `BatchAnchored` (matched by institution id and root, with confirmations), `CredentialRevoked`, `BatchRevoked`. A `BatchAnchored` with no matching prepared batch raises a high-priority "possible stolen key" alert (ADR 0004).
- Platform admin screen for the stolen-key procedure: remove signer, list flagged batches, `revokeBatch(..., 5)` each.
- PDF generation (HTML template with university logo and seal, QR to `/verify/{id}`), student notification email.
- Revoke screen with reason; supersede flow (revoke + reissue).

**Done when:** e2e on a local Hardhat node: a student with 144 credits and Military Education pending is BLOCKED with that reason, recording the requirement moves them to ELIGIBLE with no other action; a student at 141 credits is NOT_YET; approving a program with 3 eligible students and 1 excluded anchors exactly 3 credentials in one batch; revoke one, it becomes `REVOKED`; another institution anchoring the same root first does not affect the university's batch (it still ends `CONFIRMED` and verifies); a batch anchored directly on-chain with a university signer key but not prepared by the API raises the stolen-key alert, and after `revokeBatch` its credentials verify as REVOKED; re-running the listener over the same blocks changes nothing.

## Phase 5: Verification, employers, sharing

- Public `/verify/[id]`: recompute hash in the browser, call `verify` over a public RPC, show VALID / REVOKED / UNKNOWN, issuer active flag, "data altered" when the hash does not match.
- Verification bundle download (student). Bundle upload on the verify page `[post-MVP]`.
- Employer account: saved verifications history `[post-MVP]`.
- Student share links for transcripts (expiry, revoke link, view counter) `[post-MVP]`.
- Rate limiting on public endpoints.

**Done when:** e2e: tampering with the payload in the API response shows "data altered"; revoked shows the reason; a downloaded bundle verifies with the API stopped (script or static page).

**MVP reached here.**

## Phase 6: Gas sponsorship (institutions without ETH)

Spec: ARCHITECTURE section 7.7.

- Built as a plugin (`features/relayer`) that registers a new `AnchoringStrategy`: `SponsoredRelayer`. No change to Phase 4 issuance code.
- Contract: `anchorBatchBySig` and `revokeBySig` with OpenZeppelin `EIP712`, `Nonces`, `SignatureChecker`. Redeploy (new address, update `deployments/*.json`).
- `credential-core`: typed-data builders `anchorBatchTypedData(...)` / `revokeTypedData(...)` shared by API and web, so both sign and verify the exact same structure.
- API relayer module: relayer wallet from env, `RelayedTx` table, queue with retries, per-institution daily quota, low-balance alert, gas cost recorded per transaction.
- Web: "Sign" button (MetaMask `eth_signTypedData_v4`) as the default; "Send transaction myself" kept as an advanced option.
- Institution billing page: number of batches and gas spent per month.

**Done when:** contract tests prove: a valid signature anchors under the issuer (not the relayer); a replayed signature, an expired deadline, a signature from a non-issuer, and a signature for a different root all revert; revokeBySig cannot revoke another issuer's batch. e2e on a local node: an institution wallet with **0 ETH** issues a batch of 3 and revokes one, and the relayer's balance drops by exactly the recorded gas cost.

## Phase 7: Learning features `[post-MVP]`

- Video lessons per offering: upload to object storage and stream, or an unlisted video link; ordered by week.
- Assignments: instructor creates with a deadline, student uploads a file, instructor grades with a comment; the grade can feed an assessment component.
- Online quizzes: multiple choice and true/false, time limit, auto-graded, result feeds an assessment component.
- Built as the first real plugin: `apps/api/src/features/learning` + `apps/web/src/features/learning`, own `learning` schema, feature flag, only SDK imports.
- Quizzes and assignments plug in as new `MarkSource` implementations and emit `MarkProduced`; no change to Phase 3 results code.
- **Submission receipts**: hash every assignment/quiz submission, put all submissions of one assignment in one Merkle tree, anchor it with the same `CredentialRegistry.anchorBatch` (no contract change). The student gets a receipt proving what they submitted and when, useful in grade disputes.
- Course discussion forum (low priority).
- Out of scope, future work in the thesis: proctoring.

**Done when:** the diff touches no file under `core/` (except registering the feature in one list); with the learning flag off, all Phase 0 to 6 e2e tests still pass unchanged; e2e: a quiz auto-grades and updates the component mark; a late assignment upload is rejected; a submission receipt verifies against the anchored root, and a modified file does not.

## Phase 8: Polish

- Arabic/English review of every screen, accessibility pass, empty and error states.
- Demo seed script: 2 universities (2 faculties each), one program with a 144-credit bylaw, 60 students spread over 4 academic years with published results, a graduating cohort with some students blocked on Military Education, 1 issued batch, 1 revoked credential.
- Threat model page and diagrams for the discussion.

## Phase 9: Deploy the demo

- Contract on Sepolia (redeployed in Phase 6 with the BySig functions).
- Relayer wallet funded with Sepolia test ETH; platform admin wallet separate from it.
- API + PostgreSQL + web hosted (choose providers when you get here; compare free tiers at that time).
- Platform admin key stored only in the owner's MetaMask, never in env files on the server.

**Done when:** a person with only a phone can scan a printed QR and see VALID.
