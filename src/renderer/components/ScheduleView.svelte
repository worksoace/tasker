<script lang="ts">
  import { 
    tasks,
    todayTasks,
    todayDate,
    selectedDateTasks,
    selectedDate,
    shiftSelectedDate,
    goToToday,
    goToTomorrow,
    setSelectedDate,
    formatDateFriendly,
    getTodayDateString,
    activeTab,
    scheduleStats, 
    settings, 
    toggleTaskCompletion, 
    addNewTask, 
    removeTask, 
    updateExistingTask,
    clearAllCompleted,
    formatTimeFriendly
  } from '../store/todoStore';
  import type { Priority, Task } from '../../main/types';

  import FocusTimerWidget from './FocusTimerWidget.svelte';
  import { timerState, formattedTime, startTaskTimer } from '../store/timerStore';

  let newTaskTitle = '';
  let newTaskDuration = 30;
  let newTaskPriority: Priority = 'none';
  let newTaskTime = '';
  let newTaskDate = '';
  let showAdvancedAdd = false;

  let editingTaskId: string | null = null;
  let editingTaskTitle = '';

  function formatDurationDisplay(mins?: number): string {
    const m = mins || 30;
    if (m >= 60) {
      const h = Math.floor(m / 60);
      const rem = m % 60;
      return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
    }
    return `${m}m`;
  }

  $: isViewingToday = $selectedDate === $todayDate;

  $: visibleTasks = (() => {
    if ($activeTab === 'completed') {
      return $tasks.filter(t => t.completed);
    }
    if ($activeTab === 'all') {
      return [...$tasks].sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        const dateA = a.scheduledDate || '9999';
        const dateB = b.scheduledDate || '9999';
        if (dateA !== dateB) return dateA.localeCompare(dateB);
        return (a.scheduledTime || '').localeCompare(b.scheduledTime || '');
      });
    }
    return $selectedDateTasks;
  })();

  $: nextUpcoming = $selectedDateTasks.find(t => !t.completed && t.scheduledTime);

  async function handleCreateTask() {
    if (!newTaskTitle.trim()) return;
    
    await addNewTask({
      title: newTaskTitle.trim(),
      durationMinutes: newTaskDuration,
      priority: newTaskPriority,
      scheduledTime: newTaskTime || undefined,
      scheduledDate: newTaskDate || $selectedDate
    });

    newTaskTitle = '';
    newTaskTime = '';
    newTaskDate = '';
    showAdvancedAdd = false;
  }

  function startEdit(task: Task) {
    editingTaskId = task.id;
    editingTaskTitle = task.title;
  }

  async function saveEdit(id: string) {
    if (editingTaskTitle.trim()) {
      await updateExistingTask(id, { title: editingTaskTitle.trim() });
    }
    editingTaskId = null;
  }
</script>

<div class="h-full flex flex-col bg-slate-50 dark:bg-[#292929] overflow-hidden select-none transition-colors">
  
  <!-- Scrollable Schedule Body (Header unified in top bar) -->
  <div class="flex-1 overflow-y-auto p-5 space-y-4">
    
    <!-- Date Navigation Header (Day Switcher) -->
    <div class="flex items-center justify-between bg-white dark:bg-[#202020] rounded-xl px-3 py-2 border border-slate-200/90 dark:border-[#383838] shadow-2xs transition-colors">
      <div class="flex items-center space-x-1.5">
        <button
          type="button"
          on:click={() => shiftSelectedDate(-1)}
          class="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#2c2c2c] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors cursor-pointer"
          title="Previous Day"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div class="flex items-center space-x-2 px-1">
          <span class="text-xs font-bold text-slate-800 dark:text-slate-100">
            {formatDateFriendly($selectedDate)}
          </span>
          <span class="text-[11px] text-slate-400 dark:text-slate-500 font-medium hidden sm:inline">
            ({$selectedDate})
          </span>
        </div>

        <button
          type="button"
          on:click={() => shiftSelectedDate(1)}
          class="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#2c2c2c] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors cursor-pointer"
          title="Next Day"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <!-- Quick Day Presets & Date Input -->
      <div class="flex items-center space-x-1.5">
        <button
          type="button"
          on:click={goToToday}
          class="px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer {$selectedDate === $todayDate ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/40' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2c2c2c]'}"
        >
          Today
        </button>

        <button
          type="button"
          on:click={goToTomorrow}
          class="px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer {formatDateFriendly($selectedDate) === 'Tomorrow' ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/40' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2c2c2c]'}"
        >
          Tomorrow
        </button>

        <input 
          type="date"
          value={$selectedDate}
          on:change={(e) => setSelectedDate(e.currentTarget.value)}
          class="w-7 h-7 p-1 rounded-lg bg-slate-100 dark:bg-[#2c2c2c] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-[#383838] cursor-pointer hover:border-blue-400 focus:outline-none text-[11px]"
          title="Pick custom date"
        />
      </div>
    </div>

    <!-- Active Focus Timer Widget (Displays when timer is active) -->
    <FocusTimerWidget />

    <!-- Day Summary Progress Card -->
    <div class="bg-white dark:bg-[#202020] rounded-2xl p-5 border border-slate-200/90 dark:border-[#383838] shadow-sm transition-colors">
      <!-- Header Row: Title & Badges -->
      <div class="flex items-start justify-between gap-3 mb-3">
        <div class="space-y-0.5">
          <div class="flex items-center gap-2">
            <h2 class="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              {isViewingToday ? "Today's Progress" : `${formatDateFriendly($selectedDate)}'s Schedule`}
            </h2>
            {#if $scheduleStats.total > 0 && $scheduleStats.completed === $scheduleStats.total}
              <span class="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                All caught up! 🎉
              </span>
            {/if}
          </div>
          <p class="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
            <span class="text-slate-800 dark:text-slate-200 font-semibold">{$scheduleStats.completed} of {$scheduleStats.total} tasks completed</span>
            {#if $scheduleStats.completed > 0 && $scheduleStats.remainingMinutes > 0}
              <span class="text-slate-300 dark:text-slate-600">·</span>
              <span>{Math.floor($scheduleStats.remainingMinutes / 60)}h {$scheduleStats.remainingMinutes % 60}m remaining</span>
            {/if}
          </p>
        </div>

        <!-- Right: Progress Metric Pill -->
        <div class="flex items-center gap-2 shrink-0">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/40 text-blue-600 dark:text-blue-400 text-xs font-bold tracking-tight shadow-2xs">
            <span class="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse"></span>
            <span>{$scheduleStats.percent}%</span>
          </div>
        </div>
      </div>

      <!-- Progress Bar (Clean Solid) -->
      <div class="w-full h-2 bg-slate-100 dark:bg-[#2c2c2c] rounded-full overflow-hidden my-3">
        <div 
          class="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-500 ease-out"
          style="width: {$scheduleStats.percent}%"
        ></div>
      </div>

      <!-- Useful Non-Duplicated Bottom Stats -->
      <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pt-2.5 border-t border-slate-100 dark:border-[#2c2c2c]">
        <div class="flex items-center space-x-2 shrink-0">
          <span class="w-2 h-2 rounded-full bg-blue-500 shrink-0"></span>
          <span>Total Planned: <strong class="text-slate-700 dark:text-slate-200 font-semibold">{Math.floor($scheduleStats.totalMinutes / 60)}h {$scheduleStats.totalMinutes % 60}m</strong></span>
        </div>
        <div class="flex items-center space-x-2 truncate max-w-[280px]">
          {#if nextUpcoming}
            <span class="w-2 h-2 rounded-full bg-amber-400 shrink-0"></span>
            <span class="truncate">Next: <strong class="text-slate-700 dark:text-slate-200 font-semibold">{nextUpcoming.title}</strong> at {formatTimeFriendly(nextUpcoming.scheduledTime, $settings.timeFormat)}</span>
          {:else if $scheduleStats.total > 0 && $scheduleStats.completed === $scheduleStats.total}
            <span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
            <span class="text-emerald-600 dark:text-emerald-400 font-medium">Day complete!</span>
          {:else}
            <span class="w-2 h-2 rounded-full bg-slate-300 dark:bg-[#555555] shrink-0"></span>
            <span>No upcoming task</span>
          {/if}
        </div>
      </div>
    </div>

    <!-- Quick Add Task Bar -->
    <div class="bg-white dark:bg-[#202020] rounded-xl p-3 border border-slate-200 dark:border-[#383838] shadow-2xs transition-colors focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900/30">
      <div class="flex items-center space-x-2">
        <div class="w-5 h-5 rounded-full border-2 border-dashed border-slate-300 dark:border-[#4d4d4d] flex items-center justify-center text-slate-400 dark:text-slate-500 shrink-0 ml-1">
          <span class="text-xs font-bold">+</span>
        </div>
        <input 
          type="text" 
          bind:value={newTaskTitle}
          on:keydown={(e) => e.key === 'Enter' && handleCreateTask()}
          placeholder="Add a new task manually (press Enter to save)..."
          class="flex-1 text-xs bg-transparent border-0 focus:outline-none placeholder-slate-400 dark:placeholder-slate-500 text-slate-800 dark:text-slate-100"
        />
        
        <!-- Quick duration selector -->
        <select 
          bind:value={newTaskDuration} 
          class="text-xs bg-slate-100 dark:bg-[#2b2b2b] border border-slate-200 dark:border-[#3d3d3d] rounded-lg px-2 py-1 text-slate-600 dark:text-slate-300 focus:outline-none cursor-pointer"
        >
          <option value={15}>15m</option>
          <option value={30}>30m</option>
          <option value={45}>45m</option>
          <option value={60}>1h</option>
        </select>

        <!-- Time toggle -->
        <button
          type="button"
          on:click={() => showAdvancedAdd = !showAdvancedAdd}
          class="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2b2b2b] transition-colors"
          title="Set specific time"
        >
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>

        <!-- Add Button -->
        <button
          type="button"
          on:click={handleCreateTask}
          disabled={!newTaskTitle.trim()}
          class="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 text-white rounded-lg text-xs font-medium transition-colors shadow-2xs shrink-0 cursor-pointer disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>

      <!-- Advanced time / priority / date toggle -->
      {#if showAdvancedAdd}
        <div class="mt-2.5 pt-2 border-t border-slate-100 dark:border-[#303030] flex flex-wrap items-center gap-3 text-xs">
          <div class="flex items-center space-x-1.5">
            <span class="text-slate-400 dark:text-slate-500 text-[11px]">Date:</span>
            <input 
              type="date" 
              bind:value={newTaskDate}
              class="px-2 py-0.5 rounded-md border border-slate-200 dark:border-[#3d3d3d] bg-slate-50 dark:bg-[#282828] text-slate-700 dark:text-slate-300 text-xs cursor-pointer"
            />
          </div>
          <div class="flex items-center space-x-1.5">
            <span class="text-slate-400 dark:text-slate-500 text-[11px]">Time:</span>
            <input 
              type="time" 
              bind:value={newTaskTime}
              class="px-2 py-0.5 rounded-md border border-slate-200 dark:border-[#3d3d3d] bg-slate-50 dark:bg-[#282828] text-slate-700 dark:text-slate-300 text-xs"
            />
          </div>
          <div class="flex items-center space-x-1.5">
            <span class="text-slate-400 dark:text-slate-500 text-[11px]">Priority:</span>
            <select 
              bind:value={newTaskPriority}
              class="px-2 py-0.5 rounded-md border border-slate-200 dark:border-[#3d3d3d] bg-slate-50 dark:bg-[#282828] text-slate-700 dark:text-slate-300 text-xs cursor-pointer"
            >
              <option value="none">Normal</option>
              <option value="high">High (🔴)</option>
              <option value="medium">Medium (🟡)</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
      {/if}
    </div>

    <!-- Task List Feed -->
    <div class="space-y-2">
      <div class="flex items-center justify-between px-1">
        <span class="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          {#if $activeTab === 'completed'}
            Completed Tasks
          {:else if $activeTab === 'all'}
            All Tasks ({$tasks.length})
          {:else}
            {isViewingToday ? "Today's Schedule" : `${formatDateFriendly($selectedDate)}'s Schedule`}
          {/if}
        </span>
        {#if visibleTasks.some(t => t.completed)}
          <button 
            type="button"
            on:click={clearAllCompleted}
            class="text-[11px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            Clear completed
          </button>
        {/if}
      </div>

      {#if visibleTasks.length === 0}
        <!-- Empty State -->
        <div class="bg-white dark:bg-[#202020] rounded-2xl border border-dashed border-slate-300 dark:border-[#333333] p-8 text-center transition-colors">
          <div class="w-11 h-11 rounded-2xl bg-slate-50 dark:bg-[#282828] border border-slate-200/80 dark:border-[#383838] text-slate-400 dark:text-slate-500 flex items-center justify-center mx-auto mb-2.5 shadow-2xs">
            <svg class="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.7" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 class="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">
            {$activeTab === 'completed' ? 'No completed tasks yet' : `No tasks scheduled for ${formatDateFriendly($selectedDate)}`}
          </h3>
          <p class="text-xs text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
            {$activeTab === 'completed' ? 'Complete tasks from your schedule to see them here.' : 'Tell the AI Assistant on the left what you want to schedule, or add tasks manually above.'}
          </p>
        </div>
      {:else}
        {#each visibleTasks as task (task.id)}
          <div 
            class="group bg-white dark:bg-[#202020] rounded-xl p-3 border transition-all duration-150 {
              task.completed 
                ? 'border-slate-200 dark:border-[#282828] bg-slate-50/60 dark:bg-[#1c1c1c]/60 opacity-60' 
                : 'border-slate-200 dark:border-[#333333] hover:border-slate-300 dark:hover:border-[#454545] hover:shadow-2xs'
            }"
          >
            <div class="flex items-center justify-between">
              
              <!-- Checkbox + Priority Dot + Title -->
              <div class="flex items-center space-x-2.5 flex-1 min-w-0 mr-3">
                <button
                  type="button"
                  on:click={() => toggleTaskCompletion(task.id)}
                  class="w-5 h-5 rounded-lg border transition-all flex items-center justify-center shrink-0 cursor-pointer {
                    task.completed 
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-2xs' 
                      : 'border-slate-300 dark:border-[#4d4d4d] hover:border-blue-500 dark:hover:border-blue-400 bg-white dark:bg-[#262626]'
                  }"
                  title={task.completed ? 'Mark incomplete' : 'Mark complete'}
                  aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                >
                  {#if task.completed}
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                    </svg>
                  {/if}
                </button>

                <!-- Priority Dot Indicator (Linear Style) -->
                {#if task.priority === 'high'}
                  <span class="w-2 h-2 rounded-full bg-rose-500 ring-2 ring-rose-500/20 shrink-0" title="High Priority"></span>
                {:else if task.priority === 'medium'}
                  <span class="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-amber-400/20 shrink-0" title="Medium Priority"></span>
                {/if}

                <!-- Task Title (inline editable) -->
                {#if editingTaskId === task.id}
                  <input 
                    type="text" 
                    bind:value={editingTaskTitle}
                    on:blur={() => saveEdit(task.id)}
                    on:keydown={(e) => e.key === 'Enter' && saveEdit(task.id)}
                    class="text-xs font-medium px-2 py-0.5 border border-blue-400 rounded bg-white dark:bg-[#262626] text-slate-900 dark:text-slate-100 w-full focus:outline-none"
                  />
                {:else}
                  <button 
                    type="button"
                    on:dblclick={() => startEdit(task)}
                    class="text-left text-xs font-medium truncate text-slate-800 dark:text-slate-200 cursor-pointer bg-transparent border-0 p-0 hover:text-blue-600 dark:hover:text-blue-400 transition-colors {task.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''}"
                    title="Double click to edit title"
                  >
                    {task.title}
                  </button>
                {/if}
              </div>

              <!-- Unified Meta Pill (Date + Time + Duration) & Quick Actions -->
              <div class="flex items-center space-x-2 shrink-0">
                
                <!-- Quick Focus Timer Trigger Button -->
                {#if !task.completed}
                  <button
                    type="button"
                    on:click={() => startTaskTimer(task)}
                    class="flex items-center space-x-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-colors cursor-pointer {
                      $timerState.activeTaskId === task.id && ($timerState.isRunning || $timerState.isPaused)
                        ? 'bg-blue-600 text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-[#272727] text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/60 dark:border-[#383838]'
                    }"
                    title={$timerState.activeTaskId === task.id ? "Active Focus Timer" : "Start Focus Timer for this task"}
                  >
                    {#if $timerState.activeTaskId === task.id && $timerState.isRunning}
                      <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      <span class="font-mono font-bold text-[10px]">{$formattedTime}</span>
                    {:else}
                      <svg class="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                      <span class="text-[10px]">Timer</span>
                    {/if}
                  </button>
                {/if}

                <!-- Unified Date, Time & Duration Meta Pill -->
                <div class="flex items-center space-x-1.5 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-100/90 dark:bg-[#272727] px-2.5 py-1 rounded-lg border border-slate-200/60 dark:border-[#383838]">
                  {#if $activeTab === 'all' || (task.scheduledDate && task.scheduledDate !== $selectedDate)}
                    <span class="font-semibold text-blue-600 dark:text-blue-400">
                      {formatDateFriendly(task.scheduledDate)}
                    </span>
                    <span class="text-slate-300 dark:text-slate-600">·</span>
                  {/if}
                  {#if task.scheduledTime}
                    <svg class="w-3 h-3 text-blue-500 dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span class="font-semibold text-slate-700 dark:text-slate-200">{formatTimeFriendly(task.scheduledTime, $settings.timeFormat)}</span>
                    <span class="text-slate-300 dark:text-slate-600">·</span>
                  {/if}
                  <span class="font-medium">{formatDurationDisplay(task.durationMinutes)}</span>
                </div>

                <!-- Hover Actions: Edit & Delete -->
                <div class="opacity-0 group-hover:opacity-100 flex items-center space-x-0.5 transition-opacity duration-150">
                  <button
                    type="button"
                    on:click={() => startEdit(task)}
                    class="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2e2e2e] transition-colors cursor-pointer"
                    title="Edit task"
                    aria-label="Edit task"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    on:click={() => removeTask(task.id)}
                    class="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    title="Delete task"
                    aria-label="Delete task"
                  >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

              </div>

            </div>
          </div>
        {/each}
      {/if}
    </div>

  </div>

</div>
