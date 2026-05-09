# PASSmaster 오픈 체크리스트 (실행용)

## 1) 필수 환경변수

백엔드(`backend/.env`) 또는 배포 플랫폼 환경변수에 아래를 설정합니다.

- `NODE_ENV=production`
- `JWT_SECRET` (32자 이상 랜덤 문자열)
- `SUPABASE_DB_URL` (운영 DB)
- `CORS_ORIGINS` (실제 프론트 도메인만)
- `PUBLIC_API_URL` (실제 API URL)
- `ROOT_ADMIN_BOOTSTRAP=false`
- `AUTH_RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_WINDOW_MS`
- `ADMIN_WRITE_RATE_LIMIT_MAX`, `ADMIN_WRITE_RATE_LIMIT_WINDOW_MS`

초기 관리자 1회 생성이 꼭 필요할 때만:

- `ROOT_ADMIN_BOOTSTRAP=true`
- `ROOT_ADMIN_EMAIL`, `ROOT_ADMIN_PASSWORD`, `ROOT_ADMIN_NAME`

생성 완료 후 즉시 `ROOT_ADMIN_BOOTSTRAP=false`로 되돌립니다.

## 2) 데이터 안전성

- 운영 DB 자동 백업 활성화 (일 1회 이상)
- 복구 테스트 1회 수행 (백업 파일로 신규 DB 복원)
- 배포 전 `payment_audit_logs` 테이블 생성 여부 확인

## 3) 보안/운영 점검

- 관리자 로그인 정상
- 일반 사용자에서 `/admin/*` 접근 차단(403/리다이렉트)
- 응답 헤더 확인:
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `Referrer-Policy`
  - `Content-Security-Policy`
- 인증 API rate limit 동작 확인 (과도 요청 시 429)

## 4) 결제 흐름 점검

- 입금요청 -> 관리자 확인완료 -> 상태 집계 반영
- 부분환불/전액환불 -> 상태 집계 반영
- 감사로그(결제 상세) 생성 확인

## 5) 자동 스모크 테스트

백엔드 기준:

```bash
npm run smoke:open
```

필수 환경변수:

- `PASSMASTER_API_BASE` (기본값 `http://localhost:4000/api`)
- `PASSMASTER_ADMIN_EMAIL`
- `PASSMASTER_ADMIN_PASSWORD`

성공 시 `"[smoke] OK"` 출력과 함께 결제/감사로그 요약 JSON이 표시됩니다.

## 6) 오픈 직전 고정 절차

1. `git pull` 최신화
2. 백엔드 배포
3. 스모크 테스트 실행
4. 프론트 캐시 무효화/재배포
5. 실제 관리자 계정으로 최종 확인
6. 장애 대응 연락 채널 점검(담당자/시간대)

## 7) 오픈 후 24시간 모니터링

- 인증 실패율 급증 여부
- 결제 PATCH 실패/429 비율
- 5xx 에러 발생 여부
- 환불 요청 처리 지연 여부

