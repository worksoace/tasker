<script lang="ts">
  import { onMount, afterUpdate } from 'svelte';
  import { 
    chatMessages, 
    isAILoading, 
    sendUserMessage, 
    resetConversation,
    settings,
    formatTimeFriendly,
    toggleTaskCompletion
  } from '../store/todoStore';
  import type { ChatMessage } from '../../main/types';
  import appLogo from '../assets/appicon.png';

  export let onOpenSettings: () => void = () => {};

  let messageInput = '';
  let chatContainer: HTMLDivElement;
  let textareaEl: HTMLTextAreaElement;
  let copiedId: string | null = null;
  let copyTimeout: any = null;

  function autoResize() {
    if (textareaEl) {
      textareaEl.style.height = 'auto';
      const nextHeight = Math.min(Math.max(textareaEl.scrollHeight, 38), 210);
      textareaEl.style.height = `${nextHeight}px`;
    }
  }

  function scrollToBottom() {
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  }

  afterUpdate(() => {
    scrollToBottom();
  });

  onMount(() => {
    scrollToBottom();
    autoResize();
  });

  async function handleSend() {
    if (!messageInput.trim() || $isAILoading) return;
    const text = messageInput;
    messageInput = '';
    setTimeout(autoResize, 0);
    await sendUserMessage(text);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleCopy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      copiedId = id;
      if (copyTimeout) clearTimeout(copyTimeout);
      copyTimeout = setTimeout(() => {
        copiedId = null;
      }, 1800);
    } catch (e) {
      console.error('Failed to copy', e);
    }
  }

  async function handleRetry(msgIndex: number) {
    if ($isAILoading) return;
    const msg = $chatMessages[msgIndex];
    if (!msg) return;

    let textToRetry = '';
    if (msg.role === 'user') {
      textToRetry = msg.content;
    } else {
      // Find previous user message
      for (let i = msgIndex - 1; i >= 0; i--) {
        if ($chatMessages[i].role === 'user') {
          textToRetry = $chatMessages[i].content;
          break;
        }
      }
    }

    if (textToRetry) {
      await sendUserMessage(textToRetry);
    }
  }
</script>

<div class="h-full flex flex-col bg-white dark:bg-[#292929] border-r border-slate-200 dark:border-[#333333] transition-colors relative overflow-hidden">
  
  <!-- API Key Missing Notice Banner (Minimal without emojis) -->
  {#if !$settings.ai.apiKey}
    <div class="bg-blue-50/70 dark:bg-blue-950/40 border-b border-blue-200/60 dark:border-blue-900/50 px-4 py-2.5 flex items-center justify-between z-10 shrink-0">
      <div class="flex items-center space-x-2 text-xs text-blue-900 dark:text-blue-200">
        <svg class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
        <span>Connect your API Key to enable smart task scheduling</span>
      </div>
      <button 
        on:click={onOpenSettings}
        class="text-xs font-semibold px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors shadow-2xs shrink-0"
      >
        Set Up
      </button>
    </div>
  {/if}

  <!-- Messages Scroll Area with clearance for floating input dock -->
  <div bind:this={chatContainer} class="flex-1 overflow-y-auto px-4 pt-3 pb-28 space-y-3.5">
    {#each $chatMessages as msg, idx (msg.id)}
      <div class="flex flex-col {msg.role === 'user' ? 'items-end' : 'items-start'} fade-in group relative">
        
        <!-- Role badge for assistant -->
        {#if msg.role === 'assistant'}
          <div class="flex items-center space-x-1.5 mb-1 px-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span class="text-[11px] font-semibold text-slate-400 dark:text-slate-500">Tasker</span>
          </div>
        {/if}

        <!-- Message Bubble Container with Actions -->
        <div class="relative max-w-[88%] group/bubble">
          <div class="rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-2xs transition-all {
            msg.role === 'user' 
              ? 'bg-blue-600 text-white rounded-tr-xs shadow-sm' 
              : 'bg-slate-100/90 dark:bg-[#1f1f1f] text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-[#333333] rounded-tl-xs'
          }">
            <div class="whitespace-pre-wrap">{msg.content}</div>

            <!-- Schedule Advice Tip if any -->
            {#if msg.scheduleAdvice}
              <div class="mt-2 pt-1.5 border-t border-slate-200/50 dark:border-[#303030] text-xs font-normal text-slate-500 dark:text-slate-400 flex items-start space-x-1.5">
                <svg class="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{msg.scheduleAdvice}</span>
              </div>
            {/if}

            <!-- Automatically Created Tasks Card list inside chat -->
            {#if msg.createdTasks && msg.createdTasks.length > 0}
              <div class="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-[#444444] space-y-1.5">
                <div class="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                  <svg class="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Scheduled Tasks</span>
                </div>
                {#each msg.createdTasks as task}
                  <div class="bg-white dark:bg-[#282828] rounded-lg p-2 border border-slate-200 dark:border-[#3d3d3d] shadow-2xs flex items-center justify-between text-slate-800 dark:text-slate-200">
                    <div class="flex items-center space-x-2 min-w-0">
                      <button 
                        on:click={() => toggleTaskCompletion(task.id)}
                        class="w-4 h-4 rounded border {task.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-[#555555] hover:border-slate-400 dark:hover:border-[#777777] bg-white dark:bg-[#202020]'} flex items-center justify-center shrink-0 transition-colors"
                        title={task.completed ? 'Mark incomplete' : 'Mark complete'}
                      >
                        {#if task.completed}
                          <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                          </svg>
                        {/if}
                      </button>
                      <span class="text-xs font-medium truncate {task.completed ? 'line-through text-slate-400 dark:text-slate-500' : ''}">
                        {task.title}
                      </span>
                    </div>
                    <div class="flex items-center space-x-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium shrink-0 ml-2">
                      {#if task.scheduledTime}
                        <span class="bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 rounded border border-blue-100 dark:border-blue-900/60">
                          {formatTimeFriendly(task.scheduledTime, $settings.timeFormat)}
                        </span>
                      {/if}
                      {#if task.durationMinutes}
                        <span class="bg-slate-100 dark:bg-[#363636] px-1.5 py-0.2 rounded text-slate-600 dark:text-slate-300">
                          {task.durationMinutes}m
                        </span>
                      {/if}
                    </div>
                  </div>
                {/each}
              </div>
            {/if}
          </div>

          <!-- Message Actions: Copy & Retry (Appear on hover) -->
          <div class="opacity-0 group-hover/bubble:opacity-100 transition-opacity duration-150 flex items-center space-x-1 mt-1 px-1 {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
            <!-- Copy button -->
            <button
              on:click={() => handleCopy(msg.id, msg.content)}
              class="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-[#2c2c2c] transition-colors flex items-center space-x-1 text-[11px]"
              title="Copy text"
            >
              {#if copiedId === msg.id}
                <svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
                <span class="text-emerald-600 dark:text-emerald-400 text-[10px] font-medium">Copied</span>
              {:else}
                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              {/if}
            </button>

            <!-- Retry button -->
            <button
              on:click={() => handleRetry(idx)}
              disabled={$isAILoading}
              class="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:text-slate-500 dark:hover:text-slate-200 dark:hover:bg-[#2c2c2c] disabled:opacity-40 transition-colors"
              title="Retry / Re-generate response"
            >
              <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>

        </div>

      </div>
    {/each}

    <!-- Loading / Typing indicator -->
    {#if $isAILoading}
      <div class="flex items-start space-x-2 fade-in">
        <div class="bg-slate-100 dark:bg-[#323232] border border-slate-200/80 dark:border-[#404040] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center space-x-2 text-slate-500 dark:text-slate-400">
          <span class="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse"></span>
          <span class="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" style="animation-delay: 0.2s"></span>
          <span class="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-400 animate-pulse" style="animation-delay: 0.4s"></span>
          <span class="text-xs font-medium ml-1 text-slate-600 dark:text-slate-300">Scheduling...</span>
        </div>
      </div>
    {/if}
  </div>

  <!-- Floating Chat Input Dock -->
  <div class="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-white via-white/95 to-transparent dark:from-[#242424] dark:via-[#242424]/95 dark:to-transparent pt-7 pointer-events-none z-10">
    <div class="pointer-events-auto bg-white/95 dark:bg-[#202020]/95 backdrop-blur-md border border-slate-200/90 dark:border-[#3d3d3d] rounded-2xl shadow-lg hover:shadow-xl focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 dark:focus-within:ring-blue-900/40 transition-all p-1.5 flex flex-col">
      <div class="relative flex items-end">
        <textarea
          bind:this={textareaEl}
          bind:value={messageInput}
          on:input={autoResize}
          on:keydown={handleKeyDown}
          placeholder="Tell Tasker what you need to do..."
          rows="1"
          class="w-full px-3 py-2 bg-transparent border-0 resize-none text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none overflow-y-auto leading-relaxed"
          style="min-height: 38px; max-height: 190px;"
        ></textarea>
        <div class="pr-1.5 pb-1.5 shrink-0">
          <button
            type="button"
            on:click={handleSend}
            disabled={!messageInput.trim() || $isAILoading}
            class="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-25 text-white flex items-center justify-center transition-all shadow-sm cursor-pointer disabled:cursor-not-allowed active:scale-95"
            title="Send message"
            aria-label="Send message"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
      <div class="px-3 pb-1 pt-0.5 flex items-center justify-between text-[10.5px] text-slate-400 dark:text-slate-500 select-none border-t border-slate-100 dark:border-[#2b2b2b] mt-0.5">
        <span>Enter to send</span>
        <span>Shift + Enter for new line</span>
      </div>
    </div>
  </div>
</div>
