(function initializePassmasterQuestionBank() {
  const subjects = [
    {
      code: "forklift",
      name: "지게차기능사",
      category: "장비·안전",
      questionBase:
        "산업안전·운전 원칙에 따라 다음 작업 조건에서 지게차기능사 필기 범위에서 가장 우선적으로 확인해야 할 조치는 무엇인가?",
      concepts: ["하중·안전거리", "후사경·시야", "경사지 지지", "작업반경", "보호구"],
    },
    {
      code: "electric",
      name: "전기기능사",
      category: "전기이론",
      questionBase:
        "주어진 회로 조건에서 전기기능사 필기(객관식) 관점에서 가장 적절한 계산·판단은 무엇인가?",
      concepts: ["옴의 법칙", "직렬·병렬", "역률", "접지", "누전차단"],
    },
    {
      code: "makeup",
      name: "메이크업 미용사",
      category: "미용위생",
      questionBase:
        "피부 타입과 위생 기준을 고려할 때 메이크업 미용사 필기에서 가장 타당한 선택은 무엇인가?",
      concepts: ["소독·위생", "색채", "피부 트러블", "제품 성분", "업역 규정"],
    },
  ];

  const choiceTemplates = [
    ["법적 최소 기준만 준수한다.", "위험요소를 식별하고 통제 대책을 우선 적용한다.", "문서 보고 후 다음 분기에 반영한다.", "작업 종료 후 교육을 진행한다."],
    ["가용 자원 범위를 먼저 확정한다.", "우선순위 기준에 따라 핵심 위험을 선제적으로 차단한다.", "전체 대체 설비를 즉시 교체한다.", "현장 판단에 전적으로 위임한다."],
    ["기존 데이터만 유지한다.", "변경 영향도를 분석하고 검증 절차를 선행한다.", "일정을 단축하기 위해 검수를 생략한다.", "장애 발생 후 패치한다."],
  ];

  const explanations = [
    "핵심은 즉시 위험을 낮추는 선제 조치와 법정 기준 준수를 함께 충족하는 것입니다.",
    "문항의 조건은 우선순위 기반 통제와 검증 절차를 요구하므로 가장 직접적인 조치를 선택해야 합니다.",
    "실무형 출제에서는 효과성, 법적 요건, 재발 방지의 세 요소를 동시에 만족하는 선택지가 정답입니다.",
  ];

  function getDifficulty(index) {
    if (index % 3 === 0) return "상";
    if (index % 3 === 1) return "중";
    return "하";
  }

  function buildQuestion(subject, index) {
    const template = choiceTemplates[index % choiceTemplates.length];
    const concept = subject.concepts[index % subject.concepts.length];
    const answer = 2;

    return {
      id: `${subject.code}-${String(index + 1).padStart(3, "0")}`,
      subjectCode: subject.code,
      subjectName: subject.name,
      category: subject.category,
      round: `2026-${Math.floor(index / 25) + 1}회`,
      difficulty: getDifficulty(index),
      questionType: "single-choice",
      question: `${subject.questionBase} (핵심 개념: ${concept})`,
      choices: template,
      answer,
      explanation: explanations[index % explanations.length],
      tags: [subject.code, concept, getDifficulty(index)],
      source: "PASSmaster 문제은행",
      isPublished: true,
    };
  }

  const questions = subjects.flatMap((subject) =>
    Array.from({ length: 100 }, (_, index) => buildQuestion(subject, index))
  );

  window.PASSMASTER_QUESTION_BANK = {
    version: "v1.0.0",
    latestRound: "2026-4회",
    totalQuestions: questions.length,
    subjects: subjects.map((subject) => ({
      code: subject.code,
      name: subject.name,
      category: subject.category,
      count: 100,
    })),
    questions,
    metadata: {
      generatedAt: "2026-05-01T16:30:00+09:00",
      maintainer: "PASSmaster Content Team",
      updatePolicy: "월 2회 문항 업데이트, 회차별 검수 반영",
    },
  };
})();
