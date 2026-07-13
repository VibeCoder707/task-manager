const mongoose = require('mongoose');
const { getAllTasks, createTask, updateTask, deleteTask, bulkCompleteTasks, bulkDeleteTasks, getTaskStats } = require('../src/utils/taskService');

const userId = new mongoose.Types.ObjectId();

test('creates a task', async () => {
  const task = await createTask({ title: 'Buy milk', description: 'From the store', dueDate: '2026-05-01', userId });
  expect(task.title).toBe('Buy milk');
  expect(task.completed).toBe(false);
});

test('updates a task', async () => {
  const task = await createTask({ title: 'Walk dog', description: '', dueDate: '2026-05-02', userId });
  const updated = await updateTask(task._id, { completed: true }, userId);
  expect(updated.completed).toBe(true);
});

test('creates a task with priority', async () => {
  const task = await createTask({ title: 'Fix bug', priority: 'high', userId });
  expect(task.priority).toBe('high');
});

test('defaults priority to medium', async () => {
  const task = await createTask({ title: 'Write docs', userId });
  expect(task.priority).toBe('medium');
});

test('creates a task with labels', async () => {
  const task = await createTask({ title: 'Design landing page', labels: ['design', 'work'], userId });
  expect(task.labels).toEqual(['design', 'work']);
});

test('only returns tasks for the correct user', async () => {
  const otherUserId = new mongoose.Types.ObjectId();
  await createTask({ title: 'My task', userId });
  await createTask({ title: 'Their task', userId: otherUserId });
  const tasks = await getAllTasks(userId);
  expect(tasks).toHaveLength(1);
  expect(tasks[0].title).toBe('My task');
});

describe('getAllTasks filters', () => {
  test('filters by completed=false', async () => {
    await createTask({ title: 'Done', userId });
    await updateTask((await createTask({ title: 'Done', userId }))._id, { completed: true }, userId);
    await createTask({ title: 'Pending', userId });
    const tasks = await getAllTasks(userId, { completed: false });
    expect(tasks.every(t => t.completed === false)).toBe(true);
  });

  test('filters by completed=true', async () => {
    const t = await createTask({ title: 'Finish report', userId });
    await updateTask(t._id, { completed: true }, userId);
    await createTask({ title: 'Not done', userId });
    const tasks = await getAllTasks(userId, { completed: true });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Finish report');
  });

  test('filters by priority', async () => {
    await createTask({ title: 'Low task', priority: 'low', userId });
    await createTask({ title: 'High task', priority: 'high', userId });
    const tasks = await getAllTasks(userId, { priority: 'high' });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('High task');
  });

  test('filters by label', async () => {
    await createTask({ title: 'Work task', labels: ['work', 'urgent'], userId });
    await createTask({ title: 'Personal task', labels: ['personal'], userId });
    const tasks = await getAllTasks(userId, { label: 'work' });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Work task');
  });

  test('searches title case-insensitively', async () => {
    await createTask({ title: 'Team Meeting notes', userId });
    await createTask({ title: 'Buy groceries', userId });
    const tasks = await getAllTasks(userId, { search: 'meeting' });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Team Meeting notes');
  });

  test('searches description', async () => {
    await createTask({ title: 'Task A', description: 'Discuss quarterly budget', userId });
    await createTask({ title: 'Task B', description: 'Nothing special', userId });
    const tasks = await getAllTasks(userId, { search: 'quarterly' });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Task A');
  });

  test('combines priority and completed filters', async () => {
    await createTask({ title: 'High done', priority: 'high', userId });
    await updateTask((await createTask({ title: 'High done', priority: 'high', userId }))._id, { completed: true }, userId);
    await createTask({ title: 'High pending', priority: 'high', userId });
    await createTask({ title: 'Low pending', priority: 'low', userId });
    const tasks = await getAllTasks(userId, { priority: 'high', completed: false });
    expect(tasks.every(t => t.priority === 'high' && t.completed === false)).toBe(true);
  });

  test('never returns another user\'s tasks regardless of filters', async () => {
    const otherUserId = new mongoose.Types.ObjectId();
    await createTask({ title: 'My meeting', userId });
    await createTask({ title: 'Their meeting', userId: otherUserId });
    const tasks = await getAllTasks(userId, { search: 'meeting' });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('My meeting');
  });
});

describe('overdue flag', () => {
  test('is true for past dueDate and incomplete task', async () => {
    const task = await createTask({ title: 'Overdue task', dueDate: '2020-01-01', userId });
    expect(task.toJSON().overdue).toBe(true);
  });

  test('is false when task is completed even with past dueDate', async () => {
    const task = await createTask({ title: 'Done late', dueDate: '2020-01-01', userId });
    const updated = await updateTask(task._id, { completed: true }, userId);
    expect(updated.toJSON().overdue).toBe(false);
  });

  test('is false for future dueDate', async () => {
    const task = await createTask({ title: 'Future task', dueDate: '2099-12-31', userId });
    expect(task.toJSON().overdue).toBe(false);
  });

  test('is false when dueDate is empty', async () => {
    const task = await createTask({ title: 'No due date', userId });
    expect(task.toJSON().overdue).toBe(false);
  });
});

describe('bulk actions', () => {
  test('bulkCompleteTasks marks tasks completed and returns count', async () => {
    const t1 = await createTask({ title: 'Task 1', userId });
    const t2 = await createTask({ title: 'Task 2', userId });
    const count = await bulkCompleteTasks([t1._id, t2._id], userId);
    expect(count).toBe(2);
    const tasks = await getAllTasks(userId, { completed: true });
    expect(tasks.map(t => t.title)).toEqual(expect.arrayContaining(['Task 1', 'Task 2']));
  });

  test('bulkCompleteTasks ignores IDs belonging to another user', async () => {
    const otherUserId = new mongoose.Types.ObjectId();
    const mine = await createTask({ title: 'Mine', userId });
    const theirs = await createTask({ title: 'Theirs', userId: otherUserId });
    const count = await bulkCompleteTasks([mine._id, theirs._id], userId);
    expect(count).toBe(1);
    const theirTasks = await getAllTasks(otherUserId, { completed: true });
    expect(theirTasks).toHaveLength(0);
  });

  test('bulkDeleteTasks removes tasks and returns count', async () => {
    const t1 = await createTask({ title: 'Delete me 1', userId });
    const t2 = await createTask({ title: 'Delete me 2', userId });
    const count = await bulkDeleteTasks([t1._id, t2._id], userId);
    expect(count).toBe(2);
    const remaining = await getAllTasks(userId);
    expect(remaining.map(t => t.title)).not.toEqual(expect.arrayContaining(['Delete me 1', 'Delete me 2']));
  });

  test('bulkDeleteTasks ignores IDs belonging to another user', async () => {
    const otherUserId = new mongoose.Types.ObjectId();
    const mine = await createTask({ title: 'Mine', userId });
    const theirs = await createTask({ title: 'Theirs', userId: otherUserId });
    const count = await bulkDeleteTasks([mine._id, theirs._id], userId);
    expect(count).toBe(1);
    const theirTasks = await getAllTasks(otherUserId);
    expect(theirTasks).toHaveLength(1);
  });
});

describe('sortBy=dueDate', () => {
  test('sorts tasks by dueDate ascending by default', async () => {
    await createTask({ title: 'C', dueDate: '2026-12-01', userId });
    await createTask({ title: 'A', dueDate: '2026-01-01', userId });
    await createTask({ title: 'B', dueDate: '2026-06-15', userId });
    const tasks = await getAllTasks(userId, { sortBy: 'dueDate' });
    const titles = tasks.filter(t => t.dueDate).map(t => t.title);
    expect(titles).toEqual(['A', 'B', 'C']);
  });

  test('sorts tasks by dueDate descending', async () => {
    await createTask({ title: 'C', dueDate: '2026-12-01', userId });
    await createTask({ title: 'A', dueDate: '2026-01-01', userId });
    await createTask({ title: 'B', dueDate: '2026-06-15', userId });
    const tasks = await getAllTasks(userId, { sortBy: 'dueDate', order: 'desc' });
    const titles = tasks.filter(t => t.dueDate).map(t => t.title);
    expect(titles).toEqual(['C', 'B', 'A']);
  });

  test('default sort (no sortBy) uses manual order field', async () => {
    const t1 = await createTask({ title: 'First', dueDate: '2026-12-01', userId });
    const t2 = await createTask({ title: 'Second', dueDate: '2026-01-01', userId });
    await require('../src/utils/taskService').reorderTasks([t1._id, t2._id], userId);
    const tasks = await getAllTasks(userId);
    expect(tasks[0].title).toBe('First');
    expect(tasks[1].title).toBe('Second');
  });
});

describe('getTaskStats', () => {
  test('returns all zeros when user has no tasks', async () => {
    const emptyUserId = new mongoose.Types.ObjectId();
    const stats = await getTaskStats(emptyUserId);
    expect(stats).toEqual({ total: 0, completed: 0, incomplete: 0, overdue: 0, byPriority: { low: 0, medium: 0, high: 0 } });
  });

  test('counts total, completed, and incomplete correctly', async () => {
    await createTask({ title: 'T1', userId });
    await createTask({ title: 'T2', userId });
    const t3 = await createTask({ title: 'T3', userId });
    await updateTask(t3._id, { completed: true }, userId);
    const stats = await getTaskStats(userId);
    expect(stats.total).toBe(3);
    expect(stats.completed).toBe(1);
    expect(stats.incomplete).toBe(2);
  });

  test('counts overdue correctly — only incomplete tasks with past dueDate', async () => {
    await createTask({ title: 'Overdue', dueDate: '2020-01-01', userId });
    const done = await createTask({ title: 'Done overdue', dueDate: '2020-01-01', userId });
    await updateTask(done._id, { completed: true }, userId);
    await createTask({ title: 'Future', dueDate: '2099-01-01', userId });
    await createTask({ title: 'No date', userId });
    const stats = await getTaskStats(userId);
    expect(stats.overdue).toBe(1);
  });

  test('counts byPriority correctly', async () => {
    await createTask({ title: 'L', priority: 'low', userId });
    await createTask({ title: 'M1', priority: 'medium', userId });
    await createTask({ title: 'M2', priority: 'medium', userId });
    await createTask({ title: 'H', priority: 'high', userId });
    const stats = await getTaskStats(userId);
    expect(stats.byPriority).toEqual({ low: 1, medium: 2, high: 1 });
  });

  test('does not include another user\'s tasks', async () => {
    const otherUserId = new mongoose.Types.ObjectId();
    await createTask({ title: 'Mine', userId });
    await createTask({ title: 'Theirs', userId: otherUserId });
    const stats = await getTaskStats(userId);
    expect(stats.total).toBe(1);
  });
});
