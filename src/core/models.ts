/** 匹配来源类型 */
export type MatchKind = 'exact' | 'variant' | 'heuristic';

/** 候选处理状态 */
export type CandidateStatus = 'pending' | 'confirmed' | 'ignored';

/** 辞书中的一条成语词目 */
export interface IdiomEntry {
  /** 规范写法 */
  idiom: string;
  /** 可在古文中出现的异体 / 近形 / 繁简写法 */
  aliases: string[];
  /** 简释义 */
  gloss: string;
  /** 出处，如《左传·庄公十年》 */
  source: string;
}

/** 原文中识别出的一个候选成语片段 */
export interface Candidate {
  id: string;
  /** 半开区间 [start, end)，基于粘贴原文的字符下标 */
  start: number;
  end: number;
  /** 原文中实际命中的文字 */
  text: string;
  kind: MatchKind;
  /** 置信度 0 ~ 1 */
  confidence: number;
  /** 判定依据（人话说明） */
  reasons: string[];
  /** 命中的辞书词目，疑似候选为 null */
  entry: IdiomEntry | null;
  status: CandidateStatus;
}

/** 一次解析的完整结果 */
export interface AnalyzeResult {
  candidates: Candidate[];
  /** 疑似候选总数（折叠前） */
  heuristicTotal: number;
  /** 实际展示的疑似候选数 */
  heuristicShown: number;
  analyzedAt: number;
}

/** 已确认进入对比队列的条目 */
export interface QueueItem {
  /** 去重键：规范词目（疑似项为原文片段） */
  key: string;
  idiom: string;
  matchedText: string;
  kind: MatchKind;
  confidence: number;
  source: string;
  gloss: string;
  before: string;
  after: string;
  addedAt: number;
}

export const KIND_LABEL: Record<MatchKind, string> = {
  exact: '辞书精确',
  variant: '异体近形',
  heuristic: '结构疑似',
};

export function confidenceTier(c: number): { label: string; cls: string } {
  if (c >= 0.8) return { label: '高置信', cls: 'high' };
  if (c >= 0.6) return { label: '中置信', cls: 'mid' };
  return { label: '低置信', cls: 'low' };
}
