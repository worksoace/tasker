import { app, BrowserWindow, ipcMain, nativeImage, Tray, Menu, shell, Notification } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { TaskStore } from './store';
import { processAIChat, testNvidiaConnection, runAIDiagnostics } from './ai';
import { Task, AppSettings } from './types';

if (process.platform === 'win32') {
  app.setAppUserModelId(app.name || 'Tasker');
}

let mainWindow: BrowserWindow | null = null;
let isQuitting = false;

const isDev = !app.isPackaged;

function getAppIconPath(): string {
  const appPath = app.getAppPath();
  const possiblePaths = [
    path.join(appPath, 'public/appicon.png'),
    path.join(appPath, 'dist/renderer/appicon.png'),
    path.join(__dirname, '../../public/appicon.png'),
    path.join(__dirname, '../renderer/appicon.png'),
    path.join(__dirname, '../public/appicon.png'),
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return path.join(appPath, 'public/appicon.png');
}

function createMainWindow() {
  const iconPath = getAppIconPath();

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 850,
    minHeight: 580,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    titleBarStyle: 'hidden',
    titleBarOverlay: process.platform === 'win32' ? {
      color: '#ffffff', // Crisp Light Theme header
      symbolColor: '#475569', // Slate-600 controls
      height: 36
    } : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#ffffff',
    show: false
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const mainUrl = isDev 
    ? 'http://localhost:5174/'
    : `file://${path.join(__dirname, '../renderer/index.html')}`;

  mainWindow.loadURL(mainUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      // In normal desktop apps, allow window closing
      // or minimize to tray if needed
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function setupIpcHandlers() {
  // Tasks
  ipcMain.handle('tasks:get', () => TaskStore.getTasks());

  ipcMain.handle('tasks:add', (_event, taskData: Partial<Task>) => {
    const newTask: Task = {
      id: taskData.id || crypto.randomUUID(),
      title: taskData.title || 'Untitled Task',
      completed: false,
      notes: taskData.notes || '',
      priority: taskData.priority || 'none',
      scheduledDate: taskData.scheduledDate || getLocalDateString(),
      scheduledTime: taskData.scheduledTime || undefined,
      durationMinutes: taskData.durationMinutes || 30,
      deadlineTime: taskData.deadlineTime || undefined,
      category: taskData.category || 'Work',
      tags: taskData.tags || [],
      createdAt: Date.now()
    };
    return TaskStore.addTask(newTask);
  });

  ipcMain.handle('tasks:update', (_event, id: string, updates: Partial<Task>) => {
    return TaskStore.updateTask(id, updates);
  });

  ipcMain.handle('tasks:delete', (_event, id: string) => {
    return TaskStore.deleteTask(id);
  });

  ipcMain.handle('tasks:clearCompleted', () => {
    return TaskStore.clearCompletedTasks();
  });

  // Settings
  ipcMain.handle('settings:get', () => TaskStore.getSettings());

  ipcMain.handle('settings:update', (_event, updates: Partial<AppSettings>) => {
    return TaskStore.updateSettings(updates);
  });

  // AI Chat & Testing
  ipcMain.handle('ai:testConnection', async (_event, apiKey: string, model?: string, customBaseUrl?: string) => {
    return await testNvidiaConnection(apiKey, model, customBaseUrl);
  });

  ipcMain.handle('ai:diagnostics', async (_event, apiKey: string, model: string, customBaseUrl?: string) => {
    return await runAIDiagnostics(apiKey, model, customBaseUrl);
  });

  ipcMain.handle('ai:chat', async (_event, messages: Array<{ role: string; content: string }>, currentDateStr: string, currentTimeStr: string) => {
    const settings = TaskStore.getSettings();
    const existingTasks = TaskStore.getTasks();

    return await processAIChat({
      apiKey: settings.ai.apiKey,
      model: settings.ai.model,
      messages,
      schedule: settings.schedule,
      existingTasks,
      currentDateStr,
      currentTimeStr,
      customBaseUrl: settings.ai.customEndpoint
    });
  });

  // Chat History
  ipcMain.handle('chat:getHistory', () => TaskStore.getChatHistory());

  ipcMain.handle('chat:saveHistory', (_event, history) => TaskStore.saveChatHistory(history));

  ipcMain.handle('chat:clear', () => TaskStore.clearChatHistory());

  // External Links
  ipcMain.handle('app:openExternal', (_event, url: string) => {
    if (url && (url.startsWith('https:') || url.startsWith('http:'))) {
      shell.openExternal(url);
    }
  });

  // Realtime Desktop Notifications
  ipcMain.handle('notification:show', (_event, options: { title: string; body: string; silent?: boolean }) => {
    try {
      if (Notification.isSupported()) {
        const iconPath = getAppIconPath();
        const notif = new Notification({
          title: options.title || 'Tasker',
          body: options.body || '',
          icon: fs.existsSync(iconPath) ? iconPath : undefined,
          silent: options.silent ?? false
        });
        notif.on('click', () => {
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
          }
        });
        notif.show();
        return true;
      }
    } catch (err) {
      console.error('Failed to show desktop notification:', err);
    }
    return false;
  });

  // Theme Sync for TitleBarOverlay
  ipcMain.handle('app:setTheme', (_event, theme: 'light' | 'dark') => {
    if (mainWindow && process.platform === 'win32') {
      try {
        if (theme === 'dark') {
          mainWindow.setTitleBarOverlay({
            color: '#202020',
            symbolColor: '#cbd5e1',
            height: 36
          });
        } else {
          mainWindow.setTitleBarOverlay({
            color: '#ffffff',
            symbolColor: '#475569',
            height: 36
          });
        }
      } catch (err) {
        console.error('Failed to update titleBarOverlay:', err);
      }
    }
    return { success: true };
  });
}

app.whenReady().then(() => {
  setupIpcHandlers();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    } else {
      mainWindow?.show();
      mainWindow?.focus();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
});

