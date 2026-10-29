const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let db; // better-sqlite3 database instance

/* ----------------------------- Window ------------------------------------ */

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#eef1f7',
    title: 'Egobas Task Manager',
    icon: path.join(__dirname, 'src', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(() => {
  initDb();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (db) db.close();
  if (process.platform !== 'darwin') app.quit();
});

/* ----------------------------- Database ---------------------------------- */

function initDb() {
  const Database = require('better-sqlite3');
  const dbPath = path.join(app.getPath('userData'), 'egobas.db');
  db = new Database(dbPath);

  // Enable WAL mode for better write performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Schema — idempotent (safe to run every launch)
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL DEFAULT 'New Project',
      description TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'active',
      priority    TEXT NOT NULL DEFAULT 'medium',
      start_date  TEXT,
      due_date    TEXT,
      created_at  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id         TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      title      TEXT NOT NULL,
      done       INTEGER NOT NULL DEFAULT 0,
      priority   TEXT NOT NULL DEFAULT 'medium',
      due_date   TEXT,
      created_at TEXT NOT NULL
    );
  `);

  // Seed initial sample project & tasks if the database is empty
  const count = db.prepare('SELECT COUNT(*) AS count FROM projects').get().count;
  if (count === 0) {
    const today = new Date().toISOString().slice(0, 10);
    const inTwoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const inThreeDays = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
    const now = new Date().toISOString();

    const insertProject = db.prepare(`
      INSERT INTO projects (id, name, description, status, priority, start_date, due_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertTask = db.prepare(`
      INSERT INTO tasks (id, project_id, title, done, priority, due_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const projId = 'proj-welcome';
    insertProject.run(
      projId,
      '🚀 Welcome to Egobas',
      'Sample project to help you explore features and timelines.',
      'active',
      'high',
      today,
      inTwoWeeks,
      now
    );

    insertTask.run('task-1', projId, 'Click the checkbox to mark this task complete', 1, 'high', today, now);
    insertTask.run('task-2', projId, 'Switch to "Timeline" view in the top header to see Gantt bars', 0, 'medium', inThreeDays, now);
    insertTask.run('task-3', projId, 'Click the ＋ button in the sidebar to create a new project', 0, 'low', inTwoWeeks, now);
  }
}

/* ----------------------------- IPC Handlers ------------------------------ */

// ── Projects ──────────────────────────────────────────────────────────────

ipcMain.handle('projects:getAll', () => {
  const projects = db.prepare('SELECT * FROM projects ORDER BY created_at ASC').all();
  const getTasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at ASC');
  return projects.map((p) => ({
    ...p,
    startDate: p.start_date,
    dueDate: p.due_date,
    createdAt: p.created_at,
    tasks: getTasks.all(p.id).map(mapTask),
  }));
});

ipcMain.handle('projects:create', (_e, p) => {
  db.prepare(`
    INSERT INTO projects (id, name, description, status, priority, start_date, due_date, created_at)
    VALUES (@id, @name, @description, @status, @priority, @startDate, @dueDate, @createdAt)
  `).run(p);
  return true;
});

ipcMain.handle('projects:update', (_e, p) => {
  db.prepare(`
    UPDATE projects SET
      name        = @name,
      description = @description,
      status      = @status,
      priority    = @priority,
      start_date  = @startDate,
      due_date    = @dueDate
    WHERE id = @id
  `).run(p);
  return true;
});

ipcMain.handle('projects:delete', (_e, id) => {
  // Tasks are cascade-deleted via foreign key
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return true;
});

// ── Tasks ─────────────────────────────────────────────────────────────────

ipcMain.handle('tasks:create', (_e, t) => {
  db.prepare(`
    INSERT INTO tasks (id, project_id, title, done, priority, due_date, created_at)
    VALUES (@id, @projectId, @title, @done, @priority, @dueDate, @createdAt)
  `).run({ ...t, done: t.done ? 1 : 0 });
  return true;
});

ipcMain.handle('tasks:toggle', (_e, { id, done }) => {
  db.prepare('UPDATE tasks SET done = ? WHERE id = ?').run(done ? 1 : 0, id);
  return true;
});

ipcMain.handle('tasks:delete', (_e, id) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return true;
});

/* ----------------------------- Helpers ----------------------------------- */

function mapTask(t) {
  return {
    id: t.id,
    projectId: t.project_id,
    title: t.title,
    done: t.done === 1,
    priority: t.priority,
    dueDate: t.due_date,
    createdAt: t.created_at,
  };
}
