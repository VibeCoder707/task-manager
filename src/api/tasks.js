const express = require('express');
const router = express.Router();
const { getAllTasks, createTask, updateTask, deleteTask, reorderTasks, bulkCompleteTasks, bulkDeleteTasks } = require('../utils/taskService');
const authMiddleware = require('../middleware/auth');

const ALLOWED_FIELDS = ['title', 'description', 'dueDate', 'completed', 'priority', 'labels'];
const MAX_LENGTHS = { title: 200, description: 1000, dueDate: 10 };
const MAX_LABELS = 20;
const MAX_LABEL_LEN = 50;

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const filters = {};
    const { completed, priority, label, search } = req.query;

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

module.exports = router;
