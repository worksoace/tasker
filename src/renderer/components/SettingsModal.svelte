<script lang="ts">
  import { settings, saveSettings } from '../store/todoStore';
  import { theme, setTheme } from '../store/themeStore';
  import type { AppSettings } from '../../main/types';

  export let onClose: () => void = () => {};

  let activeTab: 'ai' | 'schedule' | 'general' = 'ai';

  // Local draft of settings
  let localSettings: AppSettings = JSON.parse(JSON.stringify($settings));

  let showApiKey = false;
  let testStatus: 'idle' | 'testing' | 'success' | 'error' = 'idle';
  let testMessage = '';
  let isSaving = false;

  function openExternalLink(url: string) {
    if (window.api && window.api.openExternal) {
      window.api.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  }

  const NVIDIA_MODELS = [
    { id: 'meta/llama-3.2-3b-instruct', name: 'Llama 3.2 3B (Fast)' },
    { id: 'meta/llama-3.2-1b-instruct', name: 'Llama 3.2 1B (Ultra Fast)' },
    { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
    { id: 'nvidia/llama-3.3-nemotron-super-49b-v1', name: 'NVIDIA Nemotron 49B' },
    { id: 'google/gemma-2-9b-it', name: 'Google Gemma 2 9B' },
    { id: 'microsoft/phi-3.5-mini-instruct', name: 'Microsoft Phi-3.5 Mini' },
    { id: 'mistralai/mistral-7b-instruct-v0.3', name: 'Mistral 7B' },
    { id: 'mistralai/mistral-large', name: 'Mistral Large' }
  ];

  const GROQ_MODELS_PRESET = [
    { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B (Ultra Fast)' },
    { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B' },
    { id: 'groq/compound-mini', name: 'Groq Compound Mini (Fast)' },
    { id: 'groq/compound', name: 'Groq Compound' },
    { id: 'qwen/qwen3.6-27b', name: 'Qwen 3.6 27B' },
    { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant' },
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
  ];

  function isChatModel(id: string): boolean {
    const lower = id.toLowerCase();
    return !lower.includes('whisper') &&
           !lower.includes('guard') &&
           !lower.includes('orpheus') &&
           !lower.includes('tts') &&
           !lower.includes('embedding');
  }

  $: currentProvider = (() => {
    const ep = localSettings.ai.customEndpoint || '';
    if (ep.includes('groq')) return 'groq';
    return 'nvidia';
  })();

  let availableModels = (localSettings.ai.customEndpoint?.includes('groq'))
    ? [...GROQ_MODELS_PRESET]
    : [...NVIDIA_MODELS];

  const daysOfWeek = [
    { day: 1, label: 'M' },
    { day: 2, label: 'T' },
    { day: 3, label: 'W' },
    { day: 4, label: 'T' },
    { day: 5, label: 'F' },
    { day: 6, label: 'S' },
    { day: 0, label: 'S' }
  ];

  function setProvider(provider: 'nvidia' | 'groq') {
    testStatus = 'idle';
    testMessage = '';
    if (provider === 'nvidia') {
      localSettings.ai.customEndpoint = '';
      localSettings.ai.model = 'meta/llama-3.2-3b-instruct';
      availableModels = [...NVIDIA_MODELS];
    } else {
      localSettings.ai.customEndpoint = 'https://api.groq.com/openai/v1';
      localSettings.ai.model = 'openai/gpt-oss-20b';
      availableModels = [...GROQ_MODELS_PRESET];
    }
  }

  async function handleTestConnection() {
    if (!localSettings.ai.apiKey?.trim()) {
      testStatus = 'error';
      testMessage = 'API Key is empty';
      return;
    }

    testStatus = 'testing';
    testMessage = 'Testing...';

    try {
      const res = await window.api.testAIConnection(
        localSettings.ai.apiKey,
        localSettings.ai.model,
        localSettings.ai.customEndpoint
      );

      if (res.success) {
        testStatus = 'success';
        testMessage = res.workingModel ? `Connected (${res.workingModel})` : 'Connected successfully';
        if (res.workingModel && res.workingModel !== localSettings.ai.model) {
          localSettings.ai.model = res.workingModel;
        }
        if (res.availableModels && res.availableModels.length > 0) {
          for (const mId of res.availableModels) {
            if (isChatModel(mId) && !availableModels.some(m => m.id === mId)) {
              availableModels = [...availableModels, { id: mId, name: mId }];
            }
          }
        }
      } else {
        testStatus = 'error';
        testMessage = res.message || 'Connection failed';
      }
    } catch (err: any) {
      testStatus = 'error';
      testMessage = err?.message || 'Connection failed';
    }
  }

  function toggleWorkDay(dayIndex: number) {
    const days = localSettings.schedule.workDays || [1, 2, 3, 4, 5];
    if (days.includes(dayIndex)) {
      localSettings.schedule.workDays = days.filter(d => d !== dayIndex);
    } else {
      localSettings.schedule.workDays = [...days, dayIndex].sort();
    }
  }

  async function handleSave() {
    isSaving = true;
    try {
      await saveSettings(localSettings);
      onClose();
    } catch (e) {
      isSaving = false;
    }
  }
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<div 
  class="fixed inset-0 z-50 bg-slate-900/40 dark:bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 select-none transition-colors"
  on:click|self={onClose}
  on:keydown|self={(e) => (e.key === 'Escape' || e.key === 'Enter') && onClose()}
  tabindex="-1"
  role="dialog"
  aria-modal="true"
>
  <div class="bg-white dark:bg-[#202020] rounded-2xl shadow-xl border border-slate-200 dark:border-[#383838] w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] fade-in transition-colors">
    
    <!-- Modal Header -->
    <div class="px-5 py-3.5 border-b border-slate-100 dark:border-[#333333] flex items-center justify-between bg-slate-50/50 dark:bg-[#1a1a1a]">
      <div class="flex items-center space-x-2">
        <svg class="w-4 h-4 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <h2 class="text-sm font-bold text-slate-800 dark:text-slate-100">Settings</h2>
      </div>
      <button 
        on:click={onClose}
        class="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2c2c2c] transition-colors"
        title="Close"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <!-- Navigation Tabs -->
    <div class="px-5 pt-2 flex space-x-2 border-b border-slate-100 dark:border-[#333333] bg-white dark:bg-[#202020]">
      <button
        on:click={() => activeTab = 'ai'}
        class="pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 {
          activeTab === 'ai' 
            ? 'border-blue-600 text-blue-600 dark:text-blue-400' 
            : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
        }"
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span>AI Provider</span>
      </button>
      <button
        on:click={() => activeTab = 'schedule'}
        class="pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 {
          activeTab === 'schedule' 
            ? 'border-blue-600 text-blue-600 dark:text-blue-400' 
            : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
        }"
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>Schedule</span>
      </button>
      <button
        on:click={() => activeTab = 'general'}
        class="pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 {
          activeTab === 'general' 
            ? 'border-blue-600 text-blue-600 dark:text-blue-400' 
            : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
        }"
      >
        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
        </svg>
        <span>Preferences</span>
      </button>
    </div>

    <!-- Tab Contents -->
    <div class="p-5 overflow-y-auto flex-1 space-y-4 bg-white dark:bg-[#202020] text-xs text-slate-800 dark:text-slate-200">
      
      <!-- TAB: AI CONNECTION -->
      {#if activeTab === 'ai'}
        <div class="space-y-4">

          <!-- Provider Segmented Selector (NVIDIA and Groq only) -->
          <div>
            <span class="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Provider</span>
            <div class="grid grid-cols-2 gap-1.5 p-1 bg-slate-100/80 dark:bg-[#292929] rounded-xl border border-slate-200/60 dark:border-[#3d3d3d]">
              <button
                type="button"
                on:click={() => setProvider('nvidia')}
                class="py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 {currentProvider === 'nvidia' ? 'bg-white dark:bg-[#333333] text-slate-900 dark:text-white shadow-2xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'}"
              >
                <span>NVIDIA NIM</span>
              </button>
              <button
                type="button"
                on:click={() => setProvider('groq')}
                class="py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 {currentProvider === 'groq' ? 'bg-blue-600 text-white shadow-2xs' : 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-[#2c2c2c]'}"
              >
                <span>Groq LPU</span>
              </button>
            </div>
          </div>

          <!-- API Key Info & Registration Link for new users -->
          <div class="p-3 rounded-xl border flex items-center justify-between text-xs transition-colors {
            currentProvider === 'groq'
              ? 'bg-blue-50/70 dark:bg-[#192636] border-blue-200/60 dark:border-blue-900/40 text-blue-900 dark:text-blue-200'
              : 'bg-emerald-50/70 dark:bg-[#16271e] border-emerald-200/60 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-200'
          }">
            <div class="flex items-center space-x-2">
              <svg class="w-4 h-4 shrink-0 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                Need a {currentProvider === 'groq' ? 'Groq' : 'NVIDIA'} API key?
              </span>
            </div>
            <button
              type="button"
              on:click={() => openExternalLink(currentProvider === 'groq' ? 'https://console.groq.com/keys' : 'https://build.nvidia.com/')}
              class="font-semibold underline hover:no-underline flex items-center space-x-1 shrink-0 ml-2 {currentProvider === 'groq' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-700 dark:text-emerald-400'}"
            >
              <span>Get API Key</span>
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>

          <!-- API Key Input -->
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label for="api-key-input" class="font-semibold text-slate-700 dark:text-slate-300">API Key</label>
              <button
                type="button"
                on:click={() => showApiKey = !showApiKey}
                class="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <div class="relative flex items-center">
              {#if showApiKey}
                <input
                  id="api-key-input"
                  type="text"
                  bind:value={localSettings.ai.apiKey}
                  placeholder={currentProvider === 'groq' ? 'gsk_...' : 'nvapi-...'}
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#3d3d3d] bg-slate-50 dark:bg-[#292929] text-slate-900 dark:text-slate-100 font-mono text-xs focus:bg-white dark:focus:bg-[#292929] focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all"
                />
              {:else}
                <input
                  id="api-key-input"
                  type="password"
                  bind:value={localSettings.ai.apiKey}
                  placeholder={currentProvider === 'groq' ? 'gsk_...' : 'nvapi-...'}
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#3d3d3d] bg-slate-50 dark:bg-[#292929] text-slate-900 dark:text-slate-100 font-mono text-xs focus:bg-white dark:focus:bg-[#292929] focus:border-blue-500 focus:ring-1 focus:ring-blue-100 dark:focus:ring-blue-900/30 transition-all"
                />
              {/if}
            </div>
          </div>

          <!-- Model Select -->
          <div>
            <label for="ai-model-select" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Model</label>
            <select
              id="ai-model-select"
              bind:value={localSettings.ai.model}
              class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#3d3d3d] bg-slate-50 dark:bg-[#292929] text-slate-800 dark:text-slate-100 text-xs focus:bg-white dark:focus:bg-[#292929] focus:border-blue-500"
            >
              {#each availableModels as m}
                <option value={m.id}>{m.name}</option>
              {/each}
            </select>
          </div>

          <!-- Test Connection Button & Status -->
          <div class="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-[#333333]">
            <button
              type="button"
              on:click={handleTestConnection}
              disabled={testStatus === 'testing'}
              class="px-3.5 py-1.5 bg-slate-100 dark:bg-[#2b2b2b] hover:bg-slate-200 dark:hover:bg-[#363636] active:bg-slate-300 text-slate-700 dark:text-slate-300 font-medium rounded-lg text-xs transition-colors flex items-center space-x-1.5 border border-slate-200 dark:border-[#3d3d3d] disabled:opacity-60"
            >
              {#if testStatus === 'testing'}
                <svg class="w-3.5 h-3.5 animate-spin text-slate-600 dark:text-slate-400" viewBox="0 0 24 24" fill="none">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span>Testing...</span>
              {:else}
                <svg class="w-3.5 h-3.5 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Test Connection</span>
              {/if}
            </button>

            {#if testStatus !== 'idle'}
              <span class="text-xs truncate max-w-[260px] font-medium {testStatus === 'success' ? 'text-emerald-600 dark:text-emerald-400' : testStatus === 'error' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500 dark:text-slate-400'}">
                {testMessage}
              </span>
            {/if}
          </div>

        </div>

      <!-- TAB: WORK SCHEDULE -->
      {:else if activeTab === 'schedule'}
        <div class="space-y-4">
          <!-- Work Hours -->
          <div>
            <span class="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Working Hours</span>
            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <span class="text-[11px] text-slate-400 dark:text-slate-500 block mb-1">Start</span>
                <input
                  type="time"
                  bind:value={localSettings.schedule.workStartTime}
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#3d3d3d] bg-slate-50 dark:bg-[#292929] text-slate-800 dark:text-slate-100 text-xs focus:bg-white dark:focus:bg-[#292929] focus:border-blue-500"
                />
              </div>
              <div>
                <span class="text-[11px] text-slate-400 dark:text-slate-500 block mb-1">End</span>
                <input
                  type="time"
                  bind:value={localSettings.schedule.workEndTime}
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#3d3d3d] bg-slate-50 dark:bg-[#292929] text-slate-800 dark:text-slate-100 text-xs focus:bg-white dark:focus:bg-[#292929] focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <!-- Lunch Break -->
          <div>
            <span class="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Lunch Break</span>
            <div class="grid grid-cols-2 gap-2.5">
              <div>
                <span class="text-[11px] text-slate-400 dark:text-slate-500 block mb-1">Start</span>
                <input
                  type="time"
                  bind:value={localSettings.schedule.lunchStartTime}
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#3d3d3d] bg-slate-50 dark:bg-[#292929] text-slate-800 dark:text-slate-100 text-xs focus:bg-white dark:focus:bg-[#292929] focus:border-blue-500"
                />
              </div>
              <div>
                <span class="text-[11px] text-slate-400 dark:text-slate-500 block mb-1">End</span>
                <input
                  type="time"
                  bind:value={localSettings.schedule.lunchEndTime}
                  class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#3d3d3d] bg-slate-50 dark:bg-[#292929] text-slate-800 dark:text-slate-100 text-xs focus:bg-white dark:focus:bg-[#292929] focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          <!-- Work Days -->
          <div>
            <span class="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Active Days</span>
            <div class="flex space-x-1.5">
              {#each daysOfWeek as dayObj}
                <button
                  type="button"
                  on:click={() => toggleWorkDay(dayObj.day)}
                  class="flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-all {
                    (localSettings.schedule.workDays || []).includes(dayObj.day)
                      ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                      : 'bg-slate-50 dark:bg-[#292929] text-slate-600 dark:text-slate-400 border-slate-200 dark:border-[#3d3d3d] hover:bg-slate-100 dark:hover:bg-[#363636]'
                  }"
                >
                  {dayObj.label}
                </button>
              {/each}
            </div>
          </div>

          <!-- Buffer between tasks -->
          <div>
            <label for="buffer-select" class="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Task Buffer</label>
            <select
              id="buffer-select"
              bind:value={localSettings.schedule.bufferMinutes}
              class="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#3d3d3d] bg-slate-50 dark:bg-[#292929] text-slate-800 dark:text-slate-100 text-xs focus:bg-white dark:focus:bg-[#292929] focus:border-blue-500"
            >
              <option value={0}>0 minutes</option>
              <option value={5}>5 minutes</option>
              <option value={10}>10 minutes</option>
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
            </select>
          </div>
        </div>

      <!-- TAB: PREFERENCES -->
      {:else}
        <div class="space-y-4">
          <!-- Theme / Appearance -->
          <div>
            <span class="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Appearance</span>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                on:click={() => setTheme('light')}
                class="py-2 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center space-x-2 {
                  $theme === 'light'
                    ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-2xs'
                    : 'border-slate-200 dark:border-[#3d3d3d] bg-slate-50 dark:bg-[#292929] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#363636]'
                }"
              >
                <svg class="w-4 h-4 text-amber-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span>Light</span>
              </button>
              <button
                type="button"
                on:click={() => setTheme('dark')}
                class="py-2 px-3 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center space-x-2 {
                  $theme === 'dark'
                    ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-2xs'
                    : 'border-slate-200 dark:border-[#3d3d3d] bg-slate-50 dark:bg-[#292929] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#363636]'
                }"
              >
                <svg class="w-4 h-4 text-blue-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
                <span>Dark</span>
              </button>
            </div>
          </div>

          <!-- Time Format -->
          <div>
            <span class="block font-semibold text-slate-700 dark:text-slate-300 mb-1.5">Time Format</span>
            <div class="grid grid-cols-2 gap-2">
              <button
                type="button"
                on:click={() => localSettings.timeFormat = '12h'}
                class="py-2 px-3 rounded-xl border text-xs font-semibold transition-all text-center {
                  localSettings.timeFormat === '12h'
                    ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-2xs'
                    : 'border-slate-200 dark:border-[#3d3d3d] bg-slate-50 dark:bg-[#292929] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#363636]'
                }"
              >
                12-Hour (2:30 PM)
              </button>
              <button
                type="button"
                on:click={() => localSettings.timeFormat = '24h'}
                class="py-2 px-3 rounded-xl border text-xs font-semibold transition-all text-center {
                  localSettings.timeFormat === '24h'
                    ? 'border-blue-600 bg-blue-50/60 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 shadow-2xs'
                    : 'border-slate-200 dark:border-[#3d3d3d] bg-slate-50 dark:bg-[#292929] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#363636]'
                }"
              >
                24-Hour (14:30)
              </button>
            </div>
          </div>

          <!-- Auto-Schedule Toggle -->
          <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#292929]/70 border border-slate-200/80 dark:border-[#383838] rounded-xl">
            <div>
              <span class="block font-semibold text-slate-800 dark:text-slate-200">Auto-schedule from Chat</span>
              <span class="text-[11px] text-slate-400 dark:text-slate-500">Automatically insert parsed tasks into schedule</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={localSettings.ai.autoSchedule}
              on:click={() => localSettings.ai.autoSchedule = !localSettings.ai.autoSchedule}
              class="relative w-9 h-5 rounded-full transition-colors shrink-0 cursor-pointer {localSettings.ai.autoSchedule ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}"
            >
              <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-xs transition-transform {localSettings.ai.autoSchedule ? 'translate-x-4' : 'translate-x-0'}"></span>
            </button>
          </div>

          <!-- Auto-Start Focus Timer on Scheduled Time Toggle -->
          <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#292929]/70 border border-slate-200/80 dark:border-[#383838] rounded-xl">
            <div>
              <span class="block font-semibold text-slate-800 dark:text-slate-200">Auto-Start Focus Timer</span>
              <span class="text-[11px] text-slate-400 dark:text-slate-500">Automatically run timer as soon as a task's scheduled time arrives</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={localSettings.autoStartTimer ?? true}
              on:click={() => localSettings.autoStartTimer = !(localSettings.autoStartTimer ?? true)}
              class="relative w-9 h-5 rounded-full transition-colors shrink-0 cursor-pointer {(localSettings.autoStartTimer ?? true) ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}"
            >
              <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-xs transition-transform {(localSettings.autoStartTimer ?? true) ? 'translate-x-4' : 'translate-x-0'}"></span>
            </button>
          </div>

          <!-- Sound Effects Toggle -->
          <div class="flex items-center justify-between p-3 bg-slate-50 dark:bg-[#292929]/70 border border-slate-200/80 dark:border-[#383838] rounded-xl">
            <div>
              <span class="block font-semibold text-slate-800 dark:text-slate-200">Sound Notifications</span>
              <span class="text-[11px] text-slate-400 dark:text-slate-500">Play pleasant audio chimes on task start and timer finish</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={localSettings.soundEnabled}
              on:click={() => localSettings.soundEnabled = !localSettings.soundEnabled}
              class="relative w-9 h-5 rounded-full transition-colors shrink-0 cursor-pointer {localSettings.soundEnabled ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}"
            >
              <span class="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-xs transition-transform {localSettings.soundEnabled ? 'translate-x-4' : 'translate-x-0'}"></span>
            </button>
          </div>
        </div>
      {/if}

    </div>

    <!-- Modal Footer -->
    <div class="px-5 py-3 border-t border-slate-100 dark:border-[#333333] flex items-center justify-end space-x-2 bg-slate-50/50 dark:bg-[#1a1a1a]">
      <button
        type="button"
        on:click={onClose}
        class="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/70 dark:hover:bg-[#2c2c2c] transition-colors"
      >
        Cancel
      </button>
      <button
        type="button"
        on:click={handleSave}
        disabled={isSaving}
        class="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors disabled:opacity-60"
      >
        {isSaving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>

  </div>
</div>
