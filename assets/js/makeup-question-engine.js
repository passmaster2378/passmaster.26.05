/**
 * 메이크업 필기 JSON → 병합·분류·셔플·선택지 재배열
 * 문항 스키마: { id, category, concept, difficulty, question, options{1..4}, answer, explanation }
 */
(function () {
  const FILES = ["makeup1.json", "makeup2.json", "makeup3.json", "makeup4.json"];
  /** 누락 데이터 보정용(항상 4지선다 유지 · 정답 1개) */
  function padMissingOption(slotKey) {
    return `※ 보기 보완 필요 (선택지 ${slotKey}번)`;
  }
  const BASE = (() => {
    const scripts = document.getElementsByTagName("script");
    for (let i = scripts.length - 1; i >= 0; i -= 1) {
      const s = scripts[i].src;
      if (s && s.includes("/assets/js/makeup-question-engine.js")) {
        return s.replace(/\/assets\/js\/makeup-question-engine\.js.*$/, "");
      }
    }
    return "";
  })();

  function fisherYates(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function normalizeQuestion(raw, fileIndex, itemIndex) {
    const fileTag = `M${fileIndex + 1}`;
    const oid = raw.id != null ? String(raw.id) : String(itemIndex + 1);
    const uniqueId = `${fileTag}-${oid}`;
    const rawOpts = raw.options || {};
    const options = {};
    for (const k of ["1", "2", "3", "4"]) {
      const rawText = rawOpts[k];
      const trimmed = rawText != null ? String(rawText).trim() : "";
      options[k] = trimmed ? String(rawText) : padMissingOption(k);
    }
    let ans = String(raw.answer || "1").replace(/[^1-4]/, "").slice(0, 1) || "1";
    return {
      uniqueId,
      fileTag,
      sourceId: raw.id,
      category: String(raw.category || "기타").trim(),
      concept: String(raw.concept || ""),
      difficulty: String(raw.difficulty || "중"),
      question: String(raw.question || ""),
      options,
      answer: ans,
      explanation: String(raw.explanation || ""),
    };
  }

  async function loadMakeupBank() {
    const root = `${BASE}/assets/data/questions/makeup/`;
    const all = [];
    for (let fi = 0; fi < FILES.length; fi += 1) {
      const url = root + FILES[fi];
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) throw new Error(`문항 로드 실패: ${FILES[fi]}`);
      const chunk = await res.json();
      if (!Array.isArray(chunk)) throw new Error(`${FILES[fi]} 는 배열이 아닙니다.`);
      chunk.forEach((item, idx) => {
        all.push(normalizeQuestion(item, fi, idx));
      });
    }
    return all;
  }

  function groupByCategory(questions) {
    const map = new Map();
    for (const q of questions) {
      if (!map.has(q.category)) map.set(q.category, []);
      map.get(q.category).push(q);
    }
    return map;
  }

  /** 과목명 정렬 → 과목 내 id 정렬 (1차 학습 순서) */
  function buildSequentialByCategory(questions) {
    const map = groupByCategory(questions);
    const cats = [...map.keys()].sort((a, b) => a.localeCompare(b, "ko"));
    const out = [];
    for (const c of cats) {
      const list = [...map.get(c)].sort((a, b) =>
        String(a.uniqueId).localeCompare(String(b.uniqueId), "ko", { numeric: true })
      );
      out.push(...list);
    }
    return out;
  }

  /** 과목 순서·문항 순서 모두 셔플 (3차·예측 어렵게) */
  function buildShuffledCrossCategory(questions) {
    const map = groupByCategory(questions);
    const cats = fisherYates([...map.keys()]);
    const out = [];
    for (const c of cats) {
      const list = fisherYates([...map.get(c)]);
      out.push(...list);
    }
    return out;
  }

  /**
   * 표시용 선택지 재배열. 정답 텍스트는 동일, 번호 위치만 변경.
   * @returns {{ displayOptions: string[], correctIndex: number }}
   */
  function shuffleDisplayOptions(question) {
    const texts = ["1", "2", "3", "4"].map((k) => {
      const t = question.options[k];
      const trimmed = t != null ? String(t).trim() : "";
      return trimmed || padMissingOption(k);
    });
    const correctNum = String(question.answer).replace(/[^1-4]/, "") || "1";
    const correctText = (() => {
      const t = question.options[correctNum];
      const trimmed = t != null ? String(t).trim() : "";
      return trimmed || padMissingOption(correctNum);
    })();
    const shuffled = fisherYates([...texts]);
    let correctIndex = shuffled.indexOf(correctText);
    if (correctIndex < 0) correctIndex = Math.max(0, Number(correctNum) - 1);
    return { displayOptions: shuffled, correctIndex };
  }

  /** 60문제 무작위 추출 (기출 모의) */
  function sampleQuestions(questions, n) {
    if (questions.length <= n) return fisherYates([...questions]);
    return fisherYates([...questions]).slice(0, n);
  }

  window.MakeupQuestionEngine = {
    loadMakeupBank,
    groupByCategory,
    buildSequentialByCategory,
    buildShuffledCrossCategory,
    shuffleDisplayOptions,
    sampleQuestions,
    fisherYates,
    MOCK_COUNT: 60,
  };
})();
