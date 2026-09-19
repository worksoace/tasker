import { Task, WorkSchedule, AIResponsePayload } from './types';

const NVIDIA_CHAT_ENDPOINT = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_MODELS_ENDPOINT = 'https://integrate.api.nvidia.com/v1/models';

// Known-working models in priority order (updated Nov 2024 – Sep 2026 era)
export const PREFERRED_MODELS = [
  'meta/llama-3.3-70b-instruct',
  'meta/llama-3.2-90b-vision-instruct',
  'meta/llama-3.2-11b-vision-instruct',
  'meta/llama-3.2-3b-instruct',
  'meta/llama-3.2-1b-instruct',
  'nvidia/llama-3.3-nemotron-super-49b-v1',
  'nvidia/llama-3.1-nemotron-nano-8b-v1',
  'nvidia/mistral-nemo-minitron-8b-8k-instruct',
  'google/gemma-2-27b-it',
  'google/gemma-2-9b-it',
  'google/gemma-2-2b-it',
  'microsoft/phi-3.5-mini-instruct',
  'microsoft/phi-3-mini-128k-instruct',
  'mistralai/mistral-7b-instruct-v0.3',
  'mistralai/mistral-large',
  'mistralai/mistral-nemo',
  'deepseek-ai/deepseek-r1',
  'qwen/qwen2.5-72b-instruct',
  'qwen/qwen2.5-7b-instruct',
  'ibm/granite-3.1-8b-instruct',
  'ibm/granite-3.0-8b-instruct',
];

// Models known to be end-of-life — skip immediately without even trying
const DEAD_MODELS = new Set([
  'meta/llama-3.1-70b-instruct',
  'meta/llama-3.1-8b-instruct',
  'meta/llama-3.1-405b-instruct',
  'nvidia/llama-3.1-nemotron-70b-instruct',
  'mistralai/mixtral-8x7b-instruct-v0.1',
  'mistralai/mixtral-8x22b-instruct-v0.1',
  'mistralai/mistral-7b-instruct-v0.2',
  'mistralai/mistral-7b-instruct-v0.1',
]);

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 12000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

export async function fetchNvidiaModels(apiKey: string, customBaseUrl?: string): Promise<{ success: boolean; models: string[]; message?: string }> {
  if (!apiKey?.trim()) {
    return { success: false, models: [], message: 'API Key is empty.' };
  }
  const endpoint = customBaseUrl
    ? `${customBaseUrl.replace(/\/+$/, '')}/models`
    : NVIDIA_MODELS_ENDPOINT;
  try {
    const res = await fetchWithTimeout(endpoint, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey.trim()}` }
    }, 8000);
    const text = await res.text();
    if (!res.ok) return { success: false, models: [], message: `HTTP ${res.status}: ${text.slice(0, 150)}` };
    const data = JSON.parse(text);
    const modelIds = Array.isArray(data.data) ? data.data.map((m: any) => m.id).filter(Boolean) : [];
    return { success: true, models: modelIds };
  } catch (err: any) {
    return { success: false, models: [], message: err.name === 'AbortError' ? 'Timed out fetching models' : err.message };
  }
}

export const GROQ_MODELS = [
  'openai/gpt-oss-20b',
  'openai/gpt-oss-120b',
  'groq/compound-mini',
  'groq/compound',
  'qwen/qwen3.6-27b',
  'qwen/qwen3.8-27b',
  'llama-3.1-8b-instant',
  'llama-3.3-70b-versatile',
  'mixtral-8x7b-32768',
  'gemma2-9b-it'
];

function isChatModel(id: string): boolean {
  const lower = id.toLowerCase();
  return !lower.includes('whisper') &&
         !lower.includes('guard') &&
         !lower.includes('orpheus') &&
         !lower.includes('tts') &&
         !lower.includes('embedding');
}

// Quick test — send "Say OK", return true if 200
async function probeModel(chatEndpoint: string, apiKey: string, model: string): Promise<{ ok: boolean; status: number; body: string }> {
  try {
    const res = await fetchWithTimeout(chatEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey.trim()}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: 'Say OK' }],
        max_tokens: 5,
        temperature: 0.1
      })
    }, 4000);
    const body = await res.text();
    return { ok: res.ok, status: res.status, body: body.slice(0, 150) };
  } catch (err: any) {
    const msg = err.name === 'AbortError' ? 'TIMEOUT' : (err.message || 'unknown error');
    return { ok: false, status: 0, body: msg };
  }
}

// Build a smart ordered list: preferred first (if in account), then other instruct models
function buildTestList(selectedModel: string, accountModels: string[], isGroq: boolean = false): string[] {
  if (isGroq) {
    const liveSet = new Set(accountModels);
    const orderedGroq: string[] = [];
    if (selectedModel && isChatModel(selectedModel)) orderedGroq.push(selectedModel);

    // Preferred Groq models from user's account or predefined list
    for (const m of GROQ_MODELS) {
      if ((liveSet.size === 0 || liveSet.has(m)) && !orderedGroq.includes(m)) {
        orderedGroq.push(m);
      }
    }
    // Any remaining account chat models
    for (const m of accountModels) {
      if (isChatModel(m) && !orderedGroq.includes(m)) {
        orderedGroq.push(m);
      }
    }
    return orderedGroq.length > 0 ? orderedGroq : GROQ_MODELS;
  }

  const liveSet = new Set(accountModels);

  // Priority 1: PREFERRED_MODELS that appear in the account list
  const preferredAndLive = PREFERRED_MODELS.filter(m => liveSet.has(m) && !DEAD_MODELS.has(m));

  // Priority 2: All other account instruct/chat models not already covered
  const otherLive = accountModels.filter(m =>
    !DEAD_MODELS.has(m) &&
    !preferredAndLive.includes(m) &&
    (m.includes('instruct') || m.includes('chat') || m.endsWith('-it') || m.includes('generate'))
  );

  // Priority 3: PREFERRED_MODELS even if not listed
  const fallback = PREFERRED_MODELS.filter(m => !liveSet.has(m) && !DEAD_MODELS.has(m));

  // Build ordered, deduplicated list
  const ordered: string[] = [];
  if (selectedModel && !DEAD_MODELS.has(selectedModel)) ordered.push(selectedModel);
  ordered.push(...preferredAndLive, ...otherLive, ...fallback);
  return [...new Set(ordered)];
}

export async function runAIDiagnostics(apiKey: string, selectedModel: string, customBaseUrl?: string): Promise<{
  logs: string[];
  modelsList: string[];
  workingModel: string | null;
  rawError?: string;
}> {
  const logs: string[] = [];
  const log = (msg: string) => logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);

  const isGroq = Boolean(customBaseUrl && customBaseUrl.includes('groq.com'));
  log(`Key: ${apiKey.slice(0, 8)}... (length ${apiKey.length})`);

  const chatEndpoint = customBaseUrl
    ? `${customBaseUrl.replace(/\/+$/, '')}/chat/completions`
    : NVIDIA_CHAT_ENDPOINT;

  log(`Endpoint: ${chatEndpoint}`);

  let accountModels: string[] = [];
  log('Fetching available models from catalog...');
  const modelsRes = await fetchNvidiaModels(apiKey, customBaseUrl);
  if (modelsRes.success && modelsRes.models.length > 0) {
    accountModels = isGroq ? modelsRes.models.filter(isChatModel) : modelsRes.models;
    const aliveCount = isGroq ? accountModels.length : accountModels.filter(m => !DEAD_MODELS.has(m)).length;
    log(`✅ Found ${accountModels.length} models in catalog${isGroq ? '' : ` (${aliveCount} non-deprecated)`}.`);
  } else {
    log(`⚠️ Catalog list skipped (${modelsRes.message || 'not supported'}) — testing popular models directly.`);
  }

  // Step 2: Build smart test order
  const testList = buildTestList(selectedModel, accountModels, isGroq);
  log(`Testing ${Math.min(testList.length, 15)} models in fast parallel batches...`);

  let workingModel: string | null = null;
  let lastError = '';
  let skipped410 = 0;
  let testedCount = 0;

  // Test in batches of 3 for fast response (max 5 batches = 15 models)
  const batchSize = 3;
  for (let i = 0; i < Math.min(testList.length, 15); i += batchSize) {
    const batch = testList.slice(i, i + batchSize);
    log(`Testing batch: ${batch.join(', ')}...`);

    const batchResults = await Promise.all(
      batch.map(async m => ({
        model: m,
        result: await probeModel(chatEndpoint, apiKey, m)
      }))
    );

    for (const { model, result } of batchResults) {
      testedCount++;
      if (result.ok) {
        log(`🎉 WORKS! "${model}" responded successfully.`);
        workingModel = model;
        break;
      }

      if (result.status === 410) {
        skipped410++;
        log(`   ↳ "${model}": 410 End of Life`);
        lastError = 'All tested models are deprecated (410 End of Life).';
      } else if (result.status === 404) {
        log(`   ↳ "${model}": 404 Not Found`);
        lastError = 'HTTP 404: model not found.';
      } else if (result.status === 401 || result.status === 403) {
        log(`❌ "${model}": Authentication failed (401/403).`);
        lastError = 'Invalid API key. Please check your key.';
      } else if (result.body === 'TIMEOUT') {
        log(`   ↳ "${model}": Timed out (>4s)`);
        lastError = 'Request timed out.';
      } else {
        log(`   ↳ "${model}": HTTP ${result.status} ${result.body.slice(0, 50)}`);
        lastError = `HTTP ${result.status}`;
      }
    }

    if (workingModel) break;
    if (lastError.includes('Invalid API key')) break;
  }

  if (skipped410 >= 3 && !workingModel) {
    log(`⚠️ Multiple models returned 410 End of Life.`);
    log(`💡 Tip: Switch to Groq (Free & Fast) in Settings!`);
  }

  if (workingModel) {
    log(`✅ Ready to use model: "${workingModel}"`);
  } else {
    log(`❌ No responding model found after testing ${testedCount} candidates.`);
  }

  return { logs, modelsList: accountModels, workingModel, rawError: lastError };
}


export async function testNvidiaConnection(apiKey: string, model: string = 'meta/llama-3.3-70b-instruct', customBaseUrl?: string): Promise<{
  success: boolean;
  message: string;
  workingModel?: string;
  availableModels?: string[];
  diagnosticLogs?: string[];
}> {
  const diag = await runAIDiagnostics(apiKey, model, customBaseUrl);
  if (diag.workingModel) {
    return {
      success: true,
      message: `Connected! Working model: "${diag.workingModel}"`,
      workingModel: diag.workingModel,
      availableModels: diag.modelsList,
      diagnosticLogs: diag.logs
    };
  }
  return {
    success: false,
    message: diag.rawError || 'No working model found.',
    availableModels: diag.modelsList,
    diagnosticLogs: diag.logs
  };
}

// Session-level model cache: avoid re-discovering every message
let sessionWorkingModel: string | null = null;

export async function processAIChat({
  apiKey,
  model,
  messages,
  schedule,
  existingTasks,
  currentDateStr,
  currentTimeStr,
  customBaseUrl
}: {
  apiKey: string;
  model: string;
  messages: Array<{ role: string; content: string }>;
  schedule: WorkSchedule;
  existingTasks: Task[];
  currentDateStr: string;
  currentTimeStr: string;
  customBaseUrl?: string;
}): Promise<AIResponsePayload> {
  if (!apiKey?.trim()) {
    throw new Error('API Key is missing. Please add your key in Settings → AI Connection.');
  }

  const chatEndpoint = customBaseUrl
    ? `${customBaseUrl.replace(/\/+$/, '')}/chat/completions`
    : NVIDIA_CHAT_ENDPOINT;

  const workDaysMap = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const activeDays = (schedule.workDays || [1, 2, 3, 4, 5]).map(d => workDaysMap[d]).join(', ');

  const [currY, currM, currD] = currentDateStr.split('-').map(Number);
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const baseDate = new Date(currY, (currM || 1) - 1, currD || 1);
  const todayDayName = weekdays[baseDate.getDay()];

  // Pre-calculate reference calendar for Today, Tomorrow, and the upcoming 7 days
  const upcomingCalendar: string[] = [];
  for (let offset = 0; offset <= 7; offset++) {
    const d = new Date(currY, (currM || 1) - 1, (currD || 1) + offset);
    const yStr = d.getFullYear();
    const mStr = String(d.getMonth() + 1).padStart(2, '0');
    const dStr = String(d.getDate()).padStart(2, '0');
    const dayName = weekdays[d.getDay()];
    const rel = offset === 0 ? 'Today' : offset === 1 ? 'Tomorrow' : offset === 2 ? 'Day after tomorrow' : `This ${dayName}`;
    upcomingCalendar.push(`- ${rel} (${dayName}): ${yStr}-${mStr}-${dStr}`);
  }

  const activeTasksSummary = existingTasks
    .filter(t => !t.completed)
    .map(t => `- [${t.id}] "${t.title}" | Date: ${t.scheduledDate || currentDateStr} | Time: ${t.scheduledTime || 'Unscheduled'} | Duration: ${t.durationMinutes || 30}m | Priority: ${t.priority || 'normal'}`)
    .join('\n');

  const systemPrompt = `You are Tasker, an intuitive, cheerful, and expert personal task assistant & daily scheduler.
Your goal is to converse with the user in plain, friendly English, organize their thoughts into clear actionable tasks, and schedule their days (from early morning to late night, today or any future day).

CURRENT CONTEXT & CALENDAR REFERENCE:
- Today's Date: ${currentDateStr} (${todayDayName})
- Current Local Time: ${currentTimeStr}
- Buffer between tasks: ${schedule.bufferMinutes || 10} minutes
- Default task duration: ${schedule.defaultTaskDuration || 30} minutes

UPCOMING DATES REFERENCE (Use these exact YYYY-MM-DD values):
${upcomingCalendar.join('\n')}

CURRENT UNCOMPLETED TASKS:
${activeTasksSummary || '(No tasks scheduled yet)'}

RULES:
1. FULL DAY SCHEDULING (NO WORK HOUR RESTRICTIONS):
   - You schedule for the ENTIRE DAY (morning, afternoon, evening, night). Tasks can be scheduled at ANY time across the full 24-hour day (00:00 to 23:59).
   - NEVER refuse, reject, or complain that a requested time is "outside work hours".
   - When the user specifies any time (e.g. "7:41am", "7:51", "at 8:00", "12:30", "10:30pm", "23:00"), ALWAYS schedule it at that EXACT requested time in 24h format (e.g. "07:41", "07:51", "12:30", "22:30").

2. MULTI-TASK ITINERARIES & NARRATIVES OF THE DAY:
   - When the user describes a routine, day plan, or list of activities (e.g. "I work till 9:30, then help Aunty G 9:50 to 2pm, then bank, then hilltop at 3pm, freshen up 4-4:30pm, campus prayer 5pm, fellowship 5:30-8pm, return equipments till 9:30pm, pray 11pm-1am"):
     * You MUST break down EVERY SINGLE mentioned event/action into a distinct task in "tasksToCreate"!
     * Calculate start times and durations accurately in minutes (e.g. 9:50 to 14:00 is 250 minutes; 16:00 to 16:30 is 30 minutes; 17:30 to 20:00 is 150 minutes; 23:00 to 01:00 is 120 minutes).
     * If an activity stretches past midnight or mentions tomorrow (e.g. "pray from 11pm - 1am tomorrow"), set scheduledDate to tomorrow's date for any tasks starting tomorrow.
   - If the user mentions that they have ALREADY COMPLETED or finished certain tasks (e.g. "ive done the unassign subject functionality and bug fixes"):
     * Match these against existing tasks and put them in "tasksToUpdate" with "completed": true!

3. MULTI-DAY & FUTURE SCHEDULING:
   - When the user mentions "tomorrow", "next day", "Friday", "this Saturday", etc., look up the exact YYYY-MM-DD from the UPCOMING DATES REFERENCE and set "scheduledDate".
   - If no date is mentioned or implied, default "scheduledDate" to today's date ("${currentDateStr}").

4. RESCHEDULING, DURATION CHANGES & CORRECTIONS:
   - When the user asks to change or set a task's duration (e.g. "change duration to 2hrs", "make test 2 hours"):
     Convert the duration to total minutes (e.g. 2hrs = 120) and put in "tasksToUpdate" with "durationMinutes": 120.
   - When the user corrects or changes a time (e.g. "not 1:55, 7:51" or "move test to 7:51"), update "scheduledTime" to "07:51" in "tasksToUpdate".

5. CRITICAL: The user's screen schedule ONLY updates when you populate "tasksToCreate" or "tasksToUpdate"! Never just say "Schedule updated!" or describe the schedule in text without including the JSON task objects in "tasksToCreate".

OUTPUT FORMAT:
Output ONLY a valid JSON object matching this schema:
{
  "reply": "Friendly concise response confirming the tasks and schedule",
  "tasksToCreate": [
    {
      "title": "Help Aunty G at Unisec",
      "priority": "medium",
      "durationMinutes": 250,
      "scheduledTime": "09:50",
      "scheduledDate": "${currentDateStr}",
      "notes": ""
    }
  ],
  "tasksToUpdate": [
    {
      "titleMatch": "unassign subject",
      "completed": true
    }
  ],
  "tasksToDelete": [],
  "scheduleAdvice": "Optional short advice or tip"
}`;

  const isGroq = Boolean(customBaseUrl && customBaseUrl.includes('groq.com'));

  // Build candidate list:
  const buildCandidates = (): string[] => {
    const list: string[] = [];
    if (sessionWorkingModel) list.push(sessionWorkingModel);
    if (model && !DEAD_MODELS.has(model) && !list.includes(model)) list.push(model);
    const pool = isGroq ? GROQ_MODELS : PREFERRED_MODELS;
    for (const m of pool) {
      if (!DEAD_MODELS.has(m) && !list.includes(m)) list.push(m);
      if (list.length >= 5) break;
    }
    return list;
  };

  let candidates = buildCandidates();
  let needsDiscovery = false;
  let lastError = '';
  let successfulData: any = null;

  const tryModel = async (candidate: string): Promise<'ok' | 'dead' | 'auth' | 'timeout' | 'error'> => {
    try {
      // Send only recent messages to minimize prompt token overhead and latency
      const recentMessages = messages.slice(-8);

      const requestPayload: any = {
        model: candidate,
        messages: [{ role: 'system', content: systemPrompt }, ...recentMessages],
        temperature: 0.1,
        max_tokens: 3000
      };

      if (isGroq) {
        requestPayload.response_format = { type: 'json_object' };
      }

      const response = await fetchWithTimeout(chatEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey.trim()}` },
        body: JSON.stringify(requestPayload)
      }, 30000);

      const bodyText = await response.text();

      if (response.ok) {
        successfulData = JSON.parse(bodyText);
        sessionWorkingModel = candidate; // cache for future messages
        return 'ok';
      }

      if (response.status === 410 || response.status === 404) {
        lastError = `Model "${candidate}" is deprecated (410).`;
        return 'dead';
      }

      if (response.status === 401 || response.status === 403) {
        lastError = 'API key is invalid or expired. Please update it in Settings.';
        return 'auth';
      }

      let msg = `API Error (${response.status})`;
      try { const p = JSON.parse(bodyText); if (p.error?.message) msg = p.error.message; } catch {}
      lastError = msg;
      return 'error';
    } catch (err: any) {
      if (err.name === 'AbortError') {
        lastError = 'Request timed out (30s). Try a faster model in Settings.';
        return 'timeout';
      }
      lastError = err.message || 'Unknown error';
      return 'error';
    }
  };

  // First pass: try the candidate list
  for (const candidate of candidates) {
    const result = await tryModel(candidate);
    if (result === 'ok') break;
    if (result === 'auth' || result === 'error') {
      throw new Error(lastError);
    }
    if (result === 'dead') {
      // Clear cached model if it's dead
      if (sessionWorkingModel === candidate) sessionWorkingModel = null;
      needsDiscovery = true;
    }
  }

  // Second pass: auto-discover from account if all candidates were dead
  if (!successfulData && needsDiscovery) {
    const modelsRes = await fetchNvidiaModels(apiKey, customBaseUrl);
    if (modelsRes.success && modelsRes.models.length > 0) {
      const discoveredList = buildTestList('', modelsRes.models).slice(0, 20);
      for (const candidate of discoveredList) {
        if (candidates.includes(candidate)) continue; // already tried
        const result = await tryModel(candidate);
        if (result === 'ok') break;
        if (result === 'auth' || result === 'error') throw new Error(lastError);
      }
    }
  }

  if (!successfulData) {
    if (lastError.includes('410') || lastError.includes('deprecated')) {
      throw new Error(
        'All AI models on your NVIDIA account appear to be deprecated.\n\nFix: Go to Settings → click "Custom Endpoint / Provider Options" → select the Groq preset and enter a free Groq key from console.groq.com'
      );
    }
    throw new Error(lastError || 'Could not connect to AI. Check Settings → AI Connection.');
  }

  const rawContent = successfulData.choices?.[0]?.message?.content || '{}';
  return parseAIResponsePayload(rawContent, currentDateStr);
}

function normalizeTimeString(raw: string): string {
  if (!raw) return '';
  const clean = raw.trim();
  // Match 12h formats like "9:50 AM", "5:30pm", "11pm", "2am"
  const m12 = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const m = m12[2] || '00';
    const isPm = m12[3].toLowerCase() === 'pm';
    if (isPm && h < 12) h += 12;
    if (!isPm && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  }
  // Match 24h formats like "09:50", "9:50", "17:30", "23:00"
  const m24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const m = m24[2];
    return `${String(h).padStart(2, '0')}:${m}`;
  }
  return clean;
}

function normalizeTaskItem(item: any, defaultDate: string): any {
  if (!item || typeof item !== 'object') return null;

  // Title extraction across multiple common LLM key variations
  const title = (item.title || item.name || item.task || item.description || item.taskName || item.activity || '').toString().trim();
  if (!title) return null;

  // Time extraction and normalization
  let scheduledTime = item.scheduledTime || item.scheduled_time || item.time || item.startTime || item.start_time || item.start || item.at;
  if (scheduledTime) {
    scheduledTime = normalizeTimeString(scheduledTime.toString());
  }

  // Duration extraction and normalization (e.g. "250", "250m", "2h", "2 hours", 250)
  let durationMinutes = 30;
  const rawDur = item.durationMinutes ?? item.duration_minutes ?? item.duration ?? item.length ?? item.mins ?? item.minutes;
  if (typeof rawDur === 'number' && !isNaN(rawDur)) {
    durationMinutes = rawDur;
  } else if (typeof rawDur === 'string') {
    const durMatch = rawDur.match(/(\d+(?:\.\d+)?)\s*(h|hr|hour|min|m)?/i);
    if (durMatch) {
      const val = parseFloat(durMatch[1]);
      const unit = (durMatch[2] || 'm').toLowerCase();
      durationMinutes = unit.startsWith('h') ? Math.round(val * 60) : Math.round(val);
    }
  }

  // Date extraction
  let scheduledDate = item.scheduledDate || item.scheduled_date || item.date || item.day || defaultDate;

  return {
    title,
    scheduledTime: scheduledTime || undefined,
    durationMinutes: durationMinutes || 30,
    scheduledDate: scheduledDate || defaultDate,
    priority: item.priority || 'none',
    notes: item.notes || item.note || ''
  };
}

function parseAIResponsePayload(rawContent: string, defaultDate: string): AIResponsePayload {
  let jsonString = rawContent.trim();
  
  // 1. Strip markdown code blocks
  const codeBlockMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch) {
    jsonString = codeBlockMatch[1].trim();
  } else {
    const firstBrace = jsonString.indexOf('{');
    const lastBrace = jsonString.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonString = jsonString.substring(firstBrace, lastBrace + 1).trim();
    } else {
      const firstBracket = jsonString.indexOf('[');
      const lastBracket = jsonString.lastIndexOf(']');
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        jsonString = jsonString.substring(firstBracket, lastBracket + 1).trim();
      }
    }
  }

  let parsed: any = null;

  // 2. Direct JSON parse
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    // 3. Attempt JSON syntax repair (trailing commas, unescaped newlines, unclosed braces)
    try {
      let repaired = jsonString
        .replace(/,\s*([}\]])/g, '$1')
        .replace(/\r?\n/g, ' ');

      const openBraces = (repaired.match(/{/g) || []).length;
      const closeBraces = (repaired.match(/}/g) || []).length;
      if (openBraces > closeBraces) repaired += '}'.repeat(openBraces - closeBraces);

      const openBrackets = (repaired.match(/\[/g) || []).length;
      const closeBrackets = (repaired.match(/]/g) || []).length;
      if (openBrackets > closeBrackets) repaired += ']'.repeat(openBrackets - closeBrackets);

      parsed = JSON.parse(repaired);
    } catch {
      parsed = null;
    }
  }

  const tasksToCreate: any[] = [];
  const tasksToUpdate: any[] = [];
  const tasksToDelete: any[] = [];
  let reply = 'Schedule updated!';
  let scheduleAdvice: string | undefined = undefined;

  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed)) {
      // Direct array of tasks returned
      for (const item of parsed) {
        const normalized = normalizeTaskItem(item, defaultDate);
        if (normalized) tasksToCreate.push(normalized);
      }
    } else {
      reply = parsed.reply || parsed.message || parsed.response || 'Schedule updated!';
      scheduleAdvice = parsed.scheduleAdvice || parsed.tip || parsed.advice;

      // Extract tasks across all common LLM aliases
      const candidateCreateLists = [
        parsed.tasksToCreate,
        parsed.tasks_to_create,
        parsed.tasks,
        parsed.newTasks,
        parsed.new_tasks,
        parsed.schedule,
        parsed.todos,
        parsed.items,
        parsed.taskList
      ];

      for (const list of candidateCreateLists) {
        if (Array.isArray(list) && list.length > 0) {
          for (const item of list) {
            const normalized = normalizeTaskItem(item, defaultDate);
            if (normalized) tasksToCreate.push(normalized);
          }
          break;
        }
      }

      // Extract task updates
      const candidateUpdateLists = [
        parsed.tasksToUpdate,
        parsed.tasks_to_update,
        parsed.updatedTasks,
        parsed.updated_tasks,
        parsed.updates,
        parsed.completedTasks,
        parsed.completed_tasks
      ];

      for (const list of candidateUpdateLists) {
        if (Array.isArray(list) && list.length > 0) {
          for (const item of list) {
            if (typeof item === 'object') {
              tasksToUpdate.push({
                id: item.id,
                titleMatch: item.titleMatch || item.title || item.name || item.task,
                scheduledTime: item.scheduledTime ? normalizeTimeString(item.scheduledTime.toString()) : undefined,
                scheduledDate: item.scheduledDate || item.date,
                durationMinutes: item.durationMinutes ? parseInt(item.durationMinutes, 10) : undefined,
                completed: item.completed !== undefined ? Boolean(item.completed) : undefined,
                priority: item.priority
              });
            }
          }
          break;
        }
      }

      if (Array.isArray(parsed.tasksToDelete || parsed.tasks_to_delete)) {
        tasksToDelete.push(...(parsed.tasksToDelete || parsed.tasks_to_delete));
      }
    }
  }

  // 4. Regex extraction fallback if structured extraction found nothing
  if (tasksToCreate.length === 0) {
    const taskRegex = /\{\s*"(?:title|name|task)"\s*:\s*"([^"]+)"(?:[^{}]*?"(?:durationMinutes|duration)"\s*:\s*(\d+))?(?:[^{}]*?"(?:scheduledTime|time)"\s*:\s*"([^"]+)")?(?:[^{}]*?"(?:scheduledDate|date)"\s*:\s*"([^"]+)")?[^{}]*?\}/gi;
    let match;
    while ((match = taskRegex.exec(rawContent)) !== null) {
      tasksToCreate.push({
        title: match[1],
        durationMinutes: match[2] ? parseInt(match[2], 10) : 30,
        scheduledTime: match[3] ? normalizeTimeString(match[3]) : undefined,
        scheduledDate: match[4] || defaultDate,
        priority: 'none'
      });
    }

    if (!parsed?.reply) {
      const replyMatch = rawContent.match(/"reply"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"/);
      if (replyMatch) {
        reply = replyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
      } else if (tasksToCreate.length > 0) {
        reply = "I've organized your schedule for today!";
      }
    }
  }

  return {
    reply,
    tasksToCreate,
    tasksToUpdate,
    tasksToDelete,
    scheduleAdvice
  };
}
