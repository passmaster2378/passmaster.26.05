/**
 * 메이크업 미용사 문제은행 — 학습 3회 / 오답복습 / 기출 5회 / 통계 / 최종
 */
(function () {
  const MOCK_TOTAL = 60;
  /** 60문항 정답 수 → 100점 만점 환산 */
  function scorePercent100(correct) {
    return (correct / MOCK_TOTAL) * 100;
  }
  /** 필기 합격: 100점 만점 기준 60점 초과(60점은 불합격) → 37문제 이상 */
  function passesWrittenExam(correct) {
    return scorePercent100(correct) > 60;
  }
  const T_R2 = 60;
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
    rMockNext: document.getElementById("r-mock-next"),
    dashCharts: document.getElementById("dash-charts"),
    btnDashReview: document.getElementById("btn-dash-review"),
    finalText: document.getElementById("final-text"),
    finalBar: document.getElementById("final-bar"),
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

  function setScreen(next) {
    screen = next;
    E.loading.hidden = screen !== "loading";
    E.hub.hidden = screen !== "hub";
    E.quiz.hidden = screen !== "quiz";
    E.mock.hidden = screen !== "mock";
    E.resultMock.hidden = screen !== "resultMock";
    E.dashboard.hidden = screen !== "dashboard";
    E.final.hidden = screen !== "final";
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

  function currentStudyMeta() {
    if (studyRound === 1) return { label: "1차 · 기본 학습 (무제한)", time: null };
    if (studyRound === 2) return { label: "2차 · 문항당 1분", time: T_R2 };
    if (studyRound === 3) return { label: "3차 · 30초 · 과목 셔플", time: T_R3 };
    if (studyRound === 4) return { label: "오답 복습 (3회 학습)", time: T_REV };
    if (studyRound === 5) return { label: "기출 오답 복습", time: T_REV };
    return { label: "", time: T_REV };
  }

  function renderStudyQuestion() {
    const q = studyQueue[studyIndex];
    if (!q) return;
    const meta = currentStudyMeta();
    if (E.qRoundLabel) E.qRoundLabel.textContent = meta.label;

    E.qProgress.textContent = `${studyIndex + 1} / ${studyQueue.length}`;
    E.qCategory.textContent = q.category || "";
    E.qBody.textContent = q.question || "";

    studyPhase = "idle";
    E.qOpts.innerHTML = "";
    E.qExplain.hidden = true;
    E.qNavPrev.disabled = studyIndex === 0;
    E.qNavNext.textContent = "다음 문제";
    E.qNavNext.disabled = true;

    ["1", "2", "3", "4"].forEach((num) => {
      const text = q.options[num];
      if (text == null) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "mq-opt";
      btn.dataset.num = num;
      btn.textContent = text;
      btn.addEventListener("click", () => onStudyPick(num));
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
  }

  function highlightStudyResult(selectedNum) {
    const q = studyQueue[studyIndex];
    const correctNum = String(q.answer).replace(/[^1-4]/, "") || "1";
    const opts = E.qOpts.querySelectorAll(".mq-opt");
    opts.forEach((btn) => {
      const n = btn.dataset.num;
      btn.disabled = true;
      if (n === correctNum) btn.classList.add("mq-opt--correct");
      else if (selectedNum && n === selectedNum) btn.classList.add("mq-opt--wrong");
    });
  }

  function onStudyTimeout() {
    if (studyPhase !== "idle") return;
    studyPhase = "answered";
    const q = studyQueue[studyIndex];
    studyWrong.add(q.uniqueId);
    highlightStudyResult("");
    E.qExplain.hidden = false;
    E.qExplainText.textContent = `시간 초과(오답 처리) — 학습: ${q.explanation || "해설이 없습니다."}`;
    E.qNavNext.disabled = false;
  }

  function onStudyPick(optNum) {
    if (studyPhase !== "idle") return;
    studyPhase = "answered";
    clearStudyTimer();
    const q = studyQueue[studyIndex];
    const correctNum = String(q.answer).replace(/[^1-4]/, "") || "1";
    const ok = optNum === correctNum;
    if (!ok) studyWrong.add(q.uniqueId);
    highlightStudyResult(optNum);
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
      studyQueue = window.MakeupQuestionEngine.buildSequentialByCategory(bank);
      studyIndex = 0;
      alert("1차를 완료했습니다. 2차(문항당 1분)를 시작합니다.");
      renderStudyQuestion();
      return;
    }
    if (studyRound === 2) {
      studyRound = 3;
      studyQueue = window.MakeupQuestionEngine.buildShuffledCrossCategory(bank);
      studyIndex = 0;
      alert("2차를 완료했습니다. 3차(30초, 과목·순서 셔플)를 시작합니다.");
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
      alert(`학습 기간 중 오답 ${studyQueue.length}문항을 30초 제한으로 복습합니다.`);
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
    if (E.mRoundLabel) E.mRoundLabel.textContent = `기출 모의 ${n} / 5`;
    setScreen("mock");
    renderMockQuestion();
  }

  function renderMockQuestion() {
    const w = mockWrapped[mockIndex];
    if (!w) return;
    const q = w.base;
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
    E.rMockNext.textContent = mockRound < 5 ? `${mockRound + 1}회 기출 모의 시작` : "결과 분석으로";
    if (mockRound < 5) expectedMockRound = mockRound + 1;
    else {
      expectedMockRound = 6;
      canEnterFinalReview = true;
    }
    E.rMockNext.onclick = () => {
      if (mockRound < 5) startMockRound(mockRound + 1);
      else showDashboard();
    };
    setScreen("resultMock");
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
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
        <h3>기출 5회 누적 · 과목별 오답 수</h3>
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
        <h3>회차별 합격 여부 (100점 만점 · 60점 초과)</h3>
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
    E.btnDashReview.onclick = () => startReviewWrongFromMocks();
    setScreen("dashboard");
  }

  function startReviewWrongFromMocks() {
    if (!canEnterFinalReview || mockHistory.length !== 5) {
      alert("기출 5회가 모두 끝난 뒤에만 최종 오답 복습으로 이동할 수 있습니다.");
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
    setScreen("quiz");
    renderStudyQuestion();
  }

  function showFinal() {
    clearStudyTimer();
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
    E.finalText.innerHTML = `<p>5회 기출 중 <strong>${passedRounds}회</strong>가 시험 합격 기준(100점 만점 중 60점 초과)을 충족했고, 회차별 환산 점수 평균은 약 <strong>${avgScore100}점</strong>/100점입니다.</p><p>${msg}</p>
      <p class="final-qnet">일정·응시 자격·접수는 <a href="https://www.q-net.or.kr/" target="_blank" rel="noopener">Q-Net (한국산업인력공단)</a> 에서 확인하세요.</p>`;
    E.finalBar.innerHTML = `
      <div class="mq-bar-row">
        <span class="mq-bar-label">기출 합격(기준 충족) 비율</span>
        <div class="mq-bar-track"><div class="mq-bar-fill mq-bar-fill--ok" style="width:${rate}%"></div></div>
        <span class="mq-bar-num">${rate}%</span>
      </div>`;
    setScreen("final");
  }

  function renderHub() {
    E.loadErr.hidden = true;
    E.hubActions.innerHTML = `
      <div class="flow-wrap" aria-label="문제 풀이 진행 그래프">
        <section class="flow-stage flow-stage--1">
          <p class="flow-head">STAGE 1. 과목별 순차 학습 루틴</p>
          <div class="flow-grid">
            <div class="flow-chip flow-chip--active">1회차<br/>무제한 학습</div>
            <div class="flow-chip flow-chip--lock">🔒 2회차<br/>1분 타이머</div>
            <div class="flow-chip flow-chip--lock">🔒 3회차<br/>30초 + 셔플</div>
          </div>
        </section>
        <div class="flow-arrow" aria-hidden="true">↓</div>
        <section class="flow-stage flow-stage--2">
          <p class="flow-head">STAGE 2. 오답 소탕</p>
          <div class="flow-grid flow-grid--two">
            <div class="flow-chip flow-chip--lock">🔒 학습 오답 복습<br/>30초 타이머</div>
            <div class="flow-chip flow-chip--lock">🔒 약점 과목 재점검</div>
          </div>
        </section>
        <div class="flow-arrow" aria-hidden="true">↓</div>
        <section class="flow-stage flow-stage--3">
          <p class="flow-head">STAGE 3. 실전 기출 (5회)</p>
          <div class="flow-grid">
            <div class="flow-chip flow-chip--lock">🔒 1회<br/>40초·자동 다음</div>
            <div class="flow-chip flow-chip--lock">🔒 2회<br/>정답 위치 셔플</div>
            <div class="flow-chip flow-chip--lock">🔒 3회<br/>60문항 평가</div>
            <div class="flow-chip flow-chip--lock">🔒 4회<br/>약점 보완</div>
            <div class="flow-chip flow-chip--lock">🔒 5회<br/>최종 점검</div>
            <div class="flow-chip flow-chip--lock">🔒 합격/불합격 판정</div>
          </div>
        </section>
        <div class="flow-arrow" aria-hidden="true">↓</div>
        <section class="flow-stage flow-stage--4">
          <p class="flow-head">STAGE 4. 최종 오답 정복</p>
          <div class="flow-grid flow-grid--two">
            <div class="flow-chip flow-chip--lock">🔒 기출 오답 복습</div>
            <div class="flow-chip flow-chip--lock">🔒 최종 합격 가능성 안내</div>
          </div>
        </section>
      </div>
      <button type="button" class="mq-bigbtn mq-bigbtn--start" id="btn-start-study">전체 코스 시작</button>
      <p class="hub-hint">
        시작 버튼을 누르면 그래프 순서대로 자동 진행됩니다.
      </p>
    `;
    document.getElementById("btn-start-study").addEventListener("click", () => {
      studyWrong = new Set();
      mockHistory = [];
      expectedMockRound = 1;
      canEnterFinalReview = false;
      studyRound = 1;
      studyQueue = window.MakeupQuestionEngine.buildSequentialByCategory(bank);
      studyIndex = 0;
      setScreen("quiz");
      renderStudyQuestion();
    });
  }

  function goHub() {
    if (!window.confirm("중단하면 이 세션 진행이 초기화됩니다. 처음 화면으로 돌아갈까요?")) return;
    clearStudyTimer();
    clearMockTimer();
    studyRound = 0;
    setScreen("hub");
    renderHub();
  }

  E.btnStop.addEventListener("click", goHub);
  E.btnPrevTop.addEventListener("click", () => advanceStudy(-1));
  E.qNavPrev.addEventListener("click", () => advanceStudy(-1));
  E.qNavNext.addEventListener("click", () => advanceStudy(1));

  function init() {
    setScreen("loading");
    E.loadErr.hidden = true;
    window.MakeupQuestionEngine.loadMakeupBank()
      .then((data) => {
        bank = data;
        setScreen("hub");
        renderHub();
      })
      .catch((err) => {
        console.error(err);
        setScreen("hub");
        E.loadErr.hidden = false;
        E.loadErr.textContent = `문항을 불러오지 못했습니다: ${err.message || err}`;
        E.hubActions.innerHTML =
          '<p class="hub-hint">로컬 서버(예: <code>npx serve</code>)로 열면 JSON을 불러올 수 있습니다.</p>';
      });
  }

  init();
})();
