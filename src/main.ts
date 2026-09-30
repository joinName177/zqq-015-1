import './ui/styles.css';
import { IdiomCatalogAdapter } from './adapters/idiom-catalog.adapter';
import { IdiomExtractor } from './core/extractor';
import type { Candidate, QueueItem } from './core/models';
import { compareTwo } from './core/compare';
import type { CompareTarget } from './core/compare';
import { renderApp } from './ui/app';
import type { AppState } from './ui/app';
import { SAMPLES } from './ui/samples';

const STORE_KEY = 'pianyu-kaoxin:v1';

/* ---------------- 依赖装配（端口 → 适配器） ---------------- */
const catalog = new IdiomCatalogAdapter();
const extractor = new IdiomExtractor(catalog);
const rootEl = document.getElementById('app')!;

/* ---------------- 持久化（容错读取，坏数据不影响启动） ---------------- */
interface PersistShape {
  queue?: QueueItem[];
  input?: string;
}
function loadPersisted(): PersistShape {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistShape;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
function persist() {
  try {
    const payload: PersistShape = { queue: state.queue, input: state.inputText };
    localStorage.setItem(STORE_KEY, JSON.stringify(payload));
  } catch {
    /* 存储不可用（隐私模式等）时静默降级 */
  }
}

const persisted = loadPersisted();

const state: AppState = {
  inputText: typeof persisted.input === 'string' ? persisted.input : '',
  result: null,
  queue: Array.isArray(persisted.queue) ? persisted.queue : [],
  slots: [null, null],
  compare: null,
  busy: false,
  toast: null,
  elapsedMs: null,
  catalogCount: catalog.entries().length,
  filter: 'all',
  dirty: false,
};

let toastTimer: number | undefined;
function showToast(msg: string, sticky = false) {
  state.toast = msg;
  render();
  window.clearTimeout(toastTimer);
  if (!sticky) toastTimer = window.setTimeout(() => { state.toast = null; render(); }, 2600);
}

function render() {
  renderApp(rootEl, state, handlers);
}

/* ---------------- 业务动作 ---------------- */

function runAnalyze(text: string) {
  const keptInput = state.inputText; // 输入始终保留在 state 中
  if (!text.trim()) {
    showToast('原文为空，请先粘贴或载入一段古文。');
    return;
  }
  state.busy = true;
  render();

  // 下一帧再执行，保证"解析中"可以绘制；全程 try/catch，失败不破坏内容
  requestAnimationFrame(() => {
    try {
      const t0 = performance.now();
      const result = extractor.analyze(text);
      state.elapsedMs = Math.round(performance.now() - t0);
      state.result = result;
      state.filter = 'all';
      state.dirty = false;
      if (!result.candidates.length) {
        showToast('解析完成，但未识别到成语片段。');
      } else {
        showToast(`解析完成，共标出 ${result.candidates.length} 个候选片段。`);
      }
    } catch (err) {
      // 关键要求：解析失败不能破坏当前内容与已有结果
      console.error('[idiom] analyze failed:', err);
      state.result = state.result; // 保留上一次结果
      state.inputText = keptInput;
      showToast('解析过程中发生异常，已保留当前原文与上次结果，可重试。', true);
    } finally {
      state.busy = false;
      persist();
      render();
    }
  });
}

function setCandidateStatus(id: string, status: Candidate['status']) {
  const c = state.result?.candidates.find((x) => x.id === id);
  if (!c) return;
  c.status = status;

  if (status === 'confirmed') {
    const key = c.entry?.idiom ?? c.text;
    if (!state.queue.some((q) => q.key === key)) {
      const radius = 10;
      state.queue.push({
        key,
        idiom: c.entry?.idiom ?? c.text,
        matchedText: c.text,
        kind: c.kind,
        confidence: c.confidence,
        source: c.entry?.source ?? '未入辞书 · 结构推断',
        gloss: c.entry?.gloss ?? '（人工确认的疑似片段）',
        before: state.inputText.slice(Math.max(0, c.start - radius), c.start),
        after: state.inputText.slice(c.end, Math.min(state.inputText.length, c.end + radius)),
        addedAt: Date.now(),
      });
      showToast(`「${key}」已进入对比队列。`);
    } else {
      showToast(`「${key}」已在对比队列中。`);
    }
  }
  persist();
  render();
}

function recomputeCompare() {
  const [ka, kb] = state.slots;
  if (ka && kb) {
    const qa = state.queue.find((q) => q.key === ka);
    const qb = state.queue.find((q) => q.key === kb);
    if (qa && qb) {
      state.compare = compareTwo(qa as CompareTarget, qb as CompareTarget);
      return;
    }
  }
  state.compare = null;
}

const handlers = {
  onAnalyze: (text: string) => runAnalyze(text),

  onInputChange: () => {
    if (state.result && !state.dirty) state.dirty = true;
    persist();
  },

  onSetStatus: setCandidateStatus,

  onConfirmAll: () => {
    if (!state.result) return;
    let added = 0;
    for (const c of state.result.candidates) {
      if (c.status === 'ignored') continue;
      const key = c.entry?.idiom ?? c.text;
      if (state.queue.some((q) => q.key === key)) {
        c.status = 'confirmed';
        continue;
      }
      c.status = 'confirmed';
      const radius = 10;
      state.queue.push({
        key,
        idiom: c.entry?.idiom ?? c.text,
        matchedText: c.text,
        kind: c.kind,
        confidence: c.confidence,
        source: c.entry?.source ?? '未入辞书 · 结构推断',
        gloss: c.entry?.gloss ?? '（人工确认的疑似片段）',
        before: state.inputText.slice(Math.max(0, c.start - radius), c.start),
        after: state.inputText.slice(c.end, Math.min(state.inputText.length, c.end + radius)),
        addedAt: Date.now(),
      });
      added++;
    }
    persist();
    render();
    showToast(added ? `已将 ${added} 个新候选全部确认入队。` : '全部候选此前已在队列中。');
  },

  onIgnoreAllHeuristics: () => {
    if (!state.result) return;
    let n = 0;
    for (const c of state.result.candidates) {
      if (c.kind === 'heuristic' && c.status === 'pending') {
        c.status = 'ignored';
        n++;
      }
    }
    render();
    showToast(n ? `已忽略 ${n} 条结构疑似候选。` : '没有待处理的疑似候选。');
  },

  onClearInput: () => {
    state.inputText = '';
    state.result = null;
    state.elapsedMs = null;
    state.filter = 'all';
    state.dirty = false;
    persist();
    render();
  },

  onLocate: (c: Candidate) => {
    const ta = rootEl.querySelector<HTMLTextAreaElement>('#src-input');
    if (!ta) return;
    ta.focus();
    try {
      ta.setSelectionRange(c.start, c.end);
      ta.scrollTop = Math.max(0, (c.start / Math.max(1, state.inputText.length)) * ta.scrollHeight - 60);
    } catch {
      /* 下标失效时忽略 */
    }
    showToast(`已在原文中选中「${c.text}」。`);
  },

  onAddSample: (index: number) => {
    const s = SAMPLES[index];
    if (!s) return;
    state.inputText = s.text;
    persist();
    runAnalyze(s.text);
  },

  onQueueRemove: (key: string) => {
    state.queue = state.queue.filter((q) => q.key !== key);
    state.slots = state.slots.map((k) => (k === key ? null : k));
    recomputeCompare();
    persist();
    render();
  },

  onQueueClear: () => {
    state.queue = [];
    state.slots = [null, null];
    state.compare = null;
    persist();
    render();
  },

  onSlotToggle: (slot: 0 | 1, key: string) => {
    const other = slot === 0 ? 1 : 0;
    // 同一条不能同时占两个槽
    if (state.slots[other] === key) state.slots[other] = null;
    state.slots[slot] = state.slots[slot] === key ? null : key;
    recomputeCompare();
    render();
  },
};

render();
