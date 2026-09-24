/**
 * 捷克文 → 拼讀（給中文母語者的近似念法）
 *
 * 捷克文拼字幾乎是一字一音，所以整句的念法可以直接照規則推出來，
 * 不用一句一句手寫（手寫版本以前只標了句子裡的一兩個字，跟實際念法對不上）。
 *
 * 做法：字母 → 音素 → 同化（清濁、sh、ř）→ 切音節 → 轉成拉丁拼讀。
 * 慣例（跟單字表一致）：
 *   - 音節用 `-` 分開，重音音節全大寫；捷克文重音永遠在字的第一個音節。
 *   - 單音節的字全小寫（den、pas），避免整句都在吼。
 *   - 長母音疊字母：á=aa、í/ý=ee、ú/ů=oo、é=eh、ó=oh。
 *   - j=y、c=ts、č=ch、š=sh、ž=zh、ch=kh、ř=rzh（清音時 rsh）、ď/ť/ň=dy/ty/ny。
 */

/** 外語借詞、縮寫，還有拼字跟實際念法差很多的字：直接給答案 */
const EXCEPTIONS = {
  // js- 開頭的 být 變化，口語裡 j 不發音
  jsem: 'sem', jsi: 'si', jsme: 'sme', jste: 'ste', jsou: 'sou',
  // 專有名詞與外語
  josh: 'josh', 'tchaj-wan': 'TCHAY-van', 'tchaj-wanu': 'TCHAY-va-nu',
  'tchaj-wanec': 'TCHAY-va-nets', 'tchaj-wance': 'TCHAY-van-tse',
  isic: 'I-sik', eu: 'EH-oo',
  learning: 'LER-ning', agreement: 'a-GREE-ment', instagram: 'IN-sta-gram',
  wifi: 'VAY-fay', email: 'EE-mayl', ok: 'oh-KEY',
};

/** 借詞裡的 di/ti/ni 唸硬音（native 的字才軟化成 ďi/ťi/ňi）*/
const HARD_DI_STEMS = [
  'aktiv', 'diktát', 'diskus', 'diskoték', 'informati', 'inici',
  'kredit', 'matemati', 'medicín', 'motiv', 'nikotin', 'pastil', 'penicilin',
  'politi', 'pozitiv', 'praktic', 'recepti', 'stipendi', 'studi', 'technic',
  'tenis', 'tipov', 'vitamin',
];

const VOWELS = { a: 'a', á: 'aa', e: 'e', é: 'eh', i: 'i', í: 'ee', o: 'o', ó: 'oh', u: 'u', ú: 'oo', ů: 'oo' };
const DIPHTHONGS = { ou: 'ou', au: 'au', eu: 'eu' };

/** 有聲 ↔ 無聲的對應（同化用）*/
const DEVOICE = { b: 'p', d: 't', ď: 'ť', g: 'k', v: 'f', z: 's', ž: 'š', h: 'x', ǰ: 'č', ʒ: 'c', ř: 'Ř' };
const VOICE = { p: 'b', t: 'd', ť: 'ď', k: 'g', f: 'v', s: 'z', š: 'ž', x: 'h', č: 'ǰ', c: 'ʒ', Ř: 'ř' };

/** 會引起前面子音同化的障礙音。v/h/ř 自己會被同化，但不會拉別人 */
const TRIGGERS = new Set(['p', 'b', 't', 'd', 'ť', 'ď', 'k', 'g', 'f', 's', 'z', 'š', 'ž', 'x', 'c', 'č', 'ǰ', 'ʒ']);
const VOICED = new Set(Object.keys(DEVOICE));
const VOICELESS = new Set(Object.keys(VOICE));

/** 前置詞跟後面的字唸成一個單位，所以不套「字尾清化」（v autobuse、bez okna）*/
const PROCLITICS = new Set(['v', 've', 'z', 'ze', 's', 'se', 'k', 'ke', 'od', 'ode', 'nad', 'pod', 'před', 'bez', 'přes', 'skrz']);

const CONSONANTS = {
  b: 'b', c: 'c', č: 'č', d: 'd', ď: 'ď', f: 'f', g: 'g', h: 'h', j: 'j', k: 'k',
  l: 'l', m: 'm', n: 'n', ň: 'ň', p: 'p', q: 'k', r: 'r', ř: 'ř', s: 's', š: 'š',
  t: 't', ť: 'ť', v: 'v', w: 'v', x: 'ks', z: 'z', ž: 'ž',
};

/** 音素 → 拼讀字母 */
const SPELL = {
  ...VOWELS, ...DIPHTHONGS,
  p: 'p', b: 'b', t: 't', d: 'd', ť: 'ty', ď: 'dy', k: 'k', g: 'g', f: 'f', v: 'v',
  s: 's', z: 'z', š: 'sh', ž: 'zh', x: 'kh', h: 'h', c: 'ts', č: 'ch', ǰ: 'j', ʒ: 'dz',
  m: 'm', n: 'n', ň: 'ny', r: 'r', ř: 'rzh', Ř: 'rsh', l: 'l', j: 'y', ʲ: 'y',
};

const isVowel = (ph) => ph in VOWELS || ph in DIPHTHONGS;

const SIBILANTS = new Set(['s', 'z', 'š', 'ž']);
const STOPS = new Set(['p', 'b', 't', 'd', 'ť', 'ď', 'k', 'g']);
const NASALS = new Set(['m', 'n', 'ň']);
const LIQUIDS = new Set(['r', 'ř', 'Ř', 'l', 'ʲ']);   // 能當音節開頭第二個音的
const SONORANTS = new Set([...LIQUIDS, ...NASALS, 'j']);

/**
 * 這串子音能不能當音節的開頭？決定音節線畫在哪：
 * 可以 → stra-、tvr-、vje-、smí-；不可以 → rl-、čň-、dn- 就得斷在前面（KAR-lo-vye、SPAA-tech-nyee）。
 */
function legalOnset(run) {
  if (run.length <= 1) return true;
  if (run.length === 2) {
    const [a, b] = run;
    if (SONORANTS.has(a)) return a === 'm' && NASALS.has(b);      // mn-、mň-（mnoho）
    if (LIQUIDS.has(b) || b === 'v') return a !== b;                // pr- tř- kl- tv- vje-
    return SIBILANTS.has(a) && (STOPS.has(b) || NASALS.has(b));    // st- šk- zn-
  }
  if (run.length === 3) return SIBILANTS.has(run[0]) && legalOnset(run.slice(1));
  return false;
}

/** 字母 → 音素。ě 和 di/ti/ni 會回頭改前一個子音 */
function toPhonemes(word) {
  const hardDi = HARD_DI_STEMS.some((stem) => word.startsWith(stem));
  const out = [];
  let i = 0;
  while (i < word.length) {
    const two = word.slice(i, i + 2);
    if (two === 'ch') { out.push('x'); i += 2; continue; }
    if (two === 'dž') { out.push('ǰ'); i += 2; continue; }
    if (two === 'ou' || (two === 'au' && i === 0) || (two === 'eu' && i === 0)) { out.push(two); i += 2; continue; }

    const ch = word[i];
    i += 1;
    const prev = out[out.length - 1];

    if (ch === 'ě') {
      if (prev === 'd') out[out.length - 1] = 'ď';
      else if (prev === 't') out[out.length - 1] = 'ť';
      else if (prev === 'n') out[out.length - 1] = 'ň';
      else if (prev === 'm') out.push('ň');       // mě = mňe
      else out.push('ʲ');                          // bě pě vě fě = bye pye vye fye
      out.push('e');
      continue;
    }
    if ((ch === 'i' || ch === 'í') && !hardDi) {   // di/ti/ni 軟化成 ďi/ťi/ňi
      if (prev === 'd') out[out.length - 1] = 'ď';
      else if (prev === 't') out[out.length - 1] = 'ť';
      else if (prev === 'n') out[out.length - 1] = 'ň';
    }
    if (ch === 'y') { out.push('i'); continue; }   // y 是硬音的 i
    if (ch === 'ý') { out.push('í'); continue; }
    if (ch in VOWELS) {
      // i／í 後面接別的母音時中間會多一個 j（kopie = ko-pi-ye）
      if (ch !== 'i' && ch !== 'í' && (prev === 'i' || prev === 'í')) out.push('ʲ');
      out.push(ch);
      continue;
    }
    if (ch in CONSONANTS) { out.push(...CONSONANTS[ch].split('')); continue; }
    out.push(ch);                                  // 沒見過的字元照抄
  }
  return out;
}

/** 逆向同化：後面的障礙音決定前面的清濁 */
function regressive(seq) {
  // zpáteční → spáteční、kde → gde
  for (let i = seq.length - 2; i >= 0; i -= 1) {
    const cur = seq[i];
    const next = seq[i + 1];
    if (!cur || !next) continue;
    if (!TRIGGERS.has(next.ph)) continue;
    if (VOICELESS.has(next.ph) && VOICED.has(cur.ph)) cur.ph = DEVOICE[cur.ph];
    else if (VOICED.has(next.ph) && VOICELESS.has(cur.ph)) {
      // 跨字的 c/č 不標成 dz/j：那兩個拼法看了只會更亂（moc děkuju 就寫 mots）
      if ((cur.ph === 'c' || cur.ph === 'č') && next.word !== cur.word) continue;
      cur.ph = VOICE[cur.ph];
    }
  }
}

/**
 * 整句的清濁同化：跨字也要算，因為捷克文連著唸就會同化（v Praze → f Praze）。
 * seq 是 { ph, word, tok } 的陣列，標點處放 null 當停頓。
 */
function assimilate(seq) {
  regressive(seq);
  // 字尾的障礙音在停頓、母音、響音前一律清化（odkud → otkut）；前置詞除外
  for (let i = 0; i < seq.length; i += 1) {
    const cur = seq[i];
    if (!cur || !VOICED.has(cur.ph)) continue;
    const next = seq[i + 1];
    if (next && next.word === cur.word) continue;
    if (PROCLITICS.has(cur.tok.raw.toLowerCase())) continue;
    if (next && VOICED.has(next.ph) && TRIGGERS.has(next.ph)) continue; // z Brna 保持 z
    cur.ph = DEVOICE[cur.ph];
  }
  regressive(seq);   // 字尾清化完再跑一次，整串字尾才會一起清（odjezd → odjest）

  // 順向同化：h 和 ř 跟著前面的清音變清（na shledanou → skhledanou、přes → prshes）
  for (let i = 1; i < seq.length; i += 1) {
    const cur = seq[i];
    const prev = seq[i - 1];
    if (!cur || !prev || prev.word !== cur.word) continue;
    if (!VOICELESS.has(prev.ph) && prev.ph !== 'Ř') continue;
    if (cur.ph === 'h') cur.ph = 'x';
    else if (cur.ph === 'ř') cur.ph = 'Ř';
  }
  return seq;
}

/** 找出音節核心：母音，加上夾在子音裡或收尾的 r/l（vlk、potvrzení、kufr）*/
function nucleiOf(phs) {
  const nuclei = [];
  let run = [];
  const flushRun = (atEnd) => {
    for (let k = 1; k < run.length - (atEnd ? 0 : 1); k += 1) {
      const idx = run[k];
      if (phs[idx] === 'r' || phs[idx] === 'l') { nuclei.push(idx); break; }
    }
    run = [];
  };
  phs.forEach((ph, idx) => {
    if (isVowel(ph)) { flushRun(false); nuclei.push(idx); } else run.push(idx);
  });
  flushRun(true);
  return nuclei.sort((a, b) => a - b);
}

/** 切音節：字首子音全給第一個音節，中間的子音群盡量給下一個音節（最大化開頭）*/
function syllabify(phs) {
  const nuclei = nucleiOf(phs);
  if (!nuclei.length) return [phs];
  const syls = nuclei.map(() => []);
  syls[0].push(...phs.slice(0, nuclei[0]));           // 字首子音群
  nuclei.forEach((n, t) => {
    syls[t].push(phs[n]);
    const end = t + 1 < nuclei.length ? nuclei[t + 1] : phs.length;
    const run = phs.slice(n + 1, end);
    if (!run.length) return;
    if (t + 1 === nuclei.length) { syls[t].push(...run); return; } // 字尾子音群
    let cut = run.length;                                          // 盡量把子音群留給下一個音節
    while (cut > 1 && !legalOnset(run.slice(run.length - cut))) cut -= 1;
    syls[t].push(...run.slice(0, run.length - cut));
    syls[t + 1].push(...run.slice(run.length - cut));
  });
  return syls;
}

const spell = (phs) => phs.map((ph) => SPELL[ph] ?? ph).join('');

/** 一個字的拼讀（音素已同化）：多音節的字第一個音節大寫 */
function renderWord(phs) {
  const syls = syllabify(phs).map(spell).filter(Boolean);
  if (syls.length <= 1) return syls.join('');
  return [syls[0].toUpperCase(), ...syls.slice(1)].join('-');
}

const WORD_RE = /[a-záčďéěíňóřšťúůýž]+(?:-[a-záčďéěíňóřšťúůýž]+)*/gi;

/**
 * 把一段捷克文轉成拼讀，標點原樣保留。
 * 整句一起處理，跨字的清濁同化才會對（v Praze → f PRA-ze）。
 */
export function czechPron(text) {
  if (!text) return '';
  const tokens = [];  // { raw, phs?, exception? }
  let last = 0;
  for (const match of String(text).matchAll(WORD_RE)) {
    if (match.index > last) tokens.push({ raw: text.slice(last, match.index) });
    const lower = match[0].toLowerCase();
    tokens.push(lower in EXCEPTIONS
      ? { raw: match[0], phs: toPhonemes(lower), exception: EXCEPTIONS[lower] }
      : { raw: match[0], phs: toPhonemes(lower) });
    last = match.index + match[0].length;
  }
  if (last < text.length) tokens.push({ raw: text.slice(last) });

  // 攤平成音素序列做同化，標點與例外字當成停頓（null）
  const seq = [];
  tokens.forEach((tok, w) => {
    if (!tok.phs) {
      if (/[^\s]/.test(tok.raw)) seq.push(null);   // 標點才算停頓，空白不切斷同化
      return;
    }
    tok.phs.forEach((ph, k) => seq.push({ ph, word: w, tok, k }));
  });
  assimilate(seq);
  seq.forEach((slot) => { if (slot) slot.tok.phs[slot.k] = slot.ph; });

  return tokens
    .map((tok) => {
      if (tok.exception) return tok.exception;
      if (tok.phs) return renderWord(tok.phs);
      return tok.raw.replace(/\s+/g, ' ');
    })
    .join('')
    .trim();
}

export default czechPron;
