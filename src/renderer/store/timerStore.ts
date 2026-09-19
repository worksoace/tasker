import { writable, derived, get } from 'svelte/store';
import type { Task } from '../../main/types';
import { 
  tasks, 
  todayTasks, 
  todayDate,
  checkDayRollover,
  getTodayDateString,
  updateExistingTask, 
  toggleTaskCompletion, 
  settings, 
  formatTimeFriendly 
} from './todoStore';
import { playTimerCompleteChime, playNotificationChime } from '../utils/sound';

export interface TimerState {
  activeTaskId: string | null;
  taskTitle: string;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  startedAt: number | null;
  endTimestamp: number | null;
}

const initialTimerState: TimerState = {
  activeTaskId: null,
  taskTitle: '',
  totalSeconds: 25 * 60,
  remainingSeconds: 25 * 60,
  isRunning: false,
  isPaused: false,
  isCompleted: false,
  startedAt: null,
  endTimestamp: null
};

export const timerState = writable<TimerState>(initialTimerState);

export const formattedTime = derived(timerState, ($s) => {
  const totalSec = Math.max(0, Math.floor($s.remainingSeconds));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
});

export const timerProgress = derived(timerState, ($s) => {
  if ($s.totalSeconds <= 0) return 0;
  const elapsed = $s.totalSeconds - $s.remainingSeconds;
  return Math.min(100, Math.max(0, Math.round((elapsed / $s.totalSeconds) * 100)));
});

let timerInterval: ReturnType<typeof setInterval> | null = null;

function clearTimerLoop() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function runTimerTick() {
  clearTimerLoop();
  timerInterval = setInterval(() => {
    timerState.update(s => {
      if (!s.isRunning || s.isPaused || !s.endTimestamp) {
        clearTimerLoop();
        return s;
      }

      const now = Date.now();
      const leftMs = s.endTimestamp - now;
      const leftSec = Math.max(0, Math.ceil(leftMs / 1000));

      if (leftSec <= 0) {
        clearTimerLoop();
        onTimerComplete(s);
        return {
          ...s,
          remainingSeconds: 0,
          isRunning: false,
          isPaused: false,
          isCompleted: true,
          endTimestamp: null
        };
      }

      return {
        ...s,
        remainingSeconds: leftSec
      };
    });
  }, 500);
}

async function onTimerComplete(state: TimerState) {
  const currentSettings = get(settings);
  if (currentSettings.soundEnabled) {
    playTimerCompleteChime();
  }

  const title = state.taskTitle ? `"${state.taskTitle}"` : 'Your focus session';
  try {
    await window.api.showNotification({
      title: "⏰ Time's Up! Focus Complete",
      body: `${title} is finished! Mark task as done or take a well-deserved break.`
    });
  } catch (e) {
    console.error('Failed to dispatch notification:', e);
  }
}

export async function startTaskTimer(task: Task, overrideSeconds?: number) {
  const totalSec = Math.max(60, (task.durationMinutes || 25) * 60);
  const remainingSec = overrideSeconds !== undefined ? Math.max(10, Math.min(overrideSeconds, totalSec)) : totalSec;
  const now = Date.now();

  timerState.set({
    activeTaskId: task.id,
    taskTitle: task.title,
    totalSeconds: totalSec,
    remainingSeconds: remainingSec,
    isRunning: true,
    isPaused: false,
    isCompleted: false,
    startedAt: now,
    endTimestamp: now + remainingSec * 1000
  });

  runTimerTick();

  const currentSettings = get(settings);
  if (currentSettings.soundEnabled) {
    playNotificationChime();
  }

  try {
    if (window.api && typeof window.api.showNotification === 'function') {
      await window.api.showNotification({
        title: "🎯 Focus Timer Started",
        body: `Focusing on "${task.title}" for ${task.durationMinutes || 25} minutes.`
      });
    }
  } catch (e) {
    console.warn('Failed to dispatch notification:', e);
  }
}

export async function startQuickTimer(minutes: number, label: string = 'Focus Session') {
  const durationSec = Math.max(60, minutes * 60);
  const now = Date.now();

  timerState.set({
    activeTaskId: null,
    taskTitle: label,
    totalSeconds: durationSec,
    remainingSeconds: durationSec,
    isRunning: true,
    isPaused: false,
    isCompleted: false,
    startedAt: now,
    endTimestamp: now + durationSec * 1000
  });

  runTimerTick();

  const currentSettings = get(settings);
  if (currentSettings.soundEnabled) {
    playNotificationChime();
  }

  try {
    if (window.api && typeof window.api.showNotification === 'function') {
      await window.api.showNotification({
        title: "🎯 Focus Timer Started",
        body: `${label} (${minutes}m) started.`
      });
    }
  } catch (e) {
    console.warn('Failed to dispatch notification:', e);
  }
}

export function togglePlayPause() {
  timerState.update(s => {
    if (!s.isRunning && !s.isPaused) return s;

    if (s.isRunning) {
      // Pause
      clearTimerLoop();
      return {
        ...s,
        isRunning: false,
        isPaused: true,
        endTimestamp: null
      };
    } else {
      // Resume
      const now = Date.now();
      const newEnd = now + s.remainingSeconds * 1000;
      setTimeout(() => runTimerTick(), 10);
      return {
        ...s,
        isRunning: true,
        isPaused: false,
        endTimestamp: newEnd
      };
    }
  });
}

export function addMinutes(mins: number) {
  timerState.update(s => {
    const extraSec = mins * 60;
    const newRemaining = s.remainingSeconds + extraSec;
    const newTotal = s.totalSeconds + extraSec;
    const newEnd = s.endTimestamp ? s.endTimestamp + extraSec * 1000 : null;

    return {
      ...s,
      totalSeconds: newTotal,
      remainingSeconds: newRemaining,
      endTimestamp: newEnd,
      isCompleted: false
    };
  });
}

export function resetTimer() {
  timerState.update(s => {
    clearTimerLoop();
    return {
      ...s,
      remainingSeconds: s.totalSeconds,
      isRunning: false,
      isPaused: false,
      isCompleted: false,
      endTimestamp: null
    };
  });
}

export function stopTimer() {
  clearTimerLoop();
  timerState.set(initialTimerState);
}

export async function completeCurrentTask() {
  const s = get(timerState);
  if (s.activeTaskId) {
    await toggleTaskCompletion(s.activeTaskId);
  }

  const currentSettings = get(settings);
  if (currentSettings.soundEnabled) {
    playTimerCompleteChime();
  }

  try {
    if (window.api && typeof window.api.showNotification === 'function') {
      await window.api.showNotification({
        title: "🎉 Task Completed!",
        body: `"${s.taskTitle}" marked as complete!`
      });
    }
  } catch (e) {
    console.warn('Failed to dispatch notification:', e);
  }

  stopTimer();
}

// -----------------------------------------------------------------
// Realtime Scheduled Tasks Notification Watcher
// Checks today's tasks and auto-starts timer when scheduled window is active
// -----------------------------------------------------------------
const notifiedTodaySet = new Set<string>();
let scheduleWatcherInterval: ReturnType<typeof setInterval> | null = null;

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

let lastCheckedDateStr = '';

export function initScheduleNotificationWatcher() {
  if (scheduleWatcherInterval) return;

  const checkSchedule = async () => {
    try {
      checkDayRollover();
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentMinutesTotal = currentHours * 60 + currentMinutes;
      const todayDateStr = get(todayDate) || getTodayDateString();

      // Clear notification cache on day change
      if (lastCheckedDateStr && lastCheckedDateStr !== todayDateStr) {
        notifiedTodaySet.clear();
      }
      lastCheckedDateStr = todayDateStr;

      const currentTasks = get(todayTasks);
      const currentSettings = get(settings);
      const shouldAutoStart = currentSettings.autoStartTimer ?? true;

      for (const task of currentTasks) {
        if (!task.completed && task.scheduledTime) {
          const startMin = parseTimeToMinutes(task.scheduledTime);
          const durationMin = task.durationMinutes || 30;
          const endMin = startMin + durationMin;

          // Active scheduled window (between start time and end time for today)
          const isWindowActive = currentMinutesTotal >= startMin && currentMinutesTotal < endMin;
          const isStartMinute = currentMinutesTotal === startMin;

          if (isWindowActive) {
            const notificationId = `${todayDateStr}_${task.id}_${task.scheduledTime}`;
            const currentTimer = get(timerState);

            // Auto-start if timer is idle (not running and not manually paused)
            if (shouldAutoStart && !currentTimer.isRunning && !currentTimer.isPaused) {
              const elapsedSec = (currentMinutesTotal - startMin) * 60 + now.getSeconds();
              const totalSec = durationMin * 60;
              const remainingSec = Math.max(10, totalSec - elapsedSec);

              await startTaskTimer(task, remainingSec);
            }

            // Send notification once when start minute is reached
            if (isStartMinute && !notifiedTodaySet.has(notificationId)) {
              notifiedTodaySet.add(notificationId);

              if (currentSettings.soundEnabled) {
                playNotificationChime();
              }

              const formattedTimeStr = formatTimeFriendly(task.scheduledTime, currentSettings.timeFormat);
              if (window.api && typeof window.api.showNotification === 'function') {
                await window.api.showNotification({
                  title: "⏱️ Focus Timer Running",
                  body: `"${task.title}" (${task.durationMinutes || 30}m) is scheduled for now (${formattedTimeStr}). Focus session is active!`
                });
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Schedule notification watcher error:', err);
    }
  };

  // Run immediate initial check, then poll every 2 seconds
  checkSchedule();
  scheduleWatcherInterval = setInterval(checkSchedule, 2000);
}
