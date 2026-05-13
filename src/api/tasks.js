const express = require('express');
const router = express.Router();
const { getAllTasks, createTask, updateTask, deleteTask, reorderTasks } = require('../utils/taskService');
const authMiddleware = require('../middleware/auth');

const ALLOWED_FIELDS = ['title', 'description', 'dueDate', 'completed', 'priority', 'labels'];

router.use(authMiddleware);

router.get('/', async (req, res, next) => {
  try {
    const tasks = await getAllTasks(req.userId);
    res.json(tasks);
  } catch (err) { next(err); }
});

router.post('/reorder', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });
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
