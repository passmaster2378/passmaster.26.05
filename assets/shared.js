const routeNode = document.querySelector(".pm-route");
const pageRoute = (
  (document.body && document.body.dataset && document.body.dataset.pmRoute) ||
  (routeNode ? routeNode.textContent.trim() : "") ||
  ""
).trim();

const routeContent = {
  "/register": {
    headline: "회원가입 정보 입력",
    overview:
      "수강 과정 추천 정확도를 높이기 위해 기본 정보와 관심 자격증을 함께 수집합니다.",
    highlights: [
      "이메일/휴대폰 본인확인 후 계정을 활성화합니다.",
      "직무/학습 가능 시간 기반으로 추천 과정이 자동 정렬됩니다.",
      "회원가입 완료 시 웰컴 쿠폰과 초기 진단 테스트가 제공됩니다.",
    ],
    checklist: ["이메일 인증 동의", "비밀번호 안전 규칙", "관심 자격증 선택", "수신 동의 설정"],
    stats: [
      ["필수 입력 항목", "6개"],
      ["예상 소요 시간", "약 2분"],
      ["가입 완료 혜택", "웰컴 쿠폰 1장"],
    ],
  },
  "/verify-email": {
    headline: "이메일 인증 진행",
    overview:
      "입력한 이메일로 발송된 인증 코드를 확인하고 계정의 신뢰도를 검증하는 단계입니다.",
    highlights: [
      "인증 메일은 평균 30초 내 발송됩니다.",
      "인증 실패 5회 시 보안을 위해 재발송 절차가 진행됩니다.",
      "인증 완료 즉시 온보딩 단계로 자동 이동합니다.",
    ],
    checklist: ["메일함/스팸함 확인", "6자리 코드 입력", "유효시간 내 인증", "재발송 제한 확인"],
    stats: [
      ["코드 유효 시간", "10분"],
      ["재발송 간격", "60초"],
      ["실패 허용 횟수", "5회"],
    ],
  },
  "/onboarding": {
    headline: "초기 학습 진단",
    overview:
      "학습 목표, 현재 수준, 응시 계획을 기반으로 개인화된 첫 학습 루트를 추천합니다.",
    highlights: [
      "목표 시험일을 입력하면 역산 학습 캘린더가 생성됩니다.",
      "기초/심화 진단 점수에 따라 권장 강의 순서가 달라집니다.",
      "온보딩 결과는 마이페이지에서 언제든 수정할 수 있습니다.",
    ],
    checklist: ["목표 시험일 입력", "주당 학습 시간 설정", "기초 진단 완료", "추천 루트 저장"],
    stats: [
      ["질문 문항 수", "12문항"],
      ["평균 완료 시간", "3~4분"],
      ["추천 루트 생성", "실시간"],
    ],
  },
  "/forgot-password": {
    headline: "비밀번호 재설정 요청",
    overview:
      "계정 보호를 위해 본인확인 후 1회성 재설정 링크를 발급합니다.",
    highlights: [
      "등록된 이메일로만 재설정 링크가 전송됩니다.",
      "최근 로그인 이력과 함께 보안 안내를 제공합니다.",
      "요청 이력은 이상 접속 탐지에 활용됩니다.",
    ],
    checklist: ["가입 이메일 입력", "보안 캡차 통과", "메일 수신 확인", "요청 이력 점검"],
    stats: [
      ["링크 유효 시간", "20분"],
      ["동시 유효 링크", "1개"],
      ["재요청 간격", "2분"],
    ],
  },
  "/reset-password": {
    headline: "새 비밀번호 설정",
    overview:
      "강력한 비밀번호 정책에 맞게 새 비밀번호를 설정하고 보안 알림을 전송합니다.",
    highlights: [
      "기존 비밀번호와 동일한 값은 사용할 수 없습니다.",
      "변경 완료 후 모든 기기에서 재로그인 절차가 적용됩니다.",
      "비밀번호 변경 내역은 보안 로그에 저장됩니다.",
    ],
    checklist: ["8자 이상 입력", "영문/숫자/특수문자 포함", "재입력 일치 확인", "저장 후 재로그인"],
    stats: [
      ["최소 길이", "8자"],
      ["권장 길이", "12자 이상"],
      ["보안 로그 보관", "180일"],
    ],
  },
  "/terms": {
    headline: "서비스 이용약관 핵심",
    overview:
      "회원 권리와 의무, 서비스 이용 범위, 제한 사항을 한 눈에 확인할 수 있도록 구성합니다.",
    highlights: [
      "콘텐츠 저작권 및 무단 배포 금지 조항을 포함합니다.",
      "서비스 중단/변경 시 사전 공지 기준을 명시합니다.",
      "분쟁 발생 시 처리 절차와 관할을 안내합니다.",
    ],
    checklist: ["회원 의무 확인", "콘텐츠 사용 범위 확인", "계정 제재 기준 확인", "동의 기록 저장"],
    stats: [
      ["개정 고지 기간", "7일"],
      ["중요 변경 고지", "30일"],
      ["약관 버전", "v2.3"],
    ],
  },
  "/privacy": {
    headline: "개인정보 처리방침",
    overview:
      "수집 항목, 이용 목적, 보관 기간, 파기 절차를 명확히 안내해 신뢰성을 확보합니다.",
    highlights: [
      "학습 기록/결제 기록의 수집 목적을 구분해 제시합니다.",
      "목적 달성 후 파기 기준과 예외 보관 근거를 제공합니다.",
      "개인정보 보호 책임자 및 문의 채널을 명시합니다.",
    ],
    checklist: ["수집 항목 범위", "제3자 제공 여부", "보관 기간 확인", "열람/삭제 요청 방법"],
    stats: [
      ["개인정보 보호 책임자", "1명"],
      ["최대 보관 기간", "5년(법정 기준)"],
      ["정책 업데이트", "분기 1회 검토"],
    ],
  },
  "/refund": {
    headline: "환불 정책 안내",
    overview:
      "수강 진행률과 결제 수단에 따른 환불 기준을 투명하게 제공해 분쟁을 줄입니다.",
    highlights: [
      "전자상거래법과 내부 약관을 함께 적용합니다.",
      "결제수단별 환불 처리 기간을 분리해 안내합니다.",
      "환불 신청 후 상태 추적이 가능합니다.",
    ],
    checklist: ["진행률 확인", "환불 사유 입력", "증빙 자료 첨부", "환불 계좌 확인"],
    stats: [
      ["카드 취소", "영업일 3~5일"],
      ["계좌 환불", "영업일 1~2일"],
      ["신청 가능 채널", "웹/고객센터"],
    ],
  },
  "/legal": {
    headline: "회사정보 · 약관 · 개인정보 · 환불",
    overview: "법적 고지와 회사 정보를 한 페이지에서 제공합니다.",
    highlights: [
      "목차 링크로 섹션 간 빠른 이동이 가능합니다.",
      "메인 푸터의 네 항목과 동일한 내용 구조입니다.",
    ],
    checklist: ["실제 사업자 정보로 교체", "법무 검토 후 약관·환불 조항 보완"],
    stats: [
      ["통합 섹션", "4개"],
      ["문서 형식", "HTML 앵커"],
    ],
  },
  "/enroll": {
    headline: "개설 과정 탐색",
    overview:
      "진행 중/오픈 예정 과정을 비교하고 본인에게 맞는 과정을 선택하는 페이지입니다.",
    highlights: [
      "과정별 난이도, 수강 기간, 합격률 지표를 제공합니다.",
      "찜하기 기능으로 관심 과정을 모아서 비교할 수 있습니다.",
      "모집 마감 임박 과정은 상단 우선 노출됩니다.",
    ],
    checklist: ["관심 자격증 필터", "난이도 확인", "수강 기간 비교", "개강일 확인"],
    stats: [
      ["현재 모집 과정", "9개"],
      ["평균 수강 기간", "8주"],
      ["마감 임박 과정", "3개"],
    ],
  },
  "/enroll/[openingId]": {
    headline: "과정 상세 정보 확인",
    overview:
      "커리큘럼, 강사진, 수강 조건, 포함 자료를 확인한 뒤 신청 여부를 결정합니다.",
    highlights: [
      "주차별 학습 목표와 과제 난이도를 제공합니다.",
      "합격생 후기와 최근 시험 반영 범위를 확인할 수 있습니다.",
      "수강 시작일과 승인 절차 안내가 함께 노출됩니다.",
    ],
    checklist: ["커리큘럼 검토", "수강 대상 확인", "필수 준비물 확인", "신청 조건 체크"],
    stats: [
      ["강의 수", "42강"],
      ["제공 자료", "PDF/문제집/요약노트"],
      ["학습 권장 시간", "주 8시간"],
    ],
  },
  "/enroll/apply": {
    headline: "수강 신청서 작성",
    overview:
      "선택한 모집 정보를 확인하고 약관에 동의한 뒤 신청을 확정합니다. 로그인한 회원만 제출할 수 있습니다.",
    highlights: [
      "신청 전 과정명·기간·납부 금액을 다시 한 번 확인합니다.",
      "필수 동의 항목을 완료해야 결제 안내 단계로 이동합니다.",
      "이미 신청한 모집은 중복 접수되지 않습니다.",
    ],
    checklist: ["모집 정보 확인", "약관·환불 규정 동의", "로그인 상태 점검", "신청 확정"],
    stats: [
      ["평균 소요 시간", "1분 이내"],
      ["필수 동의", "2항목"],
      ["다음 단계", "결제 안내"],
    ],
  },
  "/enroll/payment": {
    headline: "결제 안내 및 입금 확인",
    overview:
      "계좌이체 정보를 확인하고 입금 요청을 제출해 승인 절차를 시작합니다.",
    highlights: [
      "신청 번호와 납부 금액을 결제 전에 다시 확인합니다.",
      "무통장 입금 후 입금 완료(요청) 버튼으로 상태를 전환합니다.",
      "승인 전까지 추가 제출이 필요하면 고객센터로 안내됩니다.",
    ],
    checklist: ["신청 번호 확인", "입금 금액 확인", "입금 후 요청 제출", "내 강의에서 진행 확인"],
    stats: [
      ["지원 결제 수단", "계좌이체(1차)"],
      ["평균 입금 확인", "영업일 기준 빠른 처리"],
      ["문의 채널", "1:1 문의"],
    ],
  },
  "/enroll/complete": {
    headline: "신청 완료 확인",
    overview:
      "신청 완료 후 승인 상태와 학습 시작 일정을 확인하는 완료 화면입니다.",
    highlights: [
      "승인 전까지 필요한 추가 제출 자료를 안내합니다.",
      "내 강의와 마이페이지로 바로 이동할 수 있습니다.",
      "등록한 연락처로 확인 알림이 발송됩니다.",
    ],
    checklist: ["신청 번호 저장", "승인 예정 시간 확인", "내 강의 이동", "문의 채널 확인"],
    stats: [
      ["평균 승인 시간", "영업일 1일"],
      ["문자/메일 알림", "동시 발송"],
      ["재신청 가능 시점", "즉시"],
    ],
  },
  "/my-courses": {
    headline: "내 강의 대시보드",
    overview:
      "진행 중 강의, 예정 강의, 완료 강의를 한 화면에서 관리하는 학습 허브입니다.",
    highlights: [
      "과목별 진도율과 최근 학습일을 카드로 제공합니다.",
      "취약 단원 자동 추천으로 복습 우선순위를 제시합니다.",
      "다음 학습 추천 강의가 상단에 고정됩니다.",
    ],
    checklist: ["오늘 학습 목표 확인", "진도율 점검", "복습 추천 확인", "주간 리포트 열람"],
    stats: [
      ["진행 중 과정", "2개"],
      ["완료 과정", "4개"],
      ["주간 목표 달성률", "87%"],
    ],
  },
  "/my-courses/[enrollmentId]": {
    headline: "수강 상세 학습",
    overview:
      "선택한 과정의 강의 목록, 진도, 과제, 복습 루프를 상세하게 관리합니다.",
    highlights: [
      "강의별 학습 완료 체크와 배속 시청 기록을 저장합니다.",
      "오답 노트를 자동 생성해 반복 복습을 지원합니다.",
      "과제 제출 상태와 피드백 확인이 가능합니다.",
    ],
    checklist: ["강의 시청", "퀴즈 응시", "오답 정리", "주차별 과제 제출"],
    stats: [
      ["현재 진도율", "64%"],
      ["남은 강의", "15강"],
      ["오답 노트 항목", "28개"],
    ],
  },
  "/mypage": {
    headline: "개인 설정 허브",
    overview:
      "계정 정보, 결제 내역, 알림, 문의 내역을 모아 관리하는 개인화 페이지입니다.",
    highlights: [
      "핵심 항목을 카드 형태로 빠르게 진입할 수 있습니다.",
      "보안 설정과 알림 수신 설정을 한 번에 조정합니다.",
      "최근 활동 요약을 상단에서 바로 확인할 수 있습니다.",
    ],
    checklist: ["프로필 최신화", "보안 설정 점검", "알림 설정 확인", "최근 문의 상태 확인"],
    stats: [
      ["최근 로그인", "오늘 09:14"],
      ["미확인 알림", "3건"],
      ["열린 문의", "1건"],
    ],
  },
  "/mypage/profile": {
    headline: "프로필 정보 관리",
    overview:
      "이름, 연락처, 목표 자격증 등 학습 맞춤화에 필요한 프로필 정보를 수정합니다.",
    highlights: [
      "목표 자격증 변경 시 추천 학습 루트가 즉시 갱신됩니다.",
      "연락처 변경 후 재인증이 자동으로 진행됩니다.",
      "저장 전 변경 비교 미리보기를 제공합니다.",
    ],
    checklist: ["연락처 최신화", "목표 자격증 선택", "학습 가능 시간 설정", "저장 전 검토"],
    stats: [
      ["수정 가능 항목", "8개"],
      ["인증 필요 항목", "이메일/휴대폰"],
      ["자동 저장", "미지원"],
    ],
  },
  "/mypage/password": {
    headline: "비밀번호 및 보안",
    overview:
      "계정 보안을 강화하기 위한 비밀번호 변경과 인증 수단 점검을 제공합니다.",
    highlights: [
      "최근 보안 이벤트와 로그인 기록을 함께 제공합니다.",
      "의심 로그인 발생 시 즉시 차단 설정이 가능합니다.",
      "변경 완료 후 보안 알림 메일을 발송합니다.",
    ],
    checklist: ["현재 비밀번호 확인", "새 비밀번호 입력", "2차 인증 설정", "로그인 기기 점검"],
    stats: [
      ["최근 비밀번호 변경", "45일 전"],
      ["활성 로그인 기기", "2대"],
      ["2차 인증 상태", "비활성"],
    ],
  },
  "/mypage/enrollments": {
    headline: "수강 신청 내역",
    overview:
      "신청한 과정의 승인 상태와 결제 상태를 조회하고 필요한 조치를 진행합니다.",
    highlights: [
      "승인 대기/승인 완료/취소 상태를 탭으로 구분합니다.",
      "상세 페이지로 이동해 결제/학습 시작 정보를 확인합니다.",
      "신청 취소 가능 기간을 상태별로 표시합니다.",
    ],
    checklist: ["승인 상태 확인", "결제 상태 확인", "필요 시 문의 등록", "학습 시작일 확인"],
    stats: [
      ["총 신청 건수", "7건"],
      ["승인 대기", "1건"],
      ["승인 완료", "6건"],
    ],
  },
  "/mypage/payments": {
    headline: "결제 내역 관리",
    overview:
      "결제 영수증, 결제 상태, 환불 진행 상황을 확인하는 정산 페이지입니다.",
    highlights: [
      "거래 ID와 결제 수단을 기준으로 검색/필터가 가능합니다.",
      "환불 요청 건은 단계별 처리 현황이 표시됩니다.",
      "전자 영수증 다운로드 링크를 제공합니다.",
    ],
    checklist: ["거래 필터 적용", "영수증 확인", "환불 상태 점검", "이상 거래 문의"],
    stats: [
      ["최근 30일 결제", "2건"],
      ["평균 결제 금액", "189,000원"],
      ["환불 진행 건", "0건"],
    ],
  },
  "/mypage/learning": {
    headline: "학습 이력 분석",
    overview:
      "일별 학습 시간과 단원별 성취도를 기반으로 다음 학습 전략을 제안합니다.",
    highlights: [
      "주간 누적 학습 시간과 목표 대비 달성률을 제공합니다.",
      "취약 단원은 색상 강조로 우선 복습을 안내합니다.",
      "학습 공백 구간에 대한 알림을 자동 생성합니다.",
    ],
    checklist: ["주간 학습 시간 확인", "취약 단원 점검", "복습 계획 확정", "다음 주 목표 설정"],
    stats: [
      ["이번 주 학습 시간", "11시간 20분"],
      ["목표 달성률", "93%"],
      ["취약 단원", "2개"],
    ],
  },
  "/mypage/inquiries": {
    headline: "내 문의 내역",
    overview:
      "등록한 1:1 문의의 처리 상태와 답변 내역을 확인하고 추가 문의를 남깁니다.",
    highlights: [
      "접수/처리중/완료 상태를 실시간으로 표시합니다.",
      "답변 완료 건에는 만족도 평가를 남길 수 있습니다.",
      "동일 유형 문의를 자동 추천해 중복 문의를 줄입니다.",
    ],
    checklist: ["진행 상태 확인", "답변 열람", "추가 질문 등록", "만족도 평가"],
    stats: [
      ["최근 문의", "4건"],
      ["평균 답변 시간", "3시간"],
      ["미답변 문의", "1건"],
    ],
  },
  "/mypage/notifications": {
    headline: "알림 설정 및 이력",
    overview:
      "학습 리마인드, 결제 알림, 공지 알림 등 수신 채널과 빈도를 관리합니다.",
    highlights: [
      "앱 푸시/이메일/SMS 채널별 수신 여부를 분리 설정합니다.",
      "중요 공지는 수신 거부와 관계없이 필수 발송됩니다.",
      "최근 30일 알림 로그를 확인할 수 있습니다.",
    ],
    checklist: ["채널별 수신 설정", "방해금지 시간 설정", "필수 알림 확인", "로그 확인"],
    stats: [
      ["활성 알림 채널", "2개"],
      ["오늘 수신 알림", "5건"],
      ["읽지 않은 알림", "3건"],
    ],
  },
  "/mypage/withdrawal": {
    headline: "회원 탈퇴 안내",
    overview:
      "탈퇴 전 유의사항과 데이터 보관 정책을 확인하고 최종 탈퇴를 진행합니다.",
    highlights: [
      "진행 중인 과정과 환불 상태를 먼저 점검합니다.",
      "법정 보관 데이터와 즉시 삭제 데이터를 구분해 안내합니다.",
      "탈퇴 후 복구 가능 기간과 절차를 명시합니다.",
    ],
    checklist: ["진행 과정 확인", "환불/결제 이슈 확인", "보관 정책 확인", "탈퇴 사유 제출"],
    stats: [
      ["즉시 삭제 항목", "프로필/알림설정"],
      ["법정 보관 항목", "결제/환불 기록"],
      ["계정 복구 가능", "7일 이내"],
    ],
  },
  "/support": {
    headline: "고객지원 홈",
    overview:
      "FAQ, 1:1 문의, 공지 링크를 제공해 사용자가 빠르게 문제를 해결하도록 돕습니다.",
    highlights: [
      "자주 찾는 문의 유형을 상단 바로가기로 제공합니다.",
      "문의 전 FAQ 검색을 통해 해결 시간을 단축합니다.",
      "문의 접수 시 예상 답변 시간을 사전 안내합니다.",
    ],
    checklist: ["FAQ 우선 확인", "문의 유형 선택", "필요 증빙 준비", "답변 알림 설정"],
    stats: [
      ["평균 첫 응답", "10분"],
      ["금일 처리 문의", "42건"],
      ["FAQ 해결률", "68%"],
    ],
  },
  "/support/faq": {
    headline: "FAQ 목록",
    overview:
      "로그인, 결제, 수강, 환불 등 주요 카테고리별 질문을 한 곳에 정리합니다.",
    highlights: [
      "카테고리 필터로 필요한 답변만 빠르게 찾을 수 있습니다.",
      "조회수가 높은 문서는 상단 추천 영역에 노출됩니다.",
      "해결되지 않으면 문의 작성으로 자연스럽게 연결됩니다.",
    ],
    checklist: ["카테고리 선택", "검색어 입력", "해결 여부 체크", "미해결 시 문의 등록"],
    stats: [
      ["공개 FAQ", "84개"],
      ["이번 주 신규 FAQ", "5개"],
      ["평균 해결 소요", "2분 이내"],
    ],
  },
  "/support/inquiry": {
    headline: "문의 목록",
    overview:
      "사용자가 접수한 문의의 상태를 조회하고 상세 페이지로 이동하는 화면입니다.",
    highlights: [
      "문의 유형/상태/등록일 기준으로 정렬할 수 있습니다.",
      "처리 지연 문의는 우선 확인 배지를 표시합니다.",
      "새 문의 작성 버튼으로 즉시 접수 페이지로 이동합니다.",
    ],
    checklist: ["처리 상태 필터", "지연 문의 우선 확인", "답변 확인", "필요 시 재문의"],
    stats: [
      ["총 문의 건수", "12건"],
      ["처리중", "2건"],
      ["답변 완료", "10건"],
    ],
  },
  "/support/inquiry/new": {
    headline: "새 문의 작성",
    overview:
      "문의 유형에 맞는 템플릿으로 필요한 정보를 빠짐없이 작성하도록 돕습니다.",
    highlights: [
      "결제/기술/학습 문의별 권장 입력 항목이 다르게 표시됩니다.",
      "이미지/파일 첨부로 상황 설명 정확도를 높일 수 있습니다.",
      "작성 중 임시 저장으로 이탈을 줄입니다.",
    ],
    checklist: ["문의 유형 선택", "상세 내용 작성", "증빙 파일 첨부", "연락 가능 시간 입력"],
    stats: [
      ["허용 첨부 형식", "jpg/png/pdf"],
      ["최대 첨부 용량", "20MB"],
      ["임시 저장 보관", "7일"],
    ],
  },
  "/support/inquiry/[id]": {
    headline: "문의 상세 확인",
    overview:
      "문의 본문, 운영자 답변, 추가 코멘트 이력을 타임라인 형태로 확인합니다.",
    highlights: [
      "처리 단계 변경 이력이 시간순으로 기록됩니다.",
      "운영자 답변에 대해 추가 질문을 이어서 등록할 수 있습니다.",
      "문의 해결 시 만족도 평가를 남길 수 있습니다.",
    ],
    checklist: ["답변 내용 확인", "추가 질문 작성", "첨부파일 재확인", "처리 완료 평가"],
    stats: [
      ["문의 번호", "INQ-001"],
      ["현재 상태", "처리중"],
      ["최근 업데이트", "오늘 13:42"],
    ],
  },
  "/admin": {
    headline: "운영 대시보드",
    overview:
      "신청, 결제, 학습, 문의 핵심 지표를 집계해 운영 우선순위를 빠르게 파악합니다.",
    highlights: [
      "당일 신규 신청/승인/취소 추이를 실시간으로 제공합니다.",
      "결제 실패율과 문의 폭증 구간을 경고 배지로 표시합니다.",
      "자주 사용하는 관리 화면으로 바로 이동할 수 있습니다.",
    ],
    checklist: ["핵심 지표 점검", "이상 알림 확인", "우선 처리 업무 선택", "운영 공지 반영"],
    stats: [
      ["오늘 신규 신청", "27건"],
      ["미처리 문의", "8건"],
      ["결제 성공률", "97.2%"],
    ],
  },
  "/admin/courses": {
    headline: "강의 목록 관리",
    overview:
      "강의 상태, 노출 여부, 모집 일정, 강사 배정을 일괄 관리하는 화면입니다.",
    highlights: [
      "개설/모집중/마감 상태를 빠르게 전환할 수 있습니다.",
      "강의 검색 및 정렬 기능으로 관리 효율을 높입니다.",
      "강의별 등록 인원과 잔여 좌석을 확인할 수 있습니다.",
    ],
    checklist: ["상태 필터 확인", "마감 일정 점검", "노출 상태 업데이트", "상세 페이지 이동"],
    stats: [
      ["총 강의", "32개"],
      ["모집중", "9개"],
      ["마감 임박", "4개"],
    ],
  },
  "/admin/courses/new": {
    headline: "강의 신규 등록",
    overview:
      "신규 과정의 기본 정보, 커리큘럼, 가격, 오픈 일정을 등록하는 작성 페이지입니다.",
    highlights: [
      "필수 입력 검증으로 누락 항목을 사전에 차단합니다.",
      "미리보기 기능으로 사용자 노출 화면을 즉시 확인합니다.",
      "임시 저장 후 승인 프로세스로 전달할 수 있습니다.",
    ],
    checklist: ["기본 정보 입력", "커리큘럼 구성", "가격/할인 설정", "오픈 일정 등록"],
    stats: [
      ["필수 입력 섹션", "5개"],
      ["임시 저장", "지원"],
      ["검수 필요 상태", "작성 완료 후 자동"],
    ],
  },
  "/admin/courses/[id]": {
    headline: "강의 상세 수정",
    overview:
      "선택한 강의의 노출, 자료, 수강생, 공지 사항을 종합적으로 관리합니다.",
    highlights: [
      "강의별 공지 고정과 대상 수강생 지정이 가능합니다.",
      "자료 업데이트 이력과 버전 관리를 제공합니다.",
      "정원/대기자 설정을 실시간으로 조정할 수 있습니다.",
    ],
    checklist: ["상세 정보 점검", "자료 최신화", "공지 반영", "수강생 상태 확인"],
    stats: [
      ["강의 ID", "CRS-001"],
      ["등록 수강생", "128명"],
      ["최근 수정", "어제 18:05"],
    ],
  },
  "/admin/enrollments": {
    headline: "수강 신청 관리",
    overview:
      "신청 접수 건을 검토해 승인/반려 처리하고 보완 요청을 진행합니다.",
    highlights: [
      "승인 대기 건을 우선 큐로 정렬합니다.",
      "반려 시 사유 템플릿을 선택해 빠르게 안내합니다.",
      "처리 SLA 기준으로 지연 건을 표시합니다.",
    ],
    checklist: ["신청서 검토", "증빙 확인", "승인/반려 처리", "처리 메모 기록"],
    stats: [
      ["오늘 처리 대기", "14건"],
      ["평균 처리 시간", "22분"],
      ["반려 비율", "4.8%"],
    ],
  },
  "/admin/enrollments/[id]": {
    headline: "신청 상세 검토",
    overview:
      "개별 신청자의 정보, 결제 상태, 제출 자료를 상세 검토하는 페이지입니다.",
    highlights: [
      "신청 히스토리와 변경 이력을 한 화면에 제공합니다.",
      "관리자 메모와 내부 태그를 활용해 협업합니다.",
      "승인 결과를 사용자에게 즉시 알림 발송합니다.",
    ],
    checklist: ["개인 정보 확인", "결제 상태 확인", "증빙 파일 검토", "최종 처리 결정"],
    stats: [
      ["신청 번호", "ENR-001"],
      ["접수 시각", "오늘 10:12"],
      ["검토 담당자", "운영팀 김OO"],
    ],
  },
  "/admin/payments": {
    headline: "결제 관리",
    overview:
      "결제 성공/실패/환불 상태를 모니터링하고 이상 거래를 대응합니다.",
    highlights: [
      "결제 실패 원인별 집계로 장애 구간을 탐지합니다.",
      "환불 요청 건은 우선 처리 큐로 분리됩니다.",
      "PG사 정산 데이터와 대사 상태를 확인할 수 있습니다.",
    ],
    checklist: ["실패 결제 점검", "환불 요청 확인", "정산 상태 확인", "이상 거래 대응"],
    stats: [
      ["오늘 결제 건수", "63건"],
      ["실패 건수", "2건"],
      ["환불 처리 대기", "1건"],
    ],
  },
  "/admin/payments/[id]": {
    headline: "결제 상세 확인",
    overview:
      "특정 거래의 결제 로그, 요청/응답 기록, 환불 가능 여부를 확인합니다.",
    highlights: [
      "트랜잭션 단계별 상태 코드를 타임라인으로 제공합니다.",
      "중복 결제/부분 결제 여부를 자동 감지합니다.",
      "환불 처리 시 내부 승인 절차를 함께 관리합니다.",
    ],
    checklist: ["결제 로그 확인", "사용자 내역 대조", "환불 필요 여부 판단", "처리 결과 기록"],
    stats: [
      ["거래 ID", "PAY-001"],
      ["결제 금액", "219,000원"],
      ["현재 상태", "결제 완료"],
    ],
  },
  "/admin/learning": {
    headline: "학습 운영 관리",
    overview:
      "강의 콘텐츠 배포와 학습 진도 정책을 점검해 학습 경험 품질을 유지합니다.",
    highlights: [
      "콘텐츠 공개 스케줄과 과제 마감일을 동기화합니다.",
      "완주율 저하 구간을 찾아 운영 공지를 배포합니다.",
      "학습 성취도 기반 보충 학습 정책을 설정합니다.",
    ],
    checklist: ["콘텐츠 배포 일정", "진도 기준 점검", "과제 정책 확인", "완주율 모니터링"],
    stats: [
      ["활성 과정", "9개"],
      ["평균 완주율", "81%"],
      ["보충 학습 대상", "36명"],
    ],
  },
  "/admin/learning/[id]": {
    headline: "학습 이력 상세",
    overview:
      "개별 수강생 또는 과정의 세부 학습 로그를 분석해 개입 포인트를 찾습니다.",
    highlights: [
      "시청 패턴/퀴즈 점수/복습 횟수를 종합 분석합니다.",
      "장기 미접속 구간을 감지해 리마인드 발송이 가능합니다.",
      "담당 튜터 코멘트를 기록해 팔로업을 추적합니다.",
    ],
    checklist: ["학습 로그 확인", "점수 추이 분석", "리마인드 필요 판단", "튜터 코멘트 기록"],
    stats: [
      ["대상 ID", "LRN-001"],
      ["최근 접속", "2일 전"],
      ["복습 필요 단원", "3개"],
    ],
  },
  "/admin/users": {
    headline: "회원 관리",
    overview:
      "회원 계정 상태, 권한, 활동 이력을 확인하고 운영 정책에 맞게 관리합니다.",
    highlights: [
      "휴면/활성/제재 계정을 상태별로 분류합니다.",
      "권한 변경 이력을 기록해 감사 대응을 강화합니다.",
      "문의/결제 이력과 연계해 종합 뷰를 제공합니다.",
    ],
    checklist: ["회원 검색", "상태 필터", "권한 검토", "변경 이력 기록"],
    stats: [
      ["총 회원 수", "12,480명"],
      ["휴면 계정", "1,134명"],
      ["오늘 신규 가입", "41명"],
    ],
  },
  "/admin/users/[id]": {
    headline: "회원 상세 정보",
    overview:
      "개별 회원의 프로필, 수강, 결제, 문의 이력을 통합 확인하는 상세 화면입니다.",
    highlights: [
      "최근 활동 타임라인으로 주요 이슈를 파악합니다.",
      "관리자 메모와 경고 이력을 기록할 수 있습니다.",
      "권한/상태 변경 시 사유 입력을 필수화합니다.",
    ],
    checklist: ["기본 정보 확인", "이력 검토", "상태 변경 여부 결정", "내부 메모 저장"],
    stats: [
      ["회원 ID", "USR-001"],
      ["가입일", "2025-08-21"],
      ["최근 문의", "3건"],
    ],
  },
  "/admin/reviews": {
    headline: "후기 관리",
    overview:
      "수강 후기를 검수하고 승인/보류/반려 상태로 관리해 신뢰 가능한 후기를 제공합니다.",
    highlights: [
      "금칙어/광고성 표현을 자동 탐지해 검수 효율을 높입니다.",
      "승인 후 노출 위치와 우선순위를 설정할 수 있습니다.",
      "신고된 후기의 재검수 이력을 추적합니다.",
    ],
    checklist: ["검수 대기 확인", "내용 적합성 검토", "승인/반려 처리", "노출 우선순위 설정"],
    stats: [
      ["검수 대기", "11건"],
      ["오늘 승인", "9건"],
      ["반려율", "6.1%"],
    ],
  },
  "/admin/reviews/[id]": {
    headline: "후기 상세 검수",
    overview:
      "개별 후기의 원문, 작성자 이력, 신고 내역을 기반으로 최종 노출 여부를 판단합니다.",
    highlights: [
      "후기 수정 이력과 신고 사유를 함께 확인합니다.",
      "유사 후기 중복 여부를 자동 안내합니다.",
      "검수 결과는 감사 로그로 저장됩니다.",
    ],
    checklist: ["원문 확인", "신고 내역 확인", "노출 여부 결정", "검수 사유 기록"],
    stats: [
      ["후기 번호", "REV-001"],
      ["신고 횟수", "0회"],
      ["현재 상태", "검수 대기"],
    ],
  },
  "/admin/faqs": {
    headline: "FAQ 관리",
    overview:
      "자주 묻는 질문의 카테고리, 노출 상태, 최신성 점검을 관리하는 페이지입니다.",
    highlights: [
      "조회수 기반으로 상위 FAQ를 자동 추천합니다.",
      "카테고리별 최신 업데이트 필요 문서를 식별합니다.",
      "사용자 검색 실패 키워드를 반영해 신규 FAQ를 제안합니다.",
    ],
    checklist: ["카테고리 정리", "노출 상태 점검", "낡은 문서 갱신", "신규 FAQ 등록"],
    stats: [
      ["총 FAQ", "84개"],
      ["업데이트 필요", "7개"],
      ["이번 주 조회수", "3,420회"],
    ],
  },
  "/admin/faqs/[id]": {
    headline: "FAQ 상세 수정",
    overview:
      "FAQ 본문, 키워드, 관련 링크를 편집하고 적용 이력을 관리하는 상세 화면입니다.",
    highlights: [
      "편집 전/후 미리보기로 문서 품질을 확인합니다.",
      "검색 키워드 가중치를 조절해 노출 정확도를 높입니다.",
      "적용 버전과 배포 시점을 기록합니다.",
    ],
    checklist: ["본문 편집", "키워드 업데이트", "관련 링크 점검", "배포 기록 저장"],
    stats: [
      ["FAQ ID", "FAQ-001"],
      ["최근 개정", "2026-04-22"],
      ["검색 우선순위", "상"],
    ],
  },
  "/admin/inquiries": {
    headline: "문의 운영 관리",
    overview:
      "사용자 문의를 유형별로 분류하고 SLA 기준에 맞춰 응대하는 운영 페이지입니다.",
    highlights: [
      "긴급 문의를 우선 큐로 자동 분류합니다.",
      "담당자 할당과 답변 템플릿으로 처리 속도를 높입니다.",
      "답변 지연 경고를 통해 누락 대응을 줄입니다.",
    ],
    checklist: ["긴급 건 선별", "담당자 배정", "답변 작성", "처리 완료 체크"],
    stats: [
      ["미처리 문의", "8건"],
      ["평균 응답 시간", "34분"],
      ["SLA 준수율", "96.4%"],
    ],
  },
  "/admin/inquiries/[id]": {
    headline: "문의 상세 운영",
    overview:
      "문의 전문과 사용자 맥락을 확인하고 정확한 해결 답변을 작성하는 화면입니다.",
    highlights: [
      "사용자 계정/결제/학습 이력을 함께 참고할 수 있습니다.",
      "내부 협업 메모와 공개 답변을 분리해 관리합니다.",
      "처리 완료 후 만족도 조사 링크를 자동 발송합니다.",
    ],
    checklist: ["문의 맥락 파악", "해결 방안 작성", "내부 메모 정리", "처리 완료 전송"],
    stats: [
      ["문의 ID", "ADM-INQ-001"],
      ["우선순위", "높음"],
      ["목표 응답 기한", "오늘 18:00"],
    ],
  },
};

const toneGuideByDomain = {
  auth: {
    coreMessage: "신뢰 가능한 인증 경험으로 학습 시작의 허들을 낮춥니다.",
    primaryTarget: "인증 성공률 98% 이상",
    responseTarget: "인증/로그인 문의 15분 이내",
    qualityRule: "오인증 및 계정 잠금 오탐 최소화",
  },
  legal: {
    coreMessage: "정책 가독성과 투명성으로 신뢰를 확보합니다.",
    primaryTarget: "정책 문서 최신 버전 100% 반영",
    responseTarget: "정책 문의 영업일 1일 이내",
    qualityRule: "개정 이력 누락 0건 유지",
  },
  enroll: {
    coreMessage: "신청부터 결제까지 이탈 없이 완료되는 플로우를 운영합니다.",
    primaryTarget: "신청 완료율 95% 이상",
    responseTarget: "승인 대기 24시간 내 100% 처리",
    qualityRule: "결제 실패 재시도 가이드 즉시 노출",
  },
  learning: {
    coreMessage: "학습 완주율과 합격률에 직접 연결되는 경험을 설계합니다.",
    primaryTarget: "주간 학습 활성률 85% 이상",
    responseTarget: "학습 문의 3시간 이내 응답",
    qualityRule: "취약 단원 추천 정확도 주간 점검",
  },
  support: {
    coreMessage: "빠르고 정확한 응대로 고객의 학습 중단 시간을 최소화합니다.",
    primaryTarget: "SLA 준수율 95% 이상",
    responseTarget: "첫 응답 평균 10분 이내",
    qualityRule: "미해결 티켓 장기 체류 0건 목표",
  },
  admin: {
    coreMessage: "운영 의사결정을 데이터 기반으로 표준화합니다.",
    primaryTarget: "핵심 운영 지표 일일 마감 100%",
    responseTarget: "고위험 이슈 24시간 내 조치",
    qualityRule: "승인/환불/권한 변경 로그 누락 0건",
  },
};

function getDomain(route) {
  if (route.startsWith("/admin")) return "admin";
  if (route.startsWith("/support")) return "support";
  if (route.startsWith("/enroll")) return "enroll";
  if (route.startsWith("/my-courses") || route.startsWith("/mypage")) return "learning";
  if (route === "/terms" || route === "/privacy" || route === "/refund" || route === "/legal")
    return "legal";
  return "auth";
}

function buildRouteDataSource(route, content, toneGuideMap) {
  const domain = getDomain(route);
  const tone = toneGuideMap[domain] || toneGuideMap.auth;
  const metricStatus = ["안정", "주의", "목표"];

  const metrics = content.stats.map(([label, value], index) => ({
    label,
    value,
    target: index === 0 ? tone.primaryTarget : index === 1 ? tone.responseTarget : tone.qualityRule,
    status: metricStatus[index % metricStatus.length],
  }));

  const feed = [
    `${content.headline}: ${tone.coreMessage}`,
    `${content.checklist[0]} 점검 항목이 오늘 운영 우선순위로 지정되었습니다.`,
    `${content.stats[0][0]} 지표를 기준으로 일일 모니터링이 진행 중입니다.`,
  ];

  return {
    domain,
    tone,
    checklist: content.checklist.map((label, index) => ({
      label,
      done: index === 0,
    })),
    metrics,
    feed,
  };
}

const mainNode = document.querySelector(".pm-main");

const operationProfiles = {
  auth: {
    label: "인증/회원",
    owner: "플랫폼 인증팀",
    contact: "auth@passmaster.kr",
    sla: "평균 15분 이내 1차 응답",
    image:
      "https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1400&q=80",
    policies: [
      "본인인증 실패 5회 시 10분 잠금 정책을 적용합니다.",
      "비밀번호 변경/재설정 이벤트는 보안 로그에 180일 보관합니다.",
      "이상 로그인 감지 시 이메일 + SMS 이중 알림을 전송합니다.",
    ],
    feed: [
      "오늘 신규 회원가입 41건 처리",
      "이메일 인증 성공률 98.4%",
      "비밀번호 재설정 요청 7건 모두 완료",
    ],
  },
  legal: {
    label: "정책/컴플라이언스",
    owner: "정책 운영팀",
    contact: "policy@passmaster.kr",
    sla: "영업일 1일 내 정책 문의 회신",
    image:
      "https://images.unsplash.com/photo-1453945619913-79ec89a82c51?auto=format&fit=crop&w=1400&q=80",
    policies: [
      "약관/개인정보/환불 정책은 버전 관리와 개정 이력을 공개합니다.",
      "중요 정책 변경은 최소 30일 전에 공지합니다.",
      "정책 문서는 분기 1회 컴플라이언스 검수를 수행합니다.",
    ],
    feed: [
      "약관 v2.3 배포 완료",
      "환불 정책 FAQ 5건 갱신",
      "개인정보처리 위탁 현황 최신화",
    ],
  },
  enroll: {
    label: "수강 신청",
    owner: "입학/결제 운영팀",
    contact: "enroll@passmaster.kr",
    sla: "평균 승인 22분, 최대 영업일 1일",
    image:
      "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1400&q=80",
    policies: [
      "모집 인원 초과 시 대기번호를 자동 부여합니다.",
      "무통장 입금은 입금자명 일치 후 승인 처리됩니다.",
      "결제 실패 3회 초과 시 고객센터 자동 연결 안내가 표시됩니다.",
    ],
    feed: [
      "오늘 신규 신청 27건",
      "승인 대기 3건",
      "결제 성공률 97.2%",
    ],
  },
  learning: {
    label: "학습/마이페이지",
    owner: "학습 경험팀",
    contact: "learning@passmaster.kr",
    sla: "학습 문의 평균 3시간 내 처리",
    image:
      "https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=1400&q=80",
    policies: [
      "학습 진도는 강의 시청률 90% 이상일 때 완료로 집계합니다.",
      "오답 노트는 최근 30일 기준 우선 복습 큐를 구성합니다.",
      "장기 미접속(7일) 학습자에게 자동 리마인드 알림을 발송합니다.",
    ],
    feed: [
      "주간 평균 학습시간 11시간 20분",
      "완주율 81%",
      "복습 추천 대상 36명",
    ],
  },
  support: {
    label: "고객지원",
    owner: "CS 운영팀",
    contact: "support@passmaster.kr",
    sla: "평균 첫 응답 10분, SLA 준수율 96.4%",
    image:
      "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=1400&q=80",
    policies: [
      "긴급 문의는 우선순위 상으로 분류해 선처리합니다.",
      "답변 완료 후 72시간 내 추가 문의는 동일 티켓으로 병합됩니다.",
      "해결 완료 티켓은 만족도 조사 후 아카이브됩니다.",
    ],
    feed: [
      "금일 처리 문의 42건",
      "처리중 티켓 8건",
      "FAQ 자체 해결률 68%",
    ],
  },
  admin: {
    label: "운영/관리자",
    owner: "운영 총괄실",
    contact: "ops-admin@passmaster.kr",
    sla: "운영 이슈 우선순위 기준 즉시~24시간 처리",
    image:
      "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=1400&q=80",
    policies: [
      "승인/반려/환불 등 상태 변경은 관리자 로그를 필수 기록합니다.",
      "고위험 작업(환불, 권한 변경)은 2단계 확인 절차를 적용합니다.",
      "운영 데이터는 일일 마감 배치로 통계 테이블에 반영됩니다.",
    ],
    feed: [
      "오늘 관리자 처리 건수 119건",
      "결제 예외 대응 2건",
      "후기 검수 대기 11건",
    ],
  },
};

const routeActions = {
  "/register": [
    ["본인인증 시작", "./verify-email.html"],
    ["약관 · 법적 고지", "./legal.html#terms"],
  ],
  "/verify-email": [
    ["온보딩 이동", "./onboarding.html"],
    ["회원가입으로", "./register.html"],
  ],
  "/onboarding": [
    ["수강신청 시작", "./enroll/index.html"],
    ["대시보드 보기", "./my-courses/index.html"],
  ],
  "/forgot-password": [
    ["재설정 페이지", "./reset-password.html"],
    ["로그인으로", "./login.html"],
  ],
  "/reset-password": [
    ["로그인으로", "./login.html"],
    ["고객센터 문의", "./support/index.html"],
  ],
  "/terms": [
    ["통합 법적 고지", "./legal.html#terms"],
    ["개인정보처리방침", "./legal.html#privacy"],
  ],
  "/privacy": [
    ["이용약관", "./legal.html#terms"],
    ["환불정책", "./legal.html#refund"],
  ],
  "/refund": [
    ["통합 법적 고지", "./legal.html#refund"],
    ["문의 접수", "./support/inquiry/new/index.html"],
  ],
  "/legal": [
    ["메인으로", "./index.html"],
    ["고객센터", "./support/index.html"],
  ],
  "/enroll": [
    ["모집 상세 (예시)", "./opening/index.html?openingId=1"],
    ["FAQ", "../support/faq/index.html"],
  ],
  "/enroll/[openingId]": [
    ["신청서 작성", "../apply/index.html"],
    ["결제 안내", "../payment/index.html"],
  ],
  "/enroll/apply": [
    ["과정 목록", "../index.html"],
    ["로그인", "../../login.html"],
  ],
  "/enroll/payment": [
    ["신청 완료", "../complete/index.html"],
    ["결제 문의", "../../support/inquiry/new/index.html"],
  ],
  "/enroll/complete": [
    ["내 강의 이동", "../../my-courses/index.html"],
    ["마이페이지", "../../mypage/index.html"],
  ],
  "/my-courses": [
    ["수강 상세", "./enrollment-001/index.html"],
    ["학습 분석", "../mypage/learning/index.html"],
  ],
  "/my-courses/[enrollmentId]": [
    ["학습 대시보드", "../index.html"],
    ["문의 등록", "../../support/inquiry/new/index.html"],
  ],
  "/support": [
    ["FAQ 바로가기", "./faq/index.html"],
    ["1:1 문의", "./inquiry/new/index.html"],
  ],
  "/support/faq": [
    ["문의 작성", "../inquiry/new/index.html"],
    ["고객센터 홈", "../index.html"],
  ],
  "/support/inquiry": [
    ["새 문의 등록", "./new/index.html"],
    ["문의 상세", "./detail-001.html"],
  ],
  "/support/inquiry/new": [
    ["문의 목록", "../index.html"],
    ["고객센터 홈", "../../index.html"],
  ],
  "/support/inquiry/[id]": [
    ["추가 문의", "./new/index.html"],
    ["내 문의 내역", "../../../mypage/inquiries/index.html"],
  ],
  "/admin": [
    ["강의 관리", "./courses/index.html"],
    ["문의 관리", "./inquiries/index.html"],
  ],
  "/admin/courses": [
    ["강의 등록", "./new/index.html"],
    ["강의 상세", "./detail-001.html"],
  ],
  "/admin/courses/new": [
    ["강의 목록", "../index.html"],
    ["관리자 홈", "../../index.html"],
  ],
  "/admin/courses/[id]": [
    ["수강신청 관리", "../enrollments/index.html"],
    ["학습 운영", "../learning/index.html"],
  ],
  "/admin/enrollments": [
    ["상세 검토", "./detail-001.html"],
    ["결제 관리", "../payments/index.html"],
  ],
  "/admin/enrollments/[id]": [
    ["신청 목록", "./index.html"],
    ["회원 상세", "../users/detail-001.html"],
  ],
  "/admin/payments": [
    ["결제 상세", "./detail-001.html"],
    ["환불정책", "../../legal.html#refund"],
  ],
  "/admin/payments/[id]": [
    ["결제 목록", "./index.html"],
    ["문의 상세", "../inquiries/detail-001.html"],
  ],
  "/admin/learning": [
    ["학습 상세", "./detail-001.html"],
    ["후기 관리", "../reviews/index.html"],
  ],
  "/admin/learning/[id]": [
    ["학습 목록", "./index.html"],
    ["회원 상세", "../users/detail-001.html"],
  ],
  "/admin/users": [
    ["회원 상세", "./detail-001.html"],
    ["문의 운영", "../inquiries/index.html"],
  ],
  "/admin/users/[id]": [
    ["회원 목록", "./index.html"],
    ["결제 상세", "../payments/detail-001.html"],
  ],
  "/admin/reviews": [
    ["후기 상세", "./detail-001.html"],
    ["FAQ 관리", "../faqs/index.html"],
  ],
  "/admin/reviews/[id]": [
    ["후기 목록", "./index.html"],
    ["강의 상세", "../courses/detail-001.html"],
  ],
  "/admin/faqs": [
    ["FAQ 상세", "./detail-001.html"],
    ["고객 문의", "../inquiries/index.html"],
  ],
  "/admin/faqs/[id]": [
    ["FAQ 목록", "./index.html"],
    ["고객센터", "../../support/index.html"],
  ],
  "/admin/inquiries": [
    ["문의 상세", "./detail-001.html"],
    ["회원 관리", "../users/index.html"],
  ],
  "/admin/inquiries/[id]": [
    ["문의 목록", "./index.html"],
    ["문의 템플릿", "../faqs/detail-001.html"],
  ],
};

const defaultDomainRecordSets = {
  auth: {
    title: "인증 운영 로그",
    columns: ["시각", "이벤트", "채널", "결과"],
    rows: [
      ["09:12", "이메일 인증 코드 발송", "이메일", "성공"],
      ["10:04", "소셜 로그인 신규 연동", "구글 OAuth", "성공"],
      ["11:26", "비밀번호 재설정 요청", "이메일", "처리 완료"],
    ],
    note: "보안 이벤트는 감사 로그 정책에 따라 별도 저장됩니다.",
  },
  legal: {
    title: "정책 변경 이력",
    columns: ["버전", "문서", "변경 내용", "적용일"],
    rows: [
      ["v2.3", "이용약관", "환불 절차 문구 명확화", "2026-04-22"],
      ["v1.9", "개인정보처리방침", "위탁 항목 업데이트", "2026-04-17"],
      ["v1.4", "환불정책", "부분환불 기준 세분화", "2026-04-03"],
    ],
    note: "중요 정책 변경은 최소 30일 전 사전 고지됩니다.",
  },
  enroll: {
    title: "수강신청 처리 내역",
    columns: ["신청번호", "과정", "결제상태", "승인상태"],
    rows: [
      ["ENR-2041", "산업안전기사", "결제완료", "승인완료"],
      ["ENR-2042", "전기기사", "결제완료", "승인대기"],
      ["ENR-2043", "정보처리기사", "입금확인중", "검수중"],
    ],
    note: "승인 대기 건은 영업일 기준 24시간 내 처리합니다.",
  },
  learning: {
    title: "학습 운영 로그",
    columns: ["회원", "과정", "진도율", "최근학습"],
    rows: [
      ["김OO", "전기기사", "72%", "오늘 10:20"],
      ["박OO", "산업안전기사", "64%", "오늘 08:55"],
      ["이OO", "정보처리기사", "81%", "어제 22:14"],
    ],
    note: "7일 미접속 수강생은 자동 리마인드 대상에 포함됩니다.",
  },
  support: {
    title: "문의 처리 현황",
    columns: ["티켓번호", "유형", "상태", "최종업데이트"],
    rows: [
      ["CS-8812", "결제", "처리중", "오늘 14:21"],
      ["CS-8813", "학습", "답변완료", "오늘 13:58"],
      ["CS-8814", "계정", "접수", "오늘 13:11"],
    ],
    note: "긴급 티켓은 우선순위 상으로 자동 분류됩니다.",
  },
  admin: {
    title: "운영 핵심 레코드",
    columns: ["작업ID", "작업영역", "담당자", "상태"],
    rows: [
      ["OPS-511", "수강승인", "운영팀 김OO", "완료"],
      ["OPS-512", "결제예외", "정산팀 박OO", "진행중"],
      ["OPS-513", "문의배정", "CS팀 이OO", "완료"],
    ],
    note: "고위험 작업은 2단계 승인 절차를 거쳐 반영됩니다.",
  },
};

function getProfile(route, profileMap) {
  const domain = getDomain(route);
  return profileMap[domain] || profileMap.auth;
}

function buildFallbackRecordSet(content, currentData) {
  return {
    title: "페이지 운영 레코드",
    columns: ["구분", "항목", "값", "비고"],
    rows: currentData.metrics.map((metric, index) => [
      index === 0 ? "핵심" : index === 1 ? "모니터링" : "점검",
      metric.label,
      metric.value,
      metric.target,
    ]),
    note: `${content.headline} 페이지는 구조화된 데이터 소스로 운영 항목을 관리합니다.`,
  };
}

function buildGeneratedRouteRecordSet(route, domain, content, currentData) {
  if (route === "/register") {
    return {
      title: "회원가입 접수 로그",
      columns: ["가입채널", "신규회원", "인증완료", "전환율"],
      rows: [
        ["이메일", "28명", "26명", "92.8%"],
        ["카카오", "17명", "17명", "100%"],
        ["구글", "9명", "8명", "88.9%"],
      ],
      note: "소셜 가입 전환율은 일일 기준으로 모니터링됩니다.",
    };
  }

  if (route === "/verify-email") {
    return {
      title: "이메일 인증 처리 현황",
      columns: ["시간대", "발송건수", "성공건수", "실패사유 TOP1"],
      rows: [
        ["09:00-11:00", "42건", "40건", "메일함 지연"],
        ["11:00-13:00", "37건", "36건", "코드 만료"],
        ["13:00-15:00", "48건", "47건", "스팸함 분류"],
      ],
      note: "인증 실패 유형은 고객 안내 문구 개선에 반영됩니다.",
    };
  }

  if (route.startsWith("/support/inquiry")) {
    return {
      title: "문의 티켓 타임라인",
      columns: ["티켓번호", "문의유형", "현재상태", "응답 SLA"],
      rows: [
        ["CS-9041", "결제", "처리중", "10분 이내"],
        ["CS-9042", "계정", "답변완료", "준수"],
        ["CS-9043", "학습진도", "접수", "대기 4분"],
      ],
      note: "접수 후 30분 초과 미응답 티켓은 자동 알림이 발송됩니다.",
    };
  }

  if (route.startsWith("/admin/payments")) {
    return {
      title: "결제 예외 모니터링",
      columns: ["거래ID", "이슈유형", "조치상태", "담당자"],
      rows: [
        ["PAY-7701", "중복승인", "검토중", "정산팀 박OO"],
        ["PAY-7702", "PG 타임아웃", "재처리완료", "정산팀 정OO"],
        ["PAY-7703", "부분취소 요청", "승인대기", "운영팀 이OO"],
      ],
      note: "결제 예외는 고위험 작업으로 2단계 검수를 수행합니다.",
    };
  }

  if (route.startsWith("/admin/enrollments")) {
    return {
      title: "수강승인 검토 큐",
      columns: ["신청번호", "과정", "제출상태", "처리상태"],
      rows: [
        ["ENR-3101", "산업안전기사", "완료", "승인대기"],
        ["ENR-3102", "전기기사", "보완요청", "검토중"],
        ["ENR-3103", "정보처리기사", "완료", "승인완료"],
      ],
      note: "승인 대기 건은 영업일 24시간 내 처리를 목표로 운영합니다.",
    };
  }

  if (route.startsWith("/admin/users")) {
    return {
      title: "회원 상태 관리",
      columns: ["회원ID", "계정상태", "최근활동", "조치필요"],
      rows: [
        ["USR-4401", "활성", "오늘 11:42", "없음"],
        ["USR-4402", "휴면", "31일 전", "리마인드 발송"],
        ["USR-4403", "제한", "오늘 09:20", "권한 재검토"],
      ],
      note: "권한 변경 및 제재 이력은 감사 로그로 관리됩니다.",
    };
  }

  if (route.startsWith("/admin/reviews")) {
    return {
      title: "후기 검수 대기열",
      columns: ["후기ID", "신뢰도점수", "검수상태", "노출여부"],
      rows: [
        ["REV-2201", "96", "검수대기", "미노출"],
        ["REV-2202", "91", "승인완료", "노출중"],
        ["REV-2203", "74", "재검수", "보류"],
      ],
      note: "광고성 문구 탐지 결과가 낮은 후기부터 우선 검수합니다.",
    };
  }

  if (route.startsWith("/admin/faqs")) {
    return {
      title: "FAQ 운영 현황",
      columns: ["문서ID", "카테고리", "조회수(7일)", "업데이트 필요"],
      rows: [
        ["FAQ-1101", "결제", "842", "아니오"],
        ["FAQ-1102", "로그인", "761", "아니오"],
        ["FAQ-1103", "환불", "699", "예"],
      ],
      note: "업데이트 필요 문서는 주간 운영 회의에서 우선 반영됩니다.",
    };
  }

  if (route.startsWith("/admin/inquiries")) {
    return {
      title: "운영 문의 배정 현황",
      columns: ["문의ID", "우선순위", "담당자", "처리기한"],
      rows: [
        ["ADM-INQ-901", "높음", "CS팀 김OO", "오늘 17:30"],
        ["ADM-INQ-902", "중간", "CS팀 박OO", "오늘 18:20"],
        ["ADM-INQ-903", "높음", "운영팀 이OO", "오늘 16:50"],
      ],
      note: "높음 우선순위 문의는 30분 단위로 진행상태를 업데이트합니다.",
    };
  }

  if (route.startsWith("/mypage/payments")) {
    return {
      title: "개인 결제 이력",
      columns: ["결제일", "과정", "결제금액", "상태"],
      rows: [
        ["2026-04-20", "전기기사 필기", "189,000원", "결제완료"],
        ["2026-03-05", "산업안전기사 필기", "219,000원", "결제완료"],
        ["2026-02-12", "정보처리기사 필기", "149,000원", "환불완료"],
      ],
      note: "전자영수증은 결제내역 상세에서 다운로드할 수 있습니다.",
    };
  }

  if (route.startsWith("/mypage/enrollments")) {
    return {
      title: "내 신청 상태",
      columns: ["신청번호", "과정", "승인상태", "학습시작일"],
      rows: [
        ["ENR-2991", "전기기사 필기", "승인완료", "2026-05-10"],
        ["ENR-2992", "산업안전기사 필기", "승인대기", "승인 후 확정"],
        ["ENR-2993", "정보처리기사 필기", "수강완료", "2026-03-02"],
      ],
      note: "승인 대기 건은 처리 즉시 문자/메일로 안내됩니다.",
    };
  }

  if (route.startsWith("/mypage/inquiries")) {
    return {
      title: "내 문의 진행 현황",
      columns: ["문의번호", "유형", "상태", "최근답변"],
      rows: [
        ["CS-7001", "결제", "답변완료", "오늘 12:41"],
        ["CS-7002", "학습", "처리중", "오늘 11:09"],
        ["CS-7003", "계정", "접수", "대기중"],
      ],
      note: "답변완료 문의는 추가 질문 시 동일 티켓으로 이어집니다.",
    };
  }

  if (route.startsWith("/my-courses")) {
    return {
      title: "강의 진도 레코드",
      columns: ["강의명", "진도율", "퀴즈점수", "복습필요"],
      rows: [
        ["회로이론 핵심 1", "82%", "18/20", "아니오"],
        ["전기자기학 기출 3", "61%", "13/20", "예"],
        ["전력공학 모의 2", "75%", "16/20", "예"],
      ],
      note: "복습 필요 강의는 대시보드 상단 추천에 우선 노출됩니다.",
    };
  }

  if (route.startsWith("/enroll")) {
    return {
      title: "신청 전환 퍼널",
      columns: ["단계", "유입수", "완료수", "전환율"],
      rows: [
        ["과정조회", "412", "412", "100%"],
        ["신청서작성", "322", "301", "93.5%"],
        ["결제완료", "301", "287", "95.3%"],
      ],
      note: "결제 이탈 구간은 주간 A/B 테스트로 개선합니다.",
    };
  }

  return buildFallbackRecordSet(content, currentData);
}

function mergeObjects(baseValue, overrideValue) {
  if (Array.isArray(baseValue)) {
    return Array.isArray(overrideValue) ? overrideValue : [...baseValue];
  }
  if (typeof baseValue === "object" && baseValue !== null) {
    const result = { ...baseValue };
    if (typeof overrideValue === "object" && overrideValue !== null && !Array.isArray(overrideValue)) {
      Object.keys(overrideValue).forEach((key) => {
        const baseChild = result[key];
        const overrideChild = overrideValue[key];
        if (typeof baseChild === "object" && baseChild !== null && !Array.isArray(baseChild)) {
          result[key] = mergeObjects(baseChild, overrideChild);
        } else if (Array.isArray(baseChild)) {
          result[key] = Array.isArray(overrideChild) ? overrideChild : [...baseChild];
        } else {
          result[key] = overrideChild;
        }
      });
    }
    return result;
  }
  return overrideValue === undefined ? baseValue : overrideValue;
}

function getSharedScriptUrl() {
  const scriptNode = Array.from(document.scripts).find(
    (script) => script.src && script.src.includes("/assets/shared.js")
  );
  return scriptNode ? scriptNode.src : "";
}

function buildSiteDataFromChunks(chunks) {
  return (chunks || []).reduce((acc, chunk) => mergeObjects(acc, chunk || {}), {});
}

function loadScript(url) {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = url;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
}

function loadQuestionBankData() {
  return new Promise((resolve) => {
    const existing = window.PASSMASTER_QUESTION_BANK;
    if (existing) {
      resolve(existing);
      return;
    }

    const sharedScriptUrl = getSharedScriptUrl();
    const questionBankUrl = sharedScriptUrl
      ? new URL("data/question-bank/passmaster-question-bank.js", sharedScriptUrl).toString()
      : "./assets/data/question-bank/passmaster-question-bank.js";

    loadScript(questionBankUrl).then(() => {
      resolve(window.PASSMASTER_QUESTION_BANK || null);
    });
  });
}

function buildQuestionBankSummary(questionBank) {
  if (!questionBank || !Array.isArray(questionBank.questions) || questionBank.questions.length === 0) {
    return null;
  }

  const total = questionBank.questions.length;
  const subjectCounter = {};
  const difficultyCounter = {};

  questionBank.questions.forEach((item) => {
    const subject = item.subjectName || item.subjectCode || "기타";
    const difficulty = item.difficulty || "중";
    subjectCounter[subject] = (subjectCounter[subject] || 0) + 1;
    difficultyCounter[difficulty] = (difficultyCounter[difficulty] || 0) + 1;
  });

  const subjectRows = Object.entries(subjectCounter)
    .sort((a, b) => b[1] - a[1])
    .map(([subject, count]) => [subject, `${count}문항`]);

  const difficultyRows = Object.entries(difficultyCounter)
    .sort((a, b) => a[0].localeCompare(b[0], "ko"))
    .map(([level, count]) => [level, `${count}문항`]);

  return {
    version: questionBank.version || "v1",
    total,
    subjectRows,
    difficultyRows,
    latestRound: questionBank.latestRound || "2026-1회",
  };
}

function loadLiveApiData(route) {
  const defaultRemoteApiBase = "https://passmaster-26-05.onrender.com/api";
  const isLocalHost =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const isFileProtocol = window.location.protocol === "file:";
  const isGitHubPages = /\.github\.io$/i.test(window.location.hostname);
  const apiBase =
    window.PASSMASTER_API_BASE ||
    (isLocalHost || isFileProtocol
      ? "http://localhost:4000/api"
      : isGitHubPages
        ? defaultRemoteApiBase
        : "/api");
  const sessionRaw = localStorage.getItem("passmaster_auth");
  let token = "";
  if (sessionRaw) {
    try {
      const session = JSON.parse(sessionRaw);
      token = session && session.token ? session.token : "";
    } catch (_error) {
      token = "";
    }
  }

  const fetchJson = (url) =>
    fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        return response.json();
      })
      .catch(() => null);

  const fetchAuthJson = (url) =>
    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed: ${response.status}`);
        return response.json();
      })
      .catch(() => null);

  if (route.startsWith("/admin")) {
    return fetchAuthJson(`${apiBase}/admin/dashboard`).then((dashboard) => ({
      title: "실DB 연동 상태",
      columns: ["항목", "값"],
      rows: dashboard
        ? [
            ["회원 수", String(dashboard.users)],
            ["운영 과정 수", String(dashboard.courses)],
            ["수강 신청 건수", String(dashboard.enrollments)],
            ["미처리 문의", String(dashboard.openInquiries)],
          ]
        : [],
      note: dashboard
        ? "로컬 SQLite DB에서 조회된 실시간 운영 지표입니다."
        : "관리자 인증 토큰 또는 API 서버 상태를 확인해 주세요. (http://localhost:4000)",
    }));
  }

  if (route.startsWith("/enroll")) {
    return fetchJson(`${apiBase}/course-openings`).then((openings) => {
      const list = Array.isArray(openings) ? openings : [];
      return {
        title: "실DB 모집(오프닝) 목록",
        columns: ["모집ID", "과정명", "기간", "신청상태", "가격"],
        rows: list.slice(0, 8).map((o) => [
          String(o.id),
          o.course_title || "-",
          `${o.start_date || "-"} ~ ${o.end_date || "-"}`,
          o.application_status || "-",
          `${Number(o.price || 0).toLocaleString("ko-KR")}원`,
        ]),
        note: list.length
          ? "course_openings + courses 조인 결과입니다."
          : "API 서버 연결 실패이거나 모집 데이터가 없습니다.",
      };
    });
  }

  if (route.startsWith("/support")) {
    return fetchJson(`${apiBase}/inquiries?page=1&pageSize=5`).then((payload) => {
      const inquiries = Array.isArray(payload) ? payload : payload && payload.items ? payload.items : [];
      return {
        title: "실DB 문의 목록",
        columns: ["문의번호", "유형", "제목", "상태"],
        rows: inquiries.map((item) => [
          `INQ-${item.id}`,
          item.type,
          item.title,
          item.status,
        ]),
        note: inquiries.length
          ? "inquiries 테이블 연동 결과입니다."
          : "API 서버 연결 실패로 정적 데이터가 표시됩니다.",
      };
    });
  }

  return Promise.resolve(null);
}

function loadExternalSiteData() {
  return new Promise((resolve) => {
    const existing = window.PASSMASTER_SITE_DATA;
    if (existing) {
      resolve(existing);
      return;
    }

    const sharedScriptUrl = getSharedScriptUrl();
    const dataBaseUrl = sharedScriptUrl
      ? new URL("data/", sharedScriptUrl).toString()
      : "./assets/data/";

    const dataFiles = [
      "site-data.base.js",
      "site-data.auth.js",
      "site-data.legal.js",
      "site-data.enroll.js",
      "site-data.learning.js",
      "site-data.support.js",
      "site-data.admin.js",
    ];

    const urls = dataFiles.map((file) =>
      sharedScriptUrl ? new URL(file, dataBaseUrl).toString() : `${dataBaseUrl}${file}`
    );

    urls
      .reduce((chain, url) => chain.then(() => loadScript(url)), Promise.resolve())
      .then(() => {
        const loaded = window.PASSMASTER_SITE_DATA;
        if (loaded) {
          resolve(loaded);
          return;
        }

        const chunks = window.PASSMASTER_SITE_DATA_CHUNKS || [];
        const merged = buildSiteDataFromChunks(chunks);
        window.PASSMASTER_SITE_DATA = merged;
        resolve(merged);
      })
      .catch(() => resolve({}));
  });
}

function renderPage(siteData, questionBank, liveApiData) {
  const mergedToneGuide = mergeObjects(toneGuideByDomain, siteData.toneGuideByDomain || {});
  const mergedRouteContent = mergeObjects(routeContent, siteData.routeContent || {});
  const mergedProfiles = mergeObjects(operationProfiles, siteData.operationProfiles || {});
  const mergedActions = mergeObjects(routeActions, siteData.routeActions || {});
  const mergedDomainRecordSets = mergeObjects(
    defaultDomainRecordSets,
    siteData.domainRecordSets || {}
  );
  const mergedRouteRecordSets = mergeObjects({}, siteData.routeRecordSets || {});
  const routeDataSource = Object.fromEntries(
    Object.entries(mergedRouteContent).map(([route, content]) => [
      route,
      buildRouteDataSource(route, content, mergedToneGuide),
    ])
  );

  const content = mergedRouteContent[pageRoute];
  const currentData = routeDataSource[pageRoute];

  if (!content || !currentData || !mainNode) return;

  const profile = getProfile(pageRoute, mergedProfiles);

  const hero = document.createElement("section");
  hero.className = "pm-card pm-ops-hero";
  hero.innerHTML = `
    <div class="pm-ops-hero-media">
      <img src="${profile.image}" alt="${profile.label} 운영 이미지" loading="lazy" />
    </div>
    <div class="pm-ops-hero-body">
      <p class="pm-ops-kicker">${profile.label}</p>
      <h2>${content.headline}</h2>
      <p class="pm-detail">${content.overview}</p>
      <p class="pm-brand-note">${currentData.tone.coreMessage}</p>
      <div class="pm-chip-row">
        <span class="pm-chip">담당: ${profile.owner}</span>
        <span class="pm-chip">문의: ${profile.contact}</span>
        <span class="pm-chip">SLA: ${profile.sla}</span>
      </div>
    </div>
  `;

  const operations = document.createElement("section");
  operations.className = "pm-card";
  operations.innerHTML = `
    <h2>실제 운영 기준</h2>
    <ul class="pm-bullet-list">
      ${profile.policies.map((item) => `<li>${item}</li>`).join("")}
      ${content.highlights.map((item) => `<li>${item}</li>`).join("")}
    </ul>
  `;

  const checklist = document.createElement("section");
  checklist.className = "pm-card";
  checklist.innerHTML = `
    <h2>실행 체크리스트</h2>
    <div class="pm-check-grid">
      ${currentData.checklist
        .map(
          (item) => `
            <label class="pm-check-item">
              <input type="checkbox" ${item.done ? "checked" : ""} />
              <span>${item.label}</span>
            </label>
          `
        )
        .join("")}
    </div>
  `;

  const metrics = document.createElement("section");
  metrics.className = "pm-card";
  metrics.innerHTML = `
    <h2>운영 데이터</h2>
    <div class="pm-table-wrap">
      <table class="pm-table" aria-label="운영 데이터 표">
        <thead>
          <tr>
            <th>지표</th>
            <th>현재값</th>
            <th>운영 기준</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          ${currentData.metrics
            .map(
              (metric) => `
                <tr>
                  <td>${metric.label}</td>
                  <td>${metric.value}</td>
                  <td>${metric.target}</td>
                  <td><span class="pm-status-chip">${metric.status}</span></td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;

  const feed = document.createElement("section");
  feed.className = "pm-card";
  feed.innerHTML = `
    <h2>실시간 운영 브리핑</h2>
    <ul class="pm-feed-list">
      ${profile.feed.map((item) => `<li>${item}</li>`).join("")}
      ${currentData.feed.map((item) => `<li>${item}</li>`).join("")}
    </ul>
  `;

  const actionSet = mergedActions[pageRoute] || [
    ["메인 이동", "../index.html"],
    ["고객센터", "../support/index.html"],
  ];
  const actions = document.createElement("section");
  actions.className = "pm-card";
  actions.innerHTML = `
    <h2>즉시 실행</h2>
    <div class="pm-action-row">
      ${actionSet
        .map(
          ([label, href], index) =>
            `<a class="pm-btn ${index === 0 ? "pm-btn-primary" : "pm-btn-ghost"}" href="${href}">${label}</a>`
        )
        .join("")}
    </div>
  `;

  const recordSet =
    mergedRouteRecordSets[pageRoute] ||
    mergedDomainRecordSets[currentData.domain] ||
    buildGeneratedRouteRecordSet(pageRoute, currentData.domain, content, currentData);

  const recordsCard = document.createElement("section");
  recordsCard.className = "pm-card";
  recordsCard.innerHTML = `
    <h2>${recordSet.title}</h2>
    <div class="pm-table-wrap">
      <table class="pm-table" aria-label="운영 레코드 표">
        <thead>
          <tr>
            ${recordSet.columns.map((column) => `<th>${column}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${recordSet.rows
            .map(
              (row) => `
                <tr>
                  ${row.map((cell) => `<td>${cell}</td>`).join("")}
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <p class="pm-record-note">${recordSet.note}</p>
  `;

  const dataSourceCard = document.createElement("section");
  dataSourceCard.className = "pm-card";
  dataSourceCard.innerHTML = `
    <h2>운영 데이터 소스</h2>
    <p class="pm-detail">페이지별 운영 데이터는 구조화된 데이터 소스에서 관리되며, UI는 이 소스를 렌더링합니다.</p>
    <details class="pm-json-box">
      <summary>JSON 미리보기</summary>
      <pre>${JSON.stringify(currentData, null, 2)}</pre>
    </details>
  `;

  const bankSummary = buildQuestionBankSummary(questionBank);
  const bankCard = document.createElement("section");
  bankCard.className = "pm-card";
  bankCard.innerHTML = bankSummary
    ? `
      <h2>문제은행 운영 현황</h2>
      <p class="pm-detail">버전 ${bankSummary.version} · 기준 회차 ${bankSummary.latestRound} · 총 ${bankSummary.total}문항</p>
      <div class="pm-table-wrap">
        <table class="pm-table" aria-label="문제은행 과목별 현황 표">
          <thead>
            <tr><th>과목</th><th>문항 수</th></tr>
          </thead>
          <tbody>
            ${bankSummary.subjectRows.map(([name, count]) => `<tr><td>${name}</td><td>${count}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div class="pm-table-wrap" style="margin-top: 10px;">
        <table class="pm-table" aria-label="문제은행 난이도별 현황 표">
          <thead>
            <tr><th>난이도</th><th>문항 수</th></tr>
          </thead>
          <tbody>
            ${bankSummary.difficultyRows.map(([level, count]) => `<tr><td>${level}</td><td>${count}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>
      <p class="pm-record-note">문항 데이터는 정적 파일로 분리되어 있으며, 파일 교체만으로 즉시 업데이트할 수 있습니다.</p>
    `
    : `
      <h2>문제은행 운영 현황</h2>
      <p class="pm-detail">문제은행 데이터 파일이 로드되지 않았습니다. <code>assets/data/question-bank/passmaster-question-bank.js</code>를 확인해 주세요.</p>
    `;

  const liveCard = document.createElement("section");
  liveCard.className = "pm-card";
  liveCard.innerHTML =
    liveApiData && Array.isArray(liveApiData.rows) && liveApiData.rows.length
      ? `
      <h2>${liveApiData.title}</h2>
      <div class="pm-table-wrap">
        <table class="pm-table" aria-label="실DB 연동 표">
          <thead><tr>${liveApiData.columns.map((column) => `<th>${column}</th>`).join("")}</tr></thead>
          <tbody>
            ${liveApiData.rows
              .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
              .join("")}
          </tbody>
        </table>
      </div>
      <p class="pm-record-note">${liveApiData.note}</p>
    `
      : `
      <h2>실DB 연동 상태</h2>
      <p class="pm-detail">${
        liveApiData && liveApiData.note
          ? liveApiData.note
          : "현재 페이지는 정적 콘텐츠 중심으로 표시됩니다."
      }</p>
    `;

  mainNode.append(
    hero,
    operations,
    checklist,
    metrics,
    recordsCard,
    feed,
    actions,
    bankCard,
    liveCard,
    dataSourceCard
  );
}

function getAuthSession() {
  try {
    const raw = localStorage.getItem("passmaster_auth");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.user) return null;
    if (parsed.expiresAt && new Date(parsed.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem("passmaster_auth");
      return null;
    }
    return parsed;
  } catch (_error) {
    return null;
  }
}

function getLoginHref() {
  const loginLink = document.querySelector(".pm-nav a[href*='login.html']");
  return loginLink ? loginLink.getAttribute("href") : "./login.html";
}

function buildReturnToValue() {
  const path = (window.location.pathname || "").replace(/\\/g, "/");
  const search = window.location.search || "";
  return `${path}${search}`;
}

function redirectToLoginWithReturnTo(reasonMessage) {
  if (reasonMessage) alert(reasonMessage);
  const loginHref = getLoginHref() || "./login.html";
  const returnTo = buildReturnToValue();
  try {
    sessionStorage.setItem("passmaster_return_to", returnTo);
  } catch (_error) {
    // ignore
  }

  const url = new URL(loginHref, window.location.href);
  url.searchParams.set("returnTo", returnTo);
  window.location.href = url.toString();
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function getCanonicalAdminEmail() {
  return normalizeEmail("sanahai@naver.com");
}

function isStrictAdminSession(session) {
  if (!session || !session.user) return false;
  const user = session.user;
  return user.role === "admin" && normalizeEmail(user.email) === getCanonicalAdminEmail();
}

function updateNavigationByAuth(session) {
  const loginLink = document.querySelector(".pm-nav a[href*='login.html']");
  const registerLink = document.querySelector(".pm-nav a[href*='register.html']");
  if (!loginLink || !registerLink) return;
  const logoLink = document.querySelector(".pm-logo");
  const navLinks = Array.from(document.querySelectorAll(".pm-nav a"));
  const adminLinks = navLinks.filter((link) => {
    if (link === registerLink) return false;
    const href = String(link.getAttribute("href") || "")
      .replace(/\\/g, "/")
      .toLowerCase();
    const text = String(link.textContent || "").trim();
    return (
      text === "관리자" ||
      href.includes("/admin/") ||
      href.endsWith("/admin") ||
      href.includes("admin/index.html")
    );
  });
  const pagesLink = document.querySelector(".pm-nav a[href*='pages.html']");
  const enrollLink = document.querySelector(".pm-nav a[href*='enroll/index.html']");
  const myCoursesLink = document.querySelector(".pm-nav a[href*='my-courses/index.html']");

  if (!session || !session.user) {
    loginLink.textContent = "로그인";
    registerLink.textContent = "회원가입";
    adminLinks.forEach((link) => {
      link.style.display = "none";
    });
    if (pagesLink) pagesLink.style.display = "none";
    return;
  }

  adminLinks.forEach((link) => {
    link.style.display = "none";
  });

  if (isStrictAdminSession(session)) {
    const originalRegisterHref = registerLink.getAttribute("href") || "./register.html";
    const adminHref = originalRegisterHref.replace("register.html", "admin/index.html");
    const originalLoginHref = loginLink.getAttribute("href") || "./login.html";
    loginLink.textContent = "로그아웃";
    loginLink.setAttribute("href", "#");
    if (loginLink.dataset.logoutBound !== "1") {
      loginLink.addEventListener("click", (event) => {
        event.preventDefault();
        localStorage.removeItem("passmaster_auth");
        try {
          sessionStorage.removeItem("passmaster_return_to");
        } catch (_error) {
          // ignore
        }
        window.location.href = originalLoginHref;
      });
      loginLink.dataset.logoutBound = "1";
    }
    registerLink.textContent = "관리자";
    registerLink.setAttribute("href", adminHref);
    if (pagesLink) pagesLink.style.display = "";
    return;
  }

  const homeHref = logoLink ? logoLink.getAttribute("href") || "./index.html" : "./index.html";
  const originalRegisterHref = registerLink.getAttribute("href") || "./register.html";
  const myInfoHref = originalRegisterHref.replace("register.html", "mypage/index.html");
  loginLink.textContent = "HOME";
  loginLink.setAttribute("href", homeHref);
  registerLink.textContent = "내정보관리";
  registerLink.setAttribute("href", myInfoHref);
  if (enrollLink) enrollLink.textContent = "수강신청";
  if (myCoursesLink) myCoursesLink.textContent = "내강의";
  if (pagesLink) pagesLink.style.display = "none";
}

function prettifyLinkLabel(href) {
  if (!href) return "페이지";
  const normalized = href.replace(/\\/g, "/").replace(/\/+$/, "");
  const lower = normalized.toLowerCase();
  const exactMap = [
    ["/mypage/enrollments/index.html", "수강현황 보기"],
    ["/mypage/payments/index.html", "결제내역 보기"],
    ["/mypage/learning/index.html", "학습 이어가기"],
    ["/mypage/profile/index.html", "프로필 관리"],
    ["/mypage/notifications/index.html", "알림 확인"],
    ["/mypage/inquiries/index.html", "문의내역 확인"],
    ["/support/faq/index.html", "자주 묻는 질문 보기"],
    ["/support/inquiry/index.html", "문의내역 보기"],
    ["/support/inquiry/new/index.html", "1:1 문의하기"],
    ["/enroll/index.html", "수강신청 하기"],
    ["/my-courses/index.html", "내 강의실로 이동"],
    ["/index.html", "메인으로 이동"],
  ];
  for (const [suffix, label] of exactMap) {
    if (lower.endsWith(suffix)) return label;
  }

  const file = lower.split("/").pop() || "";
  const parent = lower.split("/").slice(-2, -1)[0] || "";
  const base = file.replace(".html", "");
  const fallback = {
    enrollments: "수강현황 보기",
    payments: "결제내역 보기",
    learning: "학습 이어가기",
    profile: "프로필 관리",
    inquiry: "문의 페이지 이동",
    faq: "FAQ 보기",
    enroll: "수강신청 하기",
    support: "고객센터로 이동",
  };
  return fallback[base] || fallback[parent] || "페이지 이동";
}

function applyStudentView() {
  const adminOnlyTitles = new Set([
    "개설 과정 탐색",
    "실제 운영 기준",
    "실행 체크리스트",
    "운영 데이터",
    "실시간 모집 과정 현황",
    "실시간 운영 브리핑",
    "즉시 실행",
    "문제은행 운영 현황",
    "실DB 모집(오프닝) 목록",
    "운영 데이터 소스",
    "모집 중 과정 (API)",
  ]);
  const routeCards = document.querySelectorAll(".pm-card");
  routeCards.forEach((card) => {
    const titleNode = card.querySelector("h2");
    const title = titleNode ? titleNode.textContent.trim() : "";
    if (adminOnlyTitles.has(title)) {
      card.remove();
      return;
    }
    if (title === "현재 경로") {
      card.remove();
      return;
    }
    if (title === "연결 페이지") {
      card.remove();
      return;
    }
  });

  document.querySelectorAll(".pm-route").forEach((node) => node.remove());
}

function enforceProtectedRoute(session) {
  const requiresUser = pageRoute.startsWith("/mypage") || pageRoute.startsWith("/my-courses");
  const requiresAdmin = pageRoute.startsWith("/admin");

  if (!requiresUser && !requiresAdmin) return true;
  if (!session || !session.user) {
    redirectToLoginWithReturnTo("로그인 후 이용 가능한 페이지입니다.");
    return false;
  }

  if (requiresAdmin && !isStrictAdminSession(session)) {
    redirectToLoginWithReturnTo("관리자 권한이 필요한 페이지입니다.");
    return false;
  }

  return true;
}

const authSession = getAuthSession();
updateNavigationByAuth(authSession);

if (enforceProtectedRoute(authSession)) {
  const isAdmin = isStrictAdminSession(authSession);
  if (isAdmin && pageRoute.startsWith("/admin")) {
    Promise.all([loadExternalSiteData(), loadQuestionBankData(), loadLiveApiData(pageRoute)]).then(
      ([siteData, questionBank, liveApiData]) => {
        renderPage(siteData || {}, questionBank || null, liveApiData || null);
      }
    );
  } else {
    applyStudentView();
  }
}

const pathName = window.location.pathname.replace(/\\/g, "/");
document.querySelectorAll(".pm-nav a").forEach((link) => {
  const href = link.getAttribute("href");
  if (!href) return;
  const normalizedHref = href.replace(/\\/g, "/").replace(/\/$/, "");
  if (normalizedHref && pathName.endsWith(normalizedHref)) {
    link.classList.add("active");
  }
});

function injectUnifiedFooterMeta() {
  const isGitHubPagesHost = /\.github\.io$/i.test(window.location.hostname || "");
  const normalizedPath = String(window.location.pathname || "").replace(/\\/g, "/");
  const segments = normalizedPath.split("/").filter(Boolean);
  const projectBase =
    isGitHubPagesHost && segments.length && !segments[0].endsWith(".html") ? `/${segments[0]}` : "";
  const withBase = (path) => `${projectBase}${path}`;
  const footerNodes = document.querySelectorAll("footer");
  footerNodes.forEach((footer) => {
    if (footer.classList.contains("footer")) return; // landing page custom footer
    if (footer.querySelector("[data-passmaster-footer-standard]")) return;
    footer.innerHTML = "";
    const links = document.createElement("div");
    links.setAttribute("data-passmaster-footer-standard", "links");
    links.style.display = "flex";
    links.style.flexWrap = "wrap";
    links.style.gap = "8px 14px";
    links.style.width = "100%";
    links.innerHTML = `
      <a href="${withBase("/index.html")}">메인으로</a>
      <a href="${withBase("/support/index.html")}">고객센터</a>
      <a href="${withBase("/legal.html#terms")}">이용약관</a>
      <a href="${withBase("/legal.html#privacy")}">개인정보처리방침</a>
      <a href="${withBase("/legal.html#refund")}">환불정책</a>
    `;
    const meta = document.createElement("p");
    meta.setAttribute("data-passmaster-footer-standard", "meta");
    meta.style.width = "100%";
    meta.style.margin = "8px 0 0";
    meta.style.fontSize = "12px";
    meta.style.color = "#667085";
    meta.textContent =
      "패스마스터 · 정보관리자: 이태나 · 사업자등록번호: 326-58-00636 · 신한은행 이동길 110-623-996861";
    footer.appendChild(links);
    footer.appendChild(meta);
  });
}

injectUnifiedFooterMeta();
