<script lang="ts">
  import { 
    timerState, 
    formattedTime, 
    timerProgress, 
    togglePlayPause, 
    addMinutes, 
    resetTimer, 
    stopTimer, 
    completeCurrentTask 
  } from '../store/timerStore';

  let isMinimized = false;
</script>

{#if $timerState.isRunning || $timerState.isPaused || $timerState.isCompleted}
  <div class="bg-white dark:bg-[#202020] rounded-2xl p-5 sm:p-6 border border-slate-200/90 dark:border-[#383838] shadow-sm mb-4 transition-colors">
    <!-- Top Row: Task Name & Min/Close -->
    <div class="flex items-center justify-between gap-3 mb-3">
      <div class="flex items-center gap-2.5 truncate min-w-0">
        <span class="flex h-2 w-2 relative shrink-0">
          {#if $timerState.isRunning}
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          {:else if $timerState.isPaused}
            <span class="relative inline-flex rounded-full h-2 w-2 bg-slate-400"></span>
          {:else}
            <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          {/if}
        </span>
        <span class="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 shrink-0">
          {#if $timerState.isCompleted}
            Session Complete
          {:else if $timerState.isPaused}
            Timer Paused
          {:else}
            Focus Session
          {/if}
        </span>
        <span class="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
          {$timerState.taskTitle || 'Focus Session'}
        </span>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <button 
          type="button"
          on:click={() => isMinimized = !isMinimized}
          class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#2c2c2c] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          title={isMinimized ? "Expand Timer" : "Minimize Timer"}
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            {#if isMinimized}
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            {:else}
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" />
            {/if}
          </svg>
        </button>
        <button 
          type="button"
          on:click={stopTimer}
          class="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-[#2c2c2c] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
          title="Stop & Dismiss Timer"
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>

    {#if !isMinimized}
      <!-- Middle Row: Large Digital Display & Action Controls -->
      <div class="flex items-center justify-between gap-4 my-3">
        
        <!-- Timer Digits & Progress Pill -->
        <div class="flex items-baseline gap-3">
          <span class="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            {$formattedTime}
          </span>
          <span class="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-[#2c2c2c] text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-[#383838]">
            {$timerProgress}%
          </span>
        </div>

        <!-- Unified Neutral Action Buttons -->
        <div class="flex items-center gap-2">
          <!-- Play / Pause -->
          <button
            type="button"
            on:click={togglePlayPause}
            class="flex items-center justify-center w-9 h-9 rounded-xl font-medium transition-all cursor-pointer bg-slate-900 hover:bg-slate-800 text-white dark:bg-[#2e2e2e] dark:hover:bg-[#383838] dark:text-slate-100 border border-transparent dark:border-[#3e3e3e]"
            title={$timerState.isRunning ? "Pause Timer" : "Start / Resume Timer"}
          >
            {#if $timerState.isRunning}
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
              </svg>
            {:else}
              <svg class="w-4 h-4 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            {/if}
          </button>

          <!-- +5 Minutes -->
          <button
            type="button"
            on:click={() => addMinutes(5)}
            class="px-3 h-9 rounded-xl bg-slate-100 dark:bg-[#2e2e2e] hover:bg-slate-200 dark:hover:bg-[#383838] text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-[#3e3e3e] transition-colors cursor-pointer"
            title="Add 5 minutes to timer"
          >
            +5m
          </button>

          <!-- Complete Task / Check -->
          {#if $timerState.activeTaskId}
            <button
              type="button"
              on:click={completeCurrentTask}
              class="px-3 h-9 rounded-xl bg-slate-100 dark:bg-[#2e2e2e] hover:bg-slate-200 dark:hover:bg-[#383838] text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-200/80 dark:border-[#3e3e3e] flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Mark this task as completed"
            >
              <svg class="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              <span class="hidden sm:inline">Done</span>
            </button>
          {/if}

          <!-- Reset -->
          <button
            type="button"
            on:click={resetTimer}
            class="p-2 h-9 rounded-xl hover:bg-slate-100 dark:hover:bg-[#2c2c2c] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
            title="Reset Timer"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Simple Clean Progress Bar -->
      <div class="w-full h-1.5 bg-slate-100 dark:bg-[#2c2c2c] rounded-full overflow-hidden mt-4">
        <div 
          class="h-full bg-blue-600 dark:bg-blue-500 rounded-full transition-all duration-300 ease-out"
          style="width: {$timerProgress}%"
        ></div>
      </div>
    {/if}
  </div>
{/if}
