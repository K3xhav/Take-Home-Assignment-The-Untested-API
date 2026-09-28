const { validateCreateTask, validateUpdateTask } = require('../../src/utils/validators');

const VALID_STATUSES = ['todo', 'in_progress', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];
const VALID_DUE_DATE = '2099-01-01T00:00:00.000Z';
const INVALID_DUE_DATE = 'not-a-date';

describe('validateCreateTask', () => {
  it('returns null for a minimal valid body', () => {
    const result = validateCreateTask({ title: 'Task' });
    expect(result).toBeNull();
  });

  it('returns an error string when title is missing', () => {
    const result = validateCreateTask({});
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns an error string when title is an empty string', () => {
    const result = validateCreateTask({ title: '' });
    expect(typeof result).toBe('string');
  });

  it('returns an error string when title is only whitespace', () => {
    const result = validateCreateTask({ title: '   ' });
    expect(typeof result).toBe('string');
  });

  it('returns an error string when title is not a string', () => {
    const result = validateCreateTask({ title: 123 });
    expect(typeof result).toBe('string');
  });

  it.each(VALID_STATUSES)('returns null when status is %s', (status) => {
    const result = validateCreateTask({ title: 'Task', status });
    expect(result).toBeNull();
  });

  it('returns an error string when status is invalid', () => {
    const result = validateCreateTask({ title: 'Task', status: 'pending' });
    expect(typeof result).toBe('string');
  });

  it.each(VALID_PRIORITIES)('returns null when priority is %s', (priority) => {
    const result = validateCreateTask({ title: 'Task', priority });
    expect(result).toBeNull();
  });

  it('returns an error string when priority is invalid', () => {
    const result = validateCreateTask({ title: 'Task', priority: 'urgent' });
    expect(typeof result).toBe('string');
  });

  it('returns null when dueDate is a valid ISO string', () => {
    const result = validateCreateTask({ title: 'Task', dueDate: VALID_DUE_DATE });
    expect(result).toBeNull();
  });

  it('returns an error string when dueDate is not a valid date', () => {
    const result = validateCreateTask({ title: 'Task', dueDate: INVALID_DUE_DATE });
    expect(typeof result).toBe('string');
  });

  it('returns null when dueDate is omitted', () => {
    const result = validateCreateTask({ title: 'Task' });
    expect(result).toBeNull();
  });

  it('returns null when description is provided', () => {
    const result = validateCreateTask({ title: 'Task', description: 'A description' });
    expect(result).toBeNull();
  });
});

describe('validateUpdateTask', () => {
  it('returns null for an empty body', () => {
    const result = validateUpdateTask({});
    expect(result).toBeNull();
  });

  it('returns an error when title is provided as empty string', () => {
    const result = validateUpdateTask({ title: '' });
    expect(typeof result).toBe('string');
  });

  it('returns an error when title is provided as whitespace only', () => {
    const result = validateUpdateTask({ title: '   ' });
    expect(typeof result).toBe('string');
  });

  it('returns null when title is provided as a valid string', () => {
    const result = validateUpdateTask({ title: 'Updated Title' });
    expect(result).toBeNull();
  });

  it.each(VALID_STATUSES)('returns null when status is %s', (status) => {
    const result = validateUpdateTask({ status });
    expect(result).toBeNull();
  });

  it('returns an error when status is invalid', () => {
    const result = validateUpdateTask({ status: 'pending' });
    expect(typeof result).toBe('string');
  });

  it.each(VALID_PRIORITIES)('returns null when priority is %s', (priority) => {
    const result = validateUpdateTask({ priority });
    expect(result).toBeNull();
  });

  it('returns an error when priority is invalid', () => {
    const result = validateUpdateTask({ priority: 'urgent' });
    expect(typeof result).toBe('string');
  });

  it('returns null when dueDate is a valid ISO string', () => {
    const result = validateUpdateTask({ dueDate: VALID_DUE_DATE });
    expect(result).toBeNull();
  });

  it('returns an error when dueDate is invalid', () => {
    const result = validateUpdateTask({ dueDate: INVALID_DUE_DATE });
    expect(typeof result).toBe('string');
  });

  it('returns null for a fully valid partial update', () => {
    const result = validateUpdateTask({
      title: 'T',
      status: 'in_progress',
      priority: 'high',
      dueDate: VALID_DUE_DATE,
    });
    expect(result).toBeNull();
  });
});