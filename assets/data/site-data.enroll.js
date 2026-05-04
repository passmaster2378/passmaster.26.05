window.PASSMASTER_SITE_DATA_CHUNKS = window.PASSMASTER_SITE_DATA_CHUNKS || [];

window.PASSMASTER_SITE_DATA_CHUNKS.push({
  toneGuideByDomain: {
    enroll: {
      coreMessage: "수강 신청과 결제 전환율을 함께 높이는 흐름을 운영합니다.",
      primaryTarget: "수강 신청 완료율 95% 이상",
      responseTarget: "승인 대기 건 24시간 내 전량 처리",
      qualityRule: "결제 실패 고객 재시도 가이드 즉시 노출",
    },
  },
  routeContent: {
    "/enroll": {
      overview:
        "모집 중 과정 비교, 신청서 작성, 결제까지 이어지는 전환형 수강 신청 흐름을 제공합니다.",
      stats: [
        ["모집 중 과정", "11개"],
        ["신청 완료율", "95.6%"],
        ["평균 승인 시간", "18분"],
      ],
    },
  },
  routeActions: {
    "/enroll": [
      ["모집 상세로 이동", "./opening/index.html?openingId=1"],
      ["신청 전 FAQ 확인", "../support/faq/index.html"],
    ],
  },
  routeRecordSets: {
    "/enroll": {
      title: "실시간 모집 과정 현황",
      columns: ["과정", "모집상태", "잔여좌석", "개강일"],
      rows: [
        ["산업안전기사 필기", "모집중", "12석", "2026-05-13"],
        ["전기기사 필기", "마감임박", "4석", "2026-05-10"],
        ["정보처리기사 필기", "모집중", "18석", "2026-05-20"],
        ["가스기사 필기", "대기접수", "정원마감", "2026-05-07"],
      ],
      note: "잔여 좌석과 모집 상태는 10분 단위로 자동 갱신됩니다.",
    },
  },
});
