import { Task, AppSettings, ChatMessage, AIResponsePayload } from '../main/types';

declare global {
  interface Window {
    api: {
      getTasks(): Promise<Task[]>;
      addTask(task: Partial<Task>): Promise<Task>;
      updateTask(id: string, updates: Partial<Task>): Promise<Task | null>;
      deleteTask(id: string): Promise<Task[]>;
      clearCompletedTasks(): Promise<Task[]>;
      getSettings(): Promise<AppSettings>;
      updateSettings(updates: Partial<AppSettings>): Promise<AppSettings>;
      sendAIChat(
        messages: Array<{ role: string; content: string }>,
        currentDateStr: string,
        currentTimeStr: string
      ): Promise<AIResponsePayload>;
      testAIConnection(
        apiKey: string, 
        model?: string, 
        customBaseUrl?: string
      ): Promise<{ success: boolean; message: string; workingModel?: string; availableModels?: string[]; diagnosticLogs?: string[] }>;
      runDiagnostics(
        apiKey: string,
        model: string,
        customBaseUrl?: string
      ): Promise<{ logs: string[]; modelsList: string[]; workingModel: string | null; rawError?: string }>;
      getChatHistory(): Promise<ChatMessage[]>;
      saveChatHistory(history: ChatMessage[]): Promise<ChatMessage[]>;
      clearChatHistory(): Promise<void>;
      openExternal(url: string): Promise<void>;
      setTheme(theme: 'light' | 'dark'): Promise<{ success: boolean }>;
      showNotification(options: { title: string; body: string; silent?: boolean }): Promise<boolean>;
    };
  }
}

export {};

