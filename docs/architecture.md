# Architecture

The app follows a simple 3-layer structure:

- **API layer** (`src/api/`) — Express route handlers
- **Service layer** (`src/utils/`) — Business logic, in-memory data store
- **Component layer** (`src/components/`) — HTML rendering helpers

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/tasks | List all tasks |
| POST | /api/tasks | Create a task |
| PUT | /api/tasks/:id | Update a task |
| DELETE | /api/tasks/:id | Delete a task |
