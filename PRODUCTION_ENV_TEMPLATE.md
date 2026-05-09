# PASSmaster 운영 환경변수 템플릿 (복붙용)

아래 값은 **실서비스 배포 플랫폼(Render/Vercel 등)** 환경변수에 그대로 넣고, `<>` 부분만 실제 값으로 교체하세요.

## 1) Backend (Render) - 필수

```env
NODE_ENV=production
PORT=4000

# 32자 이상 강력 랜덤 문자열
JWT_SECRET=<VERY_LONG_RANDOM_SECRET_MIN_32_CHARS>

# 프론트 실제 도메인만 허용 (콤마 구분)
CORS_ORIGINS=https://passmaster2378.github.io

# OAuth 리다이렉트 및 외부 호출 기준 API URL
PUBLIC_API_URL=https://<your-backend-service>.onrender.com
FRONTEND_URL=https://passmaster2378.github.io

# Supabase Postgres
SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<url-encoded-password>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres

# OAuth (사용 시)
GOOGLE_CLIENT_ID=<GOOGLE_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<GOOGLE_CLIENT_SECRET>
KAKAO_REST_API_KEY=<KAKAO_REST_API_KEY>
KAKAO_CLIENT_SECRET=<KAKAO_CLIENT_SECRET_OR_EMPTY>

# 보안: 운영에서는 false 고정
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

## 2) Backend - 초기 관리자 1회 생성이 필요할 때만

> 이 단계는 **정말 최초 1회만** 사용하고 즉시 `ROOT_ADMIN_BOOTSTRAP=false`로 복구하세요.

```env
ROOT_ADMIN_BOOTSTRAP=true
ROOT_ADMIN_EMAIL=<admin@email.com>
ROOT_ADMIN_PASSWORD=<STRONG_ADMIN_PASSWORD>
ROOT_ADMIN_NAME=PASSmaster
```

초기 관리자 확인 후 반드시 원복:

```env
ROOT_ADMIN_BOOTSTRAP=false
ROOT_ADMIN_EMAIL=
ROOT_ADMIN_PASSWORD=
```

## 3) Frontend (GitHub Pages/Vercel) - 선택

현재 구조는 기본적으로 GitHub Pages에서 원격 API를 사용하도록 되어 있어 필수는 아닙니다.  
오버라이드가 필요할 때만 설정하세요.

```env
PASSMASTER_API_BASE=https://<your-backend-service>.onrender.com/api
PASSMASTER_OAUTH_API_BASE=https://<your-backend-service>.onrender.com/api
```

## 4) 오픈 직전 스모크 테스트용(로컬 실행)

```powershell
$env:PASSMASTER_API_BASE="https://<your-backend-service>.onrender.com/api"
$env:PASSMASTER_ADMIN_EMAIL="<admin@email.com>"
$env:PASSMASTER_ADMIN_PASSWORD="<admin-password>"
npm run smoke:open
```

성공 기준:

- `[smoke] OK` 출력
- `auditCount`가 1 이상
- `paymentStatus`, `approvalStatus`, `outstanding` 값이 정상 JSON으로 출력

## 5) 최종 체크

- `JWT_SECRET` 32자 이상인지 확인
- `ROOT_ADMIN_BOOTSTRAP=false`인지 확인
- `CORS_ORIGINS`에 불필요한 도메인이 없는지 확인
- 관리자 로그인/결제 승인/환불/감사로그 화면 수동 점검

