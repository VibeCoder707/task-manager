const mongoose = require('mongoose');
const Task = require('../models/Task');

async function getAllTasks(userId, { completed, priority, label, search, sortBy, order } = {}) {
  const query = { userId };
  if (completed !== undefined) query.completed = completed;
  if (priority) query.priority = priority;
  if (label) query.labels = label;
  if (search) query.$or = [
    { title: { $regex: search, $options: 'i' } },
    { description: { $regex: search, $options: 'i' } },
  ];
  const sort = sortBy === 'dueDate'
    ? { dueDate: order === 'desc' ? -1 : 1, _id: 1 }
    : { order: 1, _id: 1 };
  return Task.find(query).sort(sort);
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

async function getTaskStats(userId) {
  const today = new Date().toISOString().slice(0, 10);
  const [result] = await Task.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    {
      $group: {
        _id: null,
        total:     { $sum: 1 },
        completed: { $sum: { $cond: ['$completed', 1, 0] } },
        overdue: {
          $sum: {
            $cond: [{ $and: [
              { $eq: ['$completed', false] },
              { $gt: ['$dueDate', ''] },
              { $lt: ['$dueDate', today] },
            ]}, 1, 0],
          },
        },
        low:    { $sum: { $cond: [{ $eq: ['$priority', 'low'] },    1, 0] } },
        medium: { $sum: { $cond: [{ $eq: ['$priority', 'medium'] }, 1, 0] } },
        high:   { $sum: { $cond: [{ $eq: ['$priority', 'high'] },   1, 0] } },
      },
    },
  ]);

  if (!result) return { total: 0, completed: 0, incomplete: 0, overdue: 0, byPriority: { low: 0, medium: 0, high: 0 } };

  return {
    total:      result.total,
    completed:  result.completed,
    incomplete: result.total - result.completed,
    overdue:    result.overdue,
    byPriority: { low: result.low, medium: result.medium, high: result.high },
  };
}

async function addNote(taskId, text, userId) {
  const task = await Task.findOneAndUpdate(
    { _id: taskId, userId, 'notes.49': { $exists: false } },
    { $push: { notes: { text } } },
    { new: true }
  );
  if (!task) throw new Error('Task not found or note limit reached');
  return task;
}

async function deleteNote(taskId, noteId, userId) {
  const task = await Task.findOneAndUpdate(
    { _id: taskId, userId },
    { $pull: { notes: { _id: noteId } } },
    { new: true }
  );
  if (!task) throw new Error('Task not found');
  return task;
}

module.exports = { getAllTasks, createTask, updateTask, deleteTask, reorderTasks, bulkCompleteTasks, bulkDeleteTasks, getTaskStats, addNote, deleteNote };
