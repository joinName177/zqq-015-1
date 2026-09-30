import type { AnalyzeResult, Candidate, IdiomEntry, MatchKind } from './models';
import type { IdiomCatalogPort } from '../ports/idiom-catalog.port';

/* ------------------------------------------------------------------ */
/* 文字归一化：常见繁简 / 异体 / 古今字对照表（仅用于匹配，不回写原文） */
/* ------------------------------------------------------------------ */

const CHAR_VARIANTS: Record<string, string> = {
  於: '于', 餘: '余', 後: '后', 穀: '谷', 鬥: '斗', 隻: '只',
  幾: '几', 麵: '面', 裡: '里', 裏: '里', 穫: '获', 獲: '获',
  颱: '台', 檯: '台', 纔: '才', 鬱: '郁', 與: '与', 歟: '与',
  舉: '举', 譽: '誉', 興: '兴', 學: '学', 覺: '觉', 覽: '览',
  見: '见', 觀: '观', 視: '视', 規: '规', 親: '亲', 語: '语',
  謂: '谓', 諫: '谏', 謀: '谋', 論: '论', 諭: '谕', 諸: '诸',
  讀: '读', 變: '变', 讓: '让', 識: '识', 謝: '谢', 講: '讲',
  謗: '谤', 謹: '谨', 誠: '诚', 說: '说', 誰: '谁', 過: '过',
  達: '达', 違: '违', 遠: '远', 還: '还', 邇: '迩', 遺: '遗',
  選: '选', 遞: '递', 邁: '迈', 運: '运', 進: '进', 遊: '游',
  遲: '迟', 適: '适', 鄭: '郑', 鄰: '邻', 鄧: '邓', 醜: '丑',
  尋: '寻', 將: '将', 爾: '尔', 為: '为', 無: '无', 爭: '争',
  來: '来', 東: '东', 兩: '两', 喪: '丧', 個: '个', 豐: '丰',
  臨: '临', 義: '义', 烏: '乌', 樂: '乐', 喬: '乔', 習: '习',
  鄉: '乡', 書: '书', 買: '买', 亂: '乱', 亞: '亚', 產: '产',
  畝: '亩', 褻: '亵', 補: '补', 製: '制', 複: '复', 覆: '复',
  觸: '触', 觴: '觞', 訓: '训', 訕: '讪', 訖: '讫', 託: '托',
  記: '记', 訪: '访', 訴: '诉', 診: '诊', 註: '注', 詠: '咏',
  詩: '诗', 詬: '诟', 詭: '诡', 詮: '诠', 詰: '诘', 話: '话',
  該: '该', 詳: '详', 誅: '诛', 誇: '夸', 誌: '志', 認: '认',
  誑: '诳', 誚: '诮', 誤: '误', 誥: '诰', 誦: '诵', 誨: '诲',
  調: '调', 誼: '谊', 諜: '谍', 諤: '谔', 謊: '谎', 諱: '讳',
  謬: '谬', 謔: '谑', 謐: '谧', 謳: '讴', 謾: '谩', 譁: '哗',
  證: '证', 譎: '谲', 譏: '讥', 譚: '谭', 譫: '谵', 譭: '毁',
  讎: '仇', 讚: '赞', 谿: '溪', 谹: '宏', 豈: '岂', 貝: '贝',
  財: '财', 貞: '贞', 責: '责', 賢: '贤', 敗: '败', 貨: '货',
  質: '质', 貪: '贪', 貫: '贯', 貴: '贵', 費: '费', 貿: '贸',
  賀: '贺', 賊: '贼', 資: '资', 賓: '宾', 賜: '赐', 賞: '赏',
  賠: '赔', 賴: '赖', 賽: '赛', 贈: '赠', 贍: '赡', 車: '车',
  軌: '轨', 軍: '军', 軒: '轩', 軻: '轲', 軫: '轸', 軾: '轼',
  轅: '辕', 轉: '转', 轍: '辙', 辭: '辞', 闢: '辟', 闔: '阖',
  門: '门', 閉: '闭', 開: '开', 閑: '闲', 間: '间', 閔: '闵',
  閣: '阁', 閱: '阅', 闌: '阑', 闕: '阙', 關: '关', 際: '际',
  隱: '隐', 雖: '虽', 雙: '双', 雞: '鸡', 雲: '云', 電: '电',
  霧: '雾', 靜: '静', 願: '愿', 類: '类', 風: '风', 飄: '飘',
  飆: '飙', 飛: '飞', 餒: '馁', 餓: '饿', 館: '馆', 饉: '馑',
  馬: '马', 馮: '冯', 馳: '驰', 驅: '驱', 駑: '驽', 駐: '驻',
  駕: '驾', 駿: '骏', 驂: '骖', 驚: '惊', 驕: '骄', 驗: '验',
  驟: '骤', 驥: '骥', 體: '体', 鬆: '松', 鬍: '胡', 鬚: '须',
  魚: '鱼', 魯: '鲁', 鮑: '鲍', 鯫: '鲰', 鯨: '鲸', 鳥: '鸟',
  鳳: '凤', 鳴: '鸣', 鴻: '鸿', 鶴: '鹤', 鷓: '鹧', 鷦: '鹪',
  鷯: '鹩', 鹵: '卤', 鹹: '咸', 麗: '丽', 麴: '曲', 鼇: '鳌',
  齒: '齿', 齟: '龃', 齣: '出', 齡: '龄', 齦: '龈', 齷: '龌',
  龍: '龙', 龔: '龚', 龕: '龛', 龜: '龟',
  溫: '温', 厭: '厌', 淚: '泪', 滿: '满', 漢: '汉',
  潛: '潜', 潤: '润', 澗: '涧', 瀾: '澜', 燈: '灯',
  煙: '烟', 燦: '灿', 爛: '烂', 猶: '犹', 獸: '兽',
  獨: '独', 塊: '块', 堅: '坚', 塗: '涂', 滅: '灭',
  靈: '灵', 壯: '壮', 聲: '声', 聽: '听', 聖: '圣',
  聯: '联', 聰: '聪', 肅: '肃', 腸: '肠', 膽: '胆',
  臉: '脸', 臥: '卧', 輿: '舆', 節: '节', 篤: '笃',
  簡: '简', 糧: '粮', 紀: '纪', 約: '约', 紅: '红',
  純: '纯', 紙: '纸', 細: '细', 終: '终', 結: '结',
  絕: '绝', 絡: '络', 經: '经', 綺: '绮', 綻: '绽',
  綽: '绰', 綢: '绸', 緒: '绪', 線: '线', 緩: '缓',
  編: '编', 緬: '缅', 練: '练', 縛: '缚', 縈: '萦',
  縷: '缕', 總: '总', 績: '绩', 繁: '繁', 繫: '系',
  繡: '绣', 繪: '绘', 繩: '绳', 繼: '继', 續: '续',
  鑑: '鉴',
};

/** 归一化单字：先 NFKC（全角→半角、兼容字形），再查繁简异体表 */
export function normalizeChar(ch: string): string {
  const w = ch.normalize('NFKC');
  const mapped = CHAR_VARIANTS[w];
  return mapped ?? w;
}

function isCjk(ch: string): boolean {
  const c = ch.codePointAt(0) ?? 0;
  return (
    (c >= 0x4e00 && c <= 0x9fff) ||
    (c >= 0x3400 && c <= 0x4dbf) ||
    (c >= 0xf900 && c <= 0xfaff)
  );
}

/** 句读：这些符号切分"句"，疑似窗口不得跨句 */
const SENTENCE_CUTS = new Set(['。', '！', '？', '；', '!', '?', ';', '\n', '\r', '…']);

/** 不进入匹配流的标点/空白 */
function isPunct(ch: string): boolean {
  if (/\s/.test(ch)) return true;
  const c = ch.codePointAt(0) ?? 0;
  return (
    (c >= 0x3000 && c <= 0x303f) || // CJK 标点
    (c >= 0xff00 && c <= 0xffef) || // 全角 ASCII / 符号
    (c >= 0x2000 && c <= 0x206f) || // 常用标点
    ch === '~'
  );
}

/* ------------------------------------------------------------------ */
/* 模式 Trie                                                           */
/* ------------------------------------------------------------------ */

interface PatternRef {
  entry: IdiomEntry;
  /** 去标点归一化后的模式串 */
  pattern: string;
  /** 原始模式（词目或别名） */
  raw: string;
  isAlias: boolean;
}

interface TrieNode {
  children: Map<string, TrieNode>;
  terminals: PatternRef[];
}

function buildTrie(refs: PatternRef[]): TrieNode {
  const root: TrieNode = { children: new Map(), terminals: [] };
  for (const ref of refs) {
    let node = root;
    for (const ch of ref.pattern) {
      let next = node.children.get(ch);
      if (!next) {
        next = { children: new Map(), terminals: [] };
        node.children.set(ch, next);
      }
      node = next;
    }
    node.terminals.push(ref);
  }
  return root;
}

function stripNorm(s: string): string {
  let out = '';
  for (const ch of s) {
    if (isPunct(ch)) continue;
    out += normalizeChar(ch);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 疑似发现所用的统计特征                                              */
/* ------------------------------------------------------------------ */

/** 句中虚字（连用多个则成语性显著下降） */
const PARTICLES = new Set('之乎者也矣焉哉兮耶欤耳尔然而则乃于以与其且若所为');
/** 不宜作为四字格起讫的字 */
const SOFT_EDGE = new Set('之乎也矣焉哉兮耶欤的了和与及而且以在于');

interface RawDictMatch {
  start: number;
  end: number;
  ref: PatternRef;
  text: string;
  skippedPunct: number;
  confidence: number;
  kind: MatchKind;
  reasons: string[];
}

/** 计算辞书命中的置信度与证据 */
function scoreDictMatch(m: Omit<RawDictMatch, 'confidence' | 'kind' | 'reasons'>): RawDictMatch {
  const { ref, text, skippedPunct } = m;
  const reasons: string[] = [];
  const canonNorm = stripNorm(ref.entry.idiom);
  const textNorm = stripNorm(text);
  let charDiff = 0;
  const n = Math.min(textNorm.length, canonNorm.length);
  for (let i = 0; i < n; i++) if (textNorm[i] !== canonNorm[i]) charDiff++;

  let confidence: number;
  if (!ref.isAlias) {
    if (charDiff === 0) {
      if (skippedPunct === 0) {
        confidence = 0.98;
        reasons.push(`与「${ref.entry.idiom}」词目逐字精确相符（${ref.entry.source}）`);
      } else {
        confidence = 0.95;
        reasons.push(`原文隔有句读，连读即词目「${ref.entry.idiom}」（${ref.entry.source}）`);
      }
    } else {
      confidence = 0.92;
      reasons.push(`字形经繁简/异体归一后与词目「${ref.entry.idiom}」逐字相符（${ref.entry.source}）`);
    }
  } else {
    confidence = skippedPunct === 0 ? 0.9 : 0.86;
    if (ref.raw.length >= 6) confidence = Math.min(0.9, confidence + 0.02);
    reasons.push(`与「${ref.entry.idiom}」的典籍异写「${ref.raw}」相符（${ref.entry.source}）`);
    if (charDiff > 0) reasons.push('其中含繁简/异体字形，已自动归一比对');
  }
  if (m.end - m.start >= 6 && skippedPunct > 0) {
    reasons.push('长句连读命中，边界已按原文句读校验');
  }

  return { ...m, confidence, kind: ref.isAlias ? 'variant' : 'exact', reasons };
}

/* ------------------------------------------------------------------ */
/* 主解析器                                                            */
/* ------------------------------------------------------------------ */

export class IdiomExtractor {
  private readonly trie: TrieNode;
  private readonly idiomBigrams = new Set<string>();
  private readonly maxPatternLen: number;

  constructor(private readonly catalog: IdiomCatalogPort) {
    const refs: PatternRef[] = [];
    let maxLen = 0;
    const add = (entry: IdiomEntry, raw: string, isAlias: boolean) => {
      const pattern = stripNorm(raw);
      if (pattern.length < 3) return;
      refs.push({ entry, raw, pattern, isAlias });
      maxLen = Math.max(maxLen, pattern.length);
    };
    for (const entry of catalog.entries()) {
      add(entry, entry.idiom, false);
      for (const a of entry.aliases) add(entry, a, true);
    }
    this.trie = buildTrie(refs);
    this.maxPatternLen = maxLen;

    for (const entry of catalog.entries()) {
      const norm = stripNorm(entry.idiom);
      if (norm.length === 4) {
        for (let i = 0; i < 3; i++) this.idiomBigrams.add(norm.slice(i, i + 2));
      }
    }
  }

  analyze(rawText: string): AnalyzeResult {
    const text = String(rawText ?? '');

    // 清洗流：跳过标点/空白，记录 clean → original 下标映射与所属句
    const cleanChars: string[] = [];
    const cleanToOrig: number[] = [];
    const cleanSentence: number[] = [];
    let sentence = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (SENTENCE_CUTS.has(ch)) sentence++;
      if (isPunct(ch)) continue;
      cleanChars.push(normalizeChar(ch));
      cleanToOrig.push(i);
      cleanSentence.push(sentence);
    }
    const clean = cleanChars.join('');

    /* ---------- 第一遍：辞书匹配 ---------- */
    const raw: RawDictMatch[] = [];
    for (let i = 0; i < clean.length; i++) {
      let node: TrieNode | undefined = this.trie;
      for (let j = i; j < Math.min(clean.length, i + this.maxPatternLen); j++) {
        node = node.children.get(clean[j]);
        if (!node) break;
        if (node.terminals.length) {
          for (const ref of node.terminals) {
            raw.push(
              scoreDictMatch({
                start: i,
                end: j + 1,
                ref,
                text: text.slice(cleanToOrig[i], cleanToOrig[j] + 1),
                skippedPunct: cleanToOrig[j] - cleanToOrig[i] + 1 - (j - i + 1),
              })
            );
          }
        }
      }
    }

    // 同一词目的重叠命中：保留最长（最具体的书证），其余折叠
    const byEntry = new Map<string, RawDictMatch[]>();
    for (const m of raw) {
      const key = m.ref.entry.idiom;
      const arr = byEntry.get(key);
      if (arr) arr.push(m);
      else byEntry.set(key, [m]);
    }
    const collapsed: RawDictMatch[] = [];
    for (const arr of byEntry.values()) {
      arr.sort((a, b) => a.start - b.start || b.end - a.end);
      const kept: RawDictMatch[] = [];
      for (const m of arr) {
        const idx = kept.findIndex((k) => m.start < k.end && m.end > k.start);
        if (idx === -1) kept.push(m);
        else if (m.end - m.start > kept[idx].end - kept[idx].start) kept[idx] = m;
      }
      collapsed.push(...kept);
    }

    // 跨词目重叠：置信度优先，长度次之，贪心保留
    collapsed.sort(
      (a, b) =>
        b.confidence - a.confidence ||
        b.end - b.start - (a.end - a.start) ||
        a.start - b.start
    );
    const accepted: RawDictMatch[] = [];
    for (const m of collapsed) {
      if (!accepted.some((k) => m.start < k.end && m.end > k.start)) accepted.push(m);
    }
    accepted.sort((a, b) => a.start - b.start);

    /* ---------- 第二遍：结构疑似（避开已命中区间，不跨句） ---------- */
    const reserved = accepted.map((m) => [m.start, m.end] as const);
    const freeAt = (i: number) => !reserved.some(([s, e]) => i >= s && i < e);

    interface Heur {
      start: number;
      end: number;
      score: number;
      reasons: string[];
    }
    const heurs: Heur[] = [];
    for (let i = 0; i + 4 <= clean.length; i++) {
      if (!freeAt(i) || !isCjk(clean[i]) || SOFT_EDGE.has(clean[i])) continue;
      for (const len of [6, 5, 4]) {
        const j = i + len;
        if (j > clean.length || !freeAt(j - 1) || cleanSentence[i] !== cleanSentence[j - 1]) continue;
        // 内部不得夹有句读/空白（原文跨度须恰等字数）
        if (cleanToOrig[j - 1] - cleanToOrig[i] + 1 !== len) continue;
        const win = clean.slice(i, j);
        if (![...win].every(isCjk) || SOFT_EDGE.has(win[len - 1])) continue;

        const uniq = new Set(win).size / len;
        const particleCount = [...win].filter((c) => PARTICLES.has(c)).length;
        if (particleCount >= 3) continue;

        let bigramHits = 0;
        for (let k = 0; k < len - 1; k++) {
          if (this.idiomBigrams.has(win.slice(k, k + 2))) bigramHits++;
        }
        const bigramRatio = bigramHits / (len - 1);

        let score = 0.2;
        score += particleCount === 0 ? 0.14 : particleCount === 1 ? 0.07 : 0;
        score += uniq >= 0.75 ? 0.08 : 0;
        score += 0.1 * bigramRatio;
        if (len === 4 && (win[0] === win[2] || win[1] === win[3])) score += 0.05;

        if (score < 0.45) continue;
        score = Math.min(0.59, score);

        const reasons = [
          `长度为 ${len} 字的连续汉字块，符合成语常见四字格节奏`,
          `与辞书成语用字二字组重合度约 ${Math.round(bigramRatio * 100)}%`,
          particleCount === 0
            ? '块内无虚字衬字，凝缩度高'
            : `块内含 ${particleCount} 个虚字，成语性中等`,
          '未命中任何辞书词目，需人工确认',
        ];
        heurs.push({ start: i, end: j, score, reasons });
      }
    }

    // 疑似项贪心非重叠，分数高者优先，限量展示
    heurs.sort(
      (a, b) => b.score - a.score || b.end - b.start - (a.end - a.start) || a.start - b.start
    );
    const heurKept: Heur[] = [];
    for (const h of heurs) {
      if (heurKept.length >= 12) break;
      const clash = [...accepted, ...heurKept].some((k) => h.start < k.end && h.end > k.start);
      if (!clash) heurKept.push(h);
    }
    heurKept.sort((a, b) => a.start - b.start);

    /* ---------- 组装候选（坐标映射回原文） ---------- */
    const candidates: Candidate[] = [];
    const pushCandidate = (
      start: number,
      end: number,
      kind: MatchKind,
      confidence: number,
      reasons: string[],
      entry: IdiomEntry | null
    ) => {
      const oStart = cleanToOrig[start];
      const oEnd = cleanToOrig[end - 1] + 1;
      candidates.push({
        id: '',
        start: oStart,
        end: oEnd,
        text: text.slice(oStart, oEnd),
        kind,
        confidence: Math.round(confidence * 100) / 100,
        reasons,
        entry,
        status: 'pending',
      });
    };

    for (const m of accepted) pushCandidate(m.start, m.end, m.kind, m.confidence, m.reasons, m.ref.entry);
    for (const h of heurKept) pushCandidate(h.start, h.end, 'heuristic', h.score, h.reasons, null);

    candidates.sort((a, b) => a.start - b.start || b.end - a.end - (a.end - a.start));
    candidates.forEach((c, i) => (c.id = `c${i + 1}`));

    return {
      candidates,
      heuristicTotal: heurs.length,
      heuristicShown: heurKept.length,
      analyzedAt: Date.now(),
    };
  }
}
