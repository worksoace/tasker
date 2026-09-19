import { writable, derived, get } from 'svelte/store';
import type { Task, AppSettings, ChatMessage, Priority } from '../../main/types';

export const tasks = writable<Task[]>([]);
export const settings = writable<AppSettings>({
  ai: {
    apiKey: '',
    model: 'meta/llama-3.3-70b-instruct',
    autoSchedule: true
  },
  schedule: {
    workStartTime: '09:00',
    workEndTime: '17:00',
    workDays: [1, 2, 3, 4, 5],
    lunchStartTime: '12:00',
    lunchEndTime: '13:00',
    bufferMinutes: 10,
    defaultTaskDuration: 30
  },
  timeFormat: '12h',
  soundEnabled: true
});

export const chatMessages = writable<ChatMessage[]>([]);
export const isAILoading = writable<boolean>(false);
export const aiError = writable<string | null>(null);
export const activeTab = writable<'all' | 'today' | 'completed'>('today');

// Utility to get today's date in YYYY-MM-DD (local time)
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getLocalDateStringFromTimestamp(ts: number): string {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Reactive store for the current calendar day
export const todayDate = writable<string>(getTodayDateString());

// Currently selected date for schedule view (defaults to today)
export const selectedDate = writable<string>(getTodayDateString());

// Automatically check and roll over date when midnight / day change occurs
export function checkDayRollover() {
  const newToday = getTodayDateString();
  const currentToday = get(todayDate);
  if (newToday !== currentToday) {
    const currentSelected = get(selectedDate);
    todayDate.set(newToday);
    // If the view was tracking previous today, roll forward to new today
    if (currentSelected === currentToday) {
      selectedDate.set(newToday);
    }
  }
}

// Shift selected date forward or backward by N days
export function shiftSelectedDate(deltaDays: number) {
  selectedDate.update(curr => {
    const [y, m, d] = curr.split('-').map(Number);
    const dateObj = new Date(y, (m || 1) - 1, (d || 1) + deltaDays);
    const yr = dateObj.getFullYear();
    const mo = String(dateObj.getMonth() + 1).padStart(2, '0');
    const da = String(dateObj.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${da}`;
  });
}

export function setSelectedDate(dateStr: string) {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    selectedDate.set(dateStr);
  }
}

export function goToToday() {
  checkDayRollover();
  selectedDate.set(get(todayDate));
}

export function goToTomorrow() {
  checkDayRollover();
  const [y, m, d] = get(todayDate).split('-').map(Number);
  const tomorrow = new Date(y, (m || 1) - 1, (d || 1) + 1);
  const yr = tomorrow.getFullYear();
  const mo = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const da = String(tomorrow.getDate()).padStart(2, '0');
  selectedDate.set(`${yr}-${mo}-${da}`);
}

export function formatDateFriendly(dateStr?: string, refToday?: string): string {
  if (!dateStr) return '';
  const today = refToday || get(todayDate) || getTodayDateString();
  const [ty, tm, td] = today.split('-').map(Number);
  const tomorrowObj = new Date(ty, (tm || 1) - 1, (td || 1) + 1);
  const tomorrowStr = `${tomorrowObj.getFullYear()}-${String(tomorrowObj.getMonth() + 1).padStart(2, '0')}-${String(tomorrowObj.getDate()).padStart(2, '0')}`;
  const yesterdayObj = new Date(ty, (tm || 1) - 1, (td || 1) - 1);
  const yesterdayStr = `${yesterdayObj.getFullYear()}-${String(yesterdayObj.getMonth() + 1).padStart(2, '0')}-${String(yesterdayObj.getDate()).padStart(2, '0')}`;

  if (dateStr === today) return 'Today';
  if (dateStr === tomorrowStr) return 'Tomorrow';
  if (dateStr === yesterdayStr) return 'Yesterday';

  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Format 24h "HH:mm" to 12h "h:mm AM/PM"
export function formatTimeFriendly(time24?: string, format: '12h' | '24h' = '12h'): string {
  if (!time24) return '';
  if (format === '24h') return time24;

  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr || '00';
  if (isNaN(h)) return time24;

  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  return `${displayH}:${m} ${period}`;
}

// Calculate end time string given start time and duration
export function calculateEndTime(startTime?: string, durationMinutes: number = 30): string {
  if (!startTime) return '';
  const [hStr, mStr] = startTime.split(':');
  let totalMinutes = parseInt(hStr, 10) * 60 + parseInt(mStr, 10) + durationMinutes;
  const endH = Math.floor(totalMinutes / 60) % 24;
  const endM = totalMinutes % 60;
  return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
}

// Derived store for tasks belonging to the currently selectedDate
export const selectedDateTasks = derived([tasks, selectedDate, todayDate], ([$tasks, $selectedDate, $todayDate]) => {
  return $tasks
    .filter(t => {
      const taskDate = t.scheduledDate || (t.createdAt ? getLocalDateStringFromTimestamp(t.createdAt) : $todayDate);
      return taskDate === $selectedDate;
    })
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.scheduledTime && b.scheduledTime) {
        return a.scheduledTime.localeCompare(b.scheduledTime);
      }
      if (a.scheduledTime) return -1;
      if (b.scheduledTime) return 1;
      return b.createdAt - a.createdAt;
    });
});

// Derived store for today's tasks (maintained for notifications and quick reference)
export const todayTasks = derived([tasks, todayDate], ([$tasks, $todayDate]) => {
  return $tasks
    .filter(t => {
      const taskDate = t.scheduledDate || (t.createdAt ? getLocalDateStringFromTimestamp(t.createdAt) : $todayDate);
      return taskDate === $todayDate;
    })
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.scheduledTime && b.scheduledTime) {
        return a.scheduledTime.localeCompare(b.scheduledTime);
      }
      if (a.scheduledTime) return -1;
      if (b.scheduledTime) return 1;
      return b.createdAt - a.createdAt;
    });
});

// Stats: calculated dynamically for the selected date's schedule
export const scheduleStats = derived([selectedDateTasks, settings], ([$selectedDateTasks, $settings]) => {
  const total = $selectedDateTasks.length;
  const completed = $selectedDateTasks.filter(t => t.completed).length;
  const totalMinutes = $selectedDateTasks.reduce((acc, t) => acc + (t.durationMinutes || 30), 0);
  const completedMinutes = $selectedDateTasks
    .filter(t => t.completed)
    .reduce((acc, t) => acc + (t.durationMinutes || 30), 0);
  const remainingMinutes = totalMinutes - completedMinutes;

  return {
    total,
    completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
    totalMinutes,
    remainingMinutes
  };
});

// Initialize stores from Electron store
export async function initStore() {
  if (typeof window === 'undefined' || !window.api) return;

  try {
    // Always strictly reset to current local today on app start / restart
    const currentToday = getTodayDateString();
    todayDate.set(currentToday);
    selectedDate.set(currentToday);
    activeTab.set('today');

    const loadedSettings = await window.api.getSettings();
    settings.set(loadedSettings);

    const loadedTasks = await window.api.getTasks();
    
    // Normalize tasks and ensure explicit scheduledDate
    let hasUpdates = false;
    const normalizedTasks: Task[] = (loadedTasks || []).map(t => {
      if (!t.scheduledDate) {
        hasUpdates = true;
        const fallbackDate = t.createdAt ? getLocalDateStringFromTimestamp(t.createdAt) : currentToday;
        return { ...t, scheduledDate: fallbackDate };
      }
      return t;
    });

    tasks.set(normalizedTasks);

    // Save normalized tasks back if any were missing scheduledDate
    if (hasUpdates) {
      for (const t of normalizedTasks) {
        if (!loadedTasks?.find(lt => lt.id === t.id)?.scheduledDate) {
          await window.api.updateTask(t.id, { scheduledDate: t.scheduledDate });
        }
      }
    }

    const loadedChat = await window.api.getChatHistory();
    if (loadedChat && loadedChat.length > 0) {
      chatMessages.set(loadedChat);
    } else {
      // Friendly initial greeting
      const welcomeMessage: ChatMessage = {
        id: 'welcome',
        role: 'assistant',
        content: "Hi there! 👋 I'm Tasker, your smart schedule assistant. Tell me what you'd like to accomplish today (e.g., 'I need to write a proposal for 45m and call Sarah at 2pm'), and I'll organize your day around your work hours!",
        timestamp: Date.now()
      };
      chatMessages.set([welcomeMessage]);
    }
  } catch (err) {
    console.error('Failed to init store:', err);
  }
}

// Tasks CRUD
export async function addNewTask(taskData: Partial<Task>): Promise<Task> {
  const newTask = await window.api.addTask(taskData);
  tasks.update(current => [newTask, ...current.filter(t => t.id !== newTask.id)]);
  return newTask;
}

export async function toggleTaskCompletion(id: string) {
  const currentList = get(tasks);
  const target = currentList.find(t => t.id === id);
  if (!target) return;

  const nextState = !target.completed;
  const updated = await window.api.updateTask(id, { completed: nextState });
  if (updated) {
    tasks.update(list => list.map(t => t.id === id ? updated : t));
  }
}

export async function updateExistingTask(id: string, updates: Partial<Task>) {
  const updated = await window.api.updateTask(id, updates);
  if (updated) {
    tasks.update(list => list.map(t => t.id === id ? updated : t));
  }
}

export async function removeTask(id: string) {
  const updatedList = await window.api.deleteTask(id);
  tasks.set(updatedList || []);
}

export async function clearAllCompleted() {
  const remaining = await window.api.clearCompletedTasks();
  tasks.set(remaining || []);
}

// Settings management
export async function saveSettings(updates: Partial<AppSettings>) {
  const newSettings = await window.api.updateSettings(updates);
  settings.set(newSettings);
  return newSettings;
}

// AI Chat Communication
export async function sendUserMessage(text: string) {
  if (!text.trim()) return;

  aiError.set(null);
  const userMsg: ChatMessage = {
    id: `user-${Date.now()}`,
    role: 'user',
    content: text.trim(),
    timestamp: Date.now()
  };

  // Add user message immediately
  chatMessages.update(history => [...history, userMsg]);
  isAILoading.set(true);

  try {
    const currentHistory = get(chatMessages).map(m => ({
      role: m.role,
      content: m.content
    }));

    const now = new Date();
    const currentDateStr = getTodayDateString();
    const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const aiResponse = await window.api.sendAIChat(
      currentHistory,
      currentDateStr,
      currentTimeStr
    );

    const createdTasksList: Task[] = [];
    const updatedTasksList: Task[] = [];
    const initialTasks = get(tasks);

    // Automatically create or update tasks identified by AI
    if (aiResponse.tasksToCreate && aiResponse.tasksToCreate.length > 0) {
      for (const t of aiResponse.tasksToCreate) {
        // If an uncompleted task already exists with same title, update its time instead of creating duplicate
        const existing = initialTasks.find(et => 
          !et.completed && (
            et.title.toLowerCase().trim() === t.title.toLowerCase().trim() ||
            (et.title.length >= 8 && t.title.length >= 8 && (
              et.title.toLowerCase().includes(t.title.toLowerCase()) ||
              t.title.toLowerCase().includes(et.title.toLowerCase())
            ))
          )
        );

        if (existing && t.scheduledTime) {
          const updated = await window.api.updateTask(existing.id, {
            scheduledTime: t.scheduledTime,
            scheduledDate: t.scheduledDate || existing.scheduledDate || currentDateStr,
            durationMinutes: t.durationMinutes || existing.durationMinutes,
            priority: t.priority || existing.priority
          });
          if (updated) updatedTasksList.push(updated);
        } else {
          const created = await window.api.addTask({
            title: t.title,
            priority: t.priority || 'none',
            durationMinutes: t.durationMinutes || 30,
            scheduledTime: t.scheduledTime,
            scheduledDate: t.scheduledDate || currentDateStr,
            notes: t.notes
          });
          createdTasksList.push(created);
        }
      }
    }

    // Automatically update tasks if requested (e.g., mark completed, reschedule, or change duration)
    if (aiResponse.tasksToUpdate && aiResponse.tasksToUpdate.length > 0) {
      const allTasks = await window.api.getTasks();
      for (const u of aiResponse.tasksToUpdate) {
        let targetId = u.id;
        const matchTitle = (u as any).title || u.titleMatch;
        if (!targetId && matchTitle) {
          const match = allTasks.find(t => 
            t.title.toLowerCase().includes(matchTitle.toLowerCase()) ||
            matchTitle.toLowerCase().includes(t.title.toLowerCase())
          );
          if (match) targetId = match.id;
        }

        if (targetId) {
          const updated = await window.api.updateTask(targetId, {
            ...(u.completed !== undefined ? { completed: u.completed } : {}),
            ...(u.scheduledTime ? { scheduledTime: u.scheduledTime } : {}),
            ...(u.scheduledDate ? { scheduledDate: u.scheduledDate } : {}),
            ...(u.durationMinutes ? { durationMinutes: Number(u.durationMinutes) } : {}),
            ...(u.priority ? { priority: u.priority } : {})
          });
          if (updated) updatedTasksList.push(updated);
        }
      }
    }

    // Heuristic Fallback: If AI confirmed duration in text or user asked to change duration,
    // but the AI missed putting it into tasksToUpdate, enforce the duration update directly!
    try {
      const allTasks = await window.api.getTasks();
      const combinedText = `${text} \n ${aiResponse.reply || ''}`;
      
      const durationPatterns = [
        /(?:for (?:the )?task )?['"]?([a-zA-Z0-9 _-]+?)['"]? (?:change (?:the )?duration(?:n)? to|set duration to|make it) (\d+(?:\.\d+)?)\s*(hrs?|hours?|h|mins?|minutes?|m)/i,
        /(?:change|set) (?:the )?duration (?:of )?['"]?([a-zA-Z0-9 _-]+?)['"]? to (\d+(?:\.\d+)?)\s*(hrs?|hours?|h|mins?|minutes?|m)/i,
        /(?:Your|The) ["']([^"']+)["'] task now runs for (\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)/i
      ];

      for (const pattern of durationPatterns) {
        const match = combinedText.match(pattern);
        if (match) {
          const taskName = match[1].trim();
          const num = parseFloat(match[2]);
          const unit = match[3].toLowerCase();
          const targetMinutes = unit.startsWith('h') ? Math.round(num * 60) : Math.round(num);

          const matchedTask = allTasks.find(t => 
            !t.completed && (
              t.title.toLowerCase() === taskName.toLowerCase() ||
              t.title.toLowerCase().includes(taskName.toLowerCase()) ||
              taskName.toLowerCase().includes(t.title.toLowerCase())
            )
          );

          if (matchedTask && matchedTask.durationMinutes !== targetMinutes) {
            const updated = await window.api.updateTask(matchedTask.id, { durationMinutes: targetMinutes });
            if (updated && !updatedTasksList.some(u => u.id === updated.id)) {
              updatedTasksList.push(updated);
            }
          }
          break;
        }
      }
    } catch (fallbackErr) {
      console.warn('Duration fallback parser warning:', fallbackErr);
    }

    // Automatically delete tasks if requested by AI
    if (aiResponse.tasksToDelete && aiResponse.tasksToDelete.length > 0) {
      const allTasks = await window.api.getTasks();
      for (const d of aiResponse.tasksToDelete) {
        let delId = d.id;
        if (!delId && d.titleMatch) {
          const m = allTasks.find(t => t.title.toLowerCase().includes(d.titleMatch!.toLowerCase()));
          if (m) delId = m.id;
        }
        if (delId) {
          await window.api.deleteTask(delId);
        }
      }
    }

    // Refresh task list
    const refreshed = await window.api.getTasks();
    tasks.set(refreshed);

    // If AI created or rescheduled tasks for a specific date (e.g., tomorrow), auto-switch selectedDate
    const targetDate = createdTasksList[0]?.scheduledDate || updatedTasksList[0]?.scheduledDate;
    if (targetDate && targetDate !== get(selectedDate)) {
      selectedDate.set(targetDate);
    }

    // Add assistant response to chat
    const assistantMsg: ChatMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: aiResponse.reply || "I've organized your schedule for today!",
      timestamp: Date.now(),
      createdTasks: createdTasksList.length > 0 ? createdTasksList : undefined,
      updatedTasks: updatedTasksList.length > 0 ? updatedTasksList : undefined,
      scheduleAdvice: aiResponse.scheduleAdvice
    };

    chatMessages.update(history => {
      const newHistory = [...history, assistantMsg];
      window.api.saveChatHistory(newHistory);
      return newHistory;
    });

  } catch (err: any) {
    console.error('AI Error:', err);
    let cleanMsg = err.message || 'Could not connect to AI.';
    cleanMsg = cleanMsg.replace(/^Error invoking remote method '[^']+':\s*/i, '');
    cleanMsg = cleanMsg.replace(/^Error:\s*/i, '');

    aiError.set(cleanMsg);
    
    // Add friendly feedback message
    const errorMsg: ChatMessage = {
      id: `err-${Date.now()}`,
      role: 'assistant',
      content: `⚠️ ${cleanMsg}\n\nTip: You can change the AI model or test your API key anytime in Settings.`,
      timestamp: Date.now()
    };
    chatMessages.update(history => [...history, errorMsg]);
  } finally {
    isAILoading.set(false);
  }
}

export async function resetConversation() {
  await window.api.clearChatHistory();
  const welcomeMessage: ChatMessage = {
    id: 'welcome-new',
    role: 'assistant',
    content: "Ready for a fresh start! Tell me what you'd like to work on today, and I'll schedule it for you.",
    timestamp: Date.now()
  };
  chatMessages.set([welcomeMessage]);
  await window.api.saveChatHistory([welcomeMessage]);
  goToToday();
  activeTab.set('today');
}
