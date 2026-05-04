from __future__ import annotations

import os
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent


def rel_link(from_file: Path, to_file: Path) -> str:
    rel = os.path.relpath(to_file, start=from_file.parent).replace("\\", "/")
    if rel == ".":
        return "./"
    if not rel.startswith("."):
        rel = f"./{rel}"
    return rel


PAGES = [
    # Public pages (index/login already exist)
    {
        "route": "/register",
        "file": "register.html",
        "title": "회원가입",
        "section": "Public",
        "summary": "이메일 또는 소셜 계정으로 PASSmaster 회원가입을 진행합니다.",
        "back": "/",
        "next": "/verify-email",
        "related": ["/login", "/terms", "/privacy"],
    },
    {
        "route": "/verify-email",
        "file": "verify-email.html",
        "title": "이메일 인증",
        "section": "Public",
        "summary": "가입 후 발송된 인증 메일을 확인하고 계정을 활성화합니다.",
        "back": "/register",
        "next": "/onboarding",
        "related": ["/login", "/forgot-password"],
    },
    {
        "route": "/onboarding",
        "file": "onboarding.html",
        "title": "온보딩",
        "section": "Public",
        "summary": "관심 자격증과 학습 목표를 선택하여 맞춤 과정을 추천받습니다.",
        "back": "/verify-email",
        "next": "/enroll",
        "related": ["/my-courses", "/support"],
    },
    {
        "route": "/forgot-password",
        "file": "forgot-password.html",
        "title": "비밀번호 찾기",
        "section": "Public",
        "summary": "가입한 이메일로 비밀번호 재설정 링크를 전송합니다.",
        "back": "/login",
        "next": "/reset-password",
        "related": ["/register", "/support/faq"],
    },
    {
        "route": "/reset-password",
        "file": "reset-password.html",
        "title": "비밀번호 재설정",
        "section": "Public",
        "summary": "새 비밀번호를 입력하고 계정 보안을 다시 설정합니다.",
        "back": "/forgot-password",
        "next": "/login",
        "related": ["/support/inquiry/new"],
    },
    {
        "route": "/terms",
        "file": "terms.html",
        "title": "이용약관",
        "section": "Public",
        "summary": "PASSmaster 이용약관과 서비스 제공 조건을 확인합니다.",
        "back": "/register",
        "next": "/privacy",
        "related": ["/refund", "/support/faq"],
    },
    {
        "route": "/privacy",
        "file": "privacy.html",
        "title": "개인정보처리방침",
        "section": "Public",
        "summary": "수집 항목, 이용 목적, 보관 기간 등 개인정보 정책을 안내합니다.",
        "back": "/terms",
        "next": "/refund",
        "related": ["/support/inquiry/new"],
    },
    {
        "route": "/refund",
        "file": "refund.html",
        "title": "환불정책",
        "section": "Public",
        "summary": "수강 취소 및 환불 기준, 신청 절차를 상세히 확인할 수 있습니다.",
        "back": "/privacy",
        "next": "/support/faq",
        "related": ["/support/inquiry/new", "/mypage/payments"],
    },
    # User pages (20)
    {
        "route": "/enroll",
        "file": "enroll/index.html",
        "title": "수강 신청",
        "section": "User",
        "summary": "오픈된 과정을 확인하고 수강 신청을 시작하는 진입 페이지입니다.",
        "back": "/onboarding",
        "next": "/enroll/[openingId]",
        "related": ["/my-courses", "/support/faq"],
    },
    {
        "route": "/enroll/[openingId]",
        "file": "enroll/opening/index.html",
        "title": "모집 상세",
        "section": "User",
        "summary": "선택한 과정의 모집 요강, 일정, 가격, 환불 조건을 검토합니다.",
        "back": "/enroll",
        "next": "/enroll/apply",
        "related": ["/terms", "/refund"],
    },
    {
        "route": "/enroll/apply",
        "file": "enroll/apply/index.html",
        "title": "수강 신청서",
        "section": "User",
        "summary": "약관 동의 후 신청을 확정하고 결제 안내로 이동합니다.",
        "back": "/enroll/[openingId]",
        "next": "/enroll/payment",
        "related": ["/terms", "/privacy"],
    },
    {
        "route": "/enroll/payment",
        "file": "enroll/payment/index.html",
        "title": "결제 안내",
        "section": "User",
        "summary": "계좌이체 안내와 입금 확인 요청을 진행합니다.",
        "back": "/enroll/apply",
        "next": "/enroll/complete",
        "related": ["/mypage/payments", "/support/inquiry/new"],
    },
    {
        "route": "/enroll/complete",
        "file": "enroll/complete/index.html",
        "title": "신청 완료",
        "section": "User",
        "summary": "수강 신청 완료 상태를 확인하고 학습 시작 페이지로 이동합니다.",
        "back": "/enroll/payment",
        "next": "/my-courses",
        "related": ["/my-courses/[enrollmentId]", "/mypage/enrollments"],
    },
    {
        "route": "/my-courses",
        "file": "my-courses/index.html",
        "title": "내 강의",
        "section": "User",
        "summary": "내가 신청한 모든 강의 목록과 학습 진도를 확인합니다.",
        "back": "/enroll/complete",
        "next": "/my-courses/[enrollmentId]",
        "related": ["/mypage/learning", "/support"],
    },
    {
        "route": "/my-courses/[enrollmentId]",
        "file": "my-courses/enrollment-001/index.html",
        "title": "강의 상세",
        "section": "User",
        "summary": "강의 목차, 과제, 진도율, 공지사항을 확인하는 상세 화면입니다.",
        "back": "/my-courses",
        "next": "/mypage/learning",
        "related": ["/support/inquiry/new", "/mypage/notifications"],
    },
    {
        "route": "/mypage",
        "file": "mypage/index.html",
        "title": "마이페이지",
        "section": "User",
        "summary": "개인정보, 결제, 학습, 문의, 알림을 관리하는 허브 페이지입니다.",
        "back": "/my-courses",
        "next": "/mypage/profile",
        "related": ["/mypage/enrollments", "/mypage/payments", "/mypage/learning"],
    },
    {
        "route": "/mypage/profile",
        "file": "mypage/profile/index.html",
        "title": "프로필 관리",
        "section": "User",
        "summary": "이름, 연락처, 학습 목표 등 기본 프로필 정보를 수정합니다.",
        "back": "/mypage",
        "next": "/mypage/password",
        "related": ["/mypage/notifications"],
    },
    {
        "route": "/mypage/password",
        "file": "mypage/password/index.html",
        "title": "비밀번호 변경",
        "section": "User",
        "summary": "기존 비밀번호 확인 후 새 비밀번호로 안전하게 변경합니다.",
        "back": "/mypage/profile",
        "next": "/mypage/enrollments",
        "related": ["/forgot-password"],
    },
    {
        "route": "/mypage/enrollments",
        "file": "mypage/enrollments/index.html",
        "title": "신청 내역",
        "section": "User",
        "summary": "신청한 과정의 상태(대기/승인/취소)를 목록으로 확인합니다.",
        "back": "/mypage/password",
        "next": "/mypage/payments",
        "related": ["/enroll", "/support/inquiry/new"],
    },
    {
        "route": "/mypage/payments",
        "file": "mypage/payments/index.html",
        "title": "결제 내역",
        "section": "User",
        "summary": "결제 상태, 영수증, 환불 요청 진행 상태를 확인합니다.",
        "back": "/mypage/enrollments",
        "next": "/mypage/learning",
        "related": ["/refund", "/support/inquiry/new"],
    },
    {
        "route": "/mypage/learning",
        "file": "mypage/learning/index.html",
        "title": "학습 현황",
        "section": "User",
        "summary": "과정별 진도율, 수강 완료율, 다음 학습 할 일을 안내합니다.",
        "back": "/mypage/payments",
        "next": "/mypage/inquiries",
        "related": ["/my-courses", "/my-courses/[enrollmentId]"],
    },
    {
        "route": "/mypage/inquiries",
        "file": "mypage/inquiries/index.html",
        "title": "문의 내역",
        "section": "User",
        "summary": "1:1 문의 티켓의 상태와 답변 이력을 확인합니다.",
        "back": "/mypage/learning",
        "next": "/mypage/notifications",
        "related": ["/support/inquiry", "/support/inquiry/[id]"],
    },
    {
        "route": "/mypage/notifications",
        "file": "mypage/notifications/index.html",
        "title": "알림 설정",
        "section": "User",
        "summary": "메일/문자/앱 알림 수신 여부와 중요 알림 우선순위를 설정합니다.",
        "back": "/mypage/inquiries",
        "next": "/mypage/withdrawal",
        "related": ["/support/faq"],
    },
    {
        "route": "/mypage/withdrawal",
        "file": "mypage/withdrawal/index.html",
        "title": "회원 탈퇴",
        "section": "User",
        "summary": "탈퇴 전 유의사항을 확인하고 계정 비활성화 절차를 진행합니다.",
        "back": "/mypage/notifications",
        "next": "/support",
        "related": ["/terms", "/privacy"],
    },
    {
        "route": "/support",
        "file": "support/index.html",
        "title": "고객센터",
        "section": "User",
        "summary": "자주 묻는 질문, 1:1 문의, 공지사항으로 이동하는 지원 허브입니다.",
        "back": "/mypage",
        "next": "/support/faq",
        "related": ["/support/inquiry", "/support/inquiry/new"],
    },
    {
        "route": "/support/faq",
        "file": "support/faq/index.html",
        "title": "FAQ",
        "section": "User",
        "summary": "수강 신청, 결제, 환불, 학습 진행 관련 주요 질문을 제공합니다.",
        "back": "/support",
        "next": "/support/inquiry",
        "related": ["/refund", "/terms", "/privacy"],
    },
    {
        "route": "/support/inquiry",
        "file": "support/inquiry/index.html",
        "title": "문의 목록",
        "section": "User",
        "summary": "등록된 1:1 문의 목록과 처리 상태를 확인합니다.",
        "back": "/support/faq",
        "next": "/support/inquiry/new",
        "related": ["/mypage/inquiries"],
    },
    {
        "route": "/support/inquiry/new",
        "file": "support/inquiry/new/index.html",
        "title": "문의 작성",
        "section": "User",
        "summary": "문의 유형을 선택하고 상세 내용을 작성해 새 티켓을 발행합니다.",
        "back": "/support/inquiry",
        "next": "/support/inquiry/[id]",
        "related": ["/support/faq"],
    },
    {
        "route": "/support/inquiry/[id]",
        "file": "support/inquiry/detail-001.html",
        "title": "문의 상세",
        "section": "User",
        "summary": "문의 상세 내용과 운영진 답변, 추가 코멘트를 확인합니다.",
        "back": "/support/inquiry/new",
        "next": "/mypage/inquiries",
        "related": ["/support/inquiry", "/support"],
    },
    # Admin pages (18)
    {
        "route": "/admin",
        "file": "admin/index.html",
        "title": "관리자 대시보드",
        "section": "Admin",
        "summary": "운영 현황과 핵심 지표를 한 번에 확인하는 관리자 메인 페이지입니다.",
        "back": "/",
        "next": "/admin/courses",
        "related": ["/admin/enrollments", "/admin/payments", "/admin/users"],
    },
    {
        "route": "/admin/courses",
        "file": "admin/courses/index.html",
        "title": "강의 관리",
        "section": "Admin",
        "summary": "강의 목록 조회, 상태 변경, 노출 여부를 관리합니다.",
        "back": "/admin",
        "next": "/admin/courses/new",
        "related": ["/admin/courses/[id]"],
    },
    {
        "route": "/admin/courses/new",
        "file": "admin/courses/new/index.html",
        "title": "강의 등록",
        "section": "Admin",
        "summary": "새 강의 제목, 카테고리, 일정, 가격 정보를 등록합니다.",
        "back": "/admin/courses",
        "next": "/admin/courses/[id]",
        "related": ["/admin/learning"],
    },
    {
        "route": "/admin/courses/[id]",
        "file": "admin/courses/detail-001.html",
        "title": "강의 상세 관리",
        "section": "Admin",
        "summary": "강의 상세 정보, 수강생, 자료, 노출 설정을 수정합니다.",
        "back": "/admin/courses/new",
        "next": "/admin/enrollments",
        "related": ["/admin/reviews", "/admin/learning/[id]"],
    },
    {
        "route": "/admin/enrollments",
        "file": "admin/enrollments/index.html",
        "title": "신청 관리",
        "section": "Admin",
        "summary": "수강 신청 목록을 확인하고 승인/반려 처리합니다.",
        "back": "/admin/courses/[id]",
        "next": "/admin/enrollments/[id]",
        "related": ["/admin/payments"],
    },
    {
        "route": "/admin/enrollments/[id]",
        "file": "admin/enrollments/detail-001.html",
        "title": "신청 상세 관리",
        "section": "Admin",
        "summary": "신청자 정보, 첨부 자료, 처리 로그를 상세히 확인합니다.",
        "back": "/admin/enrollments",
        "next": "/admin/payments",
        "related": ["/admin/users/[id]"],
    },
    {
        "route": "/admin/payments",
        "file": "admin/payments/index.html",
        "title": "결제 관리",
        "section": "Admin",
        "summary": "결제 승인 상태, 실패 내역, 환불 요청을 통합 관리합니다.",
        "back": "/admin/enrollments/[id]",
        "next": "/admin/payments/[id]",
        "related": ["/admin/inquiries"],
    },
    {
        "route": "/admin/payments/[id]",
        "file": "admin/payments/detail-001.html",
        "title": "결제 상세 관리",
        "section": "Admin",
        "summary": "결제 상세 정보와 환불 처리 메모를 남기는 페이지입니다.",
        "back": "/admin/payments",
        "next": "/admin/learning",
        "related": ["/refund", "/admin/enrollments/[id]"],
    },
    {
        "route": "/admin/learning",
        "file": "admin/learning/index.html",
        "title": "학습 운영 관리",
        "section": "Admin",
        "summary": "강의 콘텐츠 배포와 학습 진도 정책을 관리합니다.",
        "back": "/admin/payments/[id]",
        "next": "/admin/learning/[id]",
        "related": ["/admin/courses"],
    },
    {
        "route": "/admin/learning/[id]",
        "file": "admin/learning/detail-001.html",
        "title": "학습 상세 관리",
        "section": "Admin",
        "summary": "학습 세션별 진행률, 과제 제출, 피드백 상태를 확인합니다.",
        "back": "/admin/learning",
        "next": "/admin/users",
        "related": ["/admin/reviews"],
    },
    {
        "route": "/admin/users",
        "file": "admin/users/index.html",
        "title": "회원 관리",
        "section": "Admin",
        "summary": "회원 목록, 권한, 휴면 상태, 활동 로그를 관리합니다.",
        "back": "/admin/learning/[id]",
        "next": "/admin/users/[id]",
        "related": ["/admin/inquiries"],
    },
    {
        "route": "/admin/users/[id]",
        "file": "admin/users/detail-001.html",
        "title": "회원 상세 관리",
        "section": "Admin",
        "summary": "개별 회원의 신청/결제/문의 내역을 종합 조회합니다.",
        "back": "/admin/users",
        "next": "/admin/reviews",
        "related": ["/admin/enrollments/[id]", "/admin/payments/[id]"],
    },
    {
        "route": "/admin/reviews",
        "file": "admin/reviews/index.html",
        "title": "후기 관리",
        "section": "Admin",
        "summary": "수강 후기 승인, 숨김 처리, 강조 노출 설정을 수행합니다.",
        "back": "/admin/users/[id]",
        "next": "/admin/reviews/[id]",
        "related": ["/admin/courses/[id]"],
    },
    {
        "route": "/admin/reviews/[id]",
        "file": "admin/reviews/detail-001.html",
        "title": "후기 상세 관리",
        "section": "Admin",
        "summary": "후기 본문, 작성자 정보, 신고 내역을 검토합니다.",
        "back": "/admin/reviews",
        "next": "/admin/faqs",
        "related": ["/admin/users/[id]"],
    },
    {
        "route": "/admin/faqs",
        "file": "admin/faqs/index.html",
        "title": "FAQ 관리",
        "section": "Admin",
        "summary": "FAQ 카테고리와 노출 순서를 설정합니다.",
        "back": "/admin/reviews/[id]",
        "next": "/admin/faqs/[id]",
        "related": ["/support/faq"],
    },
    {
        "route": "/admin/faqs/[id]",
        "file": "admin/faqs/detail-001.html",
        "title": "FAQ 상세 관리",
        "section": "Admin",
        "summary": "FAQ 상세 문구를 편집하고 공개 상태를 변경합니다.",
        "back": "/admin/faqs",
        "next": "/admin/inquiries",
        "related": ["/support/faq", "/admin/inquiries"],
    },
    {
        "route": "/admin/inquiries",
        "file": "admin/inquiries/index.html",
        "title": "문의 관리",
        "section": "Admin",
        "summary": "사용자 문의 목록을 확인하고 담당자를 배정합니다.",
        "back": "/admin/faqs/[id]",
        "next": "/admin/inquiries/[id]",
        "related": ["/support/inquiry"],
    },
    {
        "route": "/admin/inquiries/[id]",
        "file": "admin/inquiries/detail-001.html",
        "title": "문의 상세 관리",
        "section": "Admin",
        "summary": "문의 대화 내역 확인 및 답변 등록, 상태 완료 처리를 진행합니다.",
        "back": "/admin/inquiries",
        "next": "/admin",
        "related": ["/support/inquiry/[id]"],
    },
]


ROUTE_TO_FILE = {"/": "index.html", "/login": "login.html"}
ROUTE_TO_FILE.update({page["route"]: page["file"] for page in PAGES})
ROUTE_TO_FILE["/pages"] = "pages.html"


def page_html(page: dict) -> str:
    current_file = ROOT / page["file"]

    def href(route: str) -> str:
        target = ROOT / ROUTE_TO_FILE[route]
        return rel_link(current_file, target)

    related_items = "\n".join(
        f'          <li><a href="{href(route)}">{route}</a></li>' for route in page["related"]
    )

    return f"""<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PASSmaster | {page["title"]}</title>
    <link rel="stylesheet" href="{rel_link(current_file, ROOT / "assets/shared.css")}" />
    <script defer src="{rel_link(current_file, ROOT / "assets/shared.js")}"></script>
  </head>
  <body>
    <div class="pm-shell">
      <header class="pm-header">
        <a class="pm-logo" href="{href('/')}">PASSmaster</a>
        <nav class="pm-nav" aria-label="공통 이동">
          <a href="{href('/login')}">로그인</a>
          <a href="{href('/register')}">회원가입</a>
          <a href="{href('/enroll')}">수강신청</a>
          <a href="{href('/my-courses')}">내 강의</a>
          <a href="{href('/admin')}">관리자</a>
          <a href="{href('/pages')}">전체 페이지</a>
        </nav>
      </header>

      <main class="pm-main">
        <p class="pm-pill">{page["section"]} Flow</p>
        <h1>{page["title"]}</h1>
        <p class="pm-summary">{page["summary"]}</p>
        <div class="pm-cta-row">
          <a class="pm-btn pm-btn-ghost" href="{href(page["back"])}">이전 단계</a>
          <a class="pm-btn pm-btn-primary" href="{href(page["next"])}">다음 단계</a>
        </div>

        <section class="pm-card">
          <h2>현재 경로</h2>
          <p class="pm-route">{page["route"]}</p>
        </section>

        <section class="pm-card">
          <h2>연결 페이지</h2>
          <ul class="pm-link-list">
{related_items}
          </ul>
        </section>
      </main>

      <footer class="pm-footer">
        <a href="{href('/')}">메인으로</a>
        <a href="{href('/support')}">고객센터</a>
        <a href="{href('/pages')}">사이트맵</a>
      </footer>
    </div>
  </body>
</html>
"""


SHARED_CSS = """\
:root {
  --bg: #f2f6ff;
  --card: #ffffff;
  --text: #1a2744;
  --muted: #607296;
  --line: #d4e0f8;
  --primary: #236bff;
  --primary-deep: #0f49c2;
}
* {
  box-sizing: border-box;
}
body {
  margin: 0;
  min-height: 100vh;
  font-family: "Pretendard", "Noto Sans KR", "Malgun Gothic", sans-serif;
  color: var(--text);
  background: radial-gradient(circle at 12% -8%, #d8e8ff 0, #eef4ff 42%, var(--bg) 75%);
}
a {
  color: inherit;
  text-decoration: none;
}
.pm-shell {
  width: min(1080px, calc(100% - 28px));
  margin: 22px auto;
  border: 1px solid var(--line);
  border-radius: 22px;
  background: var(--card);
  box-shadow: 0 18px 38px rgba(20, 53, 118, 0.12);
  overflow: hidden;
}
.pm-header {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #e7eefb;
  background: linear-gradient(90deg, #f8fbff, #f2f7ff);
}
.pm-logo {
  font-size: 24px;
  font-weight: 900;
  color: var(--primary-deep);
  letter-spacing: -0.02em;
}
.pm-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  font-size: 14px;
  font-weight: 700;
  color: #3a4f77;
}
.pm-main {
  padding: 24px 20px 26px;
}
.pm-pill {
  display: inline-block;
  margin: 0 0 10px;
  padding: 6px 11px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 800;
  color: var(--primary-deep);
  background: #e7f0ff;
}
h1 {
  margin: 0;
  font-size: clamp(26px, 4vw, 34px);
  line-height: 1.2;
}
.pm-summary {
  margin: 12px 0 18px;
  color: var(--muted);
  font-size: 16px;
}
.pm-cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 0 0 20px;
}
.pm-btn {
  min-height: 44px;
  padding: 10px 16px;
  border-radius: 12px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.pm-btn-ghost {
  border: 1px solid #cad8f7;
  color: #375486;
  background: #f6f9ff;
}
.pm-btn-primary {
  color: #fff;
  background: linear-gradient(135deg, var(--primary), #5a97ff);
  box-shadow: 0 10px 20px rgba(35, 107, 255, 0.22);
}
.pm-card {
  border: 1px solid #d9e4fa;
  border-radius: 16px;
  padding: 16px;
  margin: 0 0 14px;
  background: #fbfdff;
}
.pm-card h2 {
  margin: 0 0 8px;
  font-size: 18px;
}
.pm-route {
  margin: 0;
  font-family: "Consolas", "Courier New", monospace;
  color: #315996;
}
.pm-link-list {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 7px;
}
.pm-link-list a {
  color: #234f9f;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 2px;
}
.pm-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  padding: 14px 20px 18px;
  border-top: 1px solid #e7eefb;
  color: #4b628f;
  font-weight: 700;
}
@media (max-width: 768px) {
  .pm-shell {
    width: calc(100% - 16px);
    margin: 8px auto;
  }
  .pm-header,
  .pm-main,
  .pm-footer {
    padding-left: 14px;
    padding-right: 14px;
  }
}
"""


SHARED_JS = """\
document.querySelectorAll(".pm-nav a").forEach((link) => {
  if (link.getAttribute("href") === "./") {
    link.classList.add("active");
  }
});
"""


def sitemap_html() -> str:
    all_pages = [("/", "index.html"), ("/login", "login.html")] + [
        (page["route"], page["file"]) for page in PAGES
    ]
    items = "\n".join(
        f'          <li><a href="./{file.replace("\\\\", "/")}">{route}</a></li>'
        for route, file in all_pages
    )
    return f"""<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>PASSmaster | 페이지 목록</title>
    <link rel="stylesheet" href="./assets/shared.css" />
  </head>
  <body>
    <div class="pm-shell">
      <header class="pm-header">
        <a class="pm-logo" href="./index.html">PASSmaster</a>
        <nav class="pm-nav">
          <a href="./index.html">메인</a>
          <a href="./login.html">로그인</a>
          <a href="./register.html">회원가입</a>
          <a href="./enroll/index.html">수강신청</a>
          <a href="./my-courses/index.html">내 강의</a>
          <a href="./admin/index.html">관리자</a>
        </nav>
      </header>
      <main class="pm-main">
        <p class="pm-pill">Sitemap</p>
        <h1>전체 페이지 목록</h1>
        <p class="pm-summary">정적 멀티 페이지 스캐폴드 확인용 링크 모음입니다.</p>
        <section class="pm-card">
          <h2>총 {len(all_pages)}개 경로</h2>
          <ul class="pm-link-list">
{items}
          </ul>
        </section>
      </main>
      <footer class="pm-footer">
        <a href="./index.html">메인으로</a>
        <a href="./support/index.html">고객센터로</a>
      </footer>
    </div>
  </body>
</html>
"""


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def main() -> None:
    write_text(ROOT / "assets/shared.css", SHARED_CSS)
    write_text(ROOT / "assets/shared.js", SHARED_JS)

    for page in PAGES:
        write_text(ROOT / page["file"], page_html(page))

    write_text(ROOT / "pages.html", sitemap_html())


if __name__ == "__main__":
    main()
