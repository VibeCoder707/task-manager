const mongoose = require('mongoose');
const { getAllTasks, createTask, updateTask, deleteTask } = require('../src/utils/taskService');

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
