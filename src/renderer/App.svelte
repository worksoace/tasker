<script lang="ts">
  import { onMount } from 'svelte';
  import { 
    initStore, 
    tasks, 
    todayTasks,
    todayDate,
    checkDayRollover,
    selectedDateTasks,
    selectedDate,
    formatDateFriendly,
    activeTab, 
    resetConversation, 
    settings 
  } from './store/todoStore';
  import { initTheme, toggleTheme, isDark } from './store/themeStore';
  import { initScheduleNotificationWatcher, timerState, formattedTime } from './store/timerStore';
  import ChatAssistant from './components/ChatAssistant.svelte';
  import ScheduleView from './components/ScheduleView.svelte';
  import SettingsModal from './components/SettingsModal.svelte';
  import appLogo from './assets/appicon.png';

  let showSettings = false;
  let isLoading = true;

  // Reactively format today's date so it updates automatically if the day changes
  $: todayFormatted = (() => {
    if (!$todayDate) return '';
    const [y, m, d] = $todayDate.split('-').map(Number);
    const dateObj = new Date(y, (m || 1) - 1, d || 1);
    return new Intl.DateTimeFormat('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    }).format(dateObj);
  })();

  // Resizable sidebar state
  let sidebarWidth = 420;
  let isDragging = false;
  const MIN_WIDTH = 300;
  const MAX_WIDTH = 750;

  onMount(async () => {
    // Initialize Theme (strictly defaults to light mode unless explicitly chosen)
    initTheme();

    // Check day rollover on window focus or visibility change
    const onVisibilityOrFocus = () => checkDayRollover();
    window.addEventListener('focus', onVisibilityOrFocus);
    document.addEventListener('visibilitychange', onVisibilityOrFocus);

    // Load saved sidebar width
    const savedWidth = localStorage.getItem('tasker_sidebar_width');
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (!isNaN(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) {
        sidebarWidth = parsed;
      }
    }

    // Start Realtime Scheduled Task Notification Watcher
    initScheduleNotificationWatcher();

    const start = Date.now();
    await initStore();
    const elapsed = Date.now() - start;
    const minDelay = 650; // Smooth loading feel without flicker
    const remaining = Math.max(0, minDelay - elapsed);

    setTimeout(() => {
      isLoading = false;
    }, remaining);

    return () => {
      window.removeEventListener('focus', onVisibilityOrFocus);
      document.removeEventListener('visibilitychange', onVisibilityOrFocus);
    };
  });

  function handleMouseDown(e: MouseEvent) {
    e.preventDefault();
    isDragging = true;
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  function handleMouseMove(e: MouseEvent) {
    if (!isDragging) return;
    const newWidth = Math.min(Math.max(e.clientX, MIN_WIDTH), Math.min(MAX_WIDTH, window.innerWidth - 380));
    sidebarWidth = newWidth;
  }

  function handleMouseUp() {
    if (isDragging) {
      isDragging = false;
      localStorage.setItem('tasker_sidebar_width', sidebarWidth.toString());
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
  }
</script>

<div class="h-screen w-screen flex flex-col bg-slate-100 dark:bg-[#292929] font-sans text-slate-900 dark:text-slate-100 overflow-hidden select-none relative transition-colors">
  
  <!-- Sleek Loading Screen -->
  {#if isLoading}
    <div class="absolute inset-0 z-50 bg-white dark:bg-[#292929] flex flex-col items-center justify-center transition-opacity duration-300">
      <div class="flex flex-col items-center space-y-4">
        <div class="relative flex items-center justify-center">
          <div class="w-16 h-16 rounded-2xl bg-slate-50 dark:bg-[#202020] border border-slate-200/80 dark:border-[#383838] shadow-md flex items-center justify-center p-2.5">
            <img src={appLogo} alt="Tasker Logo" class="w-full h-full object-contain" />
          </div>
          <div class="absolute -inset-1 rounded-2xl bg-blue-500/10 blur-sm -z-10 animate-pulse"></div>
        </div>
        
        <div class="text-center space-y-1">
          <h1 class="text-base font-bold text-slate-900 dark:text-white tracking-tight">Tasker</h1>
          <p class="text-xs text-slate-400 dark:text-slate-500">Loading your workspace...</p>
        </div>

        <div class="w-36 h-1 bg-slate-100 dark:bg-[#383838] rounded-full overflow-hidden">
          <div class="h-full bg-blue-600 rounded-full animate-pulse w-2/3"></div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Unified Top Navigation Bar (Eliminating the Double Header) -->
  <header class="h-11 drag-region bg-white dark:bg-[#202020] border-b border-slate-200 dark:border-[#333333] flex items-center justify-between px-3.5 transition-colors z-20">
    
    <!-- Left: App Brand & AI Model Indicator -->
    <div class="flex items-center space-x-2.5">
      <img src={appLogo} alt="Tasker Logo" class="w-5 h-5 rounded object-contain shadow-2xs" />
      <span class="text-xs font-bold tracking-tight text-slate-800 dark:text-slate-100">
        Tasker <span class="text-blue-600 dark:text-blue-400 font-semibold">AI</span>
      </span>

      <!-- AI Provider Indicator Chip -->
      <button 
        type="button"
        on:click={() => showSettings = true}
        class="no-drag-region cursor-pointer hidden sm:flex items-center space-x-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-[#2c2c2c] hover:bg-slate-200 dark:hover:bg-[#363636] border border-slate-200/80 dark:border-[#3d3d3d] text-[11px] font-medium text-slate-600 dark:text-slate-300 transition-colors"
        title="AI Provider (Click to configure)"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        <span>{$settings.ai.customEndpoint?.includes('groq') ? 'Groq LPU' : 'NVIDIA NIM'}</span>
      </button>

      <!-- New Chat Button -->
      <button
        type="button"
        on:click={resetConversation}
        class="no-drag-region cursor-pointer p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2c2c2c] transition-colors"
        title="Start fresh conversation"
        aria-label="New chat"
      >
        <svg class="w-3.5 h-3.5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </button>
    </div>

    <!-- Right: Filter Tabs, Date, Theme Toggle & Settings -->
    <div class="no-drag-region flex items-center space-x-3 pr-[165px]">
      
      <!-- Active Timer Pill Indicator -->
      {#if $timerState.isRunning || $timerState.isPaused}
        <div class="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/80 dark:border-blue-900/60 text-[11px] font-bold shadow-2xs">
          <span class="w-1.5 h-1.5 rounded-full {$timerState.isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}"></span>
          <span class="font-mono">{$formattedTime}</span>
        </div>
      {/if}

      <!-- Date Indicator -->
      <span class="text-xs font-medium text-slate-400 dark:text-slate-500 hidden md:inline">
        {todayFormatted}
      </span>

      <!-- Task Filter Tabs: Today / All / Done -->
      <div class="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-[#282828] border border-slate-200/60 dark:border-[#383838]">
        <button
          type="button"
          on:click={() => activeTab.set('today')}
          class="px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all cursor-pointer {$activeTab === 'today' ? 'bg-white dark:bg-[#343434] text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}"
        >
          {formatDateFriendly($selectedDate)} <span class="opacity-60 text-[10px]">({$selectedDateTasks.length})</span>
        </button>
        <button
          type="button"
          on:click={() => activeTab.set('all')}
          class="px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all {$activeTab === 'all' ? 'bg-white dark:bg-[#343434] text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}"
        >
          All <span class="opacity-60 text-[10px]">({$tasks.length})</span>
        </button>
        <button
          type="button"
          on:click={() => activeTab.set('completed')}
          class="px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all {$activeTab === 'completed' ? 'bg-white dark:bg-[#343434] text-slate-900 dark:text-white shadow-2xs' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}"
        >
          Done
        </button>
      </div>

      <div class="h-4 w-px bg-slate-200 dark:bg-[#383838]"></div>

      <!-- Theme Toggle Button -->
      <button
        type="button"
        on:click={toggleTheme}
        class="cursor-pointer select-none no-drag-region p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-[#2c2c2c] transition-colors focus:outline-none"
        title={$isDark ? 'Switch to Light mode' : 'Switch to Dark mode'}
        aria-label="Toggle color theme"
      >
        {#if $isDark}
          <svg class="w-4 h-4 text-amber-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        {:else}
          <svg class="w-4 h-4 text-slate-600 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        {/if}
      </button>

      <!-- Settings Button -->
      <button
        type="button"
        on:click={() => showSettings = true}
        class="cursor-pointer select-none no-drag-region text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-[#2c2c2c] p-1.5 rounded-md transition-colors flex items-center justify-center focus:outline-none"
        title="Open Settings"
        aria-label="Open Settings"
      >
        <svg class="w-4 h-4 text-slate-500 dark:text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  </header>

  <!-- Dual-Pane Workspace with Resizer Divider -->
  <main class="flex-1 flex min-h-0 overflow-hidden {isDragging ? 'cursor-col-resize select-none' : ''}">
    
    <!-- Left Pane: AI Chatbot Assistant -->
    <div 
      class="h-full shrink-0 flex flex-col"
      style="width: {sidebarWidth}px;"
    >
      <ChatAssistant onOpenSettings={() => showSettings = true} />
    </div>

    <!-- Draggable Resizer Divider -->
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div 
      class="w-1.5 hover:w-2 -ml-0.5 z-20 h-full cursor-col-resize group relative flex items-center justify-center transition-all {isDragging ? 'w-2 bg-blue-500/20' : 'hover:bg-blue-500/10'}"
      on:mousedown={handleMouseDown}
      role="separator"
      aria-orientation="vertical"
      aria-valuenow={sidebarWidth}
      tabindex="-1"
    >
      <div class="w-0.5 h-8 rounded-full bg-slate-300 dark:bg-[#4a4a4a] group-hover:bg-blue-500 transition-colors {isDragging ? 'bg-blue-600' : ''}"></div>
    </div>

    <!-- Right Pane: Today's Schedule & Tasks -->
    <div class="flex-1 min-w-[360px] h-full overflow-hidden">
      <ScheduleView />
    </div>

  </main>

  <!-- Drag overlay to prevent pointer events being lost on child inputs while resizing -->
  {#if isDragging}
    <div class="fixed inset-0 z-50 cursor-col-resize"></div>
  {/if}

  <!-- Settings Modal -->
  {#if showSettings}
    <SettingsModal onClose={() => showSettings = false} />
  {/if}

</div>
