import { IdiomRecognitionResult } from '../core/models';
import { recognizeIdioms } from '../core/idiom-recognition-engine';
import { IdiomRecognizerPort } from '../ports/idiom-recognizer.port';
import { DEFAULT_IDIOM_LEXICON } from './idiom-lexicon';
import { RICH_IDIOMS } from './dictionary.adapter';

export class IdiomRecognizerAdapter implements IdiomRecognizerPort {
  private lexicon = DEFAULT_IDIOM_LEXICON;

  async recognize(text: string): Promise<IdiomRecognitionResult> {
    try {
      const result = recognizeIdioms(text, this.lexicon);

      // 用内置富档案成语补充语义证据（比喻义占比、感情色彩）
      for (const candidate of result.candidates) {
        if (candidate.tier === 'exact') {
          const profile = RICH_IDIOMS[candidate.fragment];
          if (profile) {
            candidate.evidence.push({
              kind: 'semantic',
              text: `语义DNA：比喻义 ${profile.dna.metaphoricalPercent}% · 感情色彩「${profile.dna.polarity}」`
            });
          }
        }
      }
      return result;
    } catch (err) {
      // 解析失败不能破坏当前内容：返回安全空结果，绝不抛出
      return {
        candidates: [],
        textLength: typeof text === 'string' ? text.length : 0,
        scannedChars: 0,
        warnings: [
          '识别引擎解析异常，已保留原文与既有结果：' +
            (err instanceof Error ? err.message : String(err))
        ],
        engineVersion: '1.0.0-fallback'
      };
    }
  }

  getLexiconSize(): number {
    return this.lexicon.length;
  }
}
