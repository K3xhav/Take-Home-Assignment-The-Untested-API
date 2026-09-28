# Submission Notes

## Summary

This is a full audit submission for "The Untested API" take-home assignment.
The work covers: tests, bug report, one bug fix, and a new feature endpoint.

## What We Tested

| Layer | File | Tests | Status |
|-------|------|-------|--------|
| Unit | `tests/unit/taskService.test.js` | 40 | 34 pass, 6 fail (bug detectors) |
| Unit | `tests/unit/validators.test.js` | 32 | 32 pass |
| Integration | `tests/integration/tasks.test.js` | 46 | 40 pass, 6 fail (bug detectors) |
| **Total** | | **118** | **106 pass, 12 fail** |

All 12 failures map to 5 unfixed bugs (B2, B3, B4, B5, B6). Bug B1 was fixed and 7
previously-failing tests now pass.

## Bugs Found

**Fixed:** B1 — Pagination offset calculation (`page * limit` → `(page - 1) * limit`)

**Not fixed (documented with evidence):**
- B2 — Status filter uses `.includes()` instead of `===`
- B3 — `completeTask` overwrites priority to `'medium'`
- B4 — `update()` allows field injection via spread operator
- B5 — `parseInt(page) || 1` masks invalid input (demoted from bug to observation)
- B6 — `completeTask` overwrites `completedAt` on re-completion

See `BUGS.md` for full details.

## Feature: PATCH /tasks/:id/assign

Added endpoint to assign a task to a user.

- **Method:** `PATCH /tasks/:id/assign`
- **Body:** `{ "assignee": "string" }`
- **Responses:** 200 (task updated), 400 (validation error), 404 (not found)

**Design decisions:**
1. `assignee` is required (a PATCH that assigns nothing is meaningless)
2. Empty string and whitespace-only → 400
3. Non-string inputs → 400
4. Re-assignment is allowed (PATCH, not a one-time claim)
5. Values are trimmed before storage
6. New field stored on task as `assignee` (not added to `create()` — out of scope)
7. Validation lives in `validateAssignTask()` alongside the existing validators
8. Route registered ABOVE `PATCH /:id/complete` to avoid path conflicts

**Files modified:**
- `src/services/taskService.js` — added `assignTask(id, assignee)`
- `src/utils/validators.js` — added `validateAssignTask(body)`
- `src/routes/tasks.js` — added route handler + import
- `tests/unit/taskService.test.js` — 5 new unit tests
- `tests/integration/tasks.test.js` — 9 new integration tests

## What I'd Test Next

1. **Error handler coverage:** Trigger a 500 error to verify `app.js` error middleware. Currently at 69.23% coverage due to DD-009 decision not to test it.
2. **Concurrent request safety:** The in-memory store has no locking. Two rapid POSTs could cause race conditions.
3. **Rate limiting:** No middleware exists to protect against abuse.
4. **POST /tasks body size limits:** `express.json()` used without limits — potential DoS vector.
5. **Pagination with negative numbers:** `parseInt(-1) || 1` returns -1, which produces negative offsets.
6. **Status filter case-insensitivity:** `?status=TODO` doesn't match `'todo'` — is this intended?
7. **PUT vs PATCH semantics:** The current `PUT /:id` behaves like PATCH (partial update). Verify this matches the spec.
8. **UUID format validation:** Route params pass raw strings to the service. Should the routes validate UUID format before delegating?
9. **Idempotency on POST /tasks:** No deduplication — submitting the same title twice creates two tasks.
10. **Due date edge cases:** What happens if `dueDate` is a valid date but not ISO format? E.g., `dueDate: "2020/01/01"`.

## What Surprised Me

1. **`create()` ignores `completedAt`:** The function signature accepts `completedAt` as a parameter (via destructuring) but never assigns it to the task object. It's always set to `null`. This caused an AI test-generation failure where we tried to seed a task with a pre-set `completedAt` — it silently didn't work.

2. **The empty-string status bug:** `getByStatus('')` returns ALL tasks because `['any', 'string'].includes('')` is always `true`. This is a classic JavaScript footgun — empty string matches everything. It took a deliberate test case to expose.

3. **`completeTask` has no state awareness:** There's no check for `status === 'done'` before re-completing. Calling the endpoint on an already-done task silently overwrites `completedAt`. The only reason the unit test caught this is with fake timers — without them, both calls land in the same millisecond and produce identical timestamps (flaky test).

4. **`update()` is an injection vector:** The spread `{ ...tasks[index], ...fields }` lets clients overwrite `id`, `createdAt`, etc. This is the kind of bug that sounds theoretical until you think about what fields a malicious client might send and what systems consume the resulting data.

5. **README vs code mismatch:** README.md documents status as `"pending | in-progress | completed"` but the code uses `"todo | in_progress | done"`. This is a documentation drift bug — clients will send the wrong values and get 400 errors.

6. **No `GET /tasks/:id` route exists:** The REST pattern implies you can GET a single task, but there's no such endpoint. DELETE + follow-up GET is the only way to verify a single task. This is a gap in the API surface.

## Questions I'd Ask Before Shipping to Production

1. **Is the in-memory store sufficient, or do we need a database?** The store resets on restart and has no concurrency protection.

2. **Should we add authentication?** The README's "Getting Started" section mentions API key auth via env var. Without it, anyone with network access can manage tasks.

3. **Is the status enum final?** README says `pending|in-progress|completed` but code uses `todo|in_progress|done`. Which is correct?

4. **Should PUT be partial-update semantics?** Currently `PUT /:id` accepts partial updates like PATCH. Should it require the full resource?

5. **What's the expected behavior for `DELETE /tasks/:id`?** Currently returns 204 with empty body. Some APIs return the deleted resource for confirmation.

6. **Do we need pagination metadata?** Currently the API returns just the sliced array — no total count, no current page, no links for infinite scrolling.

7. **Should `dueDate` format be stricter?** `Date.parse()` is permissive — "2020" is treated as valid. ISO 8601 strict mode might be better.

8. **Is rate limiting part of the deployment story or the app story?** The app has no built-in rate limiting.
