/**
 * 把 app 裡所有需要發音的文字匯出成 tools/tts/terms.json，給生成腳本吃。
 *
 *   node tools/tts/export_terms.mjs
 *
 * 每筆：{ id, text, lang, kind }
 *   kind: term（單字）｜sentence（例句／會話）
 * id 直接當音檔檔名，所以只能有 [a-z0-9-]。
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { CZECH_WORDS, ENGLISH_WORDS, PHRASE_SCENES, ALL_TERMS } from '../../src/constants/languageData.js';
import { CZ_GRAMMAR } from '../../src/constants/grammarCzech.js';
import { EN_GRAMMAR } from '../../src/constants/grammarEnglish.js';

const here = dirname(fileURLToPath(import.meta.url));
const items = [];
const seen = new Set();

function add(id, text, lang, kind) {
  const clean = String(text || '').trim();
  if (!clean || seen.has(id)) return;
  if (!/^[a-z0-9-]+$/.test(id)) throw new Error(`id 含非法字元，不能當檔名：${id}`);
  seen.add(id);
  items.push({ id, text: clean, lang, kind });
}

// 1. 所有單字（每日精選 + 單字大全）
ALL_TERMS.forEach((word) => add(word.id, word.term, word.lang, 'term'));

// 2. 每日精選字的例句
[...CZECH_WORDS, ...ENGLISH_WORDS].forEach((word) => add(`${word.id}-ex`, word.ex, word.lang, 'sentence'));

// 3. 情境會話（捷克句 + 英文句）
PHRASE_SCENES.forEach((scene) => {
  scene.lines.forEach((line, index) => {
    add(`${scene.id}-l${index}-cs`, line.cs, 'cs', 'sentence');
    add(`${scene.id}-l${index}-en`, line.en, 'en', 'sentence');
  });
});

// 4. 100 課文法的例句
CZ_GRAMMAR.forEach((lesson) => {
  lesson.examples.forEach(([sentence], index) => add(`${lesson.id}-e${index}`, sentence, 'cs', 'sentence'));
});
EN_GRAMMAR.forEach((lesson) => {
  lesson.examples.forEach(([sentence], index) => add(`${lesson.id}-e${index}`, sentence, 'en', 'sentence'));
});

const stats = items.reduce((acc, item) => {
  const key = `${item.lang}-${item.kind}`;
  acc[key] = (acc[key] || 0) + 1;
  return acc;
}, {});

writeFileSync(resolve(here, 'terms.json'), `${JSON.stringify(items, null, 1)}\n`, 'utf8');
console.log(`匯出 ${items.length} 筆 → tools/tts/terms.json`);
console.table(stats);
