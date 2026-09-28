# Take-Home Assignment — The Untested API

A 2-day take-home assignment. You'll read unfamiliar code, write tests, track down bugs, and ship a small feature.

Read **[ASSIGNMENT.md](./ASSIGNMENT.md)** for the full brief before you start.

---

## A note on AI tools

You're welcome to use AI tools. What we're evaluating is your ability to read and reason about unfamiliar code — so your submission should reflect your own understanding, not just generated output.

Concretely:
- For each bug you report: include where in the code it lives and why it happens
- For the feature you implement: briefly explain the design decisions you made
- If something surprised you or you had to make a tradeoff, say so

---

## Getting Started

**Prerequisites:** Node.js 18+

```bash
cd task-api
npm install
npm start        # runs on http://localhost:3000
```

**Tests:**

```bash
npm test           # run test suite
npm run coverage   # run with coverage report
```

---

## Project Structure

```
task-api/
  src/
    app.js                  # Express app setup
    routes/tasks.js         # Route handlers
    services/taskService.js # Business logic + in-memory data store
    utils/validators.js     # Input validation helpers
  tests/                    # Your tests go here
  package.json
  jest.config.js
  ASSIGNMENT.md               # Full brief — read this first
```

> The data store is in-memory. It resets every time the server restarts.

---

## API Reference

| Method   | Path                      | Description                              |
|----------|---------------------------|------------------------------------------|
| `GET`    | `/tasks`                  | List all tasks. Supports `?status=`, `?page=`, `?limit=` |
| `POST`   | `/tasks`                  | Create a new task                        |
| `PUT`    | `/tasks/:id`              | Full update of a task                    |
| `DELETE` | `/tasks/:id`              | Delete a task (returns 204)              |
| `PATCH`  | `/tasks/:id/complete`     | Mark a task as complete                  |
| `GET`    | `/tasks/stats`            | Counts by status + overdue count         |
| `PATCH`  | `/tasks/:id/assign`       | **Assign a task to a user** _(implemented)_ |

### Task shape

```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "status": "todo | in_progress | done",
  "priority": "low | medium | high",
  "dueDate": "ISO 8601 or null",
  "completedAt": "ISO 8601 or null",
  "createdAt": "ISO 8601"
}
```

### Sample requests

**Create a task**
```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Write tests", "priority": "high"}'
```

**List tasks with filter**
```bash
curl "http://localhost:3000/tasks?status=pending&page=1&limit=10"
```

**Mark complete**
```bash
curl -X PATCH http://localhost:3000/tasks/<id>/complete
```

**Assign task (implemented feature)**
```bash
curl -X PATCH http://localhost:3000/tasks/<id>/assign \
  -H "Content-Type: application/json" \
  -d '{"assignee": "alice"}'
```

---

## What to Submit

See [ASSIGNMENT.md](./ASSIGNMENT.md) for full submission requirements. At minimum, include:

- **Test files** — covering the endpoints and edge cases you identified
- **Bug report** — what you found, where in the code, and why it's a bug (not just symptoms)
- **At least one fix** — with a note on your approach
- **`PATCH /tasks/:id/assign` implementation** — plus a short explanation of any design decisions (validation, edge cases, etc.)

---

## Submission Summary

### Test Results
- **Unit tests:** 40 tests (34 passing, 6 failing - bug detectors)
- **Unit validators:** 32 tests (all passing)
- **Integration tests:** 46 tests (40 passing, 6 failing - bug detectors)
- **Total:** 118 tests (106 passing, 12 failing)

### Bugs Found and Fixed
**Fixed:** Bug #1 (B1) - Pagination offset calculation in `src/services/taskService.js:12`
- Changed `offset = page * limit` to `offset = (page - 1) * limit`
- 7 tests now pass that were previously failing

**Documented but not fixed:**
- B2: Status filter uses `.includes()` instead of exact match
- B3: `completeTask` overwrites priority to 'medium'
- B4: Field injection vulnerability in `update()` function
- B5: `parseInt(page) || 1` masks invalid input (observation)
- B6: `completeTask` overwrites `completedAt` on re-completion

See `BUGS.md` for complete bug report with evidence.

### Feature Implemented
**PATCH /tasks/:id/assign** - Assign a task to a user
- Accepts JSON body: `{ "assignee": "string" }`
- Validates assignee is required, non-empty string after trim
- Returns 200 with updated task, 400 for validation errors, 404 if task not found
- Added 5 unit tests + 9 integration tests, all passing

### Coverage
- **Overall:** 97.45% statement coverage
- **Routes:** 100%
- **Services:** 100% 
- **Utils:** 100%
- **App.js:** 69.23% (error handler intentionally not fully tested)

See `docs/post-feature-coverage.txt` for detailed coverage report.

### Key Files Modified
- `src/services/taskService.js` - B1 fix + `assignTask()` function
- `src/utils/validators.js` - `validateAssignTask()` function
- `src/routes/tasks.js` - PATCH /:id/assign route + validation import
- `tests/unit/taskService.test.js` - Bug detector tests + assign feature tests
- `tests/integration/tasks.test.js` - Bug detector tests + assign feature tests
- `docs/` - Evidence artifacts (pre/post-fix test runs, coverage reports)
- `DESIGN_DECISIONS.md` - 33 design decisions logged during implementation
- `BUGS.md` - Complete bug report
- `NOTES.md` - Submission notes
- `README.md` - Updated documentation

(End of file - total 121 lines)