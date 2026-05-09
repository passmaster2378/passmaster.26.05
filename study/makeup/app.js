/**
 * 메이크업 미용사 문제은행 — 학습 3회 / 오답복습 / 기출 6회 / 통계 / 최종
 */
(function () {
  const MOCK_TOTAL = 60;
  const MOCK_ROUNDS = 6;
  const CERT_SLUG = "makeup";
  const DEFAULT_REMOTE_API_BASE = "https://passmaster-26-05.onrender.com/api";
  const isLocalHost =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const isGitHubPages = /\.github\.io$/i.test(window.location.hostname);

  function normalizeApiBase(raw) {
    if (raw == null || typeof raw !== "string") return null;
    let value = raw.trim().replace(/\/+$/, "");
    if (!value) return null;
    if (!value.endsWith("/api")) value = `${value}/api`;
    return value;
  }

  const API_BASE =
    normalizeApiBase(window.PASSMASTER_API_BASE) ||
    (isLocalHost ? "http://localhost:4000/api" : isGitHubPages ? DEFAULT_REMOTE_API_BASE : "/api");
  /** 60문항 정답 수 → 100점 만점 환산 */
  function scorePercent100(correct) {
    return (correct / MOCK_TOTAL) * 100;
  }
  /** 필기 합격: 100점 만점 기준 60점 초과(60점은 불합격) → 37문제 이상 */
  function passesWrittenExam(correct) {
    return scorePercent100(correct) > 60;
  }
  const T_R2 = 40;
  const T_R3 = 30;
  const T_MOCK = 40;
  const T_REV = 30;

  /** @type {'loading'|'hub'|'quiz'|'mock'|'resultMock'|'dashboard'|'final'} */
  let screen = "loading";

  const E = {
    loading: document.getElementById("view-loading"),
    hub: document.getElementById("view-hub"),
    quiz: document.getElementById("view-quiz"),
    mock: document.getElementById("view-mock"),
    resultMock: document.getElementById("view-result-mock"),
    dashboard: document.getElementById("view-dashboard"),
    final: document.getElementById("view-final"),
    loadErr: document.getElementById("load-error"),
    hubActions: document.getElementById("hub-actions"),
    adminPanel: document.getElementById("admin-panel"),
    adminToggle: document.getElementById("admin-mode-toggle"),
    adminCurrent: document.getElementById("admin-current"),
    adminStep: document.getElementById("admin-step"),
    adminConfig: document.getElementById("admin-config"),
    adminShuffle: document.getElementById("admin-shuffle"),
    adminLastAction: document.getElementById("admin-last-action"),
    adminForceComplete: document.getElementById("btn-admin-force-complete"),
    adminStartR1: document.getElementById("btn-admin-start-r1"),
    adminStartR2: document.getElementById("btn-admin-start-r2"),
    adminStartR3: document.getElementById("btn-admin-start-r3"),
    adminStartMock: document.getElementById("btn-admin-start-mock"),
    adminMockRoundInput: document.getElementById("admin-mock-round"),
    qProgress: document.getElementById("q-progress"),
    qTimer: document.getElementById("q-timer"),
    qCategory: document.getElementById("q-cat"),
    qBody: document.getElementById("q-body"),
    qOpts: document.getElementById("q-options"),
    qExplain: document.getElementById("q-explain"),
    qExplainText: document.getElementById("q-explain-text"),
    qNavPrev: document.getElementById("q-nav-prev"),
    qNavNext: document.getElementById("q-next"),
    btnStop: document.getElementById("btn-stop"),
    btnPrevTop: document.getElementById("btn-prev-top"),
    qRoundLabel: document.getElementById("q-round-label"),
    mProgress: document.getElementById("m-progress"),
    mTimer: document.getElementById("m-timer"),
    mCategory: document.getElementById("m-cat"),
    mBody: document.getElementById("m-body"),
    mOpts: document.getElementById("m-options"),
    mRoundLabel: document.getElementById("m-round-label"),
    rMockScore: document.getElementById("r-mock-score"),
    rMockPass: document.getElementById("r-mock-pass"),
    rMockGraph: document.getElementById("r-mock-graph"),
    rMockNext: document.getElementById("r-mock-next"),
    dashCharts: document.getElementById("dash-charts"),
    qaChecklist: document.getElementById("qa-checklist"),
    btnQaSave: document.getElementById("btn-qa-save"),
    qaSaveMsg: document.getElementById("qa-save-msg"),
    btnDashReview: document.getElementById("btn-dash-review"),
    finalText: document.getElementById("final-text"),
    finalBar: document.getElementById("final-bar"),
    finalActions: document.getElementById("final-actions"),
  };

  /** @type {any[]} */
  let bank = [];

  let studyRound = 1;
  let studyQueue = [];
  let studyIndex = 0;
  /** @type {'idle'|'answered'} */
  let studyPhase = "idle";
  /** 1~3차 중 틀린 문항 */
  let studyWrong = new Set();

  let studyTimerId = null;
  let studyRemain = 0;

  let mockRound = 1;
  let mockQueue = [];
  let mockIndex = 0;
  let mockWrapped = [];
  let mockTimerId = null;
  let mockRemain = 0;
  /** 순차 진행 잠금: finishMock 후 +1 라운드만 허용 */
  let expectedMockRound = 1;
  let canEnterFinalReview = false;
  let mockStats = { correct: 0, wrong: 0, wrongIds: new Set(), byCatWrong: {} };
  let mockHistory = [];
  let qaChecklistState = {
    flowLockVerified: false,
    artifactSaved: false,
    reviewFlowVerified: false,
    mobileLayoutVerified: false,
  };
  let studyDisplayCache = new Map();
  let currentStudyView = null;
  const shuffleAudit = [];
  const seenShuffleAudit = new Set();
  let adminMode =
    new URLSearchParams(window.location.search).get("admin") === "1" ||
    window.localStorage.getItem("makeupAdminMode") === "1";

  function setScreen(next) {
    screen = next;
    if (E.loading) E.loading.hidden = screen !== "loading";
    if (E.hub) E.hub.hidden = screen !== "hub";
    if (E.quiz) E.quiz.hidden = screen !== "quiz";
    if (E.mock) E.mock.hidden = screen !== "mock";
    if (E.resultMock) E.resultMock.hidden = screen !== "resultMock";
    if (E.dashboard) E.dashboard.hidden = screen !== "dashboard";
    if (E.final) E.final.hidden = screen !== "final";
  }

  function getStoredSession() {
    try {
      const raw = window.localStorage.getItem("passmaster_auth");
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  async function requestApi(path, options = {}) {
    const session = getStoredSession();
    if (!session || !session.token) throw new Error("로그인이 필요합니다.");
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.token}`,
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "요청 처리 중 오류가 발생했습니다.");
    return data;
  }

  function loadLocalQaChecklist() {
    try {
      const raw = window.localStorage.getItem("makeupQaChecklist");
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        qaChecklistState = {
          ...qaChecklistState,
          ...parsed,
        };
      }
    } catch (_error) {
      // ignore
    }
  }

  async function hydrateStudyArtifactRemote() {
    loadLocalQaChecklist();
    try {
      const artifact = await requestApi(`/me/study-artifact/${CERT_SLUG}`);
      const payload = artifact && artifact.payload ? artifact.payload : {};
      if (Array.isArray(payload.wrongNotes)) {
        window.localStorage.setItem("makeupWrongNote", JSON.stringify(payload.wrongNotes));
      }
      if (payload.reviewSeed && typeof payload.reviewSeed === "object") {
        window.localStorage.setItem("makeupReviewSeed", JSON.stringify(payload.reviewSeed));
      }
      if (payload.qaChecklist && typeof payload.qaChecklist === "object") {
        qaChecklistState = { ...qaChecklistState, ...payload.qaChecklist };
        window.localStorage.setItem("makeupQaChecklist", JSON.stringify(qaChecklistState));
      }
    } catch (_error) {
      // 로그인 안 된 경우/통신 실패는 로컬 데이터로 계속 진행
    }
  }

  function clearStudyTimer() {
    if (studyTimerId) {
      clearInterval(studyTimerId);
      studyTimerId = null;
    }
  }

  function clearMockTimer() {
    if (mockTimerId) {
      clearInterval(mockTimerId);
      mockTimerId = null;
    }
  }

  function formatSec(s) {
    const m = Math.floor(Math.max(0, s) / 60);
    const r = Math.max(0, s) % 60;
    return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }

  function getRoundRuleText(round) {
    if (round === 1) return "무제한 / 전체문항 셔플 / 정답·해설 즉시 표시";
    if (round === 2) return "40초 / 전체문항 셔플 / 선지 고정";
    if (round === 3) return "30초 / 전체문항 셔플 / 선지 셔플";
    if (round === 4) return "30초 / 학습 오답 복습 / 선지 셔플";
    if (round === 5) return "30초 / 기출 오답 복습 / 선지 셔플";
    return "규칙 없음";
  }

  function pushShuffleAudit(entry) {
    const key = `${entry.mode}:${entry.round}:${entry.questionId}:${entry.order}`;
    if (seenShuffleAudit.has(key)) return;
    seenShuffleAudit.add(key);
    shuffleAudit.push(entry);
    if (shuffleAudit.length > 80) shuffleAudit.shift();
  }

  function updateAdminPanel(lastAction) {
    if (!E.adminPanel) return;
    if (E.adminToggle && E.adminToggle.checked !== adminMode) E.adminToggle.checked = adminMode;
    if (lastAction && E.adminLastAction) E.adminLastAction.textContent = lastAction;
    if (E.adminCurrent) E.adminCurrent.textContent = `화면: ${screen}`;
    if (E.adminStep) {
      if (screen === "quiz") E.adminStep.textContent = `학습 라운드 ${studyRound} · ${studyIndex + 1}/${studyQueue.length || 0}`;
      else if (screen === "mock") E.adminStep.textContent = `기출 ${mockRound}회 · ${mockIndex + 1}/${MOCK_TOTAL}`;
      else if (screen === "resultMock") E.adminStep.textContent = `기출 ${mockRound}회 종료`;
      else E.adminStep.textContent = "대기 상태";
    }
    if (E.adminConfig) {
      if (screen === "quiz") E.adminConfig.textContent = `현재 규칙: ${getRoundRuleText(studyRound)}`;
      else if (screen === "mock") E.adminConfig.textContent = "현재 규칙: 40초 / 문제 셔플 / 선지 셔플 / 자동 다음";
      else
        E.adminConfig.textContent = `기출 잠금 상태: 다음 허용 회차 ${Math.min(
          expectedMockRound,
          MOCK_ROUNDS
        )}회`;
    }
    if (E.adminShuffle) {
      const recent = shuffleAudit.slice(-3).reverse();
      E.adminShuffle.textContent =
        recent.length === 0
          ? "최근 셔플 로그 없음"
          : recent
              .map(
                (r) =>
                  `[${r.mode}${r.round}] ${r.questionId} · 정답 ${r.originalAnswer}→${r.shuffledAnswer} · 옵션셔플:${r.optionShuffle ? "ON" : "OFF"}`
              )
              .join("\n");
    }
    const buttons = [
      E.adminForceComplete,
      E.adminStartR1,
      E.adminStartR2,
      E.adminStartR3,
      E.adminStartMock,
      E.adminMockRoundInput,
    ];
    buttons.forEach((el) => {
      if (el) el.disabled = !adminMode;
    });
  }

  function ensureAdminMode() {
    if (adminMode) return true;
    alert("관리자 모드를 켜야 사용할 수 있습니다.");
    return false;
  }

  function currentStudyMeta() {
    if (studyRound === 1) return { label: "1차 · 무제한 · 정답/해설 동시 표시", time: null };
    if (studyRound === 2) return { label: "2차 · 문항당 40초", time: T_R2 };
    if (studyRound === 3) return { label: "3차 · 30초 · 문제/선지 셔플", time: T_R3 };
    if (studyRound === 4) return { label: "오답 복습 (3회 학습)", time: T_REV };
    if (studyRound === 5) return { label: "기출 오답 복습", time: T_REV };
    return { label: "", time: T_REV };
  }

  function renderStudyQuestion() {
    const q = studyQueue[studyIndex];
    if (!q) return;
    const meta = currentStudyMeta();
    if (E.qRoundLabel) E.qRoundLabel.textContent = meta.label;
    const cacheKey = `${studyRound}:${q.uniqueId}:${studyIndex}`;
    if (!studyDisplayCache.has(cacheKey)) {
      const originalOptions = ["1", "2", "3", "4"].map((k) => q.options[k]).filter(Boolean);
      const originalAnswer = String(q.answer).replace(/[^1-4]/, "") || "1";
      let displayOptions = [...originalOptions];
      let correctIndex = Math.max(0, Number(originalAnswer) - 1);
      const optionShuffle = studyRound >= 3;
      if (optionShuffle) {
        const shuffled = window.MakeupQuestionEngine.shuffleDisplayOptions(q);
        displayOptions = shuffled.displayOptions;
        correctIndex = shuffled.correctIndex;
      }
      studyDisplayCache.set(cacheKey, {
        displayOptions,
        correctIndex,
        originalAnswer,
        optionShuffle,
      });
      if (optionShuffle) {
        pushShuffleAudit({
          mode: "study",
          round: studyRound,
          questionId: q.uniqueId,
          order: studyIndex + 1,
          originalAnswer,
          shuffledAnswer: String(correctIndex + 1),
          optionShuffle: true,
        });
      } else if (studyRound === 2) {
        pushShuffleAudit({
          mode: "study",
          round: studyRound,
          questionId: q.uniqueId,
          order: studyIndex + 1,
          originalAnswer,
          shuffledAnswer: originalAnswer,
          optionShuffle: false,
        });
      }
    }
    currentStudyView = studyDisplayCache.get(cacheKey);

    E.qProgress.textContent = `${studyIndex + 1} / ${studyQueue.length}`;
    E.qCategory.textContent = q.category || "";
    E.qBody.textContent = q.question || "";

    studyPhase = "idle";
    E.qOpts.innerHTML = "";
    E.qExplain.hidden = true;
    E.qNavPrev.disabled = studyIndex === 0;
    E.qNavNext.textContent = "다음 문제";
    E.qNavNext.disabled = true;

    currentStudyView.displayOptions.forEach((text, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mq-opt";
      btn.dataset.idx = String(idx);
      btn.textContent = text;
      btn.addEventListener("click", () => onStudyPick(idx));
      E.qOpts.appendChild(btn);
    });

    clearStudyTimer();
    if (meta.time == null) {
      E.qTimer.textContent = "00:00";
      E.qTimer.classList.add("mq-timer--off");
    } else {
      E.qTimer.classList.remove("mq-timer--off");
      studyRemain = meta.time;
      E.qTimer.textContent = formatSec(studyRemain);
      studyTimerId = setInterval(() => {
        studyRemain -= 1;
        if (studyRemain <= 0) {
          clearStudyTimer();
          onStudyTimeout();
        } else {
          E.qTimer.textContent = formatSec(studyRemain);
        }
      }, 1000);
    }

    // 1회차는 선택 전부터 정답/해설을 즉시 보여주는 학습 모드
    if (studyRound === 1) {
      studyPhase = "answered";
      highlightStudyResult(-1);
      E.qExplain.hidden = false;
      E.qExplainText.textContent = `정답 학습: ${q.explanation || "해설이 없습니다."}`;
      E.qNavNext.disabled = false;
    }
    updateAdminPanel();
  }

  function highlightStudyResult(selectedIdx) {
    const opts = E.qOpts.querySelectorAll(".mq-opt");
    opts.forEach((btn, idx) => {
      btn.disabled = true;
      if (idx === currentStudyView.correctIndex) btn.classList.add("mq-opt--correct");
      else if (selectedIdx >= 0 && idx === selectedIdx) btn.classList.add("mq-opt--wrong");
    });
  }

  function onStudyTimeout() {
    if (studyPhase !== "idle") return;
    studyPhase = "answered";
    const q = studyQueue[studyIndex];
    studyWrong.add(q.uniqueId);
    highlightStudyResult(-1);
    E.qExplain.hidden = false;
    E.qExplainText.textContent = `시간 초과(오답 처리) — 학습: ${q.explanation || "해설이 없습니다."}`;
    E.qNavNext.disabled = false;
  }

  function onStudyPick(optIdx) {
    if (studyPhase !== "idle") return;
    studyPhase = "answered";
    clearStudyTimer();
    const q = studyQueue[studyIndex];
    const ok = optIdx === currentStudyView.correctIndex;
    if (!ok) studyWrong.add(q.uniqueId);
    highlightStudyResult(optIdx);
    E.qExplain.hidden = false;
    E.qExplainText.textContent = `학습: ${q.explanation || "해설이 없습니다."}`;
    E.qNavNext.disabled = false;
  }

  function advanceStudy(dir) {
    if (dir < 0) {
      if (studyIndex <= 0) return;
      studyIndex -= 1;
      renderStudyQuestion();
      return;
    }
    if (studyPhase === "idle") return;
    if (studyIndex >= studyQueue.length - 1) {
      endStudyRound();
      return;
    }
    studyIndex += 1;
    renderStudyQuestion();
  }

  function endStudyRound() {
    clearStudyTimer();
    if (studyRound === 1) {
      studyRound = 2;
      studyQueue = window.MakeupQuestionEngine.fisherYates([...bank]);
      studyIndex = 0;
      studyDisplayCache = new Map();
      alert("1차를 완료했습니다. 2차(문항당 40초)를 시작합니다.");
      updateAdminPanel("1차 종료 → 2차 자동 시작");
      renderStudyQuestion();
      return;
    }
    if (studyRound === 2) {
      studyRound = 3;
      studyQueue = window.MakeupQuestionEngine.fisherYates([...bank]);
      studyIndex = 0;
      studyDisplayCache = new Map();
      alert("2차를 완료했습니다. 3차(30초, 문제·선지 셔플)를 시작합니다.");
      updateAdminPanel("2차 종료 → 3차 자동 시작 (문제/선지 셔플 ON)");
      renderStudyQuestion();
      return;
    }
    if (studyRound === 3) {
      studyRound = 4;
      const wrongBank = bank.filter((q) => studyWrong.has(q.uniqueId));
      if (wrongBank.length === 0) {
        alert("오답이 없습니다. 기출 모의로 이동합니다.");
        startMockRound(1);
        return;
      }
      studyQueue = window.MakeupQuestionEngine.buildShuffledCrossCategory(wrongBank);
      studyIndex = 0;
      studyDisplayCache = new Map();
      alert(`학습 기간 중 오답 ${studyQueue.length}문항을 30초 제한으로 복습합니다.`);
      updateAdminPanel("3차 종료 → 학습 오답복습 시작");
      renderStudyQuestion();
      return;
    }
    if (studyRound === 4) {
      startMockRound(1);
      return;
    }
    if (studyRound === 5) {
      showFinal();
    }
  }

  function startMockRound(n) {
    if (n !== expectedMockRound) {
      alert(`회차는 순서대로만 진행할 수 있습니다. 현재 ${expectedMockRound}회차부터 시작 가능합니다.`);
      return;
    }
    clearStudyTimer();
    mockRound = n;
    mockQueue = window.MakeupQuestionEngine.sampleQuestions(bank, MOCK_TOTAL);
    mockIndex = 0;
    mockWrapped = mockQueue.map((q) => ({ ...window.MakeupQuestionEngine.shuffleDisplayOptions(q), base: q }));
    mockStats = { correct: 0, wrong: 0, wrongIds: new Set(), byCatWrong: {} };
    if (E.mRoundLabel) E.mRoundLabel.textContent = `기출 모의 ${n} / ${MOCK_ROUNDS}`;
    setScreen("mock");
    updateAdminPanel(`기출 ${n}회 시작`);
    renderMockQuestion();
  }

  function renderMockQuestion() {
    const w = mockWrapped[mockIndex];
    if (!w) return;
    const q = w.base;
    pushShuffleAudit({
      mode: "mock",
      round: mockRound,
      questionId: q.uniqueId,
      order: mockIndex + 1,
      originalAnswer: String(q.answer).replace(/[^1-4]/, "") || "1",
      shuffledAnswer: String(w.correctIndex + 1),
      optionShuffle: true,
    });
    E.mProgress.textContent = `${mockIndex + 1} / ${MOCK_TOTAL}`;
    E.mCategory.textContent = q.category || "";
    E.mBody.textContent = q.question || "";
    E.mOpts.innerHTML = "";
    w.displayOptions.forEach((text, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mq-opt mq-opt--plain";
      btn.textContent = text;
      btn.addEventListener("click", () => onMockPick(idx));
      E.mOpts.appendChild(btn);
    });
    clearMockTimer();
    mockRemain = T_MOCK;
    E.mTimer.textContent = formatSec(mockRemain);
    mockTimerId = setInterval(() => {
      mockRemain -= 1;
      if (mockRemain <= 0) {
        clearMockTimer();
        onMockTimeout();
      } else {
        E.mTimer.textContent = formatSec(mockRemain);
      }
    }, 1000);
    updateAdminPanel();
  }

  function onMockTimeout() {
    clearMockTimer();
    const w = mockWrapped[mockIndex];
    const q = w.base;
    mockStats.wrong += 1;
    mockStats.wrongIds.add(q.uniqueId);
    const c = q.category || "기타";
    mockStats.byCatWrong[c] = (mockStats.byCatWrong[c] || 0) + 1;
    mockIndex += 1;
    if (mockIndex >= MOCK_TOTAL) finishMock();
    else renderMockQuestion();
  }

  function onMockPick(idx) {
    clearMockTimer();
    const w = mockWrapped[mockIndex];
    const q = w.base;
    if (idx === w.correctIndex) mockStats.correct += 1;
    else {
      mockStats.wrong += 1;
      mockStats.wrongIds.add(q.uniqueId);
      const c = q.category || "기타";
      mockStats.byCatWrong[c] = (mockStats.byCatWrong[c] || 0) + 1;
    }
    mockIndex += 1;
    if (mockIndex >= MOCK_TOTAL) finishMock();
    else renderMockQuestion();
  }

  function finishMock() {
    clearMockTimer();
    const correct = mockStats.correct;
    const passed = passesWrittenExam(correct);
    const score100 = scorePercent100(correct);
    const scoreLabel = Number.isInteger(score100) ? String(score100) : score100.toFixed(1);
    mockHistory.push({
      round: mockRound,
      correct,
      wrong: mockStats.wrong,
      passed,
      wrongIds: new Set(mockStats.wrongIds),
      byCatWrong: { ...mockStats.byCatWrong },
    });
    E.rMockScore.textContent = `${correct} / ${MOCK_TOTAL}문항 · 환산 ${scoreLabel}점 / 100점`;
    E.rMockPass.textContent = passed
      ? "시험 합격 기준(100점 만점 중 60점 초과)을 충족했습니다."
      : `시험 합격 기준은 100점 만점 중 60점 초과입니다. (현재 환산 약 ${scoreLabel}점)`;
    if (E.rMockGraph) {
      E.rMockGraph.innerHTML = `
        <div class="mq-bar-row">
          <span class="mq-bar-label">${mockRound}회 결과</span>
          <div class="mq-bar-track mq-bar-track--pass">
            <div class="mq-bar-fill ${passed ? "mq-bar-fill--ok" : "mq-bar-fill--bad"}" style="width:${
              passed ? "100%" : "38%"
            }"></div>
          </div>
          <span class="mq-bar-num">${passed ? "합격" : "불합격"}</span>
        </div>
      `;
    }
    E.rMockNext.textContent =
      mockRound < MOCK_ROUNDS ? `${mockRound + 1}회 기출 모의 시작` : "결과 분석으로";
    if (mockRound < MOCK_ROUNDS) expectedMockRound = mockRound + 1;
    else {
      expectedMockRound = MOCK_ROUNDS + 1;
      canEnterFinalReview = true;
    }
    E.rMockNext.onclick = () => {
      if (mockRound < MOCK_ROUNDS) startMockRound(mockRound + 1);
      else showDashboard();
    };
    setScreen("resultMock");
    updateAdminPanel(`기출 ${mockRound}회 종료`);
    if (mockRound < MOCK_ROUNDS) {
      window.setTimeout(() => {
        if (screen === "resultMock" && typeof E.rMockNext.onclick === "function") E.rMockNext.onclick();
      }, 1800);
    }
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  async function persistStudentArtifacts() {
    try {
      const wrongIds = new Set(studyWrong);
      mockHistory.forEach((h) => {
        h.wrongIds.forEach((id) => wrongIds.add(id));
      });
      const wrongQuestions = bank
        .filter((q) => wrongIds.has(q.uniqueId))
        .map((q) => ({
          id: q.uniqueId,
          category: q.category || "기타",
          question: q.question || "",
          answer: q.answer || "",
          explanation: q.explanation || "",
        }));
      const passedRounds = mockHistory.filter((h) => h.passed).length;
      const avgScore100 = mockHistory.length
        ? Math.round(
            mockHistory.reduce((sum, h) => sum + scorePercent100(h.correct), 0) / Math.max(1, mockHistory.length)
          )
        : 0;
      window.localStorage.setItem("makeupWrongNote", JSON.stringify(wrongQuestions));
      window.localStorage.setItem(
        "makeupReviewSeed",
        JSON.stringify({
          totalRounds: MOCK_ROUNDS,
          completedRounds: mockHistory.length,
          passedRounds,
          avgScore100,
          updatedAt: new Date().toISOString(),
        })
      );
      window.localStorage.setItem("makeupQaChecklist", JSON.stringify(qaChecklistState));
      try {
        await requestApi(`/me/study-artifact/${CERT_SLUG}`, {
          method: "PUT",
          body: JSON.stringify({
            payload: {
              wrongNotes: wrongQuestions,
              reviewSeed: {
                totalRounds: MOCK_ROUNDS,
                completedRounds: mockHistory.length,
                passedRounds,
                avgScore100,
                updatedAt: new Date().toISOString(),
              },
              qaChecklist: qaChecklistState,
            },
          }),
        });
      } catch (_error) {
        // 서버 저장 실패 시 로컬 저장본 유지
      }
    } catch (_error) {
      // localStorage 저장 실패 시 학습 흐름은 유지
    }
  }

  function renderQaChecklist() {
    if (!E.qaChecklist) return;
    const items = [
      ["flowLockVerified", "회차 잠금/순차 진행 동작 확인"],
      ["artifactSaved", "오답노트/통계 저장 정상 확인"],
      ["reviewFlowVerified", "후기 작성/삭제/상태 표시 확인"],
      ["mobileLayoutVerified", "모바일(<=720px) 레이아웃 확인"],
    ];
    E.qaChecklist.innerHTML = items
      .map(
        ([key, label]) => `
          <label class="qa-item">
            <input type="checkbox" data-qa-key="${key}" ${qaChecklistState[key] ? "checked" : ""} />
            <span>${label}</span>
          </label>
        `
      )
      .join("");
    E.qaChecklist.querySelectorAll("[data-qa-key]").forEach((input) => {
      input.addEventListener("change", () => {
        const key = input.getAttribute("data-qa-key");
        qaChecklistState[key] = Boolean(input.checked);
        window.localStorage.setItem("makeupQaChecklist", JSON.stringify(qaChecklistState));
      });
    });
  }

  function loopChip(label, state) {
    const stateClass = state === "done" ? "loop-chip--done" : state === "active" ? "loop-chip--active" : "loop-chip--lock";
    return `<div class="loop-chip ${stateClass}">${label}</div>`;
  }

  function buildLoopBoard() {
    const doneStudy1 = studyRound >= 2 || mockHistory.length > 0;
    const doneStudy2 = studyRound >= 3 || mockHistory.length > 0;
    const doneStudy3 = studyRound >= 4 || mockHistory.length > 0;
    const doneWrongReview = studyRound >= 5 || mockHistory.length > 0;
    const roundDone = (n) => mockHistory.length >= n;
    return `
      <section class="loop-board" aria-label="수강생 10단계 학습 루프">
        <p class="loop-head">수강생 10단계 학습 루프 (고정 운영안)</p>
        <div class="loop-grid">
          ${loopChip("1단계 워밍업 · 정답보기+해설", doneStudy1 ? "done" : "active")}
          ${loopChip("2단계 속도훈련 · 4지선지 기반", doneStudy2 ? "done" : doneStudy1 ? "active" : "lock")}
          ${loopChip("3단계 실전훈련 · 타이머 운용", doneStudy3 ? "done" : doneStudy2 ? "active" : "lock")}
          ${loopChip("4단계 AI 분석 · 오답노트", doneWrongReview ? "done" : doneStudy3 ? "active" : "lock")}
          ${loopChip("5단계 과목별 실제시험 영역", roundDone(1) ? "done" : doneWrongReview ? "active" : "lock")}
          ${loopChip("6단계 오답 리빌딩 · 구간별", roundDone(2) ? "done" : roundDone(1) ? "active" : "lock")}
          ${loopChip("7단계 스피드 루프 · 10분", roundDone(3) ? "done" : roundDone(2) ? "active" : "lock")}
          ${loopChip("8단계 모의고사 · 기출 실전", roundDone(4) ? "done" : roundDone(3) ? "active" : "lock")}
          ${loopChip("9단계 AI 진단 분석 리포트", roundDone(5) ? "done" : roundDone(4) ? "active" : "lock")}
          ${loopChip(
            "10단계 최종점검 · D-day 모드",
            roundDone(6) || screen === "final" ? "done" : roundDone(5) ? "active" : "lock"
          )}
        </div>
      </section>
    `;
  }

  function showDashboard() {
    const byCat = {};
    mockHistory.forEach((h) => {
      Object.entries(h.byCatWrong || {}).forEach(([cat, n]) => {
        byCat[cat] = (byCat[cat] || 0) + n;
      });
    });
    const cats = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
    const maxW = Math.max(1, ...Object.values(byCat), 1);
    E.dashCharts.innerHTML = `
      <div class="dash-block">
        <h3>기출 ${MOCK_ROUNDS}회 누적 · 과목별 오답 수</h3>
        <div class="mq-bars">
          ${cats
            .map(
              (c) => `
            <div class="mq-bar-row">
              <span class="mq-bar-label">${escapeHtml(c)}</span>
              <div class="mq-bar-track"><div class="mq-bar-fill" style="width:${(byCat[c] / maxW) * 100}%"></div></div>
              <span class="mq-bar-num">${byCat[c]}</span>
            </div>`
            )
            .join("")}
        </div>
        ${cats.length === 0 ? "<p class=\"dash-empty\">누적 오답이 없습니다.</p>" : ""}
      </div>
      <div class="dash-block">
        <h3>회차별 합격 여부 (총 ${MOCK_ROUNDS}회 · 100점 만점 · 60점 초과)</h3>
        <div class="mq-bars">
          ${mockHistory
            .map(
              (h, i) => `
            <div class="mq-bar-row">
              <span class="mq-bar-label">${i + 1}회</span>
              <div class="mq-bar-track mq-bar-track--pass">
                <div class="mq-bar-fill ${h.passed ? "mq-bar-fill--ok" : "mq-bar-fill--bad"}" style="width:${
                  h.passed ? "100%" : "40%"
                }"></div>
              </div>
              <span class="mq-bar-num">${h.passed ? "합격" : "불합격"} · ${Math.round(
                scorePercent100(h.correct)
              )}/100 (${h.correct}/${MOCK_TOTAL})</span>
            </div>`
            )
            .join("")}
        </div>
      </div>
    `;
    renderQaChecklist();
    if (E.btnQaSave) {
      E.btnQaSave.onclick = async () => {
        if (E.qaSaveMsg) E.qaSaveMsg.textContent = "저장 중...";
        await persistStudentArtifacts();
        if (E.qaSaveMsg) E.qaSaveMsg.textContent = "QA 체크리스트가 저장되었습니다.";
      };
    }
    E.btnDashReview.onclick = () => startReviewWrongFromMocks();
    setScreen("dashboard");
    updateAdminPanel(`${MOCK_ROUNDS}회 기출 종료 → 분석 대시보드`);
  }

  function startReviewWrongFromMocks() {
    if (!canEnterFinalReview || mockHistory.length !== MOCK_ROUNDS) {
      alert(`기출 ${MOCK_ROUNDS}회가 모두 끝난 뒤에만 최종 오답 복습으로 이동할 수 있습니다.`);
      return;
    }
    const ids = new Set();
    mockHistory.forEach((h) => {
      h.wrongIds.forEach((id) => ids.add(id));
    });
    const list = bank.filter((q) => ids.has(q.uniqueId));
    if (list.length === 0) {
      alert("복습할 기출 오답이 없습니다.");
      showFinal();
      return;
    }
    studyRound = 5;
    studyQueue = window.MakeupQuestionEngine.buildShuffledCrossCategory(list);
    studyIndex = 0;
    studyDisplayCache = new Map();
    setScreen("quiz");
    updateAdminPanel("최종 오답 복습 시작");
    renderStudyQuestion();
  }

  function showFinal() {
    clearStudyTimer();
    persistStudentArtifacts();
    const passedRounds = mockHistory.filter((h) => h.passed).length;
    const rate = mockHistory.length ? Math.round((passedRounds / mockHistory.length) * 100) : 0;
    const avgScore100 = mockHistory.length
      ? Math.round(
          mockHistory.reduce((sum, h) => sum + scorePercent100(h.correct), 0) / mockHistory.length
        )
      : 0;
    let msg = "";
    if (passedRounds >= 4) {
      msg =
        "기출에서 합격 기준을 대체로 충족하고 있습니다. Q-Net에서 시험 일정을 확인한 뒤 필기 응시를 준비해 보세요.";
    } else if (passedRounds >= 2) {
      msg = "일부 회차만 합격 기준에 도달했습니다. 과목별 오답을 다시 정리한 뒤 모의를 반복하는 편이 안전합니다.";
    } else {
      msg = "합격 기준 도달 회차가 적습니다. 1~3차 학습과 오답 복습을 보강한 후 기출 모의를 다시 권합니다.";
    }
    E.finalText.innerHTML = `<p>${MOCK_ROUNDS}회 기출 중 <strong>${passedRounds}회</strong>가 시험 합격 기준(100점 만점 중 60점 초과)을 충족했고, 회차별 환산 점수 평균은 약 <strong>${avgScore100}점</strong>/100점입니다.</p><p>${msg}</p>
      <p class="final-qnet">일정·응시 자격·접수는 <a href="https://www.q-net.or.kr/" target="_blank" rel="noopener">Q-Net (한국산업인력공단)</a> 에서 확인하세요.</p>`;
    E.finalBar.innerHTML = `
      <div class="mq-bar-row">
        <span class="mq-bar-label">기출 합격(기준 충족) 비율</span>
        <div class="mq-bar-track"><div class="mq-bar-fill mq-bar-fill--ok" style="width:${rate}%"></div></div>
        <span class="mq-bar-num">${rate}%</span>
      </div>`;
    if (E.finalActions) {
      E.finalActions.innerHTML = `
        <a class="mq-bigbtn mq-bigbtn-link" href="./wrong-note.html">오답노트 보기</a>
        <a class="mq-bigbtn mq-bigbtn-link" href="./review-share.html">후기작성/리뷰 공유</a>
      `;
    }
    setScreen("final");
    updateAdminPanel("최종 결과 표시");
  }

  function renderHub() {
    if (!E.hubActions) {
      throw new Error("허브 UI 요소를 찾지 못했습니다. 페이지를 새로고침해 주세요.");
    }
    if (E.loadErr) E.loadErr.hidden = true;
    E.hubActions.innerHTML = `
      <div class="flow-wrap" aria-label="문제 풀이 진행 그래프">
        <section class="flow-hero">
          <h2 class="flow-hero-title">학습 진행 로드맵</h2>
          <p class="flow-hero-sub">시작 버튼을 누르면 1단계부터 순서대로 잠금 해제됩니다.</p>
          <div class="flow-track" aria-hidden="true">
            <div class="flow-node">
              <span class="flow-node-dot flow-node-dot--1"></span>
              <span>기본 3회</span>
            </div>
            <div class="flow-node">
              <span class="flow-node-dot flow-node-dot--2"></span>
              <span>학습 오답</span>
            </div>
            <div class="flow-node">
              <span class="flow-node-dot flow-node-dot--3"></span>
              <span>기출 6회</span>
            </div>
            <div class="flow-node">
              <span class="flow-node-dot flow-node-dot--4"></span>
              <span>최종 복습</span>
            </div>
          </div>
        </section>
        ${buildLoopBoard()}
        <section class="flow-stage flow-stage--1">
          <div class="flow-stage-top">
            <p class="flow-head">STAGE 1. 과목별 순차 문제풀이</p>
            <span class="flow-badge flow-badge--1">ACTIVE</span>
          </div>
          <div class="flow-media" aria-hidden="true">
            <svg viewBox="0 0 420 44" fill="none">
              <rect x="0" y="8" width="120" height="28" rx="8" fill="#d9ebff" />
              <rect x="150" y="8" width="120" height="28" rx="8" fill="#e9f4ff" />
              <rect x="300" y="8" width="120" height="28" rx="8" fill="#e9f4ff" />
              <path d="M126 22h18M276 22h18" stroke="#84a9d8" stroke-width="3" stroke-linecap="round" />
              <circle cx="22" cy="22" r="6" fill="#1a84dd" />
            </svg>
          </div>
          <div class="flow-grid">
            <div class="flow-chip flow-chip--active">1회차 학습</div>
            <div class="flow-chip flow-chip--lock">🔒 2회차 학습</div>
            <div class="flow-chip flow-chip--lock">🔒 3회차 학습</div>
          </div>
          <button type="button" class="flow-action" id="btn-start-study">1회차 시작</button>
        </section>
        <div class="flow-arrow" aria-hidden="true">↓</div>
        <section class="flow-stage flow-stage--2">
          <div class="flow-stage-top">
            <p class="flow-head">STAGE 2. 오답 문제풀이</p>
            <span class="flow-badge flow-badge--2">LOCKED</span>
          </div>
          <div class="flow-media" aria-hidden="true">
            <svg viewBox="0 0 420 44" fill="none">
              <rect x="0" y="6" width="420" height="32" rx="10" fill="#e9faf6" />
              <path d="M72 22h272" stroke="#8fd8ca" stroke-width="3" stroke-dasharray="7 6" />
              <circle cx="210" cy="22" r="8" fill="#26a69a" />
            </svg>
          </div>
          <div class="flow-grid flow-grid--two">
            <div class="flow-chip flow-chip--lock">🔒 오답 재점검</div>
            <div class="flow-chip flow-chip--lock">🔒 오답 문제풀이</div>
          </div>
          <button type="button" class="flow-action" disabled>잠금 해제 후 진행</button>
        </section>
        <div class="flow-arrow" aria-hidden="true">↓</div>
        <section class="flow-stage flow-stage--3">
          <div class="flow-stage-top">
            <p class="flow-head">STAGE 3. 실전 기출문제 (6회)</p>
            <span class="flow-badge flow-badge--3">LOCKED</span>
          </div>
          <div class="flow-media" aria-hidden="true">
            <svg viewBox="0 0 420 44" fill="none">
              <rect x="0" y="8" width="76" height="28" rx="8" fill="#fff5da" />
              <rect x="86" y="8" width="76" height="28" rx="8" fill="#fff5da" />
              <rect x="172" y="8" width="76" height="28" rx="8" fill="#fff5da" />
              <rect x="258" y="8" width="76" height="28" rx="8" fill="#fff5da" />
              <rect x="344" y="8" width="76" height="28" rx="8" fill="#fff5da" />
              <path d="M38 22h10M124 22h10M210 22h10M296 22h10" stroke="#efc15a" stroke-width="3" />
            </svg>
          </div>
          <div class="flow-grid">
            <div class="flow-chip flow-chip--lock">🔒 1회</div>
            <div class="flow-chip flow-chip--lock">🔒 2회</div>
            <div class="flow-chip flow-chip--lock">🔒 3회</div>
            <div class="flow-chip flow-chip--lock">🔒 4회</div>
            <div class="flow-chip flow-chip--lock">🔒 5회</div>
            <div class="flow-chip flow-chip--lock">🔒 6회</div>
          </div>
          <button type="button" class="flow-action" disabled>기출 모드는 단계 완료 후 열립니다</button>
        </section>
        <div class="flow-arrow" aria-hidden="true">↓</div>
        <section class="flow-stage flow-stage--4">
          <div class="flow-stage-top">
            <p class="flow-head">STAGE 4. 최종 오답 문제풀이</p>
            <span class="flow-badge flow-badge--4">LOCKED</span>
          </div>
          <div class="flow-media" aria-hidden="true">
            <svg viewBox="0 0 420 44" fill="none">
              <rect x="0" y="6" width="420" height="32" rx="10" fill="#f2f4f6" />
              <path d="M88 24l44-10 44 16 56-12 50 10 46-6" stroke="#7b8794" stroke-width="3" />
            </svg>
          </div>
          <div class="flow-grid flow-grid--two">
            <div class="flow-chip flow-chip--lock">🔒 오답 복습</div>
            <div class="flow-chip flow-chip--lock">🔒 최종 오답 문제풀이</div>
          </div>
          <div class="flow-mini-actions">
            <button type="button" class="flow-subbtn" id="btn-open-wrong-note" disabled>오답노트</button>
            <button type="button" class="flow-subbtn" id="btn-open-review-share" disabled>후기작성/공유</button>
          </div>
          <button type="button" class="flow-action" disabled>최종 단계 잠금</button>
        </section>
      </div>
    `;
    const hasWrongNotes = (() => {
      try {
        const rows = JSON.parse(window.localStorage.getItem("makeupWrongNote") || "[]");
        return Array.isArray(rows) && rows.length > 0;
      } catch (_error) {
        return false;
      }
    })();
    const hasReviewSeed = (() => {
      try {
        const seed = JSON.parse(window.localStorage.getItem("makeupReviewSeed") || "{}");
        return Number(seed.completedRounds || 0) > 0;
      } catch (_error) {
        return false;
      }
    })();
    const wrongBtn = document.getElementById("btn-open-wrong-note");
    const reviewBtn = document.getElementById("btn-open-review-share");
    if (wrongBtn) {
      wrongBtn.disabled = !(canEnterFinalReview || hasWrongNotes);
      wrongBtn.addEventListener("click", () => {
        if (wrongBtn.disabled) return;
        window.location.href = "./wrong-note.html";
      });
    }
    if (reviewBtn) {
      reviewBtn.disabled = !(canEnterFinalReview || hasReviewSeed);
      reviewBtn.addEventListener("click", () => {
        if (reviewBtn.disabled) return;
        window.location.href = "./review-share.html";
      });
    }
    document.getElementById("btn-start-study").addEventListener("click", () => {
      studyWrong = new Set();
      mockHistory = [];
      expectedMockRound = 1;
      canEnterFinalReview = false;
      studyRound = 1;
      studyQueue = window.MakeupQuestionEngine.fisherYates([...bank]);
      studyIndex = 0;
      studyDisplayCache = new Map();
      setScreen("quiz");
      updateAdminPanel("학습 시작: 1차 진입");
      renderStudyQuestion();
    });
    updateAdminPanel("허브 렌더 완료");
  }

  function goHub() {
    if (!window.confirm("중단하면 이 세션 진행이 초기화됩니다. 처음 화면으로 돌아갈까요?")) return;
    clearStudyTimer();
    clearMockTimer();
    studyRound = 0;
    setScreen("hub");
    renderHub();
    updateAdminPanel("세션 중단 후 허브 복귀");
  }

  function adminStartStudyRound(targetRound) {
    if (!ensureAdminMode()) return;
    clearStudyTimer();
    clearMockTimer();
    if (targetRound === 1) {
      studyWrong = new Set();
      mockHistory = [];
      expectedMockRound = 1;
      canEnterFinalReview = false;
      studyRound = 1;
      studyQueue = window.MakeupQuestionEngine.fisherYates([...bank]);
    } else if (targetRound === 2) {
      studyRound = 2;
      studyQueue = window.MakeupQuestionEngine.fisherYates([...bank]);
    } else {
      studyRound = 3;
      studyQueue = window.MakeupQuestionEngine.fisherYates([...bank]);
    }
    studyIndex = 0;
    studyPhase = "idle";
    studyDisplayCache = new Map();
    setScreen("quiz");
    updateAdminPanel(`관리자 강제 시작: ${targetRound}차`);
    renderStudyQuestion();
  }

  function adminForceCompleteCurrent() {
    if (!ensureAdminMode()) return;
    if (screen === "quiz") {
      endStudyRound();
      updateAdminPanel("관리자 강제 완료: 학습 회차 종료 처리");
      return;
    }
    if (screen === "mock") {
      const remain = MOCK_TOTAL - mockIndex;
      if (remain > 0) mockStats.wrong += remain;
      finishMock();
      updateAdminPanel(`관리자 강제 완료: 기출 ${mockRound}회 종료 처리`);
      return;
    }
    if (screen === "resultMock" && typeof E.rMockNext.onclick === "function") {
      E.rMockNext.onclick();
      updateAdminPanel("관리자 강제 이동: 다음 단계");
      return;
    }
    if (screen === "dashboard") {
      startReviewWrongFromMocks();
      updateAdminPanel("관리자 강제 이동: 최종 오답 복습");
      return;
    }
    alert("현재 화면에서는 강제 완료할 회차가 없습니다.");
  }

  function adminStartMockRound() {
    if (!ensureAdminMode()) return;
    const requested = Number(E.adminMockRoundInput?.value || 1);
    const target = Math.min(MOCK_ROUNDS, Math.max(1, Math.floor(requested)));
    expectedMockRound = target;
    canEnterFinalReview = false;
    startMockRound(target);
  }

  E.btnStop.addEventListener("click", goHub);
  E.btnPrevTop.addEventListener("click", () => advanceStudy(-1));
  E.qNavPrev.addEventListener("click", () => advanceStudy(-1));
  E.qNavNext.addEventListener("click", () => advanceStudy(1));
  if (E.adminToggle) {
    E.adminToggle.checked = adminMode;
    E.adminToggle.addEventListener("change", () => {
      adminMode = E.adminToggle.checked;
      window.localStorage.setItem("makeupAdminMode", adminMode ? "1" : "0");
      updateAdminPanel(adminMode ? "관리자 모드 ON" : "관리자 모드 OFF");
    });
  }
  if (E.adminStartR1) E.adminStartR1.addEventListener("click", () => adminStartStudyRound(1));
  if (E.adminStartR2) E.adminStartR2.addEventListener("click", () => adminStartStudyRound(2));
  if (E.adminStartR3) E.adminStartR3.addEventListener("click", () => adminStartStudyRound(3));
  if (E.adminStartMock) E.adminStartMock.addEventListener("click", adminStartMockRound);
  if (E.adminForceComplete) E.adminForceComplete.addEventListener("click", adminForceCompleteCurrent);

  function init() {
    setScreen("loading");
    if (E.loadErr) E.loadErr.hidden = true;
    window.MakeupQuestionEngine.loadMakeupBank()
      .then(async (data) => {
        bank = data;
        await hydrateStudyArtifactRemote();
        setScreen("hub");
        renderHub();
        updateAdminPanel("문항 로드 성공");
      })
      .catch((err) => {
        console.error(err);
        setScreen("hub");
        if (E.loadErr) {
          E.loadErr.hidden = false;
          E.loadErr.textContent = `문항을 불러오지 못했습니다: ${err.message || err}`;
        } else {
          alert(`문항을 불러오지 못했습니다: ${err.message || err}`);
        }
        if (E.hubActions) {
          E.hubActions.innerHTML =
            '<p class="hub-hint">로컬 서버(예: <code>npx serve</code>)로 열면 JSON을 불러올 수 있습니다.</p>';
        }
        updateAdminPanel("문항 로드 실패");
      });
  }

  init();
})();
