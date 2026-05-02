window.PASSMASTER_SITE_DATA_CHUNKS = window.PASSMASTER_SITE_DATA_CHUNKS || [];

window.PASSMASTER_SITE_DATA_CHUNKS.push({
  toneGuideByDomain: {
    support: {
      coreMessage: "빠른 응답과 정확한 해결로 학습 중단 시간을 최소화합니다.",
      primaryTarget: "고객지원 SLA 준수율 95% 이상",
      responseTarget: "첫 응답 평균 10분 이내",
      qualityRule: "장기 미해결 티켓 0건 목표",
    },
  },
  operationProfiles: {
    support: {
      feed: [
        "금일 접수 문의 46건",
        "평균 첫 응답 9분 40초",
        "미해결 고우선순위 티켓 1건",
      ],
    },
  },
  routeContent: {
    "/support": {
      overview:
        "FAQ 검색, 1:1 문의 접수, 문의 추적을 통합 제공해 고객 문제를 빠르게 해결합니다.",
      stats: [
        ["평균 첫 응답", "9분 40초"],
        ["금일 처리 문의", "46건"],
        ["고객 만족도", "4.8 / 5.0"],
      ],
    },
  },
  routeActions: {
    "/support": [
      ["미해결 문의 확인", "./inquiry/index.html"],
      ["신규 문의 등록", "./inquiry/new/index.html"],
    ],
  },
  routeRecordSets: {
    "/support": {
      title: "고객센터 실시간 티켓 큐",
      columns: ["티켓번호", "문의유형", "우선순위", "처리상태", "담당자"],
      rows: [
        ["CS-8921", "결제오류", "높음", "처리중", "정산팀 박OO"],
        ["CS-8922", "학습진도", "중간", "답변완료", "튜터팀 김OO"],
        ["CS-8923", "로그인", "높음", "접수", "인증팀 이OO"],
        ["CS-8924", "환불문의", "중간", "검토중", "운영팀 최OO"],
      ],
      note: "높음 우선순위 티켓은 SLA 30분 이내 첫 응답을 목표로 처리합니다.",
    },
  },
});
