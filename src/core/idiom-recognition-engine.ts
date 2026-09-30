import {
  IdiomCandidate,
  IdiomLexiconEntry,
  IdiomRecognitionResult,
  RecognitionEvidence
} from './models';

/**
 * 古文成语识别引擎（核心层，纯函数）。
 *
 * 双策略识别：
 * 1. 精确匹配：在内置成语词典中逐一定位，置信度高，证据含出处；
 * 2. 构词特征推测：对未被精确匹配占据的四字格窗口，依据四字格边界、
 *    与已知成语共享的二字构词成分、高频用字、文言虚字等信号打分，
 *    置信度封顶 64（待考推测），证据标注「建议人工复核」。
 *
 * 设计约束：引擎对输入做充分防御，任何异常都只返回带 warnings 的安全结果，
 * 绝不抛出异常，以免破坏调用方当前内容。
 */

const ENGINE_VERSION = '1.0.0';
const HAN_RUN = /[一-鿿]+/g;
const HAN_CHAR = /[一-鿿]/;
const CLASSICAL_MARKERS = new Set('之乎者也矣焉哉而以则其于不无若夫盖诸欤邪');

const TENTATIVE_SCORE_CAP = 64;
const TENTATIVE_SCORE_THRESHOLD_BOUNDED = 46;   // 四字格独立成读（整句恰为四字）
const TENTATIVE_SCORE_THRESHOLD_EMBEDDED = 55;  // 嵌于更长语段中，需更强信号

export function recognizeIdioms(
  text: unknown,
  lexicon: IdiomLexiconEntry[]
): IdiomRecognitionResult {
  const warnings: string[] = [];

  if (typeof text !== 'string') {
    return emptyResult(0, ['输入文本无效（非字符串），已保留原有内容']);
  }
  const safeText = text;

  const lexiconEntries = Array.isArray(lexicon) ? lexicon : [];
  const lexiconMap = new Map<string, IdiomLexiconEntry>();
  for (const entry of lexiconEntries) {
    if (entry && typeof entry.idiom === 'string' && entry.idiom.length >= 3) {
      lexiconMap.set(entry.idiom, entry);
    }
  }
  if (lexiconMap.size === 0) {
    warnings.push('成语词典为空，仅启用构词特征推测策略');
  }

  const candidates: IdiomCandidate[] = [];
  let seq = 0;
  const makeId = (start: number, end: number) => `cand-${start}-${end}-${seq++}`;

  // ---- 策略一：精确匹配内置成语词典 ----
  for (const entry of lexiconMap.values()) {
    const frag = entry.idiom;
    let from = 0;
    let idx = safeText.indexOf(frag, from);
    while (idx !== -1) {
      const bounded = isBounded(safeText, idx, idx + frag.length);
      let confidence = 88;
      if (entry.source) confidence += 3;
      if (bounded) confidence += 3;
      if (frag.length !== 4) confidence -= 4;
      confidence = Math.min(99, confidence);

      const evidence: RecognitionEvidence[] = [
        { kind: 'dictionary', text: `精确匹配内置成语词典（共 ${lexiconMap.size} 条）` }
      ];
      if (entry.source) {
        evidence.push({
          kind: 'source',
          text: `最早出处：${entry.dynasty ? entry.dynasty + ' · ' : ''}《${entry.source.replace(/^《|》$/g, '')}》`
        });
      }
      if (bounded) {
        evidence.push({ kind: 'structure', text: '四字凝固结构，前后为句读停顿' });
      }
      if (entry.note) {
        evidence.push({ kind: 'semantic', text: entry.note });
      }

      candidates.push({
        id: makeId(idx, idx + frag.length),
        fragment: frag,
        start: idx,
        end: idx + frag.length,
        confidence,
        tier: 'exact',
        status: 'pending',
        evidence
      });

      from = idx + frag.length;
      idx = safeText.indexOf(frag, from);
    }
  }

  // ---- 策略二：构词特征推测（四字格窗口扫描） ----
  const charFreq = new Map<string, number>();
  const bigramFreq = new Map<string, number>();
  let totalCharOccurrences = 0;
  for (const e of lexiconMap.values()) {
    for (const ch of e.idiom) {
      charFreq.set(ch, (charFreq.get(ch) ?? 0) + 1);
      totalCharOccurrences++;
    }
    for (let i = 0; i < e.idiom.length - 1; i++) {
      const bg = e.idiom.slice(i, i + 2);
      bigramFreq.set(bg, (bigramFreq.get(bg) ?? 0) + 1);
    }
  }
  const avgCharFreq = charFreq.size > 0 ? totalCharOccurrences / charFreq.size : 0;

  const occupied: Array<[number, number]> = candidates.map(c => [c.start, c.end]);
  let scannedChars = 0;

  let m: RegExpExecArray | null;
  HAN_RUN.lastIndex = 0;
  while ((m = HAN_RUN.exec(safeText)) !== null) {
    const run = m[0];
    const runStart = m.index;
    scannedChars += run.length;
    if (run.length < 4) continue;

    for (let i = 0; i + 4 <= run.length; i++) {
      const frag = run.slice(i, i + 4);
      const start = runStart + i;
      const end = start + 4;
      // 已被精确匹配占据的窗口不再推测
      if (occupied.some(([s, e]) => start < e && end > s)) continue;

      const bounded = i === 0 && i + 4 === run.length;

      let score = 30;
      const signals: string[] = [];

      if (bounded) {
        score += 18;
        signals.push('四字格独立成读，前后为句读停顿');
      }

      let bgHits = 0;
      const hitBgs: string[] = [];
      for (let b = 0; b < 3; b++) {
        const bg = frag.slice(b, b + 2);
        if ((bigramFreq.get(bg) ?? 0) >= 2) {
          bgHits++;
          if (!hitBgs.includes(bg)) hitBgs.push(bg);
        }
      }
      if (bgHits > 0) {
        score += Math.min(18, bgHits * 7);
        signals.push(
          `与已知成语共享 ${bgHits} 个构词成分（${hitBgs.slice(0, 2).map(b => '「' + b + '」').join('、')}）`
        );
      }

      const avgFreq = frag.split('').reduce((s, ch) => s + (charFreq.get(ch) ?? 0), 0) / 4;
      if (avgFreq >= avgCharFreq * 0.8) {
        score += 8;
        signals.push('用字与成语高频字表高度重合');
      }

      if ([...frag].some(ch => CLASSICAL_MARKERS.has(ch))) {
        score += 8;
        signals.push('含文言虚字/判断句式标记');
      }

      score = Math.min(TENTATIVE_SCORE_CAP, score);
      const threshold = bounded
        ? TENTATIVE_SCORE_THRESHOLD_BOUNDED
        : TENTATIVE_SCORE_THRESHOLD_EMBEDDED;
      if (score < threshold) continue;

      const evidence: RecognitionEvidence[] = [
        { kind: 'structure', text: '四字格结构，疑似成语片段' },
        ...signals.map(s => ({ kind: 'context' as const, text: s })),
        { kind: 'dictionary', text: '未见于内置成语词典，属构词特征推测，建议人工复核' }
      ];

      candidates.push({
        id: makeId(start, end),
        fragment: frag,
        start,
        end,
        confidence: score,
        tier: 'tentative',
        status: 'pending',
        evidence
      });
      occupied.push([start, end]);
    }
  }

  // ---- 去重：按位置排序，精确匹配优先、置信度优先，贪心剔除重叠 ----
  candidates.sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    if (a.tier !== b.tier) return a.tier === 'exact' ? -1 : 1;
    return b.confidence - a.confidence;
  });

  const deduped: IdiomCandidate[] = [];
  const placed: Array<[number, number]> = [];
  for (const c of candidates) {
    if (placed.some(([s, e]) => c.start < e && c.end > s)) continue;
    deduped.push(c);
    placed.push([c.start, c.end]);
  }

  return {
    candidates: deduped,
    textLength: safeText.length,
    scannedChars,
    warnings,
    engineVersion: ENGINE_VERSION
  };
}

function isBounded(text: string, start: number, end: number): boolean {
  const before = start === 0 || !HAN_CHAR.test(text[start - 1]);
  const after = end === text.length || !HAN_CHAR.test(text[end]);
  return before && after;
}

function emptyResult(textLength: number, warnings: string[]): IdiomRecognitionResult {
  return {
    candidates: [],
    textLength,
    scannedChars: 0,
    warnings,
    engineVersion: ENGINE_VERSION
  };
}
