const Task = require('../models/Task');

async function getAllTasks(userId, { completed, priority, label, search } = {}) {
  const query = { userId };
  if (completed !== undefined) query.completed = completed;
  if (priority) query.priority = priority;
  if (label) query.labels = label;
  if (search) query.$or = [
    { title: { $regex: search, $options: 'i' } },
    { description: { $regex: search, $options: 'i' } },
  ];
  return Task.find(query).sort({ order: 1, _id: 1 });
}

async function createTask({ title, description, dueDate, priority, labels, userId }) {
  return Task.create({ title, description, dueDate, priority, labels, userId });
}

async function updateTask(id, updates, userId) {
  const task = await Task.findOneAndUpdate({ _id: id, userId }, updates, { new: true });
  if (!task) throw new Error('Task not found');
  return task;
}

async function deleteTask(id, userId) {
  const result = await Task.deleteOne({ _id: id, userId });
  if (result.deletedCount === 0) throw new Error('Task not found');
}

async function reorderTasks(ids, userId) {
  await Promise.all(ids.map((id, index) => Task.findOneAndUpdate({ _id: id, userId }, { order: index })));
}

async function bulkCompleteTasks(ids, userId) {
  const result = await Task.updateMany({ _id: { $in: ids }, userId }, { completed: true });
  return result.modifiedCount;
}

async function bulkDeleteTasks(ids, userId) {
  const result = await Task.deleteMany({ _id: { $in: ids }, userId });
  return result.deletedCount;
}

module.exports = { getAllTasks, createTask, updateTask, deleteTask, reorderTasks, bulkCompleteTasks, bulkDeleteTasks };
