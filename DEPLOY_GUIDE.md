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
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_DB_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
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

## 5) Vercel 배포

### 프론트(정적 HTML) 배포
1. Vercel에서 GitHub repo import
2. Root Directory: 프로젝트 루트 (`PASSmaster2`)
3. Build command: 비워도 됨
4. Output directory: 비워도 됨 (정적 파일 직접 배포)

### API 연결
- 현재 프론트는 다음 우선순위로 API를 찾음:
  1. `window.PASSMASTER_API_BASE`
  2. 로컬이면 `http://localhost:4000/api`
  3. 배포 환경이면 `/api`

배포 환경에서 백엔드가 별도 도메인이라면, 각 HTML의 `<head>`에 아래 스크립트 추가:

```html
<script>
  window.PASSMASTER_API_BASE = "https://your-backend-domain/api";
</script>
```

## 6) 권장 다음 단계

1. 백엔드를 Supabase Postgres 기반으로 전환 (`sqlite` 제거)
2. Vercel 서버리스 API 라우트로 이전 (`/api/*`)
3. JWT secret/keys를 Vercel Environment Variables로 관리
4. 관리자/유저 권한별 RLS 정책 설계 (Supabase)

