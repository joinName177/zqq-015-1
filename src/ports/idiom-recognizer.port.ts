import { IdiomRecognitionResult } from '../core/models';

/**
 * 古文成语识别端口（端口层契约）。
 * 实现方必须保证：识别失败时返回带 warnings 的安全结果，而非抛出异常，
 * 以免破坏调用方当前已粘贴的文本与已确认内容。
 */
export interface IdiomRecognizerPort {
  recognize(text: string): Promise<IdiomRecognitionResult>;
  getLexiconSize(): number;
}
