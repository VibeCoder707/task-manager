const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const taskRoutes = require('./api/tasks');
const authRoutes = require('./api/auth');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static('public'));
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);

app.use((err, req, res, next) => {
  if (err.message === 'Task not found') return res.status(404).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
  .catch(err => { console.error('MongoDB connection failed:', err.message); process.exit(1); });

module.exports = app;
