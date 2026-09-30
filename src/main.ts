import './ui/styles.css';
import { DictionaryAdapter } from './adapters/dictionary.adapter';
import { KinshipAdapter } from './adapters/kinship.adapter';
import { IdiomRecognizerAdapter } from './adapters/idiom-recognizer.adapter';
import {
  IdiomProfile,
  KinshipResult,
  IdiomCandidate,
  IdiomRecognitionResult
} from './core/models';
import { renderIdiomApp, AppMode } from './ui/app';

const dictAdapter = new DictionaryAdapter();
const kinshipAdapter = new KinshipAdapter();
const recognizerAdapter = new IdiomRecognizerAdapter();

let currentMode: AppMode = 'single';
let currentProfile: IdiomProfile;
let compareA = '守株待兔';
let compareB = '刻舟求剑';
let kinshipResult: KinshipResult | null = null;

// 古文识别模式状态
let recognitionText = '';
let recognitionResult: IdiomRecognitionResult | null = null;
let recognitionError: string | null = null;
let queue: IdiomCandidate[] = [];
let slotA: string | null = null;
let slotB: string | null = null;

const rootEl = document.getElementById('app')!;

function esc(s: string): string {
  return s.replace(/[&<>'"]/g, t => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[t] || t));
}

async function init() {
  currentProfile = await dictAdapter.getProfile('守株待兔');
  const profA = await dictAdapter.getProfile(compareA);
  const profB = await dictAdapter.getProfile(compareB);
  kinshipResult = kinshipAdapter.compareIdioms(profA, profB);
  refreshView();
}

function refreshView() {
  try {
    renderIdiomApp(
      rootEl,
      {
        currentProfile,
        presets: dictAdapter.getPresets(),
        mode: currentMode,
        kinshipResult,
        compareA,
        compareB,
        recognitionText,
        recognitionResult,
        recognitionError,
        queue,
        slotA,
        slotB
      },
      {
        onSearch: async (text: string) => {
          currentProfile = await dictAdapter.getProfile(text);
          kinshipResult = null;
          refreshView();
        },
        onCompare: async (textA: string, textB: string) => {
          compareA = textA;
          compareB = textB;
          const pA = await dictAdapter.getProfile(textA);
          const pB = await dictAdapter.getProfile(textB);
          kinshipResult = kinshipAdapter.compareIdioms(pA, pB);
          refreshView();
        },
        onSwitchMode: (mode: AppMode) => {
          currentMode = mode;
          refreshView();
        },
        onRecognize: async (text: string) => {
          recognitionText = text;
          try {
            const result = await recognizerAdapter.recognize(text);
            // 与既有队列对账：同一位置同一片段的候选保留「已确认」状态
            for (const c of result.candidates) {
              if (queue.some(q => q.fragment === c.fragment && q.start === c.start)) {
                c.status = 'confirmed';
              }
            }
            recognitionResult = result;
            recognitionError = null;
          } catch (err) {
            // 解析失败不能破坏当前内容：保留原文、既有识别结果与队列
            recognitionError = err instanceof Error ? err.message : String(err);
          }
          refreshView();
        },
        onRecognitionTextChange: (text: string) => {
          recognitionText = text;
        },
        onConfirmCandidate: (id: string) => {
          const c = recognitionResult?.candidates.find(x => x.id === id);
          if (!c) return;
          c.status = 'confirmed';
          if (!queue.some(q => q.id === id)) queue.push(c);
          if (!slotA) slotA = id;
          else if (!slotB) slotB = id;
          refreshView();
        },
        onIgnoreCandidate: (id: string) => {
          const c = recognitionResult?.candidates.find(x => x.id === id);
          if (c) c.status = 'ignored';
          queue = queue.filter(q => q.id !== id);
          if (slotA === id) slotA = null;
          if (slotB === id) slotB = null;
          refreshView();
        },
        onRestoreCandidate: (id: string) => {
          const c = recognitionResult?.candidates.find(x => x.id === id);
          if (c) c.status = 'pending';
          refreshView();
        },
        onRemoveFromQueue: (id: string) => {
          queue = queue.filter(q => q.id !== id);
          if (slotA === id) slotA = null;
          if (slotB === id) slotB = null;
          const c = recognitionResult?.candidates.find(x => x.id === id);
          if (c && c.status === 'confirmed') c.status = 'pending';
          refreshView();
        },
        onAssignQueueSlot: (id: string, slot: 'A' | 'B') => {
          if (slot === 'A') slotA = slotA === id ? null : id;
          else slotB = slotB === id ? null : id;
          refreshView();
        },
        onQueueCompare: async () => {
          const a = queue.find(q => q.id === slotA);
          const b = queue.find(q => q.id === slotB);
          if (!a || !b) return;
          compareA = a.fragment;
          compareB = b.fragment;
          currentMode = 'compare';
          const pA = await dictAdapter.getProfile(compareA);
          const pB = await dictAdapter.getProfile(compareB);
          kinshipResult = kinshipAdapter.compareIdioms(pA, pB);
          refreshView();
        }
      }
    );
  } catch (err) {
    // 渲染层兜底：任何异常都不白屏、不破坏当前内容
    rootEl.innerHTML = `
      <div style="padding:60px 20px;text-align:center;color:var(--ash);">
        <p style="font-size:18px;color:var(--vermilion);margin-bottom:12px;">⚠️ 界面渲染遇到异常</p>
        <p style="font-size:14px;margin-bottom:8px;">已保留您粘贴的古文、识别结果与对比队列，未造成内容丢失。</p>
        <p style="font-size:12px;margin-bottom:24px;color:var(--ash);">${esc(err instanceof Error ? err.message : String(err))}</p>
        <button class="btn-search" id="btnReload">重新载入界面</button>
      </div>
    `;
    rootEl.querySelector('#btnReload')?.addEventListener('click', () => refreshView());
  }
}

init();
