/**
 * Integration tests for src/routes/tasks.js
 *
 * Every test hits the app via supertest. State is reset in beforeEach.
 * Bug-detector tests are tagged `// BUG: Bn — ...` on the line above
 * the it() block.
 *
 * Bugs proven here (same as unit tests, re-proven at HTTP layer):
 *   B1, B2, B3, B4, B6
 */

const request = require('supertest');
const app = require('../../src/app');
const taskService = require('../../src/services/taskService');

const PAST = '2020-01-01T00:00:00.000Z';
const FUTURE = '2099-01-01T00:00:00.000Z';

beforeEach(() => {
  taskService._reset();
});

describe('GET /tasks', () => {
  it('returns 200 and [] when store is empty', async () => {
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 200 and all tasks when populated', async () => {
    taskService.create({ title: 'Task A' });
    taskService.create({ title: 'Task B' });
    taskService.create({ title: 'Task C' });
    const res = await request(app).get('/tasks');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it('response tasks have expected shape', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Task' });
    const task = res.body;
    expect(task).toHaveProperty('id');
    expect(task).toHaveProperty('title');
    expect(task).toHaveProperty('status');
    expect(task).toHaveProperty('priority');
    expect(task).toHaveProperty('createdAt');
    expect(new Date(task.createdAt).toString()).not.toBe('Invalid Date');
    expect(typeof task.description).toBe('string');
    expect(task.completedAt).toBeNull();
  });

  // BUG: B2 — filter uses substring match
  it('?status=in_progress returns ONLY exact matches, not in_progress_extra', async () => {
    taskService.create({ title: 'Todo', status: 'todo' });
    taskService.create({ title: 'In Progress', status: 'in_progress' });
    taskService.create({ title: 'Done', status: 'done' });
    taskService.create({ title: 'In Progress Extra', status: 'in_progress_extra' });
    const res = await request(app).get('/tasks').query({ status: 'in_progress' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBeDefined();
  });

  // BUG: B2 — empty string filter matches every task
  it('?status= returns []', async () => {
    taskService.create({ title: 'A' });
    taskService.create({ title: 'B' });
    const res = await request(app).get('/tasks').query({ status: '' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('?status=invalid_status returns [] (200, no error)', async () => {
    const res = await request(app).get('/tasks').query({ status: 'invalid_status' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // BUG: B1 — page 1 uses wrong offset
  it('seed 11; GET ?page=1&limit=10 returns 10 items starting at seeded[0]', async () => {
    for (let i = 1; i <= 11; i++) {
      taskService.create({ title: `Task ${i}` });
    }
    const res = await request(app).get('/tasks').query({ page: 1, limit: 10 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(10);
    expect(res.body[0].title).toBe('Task 1');
  });

  // BUG: B1 — page 2 uses wrong offset
  it('seed 6; GET ?page=2&limit=2 returns seeded[2] and seeded[3]', async () => {
    for (let i = 1; i <= 6; i++) {
      taskService.create({ title: `Task ${i}` });
    }
    const res = await request(app).get('/tasks').query({ page: 2, limit: 2 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].title).toBe('Task 3');
    expect(res.body[1].title).toBe('Task 4');
  });

  it('seed 5; GET ?page=2&limit=5 returns [] (page beyond last)', async () => {
    for (let i = 1; i <= 5; i++) {
      taskService.create({ title: `Task ${i}` });
    }
    const res = await request(app).get('/tasks').query({ page: 2, limit: 5 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('seed 3; GET ?limit=100 returns all 3', async () => {
    for (let i = 1; i <= 3; i++) {
      taskService.create({ title: `Task ${i}` });
    }
    const res = await request(app).get('/tasks').query({ limit: 100 });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });
});

describe('GET /tasks/stats', () => {
  it('returns 200 and zeros for empty store', async () => {
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  it('counts statuses correctly for a mixed store', async () => {
    taskService.create({ title: 'T1', status: 'todo' });
    taskService.create({ title: 'T2', status: 'in_progress' });
    taskService.create({ title: 'T3', status: 'done' });
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ todo: 1, in_progress: 1, done: 1, overdue: 0 });
  });

  it('counts overdue: PAST dueDate AND status !== done', async () => {
    taskService.create({ title: 'Overdue', status: 'todo', dueDate: PAST });
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body.overdue).toBe(1);
  });

  it('does NOT count overdue: status === done even if dueDate is past', async () => {
    taskService.create({ title: 'Done past', status: 'done', dueDate: PAST });
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body.overdue).toBe(0);
  });

  it('does NOT count overdue: FUTURE dueDate', async () => {
    taskService.create({ title: 'Future', status: 'todo', dueDate: FUTURE });
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body.overdue).toBe(0);
  });

  it('does NOT count overdue: dueDate is null', async () => {
    taskService.create({ title: 'No due', status: 'in_progress', dueDate: null });
    const res = await request(app).get('/tasks/stats');
    expect(res.status).toBe(200);
    expect(res.body.overdue).toBe(0);
  });
});

describe('POST /tasks', () => {
  it('returns 201 and the created task for {title}', async () => {
    const res = await request(app).post('/tasks').send({ title: 'New Task' });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('New Task');
    expect(res.body.status).toBe('todo');
    expect(res.body.priority).toBe('medium');
  });

  it('returns 201 with defaults applied', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Task' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('todo');
    expect(res.body.priority).toBe('medium');
    expect(res.body.description).toBe('');
    expect(res.body.dueDate).toBeNull();
  });

  it('returns 201 and preserves all provided fields', async () => {
    const res = await request(app).post('/tasks').send({
      title: 'T',
      description: 'D',
      status: 'in_progress',
      priority: 'high',
      dueDate: PAST,
    });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('T');
    expect(res.body.description).toBe('D');
    expect(res.body.status).toBe('in_progress');
    expect(res.body.priority).toBe('high');
    expect(res.body.dueDate).toBe(PAST);
  });

  it('returns 400 when title missing', async () => {
    const res = await request(app).post('/tasks').send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when title is empty string', async () => {
    const res = await request(app).post('/tasks').send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when status is invalid', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Task', status: 'pending' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when priority is invalid', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Task', priority: 'urgent' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when dueDate is invalid', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Task', dueDate: 'not-a-date' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('ignores unknown fields (admin: true)', async () => {
    const res = await request(app).post('/tasks').send({ title: 'Task', admin: true });
    expect(res.status).toBe(201);
    expect(res.body).not.toHaveProperty('admin');
  });
});

describe('PUT /tasks/:id', () => {
  it('returns 200 and the updated task for a valid partial body', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Original' });
    const taskId = created.body.id;
    const res = await request(app).put(`/tasks/${taskId}`).send({ title: 'Updated' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated');
  });

  it('returns 200 and preserves fields not in body', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Original', status: 'todo' });
    const taskId = created.body.id;
    const res = await request(app).put(`/tasks/${taskId}`).send({ title: 'Changed' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('todo');
  });

  it('returns 404 for nonexistent id', async () => {
    const res = await request(app).put('/tasks/nonexistent').send({ title: 'X' });
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });

  it('returns 400 when title is empty string', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Original' });
    const taskId = created.body.id;
    const res = await request(app).put(`/tasks/${taskId}`).send({ title: '' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // BUG: B4 — id injection at HTTP layer
  it('sending { id: attacker } does NOT change the task id', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Original' });
    const taskId = created.body.id;
    const res = await request(app).put(`/tasks/${taskId}`).send({ id: 'attacker', title: 'X' });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(taskId);
    const getRes = await request(app).get(`/tasks/${taskId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.id).toBe(taskId);
  });

  // BUG: B4 — createdAt injection
  it('sending { createdAt: PAST } does NOT change createdAt', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Original' });
    const taskId = created.body.id;
    const originalCreatedAt = created.body.createdAt;
    const res = await request(app).put(`/tasks/${taskId}`).send({ createdAt: PAST });
    expect(res.status).toBe(200);
    expect(res.body.createdAt).toBe(originalCreatedAt);
  });
});

describe('DELETE /tasks/:id', () => {
  it('returns 204 on success and follow-up GET confirms removal', async () => {
    const created = await request(app).post('/tasks').send({ title: 'To Delete' });
    const taskId = created.body.id;
    const delRes = await request(app).delete(`/tasks/${taskId}`);
    expect(delRes.status).toBe(204);
    // Use GET /tasks to verify the task is no longer in the list
    const getRes = await request(app).get('/tasks');
    expect(getRes.status).toBe(200);
    const taskExists = getRes.body.some((t) => t.id === taskId);
    expect(taskExists).toBe(false);
  });

  it('returns 404 for nonexistent id', async () => {
    const res = await request(app).delete('/tasks/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

describe('PATCH /tasks/:id/complete', () => {
  it('returns 200 and sets status=done and completedAt valid ISO', async () => {
    const created = await request(app).post('/tasks').send({ title: 'To Complete' });
    const taskId = created.body.id;
    const res = await request(app).patch(`/tasks/${taskId}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('done');
    expect(new Date(res.body.completedAt).toString()).not.toBe('Invalid Date');
  });

  // BUG: B3 — complete overwrites priority
  it('completing a high-priority task keeps priority === high', async () => {
    const created = await request(app).post('/tasks').send({ title: 'High Priority', priority: 'high' });
    const taskId = created.body.id;
    const res = await request(app).patch(`/tasks/${taskId}/complete`);
    expect(res.status).toBe(200);
    expect(res.body.priority).toBe('high');
  });

  // BUG: B6 — re-completion overwrites completedAt
  it('completing an already-done task does NOT change completedAt', async () => {
    const created = await request(app).post('/tasks').send({ title: 'Already Done' });
    const taskId = created.body.id;

    const first = await request(app).patch(`/tasks/${taskId}/complete`);
    const firstCompletedAt = first.body.completedAt;

    jest.useFakeTimers().setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
    const second = await request(app).patch(`/tasks/${taskId}/complete`);
    jest.useRealTimers();

    expect(second.body.completedAt).toBe(firstCompletedAt);
  });

  it('returns 404 for nonexistent id', async () => {
    const res = await request(app).patch('/tasks/nonexistent/complete');
    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});