window.PASSMASTER_SITE_DATA_CHUNKS = window.PASSMASTER_SITE_DATA_CHUNKS || [];

window.PASSMASTER_SITE_DATA_CHUNKS.push({
  toneGuideByDomain: {
    admin: {
      coreMessage: "운영 의사결정을 지표 기반으로 표준화하고 자동화합니다.",
      primaryTarget: "핵심 운영 지표 일일 마감률 100%",
      responseTarget: "고위험 이슈 24시간 내 조치",
      qualityRule: "승인/환불/권한 변경 로그 누락 0건",
    },
  },
  operationProfiles: {
    admin: {
      feed: [
        "신청 승인/반려 처리 41건 완료",
        "결제 예외 대응 2건 해결",
        "관리자 공지 1건 게시",
      ],
    },
  },
  routeContent: {
    "/admin": {
      overview:
        "강의, 결제, 회원, 문의의 핵심 운영 지표를 한 화면에서 확인하고 우선순위 작업을 실행합니다.",
      stats: [
        ["오늘 신규 신청", "31건"],
        ["결제 성공률", "97.8%"],
        ["미처리 문의", "6건"],
      ],
    },
  },
  routeActions: {
    "/admin": [
      ["오늘 우선 작업", "./enrollments/index.html"],
      ["문의 큐 확인", "./inquiries/index.html"],
    ],
  },
  routeRecordSets: {
    "/admin": {
      title: "운영 대시보드 작업 보드",
      columns: ["작업ID", "카테고리", "우선순위", "상태", "완료목표"],
      rows: [
        ["OPS-611", "수강승인", "높음", "진행중", "오늘 18:00"],
        ["OPS-612", "결제예외", "높음", "검토중", "오늘 17:30"],
        ["OPS-613", "문의배정", "중간", "완료", "완료"],
        ["OPS-614", "후기검수", "중간", "대기", "내일 11:00"],
      ],
      note: "높음 우선순위 작업은 운영 총괄 승인 후 즉시 실행됩니다.",
    },
  },
});
