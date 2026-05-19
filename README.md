# VibeCoder's Tasks

A lightweight personal task manager built with Node.js, Express, and MongoDB.

**Live app:** https://task-manager-production-b3ab.up.railway.app

## Features

- Add tasks with title, description, priority, due date, and labels
- Color-coded due date warnings (overdue, due today, due soon)
- Filter tasks by status, priority, and label
- Inline title editing and drag-to-reorder
- Color-coded label chips with one-click filtering
- JWT authentication with per-user task isolation

## Tech stack

- **Backend:** Node.js + Express
- **Database:** MongoDB Atlas (Mongoose)
- **Auth:** JWT (jsonwebtoken + bcryptjs)
- **Frontend:** Vanilla JS, single HTML file, no framework
- **Tests:** Jest + mongodb-memory-server
- **CI/CD:** GitHub Actions + Railway (auto-deploys on push to `main`)

## Getting started

### Prerequisites

- Node.js 18+
- A [MongoDB Atlas](https://www.mongodb.com/atlas) cluster (free tier works)

### Setup

```bash
git clone https://github.com/VibeCoder707/task-manager.git
cd task-manager
npm install
cp .env.example .env
```

Edit `.env` and fill in:

```
PORT=3000
MONGO_URI=your_mongodb_atlas_connection_string
NODE_ENV=development
```

### Run

```bash
npm run dev     # development (auto-restart on save)
npm start       # production
```

Open http://localhost:3000 in your browser.

### Test

```bash
npm test
```

Runs 6 Jest tests against an in-memory MongoDB instance — no database connection needed.

## Deployment

The app is hosted on [Railway](https://railway.app). Any push to `main` triggers an automatic redeploy. Environment variables (`PORT`, `MONGO_URI`, `NODE_ENV`) are set in the Railway dashboard.
