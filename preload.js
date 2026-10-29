const { contextBridge, ipcRenderer } = require('electron');

// Secure bridge: expose only the named API methods the renderer needs.
contextBridge.exposeInMainWorld('api', {
  // Projects
  getAllProjects: ()    => ipcRenderer.invoke('projects:getAll'),
  createProject: (p)   => ipcRenderer.invoke('projects:create', p),
  updateProject: (p)   => ipcRenderer.invoke('projects:update', p),
  deleteProject: (id)  => ipcRenderer.invoke('projects:delete', id),

  // Tasks
  createTask: (t)              => ipcRenderer.invoke('tasks:create', t),
  toggleTask: (id, done)       => ipcRenderer.invoke('tasks:toggle', { id, done }),
  deleteTask: (id)             => ipcRenderer.invoke('tasks:delete', id),
});
