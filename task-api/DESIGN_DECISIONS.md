# Design Decisions Log

## DD-001: Source of Truth for Data Model
**Date:** 2026-09-28
**Context:** README.md says status = "pending | in-progress | completed".
ASSIGNMENT.md and src/services/taskService.js both use "todo | in_progress | done".
**Decision:** Treat the code as source of truth. Treat README as a documentation bug.
**Reasoning:** Code is what runs. The other two artifacts agree with each other
and with the code — README is the outlier.
**Tradeoff:** If the intent was to change the enum, we'd need a migration. But
no migration code exists, so this is a docs bug.
**Study note:** Always cross-check docs vs code. Doc drift is one of the most
common real-world bugs in APIs.

## DD-002: Bug Report Discipline — Evidence Over Claims
**Date:** 2026-09-28
**Context:** AI-generated code audits often hallucinate bugs (e.g., claimed
the error handler doesn't set Content-Type, which Express does automatically).
**Decision:** Only report bugs we can prove via (a) direct code read AND
(b) a failing test OR a one-line explanation of the incorrect behavior.
Borderline issues go into "Observations / Hardening Suggestions", not "Bugs".
**Reasoning:** The assignment explicitly says "not just symptoms" — root cause
required. Weak bug reports damage credibility more than they help.
**Tradeoff:** We may report fewer bugs than a rival submission, but ours will
survive scrutiny.
**Study note:** In interviews, "I found 3 solid bugs" > "I found 10 bugs"
when the interviewer can only verify 2 of the 10.

## DD-003: Test Strategy — Behavior Over Implementation
**Date:** 2026-09-28
**Context:** ASSIGNMENT.md explicitly says "Tests should test behavior, not
implementation details."
**Decision:** Integration tests hit HTTP endpoints via Supertest and assert
on response shape/status. Unit tests call service functions and assert on
return values. We do NOT assert on internal variables or private helpers.
**Reasoning:** Behavior tests survive refactors; implementation tests break
when you rename a variable. This is the industry standard.
**Tradeoff:** Slightly harder to reach 80% coverage on pure-behavior tests,
but we will — because the service surface is small.
**Study note:** If you ever refactor taskService and your tests still pass,
you wrote behavior tests correctly.

## DD-004: Bug Report Scope — Injection > Missing Validation
**Date:** 2026-09-28
**Context:** First AI pass flagged "missing UUID validation" as a bug. Raw code review
revealed a stronger issue: `update()` spreads `...fields` into the task, allowing
clients to overwrite `id`, `createdAt`, or `completedAt`.
**Decision:** Report field injection as a bug (concrete exploit path). Demote
"missing UUID validation" to an observation (no exploitable behavior today).
**Reasoning:** Reviewers reward bugs with a demonstrable impact. "Could be an issue
if code changes" is speculation, not a bug.
**Tradeoff:** We report fewer bugs, but every one survives cross-examination.
**Study note:** A bug needs (1) a code location, (2) an input that triggers it,
(3) a wrong outcome. If any is missing, it's an observation.

## DD-005: `|| 1` Is Not Input Validation
**Date:** 2026-09-28
**Context:** `parseInt(page) || 1` treats `0`, `NaN`, and `''` as "not provided".
Client typos silently succeed; negative numbers silently produce wrong slices.
**Decision:** Report as Bug #5 with a conservative framing: "silent fallback
masks invalid input." Do NOT recommend a fix that changes happy-path behavior.
**Reasoning:** The assignment asks us to find bugs, not rewrite the API's
contract. Aggressive fixes risk breaking reviewer expectations.
**Tradeoff:** The bug report explains the risk; the fix in Part B stays
focused on one high-confidence bug (pagination).
**Study note:** When you spot a design weakness that isn't strictly broken,
report it as a bug but fix it separately — or not at all. Separating the
discovery from the remediation is a senior move.

## DD-006: We Fix Pagination, Not Priority Overwrite — Here's Why
**Date:** 2026-09-28
**Context:** Assignment requires "fix ONE bug." We have 5 candidates.
**Decision:** Fix **Bug #1 (pagination)**. Reason: (a) highest user impact,
(b) trivially provable with one integration test, (c) fix is a one-character
change (`page` → `page - 1`), (d) reviewers can verify it in 10 seconds.
**Reasoning:** We want the fix to *teach the reviewer something about us*. A
clean one-line fix with a test that fails before and passes after is the
strongest possible signal.
**Tradeoff:** We leave 4 bugs unfixed. That's fine — the assignment says fix
one. Documenting the others shows we found them.
**Study note:** "Which bug would you fix first?" is a standard interview
question. Your answer should weigh impact × fixability × risk. Pagination
wins on all three.

## DD-007: Bug #6 Discovered — completeTask Overwrites completedAt
**Date:** 2026-09-28
**Context:** AI blueprint claimed completeTask returns null on already-completed
tasks. Raw code (taskService.js:63-77) has NO such check — it silently re-completes
and overwrites `completedAt`.
**Decision:** Report as Bug #6. Rewrite the "already completed" test to prove
this behavior and mark it as a failing test pre-fix.
**Reasoning:** This is a real, provable, silent data mutation — same class as
Bug #3. Together they show completeTask has no state-awareness.
**Tradeoff:** We now have 6 bugs. We still only fix one (pagination). The bug
report becomes richer.
**Study note:** AI summaries often hallucinate "correct" behavior. Always read
the raw code — the bugs live in the gap between what the code does and what
the AI assumes it does.

## DD-008: Empty-String Filter Is a Headline Bug, Not a Footnote
**Date:** 2026-09-28
**Context:** `getByStatus('')` matches every task because `''.includes` is
always true in the wrong direction (`'anything'.includes('')` === true).
**Decision:** Dedicate both a unit test and an integration test to this. Lead
with it in the bug report as a one-line demonstration.
**Reasoning:** Reviewers scan for "aha" moments. A filter that returns
everything when given nothing is a perfect 5-second demo.
**Tradeoff:** None — it's free credibility.
**Study note:** Bugs with a memorable demo are worth 3 bugs without one.

## DD-009: Don't Contort Tests to Reach Coverage on app.js
**Date:** 2026-09-28
**Context:** Blueprint suggested adding mock-error routes to hit the 500
handler in app.js.
**Decision:** Reject. Accept ~60% coverage on app.js. Overall target stays 80%+
because app.js is only 22 lines and everything else exceeds 90%.
**Reasoning:** Contrived tests to inflate coverage violate the assignment's
"test behavior, not implementation" rule. A reviewer who sees a weird
mock-error test will assume you optimized for metrics over meaning.
**Tradeoff:** app.js stays partially covered. Acceptable.
**Study note:** Coverage is a smoke detector, not a goal. When the metric
pushes you toward bad tests, the metric is wrong.

## DD-010: Reject AI-Generated Tests With Structural Errors
**Date:** 2026-09-28
**Context:** First attempt at tests/unit/taskService.test.js had a broken
seed() helper (pushed to a local array, ignored its argument), duplicate
const declarations (SyntaxError), Jasmine-only matchers (toBeTrue/toBeFalse),
and hallucinated task IDs in assertions.
**Decision:** Regenerate the file with a stricter prompt that forbids these
patterns explicitly. Do NOT ask the AI to "fix" the previous output — the
failure modes are structural.
**Reasoning:** Iterative patching of bad generations compounds errors. Clean
regeneration with constraints is faster and produces a more coherent file.
**Tradeoff:** We lose 50 seconds of AI time; we gain a working file.
**Study note:** When AI output has ≥3 structural errors, regenerate. When it
has ≤2 and they're local, patch. This heuristic saves hours over a project.

## DD-011: Bug-Catching Tests Must Diverge Under Bug vs. Fix
**Date:** 2026-09-28
**Context:** Test "page beyond last page returns []" passed under both the buggy
and the fixed pagination logic — it didn't actually prove B1.
**Decision:** Every test tagged `// BUG: Bn` must produce a DIFFERENT result
under buggy vs. fixed code. If the assertions pass in both, it's a regression
test — relabel it accordingly, or replace it with a divergent case.
**Reasoning:** The reviewer will run our tests against the buggy code, expect
specific failures, and match them against our bug report. A "bug test" that
passes pre-fix invalidates the bug report.
**Tradeoff:** Some intuitive test cases get dropped because they don't
differentiate.
**Study note:** A red-green test proves a bug exists. A green-green test only
guards against future regressions. Know which one you're writing.

## DD-012: Seed Via Public API, Never Via Object Literals
**Date:** 2026-09-28
**Context:** First draft of taskService.test.js tried to seed with hardcoded
task objects including `status: 'in_progress_extra'` and `completedAt: PAST`.
`create()` doesn't accept `completedAt`, so the state we thought we set up
wasn't real.
**Decision:** Seed ONLY via `taskService.create()` and `.update()` — the
public API. If a test needs a task in a specific state, drive it there
using the same functions a real user would.
**Reasoning:** (a) exercises more of the code under test, (b) can't be fooled
by fields that `create()` silently ignores, (c) makes setup failures visible.
**Tradeoff:** Slightly more verbose setup for "already done" states.
**Study note:** Tests that reach into private state are fragile. Tests that
build state via public APIs document the system's real contract.

## DD-013: Bug Comment Placement — Above `it()`, Not Inside
**Date:** 2026-09-28
**Context:** AI keeps putting `// BUG: B2` inside the `it('...')` string
literal, which makes the comment part of the test name. Useless for scanning
and looks unprofessional.
**Decision:** All bug markers go on the line DIRECTLY ABOVE `it(...)`. Test
names describe behavior, not bug IDs.
**Reasoning:** Reviewers scan for bug tags; the test name is what shows in
the Jest output. Both must be readable independently.
**Tradeoff:** One extra line of vertical space per bug test.
**Study note:** Metadata (bug IDs, issue links, ticket refs) belongs in
comments, not test names.

## DD-023: This Is a Signed Receipt — Preserve It
**Date:** 2026-09-28
**Context:** Full pre-fix test run produced exactly 10 failures, each one
proving a specific bug with a specific expected-vs-received diff.
**Decision:** Save this output verbatim to task-api/docs/pre-fix-test-run.txt.
Reference it from the bug report with line numbers. Never regenerate it —
the timestamped output is the artifact.
**Reasoning:** A bug report that says "the code is broken" is worthless.
A bug report that says "test X fails, here is the exact diff" is
unanswerable. The saved output is that proof.
**Tradeoff:** One text file in the repo (~50KB).
**Study note:** In a code review, the reviewer will run your tests. If your
tests produce these failures on THEIR machine, your report is validated.
Save the output that your tests will reproduce, not just the one from your
own machine.

## DD-024: Test Failure Messages Should Read Like Bug Reports
**Date:** 2026-09-28
**Context:** The failure messages we got are exactly what a reviewer wants:
"Expected 'high' Received 'medium'" is a one-line bug report.
**Decision:** When designing tests, the assertion's diff should be the
strongest evidence. Prefer assertions that expose the actual wrong value,
not just "length 0" or "true vs false".
**Reasoning:** A diff of concrete values tells the reviewer what went wrong
without opening the source code. A boolean assertion ("fails vs passes")
requires them to investigate.
**Tradeoff:** Slightly more setup per test.
**Study note:** Write tests as if the failure output will be quoted in a
bug report. Because it will.

## DD-025: Pure Functions Are Easy to Test, Hard to Break
**Date:** 2026-09-28
**Context:** Validators are pure, stateless functions with no side effects. They are the simplest test targets in any codebase.
**Decision:** Write exhaustive positive/negative tests for each validation rule. Never mock anything, never use timers. If any test fails, it's a BUG (B7, B8...).
**Reasoning:** 32 tests, 32 passes — this gives us confidence that the validation logic is solid and we haven't introduced regressions.
**Tradeoff:** More tests, but each test is cheap and the coverage is 100% on validation logic.
**Study note:** When a function is pure, its domain is small. Test all boundaries, all valid cases, all invalid cases. There's no need for mocking because there is no state to manage.

## DD-026: Commits Are Part of the Deliverable
**Date:** 2026-09-28
**Context:** AI autonomously committed 5 changes during the test-writing phase without a review step. Commits are clean, but we lost the opportunity to control the commit narrative for the reviewer.
**Decision:** For the rest of this assignment, all AI prompts must include "DO NOT COMMIT — stop after verification and report". We review the diff, then commit ourselves with a message we've chosen.
**Reasoning:** The git log is read by reviewers as evidence of process. Each message should be intentional: "test: add X proving Y" tells a story. A generic "add tests" message tells nothing.
**Tradeoff:** More manual steps at commit time.
**Study note:** In a real PR, your commit messages are the changelog for the reviewer. A good commit log reads like a well-structured bug report. An AI that commits without review is a junior engineer who pushes without a PR. Nice try, wrong process.

## DD-027: Every Test File Must Have a Purpose Statement at the Top
**Date:** 2026-09-28
**Context:** tests/unit/validators.test.js begins with a require line and goes straight into describes. tests/unit/taskService.test.js has a comment about seed(). Neither states WHAT the file is for or WHY it exists.
**Decision:** Add a top-of-file block comment to every test file stating: the module under test, the bugs it proves (if any), and the strategy (unit vs integration). Update both existing files in a follow-up commit.
**Reasoning:** A reviewer opens a test file and wants to know in 10 seconds what it's testing and why. The file comment delivers that.
**Tradeoff:** Small amount of boilerplate.
**Study note:** Well-written test files are self-documenting. New engineers joining a team should be able to read the header and skip the body.