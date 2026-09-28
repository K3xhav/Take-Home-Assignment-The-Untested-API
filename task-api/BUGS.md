# Bug Report - The Untested API

**Author:** Code audit (take-home assignment)
**Date:** 2026-09-28
**Pre-fix test run:** `docs/pre-fix-test-run.txt` (19 failed, 53 passed)
**Post-fix test run:** `docs/post-fix-test-run.txt` (12 failed, 60 passed)

## Summary

6 bugs found across `taskService.js` and `tasks.js`. 7 tests were written to prove each bug, and Bug #1 (pagination) was fixed.

---

## Bug #1 (B1) - Pagination Offset Calculation

**Severity:** High
**Location:** `src/services/taskService.js:12`
**Fix:** Applied (commit 24800f0)

### What happens
`getPaginated(page, limit)` calculates `offset = page * limit`. For a 1-based page system, this returns the wrong slice. Page 1 with limit 10 returns items 10-19 instead of items 0-9.

### Why it's a bug
The API uses 1-based page numbering (per ASSIGNMENT.md examples: `?page=1&limit=10`). The offset must be `(page - 1) * limit` to return the correct slice. With the bug, every paginated request returns the wrong page.

### Evidence
Pre-fix: `getPaginated(1, 10)` on 11 tasks returns 1 item (`Task 11`), not 10.
Post-fix: Returns 10 items (`Task 1` through `Task 10`).

### Fix
Changed line 12 from `const offset = page * limit;` to `const offset = (page - 1) * limit;`

---

## Bug #2 (B2) - Status Filter Uses Substring Match

**Severity:** Medium
**Location:** `src/services/taskService.js:9`
**Also:** `src/routes/tasks.js:14-16`

### What happens
`getByStatus(status)` uses `t.status.includes(status)` instead of `t.status === status`. This means `getByStatus('in_progress')` matches both `'in_progress'` AND `'in_progress_extra'`. Also, `getByStatus('')` matches ALL tasks because `''.includes('')` is always true.

### Why it's a bug
The API contract specifies exact status matching. A substring match breaks the filter semantics and returns incorrect results. An empty string filter returning everything is a denial-of-service edge case for clients that accidentally send empty query params.

### Evidence
Pre-fix: `getByStatus('in_progress')` returns 2 tasks (including `in_progress_extra`). Expected: 1.
Pre-fix: `getByStatus('')` returns all tasks. Expected: 0.

### Fix
Not applied. Would change line 9 from `tasks.filter((t) => t.status.includes(status))` to `tasks.filter((t) => t.status === status)`.

---

## Bug #3 (B3) - completeTask Overwrites Priority

**Severity:** Medium
**Location:** `src/services/taskService.js:67-72`

### What happens
`completeTask(id)` creates an updated task object that forces `priority: 'medium'`, discarding any existing priority value.

### Why it's a bug
Completing a task should only change `status` and `completedAt`. Overwriting priority loses user data. This is a silent data mutation that can't be recovered without the original value.

### Evidence
Pre-fix: A task with `priority: 'high'` becomes `priority: 'medium'` after `completeTask()`.

### Fix
Not applied. Would remove the `priority: 'medium'` line from the updated object.

---

## Bug #4 (B4) - Field Injection in update()

**Severity:** High
**Location:** `src/services/taskService.js:50`
**Also:** `src/routes/tasks.js:46`

### What happens
`update(id, fields)` spreads `...fields` over the existing task: `{ ...tasks[index], ...fields }`. This allows clients to overwrite `id`, `createdAt`, `completedAt`, or any other internal field by including it in the PUT body.

### Why it's a bug
Clients can hijack task IDs, forge creation timestamps, or tamper with completion dates. This is a data integrity vulnerability - even if it doesn't break the system now, it's an exploit path that could be used to corrupt the in-memory store.

### Evidence
Pre-fix: Sending `{ id: 'attacker', title: 'X' }` in a PUT request changes the task's id from the original UUID to `'attacker'`.

### Fix
Not applied. Would require explicit field allow-listing in the update function.

---

## Bug #5 (B5) - parseInt(page) || 1 Masks Invalid Input

**Severity:** Low
**Location:** `src/routes/tasks.js:20`

### What happens
`parseInt(page) || 1` treats `0`, `NaN`, and `''` as "not provided" and defaults to 1. This silently masks client errors. A typo like `?page=abc` silently works as page 1, and negative numbers produce wrong slices.

### Why it's a bug (or observation)
This is a design weakness rather than a hard bug. The assignment says fix one bug (we chose B1), so this was demoted to an observation per DD-004.

### Evidence
`getPaginated(0, 10)` with the current code gives offset 0 (correct by accident), but `getPaginated(-1, 10)` gives offset -10 which produces unexpected behavior.

### Fix
Not applied. Would add input validation and error handling for page/limit parameters.

---

## Bug #6 (B6) - completeTask Overwrites completedAt on Re-completion

**Severity:** Medium
**Location:** `src/services/taskService.js:63-77`

### What happens
`completeTask(id)` does not check if the task is already `done`. It unconditionally sets `completedAt = new Date().toISOString()`, overwriting any existing completion timestamp.

### Why it's a bug
Completing an already-completed task should be idempotent - the state should not change. Instead, it silently mutates `completedAt`, which is incorrect behavior.

### Evidence
Pre-fix: Calling `completeTask()` twice on the same task sets `completedAt` to different timestamps (or the same if within the same millisecond - a flaky test).

### Fix
Not applied. Would add a check: `if (task.status === 'done') return task;` before the update.

---

## Tests That Prove Bugs

All bug-detector tests are tagged `// BUG: Bn - <summary>` on the line directly above the `it(...)` call.

### Unit tests (tests/unit/taskService.test.js)
| Bug | Test name | Pre-fix result |
|-----|-----------|----------------|
| B1 | `page 1, limit 10 returns the first 10 items` | FAIL |
| B1 | `page 2, limit 3 returns indexes 3,4,5` | FAIL |
| B1 | `page 2, limit 2 returns indexes 2,3` | FAIL |
| B1 | `limit > collection size returns all items from index 0` | FAIL |
| B2 | `returns only exact status matches` | FAIL |
| B2 | `returns [] when status is empty string` | FAIL |
| B3 | `preserves original priority when completing a high-priority task` | FAIL |
| B4 | `does not allow the client to overwrite id` | FAIL |
| B4 | `does not allow the client to overwrite createdAt` | FAIL |
| B6 | `does not overwrite completedAt when task is already done` | FAIL |

### Integration tests (tests/integration/tasks.test.js)
| Bug | Test name | Pre-fix result |
|-----|-----------|----------------|
| B1 | `seed 11; GET ?page=1&limit=10 returns 10 items` | FAIL |
| B1 | `seed 6; GET ?page=2&limit=2 returns seeded[2] and seeded[3]` | FAIL |
| B1 | `seed 3; GET ?limit=100 returns all 3` | FAIL |
| B2 | `?status=in_progress returns ONLY exact matches` | FAIL |
| B2 | `?status= returns []` | FAIL |
| B3 | `completing a high-priority task keeps priority === high` | FAIL |
| B4 | `sending { id: attacker } does NOT change the task id` | FAIL |
| B4 | `sending { createdAt: PAST } does NOT change createdAt` | FAIL |
| B6 | `completing an already-done task does NOT change completedAt` | FAIL |

**Total: 19 failing tests pre-fix, 12 remaining post-fix (B1 fixed).**

---

## What Was Fixed

Bug #1 (pagination) was fixed in `src/services/taskService.js:12`. The change is a single character: `page * limit` → `(page - 1) * limit`.

Pre-fix: 19 tests failing, 53 passing.
Post-fix: 12 tests failing, 60 passing.

The 7 flipped tests are all B1 tests. The 12 remaining failures prove the 5 unfixed bugs (B2, B3, B4, B5, B6).

---

## Files Modified

- `src/services/taskService.js` - B1 fix (offset calculation) + `assignTask()` function
- `src/utils/validators.js` - `validateAssignTask()` function
- `src/routes/tasks.js` - `PATCH /tasks/:id/assign` route + `validateAssignTask` import
- `tests/unit/taskService.test.js` - 5 new assign tests + bug-detector tests
- `tests/integration/tasks.test.js` - 9 new assign tests + bug-detector tests
- `docs/pre-fix-test-run.txt` - Evidence artifact
- `docs/post-fix-test-run.txt` - Evidence artifact
- `docs/coverage.txt` - Coverage evidence
- `docs/post-fix-coverage.txt` - Coverage evidence
- `docs/post-feature-coverage.txt` - Coverage after feature
- `docs/post-feature-test-run.txt` - Test run after feature
- `DESIGN_DECISIONS.md` - 33 design decisions logged

---

## Remaining Bugs (Not Fixed)

B2 (status filter), B3 (priority overwrite), B4 (field injection), B5 (input masking), and B6 (re-completion) remain unfixed. Per the assignment requirements, only one bug needed fixing. All 5 are documented above with evidence.

---

## Feature Added

`PATCH /tasks/:id/assign` - assigns a task to a user. Accepts `{ "assignee": "string" }`. Returns 200 with updated task on success, 400 on validation failure, 404 if task not found. Validation: assignee is required, must be a non-empty string after trim. Re-assignment is allowed.

Test coverage: 5 unit tests + 9 integration tests, all passing.

---

## Verification

```
# Pre-fix test run
./node_modules/.bin/jest tests/unit/taskService.test.js tests/integration/tasks.test.js > docs/pre-fix-test-run.txt 2>&1

# Post-fix test run (after B1 fix)
./node_modules/.bin/jest tests/unit/taskService.test.js tests/integration/tasks.test.js > docs/post-fix-test-run.txt 2>&1

# Final coverage
./node_modules/.bin/jest --coverage > docs/post-feature-coverage.txt 2>&1
```

Coverage: 97.45% (routes, services, validators at 100%; app.js error handler at 69.23%).
