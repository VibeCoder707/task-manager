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
