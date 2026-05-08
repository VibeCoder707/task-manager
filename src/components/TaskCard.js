function TaskCard({ task }) {
  return `
    <div class="task-card ${task.completed ? 'completed' : ''}">
      <h3>${task.title}</h3>
      <p>${task.description}</p>
      <span class="due-date">Due: ${task.dueDate}</span>
    </div>
  `;
}

module.exports = TaskCard;
