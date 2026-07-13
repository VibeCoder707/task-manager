const mongoose = require('mongoose');
const Task = require('../models/Task');

async function getAllTasks(userId, { completed, priority, label, search, sortBy, order, page = 1, limit = 20 } = {}) {
  const query = { userId };
  if (completed !== undefined) query.completed = completed;
  if (priority) query.priority = priority;
  if (label) query.labels = label;
  if (search) query.$or = [
    { title: { $regex: search, $options: 'i' } },
    { description: { $regex: search, $options: 'i' } },
    { 'notes.text': { $regex: search, $options: 'i' } },
  ];
  const sort = sortBy === 'dueDate'
    ? { dueDate: order === 'desc' ? -1 : 1, _id: 1 }
    : { order: 1, _id: 1 };
  const skip = (page - 1) * limit;
  const [data, total] = await Promise.all([
    Task.find(query).sort(sort).skip(skip).limit(limit),
    Task.countDocuments(query),
  ]);
  return { data, total };
}

const TRACKED_FIELDS = ['title', 'description', 'dueDate', 'completed', 'priority', 'labels'];

async function createTask({ title, description, dueDate, priority, labels, recurrence, userId }) {
  return Task.create({ title, description, dueDate, priority, labels, recurrence, userId, activity: [{ field: 'created' }] });
}

async function updateTask(id, updates, userId) {
  const old = await Task.findOne({ _id: id, userId });
  if (!old) throw new Error('Task not found');

  const entries = Object.keys(updates)
    .filter(f => TRACKED_FIELDS.includes(f) && String(old[f]) !== String(updates[f]))
    .map(f => ({ field: f, oldValue: old[f], newValue: updates[f] }));

  const task = await Task.findOneAndUpdate(
    { _id: id, userId },
    { ...updates, $push: { activity: { $each: entries, $slice: -100 } } },
    { new: true }
  );
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
    { $push: {
      notes: { text },
      activity: { $each: [{ field: 'note_added', newValue: text }], $slice: -100 },
    }},
    { new: true }
  );
  if (!task) throw new Error('Task not found or note limit reached');
  return task;
}

async function deleteNote(taskId, noteId, userId) {
  const old = await Task.findOne({ _id: taskId, userId });
  if (!old) throw new Error('Task not found');
  const note = old.notes.id(noteId);
  const activityEntry = { field: 'note_deleted', oldValue: note ? note.text : null };
  const task = await Task.findOneAndUpdate(
    { _id: taskId, userId },
    { $pull: { notes: { _id: noteId } },
      $push: { activity: { $each: [activityEntry], $slice: -100 } } },
    { new: true }
  );
  return task;
}

async function getTaskActivity(taskId, userId) {
  const task = await Task.findOne({ _id: taskId, userId }, 'activity');
  if (!task) throw new Error('Task not found');
  return task.activity;
}

function nextDueDate(dueDate, recurrence) {
  const base = dueDate ? new Date(dueDate + 'T00:00:00Z') : new Date();
  if (recurrence === 'daily')   base.setUTCDate(base.getUTCDate() + 1);
  if (recurrence === 'weekly')  base.setUTCDate(base.getUTCDate() + 7);
  if (recurrence === 'monthly') base.setUTCMonth(base.getUTCMonth() + 1);
  return base.toISOString().slice(0, 10);
}

module.exports = { getAllTasks, createTask, updateTask, deleteTask, reorderTasks, bulkCompleteTasks, bulkDeleteTasks, getTaskStats, addNote, deleteNote, getTaskActivity, nextDueDate };
