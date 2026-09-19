import { contextBridge, ipcRenderer } from 'electron';
import { Task, AppSettings, ChatMessage, AIResponsePayload } from './types';

contextBridge.exposeInMainWorld('api', {
  // Tasks
  getTasks: (): Promise<Task[]> => ipcRenderer.invoke('tasks:get'),
  addTask: (task: Partial<Task>): Promise<Task> => ipcRenderer.invoke('tasks:add', task),
  updateTask: (id: string, updates: Partial<Task>): Promise<Task | null> =>
    ipcRenderer.invoke('tasks:update', id, updates),
  deleteTask: (id: string): Promise<Task[]> => ipcRenderer.invoke('tasks:delete', id),
  clearCompletedTasks: (): Promise<Task[]> => ipcRenderer.invoke('tasks:clearCompleted'),

  // Settings & Work Schedule
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  updateSettings: (updates: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:update', updates),

  // AI & Chat
  sendAIChat: (
    messages: Array<{ role: string; content: string }>,
    currentDateStr: string,
    currentTimeStr: string
  ): Promise<AIResponsePayload> =>
    ipcRenderer.invoke('ai:chat', messages, currentDateStr, currentTimeStr),
  testAIConnection: (
    apiKey: string, 
    model?: string, 
    customBaseUrl?: string
  ): Promise<{ success: boolean; message: string; workingModel?: string; availableModels?: string[]; diagnosticLogs?: string[] }> =>
    ipcRenderer.invoke('ai:testConnection', apiKey, model, customBaseUrl),
  runDiagnostics: (
    apiKey: string,
    model: string,
    customBaseUrl?: string
  ): Promise<{ logs: string[]; modelsList: string[]; workingModel: string | null; rawError?: string }> =>
    ipcRenderer.invoke('ai:diagnostics', apiKey, model, customBaseUrl),

  // Chat History
  getChatHistory: (): Promise<ChatMessage[]> => ipcRenderer.invoke('chat:getHistory'),
  saveChatHistory: (history: ChatMessage[]): Promise<ChatMessage[]> =>
    ipcRenderer.invoke('chat:saveHistory', history),
  clearChatHistory: (): Promise<void> => ipcRenderer.invoke('chat:clear'),

  // External Links
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('app:openExternal', url),

  // Theme Sync
  setTheme: (theme: 'light' | 'dark'): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('app:setTheme', theme),

  // Realtime Desktop Notifications
  showNotification: (options: { title: string; body: string; silent?: boolean }): Promise<boolean> =>
    ipcRenderer.invoke('notification:show', options)
});

