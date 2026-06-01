function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function TaskCard({ task }) {
  return `
    <div class="task-card ${task.completed ? 'completed' : ''}">
      <h3>${escapeHtml(task.title)}</h3>
      <p>${escapeHtml(task.description)}</p>
      <span class="due-date">Due: ${escapeHtml(task.dueDate)}</span>
    </div>
  `;
}

module.exports = TaskCard;
