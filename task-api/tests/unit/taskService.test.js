/**
 * Unit tests for src/services/taskService.js
 *
 * Strategy:
 *   - Every test seeds state via the public create() API (see `seed()` helper).
 *   - beforeEach calls taskService._reset() to guarantee isolation.
 *   - Bug-detector tests are tagged with `// BUG: Bn — ...` on the line
 *     directly above their `it(...)` block.
 *
 * Bugs proven by this file (pre-fix failures):
 *   B1 — getPaginated uses page * limit instead of (page - 1) * limit
 *   B2 — getByStatus uses .includes() instead of ===
 *   B3 — completeTask overwrites priority to 'medium'
 *   B4 — update() spreads any incoming field, allowing id/createdAt overwrite
 *   B6 — completeTask has no check for already-done tasks
 *
 * Pre-fix run output is saved to: docs/pre-fix-test-run.txt
 */

const taskService = require('../../src/services/taskService');

const PAST = '2020-01-01T00:00:00.000Z';
const FUTURE = '2099-01-01T00:00:00.000Z';

// seed() creates tasks via the public create() API so every task has a real
// uuid and real defaults. Never construct task objects by hand — create()
// ignores some fields (e.g. completedAt), which would silently break setups.
function seed(specs) {
  return specs.map((s) => taskService.create(s));
}

describe('taskService', () => {
  beforeEach(() => {
    taskService._reset();
  });

  // ---------- getAll ----------
  describe('getAll', () => {
    it('returns [] when store is empty', () => {
      expect(taskService.getAll()).toEqual([]);
    });

    it('returns all tasks after seeding 3', () => {
      seed([{ title: 'A' }, { title: 'B' }, { title: 'C' }]);
      expect(taskService.getAll()).toHaveLength(3);
    });

    it('returns a NEW array — mutating the result does not affect the store', () => {
      seed([{ title: 'A' }, { title: 'B' }]);
      const result = taskService.getAll();
      result.push({ id: 'x', title: 'dummy' });
      expect(taskService.getAll()).toHaveLength(2);
    });
  });

  // ---------- findById ----------
  describe('findById', () => {
    it('returns the task with matching id', () => {
      const [t] = seed([{ title: 'Test' }]);
      const found = taskService.findById(t.id);
      expect(found).toBeDefined();
      expect(found.id).toBe(t.id);
    });

    it('returns undefined for a nonexistent id', () => {
      expect(taskService.findById('nonexistent')).toBeUndefined();
    });

    it('returns undefined for null input', () => {
      expect(taskService.findById(null)).toBeUndefined();
    });

    it('returns undefined for empty string input', () => {
      expect(taskService.findById('')).toBeUndefined();
    });
  });

  // ---------- getByStatus ----------
  describe('getByStatus', () => {
    // BUG: B2 — getByStatus uses .includes() instead of ===
    it('returns only exact status matches', () => {
      const [todo, inProg, done, inProgExtra] = seed([
        { title: 'Todo', status: 'todo' },
        { title: 'In Progress', status: 'in_progress' },
        { title: 'Done', status: 'done' },
        { title: 'In Progress Extra', status: 'in_progress_extra' },
      ]);
      const filtered = taskService.getByStatus('in_progress');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(inProg.id);
    });

    // BUG: B2 — empty string filter matches every task
    it('returns [] when status is empty string', () => {
      seed([{ title: 'A' }, { title: 'B' }]);
      expect(taskService.getByStatus('')).toEqual([]);
    });

    it('returns [] when no tasks match the status', () => {
      seed([{ title: 'A' }]);
      expect(taskService.getByStatus('nonexistent_status')).toEqual([]);
    });
  });

  // ---------- getPaginated ----------
  describe('getPaginated', () => {
    // BUG: B1 — offset is page * limit instead of (page - 1) * limit
    it('page 1, limit 10 returns the first 10 items (indexes 0-9)', () => {
      const seeded = seed(
        Array.from({ length: 11 }, (_, i) => ({ title: `Task ${i + 1}` }))
      );
      const result = taskService.getPaginated(1, 10);
      expect(result).toHaveLength(10);
      expect(result[0].id).toBe(seeded[0].id);
      expect(result[9].id).toBe(seeded[9].id);
    });

    // BUG: B1 — divergent case
    it('page 2, limit 3 returns indexes 3,4,5', () => {
      const seeded = seed([
        { title: 'T1' }, { title: 'T2' }, { title: 'T3' },
        { title: 'T4' }, { title: 'T5' }, { title: 'T6' },
      ]);
      const result = taskService.getPaginated(2, 3);
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(seeded[3].id);
      expect(result[1].id).toBe(seeded[4].id);
      expect(result[2].id).toBe(seeded[5].id);
    });

    // BUG: B1 — divergent case (bug returns indexes 4,5; fix returns 2,3)
    it('page 2, limit 2 returns indexes 2,3', () => {
      const seeded = seed([
        { title: 'T1' }, { title: 'T2' }, { title: 'T3' },
        { title: 'T4' }, { title: 'T5' }, { title: 'T6' },
      ]);
      const result = taskService.getPaginated(2, 2);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(seeded[2].id);
      expect(result[1].id).toBe(seeded[3].id);
    });

    it('page beyond last page returns []', () => {
      seed([
        { title: 'T1' }, { title: 'T2' }, { title: 'T3' },
        { title: 'T4' }, { title: 'T5' },
      ]);
      expect(taskService.getPaginated(2, 5)).toEqual([]);
    });

    // BUG: B1 — with the bug, slice(100,200) on a 3-item array returns []
    it('limit > collection size returns all items from index 0', () => {
      seed([{ title: 'T1' }, { title: 'T2' }, { title: 'T3' }]);
      expect(taskService.getPaginated(1, 100)).toHaveLength(3);
    });
  });

  // ---------- create ----------
  describe('create', () => {
    it('applies defaults when only title is given', () => {
      const task = taskService.create({ title: 'Task' });
      expect(task.id).toBeDefined();
      expect(task.title).toBe('Task');
      expect(task.status).toBe('todo');
      expect(task.priority).toBe('medium');
      expect(task.description).toBe('');
      expect(task.dueDate).toBeNull();
      expect(task.completedAt).toBeNull();
      expect(new Date(task.createdAt).toString()).not.toBe('Invalid Date');
    });

    it('preserves all provided fields (no default overrides)', () => {
      const task = taskService.create({
        title: 'T',
        description: 'D',
        status: 'in_progress',
        priority: 'high',
        dueDate: PAST,
      });
      expect(task.title).toBe('T');
      expect(task.description).toBe('D');
      expect(task.status).toBe('in_progress');
      expect(task.priority).toBe('high');
      expect(task.dueDate).toBe(PAST);
    });

    it('appends to store — getAll() contains the new task', () => {
      const created = taskService.create({ title: 'New' });
      expect(taskService.getAll()).toContainEqual(created);
    });
  });

  // ---------- update ----------
  describe('update', () => {
    // BUG: B4 — update() spreads fields, allowing id overwrite
    it('does not allow the client to overwrite id', () => {
      const [t] = seed([{ title: 'Original' }]);
      const updated = taskService.update(t.id, { id: 'attacker', title: 'X' });
      expect(updated.id).toBe(t.id);
      expect(taskService.findById(t.id)).toBeDefined();
      expect(taskService.findById('attacker')).toBeUndefined();
    });

    // BUG: B4 — update() spreads fields, allowing createdAt overwrite
    it('does not allow the client to overwrite createdAt', () => {
      const [t] = seed([{ title: 'Original' }]);
      const originalCreatedAt = t.createdAt;
      const updated = taskService.update(t.id, { createdAt: PAST });
      expect(updated.createdAt).toBe(originalCreatedAt);
      expect(taskService.findById(t.id).createdAt).toBe(originalCreatedAt);
    });

    it('applies allowed fields (title, priority)', () => {
      const [t] = seed([{ title: 'Original', priority: 'low' }]);
      const updated = taskService.update(t.id, { title: 'New Title', priority: 'high' });
      expect(updated.title).toBe('New Title');
      expect(updated.priority).toBe('high');
    });

    it('returns null for nonexistent id', () => {
      expect(taskService.update('nonexistent', { title: 'X' })).toBeNull();
    });

    it('preserves fields not included in payload', () => {
      const [t] = seed([{ title: 'Original', status: 'todo', priority: 'low' }]);
      const updated = taskService.update(t.id, { title: 'Changed' });
      expect(updated.status).toBe('todo');
      expect(updated.priority).toBe('low');
    });
  });

  // ---------- remove ----------
  describe('remove', () => {
    it('returns true and removes the task from the store', () => {
      const [t] = seed([{ title: 'To Delete' }]);
      expect(taskService.remove(t.id)).toBe(true);
      expect(taskService.getAll()).toHaveLength(0);
    });

    it('returns false for nonexistent id', () => {
      expect(taskService.remove('nonexistent')).toBe(false);
    });
  });

  // ---------- completeTask ----------
  describe('completeTask', () => {
    // BUG: B3 — completeTask overwrites priority to 'medium'
    it('preserves original priority when completing a high-priority task', () => {
      const [t] = seed([{ title: 'High Priority', priority: 'high' }]);
      const updated = taskService.completeTask(t.id);
      expect(updated.priority).toBe('high');
    });

    // BUG: B6 — completeTask has no check for already-done tasks.
    // Uses fake timers so the two completeTask calls land on DIFFERENT frozen
    // timestamps. Without this, both calls fire within the same millisecond
    // and the test passes by accident even when the bug is present.
    it('does not overwrite completedAt when task is already done', () => {
      const [t] = seed([{ title: 'Already Done' }]);

      jest.useFakeTimers().setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
      const first = taskService.completeTask(t.id);
      expect(first.completedAt).not.toBeNull();
      const firstCompletedAt = first.completedAt;

      jest.setSystemTime(new Date('2025-01-01T00:00:01.000Z'));
      const second = taskService.completeTask(t.id);

      jest.useRealTimers();
      expect(second.completedAt).toBe(firstCompletedAt);
    });

    it('sets status to done and completedAt to a valid ISO string', () => {
      const [t] = seed([{ title: 'To Complete' }]);
      const updated = taskService.completeTask(t.id);
      expect(updated.status).toBe('done');
      expect(new Date(updated.completedAt).toString()).not.toBe('Invalid Date');
    });

    it('returns null for nonexistent id', () => {
      expect(taskService.completeTask('nonexistent')).toBeNull();
    });
  });

  // ---------- getStats ----------
  describe('getStats', () => {
    it('returns zeros for an empty store', () => {
      expect(taskService.getStats()).toEqual({
        todo: 0, in_progress: 0, done: 0, overdue: 0,
      });
    });

    it('counts each status correctly in a mixed store', () => {
      seed([
        { title: 'T1', status: 'todo' },
        { title: 'T2', status: 'in_progress' },
        { title: 'T3', status: 'done' },
      ]);
      expect(taskService.getStats()).toEqual({
        todo: 1, in_progress: 1, done: 1, overdue: 0,
      });
    });

    it('counts overdue when dueDate is past and status !== done', () => {
      seed([{ title: 'Overdue', status: 'todo', dueDate: PAST }]);
      expect(taskService.getStats().overdue).toBe(1);
    });

    it('does NOT count overdue when status === done even if dueDate is past', () => {
      seed([{ title: 'Done past', status: 'done', dueDate: PAST }]);
      expect(taskService.getStats().overdue).toBe(0);
    });

    it('does NOT count overdue when dueDate is in the future', () => {
      seed([{ title: 'Future', status: 'todo', dueDate: FUTURE }]);
      expect(taskService.getStats().overdue).toBe(0);
    });

    it('does NOT count overdue when dueDate is null', () => {
      seed([{ title: 'No due', status: 'in_progress', dueDate: null }]);
      expect(taskService.getStats().overdue).toBe(0);
    });
  });
});