import type { MatchKind } from './models';

/** 对比队列中的一个可比对条目（字段与 QueueItem 对齐，避免循环依赖） */
export interface CompareTarget {
  key: string;
  idiom: string;
  matchedText: string;
  kind: MatchKind;
  confidence: number;
  source: string;
  gloss: string;
}

export interface CompareResult {
  a: CompareTarget;
  b: CompareTarget;
  /** 0 ~ 100 综合亲缘度 */
  score: number;
  grade: '同源近义' | '近义相通' | '同域可参' | '形义迥别';
  charOverlap: number;
  posOverlap: number;
  sharedChars: { char: string; positions: [number, number] }[];
  sameBook: boolean;
  bookLabel: string;
  glossShared: string[];
  verdict: string;
}

/**
 * 义类标签：每条含一组带权重的代表字（单字易撞车，需累计 ≥2 分才算命中），
 * 以及一组直接命中的二元词。用于估算两成语的语义场距离。
 */
const SEMANTIC_TAGS: { tag: string; chars: [string, number][]; bigrams: string[] }[] = [
  { tag: '勤学向学', chars: [['学', 2], ['勤', 2], ['读', 2], ['书', 1], ['师', 1], ['诲', 2], ['韦', 2], ['教', 1]], bigrams: ['不倦', '不厌'] },
  { tag: '守志持节', chars: [['志', 2], ['节', 2], ['贞', 2], ['屈', 1], ['忠', 2], ['义', 1]], bigrams: ['守志', '成仁', '取义'] },
  { tag: '谨慎戒惧', chars: [['慎', 2], ['谨', 2], ['兢', 2], ['渊', 1], ['冰', 1], ['微', 1], ['渐', 1]], bigrams: ['如履', '临深'] },
  { tag: '军事谋略', chars: [['兵', 2], ['战', 2], ['攻', 1], ['谋', 1], ['鼓', 1], ['戈', 2], ['阵', 2], ['铠', 2]], bigrams: ['百战', '击虚'] },
  { tag: '拘泥愚蠢', chars: [['株', 2], ['刻', 1], ['舟', 1], ['揠', 2], ['窥', 1], ['蛙', 2], ['蠢', 2], ['愚', 2], ['枉', 1]], bigrams: ['守株', '刻舟', '井底', '邯郸', '效颦', '揠苗'] },
  { tag: '徒劳无果', chars: [['徒', 2], ['枉', 2], ['空', 1], ['弃', 1]], bigrams: ['无功', '无补', '劳而', '无益'] },
  { tag: '变化无常', chars: [['翻', 1], ['覆', 1], ['暮', 1], ['朝', 1], ['幻', 2], ['易', 1], ['瞬', 1]], bigrams: ['翻云', '覆雨', '朝三', '暮四', '变化'] },
  { tag: '时光迅逝', chars: [['隙', 2], ['驹', 2], ['逝', 2], ['流', 1], ['岁', 1]], bigrams: ['白驹', '过隙', '光阴'] },
  { tag: '贤才品德', chars: [['贤', 2], ['德', 2], ['仁', 1], ['善', 1], ['杰', 1], ['士', 1]], bigrams: ['出类', '拔萃', '任重'] },
  { tag: '困厄患难', chars: [['涸', 2], ['辙', 2], ['鲋', 2], ['困', 2], ['厄', 2], ['患', 1], ['苦', 1], ['危', 1]], bigrams: ['涸辙', '水深', '火热'] },
  { tag: '朋友恩义', chars: [['刎', 2], ['颈', 2], ['濡', 2], ['沫', 2], ['兰', 1], ['友', 2]], bigrams: ['金兰', '刎颈', '相濡', '知遇', '知交'] },
  { tag: '言辞辩才', chars: [['辩', 2], ['辞', 1], ['舌', 1], ['口', 1], ['言', 1]], bigrams: ['悬河', '三寸', '滔滔'] },
  { tag: '声势壮盛', chars: [['浩', 1], ['霆', 2], ['雷', 1], ['腾', 1], ['盛', 1]], bigrams: ['雷霆', '万马', '波澜'] },
  { tag: '旷达怡情', chars: [['旷', 2], ['怡', 2], ['朗', 1], ['悠', 2], ['闲', 1]], bigrams: ['心旷', '神怡', '豁然', '开朗', '怡然', '悠然', '春风'] },
  { tag: '自然山水', chars: [['山', 1], ['水', 1], ['林', 1], ['壑', 2], ['川', 1], ['涧', 2]], bigrams: ['高山', '流水', '千山', '万水'] },
  { tag: '虚静无为', chars: [['虚', 1], ['静', 1], ['隐', 1], ['尘', 1]], bigrams: ['无为', '出世', '和光', '同尘'] },
  { tag: '见识洞察', chars: [['察', 2], ['洞', 2], ['鉴', 2], ['明', 1], ['毫', 2]], bigrams: ['明察', '洞若', '观火', '高瞻'] },
  { tag: '居安备患', chars: [['备', 1], ['患', 1], ['危', 1], ['安', 1]], bigrams: ['居安', '未雨', '绸缪', '防微', '曲突'] },
  { tag: '报恩复仇', chars: [['报', 1], ['恩', 1], ['仇', 2]], bigrams: ['结草', '衔环', '报恩'] },
  { tag: '物色人才', chars: [['骏', 2], ['骨', 1], ['市', 2]], bigrams: ['千金', '伯乐', '三顾'] },
  { tag: '雄壮气象', chars: [['巍', 2], ['峨', 2], ['磅', 2], ['礴', 2]], bigrams: ['气象', '万千', '浩浩', '汤汤'] },
  { tag: '离情别绪', chars: [['别', 1], ['离', 1], ['愁', 2], ['怨', 1]], bigrams: ['离情', '别绪', '相思', '折柳'] },
];

function bookOf(source: string): string {
  const m = source.match(/^《([^·》·]+)/);
  return m ? m[1] : source.split('·')[0].replace(/^《/, '');
}

function tagsOf(t: CompareTarget): Set<string> {
  const text = t.idiom + t.gloss;
  const tags = new Set<string>();
  for (const { tag, chars, bigrams } of SEMANTIC_TAGS) {
    let score = 0;
    for (const [c, w] of chars) if (text.includes(c)) score += w;
    if (bigrams.some((bg) => text.includes(bg))) score += 2;
    // 单字需累计到 2 分（避免单字误触），二元词命中即可
    if (score >= 2) tags.add(tag);
  }
  return tags;
}

function idiomChars(t: CompareTarget): string[] {
  // 取规范词目的前 6 字用于对位比较（长句取核心四字）
  return t.idiom.replace(/[，,。、]/g, '').slice(0, 6).split('');
}

export function compareTwo(a: CompareTarget, b: CompareTarget): CompareResult {
  const ca = idiomChars(a);
  const cb = idiomChars(b);

  /* 字形重合（含同字对位） */
  const sharedChars: { char: string; positions: [number, number] }[] = [];
  const setB = new Map<string, number[]>();
  cb.forEach((c, i) => {
    const arr = setB.get(c);
    if (arr) arr.push(i);
    else setB.set(c, [i]);
  });
  let posHits = 0;
  const n = Math.min(ca.length, cb.length);
  for (let i = 0; i < ca.length; i++) {
    const js = setB.get(ca[i]);
    if (js && js.length) {
      const j = js.shift()!;
      sharedChars.push({ char: ca[i], positions: [i, j] });
      if (i < n && i === j) posHits++;
    }
  }
  const charOverlap = sharedChars.length / Math.max(ca.length, cb.length);
  const posOverlap = n > 0 ? posHits / n : 0;

  /* 典籍同源 */
  const ba = bookOf(a.source);
  const bb = bookOf(b.source);
  const sameBook = !!ba && !!bb && ba === bb;

  /* 语义标签交集 */
  const ta = tagsOf(a);
  const tb = tagsOf(b);
  const glossShared = [...ta].filter((t) => tb.has(t));
  const semanticJaccard: number =
    ta.size + tb.size === 0 ? 0 : glossShared.length / new Set([...ta, ...tb]).size;

  // 语义权重最高：字形全然不同的近义成语（如守株待兔 / 刻舟求剑）亦可获高分
  const score = Math.round(
    (charOverlap * 0.22 + posOverlap * 0.18 + (sameBook ? 0.12 : 0) + semanticJaccard * 0.48) * 100
  );

  let grade: CompareResult['grade'];
  if (score >= 62) grade = '同源近义';
  else if (score >= 38) grade = '近义相通';
  else if (score >= 18) grade = '同域可参';
  else grade = '形义迥别';

  const parts: string[] = [];
  parts.push(
    sharedChars.length
      ? `共用 ${sharedChars.length} 字（${sharedChars.map((s) => s.char).join('、')}），其中 ${posHits} 字位置对应`
      : '两词无一字相重，字形渊源不同'
  );
  parts.push(sameBook ? `同出《${ba}》，典源相同` : `分见${ba ? `《${ba}》` : '—'}与${bb ? `《${bb}》` : '—'}，典源各异`);
  parts.push(
    glossShared.length
      ? `义类交集：${glossShared.join('、')}`
      : '义类标签无交集，语义场距离较远'
  );

  return {
    a,
    b,
    score,
    grade,
    charOverlap: Math.round(charOverlap * 100),
    posOverlap: Math.round(posOverlap * 100),
    sharedChars,
    sameBook,
    bookLabel: sameBook ? `《${ba}》` : `${ba} × ${bb}`,
    glossShared,
    verdict: parts.join('；') + '。',
  };
}
