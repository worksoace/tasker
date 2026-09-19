export type Priority = 'high' | 'medium' | 'low' | 'none';

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  notes?: string;
  priority: Priority;
  scheduledDate?: string; // YYYY-MM-DD format
  scheduledTime?: string; // HH:mm format (e.g. "09:30")
  durationMinutes?: number; // Estimated duration in minutes (e.g. 30)
  deadlineTime?: string; // HH:mm format
  category?: string; // e.g. "Work", "Personal", "Errands"
  tags?: string[];
  createdAt: number;
  completedAt?: number;
}

export interface WorkSchedule {
  workStartTime: string; // e.g. "09:00"
  workEndTime: string; // e.g. "17:00"
  workDays: number[]; // 0=Sun, 1=Mon, ..., 6=Sat (default: [1,2,3,4,5])
  lunchStartTime: string; // e.g. "12:00"
  lunchEndTime: string; // e.g. "13:00"
  bufferMinutes: number; // e.g. 10 minutes between tasks
  defaultTaskDuration: number; // e.g. 30 minutes
}

export interface AISettings {
  apiKey: string;
  model: string;
  customEndpoint?: string;
  autoSchedule: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  createdTasks?: Task[];
  updatedTasks?: Task[];
  deletedTaskIds?: string[];
  scheduleAdvice?: string;
}

export interface AppSettings {
  ai: AISettings;
  schedule: WorkSchedule;
  timeFormat: '12h' | '24h'; // Layman-friendly AM/PM vs 24h
  soundEnabled: boolean;
  autoStartTimer?: boolean; // Automatically start focus timer when scheduled task time arrives
}

export interface AIResponsePayload {
  reply: string;
  tasksToCreate?: Array<{
    title: string;
    priority?: Priority;
    durationMinutes?: number;
    scheduledTime?: string;
    scheduledDate?: string;
    notes?: string;
    category?: string;
  }>;
  tasksToUpdate?: Array<{
    id?: string;
    titleMatch?: string;
    completed?: boolean;
    scheduledTime?: string;
    durationMinutes?: number;
    priority?: Priority;
  }>;
  tasksToDelete?: Array<{
    id?: string;
    titleMatch?: string;
  }>;
  scheduleAdvice?: string;
}





