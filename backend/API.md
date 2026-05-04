# PASSmaster Backend API (v2026-05)

Base URL: `http://localhost:4000/api`

## 공통 규칙

- 인증이 필요한 엔드포인트는 헤더를 포함합니다.
  - `Authorization: Bearer <token>`
- 에러 응답은 공통적으로 아래 형태입니다.

```json
{ "message": "오류 메시지" }
```

## Health

### GET `/health`

```json
{ "ok": true, "serverTime": "2026-05-05T00:00:00.000Z" }
```

## Auth

### POST `/auth/register`

Request:

```json
{ "name": "홍길동", "email": "user@example.com", "password": "pass1234!" }
```

Response: (201)

```json
{ "id": 1, "name": "홍길동", "email": "user@example.com", "role": "user", "created_at": "..." }
```

### POST `/auth/login`

Request:

```json
{ "email": "user@example.com", "password": "pass1234!" }
```

Response:

```json
{
  "token": "<jwt>",
  "expiresAt": "2026-05-05T09:00:00.000Z",
  "user": { "id": 1, "name": "홍길동", "email": "user@example.com", "role": "user", "created_at": "..." }
}
```

### OAuth (Google / Kakao)

브라우저에서 다음 URL로 이동합니다. `returnTo`는 허용된 프론트 오리진의 전체 URL이어야 합니다(`CORS_ORIGINS`).

- `GET /auth/oauth/google/start?returnTo=<encodeURIComponent(프론트 URL)>`
- `GET /auth/oauth/kakao/start?returnTo=...`

콜백 후 프론트는 `#pm_auth=<base64url(JSON)>` 해시로 `{ token, expiresAt, user }`를 전달받습니다. 환경 변수: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`(선택), `PUBLIC_API_URL`, `FRONTEND_URL`.

### GET `/auth/me` (auth)

Response:

```json
{ "id": 1, "name": "홍길동", "email": "user@example.com", "role": "user", "created_at": "..." }
```

### PATCH `/auth/password` (auth)

Request:

```json
{ "currentPassword": "pass1234!", "newPassword": "newpass1234!" }
```

Response:

```json
{ "ok": true, "message": "비밀번호가 변경되었습니다." }
```

## Courses / Openings

### GET `/courses`

Response: `courses[]`

### GET `/course-openings`

Response: `openings[]`

### GET `/course-openings/:id`

Response: `opening`

## Enrollments

### POST `/enrollments` (auth)

Request:

```json
{ "openingId": 1 }
```

Response: (201) `enrollment`  
중복 신청 시 (409) + `{ enrollmentId }`가 함께 내려옵니다.

### GET `/me/enrollments` (auth)

Response: `enrollments[]`

### GET `/me/enrollments/:id` (auth)

Response:

```json
{
  "...": "enrollment fields",
  "payments": [{ "id": 1, "amount": 219000, "method": "bank_transfer", "status": "pending", "created_at": "..." }]
}
```

### PATCH `/me/enrollments/:id/deposit` (auth)

Request: `{}`  
Response: `enrollment`

## Payments

### GET `/me/payments` (auth)

Response: `payments[]`

### GET `/admin/payments` (auth + admin)

Response: `payments[]`

### GET `/admin/payments/:id` (auth + admin)

Response: `payment detail`

### PATCH `/admin/payments/:id` (auth + admin)

Request:

```json
{ "status": "completed" }
```

Response: `payment`

## Inquiries

### GET `/inquiries`

Query: `status`, `type`, `q`, `page`, `pageSize`

Response:

```json
{ "items": [], "meta": { "total": 0, "page": 1, "pageSize": 10, "totalPages": 1 } }
```

### GET `/inquiries/:id`

Response: `{ ...inquiry, messages: [...] }`

### POST `/inquiries` (auth)

Request:

```json
{ "userName": "홍길동", "type": "payment", "title": "문의 제목", "content": "문의 내용" }
```

Response: (201) `inquiry`

### PATCH `/inquiries/:id/status` (auth + admin)

Request: `{ "status": "received" | "processing" | "done" }`

### PATCH `/inquiries/:id/assignee` (auth + admin)

Request: `{ "assigneeName": "CS팀 김OO" }`

### POST `/inquiries/:id/messages` (auth + admin)

Request: `{ "message": "답변 내용" }`

