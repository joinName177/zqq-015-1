import type { AnalyzeResult, Candidate, QueueItem } from '../core/models';
import { confidenceTier, KIND_LABEL } from '../core/models';
import type { CompareResult } from '../core/compare';
import { SAMPLES } from './samples';

/* ------------------------------------------------------------------ */
/* 事件契约                                                            */
/* ------------------------------------------------------------------ */

export interface AppHandlers {
  onAnalyze(text: string): void;
  onInputChange(text: string): void;
  onSetStatus(id: string, status: Candidate['status']): void;
  onConfirmAll(): void;
  onIgnoreAllHeuristics(): void;
  onClearInput(): void;
  onLocate(c: Candidate): void;
  onAddSample(index: number): void;
  onQueueRemove(key: string): void;
  onQueueClear(): void;
  onSlotToggle(slot: 0 | 1, key: string): void;
}

export interface AppState {
  inputText: string;
  result: AnalyzeResult | null;
  queue: QueueItem[];
  slots: (string | null)[];
  compare: CompareResult | null;
  busy: boolean;
  toast: string | null;
  elapsedMs: number | null;
  catalogCount: number;
  filter: 'all' | 'exact' | 'variant' | 'heuristic';
  dirty: boolean;
}

/* ------------------------------------------------------------------ */
/* 小工具                                                              */
/* ------------------------------------------------------------------ */

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function contextSnippet(text: string, start: number, end: number, radius = 8) {
  const a = Math.max(0, start - radius);
  const b = Math.min(text.length, end + radius);
  return { before: text.slice(a, start), hit: text.slice(start, end), after: text.slice(end, b) };
}

function pct(c: number): string {
  return `${Math.round(c * 100)}%`;
}

const STALE_HTML = '<div class="stale-tip">⚠ 原文已改动，以下标注与候选为上一次解析结果，重新「开始识别」后刷新。</div>';

/* ------------------------------------------------------------------ */
/* 原文标注                                                            */
/* ------------------------------------------------------------------ */

function renderHighlight(text: string, result: AnalyzeResult): string {
  if (!result.candidates.length) {
    return `<div class="hl-empty">未在原文中检出成语片段。可换一段更长的典籍原文再试。</div>`;
  }
  const spans: string[] = [];
  let cursor = 0;
  for (const c of result.candidates) {
    if (c.start > cursor) spans.push(`<span class="hl-plain">${esc(text.slice(cursor, c.start))}</span>`);
    const tier = confidenceTier(c.confidence).cls;
    spans.push(
      `<button type="button" class="hl-mark hl-${c.kind} tier-${tier} st-${c.status}" ` +
        `data-locate="${c.id}" title="${KIND_LABEL[c.kind]} · ${pct(c.confidence)}">${esc(text.slice(c.start, c.end))}</button>`
    );
    cursor = c.end;
  }
  if (cursor < text.length) spans.push(`<span class="hl-plain">${esc(text.slice(cursor))}</span>`);
  return `<div class="hl-doc">${spans.join('')}</div>`;
}

/* ------------------------------------------------------------------ */
/* 候选卡片                                                            */
/* ------------------------------------------------------------------ */

function candidateCard(c: Candidate, text: string): string {
  const tier = confidenceTier(c.confidence);
  const ctx = contextSnippet(text, c.start, c.end);
  const source = c.entry
    ? `<span class="card-source" title="出处书证">📜 ${esc(c.entry.source)}</span>`
    : `<span class="card-source no-book">未入辞书 · 结构推断</span>`;
  const gloss = c.entry ? esc(c.entry.gloss) : '辞书无载，请结合上下文判断是否为成语';
  const canon =
    c.entry && c.entry.idiom !== c.text
      ? `<div class="card-canon">规范词目：<b>「${esc(c.entry.idiom)}」</b></div>`
      : '';
  const reasons = c.reasons.map((r) => `<li>${esc(r)}</li>`).join('');

  return `
  <article class="card kind-${c.kind} st-${c.status}" data-card="${c.id}">
    <header class="card-head">
      <div class="card-id">${c.id}</div>
      <div class="card-word">
        <h3>${esc(c.text)}</h3>
        ${canon}
      </div>
      <div class="badges">
        <span class="badge kind-badge kind-${c.kind}">${KIND_LABEL[c.kind]}</span>
        <span class="badge tier-badge tier-${tier.cls}">${tier.label} ${pct(c.confidence)}</span>
      </div>
    </header>

    <div class="card-conf">
      <div class="conf-bar"><i style="width:${pct(c.confidence)}" class="conf-fill tier-${tier.cls}"></i></div>
    </div>

    <p class="card-gloss">${gloss}</p>
    ${source}

    <blockquote class="card-ctx">
      <span class="ctx-before">${esc(ctx.before)}</span><mark>${esc(ctx.hit)}</mark><span class="ctx-after">${esc(ctx.after)}</span>
    </blockquote>

    <details class="card-evidence">
      <summary>判定证据（${c.reasons.length} 条）</summary>
      <ul>${reasons}</ul>
    </details>

    <footer class="card-actions">
      <button type="button" class="btn btn-primary" data-act="confirm" data-id="${c.id}" ${c.status === 'confirmed' ? 'disabled' : ''}>
        ${c.status === 'confirmed' ? '✓ 已入队列' : '确认入队'}
      </button>
      <button type="button" class="btn" data-act="locate" data-id="${c.id}">原文定位</button>
      <button type="button" class="btn btn-ghost" data-act="ignore" data-id="${c.id}" ${c.status === 'ignored' ? 'disabled' : ''}>
        ${c.status === 'ignored' ? '已忽略' : '忽略'}
      </button>
    </footer>
  </article>`;
}

/* ------------------------------------------------------------------ */
/* 对比队列                                                            */
/* ------------------------------------------------------------------ */

function queuePanel(state: AppState): string {
  const { queue, slots, compare } = state;
  const items = queue
    .map((q) => {
      const slotIdx = slots.indexOf(q.key);
      return `
      <li class="q-item ${slotIdx >= 0 ? 'in-slot' : ''}">
        <div class="q-main">
          <span class="q-word">${esc(q.idiom)}</span>
          <span class="q-meta">${esc(q.source)} · ${pct(q.confidence)}</span>
        </div>
        <div class="q-acts">
          <label class="slot-chk"><input type="checkbox" data-slot="0" data-key="${esc(q.key)}" ${slots[0] === q.key ? 'checked' : ''}/>甲</label>
          <label class="slot-chk"><input type="checkbox" data-slot="1" data-key="${esc(q.key)}" ${slots[1] === q.key ? 'checked' : ''}/>乙</label>
          <button type="button" class="btn btn-mini btn-ghost" data-qremove="${esc(q.key)}" title="移出队列">✕</button>
        </div>
        ${slotIdx >= 0 ? `<span class="slot-tag">对比${slotIdx === 0 ? '甲' : '乙'}</span>` : ''}
      </li>`;
    })
    .join('');

  const both = slots[0] && slots[1];
  let cmp = '';
  if (compare && both) {
    cmp = `
    <div class="cmp-result">
      <div class="cmp-score grade-${compare.grade}">
        <div class="cmp-num">${compare.score}</div>
        <div class="cmp-grade">${compare.grade}</div>
      </div>
      <div class="cmp-detail">
        <div class="cmp-pair"><b>「${esc(compare.a.idiom)}」</b><span class="vs">×</span><b>「${esc(compare.b.idiom)}」</b></div>
        <div class="cmp-book">${esc(compare.bookLabel)}</div>
        <ul class="cmp-bars">
          <li><span>用字重合</span><div class="mini-bar"><i style="width:${compare.charOverlap}%"></i></div><em>${compare.charOverlap}%</em></li>
          <li><span>同字对位</span><div class="mini-bar"><i style="width:${compare.posOverlap}%"></i></div><em>${compare.posOverlap}%</em></li>
          <li><span>共字</span><em>${compare.sharedChars.length ? esc(compare.sharedChars.map((s) => s.char).join('、')) : '无'}</em></li>
          <li><span>义类交集</span><em>${compare.glossShared.length ? esc(compare.glossShared.join('、')) : '无'}</em></li>
        </ul>
        <p class="cmp-verdict">${esc(compare.verdict)}</p>
      </div>
    </div>`;
  } else if (queue.length >= 2) {
    cmp = `<div class="cmp-hint">在队列中各勾选一条（甲、乙）即可展开字形与语义比对。</div>`;
  }

  return `
  <section class="panel queue-panel sticky">
    <div class="panel-title">
      <h2>对比队列 <span class="count">${queue.length}</span></h2>
      ${queue.length ? '<button type="button" class="btn btn-mini btn-ghost" id="queue-clear">清空</button>' : ''}
    </div>
    ${queue.length ? `<ul class="q-list">${items}</ul><div class="cmp-wrap">${cmp}</div>` : '<p class="empty-tip">在左侧候选中逐条「确认入队」，已确认的成语会在此汇集；勾选两条（甲、乙）即可比对。</p>'}
  </section>`;
}

/* ------------------------------------------------------------------ */
/* 主渲染                                                              */
/* ------------------------------------------------------------------ */

export function renderApp(root: HTMLElement, state: AppState, handlers: AppHandlers): void {
  const { result, inputText, filter } = state;

  const counts = { all: 0, exact: 0, variant: 0, heuristic: 0, pending: 0, confirmed: 0 };
  if (result) {
    for (const c of result.candidates) {
      counts.all++;
      counts[c.kind]++;
      if (c.status === 'pending') counts.pending++;
      if (c.status === 'confirmed') counts.confirmed++;
    }
  }

  const visible = result ? result.candidates.filter((c) => filter === 'all' || c.kind === filter) : [];

  root.innerHTML = `
  <header class="masthead">
    <div class="seal">考</div>
    <div class="mast-text">
      <h1>古文成语识别 · 片语考信</h1>
      <p class="subtitle">粘贴古文段落，系统标出可能的成语片段，给出置信度与书证证据，逐条确认后汇入对比队列。</p>
    </div>
    <div class="catalog-stat">内置词目 <b>${state.catalogCount}</b> 条<br/>经史子集 · 书证可溯</div>
  </header>

  <main class="layout">
    <div class="col-main">
      <section class="panel input-panel">
        <div class="panel-title wrap">
          <h2>① 粘贴原文</h2>
          <div class="sample-row">
            ${SAMPLES.map((s, i) => `<button type="button" class="btn btn-mini sample-btn" data-sample="${i}">${esc(s.label)}·${esc(s.book)}</button>`).join('')}
          </div>
        </div>
        <textarea id="src-input" class="src-input" rows="7"
          placeholder="例如：庆历四年春，滕子京谪守巴陵郡……粘贴任意古文段落，Ctrl/⌘ + Enter 立即解析">${esc(inputText)}</textarea>
        <div class="input-bar">
          <button type="button" class="btn btn-primary" id="analyze-btn" ${state.busy ? 'disabled' : ''}>
            ${state.busy ? '解析中…' : '开始识别'}
          </button>
          <span class="kbd-hint">Ctrl/⌘ + Enter</span>
          <button type="button" class="btn btn-ghost" id="clear-btn">清空原文</button>
          <span class="spacer"></span>
          ${inputText ? `<span class="char-count">${inputText.length} 字</span>` : ''}
        </div>
        ${state.toast ? `<div class="toast" id="toast">${esc(state.toast)}</div>` : ''}
      </section>

      ${
        result
          ? `
      <section class="panel hl-panel">
        <div class="panel-title wrap">
          <h2>② 标注原文</h2>
          <span class="hl-legend">
            <i class="lg lg-exact"></i>辞书精确
            <i class="lg lg-variant"></i>异体近形
            <i class="lg lg-heuristic"></i>结构疑似
          </span>
        </div>
        <div id="stale-tip-slot">${state.dirty ? STALE_HTML : ''}</div>
        ${renderHighlight(inputText, result)}
      </section>

      <section class="panel cards-panel">
        <div class="panel-title wrap">
          <h2>③ 候选片段 <span class="count">${counts.all}</span></h2>
          <div class="filters">
            <button type="button" class="chip ${filter === 'all' ? 'on' : ''}" data-filter="all">全部 ${counts.all}</button>
            <button type="button" class="chip ${filter === 'exact' ? 'on' : ''}" data-filter="exact">辞书 ${counts.exact}</button>
            <button type="button" class="chip ${filter === 'variant' ? 'on' : ''}" data-filter="variant">异体 ${counts.variant}</button>
            <button type="button" class="chip ${filter === 'heuristic' ? 'on' : ''}" data-filter="heuristic">疑似 ${counts.heuristic}</button>
          </div>
          <div class="bulk-acts">
            <button type="button" class="btn btn-mini" id="confirm-all">全部确认入队</button>
            <button type="button" class="btn btn-mini btn-ghost" id="ignore-heur">忽略全部疑似</button>
          </div>
        </div>
        <p class="result-meta">
          检出 ${counts.exact} 条辞书精确、${counts.variant} 条异体近形、${counts.heuristic} 条结构疑似；
          ${counts.pending} 条待处理 · ${counts.confirmed} 条已确认${state.elapsedMs != null ? ` · 解析耗时 ${state.elapsedMs} ms` : ''}
        </p>
        <div class="cards" id="cards">
          ${visible.map((c) => candidateCard(c, inputText)).join('') || '<div class="hl-empty">该筛选条件下没有候选。</div>'}
        </div>
      </section>`
          : `
      <section class="panel placeholder-panel">
        <div class="ph-seal">識</div>
        <h2>等待原文</h2>
        <p>粘贴一段古文，或点击上方名篇示例载入。<br/>解析采用「辞书精确 → 异体近形 → 结构疑似」三级判定，任何解析异常都不会清空当前原文。</p>
      </section>`
      }
    </div>

    <aside class="col-side">${queuePanel(state)}</aside>
  </main>

  <footer class="colophon">片语考信 · 纯本地运行，原文不出浏览器 · 书证仅供参考，疑义请核对原典</footer>
  `;

  bindEvents(root, state, handlers);
}

/* ------------------------------------------------------------------ */
/* 事件绑定                                                            */
/* ------------------------------------------------------------------ */

function bindEvents(root: HTMLElement, state: AppState, h: AppHandlers): void {
  const input = root.querySelector<HTMLTextAreaElement>('#src-input');

  if (input) {
    input.addEventListener('input', () => {
      state.inputText = input.value;
      h.onInputChange(input.value);
      // 不整体重绘（避免打断输入），仅局部更新脏标记与字数
      const staleBox = root.querySelector('#stale-tip-slot');
      if (staleBox) staleBox.innerHTML = state.dirty ? STALE_HTML : '';
      const cc = root.querySelector('.char-count');
      if (cc) cc.textContent = `${input.value.length} 字`;
    });
    input.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        h.onAnalyze(state.inputText);
      }
    });
  }

  root.querySelector('#analyze-btn')?.addEventListener('click', () => h.onAnalyze(state.inputText));
  root.querySelector('#clear-btn')?.addEventListener('click', h.onClearInput);
  root.querySelector('#confirm-all')?.addEventListener('click', h.onConfirmAll);
  root.querySelector('#ignore-heur')?.addEventListener('click', h.onIgnoreAllHeuristics);
  root.querySelector('#queue-clear')?.addEventListener('click', h.onQueueClear);

  root.querySelectorAll<HTMLButtonElement>('[data-sample]').forEach((b) =>
    b.addEventListener('click', () => h.onAddSample(Number(b.dataset.sample)))
  );

  root.querySelectorAll<HTMLElement>('[data-locate]').forEach((el) =>
    el.addEventListener('click', () => {
      const card = root.querySelector(`[data-card="${el.dataset.locate}"]`);
      card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card?.classList.add('flash');
      setTimeout(() => card?.classList.remove('flash'), 1200);
    })
  );

  root.querySelectorAll<HTMLButtonElement>('[data-act]').forEach((b) => {
    b.addEventListener('click', () => {
      const id = b.dataset.id!;
      if (b.dataset.act === 'confirm') h.onSetStatus(id, 'confirmed');
      if (b.dataset.act === 'ignore') h.onSetStatus(id, 'ignored');
      if (b.dataset.act === 'locate') {
        const c = state.result?.candidates.find((x) => x.id === id);
        if (c) h.onLocate(c);
      }
    });
  });

  root.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((b) =>
    b.addEventListener('click', () => {
      state.filter = b.dataset.filter as AppState['filter'];
      rerender(root, state, h);
    })
  );

  root.querySelectorAll<HTMLButtonElement>('[data-qremove]').forEach((b) =>
    b.addEventListener('click', () => h.onQueueRemove(b.dataset.qremove!))
  );

  root.querySelectorAll<HTMLInputElement>('[data-slot]').forEach((chk) => {
    chk.addEventListener('change', () => {
      h.onSlotToggle(Number(chk.dataset.slot) as 0 | 1, chk.dataset.key!);
    });
  });
}

/** 局部重渲染：重建 DOM 后恢复光标位置 */
function rerender(root: HTMLElement, state: AppState, h: AppHandlers): void {
  const input = root.querySelector<HTMLTextAreaElement>('#src-input');
  const caret = input ? input.selectionStart : null;
  renderApp(root, state, h);
  if (caret != null) {
    const next = root.querySelector<HTMLTextAreaElement>('#src-input');
    try {
      next?.setSelectionRange(caret, caret);
    } catch {
      /* 内容已变，放弃恢复 */
    }
  }
}
