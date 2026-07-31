/**
 * 100 天課程表：把文法課與單字大全串成每日課程。
 * 單字依「大全的教學順序」平均切給 100 天，上完一輪＝整本單字都走過一次。
 */

import { CZ_GRAMMAR, CZ_STAGES } from './grammarCzech';
import { EN_GRAMMAR, EN_STAGES } from './grammarEnglish';
import { CZ_VOCAB } from './vocabCzech';
import { EN_VOCAB } from './vocabEnglish';

export const TOTAL_DAYS = 100;

const CZ_PER_DAY = Math.ceil(CZ_VOCAB.length / TOTAL_DAYS);
const EN_PER_DAY = Math.ceil(EN_VOCAB.length / TOTAL_DAYS);

export const COURSE_DAYS = Array.from({ length: TOTAL_DAYS }, (_, index) => {
  const cs = CZ_GRAMMAR[index];
  const en = EN_GRAMMAR[index];
  return {
    day: index + 1,
    stage: cs.stage,
    stageName: CZ_STAGES[cs.stage - 1]?.name || '',
    enStageName: EN_STAGES[en.stage - 1]?.name || '',
    title: cs.title,
    csGrammar: cs,
    enGrammar: en,
    csWords: CZ_VOCAB.slice(index * CZ_PER_DAY, (index + 1) * CZ_PER_DAY),
    enWords: EN_VOCAB.slice(index * EN_PER_DAY, (index + 1) * EN_PER_DAY),
  };
});

export const COURSE_STAGES = CZ_STAGES.map((stage) => ({
  ...stage,
  days: COURSE_DAYS.filter((d) => d.stage === stage.id).map((d) => d.day),
}));

export function getCourseDay(day) {
  const clamped = Math.min(Math.max(Number(day) || 1, 1), TOTAL_DAYS);
  return COURSE_DAYS[clamped - 1];
}

/** 第一個還沒完成的課次（全部完成就回到第 1 課） */
export function firstUnfinishedDay(doneDays) {
  const done = new Set(Array.isArray(doneDays) ? doneDays : []);
  for (let day = 1; day <= TOTAL_DAYS; day += 1) {
    if (!done.has(day)) return day;
  }
  return 1;
}
