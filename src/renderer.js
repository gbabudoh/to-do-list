/* Egobas Task Manager — renderer (SQLite-backed) */

let state = {
  projects: [],     // full project+tasks list mirrored from DB
  selectedId: null,
  view: "tasks",    // "tasks" | "timeline"
};

/* ------------------------------- Utilities -------------------------------- */

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function fmtDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function dateDiffDays(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

function isWeekend(date) {
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function projectProgress(p) {
  if (!p.tasks.length) return 0;
  const done = p.tasks.filter((t) => t.done).length;
  return Math.round((done / p.tasks.length) * 100);
}

/* ------------------------------- Rendering -------------------------------- */

const $content = document.getElementById("content");
const $projectList = document.getElementById("projectList");

function render() {
  renderSidebar();
  if (state.view === "tasks") {
    renderTasksView();
  } else {
    renderTimeline();
  }
  renderStats();
}

function renderStats() {
  const active = state.projects.filter((p) => p.status === "active").length;
  const tasks = state.projects.reduce((n, p) => n + p.tasks.length, 0);
  document.getElementById("statActive").textContent = `${active} active`;
  document.getElementById("statTasks").textContent = `${tasks} tasks`;
}

function renderSidebar() {
  $projectList.innerHTML = "";
  if (!state.projects.length) {
    const li = document.createElement("li");
    li.className = "project-meta";
    li.style.padding = "10px 12px";
    li.textContent = "No projects yet. Click + to add one.";
    $projectList.appendChild(li);
    return;
  }

  state.projects.forEach((p) => {
    const li = document.createElement("li");
    li.className = "project-item" + (p.id === state.selectedId ? " active" : "");
    li.dataset.id = p.id;

    const dot = document.createElement("span");
    dot.className = "project-dot status-" + p.status;

    const name = document.createElement("span");
    name.className = "project-name";
    name.textContent = p.name || "Untitled";

    const meta = document.createElement("span");
    meta.className = "project-meta";
    meta.textContent = p.tasks.length
      ? `${p.tasks.filter((t) => t.done).length}/${p.tasks.length}`
      : "—";

    li.appendChild(dot);
    li.appendChild(name);
    li.appendChild(meta);

    li.addEventListener("click", () => {
      state.selectedId = p.id;
      state.view = "tasks";
      setActiveViewBtn("tasks");
      render();
    });

    $projectList.appendChild(li);
  });
}

/* ----------------------------- Tasks view -------------------------------- */

function renderTasksView() {
  const p = state.projects.find((x) => x.id === state.selectedId);
  if (!p) {
    $content.innerHTML = `
      <div class="empty-state">
        <div class="big-icon">📋</div>
        <h3>No project selected</h3>
        <p>Pick a project from the sidebar, or create a new one with the + button.</p>
      </div>`;
    return;
  }

  const progress = projectProgress(p);

  $content.innerHTML = `
    <div class="project-detail">
      <div class="detail-header">
        <input class="project-title" id="pName" value="${escapeHtml(p.name)}" placeholder="Project name" />
        <button class="delete-btn" id="deleteProject">Delete project</button>
      </div>

      <div class="form-grid">
        <div class="form-field">
          <label>Status</label>
          <select id="pStatus">
            <option value="active">Active</option>
            <option value="on-hold">On hold</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div class="form-field">
          <label>Priority</label>
          <select id="pPriority">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
        </div>
        <div class="form-field">
          <label>Start date</label>
          <input type="date" id="pStart" />
        </div>
        <div class="form-field">
          <label>Due date</label>
          <input type="date" id="pDue" />
        </div>
        <div class="form-field full">
          <label>Description</label>
          <textarea id="pDesc" placeholder="What's this project about?"></textarea>
        </div>
      </div>

      <div class="progress-bar-wrap">
        <div class="progress-label">
          <span>Progress</span>
          <span>${progress}% (${p.tasks.filter((t) => t.done).length}/${p.tasks.length})</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width:${progress}%"></div>
        </div>
      </div>

      <div class="tasks-section">
        <h3>Tasks <span class="task-count">${p.tasks.length}</span></h3>
        <div class="task-form">
          <input type="text" id="newTask" placeholder="Add a task…" />
          <select id="newTaskPrio">
            <option value="low">Low</option>
            <option value="medium" selected>Medium</option>
            <option value="high">High</option>
          </select>
          <input type="date" id="newTaskDue" />
          <button class="add-task-btn" id="addTask">Add</button>
        </div>
        <ul class="task-list" id="taskList"></ul>
      </div>
    </div>`;

  // Populate controls with current values
  document.getElementById("pStatus").value   = p.status;
  document.getElementById("pPriority").value = p.priority || "medium";
  document.getElementById("pStart").value    = p.startDate || "";
  document.getElementById("pDue").value      = p.dueDate || "";
  document.getElementById("pDesc").value     = p.description || "";

  // Wire field saves — each change issues a targeted UPDATE
  bindField("pName",     "name");
  bindField("pStatus",   "status");
  bindField("pPriority", "priority");
  bindField("pStart",    "startDate");
  bindField("pDue",      "dueDate");
  bindField("pDesc",     "description");

  document.getElementById("deleteProject").addEventListener("click", () =>
    deleteProject(p.id)
  );

  const $newTask = document.getElementById("newTask");
  document.getElementById("addTask").addEventListener("click", addTask);
  $newTask.addEventListener("keydown", (e) => { if (e.key === "Enter") addTask(); });

  renderTasks(p);
}

function bindField(elId, field) {
  const el = document.getElementById(elId);
  el.addEventListener("change", async () => {
    const p = currentProject();
    if (!p) return;
    p[field] = el.value;               // update local mirror
    await window.api.updateProject(p); // persist to SQLite
    renderSidebar();
  });
}

function renderTasks(p) {
  const $list = document.getElementById("taskList");
  if (!$list) return;
  $list.innerHTML = "";

  // Sort: incomplete first, then by due date
  const sorted = [...p.tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return 0;
  });

  sorted.forEach((t) => {
    const li = document.createElement("li");
    li.className = "task-item" + (t.done ? " done" : "");

    const check = document.createElement("div");
    check.className = "task-check" + (t.done ? " checked" : "");
    check.textContent = "✓";
    check.addEventListener("click", () => toggleTask(p.id, t.id));

    const text = document.createElement("span");
    text.className = "task-text";
    text.textContent = t.title;

    const badges = document.createElement("div");
    badges.className = "task-badges";

    if (t.priority && t.priority !== "medium") {
      const b = document.createElement("span");
      b.className = "badge " + t.priority;
      b.textContent = t.priority;
      badges.appendChild(b);
    }

    if (t.dueDate) {
      const d = document.createElement("span");
      d.className = "task-date";
      if (!t.done && t.dueDate < todayISO()) d.classList.add("overdue");
      d.textContent = fmtDate(t.dueDate);
      badges.appendChild(d);
    }

    const remove = document.createElement("button");
    remove.className = "task-remove";
    remove.innerHTML = "&times;";
    remove.title = "Remove task";
    remove.addEventListener("click", () => deleteTask(p.id, t.id));

    li.appendChild(check);
    li.appendChild(text);
    li.appendChild(badges);
    li.appendChild(remove);
    $list.appendChild(li);
  });

  if (!sorted.length) {
    const li = document.createElement("li");
    li.style.cssText = "padding:10px 12px;text-align:center;color:var(--text-dim)";
    li.textContent = "No tasks yet. Add one above.";
    $list.appendChild(li);
  }
}

/* ----------------------------- Task actions ------------------------------- */

async function addTask() {
  const p = currentProject();
  if (!p) return;
  const title = document.getElementById("newTask").value.trim();
  if (!title) return;

  const task = {
    id: uid(),
    projectId: p.id,
    title,
    done: false,
    priority: document.getElementById("newTaskPrio").value,
    dueDate: document.getElementById("newTaskDue").value || null,
    createdAt: new Date().toISOString(),
  };

  await window.api.createTask(task);  // INSERT into tasks table

  // Update local mirror
  p.tasks.push(task);

  document.getElementById("newTask").value    = "";
  document.getElementById("newTaskDue").value = "";
  renderTasks(p);
  renderSidebar();
  renderStats();
}

async function toggleTask(projectId, taskId) {
  const p = state.projects.find((x) => x.id === projectId);
  const t = p && p.tasks.find((x) => x.id === taskId);
  if (!t) return;

  t.done = !t.done;
  await window.api.toggleTask(taskId, t.done); // UPDATE tasks SET done = ?

  renderTasks(p);
  renderSidebar();
}

async function deleteTask(projectId, taskId) {
  const p = state.projects.find((x) => x.id === projectId);
  if (!p) return;

  await window.api.deleteTask(taskId); // DELETE FROM tasks WHERE id = ?

  p.tasks = p.tasks.filter((x) => x.id !== taskId);
  renderTasks(p);
  renderSidebar();
  renderStats();
}

/* --------------------------- Project actions ------------------------------ */

function currentProject() {
  return state.projects.find((x) => x.id === state.selectedId);
}

async function newProject() {
  const p = {
    id: uid(),
    name: "New Project",
    description: "",
    startDate: todayISO(),
    dueDate: addDays(todayISO(), 14).toISOString().slice(0, 10),
    status: "active",
    priority: "medium",
    tasks: [],
    createdAt: new Date().toISOString(),
  };

  await window.api.createProject(p); // INSERT into projects table

  state.projects.push(p);
  state.selectedId = p.id;
  state.view = "tasks";
  setActiveViewBtn("tasks");
  render();

  // Focus name for quick rename
  setTimeout(() => {
    const el = document.getElementById("pName");
    if (el) { el.focus(); el.select(); }
  }, 50);
}

async function deleteProject(id) {
  if (!confirm("Delete this project and all its tasks?")) return;

  await window.api.deleteProject(id); // DELETE CASCADE handles tasks

  state.projects = state.projects.filter((x) => x.id !== id);
  if (state.selectedId === id) state.selectedId = null;
  render();
}

/* ------------------------------ Timeline ---------------------------------- */

function renderTimeline() {
  if (!state.projects.length) {
    $content.innerHTML = `
      <div class="empty-state">
        <div class="big-icon">🗓️</div>
        <h3>No projects to show</h3>
        <p>Create a project with start and due dates to see it on the timeline.</p>
      </div>`;
    return;
  }

  const dated = state.projects.filter((p) => p.startDate && p.dueDate);
  if (!dated.length) {
    $content.innerHTML = `
      <div class="empty-state">
        <div class="big-icon">🗓️</div>
        <h3>Set project dates</h3>
        <p>Add start and due dates to your projects to visualize them on the timeline.</p>
      </div>`;
    return;
  }

  let minDate = dated.reduce((m, p) => (p.startDate < m ? p.startDate : m), dated[0].startDate);
  let maxDate = dated.reduce((m, p) => (p.dueDate   > m ? p.dueDate   : m), dated[0].dueDate);
  minDate = addDays(minDate, -2).toISOString().slice(0, 10);
  maxDate = addDays(maxDate,  3).toISOString().slice(0, 10);

  const totalDays  = dateDiffDays(minDate, maxDate) + 1;
  const dayWidth   = 46;
  const labelWidth = 160;

  let daysHtml = `<div class="timeline-days-row" style="margin-left:${labelWidth}px">`;
  for (let i = 0; i < totalDays; i++) {
    const d  = addDays(minDate, i).toISOString().slice(0, 10);
    const we = isWeekend(d) ? " weekend" : "";
    const td = d === todayISO() ? " today" : "";
    daysHtml += `<div class="timeline-day${we}${td}">${fmtDate(d)}</div>`;
  }
  daysHtml += "</div>";

  let rowsHtml = "";
  dated.forEach((p) => {
    const startOffset = dateDiffDays(minDate, p.startDate);
    const length      = Math.max(1, dateDiffDays(p.startDate, p.dueDate) + 1);
    const left        = labelWidth + startOffset * dayWidth;
    const width       = length * dayWidth;
    const progress    = projectProgress(p);

    rowsHtml += `
      <div class="timeline-row">
        <span class="timeline-row-label">${escapeHtml(p.name)}</span>
        <div class="timeline-bar status-${p.status}"
             style="left:${left}px;width:${width}px"
             title="${escapeHtml(p.name)}: ${fmtDate(p.startDate)} → ${fmtDate(p.dueDate)} (${progress}%)">
          <div class="bar-progress" style="width:${progress}%"></div>
          <span style="position:relative;z-index:1">${escapeHtml(p.name)} · ${progress}%</span>
        </div>
      </div>`;
  });

  const todayOffset = dateDiffDays(minDate, todayISO());
  const todayHtml   = (todayOffset >= 0 && todayOffset < totalDays)
    ? `<div class="timeline-today-line" style="left:${labelWidth + todayOffset * dayWidth + dayWidth / 2}px"></div>`
    : "";

  $content.innerHTML = `
    <div class="timeline-wrap">
      <div class="timeline-header-row">
        <h2>Project Timeline</h2>
        <div class="timeline-legend">
          <span class="legend-item"><span class="legend-dot" style="background:var(--accent)"></span>Active</span>
          <span class="legend-item"><span class="legend-dot" style="background:var(--orange)"></span>On hold</span>
          <span class="legend-item"><span class="legend-dot" style="background:var(--green)"></span>Completed</span>
        </div>
      </div>
      <div class="timeline-scroll">
        <div class="timeline-grid" style="width:${labelWidth + totalDays * dayWidth}px">
          ${daysHtml}
          <div style="position:relative">${todayHtml}${rowsHtml}</div>
        </div>
      </div>
    </div>`;
}

/* ----------------------------- Bootstrap ---------------------------------- */

function setActiveViewBtn(view) {
  document.querySelectorAll(".view-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === view)
  );
}

async function load() {
  state.projects = (await window.api.getAllProjects()) || [];
  if (state.projects.length) state.selectedId = state.projects[0].id;
  render();
}

document.getElementById("newProjectBtn").addEventListener("click", newProject);

document.querySelectorAll(".view-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    state.view = btn.dataset.view;
    setActiveViewBtn(state.view);
    render();
  });
});

load();
