# Egobas Task Manager

A simple desktop to-do list app for managing projects with timelines.

Built with **Electron** + **SQLite** (better-sqlite3) — runs fully offline, no server required.

## Features

- Create and manage multiple projects
- Add tasks with priority levels and due dates
- Track project progress with a live progress bar
- Gantt-style project timeline view
- Data stored locally in SQLite (`egobas.db`)

## Getting Started

```bash
npm install
npx electron-rebuild -f -w better-sqlite3
npm start
```

## Tech Stack

- [Electron](https://www.electronjs.org/) — desktop shell
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — embedded SQLite database
- Vanilla HTML/CSS/JS — no framework, no build step
