const mongoose = require('mongoose');
const { getAllTasks, createTask, updateTask, deleteTask, bulkCompleteTasks, bulkDeleteTasks, getTaskStats, addNote, deleteNote, getTaskActivity, nextDueDate } = require('../src/utils/taskService');

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
  const { data } = await getAllTasks(userId);
  expect(data).toHaveLength(1);
  expect(data[0].title).toBe('My task');
});

describe('getAllTasks filters', () => {
  test('filters by completed=false', async () => {
    await createTask({ title: 'Done', userId });
    await updateTask((await createTask({ title: 'Done', userId }))._id, { completed: true }, userId);
    await createTask({ title: 'Pending', userId });
    const { data } = await getAllTasks(userId, { completed: false });
    expect(data.every(t => t.completed === false)).toBe(true);
  });

  test('filters by completed=true', async () => {
    const t = await createTask({ title: 'Finish report', userId });
    await updateTask(t._id, { completed: true }, userId);
    await createTask({ title: 'Not done', userId });
    const { data } = await getAllTasks(userId, { completed: true });
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe('Finish report');
  });

  test('filters by priority', async () => {
    await createTask({ title: 'Low task', priority: 'low', userId });
    await createTask({ title: 'High task', priority: 'high', userId });
    const { data } = await getAllTasks(userId, { priority: 'high' });
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe('High task');
  });

  test('filters by label', async () => {
    await createTask({ title: 'Work task', labels: ['work', 'urgent'], userId });
    await createTask({ title: 'Personal task', labels: ['personal'], userId });
    const { data } = await getAllTasks(userId, { label: 'work' });
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe('Work task');
  });

  test('searches title case-insensitively', async () => {
    await createTask({ title: 'Team Meeting notes', userId });
    await createTask({ title: 'Buy groceries', userId });
    const { data } = await getAllTasks(userId, { search: 'meeting' });
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe('Team Meeting notes');
  });

  test('searches description', async () => {
    await createTask({ title: 'Task A', description: 'Discuss quarterly budget', userId });
    await createTask({ title: 'Task B', description: 'Nothing special', userId });
    const { data } = await getAllTasks(userId, { search: 'quarterly' });
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe('Task A');
  });

  test('combines priority and completed filters', async () => {
    await createTask({ title: 'High done', priority: 'high', userId });
    await updateTask((await createTask({ title: 'High done', priority: 'high', userId }))._id, { completed: true }, userId);
    await createTask({ title: 'High pending', priority: 'high', userId });
    await createTask({ title: 'Low pending', priority: 'low', userId });
    const { data } = await getAllTasks(userId, { priority: 'high', completed: false });
    expect(data.every(t => t.priority === 'high' && t.completed === false)).toBe(true);
  });

  test('never returns another user\'s tasks regardless of filters', async () => {
    const otherUserId = new mongoose.Types.ObjectId();
    await createTask({ title: 'My meeting', userId });
    await createTask({ title: 'Their meeting', userId: otherUserId });
    const { data } = await getAllTasks(userId, { search: 'meeting' });
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe('My meeting');
  });

  test('searches note text', async () => {
    const task = await createTask({ title: 'API work', userId });
    await addNote(task._id, 'Check rate limiting logic', userId);
    await createTask({ title: 'Unrelated task', userId });
    const { data } = await getAllTasks(userId, { search: 'rate limiting' });
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe('API work');
  });

  test('note text search respects user isolation', async () => {
    const otherUserId = new mongoose.Types.ObjectId();
    const theirTask = await createTask({ title: 'Their task', userId: otherUserId });
    await addNote(theirTask._id, 'secret keyword', otherUserId);
    const { data } = await getAllTasks(userId, { search: 'secret keyword' });
    expect(data).toHaveLength(0);
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
    const { data } = await getAllTasks(userId, { completed: true });
    expect(data.map(t => t.title)).toEqual(expect.arrayContaining(['Task 1', 'Task 2']));
  });

  test('bulkCompleteTasks ignores IDs belonging to another user', async () => {
    const otherUserId = new mongoose.Types.ObjectId();
    const mine = await createTask({ title: 'Mine', userId });
    const theirs = await createTask({ title: 'Theirs', userId: otherUserId });
    const count = await bulkCompleteTasks([mine._id, theirs._id], userId);
    expect(count).toBe(1);
    const { data: theirTasks } = await getAllTasks(otherUserId, { completed: true });
    expect(theirTasks).toHaveLength(0);
  });

  test('bulkDeleteTasks removes tasks and returns count', async () => {
    const t1 = await createTask({ title: 'Delete me 1', userId });
    const t2 = await createTask({ title: 'Delete me 2', userId });
    const count = await bulkDeleteTasks([t1._id, t2._id], userId);
    expect(count).toBe(2);
    const { data: remaining } = await getAllTasks(userId);
    expect(remaining.map(t => t.title)).not.toEqual(expect.arrayContaining(['Delete me 1', 'Delete me 2']));
  });

  test('bulkDeleteTasks ignores IDs belonging to another user', async () => {
    const otherUserId = new mongoose.Types.ObjectId();
    const mine = await createTask({ title: 'Mine', userId });
    const theirs = await createTask({ title: 'Theirs', userId: otherUserId });
    const count = await bulkDeleteTasks([mine._id, theirs._id], userId);
    expect(count).toBe(1);
    const { data: theirTasks } = await getAllTasks(otherUserId);
    expect(theirTasks).toHaveLength(1);
  });
});

describe('sortBy=dueDate', () => {
  test('sorts tasks by dueDate ascending by default', async () => {
    await createTask({ title: 'C', dueDate: '2026-12-01', userId });
    await createTask({ title: 'A', dueDate: '2026-01-01', userId });
    await createTask({ title: 'B', dueDate: '2026-06-15', userId });
    const { data } = await getAllTasks(userId, { sortBy: 'dueDate' });
    const titles = data.filter(t => t.dueDate).map(t => t.title);
    expect(titles).toEqual(['A', 'B', 'C']);
  });

  test('sorts tasks by dueDate descending', async () => {
    await createTask({ title: 'C', dueDate: '2026-12-01', userId });
    await createTask({ title: 'A', dueDate: '2026-01-01', userId });
    await createTask({ title: 'B', dueDate: '2026-06-15', userId });
    const { data } = await getAllTasks(userId, { sortBy: 'dueDate', order: 'desc' });
    const titles = data.filter(t => t.dueDate).map(t => t.title);
    expect(titles).toEqual(['C', 'B', 'A']);
  });

  test('default sort (no sortBy) uses manual order field', async () => {
    const t1 = await createTask({ title: 'First', dueDate: '2026-12-01', userId });
    const t2 = await createTask({ title: 'Second', dueDate: '2026-01-01', userId });
    await require('../src/utils/taskService').reorderTasks([t1._id, t2._id], userId);
    const { data } = await getAllTasks(userId);
    expect(data[0].title).toBe('First');
    expect(data[1].title).toBe('Second');
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

describe('notes', () => {
  test('adds a note and returns updated task', async () => {
    const task = await createTask({ title: 'Task with notes', userId });
    const updated = await addNote(task._id, 'Check JWT expiry', userId);
    expect(updated.notes).toHaveLength(1);
    expect(updated.notes[0].text).toBe('Check JWT expiry');
    expect(updated.notes[0].createdAt).toBeDefined();
  });

  test('note text is saved correctly', async () => {
    const task = await createTask({ title: 'Task', userId });
    const updated = await addNote(task._id, 'My note', userId);
    expect(updated.notes[0].text).toBe('My note');
  });

  test('multiple notes can be added', async () => {
    const task = await createTask({ title: 'Task', userId });
    await addNote(task._id, 'First note', userId);
    const updated = await addNote(task._id, 'Second note', userId);
    expect(updated.notes).toHaveLength(2);
  });

  test('notes appear in getAllTasks response', async () => {
    const task = await createTask({ title: 'Task', userId });
    await addNote(task._id, 'Visible note', userId);
    const { data } = await getAllTasks(userId);
    expect(data[0].notes[0].text).toBe('Visible note');
  });

  test('cannot add a note to another user\'s task', async () => {
    const otherUserId = new mongoose.Types.ObjectId();
    const task = await createTask({ title: 'Their task', userId: otherUserId });
    await expect(addNote(task._id, 'Sneaky note', userId)).rejects.toThrow('Task not found or note limit reached');
  });

  test('deletes a note and returns updated task', async () => {
    const task = await createTask({ title: 'Task', userId });
    const withNote = await addNote(task._id, 'Delete me', userId);
    const noteId = withNote.notes[0]._id;
    const updated = await deleteNote(task._id, noteId, userId);
    expect(updated.notes).toHaveLength(0);
  });

  test('deleting a note does not affect other notes', async () => {
    const task = await createTask({ title: 'Task', userId });
    await addNote(task._id, 'Keep me', userId);
    const withSecond = await addNote(task._id, 'Delete me', userId);
    const noteToDelete = withSecond.notes[1]._id;
    const updated = await deleteNote(task._id, noteToDelete, userId);
    expect(updated.notes).toHaveLength(1);
    expect(updated.notes[0].text).toBe('Keep me');
  });
});

describe('pagination', () => {
  test('returns first page with correct data and pagination meta', async () => {
    for (let i = 1; i <= 5; i++) await createTask({ title: `Task ${i}`, userId });
    const { data, total } = await getAllTasks(userId, { page: 1, limit: 3 });
    expect(data).toHaveLength(3);
    expect(total).toBe(5);
  });

  test('page=2 skips the first page of results', async () => {
    for (let i = 1; i <= 5; i++) await createTask({ title: `Task ${i}`, userId });
    const { data: page1 } = await getAllTasks(userId, { page: 1, limit: 3 });
    const { data: page2 } = await getAllTasks(userId, { page: 2, limit: 3 });
    const page1Ids = page1.map(t => String(t._id));
    const page2Ids = page2.map(t => String(t._id));
    expect(page2Ids.every(id => !page1Ids.includes(id))).toBe(true);
  });

  test('last page may have fewer items than limit', async () => {
    for (let i = 1; i <= 5; i++) await createTask({ title: `Task ${i}`, userId });
    const { data } = await getAllTasks(userId, { page: 2, limit: 3 });
    expect(data).toHaveLength(2);
  });

  test('total reflects full count regardless of page', async () => {
    for (let i = 1; i <= 5; i++) await createTask({ title: `Task ${i}`, userId });
    const { total } = await getAllTasks(userId, { page: 2, limit: 3 });
    expect(total).toBe(5);
  });

  test('pagination works alongside filters', async () => {
    await createTask({ title: 'High 1', priority: 'high', userId });
    await createTask({ title: 'High 2', priority: 'high', userId });
    await createTask({ title: 'Low 1', priority: 'low', userId });
    const { data, total } = await getAllTasks(userId, { priority: 'high', page: 1, limit: 1 });
    expect(data).toHaveLength(1);
    expect(total).toBe(2);
  });

  test('returns empty data array when page exceeds total', async () => {
    await createTask({ title: 'Only task', userId });
    const { data, total } = await getAllTasks(userId, { page: 99, limit: 20 });
    expect(data).toHaveLength(0);
    expect(total).toBe(1);
  });
});

describe('activity log', () => {
  test('created task has a "created" entry', async () => {
    const task = await createTask({ title: 'New task', userId });
    const activity = await getTaskActivity(task._id, userId);
    expect(activity).toHaveLength(1);
    expect(activity[0].field).toBe('created');
    expect(activity[0].changedAt).toBeDefined();
  });

  test('updating completed logs old and new values', async () => {
    const task = await createTask({ title: 'Task', userId });
    await updateTask(task._id, { completed: true }, userId);
    const activity = await getTaskActivity(task._id, userId);
    const entry = activity.find(e => e.field === 'completed');
    expect(entry.oldValue).toBe(false);
    expect(entry.newValue).toBe(true);
  });

  test('updating a field to the same value produces no new log entry', async () => {
    const task = await createTask({ title: 'Task', userId });
    await updateTask(task._id, { priority: 'medium' }, userId);
    const activity = await getTaskActivity(task._id, userId);
    expect(activity.every(e => e.field !== 'priority')).toBe(true);
  });

  test('adding a note logs note_added with the text', async () => {
    const task = await createTask({ title: 'Task', userId });
    await addNote(task._id, 'My note text', userId);
    const activity = await getTaskActivity(task._id, userId);
    const entry = activity.find(e => e.field === 'note_added');
    expect(entry).toBeDefined();
    expect(entry.newValue).toBe('My note text');
  });

  test('deleting a note logs note_deleted with the old text', async () => {
    const task = await createTask({ title: 'Task', userId });
    const withNote = await addNote(task._id, 'To be deleted', userId);
    await deleteNote(task._id, withNote.notes[0]._id, userId);
    const activity = await getTaskActivity(task._id, userId);
    const entry = activity.find(e => e.field === 'note_deleted');
    expect(entry).toBeDefined();
    expect(entry.oldValue).toBe('To be deleted');
  });

  test('another user cannot read activity', async () => {
    const otherUserId = new mongoose.Types.ObjectId();
    const task = await createTask({ title: 'Task', userId });
    await expect(getTaskActivity(task._id, otherUserId)).rejects.toThrow('Task not found');
  });
});

describe('recurring tasks', () => {
  test('creates a task with recurrence field', async () => {
    const task = await createTask({ title: 'Weekly review', recurrence: 'weekly', userId });
    expect(task.recurrence).toBe('weekly');
  });

  test('nextDueDate daily adds 1 day', () => {
    expect(nextDueDate('2026-07-01', 'daily')).toBe('2026-07-02');
  });

  test('nextDueDate weekly adds 7 days', () => {
    expect(nextDueDate('2026-07-01', 'weekly')).toBe('2026-07-08');
  });

  test('nextDueDate monthly adds 1 calendar month', () => {
    expect(nextDueDate('2026-07-01', 'monthly')).toBe('2026-08-01');
  });

  test('nextDueDate with no dueDate returns a future date string', () => {
    const result = nextDueDate('', 'daily');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result > new Date().toISOString().slice(0, 10)).toBe(true);
  });

  test('non-recurring task completion does not increase task count', async () => {
    const task = await createTask({ title: 'One-off', userId });
    const { total: before } = await getAllTasks(userId);
    await updateTask(task._id, { completed: true }, userId);
    const { total: after } = await getAllTasks(userId);
    expect(after).toBe(before);
  });
});
