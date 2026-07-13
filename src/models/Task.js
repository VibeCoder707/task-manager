const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  dueDate: { type: String, default: '' },
  completed: { type: Boolean, default: false },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  labels: { type: [String], default: [] },
  order: { type: Number, default: 0 },
  notes: {
    type: [{
      text: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
    }],
    default: [],
  },
}, { toJSON: { virtuals: true } });

taskSchema.virtual('overdue').get(function () {
  if (!this.dueDate || this.completed) return false;
  return this.dueDate < new Date().toISOString().slice(0, 10);
});

module.exports = mongoose.model('Task', taskSchema);
