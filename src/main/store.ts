import Store from 'electron-store';
import { Task, AppSettings, ChatMessage } from './types';

const defaultSettings: AppSettings = {
  ai: {
    apiKey: '',
    model: 'meta/llama-3.2-3b-instruct',
    autoSchedule: true
  },
  schedule: {
    workStartTime: '09:00',
    workEndTime: '17:00',
    workDays: [1, 2, 3, 4, 5], // Monday - Friday
    lunchStartTime: '12:00',
    lunchEndTime: '13:00',
    bufferMinutes: 10,
    defaultTaskDuration: 30
  },
  timeFormat: '12h',
  soundEnabled: true,
  autoStartTimer: true
};

const store = new Store({
  defaults: {
    tasks: [] as Task[],
    chatHistory: [] as ChatMessage[],
    settings: defaultSettings
  }
});

export const TaskStore = {
  getTasks(): Task[] {
    return (store.get('tasks') as Task[]) || [];
  },
  saveTasks(tasks: Task[]): Task[] {
    store.set('tasks', tasks);
    return tasks;
  },
  addTask(task: Task): Task {
    const tasks = this.getTasks();
    const existingIndex = tasks.findIndex(t => t.id === task.id);
    if (existingIndex >= 0) {
      tasks[existingIndex] = task;
    } else {
      tasks.push(task);
    }
    // Sort tasks by scheduled time or createdAt
    this.saveTasks(tasks);
    return task;
  },
  updateTask(id: string, updates: Partial<Task>): Task | null {
    const tasks = this.getTasks();
    const index = tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      tasks[index] = {
        ...tasks[index],
        ...updates,
        ...(updates.completed === true && !tasks[index].completed ? { completedAt: Date.now() } : {})
      };
      this.saveTasks(tasks);
      return tasks[index];
    }
    return null;
  },
  deleteTask(id: string): Task[] {
    const tasks = this.getTasks();
    const filtered = tasks.filter(t => t.id !== id);
    this.saveTasks(filtered);
    return filtered;
  },
  clearCompletedTasks(): Task[] {
    const tasks = this.getTasks();
    const filtered = tasks.filter(t => !t.completed);
    this.saveTasks(filtered);
    return filtered;
  },
  getSettings(): AppSettings {
    const saved = (store.get('settings') as Partial<AppSettings>) || {};
    return {
      ...defaultSettings,
      ...saved,
      ai: { ...defaultSettings.ai, ...(saved.ai || {}) },
      schedule: { ...defaultSettings.schedule, ...(saved.schedule || {}) }
    };
  },
  updateSettings(updates: Partial<AppSettings>): AppSettings {
    const current = this.getSettings();
    const merged: AppSettings = {
      ...current,
      ...updates,
      ai: { ...current.ai, ...(updates.ai || {}) },
      schedule: { ...current.schedule, ...(updates.schedule || {}) }
    };
    store.set('settings', merged);
    return merged;
  },
  getChatHistory(): ChatMessage[] {
    return (store.get('chatHistory') as ChatMessage[]) || [];
  },
  saveChatHistory(history: ChatMessage[]): ChatMessage[] {
    // Keep last 100 messages max
    const trimmed = history.slice(-100);
    store.set('chatHistory', trimmed);
    return trimmed;
  },
  addChatMessage(msg: ChatMessage): ChatMessage {
    const history = this.getChatHistory();
    history.push(msg);
    this.saveChatHistory(history);
    return msg;
  },
  clearChatHistory(): void {
    store.set('chatHistory', []);
  }
};


