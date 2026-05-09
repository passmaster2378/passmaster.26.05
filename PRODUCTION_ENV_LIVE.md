# PASSmaster 실전용 환경변수 최종본

아래는 현재 프로젝트 기준으로 바로 적용 가능한 운영값입니다.  
민감값(`JWT_SECRET`, DB 비밀번호 등)만 실제 값으로 교체해서 사용하세요.

---

## 1) Render Backend 환경변수 (최종)

```env
NODE_ENV=production
PORT=4000

# 필수: 32자 이상 랜덤 문자열
JWT_SECRET=<CHANGE_TO_LONG_RANDOM_SECRET>

# 운영 프론트 도메인
CORS_ORIGINS=https://passmaster2378.github.io
# GitHub Pages 프로젝트 사이트 경로까지 포함
FRONTEND_URL=https://passmaster2378.github.io/passmaster.26.05

# 운영 백엔드 공개 URL
PUBLIC_API_URL=https://passmaster-26-05.onrender.com

# Supabase Postgres (운영값으로 교체)
SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<url-encoded-password>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres

# OAuth (사용 시 입력)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
KAKAO_REST_API_KEY=
KAKAO_CLIENT_SECRET=

# 보안: 운영에서는 항상 false 유지
ROOT_ADMIN_BOOTSTRAP=false
ROOT_ADMIN_EMAIL=
ROOT_ADMIN_PASSWORD=
ROOT_ADMIN_NAME=PASSmaster

# 요청 제한(권장 기본값)
AUTH_RATE_LIMIT_MAX=20
AUTH_RATE_LIMIT_WINDOW_MS=600000
ADMIN_WRITE_RATE_LIMIT_MAX=120
ADMIN_WRITE_RATE_LIMIT_WINDOW_MS=600000
```

---

## 2) 최초 관리자 1회 부트스트랩 (필요한 경우만)

> 이 단계는 정말 최초 1회만 사용 후 즉시 OFF

```env
ROOT_ADMIN_BOOTSTRAP=true
ROOT_ADMIN_EMAIL=sanahai@naver.com
ROOT_ADMIN_PASSWORD=<CHANGE_TO_NEW_STRONG_PASSWORD>
ROOT_ADMIN_NAME=PASSmaster
```

초기 로그인 확인 직후 반드시 원복:

```env
ROOT_ADMIN_BOOTSTRAP=false
ROOT_ADMIN_EMAIL=
ROOT_ADMIN_PASSWORD=
```

---

## 3) 스모크 테스트 실행 (운영 URL 대상)

PowerShell:

```powershell
$env:PASSMASTER_API_BASE="https://passmaster-26-05.onrender.com/api"
$env:PASSMASTER_ADMIN_EMAIL="sanahai@naver.com"
$env:PASSMASTER_ADMIN_PASSWORD="<ADMIN_PASSWORD>"
npm run smoke:open
```

성공 기준:

- `[smoke] OK` 출력
- JSON에 `auditCount >= 1`
- `paymentStatus`, `approvalStatus`, `outstanding` 필드 정상 출력

---

## 4) 오픈 직전 최종 확인

- `JWT_SECRET` 설정 여부 확인
- `ROOT_ADMIN_BOOTSTRAP=false` 확인
- 관리자 결제 상세에서:
  - 승인/부분환불/전액환불 동작
  - 감사로그 누적 표시
- `OPEN_LAUNCH_CHECKLIST.md` 항목 전체 완료

