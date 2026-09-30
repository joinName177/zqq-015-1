export interface OracleChar {
  char: string;
  pinyin: string;
  radical: string;
  scriptType: '甲骨文' | '金文' | '小篆';
  glyphSvg: string; // SVG path or stroke representation
  originalMeaning: string;
  pictographicExplanation: string;
}

export interface AllusionSource {
  dynasty: string;
  classicBook: string;
  author: string;
  yearApprox: string;
  historicalEvent: string;
  originalAncientQuote: string;
}

export interface SemanticEvolutionStep {
  era: string;
  meaning: string;
  semanticCategory: '本义' | '引申义' | '比喻义';
  contextSample: string;
}

export interface SemanticDNA {
  originalPercent: number;     // 本义占比
  extendedPercent: number;     // 引申义占比
  metaphoricalPercent: number; // 比喻义占比
  polarity: '褒义' | '中性' | '贬义';
  coreSememes: string[];
}

export interface IdiomProfile {
  id: string;
  idiom: string;
  pinyin: string;
  characters: OracleChar[];
  allusion: AllusionSource;
  evolutionPath: SemanticEvolutionStep[];
  dna: SemanticDNA;
  modernDefinition: string;
  syntacticRole: string;
}

export interface KinshipResult {
  idiomA: IdiomProfile;
  idiomB: IdiomProfile;
  kinshipScore: number; // 0 - 100
  dnaVectorSimilarity: number;
  sharedSememes: string[];
  polarityCompatibility: boolean;
  relationshipLabel: '同源近亲' | '异曲同工' | '形似神离' | '截然对立' | '远房微亲';
  comparativeAnalysis: string;
}

/** 识别候选片段层级：精确匹配内置词典 / 构词特征推测 */
export type CandidateTier = 'exact' | 'tentative';

/** 候选片段状态：待确认 / 已确认入队 / 已忽略 */
export type CandidateStatus = 'pending' | 'confirmed' | 'ignored';

/** 证据类别：词典匹配 / 典故出处 / 结构特征 / 语义佐证 / 上下文信号 */
export type EvidenceKind = 'dictionary' | 'source' | 'structure' | 'semantic' | 'context';

export interface RecognitionEvidence {
  kind: EvidenceKind;
  text: string;
}

/** 内置成语词典条目（用于古文段落识别） */
export interface IdiomLexiconEntry {
  idiom: string;
  dynasty?: string;   // 朝代
  source?: string;    // 典籍，如《韩非子·五蠹》
  note?: string;      // 释义备注
}

/** 从古文段落中识别出的疑似成语片段 */
export interface IdiomCandidate {
  id: string;
  fragment: string;       // 片段文字（通常为四字）
  start: number;          // 在原文中的起始下标
  end: number;            // 结束下标（不含）
  confidence: number;     // 置信度 0 - 100
  tier: CandidateTier;    // 精确匹配 / 待考推测
  status: CandidateStatus;
  evidence: RecognitionEvidence[];
}

/** 古文成语识别结果 */
export interface IdiomRecognitionResult {
  candidates: IdiomCandidate[];
  textLength: number;     // 原文总字符数
  scannedChars: number;   // 扫描过的汉字数
  warnings: string[];     // 非致命警告（解析失败时也保证返回空结果而非抛错）
  engineVersion: string;
}
