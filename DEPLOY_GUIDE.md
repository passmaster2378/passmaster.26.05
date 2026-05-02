# PASSmaster 배포 가이드 (GitHub + Supabase + Vercel)

## 1) GitHub 업로드

```bash
cd e:\PASSmaster2
git init
git add .
git commit -m "Prepare PASSmaster for deployment"
git branch -M main
git remote add origin https://github.com/<your-id>/<your-repo>.git
git push -u origin main
```

## 2) Supabase DB 생성

1. Supabase에서 새 프로젝트 생성
2. SQL Editor에서 아래 순서로 실행
   - `supabase/schema.sql`
   - `supabase/seed.sql`
3. Project Settings > Database에서 연결 정보 확인

## 3) 백엔드 환경변수 설정 (Supabase Postgres)

`backend/.env` 생성 (`backend/.env.example` 참고):

```env
PORT=4000
JWT_SECRET=strong-random-secret
CORS_ORIGINS=http://localhost:5500,http://localhost:5173,https://<your-frontend>.vercel.app
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<url-encoded-password>@aws-0-<region>.pooler.supabase.com:6543/postgres
```

## 4) 로컬 백엔드 실행 테스트

```bash
cd e:\PASSmaster2\backend
cp .env.example .env
# .env에 SUPABASE_DB_URL, JWT_SECRET 입력
npm install
npm start
```

헬스체크:
- `http://localhost:4000/api/health`

## 5) 백엔드 배포 (Render 권장)

1. Render > New + > **Blueprint** 선택 후 이 저장소 연결 (`render.yaml` 자동 인식)
2. 생성된 `passmaster-api` 서비스에서 Environment Variables 등록:
   - `PORT` = `10000` (Render 기본)
   - `JWT_SECRET`
   - `CORS_ORIGINS` = `https://<your-frontend>.vercel.app`
   - `SUPABASE_DB_URL` (Session Pooler URI 권장)
3. 배포 완료 후 API URL 확인:
   - 예: `https://passmaster-api.onrender.com`
   - 헬스체크: `https://passmaster-api.onrender.com/api/health`

## 6) Vercel 배포

### 프론트(정적 HTML) 배포
1. Vercel에서 GitHub repo import
2. Root Directory: 프로젝트 루트 (`PASSmaster2`)
3. Build command: 비워도 됨
4. Output directory: 비워도 됨 (정적 파일 직접 배포)
5. Environment Variables 추가:
   - `PASSMASTER_BACKEND_ORIGIN` = `https://<render-backend-domain>`
6. `vercel.json`의 `/api/*` 라우팅이 위 변수를 사용해 백엔드로 프록시

### API 연결
- 현재 프론트는 다음 우선순위로 API를 찾음:
  1. `window.PASSMASTER_API_BASE`
  2. 로컬이면 `http://localhost:4000/api`
  3. 배포 환경이면 `/api`

위 설정을 사용하면 배포 환경(`/api`)은 자동으로 Render 백엔드로 전달되므로, 각 HTML에 별도 스크립트를 넣지 않아도 됩니다.

## 7) 권장 다음 단계

1. 에러 추적(Sentry)과 API 로깅 구성
2. 관리자/유저 권한별 RLS 정책 설계 (Supabase)
3. 비밀번호 재설정 이메일, 실명 SMTP 연동
4. CI(테스트 + 배포 전 체크) 파이프라인 추가

