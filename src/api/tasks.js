const express = require('express');
const router = express.Router();
const { getAllTasks, createTask, updateTask, deleteTask, reorderTasks, bulkCompleteTasks, bulkDeleteTasks, getTaskStats, addNote, deleteNote } = require('../utils/taskService');
const authMiddleware = require('../middleware/auth');

const ALLOWED_FIELDS = ['title', 'description', 'dueDate', 'completed', 'priority', 'labels'];
const MAX_LENGTHS = { title: 200, description: 1000, dueDate: 10 };
const MAX_LABELS = 20;
const MAX_LABEL_LEN = 50;

router.use(authMiddleware);

router.get('/stats', async (req, res, next) => {
  try {
    const stats = await getTaskStats(req.userId);
    res.json(stats);
  } catch (err) { next(err); }
});

router.get('/', async (req, res, next) => {
  try {
    const filters = {};
    const { completed, priority, label, search, sortBy, order } = req.query;

    if (sortBy !== undefined && sortBy !== 'dueDate')
      return res.status(400).json({ error: 'sortBy must be "dueDate"' });
    if (order !== undefined && !['asc', 'desc'].includes(order))
      return res.status(400).json({ error: 'order must be "asc" or "desc"' });
    if (order !== undefined && sortBy === undefined)
      return res.status(400).json({ error: 'order requires sortBy' });

    if (sortBy) filters.sortBy = sortBy;
    if (order) filters.order = order;

    if (completed !== undefined) {
      if (completed !== 'true' && completed !== 'false')
        return res.status(400).json({ error: 'completed must be "true" or "false"' });
      filters.completed = completed === 'true';
    }
    if (priority !== undefined) {
      if (!['low', 'medium', 'high'].includes(priority))
        return res.status(400).json({ error: 'priority must be low, medium, or high' });
      filters.priority = priority;
    }
    if (label !== undefined) filters.label = label;
    if (search !== undefined) {
      if (search.length > 200)
        return res.status(400).json({ error: 'search must be at most 200 characters' });
      filters.search = search;
    }

    const tasks = await getAllTasks(req.userId, filters);
    res.json(tasks);
  } catch (err) { next(err); }
});

router.patch('/bulk', async (req, res, next) => {
  try {
    const { ids, action } = req.body;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 500)
      return res.status(400).json({ error: 'ids must be a non-empty array of at most 500 items' });
    if (!['complete', 'delete'].includes(action))
      return res.status(400).json({ error: 'action must be "complete" or "delete"' });

    const count = action === 'delete'
      ? await bulkDeleteTasks(ids, req.userId)
      : await bulkCompleteTasks(ids, req.userId);

    res.json({ count });
  } catch (err) { next(err); }
});

router.post('/reorder', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length > 500) return res.status(400).json({ error: 'ids must be an array of at most 500 items' });
    await reorderTasks(ids, req.userId);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { title, description, dueDate, priority, labels } = req.body;
    if (!title || typeof title !== 'string' || title.trim() === '') {
      return res.status(400).json({ error: 'title is required' });
    }
    if (title.trim().length > MAX_LENGTHS.title) {
      return res.status(400).json({ error: `title must be at most ${MAX_LENGTHS.title} characters` });
    }
    if (description !== undefined && String(description).length > MAX_LENGTHS.description) {
      return res.status(400).json({ error: `description must be at most ${MAX_LENGTHS.description} characters` });
    }
    if (dueDate !== undefined && String(dueDate).length > MAX_LENGTHS.dueDate) {
      return res.status(400).json({ error: 'invalid dueDate' });
    }
    if (labels !== undefined) {
      if (!Array.isArray(labels) || labels.length > MAX_LABELS || labels.some(l => String(l).length > MAX_LABEL_LEN)) {
        return res.status(400).json({ error: 'invalid labels' });
      }
    }
    const unknown = Object.keys(req.body).filter(k => !ALLOWED_FIELDS.includes(k));
    if (unknown.length > 0) {
      return res.status(400).json({ error: `unknown fields: ${unknown.join(', ')}` });
    }
    const task = await createTask({ title: title.trim(), description, dueDate, priority, labels, userId: req.userId });
    res.status(201).json(task);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const unknown = Object.keys(req.body).filter(k => !ALLOWED_FIELDS.includes(k));
    if (unknown.length > 0) {
      return res.status(400).json({ error: `unknown fields: ${unknown.join(', ')}` });
    }
    if (Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'request body must include at least one field' });
    }
    const { title, description, dueDate, labels } = req.body;
    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({ error: 'title cannot be empty' });
      }
      if (title.trim().length > MAX_LENGTHS.title) {
        return res.status(400).json({ error: `title must be at most ${MAX_LENGTHS.title} characters` });
      }
    }
    if (description !== undefined && String(description).length > MAX_LENGTHS.description) {
      return res.status(400).json({ error: `description must be at most ${MAX_LENGTHS.description} characters` });
    }
    if (dueDate !== undefined && String(dueDate).length > MAX_LENGTHS.dueDate) {
      return res.status(400).json({ error: 'invalid dueDate' });
    }
    if (labels !== undefined) {
      if (!Array.isArray(labels) || labels.length > MAX_LABELS || labels.some(l => String(l).length > MAX_LABEL_LEN)) {
        return res.status(400).json({ error: 'invalid labels' });
      }
    }
    const task = await updateTask(req.params.id, req.body, req.userId);
    res.json(task);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    await deleteTask(req.params.id, req.userId);
    res.status(204).send();
  } catch (err) { next(err); }
});

router.post('/:id/notes', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || text.trim() === '')
      return res.status(400).json({ error: 'text is required' });
    if (text.trim().length > 500)
      return res.status(400).json({ error: 'text must be at most 500 characters' });
    const task = await addNote(req.params.id, text.trim(), req.userId);
    res.status(201).json(task);
  } catch (err) {
    if (err.message === 'Task not found or note limit reached')
      return res.status(404).json({ error: err.message });
    next(err);
  }
});

router.delete('/:id/notes/:noteId', async (req, res, next) => {
  try {
    const task = await deleteNote(req.params.id, req.params.noteId, req.userId);
    res.json(task);
  } catch (err) {
    if (err.message === 'Task not found') return res.status(404).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
