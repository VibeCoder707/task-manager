const Task = require('../models/Task');

async function getAllTasks(userId) {
  return Task.find({ userId }).sort({ order: 1, _id: 1 });
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
  await Task.deleteOne({ _id: id, userId });
}

async function reorderTasks(ids, userId) {
  await Promise.all(ids.map((id, index) => Task.findOneAndUpdate({ _id: id, userId }, { order: index })));
}

module.exports = { getAllTasks, createTask, updateTask, deleteTask, reorderTasks };
