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

#### GET `/auth/oauth/public-config`

프론트가 소셜 버튼 활성 여부를 맞추기 위해 호출합니다. 비밀 값은 내려가지 않습니다.

```json
{ "googleEnabled": true, "kakaoEnabled": true, "googleClientId": "xxx.apps.googleusercontent.com" }
```

#### 시작 URL

브라우저에서 다음 URL로 이동합니다. `returnTo`는 허용된 프론트 오리진의 전체 URL이어야 합니다(`CORS_ORIGINS`).

- `GET /auth/oauth/google/start?returnTo=<encodeURIComponent(프론트 URL)>`
- `GET /auth/oauth/kakao/start?returnTo=...`

콜백 후 프론트는 `#pm_auth=<base64url(JSON)>` 해시로 `{ token, expiresAt, user }`를 전달받습니다. 환경 변수: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`(선택), `PUBLIC_API_URL`, `FRONTEND_URL`.

정적 사이트(GitHub Pages)에서는 `login.html` 상단 스크립트로 `window.PASSMASTER_API_BASE`를 본인 Render API(`…/api`)로 지정할 수 있습니다.

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

- 응시 전 활성(open/closing) 모집에 대해 **`display_seq`를 매 시행 목록 호출 때마다 1…n으로 재번호** 매깁니다(비활성 모집은 `display_seq`를 비웁니다).
- 각 항목에는 DB PK `id`와 공개 순번 **`display_seq`** 가 함께 내려옵니다.
- 목록 순서는 `display_seq` 기준입니다.

### GET `/course-openings/:id`

- `:id`는 **`display_seq`(권장, 화면의 모집ID)** 또는, 하위 호환용으로 활성 모집의 **내부 `id`** 입니다.

## Enrollments

### POST `/enrollments` (auth)

Request:

```json
{ "openingId": 1 }
```

`openingId`는 목록/API의 **`display_seq`** 또는 활성 구간 한정 **내부 `id`** 로 해석됩니다.

Response: (201) `enrollment`  
중복 신청 시 (409) + `{ enrollmentId }`가 함께 내려옵니다.

### GET `/me/enrollments` (auth)

Response: `enrollments[]` — 각 항목에 `learning_meta`(단계·요약 JSONB), `progress_percent` 등이 포함됩니다.

### GET `/me/enrollments/:id` (auth)

Response:

```json
{
  "...": "enrollment fields",
  "learning_meta": {
    "stages": {
      "1": "completed",
      "4": "in_progress",
      "5": "locked"
    },
    "summary": {
      "current_stage_label": "4단계 · 실전 선택 풀이",
      "last_study_at": "2026-05-14",
      "solved_count": 420,
      "weak_flagged": 18,
      "wrong_count": 64,
      "mock_exam_avg": 67.8
    }
  },
  "payments": [{ "id": 1, "amount": 219000, "method": "bank_transfer", "status": "pending", "created_at": "..." }]
}
```

`stages`의 키는 `"1"` ~ `"12"` 문자열이며 값은 `locked` \| `available` \| `in_progress` \| `completed` 입니다.

### PATCH `/me/enrollments/:id/learning-meta` (auth)

**조건:** 해당 수강의 `approval_status`가 승인(`approved`)된 경우만 허용합니다.

Request (부분 병합):

```json
{
  "learning_meta": {
    "stages": { "4": "in_progress", "5": "locked" },
    "summary": {
      "last_study_at": "2026-05-14T09:30:00.000Z",
      "solved_count": 430,
      "weak_flagged": 18,
      "wrong_count": 64,
      "mock_exam_avg": 68,
      "current_stage_label": "4단계 · 실전 선택 풀이"
    }
  },
  "progress_percent": 33
}
```

`progress_percent`를 함께 보내면 진도율과 `learning_status`(completed/in_progress)가 함께 갱신될 수 있습니다.

Response: 목록 조회와 동일 형태의 enrollment 행 일부 필드(`learning_meta`, `progress_percent` 등).

운영자는 `PATCH /admin/enrollments/:id` 요청 본문에 `learning_meta`를 포함하면 동일 병합 규칙으로 저장할 수 있습니다.

### PATCH `/me/enrollments/:id/deposit` (auth)

Request: `{}`  
Response: `enrollment`

### DELETE `/me/enrollments/:id` (auth)

본인 수강 신청 행만 삭제합니다.

**삭제 불가:** 학습 진행 중(`learning_status === 'in_progress'` 또는 `progress_percent > 0`), 또는 완료(`progress_percent >= 100` 또는 `learning_status === 'completed'`). 해당 경우 **403**과 차단 사유 메시지가 내려옵니다.

Response: 성공 시 **204** (본문 없음).

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

## Admin · 과정 문제은행(JSON)

테이블: `course_question_sets`, `course_questions`. 과정(`courses.id`)당 **활성 세트 하나** 유지 방식입니다.

### GET `/admin/courses/:courseId/questions/summary` (auth + admin)

활성 세트 요약 및 과정 정보.

### GET `/admin/courses/:courseId/questions/active` (auth + admin)

활성 세트 문항 전체를 배열 형태로 반환합니다.

### POST `/admin/courses/:courseId/questions/import` (auth + admin)

Body 예:

```json
{
  "payload": {
    "questions": [
      { "question": "예시 문항", "options": ["A", "B", "C"], "answer": 1, "subject": "선택 과목", "explanation": "선택" }
    ]
  },
  "dryRun": false,
  "sourceFilename": "optional.json"
}
```

- `dryRun: true`: 형식 검증만 수행합니다.
- 본 업로드: 이전 활성 세트를 비활성화한 뒤 새 세트를 활성화합니다.

