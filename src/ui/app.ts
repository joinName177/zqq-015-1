import {
  IdiomProfile,
  KinshipResult,
  IdiomRecognitionResult,
  IdiomCandidate,
  RecognitionEvidence
} from '../core/models';

export type AppMode = 'single' | 'compare' | 'recognize';

export interface IdiomViewState {
  currentProfile: IdiomProfile;
  presets: string[];
  mode: AppMode;
  kinshipResult: KinshipResult | null;
  compareA: string;
  compareB: string;
  recognitionText: string;
  recognitionResult: IdiomRecognitionResult | null;
  recognitionError: string | null;
  queue: IdiomCandidate[];
  slotA: string | null;
  slotB: string | null;
}

export interface IdiomUIHandlers {
  onSearch: (idiomText: string) => void;
  onCompare: (idiomA: string, idiomB: string) => void;
  onSwitchMode: (mode: AppMode) => void;
  onRecognize: (text: string) => void;
  onRecognitionTextChange: (text: string) => void;
  onConfirmCandidate: (id: string) => void;
  onIgnoreCandidate: (id: string) => void;
  onRestoreCandidate: (id: string) => void;
  onRemoveFromQueue: (id: string) => void;
  onAssignQueueSlot: (id: string, slot: 'A' | 'B') => void;
  onQueueCompare: () => void;
}

const EVIDENCE_KIND_LABEL: Record<RecognitionEvidence['kind'], string> = {
  dictionary: '词典',
  source: '出处',
  structure: '结构',
  semantic: '语义',
  context: '信号'
};

export function renderIdiomApp(
  container: HTMLElement,
  state: IdiomViewState,
  handlers: IdiomUIHandlers
) {
  const esc = (s: string) =>
    s.replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t));

  const {
    currentProfile,
    presets,
    mode,
    kinshipResult,
    compareA,
    compareB,
    recognitionText,
    recognitionResult,
    recognitionError,
    queue,
    slotA,
    slotB
  } = state;

  // DNA Donut Chart SVG
  const dna = currentProfile.dna;
  const radius = 70;
  const circumference = 2 * Math.PI * radius; // ~439.8

  const origStroke = (dna.originalPercent / 100) * circumference;
  const extStroke = (dna.extendedPercent / 100) * circumference;
  const metaStroke = (dna.metaphoricalPercent / 100) * circumference;

  const origOffset = 0;
  const extOffset = -origStroke;
  const metaOffset = -(origStroke + extStroke);

  const dnaSvg = `
    <svg viewBox="0 0 180 180" width="180" height="180">
      <circle cx="90" cy="90" r="${radius}" fill="none" stroke="#28241f" stroke-width="20" />
      <!-- Original meaning -->
      <circle cx="90" cy="90" r="${radius}" fill="none" stroke="#52b788" stroke-width="20"
              stroke-dasharray="${origStroke} ${circumference}" stroke-dashoffset="${origOffset}"
              transform="rotate(-90 90 90)" />
      <!-- Extended meaning -->
      <circle cx="90" cy="90" r="${radius}" fill="none" stroke="#d4af37" stroke-width="20"
              stroke-dasharray="${extStroke} ${circumference}" stroke-dashoffset="${extOffset}"
              transform="rotate(-90 90 90)" />
      <!-- Metaphorical meaning -->
      <circle cx="90" cy="90" r="${radius}" fill="none" stroke="#c93b2b" stroke-width="20"
              stroke-dasharray="${metaStroke} ${circumference}" stroke-dashoffset="${metaOffset}"
              transform="rotate(-90 90 90)" />
      <text x="90" y="85" text-anchor="middle" font-size="12" fill="var(--ash)">语义核心</text>
      <text x="90" y="105" text-anchor="middle" font-size="16" font-weight="bold" fill="#fff">${dna.polarity}</text>
    </svg>
  `;

  // ---- 古文识别模式渲染 ----
  const renderHighlightedText = (): string => {
    const candidates = [...(recognitionResult?.candidates ?? [])].sort((a, b) => a.start - b.start);
    let html = '';
    let cursor = 0;
    for (const c of candidates) {
      html += esc(recognitionText.slice(cursor, c.start));
      const cls =
        c.status === 'confirmed'
          ? 'mark-confirmed'
          : c.status === 'ignored'
            ? 'mark-ignored'
            : c.tier === 'exact'
              ? 'mark-exact'
              : 'mark-tentative';
      html += `<mark class="idiom-mark ${cls}" data-cand="${c.id}" title="${esc(c.fragment)} · 置信度 ${c.confidence}%">${esc(
        recognitionText.slice(c.start, c.end)
      )}</mark>`;
      cursor = c.end;
    }
    html += esc(recognitionText.slice(cursor));
    return html;
  };

  const renderCandidateCard = (c: IdiomCandidate): string => {
    const statusCls =
      c.status === 'confirmed' ? 'card-confirmed' : c.status === 'ignored' ? 'card-ignored' : '';
    const tierLabel = c.tier === 'exact' ? '精确匹配' : '待考推测';
    return `
      <div class="candidate-card ${statusCls}" data-cand="${c.id}">
        <div class="cand-head">
          <span class="cand-fragment">${esc(c.fragment)}</span>
          <span class="tier-badge ${c.tier}">${tierLabel}</span>
          <span class="confidence-val">${c.confidence}<small>%</small></span>
        </div>
        <div class="confidence-bar">
          <div class="confidence-fill ${c.tier}" style="width:${c.confidence}%"></div>
        </div>
        <ul class="evidence-list">
          ${c.evidence
            .map(
              e => `<li><span class="evidence-kind kind-${e.kind}">${EVIDENCE_KIND_LABEL[e.kind]}</span><span>${esc(
                e.text
              )}</span></li>`
            )
            .join('')}
        </ul>
        <div class="cand-actions">
          ${
            c.status === 'confirmed'
              ? '<button class="btn-confirmed" disabled>✓ 已入对比队列</button>'
              : c.status === 'ignored'
                ? `<button class="btn-ghost" data-action="restore" data-id="${c.id}">恢复</button>`
                : `<button class="btn-confirm" data-action="confirm" data-id="${c.id}">✓ 确认入对比队列</button>
                   <button class="btn-ghost" data-action="ignore" data-id="${c.id}">忽略</button>`
          }
        </div>
      </div>
    `;
  };

  const queueChip = (q: IdiomCandidate, removable: boolean): string => `
    <span class="queue-chip">
      <span class="chip-frag">${esc(q.fragment)}</span>
      <span class="chip-conf">${q.confidence}%</span>
      ${
        removable
          ? `<button class="chip-slot-btn" data-action="slot-a" data-id="${q.id}" title="设为对比甲">甲</button>
             <button class="chip-slot-btn" data-action="slot-b" data-id="${q.id}" title="设为对比乙">乙</button>
             <button class="chip-remove" data-action="queue-remove" data-id="${q.id}" title="移出队列">×</button>`
          : ''
      }
    </span>
  `;

  const exactCount = recognitionResult?.candidates.filter(c => c.tier === 'exact').length ?? 0;
  const tentativeCount = recognitionResult?.candidates.filter(c => c.tier === 'tentative').length ?? 0;
  const slotACand = queue.find(q => q.id === slotA);
  const slotBCand = queue.find(q => q.id === slotB);
  const bothSlotsFilled = !!slotACand && !!slotBCand;

  const recognizeModeHtml = `
    <section class="recognize-panel">
      <div class="section-title">
        <span>📜 古文段落成语识别 · 标出疑似片段，逐条确认进入对比队列</span>
      </div>
      <textarea id="guwenInput" class="guwen-textarea" placeholder="粘贴一段古文（简体、繁体皆可），例如：&#10;夫处世应变，不可刻舟求剑，拘泥成法……">${esc(
        recognitionText
      )}</textarea>
      <div class="recognize-actions">
        <button class="btn-search" id="btnRecognize">开始识别</button>
        <button class="btn-secondary" id="btnSample">填入示例段落</button>
        <button class="btn-ghost" id="btnClearText">清空</button>
        <span class="lexicon-hint">内置成语词典 · 精确匹配 + 四字格构词特征双策略</span>
      </div>
      ${
        recognitionError
          ? `<div class="notice-banner notice-error">⚠️ 识别过程出现异常，已保留您粘贴的原文与此前的识别结果。<br><small>${esc(
              recognitionError
            )}</small></div>`
          : ''
      }
      ${
        recognitionResult && recognitionResult.warnings.length > 0
          ? `<div class="notice-banner notice-warn">${recognitionResult.warnings.map(w => esc(w)).join('<br>')}</div>`
          : ''
      }
    </section>

    ${
      recognitionResult
        ? `
      <section class="recog-stats">
        <span>全文 ${recognitionResult.textLength} 字</span>
        <span>扫描汉字 ${recognitionResult.scannedChars} 个</span>
        <span>候选 ${recognitionResult.candidates.length} 条（精确匹配 ${exactCount} · 待考推测 ${tentativeCount}）</span>
        <span>已确认 ${queue.length} 条入队列</span>
      </section>

      <div class="recog-layout">
        <div class="text-highlight-panel">
          <div class="panel-label">原文标注（点击高亮片段可定位候选卡片）</div>
          <div class="guwen-text">${renderHighlightedText()}</div>
        </div>
        <div class="candidate-list">
          <div class="panel-label">疑似成语片段（${recognitionResult.candidates.length}）</div>
          ${
            recognitionResult.candidates.length === 0
              ? '<div class="empty-hint">未在该段落中识别出成语片段，可尝试粘贴包含更多典故成语的段落。</div>'
              : recognitionResult.candidates.map(renderCandidateCard).join('')
          }
        </div>
      </div>
    `
        : `
      <div class="empty-hint large">粘贴古文段落并点击「开始识别」，系统将标出疑似成语片段、展示置信度与证据，并支持逐条确认进入对比队列。</div>
    `
    }

    <section class="queue-panel">
      <div class="section-title">
        <span>🧺 对比队列</span>
      </div>
      <div class="queue-slots">
        <div class="queue-slot ${slotACand ? 'filled' : ''}">
          <span class="slot-label">对比甲</span>
          ${slotACand ? queueChip(slotACand, false) : '<span class="slot-empty">虚位以待</span>'}
        </div>
        <div class="vs-badge small">VS</div>
        <div class="queue-slot ${slotBCand ? 'filled' : ''}">
          <span class="slot-label">对比乙</span>
          ${slotBCand ? queueChip(slotBCand, false) : '<span class="slot-empty">虚位以待</span>'}
        </div>
        <button class="btn-search" id="btnQueueCompare" ${bothSlotsFilled ? '' : 'disabled'}>开始亲缘对比演算</button>
      </div>
      <div class="queue-chips">
        ${
          queue.length === 0
            ? '<span class="empty-hint">在上方候选卡片中点击「确认入对比队列」，即可将成语加入队列。</span>'
            : queue.map(q => queueChip(q, true)).join('')
        }
      </div>
    </section>
  `;

  container.innerHTML = `
    <div class="idiom-app">
      <header class="app-header">
        <div class="brand-section">
          <div class="seal-icon">篆</div>
          <div>
            <h1>华夏成语字源与语义DNA图谱</h1>
            <p>CHINESE IDIOM ETYMOLOGY &amp; SEMANTIC DNA PROFILER · v1.0.0</p>
          </div>
        </div>
        <div class="mode-toggle">
          <button class="mode-btn ${mode === 'single' ? 'active' : ''}" data-mode="single">单词溯源剖析</button>
          <button class="mode-btn ${mode === 'compare' ? 'active' : ''}" data-mode="compare">双词亲缘对比</button>
          <button class="mode-btn ${mode === 'recognize' ? 'active' : ''}" data-mode="recognize">古文成语识别</button>
        </div>
      </header>

      ${
        mode === 'recognize'
          ? recognizeModeHtml
          : mode === 'single'
            ? `
        <!-- Single Mode Search Bar -->
        <section class="search-container">
          <div class="search-input-wrap">
            <input type="text" class="idiom-input" id="singleInput" value="${esc(currentProfile.idiom)}" placeholder="输入任意四字成语，如：破釜沉舟..." />
            <button class="btn-search" id="btnSingleSearch">开始解构</button>
          </div>
          <div class="preset-chips">
            <span style="color:var(--ash);">推荐典范成语：</span>
            ${presets.map(p => `<button class="chip" data-idiom="${p}">${p}</button>`).join('')}
          </div>
        </section>

        <!-- Idiom Hero Banner -->
        <section class="idiom-hero">
          <div class="hero-main">
            <h2>${esc(currentProfile.idiom)}</h2>
            <div class="hero-pinyin">${esc(currentProfile.pinyin)} · ${esc(currentProfile.syntacticRole)}</div>
            <div class="hero-desc">${esc(currentProfile.modernDefinition)}</div>
          </div>
          <div>
            <span class="polarity-badge ${currentProfile.dna.polarity}">感情色彩 · ${currentProfile.dna.polarity}</span>
          </div>
        </section>

        <!-- Main Content Grid -->
        <div class="content-grid">
          <!-- Left: Oracle breakdown & Allusion timeline -->
          <main>
            <!-- 1. Oracle Character Breakdown -->
            <div class="section-title">
              <span>🪓 四字字源与早期金石甲骨形态拆解</span>
            </div>
            <div class="oracle-cards-grid">
              ${currentProfile.characters
                .map(
                  ch => `
                <div class="oracle-card">
                  <div class="glyph-svg-wrap">
                    <svg viewBox="0 0 100 100">${ch.glyphSvg}</svg>
                  </div>
                  <div class="char-kanji">${ch.char}</div>
                  <div class="char-script-tag">${ch.scriptType} · 部首【${ch.radical}】</div>
                  <div class="char-origin-text"><strong>本义：</strong>${esc(ch.originalMeaning)}</div>
                </div>
              `
                )
                .join('')}
            </div>

            <!-- 2. Historical Allusion Source -->
            <div class="section-title">
              <span>📜 典故出处考据时间轴</span>
            </div>
            <div class="history-panel">
              <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong style="color:var(--bronze);font-size:16px;">${esc(currentProfile.allusion.classicBook)}</strong>
                <span style="font-size:12px;color:var(--ash);">${esc(currentProfile.allusion.dynasty)} · ${esc(currentProfile.allusion.author)}</span>
              </div>
              <p style="font-size:13px;color:var(--silk);margin-top:8px;">${esc(currentProfile.allusion.historicalEvent)}</p>
              <div class="allusion-quote">${esc(currentProfile.allusion.originalAncientQuote)}</div>
            </div>

            <!-- 3. Semantic Evolution Path -->
            <div class="section-title">
              <span>🧭 语义演变路径图 (Semantic Evolution)</span>
            </div>
            <div class="history-panel">
              <div class="evolution-path">
                ${currentProfile.evolutionPath
                  .map(
                    step => `
                  <div class="evolution-node">
                    <div class="evolution-era">${esc(step.era)} · 演进形态【${step.semanticCategory}】</div>
                    <div class="evolution-meaning">${esc(step.meaning)}</div>
                    <div style="font-size:11px;color:var(--ash);margin-top:2px;">语境实录：${esc(step.contextSample)}</div>
                  </div>
                `
                  )
                  .join('')}
              </div>
            </div>
          </main>

          <!-- Right: Semantic DNA Panel -->
          <aside class="dna-panel">
            <div class="section-title" style="width:100%;text-align:center;justify-content:center;">
              <span>🧬 成语语义DNA谱系</span>
            </div>

            <div class="dna-chart-wrap">
              ${dnaSvg}
            </div>

            <div class="dna-legend">
              <div class="legend-row">
                <span style="display:flex;align-items:center;gap:6px;">
                  <span style="width:10px;height:10px;background:#52b788;display:inline-block;border-radius:2px;"></span>
                  <span>文字本义 (Literal)</span>
                </span>
                <strong style="color:#52b788;">${dna.originalPercent}%</strong>
              </div>
              <div class="legend-row">
                <span style="display:flex;align-items:center;gap:6px;">
                  <span style="width:10px;height:10px;background:#d4af37;display:inline-block;border-radius:2px;"></span>
                  <span>情境引申义 (Extended)</span>
                </span>
                <strong style="color:#d4af37;">${dna.extendedPercent}%</strong>
              </div>
              <div class="legend-row">
                <span style="display:flex;align-items:center;gap:6px;">
                  <span style="width:10px;height:10px;background:#c93b2b;display:inline-block;border-radius:2px;"></span>
                  <span>哲学比喻义 (Metaphorical)</span>
                </span>
                <strong style="color:#c93b2b;">${dna.metaphoricalPercent}%</strong>
              </div>
            </div>

            <div class="sememes-box">
              <div style="font-size:12px;color:var(--ash);margin-bottom:8px;">底层核心义原标签 (Sememes)：</div>
              <div>
                ${dna.coreSememes.map(s => `<span class="sememe-tag">${esc(s)}</span>`).join('')}
              </div>
            </div>
          </aside>
        </div>
      `
            : `
        <!-- Compare Mode -->
        <section class="kinship-arena">
          <div class="section-title">
            <span>⚖️ 两个成语的语义亲缘度与义原拓扑对比</span>
          </div>

          <div class="compare-inputs">
            <div>
              <label style="font-size:12px;color:var(--ash);display:block;margin-bottom:6px;">成语 A：</label>
              <input type="text" class="idiom-input" id="compareInputA" value="${esc(compareA)}" placeholder="成语A" />
            </div>
            <div class="vs-badge">VS</div>
            <div>
              <label style="font-size:12px;color:var(--ash);display:block;margin-bottom:6px;">成语 B：</label>
              <input type="text" class="idiom-input" id="compareInputB" value="${esc(compareB)}" placeholder="成语B" />
            </div>
          </div>

          <div style="text-align:center;">
            <button class="btn-search" id="btnRunCompare" style="padding:12px 36px;">开始亲缘度对比演算</button>
          </div>

          ${
            kinshipResult
              ? `
            <div class="kinship-result-card">
              <div class="score-banner">
                <div>
                  <div style="font-size:12px;color:var(--ash);">综合语义亲缘指数</div>
                  <div class="score-val">${kinshipResult.kinshipScore}<span style="font-size:18px;">%</span></div>
                  <span class="polarity-badge" style="display:inline-block;margin-top:6px;">
                    关系判定 · ${kinshipResult.relationshipLabel}
                  </span>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:13px;color:var(--silk);">
                    《${esc(kinshipResult.idiomA.idiom)}》 vs 《${esc(kinshipResult.idiomB.idiom)}》
                  </div>
                  <div style="font-size:12px;color:var(--ash);margin-top:4px;">
                    DNA向量拟合度: <strong>${kinshipResult.dnaVectorSimilarity}%</strong>
                  </div>
                </div>
              </div>

              <div style="margin-bottom:16px;">
                <strong style="color:var(--bronze);font-size:13px;">共现重叠核心义原：</strong>
                <div style="margin-top:6px;">
                  ${
                    kinshipResult.sharedSememes.length > 0
                      ? kinshipResult.sharedSememes.map(s => `<span class="sememe-tag" style="border-color:var(--jade);color:var(--jade);">${esc(s)}</span>`).join('')
                      : '<span style="color:var(--ash);font-size:12px;">无显著交叠核心义原</span>'
                  }
                </div>
              </div>

              <div style="background:rgba(0,0,0,0.3);padding:14px 18px;border-radius:6px;border-left:3px solid var(--bronze);">
                <strong style="color:var(--bronze);font-size:13px;display:block;margin-bottom:4px;">语义流派对比考据：</strong>
                <p style="font-size:13px;color:var(--silk);line-height:1.6;">${esc(kinshipResult.comparativeAnalysis)}</p>
              </div>
            </div>
          `
              : ''
          }
        </section>
      `
      }
    </div>
  `;

  // ---- 事件绑定 ----
  container.querySelectorAll<HTMLElement>('[data-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = btn.getAttribute('data-mode') as AppMode | null;
      if (m) handlers.onSwitchMode(m);
    });
  });

  if (mode === 'single') {
    const singleInput = container.querySelector('#singleInput') as HTMLInputElement;
    container.querySelector('#btnSingleSearch')?.addEventListener('click', () => {
      const val = singleInput.value.trim();
      if (val) handlers.onSearch(val);
    });

    singleInput?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const val = singleInput.value.trim();
        if (val) handlers.onSearch(val);
      }
    });

    container.querySelectorAll('.chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const idiom = btn.getAttribute('data-idiom');
        if (idiom) handlers.onSearch(idiom);
      });
    });
  } else if (mode === 'compare') {
    container.querySelector('#btnRunCompare')?.addEventListener('click', () => {
      const a = (container.querySelector('#compareInputA') as HTMLInputElement).value.trim();
      const b = (container.querySelector('#compareInputB') as HTMLInputElement).value.trim();
      if (a && b) handlers.onCompare(a, b);
      else alert('请输入需要对比的两个成语');
    });
  } else {
    // 古文识别模式
    const guwenInput = container.querySelector('#guwenInput') as HTMLTextAreaElement;
    guwenInput?.addEventListener('input', () => {
      handlers.onRecognitionTextChange(guwenInput.value);
    });

    container.querySelector('#btnRecognize')?.addEventListener('click', () => {
      handlers.onRecognize(guwenInput.value);
    });
    guwenInput?.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        handlers.onRecognize(guwenInput.value);
      }
    });

    container.querySelector('#btnSample')?.addEventListener('click', () => {
      const sample =
        '夫处世应变，不可刻舟求剑，拘泥成法。昔者越王勾践卧薪尝胆，十年生聚，终雪会稽之耻；项羽破釜沉舟，沉船破釜，以示必死，无一还心。若守株待兔，冀侥幸于万一，未有不败者也。';
      handlers.onRecognitionTextChange(sample);
      handlers.onRecognize(sample);
    });

    container.querySelector('#btnClearText')?.addEventListener('click', () => {
      handlers.onRecognitionTextChange('');
      if (guwenInput) guwenInput.value = '';
    });

    container.querySelector('#btnQueueCompare')?.addEventListener('click', () => {
      if (bothSlotsFilled) handlers.onQueueCompare();
    });

    // 候选卡片与队列按钮（事件委托）
    container.querySelectorAll<HTMLElement>('[data-action]').forEach(el => {
      el.addEventListener('click', () => {
        const id = el.getAttribute('data-id');
        const action = el.getAttribute('data-action');
        if (!id || !action) return;
        if (action === 'confirm') handlers.onConfirmCandidate(id);
        else if (action === 'ignore') handlers.onIgnoreCandidate(id);
        else if (action === 'restore') handlers.onRestoreCandidate(id);
        else if (action === 'queue-remove') handlers.onRemoveFromQueue(id);
        else if (action === 'slot-a') handlers.onAssignQueueSlot(id, 'A');
        else if (action === 'slot-b') handlers.onAssignQueueSlot(id, 'B');
      });
    });

    // 点击原文高亮片段 → 定位并闪烁对应候选卡片
    container.querySelectorAll<HTMLElement>('.idiom-mark').forEach(mark => {
      mark.addEventListener('click', () => {
        const id = mark.getAttribute('data-cand');
        if (!id) return;
        const card = container.querySelector<HTMLElement>(`.candidate-card[data-cand="${id}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.remove('flash');
          void card.offsetWidth; // 触发重排以重启动画
          card.classList.add('flash');
        }
      });
    });
  }
}
