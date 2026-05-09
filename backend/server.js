require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 4000;
const NODE_ENV = String(process.env.NODE_ENV || "development").toLowerCase();
const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_EXPIRES_IN = "8h";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY || "";
const KAKAO_CLIENT_SECRET = process.env.KAKAO_CLIENT_SECRET || "";
const FRONTEND_URL = (process.env.FRONTEND_URL || "").replace(/\/$/, "");
const DATABASE_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
const ROOT_ADMIN_EMAIL = String(process.env.ROOT_ADMIN_EMAIL || "").trim().toLowerCase();
const ROOT_ADMIN_PASSWORD = String(process.env.ROOT_ADMIN_PASSWORD || "");
const ROOT_ADMIN_NAME = String(process.env.ROOT_ADMIN_NAME || "PASSmaster").trim() || "PASSmaster";
const ROOT_ADMIN_BOOTSTRAP = String(process.env.ROOT_ADMIN_BOOTSTRAP || "").toLowerCase() === "true";
const STRICT_ADMIN_EMAIL = "sanahai@naver.com";
const AUTH_RATE_LIMIT_MAX = Number(process.env.AUTH_RATE_LIMIT_MAX || 20);
const AUTH_RATE_LIMIT_WINDOW_MS = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
const ADMIN_WRITE_RATE_LIMIT_MAX = Number(process.env.ADMIN_WRITE_RATE_LIMIT_MAX || 120);
const ADMIN_WRITE_RATE_LIMIT_WINDOW_MS = Number(process.env.ADMIN_WRITE_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!DATABASE_URL) {
  console.error("SUPABASE_DB_URL (or DATABASE_URL) is required.");
  process.exit(1);
}
if (!JWT_SECRET) {
  console.error("JWT_SECRET is required.");
  process.exit(1);
}
if (NODE_ENV === "production" && JWT_SECRET.length < 32) {
  console.error("In production, JWT_SECRET must be at least 32 characters.");
  process.exit(1);
}

const requiresSsl = !/localhost|127\.0\.0\.1/.test(DATABASE_URL);
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: requiresSsl ? { rejectUnauthorized: false } : false,
});

function sendError(res, status, message, extra = {}) {
  return res.status(status).json({ message, ...extra });
}

function normalizeEmail(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function isStrictAdminEmail(value) {
  return normalizeEmail(value) === STRICT_ADMIN_EMAIL;
}

function resolveUserRole(email, storedRole) {
  if (isStrictAdminEmail(email)) return "admin";
  return "user";
}

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser clients (server-to-server, curl, health checks).
      if (!origin) return callback(null, true);
      if (CORS_ORIGINS.length === 0) return callback(null, true);
      if (CORS_ORIGINS.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // Keep CSP conservative without breaking current inline/static frontend assets.
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' https: data:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'self';"
  );
  next();
});
app.use(express.json());

function toPgSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

async function query(sql, params = []) {
  const text = toPgSql(sql);
  return pool.query(text, params);
}

async function run(sql, params = []) {
  return query(sql, params);
}

async function get(sql, params = []) {
  const result = await query(sql, params);
  return result.rows[0];
}

async function all(sql, params = []) {
  const result = await query(sql, params);
  return result.rows;
}

async function withTransaction(work) {
  const client = await pool.connect();
  const tx = {
    async run(sql, params = []) {
      return client.query(toPgSql(sql), params);
    },
    async get(sql, params = []) {
      const result = await client.query(toPgSql(sql), params);
      return result.rows[0];
    },
    async all(sql, params = []) {
      const result = await client.query(toPgSql(sql), params);
      return result.rows;
    },
  };
  try {
    await client.query("BEGIN");
    const result = await work(tx);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function toSafeMoney(value) {
  const num = Number(value || 0);
  return Number.isFinite(num) ? Math.max(0, Math.floor(num)) : 0;
}

async function summarizeEnrollmentPayments(enrollmentId, db = null) {
  const q = db || { get, all, run };
  const enrollment = await q.get(
    `SELECT e.id, e.payment_status, e.approval_status, c.price
     FROM public.enrollments e
     JOIN public.courses c ON c.id = e.course_id
     WHERE e.id = ?`,
    [enrollmentId]
  );
  if (!enrollment) return null;

  const agg = await q.get(
    `SELECT
       COALESCE(SUM(CASE WHEN status = 'completed' THEN amount ELSE 0 END), 0)::int AS completed_amount,
       COALESCE(SUM(CASE WHEN status = 'refunded' THEN amount ELSE 0 END), 0)::int AS refunded_amount,
       COUNT(*) FILTER (WHERE status = 'awaiting_confirmation')::int AS awaiting_count,
       COUNT(*) FILTER (WHERE status = 'completed')::int AS completed_count,
       COUNT(*) FILTER (WHERE status = 'refunded')::int AS refunded_count
     FROM public.payments
     WHERE enrollment_id = ?`,
    [enrollmentId]
  );

  const coursePrice = toSafeMoney(enrollment.price);
  const completedAmount = toSafeMoney(agg && agg.completed_amount);
  const refundedAmount = toSafeMoney(agg && agg.refunded_amount);
  const awaitingCount = Number((agg && agg.awaiting_count) || 0);
  const completedCount = Number((agg && agg.completed_count) || 0);
  const refundedCount = Number((agg && agg.refunded_count) || 0);
  const netPaid = Math.max(0, completedAmount - refundedAmount);
  const outstandingAmount = Math.max(0, coursePrice - netPaid);

  let paymentStatus = "pending";
  let approvalStatus = "pending";
  if (netPaid >= coursePrice && coursePrice > 0) {
    paymentStatus = "paid";
    approvalStatus = "approved";
  } else if (netPaid > 0) {
    paymentStatus = "partial_paid";
    approvalStatus = "pending";
  } else if (awaitingCount > 0) {
    paymentStatus = "deposit_submitted";
    approvalStatus = "pending";
  } else if (completedCount > 0 && refundedCount > 0 && netPaid === 0) {
    paymentStatus = "refunded";
    approvalStatus = "pending";
  }

  return {
    enrollmentId: Number(enrollmentId),
    coursePrice,
    completedAmount,
    refundedAmount,
    netPaid,
    outstandingAmount,
    awaitingCount,
    paymentStatus,
    approvalStatus,
  };
}

async function syncEnrollmentPaymentState(enrollmentId, db = null) {
  const q = db || { get, all, run };
  const summary = await summarizeEnrollmentPayments(enrollmentId, q);
  if (!summary) return null;
  await q.run("UPDATE public.enrollments SET payment_status = ?, approval_status = ? WHERE id = ?", [
    summary.paymentStatus,
    summary.approvalStatus,
    enrollmentId,
  ]);
  return summary;
}

async function logPaymentAudit(entry, db = null) {
  const q = db || { run };
  await q.run(
    `INSERT INTO public.payment_audit_logs
      (payment_id, enrollment_id, action, before_status, after_status, amount, note, actor_user_id, meta)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)`,
    [
      entry.paymentId || null,
      entry.enrollmentId || null,
      String(entry.action || "").trim() || "unknown",
      entry.beforeStatus || null,
      entry.afterStatus || null,
      entry.amount == null ? null : toSafeMoney(entry.amount),
      entry.note || null,
      entry.actorUserId || null,
      JSON.stringify(entry.meta && typeof entry.meta === "object" ? entry.meta : {}),
    ]
  );
}

function createRateLimiter({ windowMs, max, keyFn, message }) {
  const bucket = new Map();
  const safeWindow = Number.isFinite(windowMs) && windowMs > 0 ? windowMs : 60000;
  const safeMax = Number.isFinite(max) && max > 0 ? max : 60;
  return (req, res, next) => {
    const now = Date.now();
    const key = String((keyFn ? keyFn(req) : req.ip) || "unknown");
    const row = bucket.get(key);
    if (!row || row.expiresAt <= now) {
      bucket.set(key, { count: 1, expiresAt: now + safeWindow });
      return next();
    }
    row.count += 1;
    if (row.count > safeMax) {
      const retrySec = Math.max(1, Math.ceil((row.expiresAt - now) / 1000));
      res.setHeader("Retry-After", String(retrySec));
      return sendError(res, 429, message || "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.");
    }
    return next();
  };
}

const authRateLimiter = createRateLimiter({
  windowMs: AUTH_RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX,
  keyFn: (req) => `${req.ip || "ip"}:${String((req.body && req.body.email) || "").trim().toLowerCase()}`,
  message: "인증 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
});

const adminWriteRateLimiter = createRateLimiter({
  windowMs: ADMIN_WRITE_RATE_LIMIT_WINDOW_MS,
  max: ADMIN_WRITE_RATE_LIMIT_MAX,
  keyFn: (req) => `${req.ip || "ip"}:${req.auth && req.auth.sub ? req.auth.sub : "anon"}`,
  message: "관리자 변경 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
});

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
}

function getTokenFromHeader(req) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

function requireAuth(req, res, next) {
  const token = getTokenFromHeader(req);
  if (!token) return sendError(res, 401, "인증 토큰이 필요합니다.");
  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (_error) {
    return sendError(res, 401, "유효하지 않거나 만료된 토큰입니다.");
  }
}

function requireAdmin(req, res, next) {
  const email = req.auth && req.auth.email ? req.auth.email : "";
  if (!req.auth || req.auth.role !== "admin" || !isStrictAdminEmail(email)) {
    return sendError(res, 403, "관리자 권한이 필요합니다.");
  }
  return next();
}

function getPublicApiBase(req) {
  if (process.env.PUBLIC_API_URL) {
    return String(process.env.PUBLIC_API_URL).replace(/\/$/, "");
  }
  const proto = req.get("x-forwarded-proto") || req.protocol || "http";
  const host = req.get("x-forwarded-host") || req.get("host") || `localhost:${PORT}`;
  return `${proto}://${host}`;
}

function sanitizeOAuthReturnTo(raw) {
  if (!raw || typeof raw !== "string") return null;
  let url;
  try {
    url = new URL(raw);
  } catch (_error) {
    return null;
  }
  if (!/^https?:$/i.test(url.protocol)) return null;
  const allowed = CORS_ORIGINS.length ? CORS_ORIGINS : null;
  if (!allowed) {
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") return raw;
    if (url.hostname.endsWith(".github.io")) return raw;
    return null;
  }
  if (allowed.includes(url.origin)) return raw;
  return null;
}

function defaultLoginPageUrl() {
  if (FRONTEND_URL) return `${FRONTEND_URL}/login.html`;
  const first = CORS_ORIGINS[0];
  return first ? `${first}/login.html` : "http://localhost:5500/login.html";
}

function redirectOAuthError(res, returnTo, message) {
  const base = sanitizeOAuthReturnTo(returnTo) || defaultLoginPageUrl();
  const clean = base.split("#")[0];
  return res.redirect(302, `${clean}#pm_oauth_error=${encodeURIComponent(message)}`);
}

function sessionPayloadForUser(row) {
  const role = resolveUserRole(row.email, row.role);
  const user = {
    id: row.id,
    name: row.name,
    email: row.email,
    role,
    created_at: row.created_at,
  };
  const token = signToken(user);
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  return { token, expiresAt, user };
}

function redirectWithSession(res, returnTo, row) {
  const base = sanitizeOAuthReturnTo(returnTo) || defaultLoginPageUrl();
  const clean = base.split("#")[0];
  const payload = Buffer.from(JSON.stringify(sessionPayloadForUser(row)), "utf8").toString("base64url");
  return res.redirect(302, `${clean}#pm_auth=${payload}`);
}

async function findOrCreateOAuthUser({ googleId, kakaoId, email, name }) {
  const safeName = (String(name || "").trim() || "사용자").slice(0, 80);
  let safeEmail = normalizeEmail(email);
  if (!safeEmail || !safeEmail.includes("@")) {
    if (googleId) safeEmail = `google_${googleId}@oauth.passmaster.local`;
    else if (kakaoId) safeEmail = `kakao_${kakaoId}@oauth.passmaster.local`;
    else safeEmail = `oauth_${Date.now()}@oauth.passmaster.local`;
  }

  if (googleId) {
    const byG = await get("SELECT * FROM public.users WHERE google_id = ?", [String(googleId)]);
    if (byG) return byG;
  }
  if (kakaoId) {
    const byK = await get("SELECT * FROM public.users WHERE kakao_id = ?", [String(kakaoId)]);
    if (byK) return byK;
  }

  const byEmail = await get("SELECT * FROM public.users WHERE lower(trim(email)) = lower(trim(?))", [safeEmail]);
  if (byEmail) {
    const nextRole = resolveUserRole(byEmail.email, byEmail.role);
    if (nextRole !== byEmail.role) {
      await run("UPDATE public.users SET role = ? WHERE id = ?", [nextRole, byEmail.id]);
    }
    if (googleId && !byEmail.google_id) {
      await run("UPDATE public.users SET google_id = ? WHERE id = ?", [String(googleId), byEmail.id]);
    }
    if (kakaoId && !byEmail.kakao_id) {
      await run("UPDATE public.users SET kakao_id = ? WHERE id = ?", [String(kakaoId), byEmail.id]);
    }
    return await get("SELECT * FROM public.users WHERE id = ?", [byEmail.id]);
  }

  if (googleId) {
    const result = await run(
      `INSERT INTO public.users (name, email, password, role, google_id)
       VALUES (?, ?, NULL, 'user', ?) RETURNING id`,
      [safeName, safeEmail, String(googleId)]
    );
    return await get("SELECT * FROM public.users WHERE id = ?", [result.rows[0].id]);
  }
  if (kakaoId) {
    const result = await run(
      `INSERT INTO public.users (name, email, password, role, kakao_id)
       VALUES (?, ?, NULL, 'user', ?) RETURNING id`,
      [safeName, safeEmail, String(kakaoId)]
    );
    return await get("SELECT * FROM public.users WHERE id = ?", [result.rows[0].id]);
  }
  return null;
}

async function migrateAuthOAuthColumns() {
  try {
    await run(`ALTER TABLE public.users ALTER COLUMN password DROP NOT NULL`);
  } catch (_error) {
    /* ignore if already nullable */
  }
  await run(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS google_id TEXT`);
  await run(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS kakao_id TEXT`);
  await run(
    `CREATE UNIQUE INDEX IF NOT EXISTS users_google_id_uidx ON public.users (google_id) WHERE google_id IS NOT NULL`
  );
  await run(
    `CREATE UNIQUE INDEX IF NOT EXISTS users_kakao_id_uidx ON public.users (kakao_id) WHERE kakao_id IS NOT NULL`
  );
}

async function initSchema() {
  await run(`
    CREATE TABLE IF NOT EXISTS public.users (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      google_id TEXT,
      kakao_id TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS public.courses (
      id BIGSERIAL PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS public.course_openings (
      id BIGSERIAL PRIMARY KEY,
      course_id BIGINT NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
      start_date DATE,
      end_date DATE,
      application_status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS public.enrollments (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES public.users(id),
      course_id BIGINT NOT NULL REFERENCES public.courses(id),
      payment_status TEXT NOT NULL,
      approval_status TEXT NOT NULL,
      progress_percent INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await run(`ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS opening_id BIGINT`);
  await run(`ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS application_status TEXT`);
  await run(`ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS learning_status TEXT`);

  await run(`
    CREATE TABLE IF NOT EXISTS public.payments (
      id BIGSERIAL PRIMARY KEY,
      enrollment_id BIGINT NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
      amount INTEGER NOT NULL,
      method TEXT NOT NULL DEFAULT 'bank_transfer',
      status TEXT NOT NULL DEFAULT 'pending',
      depositor_name TEXT,
      transfer_note TEXT,
      submitted_at TIMESTAMPTZ,
      reviewed_by BIGINT REFERENCES public.users(id),
      review_note TEXT,
      reviewed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await run(`ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS depositor_name TEXT`);
  await run(`ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS transfer_note TEXT`);
  await run(`ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ`);
  await run(`ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS reviewed_by BIGINT REFERENCES public.users(id)`);
  await run(`ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS review_note TEXT`);
  await run(`ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ`);
  await run(`
    CREATE TABLE IF NOT EXISTS public.payment_audit_logs (
      id BIGSERIAL PRIMARY KEY,
      payment_id BIGINT REFERENCES public.payments(id) ON DELETE SET NULL,
      enrollment_id BIGINT NOT NULL REFERENCES public.enrollments(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      before_status TEXT,
      after_status TEXT,
      amount INTEGER,
      note TEXT,
      actor_user_id BIGINT REFERENCES public.users(id) ON DELETE SET NULL,
      meta JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS payment_audit_logs_enrollment_idx ON public.payment_audit_logs (enrollment_id, id DESC)`);

  await run(`
    CREATE TABLE IF NOT EXISTS public.faqs (
      id BIGSERIAL PRIMARY KEY,
      category TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      view_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS public.inquiries (
      id BIGSERIAL PRIMARY KEY,
      user_name TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL,
      assignee_name TEXT,
      status_updated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS public.inquiry_messages (
      id BIGSERIAL PRIMARY KEY,
      inquiry_id BIGINT NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
      author_role TEXT NOT NULL,
      author_name TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS public.reviews (
      id BIGSERIAL PRIMARY KEY,
      course_code TEXT NOT NULL,
      cert_slug TEXT,
      user_id BIGINT REFERENCES public.users(id),
      author_name TEXT NOT NULL,
      score INTEGER NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL,
      moderation_note TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await run(`ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS cert_slug TEXT`);
  await run(`ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS user_id BIGINT REFERENCES public.users(id)`);
  await run(`ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS moderation_note TEXT`);
  await run(`ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`);
  await run(`UPDATE public.reviews SET cert_slug = lower(course_code) WHERE cert_slug IS NULL OR cert_slug = ''`);
  await run(`CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON public.reviews (user_id)`);
  await run(`CREATE INDEX IF NOT EXISTS reviews_status_idx ON public.reviews (status)`);

  await run(`
    CREATE TABLE IF NOT EXISTS public.study_artifacts (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      cert_slug TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await run(
    `CREATE UNIQUE INDEX IF NOT EXISTS study_artifacts_user_cert_uidx ON public.study_artifacts (user_id, cert_slug)`
  );
}

async function seedData() {
  const userCount = await get("SELECT COUNT(*)::int AS count FROM public.users");
  if (userCount.count === 0) {
    const adminHash = await bcrypt.hash("admin1234", 10);
    const student1Hash = await bcrypt.hash("pass1234", 10);
    const student2Hash = await bcrypt.hash("pass1234", 10);
    await run(
      `INSERT INTO public.users (name, email, password, role) VALUES
      ('관리자', 'admin@passmaster.kr', ?, 'admin'),
      ('김수강', 'student1@passmaster.kr', ?, 'user'),
      ('박학습', 'student2@passmaster.kr', ?, 'user')`,
      [adminHash, student1Hash, student2Hash]
    );
  }

  const courseCount = await get("SELECT COUNT(*)::int AS count FROM public.courses");
  if (courseCount.count === 0) {
    await run(
      `INSERT INTO public.courses (code, title, category, price, status) VALUES
      ('IS', '산업안전기사 필기 완성반', '안전관리', 9900, 'open'),
      ('EE', '전기기사 필기 완성반', '전기이론', 9900, 'open'),
      ('IT', '정보처리기사 필기 완성반', '소프트웨어', 9900, 'open')`
    );
  }
  await run(`UPDATE public.courses SET price = 9900`);

  const openingCount = await get("SELECT COUNT(*)::int AS count FROM public.course_openings");
  if (openingCount.count === 0) {
    const isCourse = await get("SELECT id FROM public.courses WHERE code = ?", ["IS"]);
    const eeCourse = await get("SELECT id FROM public.courses WHERE code = ?", ["EE"]);
    const itCourse = await get("SELECT id FROM public.courses WHERE code = ?", ["IT"]);
    await run(
      `INSERT INTO public.course_openings (course_id, start_date, end_date, application_status) VALUES
      (?, '2026-06-01', '2026-08-31', 'open'),
      (?, '2026-06-15', '2026-09-15', 'open'),
      (?, '2026-07-01', '2026-09-30', 'open')`,
      [isCourse.id, eeCourse.id, itCourse.id]
    );
  }

  await run(
    `UPDATE public.enrollments e
     SET opening_id = o.id,
         application_status = COALESCE(e.application_status, 'submitted'),
         learning_status = COALESCE(
           e.learning_status,
           CASE
             WHEN e.progress_percent >= 100 THEN 'completed'
             WHEN e.progress_percent > 0 THEN 'in_progress'
             ELSE 'not_started'
           END
         )
     FROM (
       SELECT DISTINCT ON (course_id) id, course_id
       FROM public.course_openings
       ORDER BY course_id, id ASC
     ) o
     WHERE e.opening_id IS NULL AND e.course_id = o.course_id`
  );

  const enrollmentCount = await get("SELECT COUNT(*)::int AS count FROM public.enrollments");
  if (enrollmentCount.count === 0) {
    const student1 = await get("SELECT id FROM public.users WHERE email = ?", ["student1@passmaster.kr"]);
    const student2 = await get("SELECT id FROM public.users WHERE email = ?", ["student2@passmaster.kr"]);
    const isCourse = await get("SELECT id FROM public.courses WHERE code = ?", ["IS"]);
    const eeCourse = await get("SELECT id FROM public.courses WHERE code = ?", ["EE"]);
    const itCourse = await get("SELECT id FROM public.courses WHERE code = ?", ["IT"]);
    const o1 = await get("SELECT id FROM public.course_openings WHERE course_id = ? ORDER BY id ASC LIMIT 1", [
      isCourse.id,
    ]);
    const o2 = await get("SELECT id FROM public.course_openings WHERE course_id = ? ORDER BY id ASC LIMIT 1", [
      eeCourse.id,
    ]);
    const o3 = await get("SELECT id FROM public.course_openings WHERE course_id = ? ORDER BY id ASC LIMIT 1", [
      itCourse.id,
    ]);
    await run(
      `INSERT INTO public.enrollments (user_id, course_id, opening_id, payment_status, approval_status, application_status, learning_status, progress_percent) VALUES
      (?, ?, ?, 'paid', 'approved', 'submitted', 'in_progress', 64),
      (?, ?, ?, 'paid', 'pending', 'submitted', 'not_started', 10),
      (?, ?, ?, 'paid', 'approved', 'submitted', 'in_progress', 82)`,
      [student1.id, isCourse.id, o1.id, student1.id, eeCourse.id, o2.id, student2.id, itCourse.id, o3.id]
    );
  }

  const paymentCount = await get("SELECT COUNT(*)::int AS count FROM public.payments");
  if (paymentCount.count === 0) {
    const rows = await all(
      `SELECT e.id, e.payment_status, c.price FROM public.enrollments e JOIN public.courses c ON c.id = e.course_id`
    );
    for (const row of rows) {
      await run(
        `INSERT INTO public.payments (enrollment_id, amount, method, status) VALUES (?, ?, 'bank_transfer', ?)`,
        [row.id, row.price, row.payment_status === "paid" ? "completed" : "pending"]
      );
    }
  }
  await run(
    `UPDATE public.payments p
     SET amount = c.price
     FROM public.enrollments e
     JOIN public.courses c ON c.id = e.course_id
     WHERE p.enrollment_id = e.id`
  );

  const faqCount = await get("SELECT COUNT(*)::int AS count FROM public.faqs");
  if (faqCount.count === 0) {
    await run(
      `INSERT INTO public.faqs (category, question, answer, view_count) VALUES
      ('결제', '입금 확인은 얼마나 걸리나요?', '평일 기준 평균 10~30분 내 확인됩니다.', 184),
      ('학습', '모바일 수강이 가능한가요?', '모바일/태블릿/PC에서 모두 수강 가능합니다.', 143),
      ('환불', '환불 규정은 어떻게 되나요?', '진행률과 이용 기간 기준으로 환불 금액이 산정됩니다.', 209)`
    );
  }

  const inquiryCount = await get("SELECT COUNT(*)::int AS count FROM public.inquiries");
  if (inquiryCount.count === 0) {
    await run(
      `INSERT INTO public.inquiries (user_name, type, title, content, status) VALUES
      ('김수강', '결제', '결제 영수증 발급 문의', '영수증을 이메일로 받을 수 있나요?', 'processing'),
      ('박학습', '학습', '진도율 반영 지연', '강의 시청 후 진도율이 바로 반영되지 않습니다.', 'received')`
    );
  }

  const inquiryMessageCount = await get("SELECT COUNT(*)::int AS count FROM public.inquiry_messages");
  if (inquiryMessageCount.count === 0) {
    await run(
      `INSERT INTO public.inquiry_messages (inquiry_id, author_role, author_name, message) VALUES
      (1, 'user', '김수강', '영수증을 회사 제출용으로 발급받아야 합니다.'),
      (1, 'admin', '운영팀 김담당', '이메일로 전자영수증 발급 링크를 발송해드렸습니다.'),
      (2, 'user', '박학습', '어제 시청한 2강 진도율이 반영되지 않습니다.')`
    );
  }

  const reviewCount = await get("SELECT COUNT(*)::int AS count FROM public.reviews");
  if (reviewCount.count === 0) {
    await run(
      `INSERT INTO public.reviews (course_code, author_name, score, content, status) VALUES
      ('IS', '김OO', 5, '복습 루틴이 체계적이라 합격에 큰 도움이 됐습니다.', 'approved'),
      ('EE', '박OO', 4, '오답 반복 기능이 좋았고 계산 문제 정리가 유익했습니다.', 'approved')`
    );
  }

  // 운영 오픈 보안: ROOT_ADMIN_BOOTSTRAP=true일 때만 1회 부트스트랩
  if (ROOT_ADMIN_BOOTSTRAP && ROOT_ADMIN_PASSWORD) {
    const normalizedRootEmail = STRICT_ADMIN_EMAIL;
    const rootRow = await get("SELECT id FROM public.users WHERE lower(trim(email)) = lower(trim(?))", [
      normalizedRootEmail,
    ]);
    if (!rootRow) {
      const rootHash = await bcrypt.hash(ROOT_ADMIN_PASSWORD, 10);
      await run("INSERT INTO public.users (name, email, password, role) VALUES (?, ?, ?, 'admin')", [
        ROOT_ADMIN_NAME,
        normalizedRootEmail,
        rootHash,
      ]);
    }
  }
}

app.get("/api/health", async (req, res) => {
  const row = await get("SELECT now() AS now");
  res.json({ ok: true, serverTime: row.now });
});

app.get("/api/docs", async (req, res) => {
  res.json({
    name: "PASSmaster API",
    version: "2026-05",
    basePath: "/api",
    auth: {
      type: "bearer",
      header: "Authorization: Bearer <token>",
    },
    endpoints: [
      { method: "GET", path: "/health" },
      { method: "GET", path: "/courses" },
      { method: "GET", path: "/course-openings" },
      { method: "GET", path: "/course-openings/:id" },
      { method: "POST", path: "/enrollments", auth: true },
      { method: "GET", path: "/me/enrollments", auth: true },
      { method: "GET", path: "/me/enrollments/:id", auth: true },
      { method: "PATCH", path: "/me/enrollments/:id/deposit", auth: true, notes: "계좌이체 입금요청" },
      { method: "GET", path: "/me/payments", auth: true },
      { method: "GET", path: "/faqs" },
      { method: "GET", path: "/reviews" },
      { method: "GET", path: "/me/reviews", auth: true },
      { method: "POST", path: "/me/reviews", auth: true },
      { method: "DELETE", path: "/me/reviews/:id", auth: true },
      { method: "GET", path: "/me/study-artifact/:certSlug", auth: true },
      { method: "PUT", path: "/me/study-artifact/:certSlug", auth: true },
      { method: "GET", path: "/inquiries" },
      { method: "GET", path: "/inquiries/:id" },
      { method: "POST", path: "/inquiries", auth: true },
      { method: "POST", path: "/auth/register" },
      { method: "POST", path: "/auth/login" },
      { method: "GET", path: "/auth/oauth/public-config" },
      { method: "GET", path: "/auth/oauth/google/start" },
      { method: "GET", path: "/auth/oauth/google/callback" },
      { method: "GET", path: "/auth/oauth/kakao/start" },
      { method: "GET", path: "/auth/oauth/kakao/callback" },
      { method: "GET", path: "/auth/me", auth: true },
      { method: "PATCH", path: "/auth/password", auth: true },
      { method: "GET", path: "/admin/dashboard", auth: true, admin: true },
      { method: "GET", path: "/admin/enrollments", auth: true, admin: true },
      { method: "GET", path: "/admin/enrollments/:id", auth: true, admin: true },
      { method: "PATCH", path: "/admin/enrollments/:id", auth: true, admin: true },
      { method: "GET", path: "/admin/payments", auth: true, admin: true },
      { method: "GET", path: "/admin/payments/:id", auth: true, admin: true },
      { method: "GET", path: "/admin/payments/:id/audit", auth: true, admin: true },
      { method: "PATCH", path: "/admin/payments/:id", auth: true, admin: true },
      { method: "PATCH", path: "/inquiries/:id/status", auth: true, admin: true },
      { method: "PATCH", path: "/inquiries/:id/assignee", auth: true, admin: true },
      { method: "POST", path: "/inquiries/:id/messages", auth: true, admin: true },
      { method: "GET", path: "/admin/reviews", auth: true, admin: true },
      { method: "PATCH", path: "/admin/reviews/:id", auth: true, admin: true },
    ],
    notes: [
      "성공 응답은 JSON입니다.",
      "실패 응답은 HTTP status + { message } 형태로 반환됩니다.",
    ],
  });
});

app.get("/api/courses", async (req, res) => {
  const rows = await all("SELECT * FROM public.courses ORDER BY id DESC");
  res.json(rows);
});

app.get("/api/faqs", async (req, res) => {
  const rows = await all("SELECT * FROM public.faqs ORDER BY view_count DESC");
  res.json(rows);
});

app.get("/api/reviews", async (req, res) => {
  const certSlug = String(req.query.certSlug || "").trim().toLowerCase();
  const params = ["approved"];
  let sql = "SELECT * FROM public.reviews WHERE status = ?";
  if (certSlug) {
    sql += " AND lower(cert_slug) = ?";
    params.push(certSlug);
  }
  sql += " ORDER BY id DESC";
  const rows = await all(sql, params);
  res.json(rows);
});

app.get("/api/me/study-artifact/:certSlug", requireAuth, async (req, res) => {
  const certSlug = String(req.params.certSlug || "").trim().toLowerCase();
  if (!certSlug) return sendError(res, 400, "certSlug가 필요합니다.");
  const row = await get(
    `SELECT cert_slug, payload, updated_at
     FROM public.study_artifacts
     WHERE user_id = ? AND cert_slug = ?`,
    [req.auth.sub, certSlug]
  );
  if (!row) return res.json({ certSlug, payload: {}, updatedAt: null });
  return res.json({
    certSlug: row.cert_slug,
    payload: row.payload || {},
    updatedAt: row.updated_at,
  });
});

app.put("/api/me/study-artifact/:certSlug", requireAuth, async (req, res) => {
  const certSlug = String(req.params.certSlug || "").trim().toLowerCase();
  if (!certSlug) return sendError(res, 400, "certSlug가 필요합니다.");
  const rawPayload = req.body && typeof req.body.payload === "object" ? req.body.payload : {};
  const safePayload = {
    wrongNotes: Array.isArray(rawPayload.wrongNotes) ? rawPayload.wrongNotes.slice(0, 500) : [],
    reviewSeed:
      rawPayload.reviewSeed && typeof rawPayload.reviewSeed === "object" ? rawPayload.reviewSeed : {},
    qaChecklist:
      rawPayload.qaChecklist && typeof rawPayload.qaChecklist === "object" ? rawPayload.qaChecklist : {},
  };
  await run(
    `INSERT INTO public.study_artifacts (user_id, cert_slug, payload, updated_at)
     VALUES (?, ?, ?::jsonb, now())
     ON CONFLICT (user_id, cert_slug)
     DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
    [req.auth.sub, certSlug, JSON.stringify(safePayload)]
  );
  const updated = await get(
    "SELECT cert_slug, payload, updated_at FROM public.study_artifacts WHERE user_id = ? AND cert_slug = ?",
    [req.auth.sub, certSlug]
  );
  return res.json({
    ok: true,
    certSlug: updated.cert_slug,
    payload: updated.payload || {},
    updatedAt: updated.updated_at,
  });
});

app.get("/api/me/reviews", requireAuth, async (req, res) => {
  const certSlug = String(req.query.certSlug || "").trim().toLowerCase();
  const params = [req.auth.sub];
  let sql = "SELECT * FROM public.reviews WHERE user_id = ?";
  if (certSlug) {
    sql += " AND lower(cert_slug) = ?";
    params.push(certSlug);
  }
  sql += " ORDER BY id DESC";
  const rows = await all(sql, params);
  return res.json(rows);
});

app.post("/api/me/reviews", requireAuth, async (req, res) => {
  const certSlug = String(req.body.certSlug || "").trim().toLowerCase();
  const score = Number(req.body.score);
  const content = String(req.body.content || "").trim();
  if (!certSlug) return sendError(res, 400, "certSlug가 필요합니다.");
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return sendError(res, 400, "score는 1~5 범위여야 합니다.");
  }
  if (content.length < 10) return sendError(res, 400, "후기 내용은 10자 이상 작성해 주세요.");
  const user = await get("SELECT id, name FROM public.users WHERE id = ?", [req.auth.sub]);
  if (!user) return sendError(res, 404, "사용자를 찾을 수 없습니다.");
  const courseCode = certSlug.slice(0, 20).toUpperCase();
  const inserted = await run(
    `INSERT INTO public.reviews
      (course_code, cert_slug, user_id, author_name, score, content, status, moderation_note, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', NULL, now())
     RETURNING id`,
    [courseCode, certSlug, user.id, user.name, score, content]
  );
  const created = await get("SELECT * FROM public.reviews WHERE id = ?", [inserted.rows[0].id]);
  return res.status(201).json(created);
});

app.delete("/api/me/reviews/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return sendError(res, 400, "유효한 리뷰 ID가 필요합니다.");
  const exists = await get("SELECT id FROM public.reviews WHERE id = ? AND user_id = ?", [id, req.auth.sub]);
  if (!exists) return sendError(res, 404, "리뷰를 찾을 수 없습니다.");
  await run("DELETE FROM public.reviews WHERE id = ? AND user_id = ?", [id, req.auth.sub]);
  return res.json({ ok: true });
});

app.get("/api/admin/reviews", requireAuth, requireAdmin, async (req, res) => {
  const status = String(req.query.status || "").trim().toLowerCase();
  const certSlug = String(req.query.certSlug || "").trim().toLowerCase();
  const params = [];
  const where = [];
  if (status) {
    where.push("lower(status) = ?");
    params.push(status);
  }
  if (certSlug) {
    where.push("lower(cert_slug) = ?");
    params.push(certSlug);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const rows = await all(
    `SELECT r.*, u.email AS user_email
     FROM public.reviews r
     LEFT JOIN public.users u ON u.id = r.user_id
     ${whereSql}
     ORDER BY r.id DESC`,
    params
  );
  return res.json(rows);
});

app.patch("/api/admin/reviews/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || "").trim().toLowerCase();
  const moderationNote =
    req.body.moderationNote == null ? null : String(req.body.moderationNote || "").trim().slice(0, 1000);
  const allowed = new Set(["pending", "approved", "hidden", "rejected"]);
  if (!Number.isInteger(id) || id <= 0) return sendError(res, 400, "유효한 리뷰 ID가 필요합니다.");
  if (!allowed.has(status)) return sendError(res, 400, "status 값이 올바르지 않습니다.");
  const exists = await get("SELECT id FROM public.reviews WHERE id = ?", [id]);
  if (!exists) return sendError(res, 404, "리뷰를 찾을 수 없습니다.");
  await run("UPDATE public.reviews SET status = ?, moderation_note = ?, updated_at = now() WHERE id = ?", [
    status,
    moderationNote,
    id,
  ]);
  const updated = await get("SELECT * FROM public.reviews WHERE id = ?", [id]);
  return res.json(updated);
});

app.get("/api/inquiries", async (req, res) => {
  const { status, type, q, page = "1", pageSize = "10" } = req.query;
  const pageNumber = Number(page);
  const sizeNumber = Number(pageSize);
  const safePage = Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;
  const safePageSize =
    Number.isInteger(sizeNumber) && sizeNumber > 0 && sizeNumber <= 100 ? sizeNumber : 10;

  const where = [];
  const params = [];
  if (status) {
    where.push("status = ?");
    params.push(status);
  }
  if (type) {
    where.push("type = ?");
    params.push(type);
  }
  if (q) {
    where.push("(title ILIKE ? OR content ILIKE ? OR user_name ILIKE ?)");
    const keyword = `%${q}%`;
    params.push(keyword, keyword, keyword);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const countRow = await get(`SELECT COUNT(*)::int AS count FROM public.inquiries ${whereSql}`, params);
  const total = countRow ? countRow.count : 0;
  const offset = (safePage - 1) * safePageSize;
  const rows = await all(
    `SELECT * FROM public.inquiries ${whereSql} ORDER BY id DESC LIMIT ?::int OFFSET ?::int`,
    [...params, safePageSize, offset]
  );

  res.json({
    items: rows,
    meta: {
      total,
      page: safePage,
      pageSize: safePageSize,
      totalPages: Math.max(1, Math.ceil(total / safePageSize)),
    },
  });
});

app.get("/api/inquiries/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, 400, "유효한 문의 ID가 필요합니다.");
  }
  const row = await get("SELECT * FROM public.inquiries WHERE id = ?", [id]);
  if (!row) {
    return sendError(res, 404, "문의를 찾을 수 없습니다.");
  }
  const messages = await all(
    "SELECT id, inquiry_id, author_role, author_name, message, created_at FROM public.inquiry_messages WHERE inquiry_id = ? ORDER BY id ASC",
    [id]
  );
  return res.json({ ...row, messages });
});

app.post("/api/inquiries", requireAuth, async (req, res) => {
  const { userName, type, title, content } = req.body;
  if (!userName || !type || !title || !content) {
    return sendError(res, 400, "필수 입력값이 누락되었습니다.");
  }
  const result = await run(
    "INSERT INTO public.inquiries (user_name, type, title, content, status) VALUES (?, ?, ?, ?, 'received') RETURNING id",
    [userName, type, title, content]
  );
  const created = await get("SELECT * FROM public.inquiries WHERE id = ?", [result.rows[0].id]);
  return res.status(201).json(created);
});

app.patch("/api/inquiries/:id/status", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  const allowedStatus = ["received", "processing", "done"];
  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, 400, "유효한 문의 ID가 필요합니다.");
  }
  if (!allowedStatus.includes(status)) {
    return sendError(res, 400, "유효한 상태값이 아닙니다.");
  }
  const exists = await get("SELECT id FROM public.inquiries WHERE id = ?", [id]);
  if (!exists) {
    return sendError(res, 404, "문의를 찾을 수 없습니다.");
  }
  await run("UPDATE public.inquiries SET status = ?, status_updated_at = now() WHERE id = ?", [
    status,
    id,
  ]);
  const updated = await get("SELECT * FROM public.inquiries WHERE id = ?", [id]);
  return res.json(updated);
});

app.patch("/api/inquiries/:id/assignee", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { assigneeName } = req.body;
  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, 400, "유효한 문의 ID가 필요합니다.");
  }
  if (!assigneeName || !String(assigneeName).trim()) {
    return sendError(res, 400, "담당자명을 입력해 주세요.");
  }
  const exists = await get("SELECT id FROM public.inquiries WHERE id = ?", [id]);
  if (!exists) {
    return sendError(res, 404, "문의를 찾을 수 없습니다.");
  }
  await run("UPDATE public.inquiries SET assignee_name = ? WHERE id = ?", [
    String(assigneeName).trim(),
    id,
  ]);
  const updated = await get("SELECT * FROM public.inquiries WHERE id = ?", [id]);
  return res.json(updated);
});

app.post("/api/inquiries/:id/messages", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { message } = req.body;
  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, 400, "유효한 문의 ID가 필요합니다.");
  }
  if (!message || !String(message).trim()) {
    return sendError(res, 400, "답변 내용을 입력해 주세요.");
  }
  const inquiry = await get("SELECT id FROM public.inquiries WHERE id = ?", [id]);
  if (!inquiry) {
    return sendError(res, 404, "문의를 찾을 수 없습니다.");
  }
  const authorName = req.auth.role === "admin" ? "운영팀 관리자" : "운영자";
  const result = await run(
    "INSERT INTO public.inquiry_messages (inquiry_id, author_role, author_name, message) VALUES (?, 'admin', ?, ?) RETURNING id",
    [id, authorName, String(message).trim()]
  );
  const created = await get("SELECT * FROM public.inquiry_messages WHERE id = ?", [result.rows[0].id]);
  return res.status(201).json(created);
});

app.post("/api/auth/register", authRateLimiter, async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return sendError(res, 400, "name, email, password는 필수입니다.");
  }
  const safeEmail = normalizeEmail(email);
  if (isStrictAdminEmail(safeEmail)) {
    return sendError(res, 403, "해당 이메일은 관리자 전용 계정입니다. 일반 회원가입이 불가합니다.");
  }
  if (password.length < 8) {
    return sendError(res, 400, "비밀번호는 8자 이상이어야 합니다.");
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await run(
      "INSERT INTO public.users (name, email, password, role) VALUES (?, ?, ?, 'user') RETURNING id",
      [name, safeEmail, hash]
    );
    const user = await get("SELECT id, name, email, role, created_at FROM public.users WHERE id = ?", [
      result.rows[0].id,
    ]);
    return res.status(201).json(user);
  } catch (error) {
    if (String(error.message).includes("duplicate key")) {
      return sendError(res, 409, "이미 등록된 이메일입니다.");
    }
    throw error;
  }
});

app.post("/api/auth/login", authRateLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return sendError(res, 400, "email, password는 필수입니다.");
  }
  const safeEmail = normalizeEmail(email);
  const row = await get("SELECT * FROM public.users WHERE lower(trim(email)) = lower(trim(?))", [safeEmail]);
  if (!row) {
    return sendError(res, 401, "이메일 또는 비밀번호가 올바르지 않습니다.");
  }
  if (!row.password) {
    return sendError(
      res,
      401,
      "이 계정은 구글 또는 카카오 로그인으로 가입되었습니다. 소셜 로그인을 이용해 주세요."
    );
  }

  let passwordMatched = false;
  if (row.password.startsWith("$2")) {
    passwordMatched = await bcrypt.compare(password, row.password);
  } else if (row.password === password) {
    passwordMatched = true;
    const upgradedHash = await bcrypt.hash(password, 10);
    await run("UPDATE public.users SET password = ? WHERE id = ?", [upgradedHash, row.id]);
  }
  if (!passwordMatched) {
    return sendError(res, 401, "이메일 또는 비밀번호가 올바르지 않습니다.");
  }

  const role = resolveUserRole(row.email, row.role);
  if (role !== row.role) {
    await run("UPDATE public.users SET role = ? WHERE id = ?", [role, row.id]);
  }
  const user = {
    id: row.id,
    name: row.name,
    email: row.email,
    role,
    created_at: row.created_at,
  };
  const token = signToken(user);
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  return res.json({ token, expiresAt, user });
});

app.get("/api/auth/oauth/public-config", (_req, res) => {
  const googleEnabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
  const kakaoEnabled = Boolean(KAKAO_REST_API_KEY);
  res.json({
    googleEnabled,
    kakaoEnabled,
    googleClientId: googleEnabled ? GOOGLE_CLIENT_ID : null,
  });
});

app.get("/api/auth/oauth/google/start", (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return redirectOAuthError(res, req.query.returnTo, "Google 로그인이 아직 구성되지 않았습니다.");
  }
  const returnTo = sanitizeOAuthReturnTo(req.query.returnTo) || null;
  const state = jwt.sign({ v: 1, provider: "google", returnTo }, JWT_SECRET, { expiresIn: "10m" });
  const redirectUri = `${getPublicApiBase(req)}/api/auth/oauth/google/callback`;
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return res.redirect(302, url.toString());
});

app.get("/api/auth/oauth/google/callback", async (req, res) => {
  const { code, state, error, error_description: errDesc } = req.query;
  let returnTo = null;
  try {
    const decoded = jwt.verify(String(state || ""), JWT_SECRET);
    returnTo = decoded.returnTo || null;
  } catch (_e) {
    return redirectOAuthError(res, null, "로그인 요청이 만료되었습니다. 다시 시도해 주세요.");
  }
  if (error) {
    return redirectOAuthError(res, returnTo, String(errDesc || error));
  }
  if (!code) {
    return redirectOAuthError(res, returnTo, "Google 인증 코드를 받지 못했습니다.");
  }
  try {
    const redirectUri = `${getPublicApiBase(req)}/api/auth/oauth/google/callback`;
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) {
      return redirectOAuthError(
        res,
        returnTo,
        String(tokenJson.error_description || tokenJson.error || "Google 토큰 교환 실패")
      );
    }
    const ui = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const profile = await ui.json();
    const row = await findOrCreateOAuthUser({
      googleId: profile.sub,
      kakaoId: null,
      email: profile.email,
      name: profile.name || profile.given_name || profile.email,
    });
    if (!row) return redirectOAuthError(res, returnTo, "사용자 정보를 저장하지 못했습니다.");
    return redirectWithSession(res, returnTo, row);
  } catch (e) {
    console.error(e);
    return redirectOAuthError(res, returnTo, "Google 로그인 처리 중 오류가 발생했습니다.");
  }
});

app.get("/api/auth/oauth/kakao/start", (req, res) => {
  if (!KAKAO_REST_API_KEY) {
    return redirectOAuthError(res, req.query.returnTo, "카카오 로그인이 아직 구성되지 않았습니다.");
  }
  const returnTo = sanitizeOAuthReturnTo(req.query.returnTo) || null;
  const state = jwt.sign({ v: 1, provider: "kakao", returnTo }, JWT_SECRET, { expiresIn: "10m" });
  const redirectUri = `${getPublicApiBase(req)}/api/auth/oauth/kakao/callback`;
  const url = new URL("https://kauth.kakao.com/oauth/authorize");
  url.searchParams.set("client_id", KAKAO_REST_API_KEY);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  url.searchParams.set("scope", "profile_nickname account_email");
  return res.redirect(302, url.toString());
});

app.get("/api/auth/oauth/kakao/callback", async (req, res) => {
  const { code, state, error, error_description: errDesc } = req.query;
  let returnTo = null;
  try {
    const decoded = jwt.verify(String(state || ""), JWT_SECRET);
    returnTo = decoded.returnTo || null;
  } catch (_e) {
    return redirectOAuthError(res, null, "로그인 요청이 만료되었습니다. 다시 시도해 주세요.");
  }
  if (error) {
    return redirectOAuthError(res, returnTo, String(errDesc || error));
  }
  if (!code) {
    return redirectOAuthError(res, returnTo, "카카오 인증 코드를 받지 못했습니다.");
  }
  try {
    const redirectUri = `${getPublicApiBase(req)}/api/auth/oauth/kakao/callback`;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: KAKAO_REST_API_KEY,
      redirect_uri: redirectUri,
      code: String(code),
    });
    if (KAKAO_CLIENT_SECRET) body.set("client_secret", KAKAO_CLIENT_SECRET);
    const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      return redirectOAuthError(
        res,
        returnTo,
        String(tokenJson.error_description || tokenJson.error || "카카오 토큰 교환 실패")
      );
    }
    const meRes = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    });
    const profile = await meRes.json();
    if (!meRes.ok || !profile.id) {
      return redirectOAuthError(res, returnTo, "카카오 사용자 정보를 가져오지 못했습니다.");
    }
    const acct = profile.kakao_account || {};
    const nick = acct.profile && acct.profile.nickname ? acct.profile.nickname : "카카오 사용자";
    const row = await findOrCreateOAuthUser({
      googleId: null,
      kakaoId: String(profile.id),
      email: acct.email || "",
      name: nick,
    });
    if (!row) return redirectOAuthError(res, returnTo, "사용자 정보를 저장하지 못했습니다.");
    return redirectWithSession(res, returnTo, row);
  } catch (e) {
    console.error(e);
    return redirectOAuthError(res, returnTo, "카카오 로그인 처리 중 오류가 발생했습니다.");
  }
});

app.patch("/api/auth/password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return sendError(res, 400, "현재 비밀번호와 새 비밀번호를 모두 입력해 주세요.");
  }
  if (String(newPassword).length < 8) {
    return sendError(res, 400, "새 비밀번호는 8자 이상이어야 합니다.");
  }
  if (currentPassword === newPassword) {
    return sendError(res, 400, "새 비밀번호는 현재 비밀번호와 달라야 합니다.");
  }

  const row = await get("SELECT id, password FROM public.users WHERE id = ?", [req.auth.sub]);
  if (!row) {
    return sendError(res, 404, "사용자를 찾을 수 없습니다.");
  }
  if (!row.password) {
    return sendError(res, 400, "소셜 로그인 계정은 비밀번호가 없습니다. 구글/카카오로 로그인해 주세요.");
  }

  let passwordMatched = false;
  if (row.password.startsWith("$2")) {
    passwordMatched = await bcrypt.compare(currentPassword, row.password);
  } else if (row.password === currentPassword) {
    // Legacy plain-text record migration path.
    passwordMatched = true;
  }
  if (!passwordMatched) {
    return sendError(res, 401, "현재 비밀번호가 올바르지 않습니다.");
  }

  const newHash = await bcrypt.hash(String(newPassword), 10);
  await run("UPDATE public.users SET password = ? WHERE id = ?", [newHash, row.id]);
  return res.json({ ok: true, message: "비밀번호가 변경되었습니다." });
});

app.get("/api/auth/me", requireAuth, async (req, res) => {
  const user = await get("SELECT id, name, email, role, created_at FROM public.users WHERE id = ?", [
    req.auth.sub,
  ]);
  if (!user) return sendError(res, 404, "사용자를 찾을 수 없습니다.");
  return res.json(user);
});

app.get("/api/admin/dashboard", requireAuth, requireAdmin, async (req, res) => {
  const [users, courses, enrollments, inquiries] = await Promise.all([
    get("SELECT COUNT(*)::int AS count FROM public.users"),
    get("SELECT COUNT(*)::int AS count FROM public.courses"),
    get("SELECT COUNT(*)::int AS count FROM public.enrollments"),
    get("SELECT COUNT(*)::int AS count FROM public.inquiries WHERE status != 'done'"),
  ]);

  res.json({
    users: users.count,
    courses: courses.count,
    enrollments: enrollments.count,
    openInquiries: inquiries.count,
  });
});

app.get("/api/course-openings", async (req, res) => {
  const rows = await all(
    `SELECT o.id, o.course_id, o.start_date, o.end_date, o.application_status,
            c.code AS course_code, c.title AS course_title, c.category, c.price
     FROM public.course_openings o
     JOIN public.courses c ON c.id = o.course_id
     WHERE o.application_status IN ('open', 'closing')
     ORDER BY o.id ASC`
  );
  res.json(rows);
});

app.get("/api/course-openings/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, 400, "유효한 모집 ID가 필요합니다.");
  }
  const row = await get(
    `SELECT o.id, o.course_id, o.start_date, o.end_date, o.application_status,
            c.code AS course_code, c.title AS course_title, c.category, c.price, c.status AS course_status
     FROM public.course_openings o
     JOIN public.courses c ON c.id = o.course_id
     WHERE o.id = ?`,
    [id]
  );
  if (!row) return sendError(res, 404, "모집 정보를 찾을 수 없습니다.");
  return res.json(row);
});

app.post("/api/enrollments", requireAuth, async (req, res) => {
  const openingId = Number(req.body.openingId);
  if (!Number.isInteger(openingId) || openingId <= 0) {
    return sendError(res, 400, "openingId가 필요합니다.");
  }
  const opening = await get("SELECT * FROM public.course_openings WHERE id = ?", [openingId]);
  if (!opening) return sendError(res, 404, "모집 정보를 찾을 수 없습니다.");
  if (!["open", "closing"].includes(opening.application_status)) {
    return sendError(res, 400, "현재 신청할 수 없는 모집입니다.");
  }
  const dup = await get(
    "SELECT id FROM public.enrollments WHERE user_id = ? AND opening_id = ?",
    [req.auth.sub, openingId]
  );
  if (dup) {
    return sendError(res, 409, "이미 신청한 모집입니다.", { enrollmentId: dup.id });
  }
  const result = await run(
    `INSERT INTO public.enrollments
      (user_id, course_id, opening_id, payment_status, approval_status, application_status, learning_status, progress_percent)
     VALUES (?, ?, ?, 'pending', 'pending', 'submitted', 'not_started', 0)
     RETURNING id`,
    [req.auth.sub, opening.course_id, openingId]
  );
  const enrollmentId = result.rows[0].id;
  const course = await get("SELECT price FROM public.courses WHERE id = ?", [opening.course_id]);
  await run(
    `INSERT INTO public.payments (enrollment_id, amount, method, status) VALUES (?, ?, 'bank_transfer', 'pending')`,
    [enrollmentId, course.price]
  );
  const created = await get(
    `SELECT e.*, c.title AS course_title, c.code AS course_code
     FROM public.enrollments e
     JOIN public.courses c ON c.id = e.course_id
     WHERE e.id = ?`,
    [enrollmentId]
  );
  return res.status(201).json(created);
});

app.get("/api/me/enrollments", requireAuth, async (req, res) => {
  const rows = await all(
    `SELECT e.id, e.course_id, e.opening_id, e.payment_status, e.approval_status,
            e.application_status, e.learning_status, e.progress_percent, e.created_at,
            c.title AS course_title, c.code AS course_code,
            o.start_date, o.end_date
     FROM public.enrollments e
     JOIN public.courses c ON c.id = e.course_id
     LEFT JOIN public.course_openings o ON o.id = e.opening_id
     WHERE e.user_id = ?
     ORDER BY e.id DESC`,
    [req.auth.sub]
  );
  res.json(rows);
});

app.get("/api/me/enrollments/:id", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, 400, "유효한 수강 ID가 필요합니다.");
  }
  const row = await get(
    `SELECT e.*, c.title AS course_title, c.code AS course_code, c.price,
            o.start_date, o.end_date, o.application_status AS opening_application_status
     FROM public.enrollments e
     JOIN public.courses c ON c.id = e.course_id
     LEFT JOIN public.course_openings o ON o.id = e.opening_id
     WHERE e.id = ? AND e.user_id = ?`,
    [id, req.auth.sub]
  );
  if (!row) return sendError(res, 404, "수강 정보를 찾을 수 없습니다.");
  const payments = await all(
    "SELECT id, amount, method, status, created_at FROM public.payments WHERE enrollment_id = ? ORDER BY id ASC",
    [id]
  );
  const paymentSummary = await summarizeEnrollmentPayments(id);
  return res.json({ ...row, payments, payment_summary: paymentSummary });
});

app.patch("/api/me/enrollments/:id/deposit", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const depositorName = String(req.body.depositorName || "").trim();
  const transferNote = String(req.body.transferNote || "").trim().slice(0, 500);
  const requestedAmount = Number(req.body.amount);
  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, 400, "유효한 수강 ID가 필요합니다.");
  }
  if (!depositorName) {
    return sendError(res, 400, "입금자명을 입력해 주세요.");
  }
  const nextSummary = await withTransaction(async (tx) => {
    const row = await tx.get(
      `SELECT e.id
       FROM public.enrollments e
       WHERE e.id = ? AND e.user_id = ?
       FOR UPDATE`,
      [id, req.auth.sub]
    );
    if (!row) return { error: { status: 404, message: "수강 정보를 찾을 수 없습니다." } };

    const summary = await summarizeEnrollmentPayments(id, tx);
    if (!summary) return { error: { status: 404, message: "수강 정보를 찾을 수 없습니다." } };
    if (summary.outstandingAmount <= 0) {
      return { error: { status: 409, message: "이미 결제 완료된 수강입니다." } };
    }
    if (summary.awaitingCount > 0) {
      return { error: { status: 409, message: "이미 입금 확인 대기중인 요청이 있습니다." } };
    }

    const amount = Number.isFinite(requestedAmount)
      ? Math.max(0, Math.floor(requestedAmount))
      : summary.outstandingAmount;
    if (!Number.isInteger(amount) || amount <= 0) {
      return { error: { status: 400, message: "유효한 입금 금액이 필요합니다." } };
    }
    if (amount > summary.outstandingAmount) {
      return {
        error: {
          status: 400,
          message: `입금 요청 금액은 미납 금액(${summary.outstandingAmount.toLocaleString("ko-KR")}원) 이하만 가능합니다.`,
        },
      };
    }

    const inserted = await tx.run(
      `INSERT INTO public.payments
        (enrollment_id, amount, method, status, depositor_name, transfer_note, submitted_at)
       VALUES (?, ?, 'bank_transfer', 'awaiting_confirmation', ?, ?, now())
       RETURNING id`,
      [id, amount, depositorName, transferNote || null]
    );
    const paymentId = inserted.rows[0].id;
    await logPaymentAudit(
      {
        paymentId,
        enrollmentId: id,
        action: "deposit_requested",
        beforeStatus: "pending",
        afterStatus: "awaiting_confirmation",
        amount,
        note: transferNote || null,
        actorUserId: req.auth.sub,
        meta: { depositorName },
      },
      tx
    );
    return syncEnrollmentPaymentState(id, tx);
  });
  if (nextSummary && nextSummary.error) {
    return sendError(res, nextSummary.error.status, nextSummary.error.message);
  }
  const updated = await get(
    `SELECT e.*, c.title AS course_title
     FROM public.enrollments e
     JOIN public.courses c ON c.id = e.course_id
     WHERE e.id = ?`,
    [id]
  );
  return res.json({ ...updated, payment_summary: nextSummary });
});

app.get("/api/me/payments", requireAuth, async (req, res) => {
  const rows = await all(
    `SELECT p.id, p.amount, p.method, p.status, p.depositor_name, p.transfer_note, p.submitted_at, p.review_note, p.reviewed_at, p.created_at,
            e.id AS enrollment_id, c.title AS course_title
     FROM public.payments p
     JOIN public.enrollments e ON e.id = p.enrollment_id
     JOIN public.courses c ON c.id = e.course_id
     WHERE e.user_id = ?
     ORDER BY p.id DESC`,
    [req.auth.sub]
  );
  res.json(rows);
});

app.get("/api/admin/enrollments", requireAuth, requireAdmin, async (req, res) => {
  const rows = await all(
    `SELECT e.id, e.user_id, e.course_id, e.opening_id, e.payment_status, e.approval_status,
            e.application_status, e.learning_status, e.progress_percent, e.created_at,
            u.name AS user_name, u.email AS user_email,
            c.title AS course_title, c.code AS course_code
     FROM public.enrollments e
     JOIN public.users u ON u.id = e.user_id
     JOIN public.courses c ON c.id = e.course_id
     ORDER BY e.id DESC`
  );
  res.json(rows);
});

app.get("/api/admin/enrollments/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "유효한 수강 ID가 필요합니다." });
  }
  const row = await get(
    `SELECT e.*, u.name AS user_name, u.email AS user_email,
            c.title AS course_title, c.code AS course_code
     FROM public.enrollments e
     JOIN public.users u ON u.id = e.user_id
     JOIN public.courses c ON c.id = e.course_id
     WHERE e.id = ?`,
    [id]
  );
  if (!row) return res.status(404).json({ message: "수강 정보를 찾을 수 없습니다." });
  const payments = await all(
    "SELECT * FROM public.payments WHERE enrollment_id = ? ORDER BY id ASC",
    [id]
  );
  return res.json({ ...row, payments });
});

app.patch("/api/admin/enrollments/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ message: "유효한 수강 ID가 필요합니다." });
  }
  const exists = await get("SELECT id FROM public.enrollments WHERE id = ?", [id]);
  if (!exists) return res.status(404).json({ message: "수강 정보를 찾을 수 없습니다." });
  const { payment_status, approval_status, learning_status, application_status, progress_percent } = req.body;
  const fields = [];
  const params = [];
  if (payment_status) {
    fields.push("payment_status = ?");
    params.push(payment_status);
  }
  if (approval_status) {
    fields.push("approval_status = ?");
    params.push(approval_status);
  }
  if (learning_status) {
    fields.push("learning_status = ?");
    params.push(learning_status);
  }
  if (application_status) {
    fields.push("application_status = ?");
    params.push(application_status);
  }
  if (progress_percent !== undefined && progress_percent !== null) {
    fields.push("progress_percent = ?");
    params.push(Number(progress_percent));
  }
  if (!fields.length) {
    return res.status(400).json({ message: "변경할 필드를 지정해 주세요." });
  }
  params.push(id);
  await run(`UPDATE public.enrollments SET ${fields.join(", ")} WHERE id = ?`, params);
  await syncEnrollmentPaymentState(id);
  const updated = await get(
    `SELECT e.*, u.name AS user_name, u.email AS user_email, c.title AS course_title
     FROM public.enrollments e
     JOIN public.users u ON u.id = e.user_id
     JOIN public.courses c ON c.id = e.course_id
     WHERE e.id = ?`,
    [id]
  );
  return res.json(updated);
});

app.get("/api/admin/payments", requireAuth, requireAdmin, async (req, res) => {
  const rows = await all(
    `SELECT p.*, e.user_id, e.approval_status, u.name AS user_name, u.email AS user_email, c.title AS course_title
     FROM public.payments p
     JOIN public.enrollments e ON e.id = p.enrollment_id
     JOIN public.users u ON u.id = e.user_id
     JOIN public.courses c ON c.id = e.course_id
     ORDER BY p.id DESC`
  );
  res.json(rows);
});

app.get("/api/admin/payments/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, 400, "유효한 결제 ID가 필요합니다.");
  }
  const row = await get(
    `SELECT p.*, e.user_id, e.id AS enrollment_id, e.approval_status, u.name AS user_name, u.email AS user_email, c.title AS course_title
     FROM public.payments p
     JOIN public.enrollments e ON e.id = p.enrollment_id
     JOIN public.users u ON u.id = e.user_id
     JOIN public.courses c ON c.id = e.course_id
     WHERE p.id = ?`,
    [id]
  );
  if (!row) return sendError(res, 404, "결제 정보를 찾을 수 없습니다.");
  const paymentHistory = await all(
    `SELECT id, enrollment_id, amount, method, status, depositor_name, transfer_note, submitted_at, review_note, reviewed_at, created_at
     FROM public.payments
     WHERE enrollment_id = ?
     ORDER BY id DESC`,
    [row.enrollment_id]
  );
  const summary = await summarizeEnrollmentPayments(row.enrollment_id);
  const auditLogs = await all(
    `SELECT id, payment_id, enrollment_id, action, before_status, after_status, amount, note, actor_user_id, meta, created_at
     FROM public.payment_audit_logs
     WHERE enrollment_id = ?
     ORDER BY id DESC
     LIMIT 50`,
    [row.enrollment_id]
  );
  return res.json({ ...row, payment_history: paymentHistory, payment_summary: summary, payment_audit_logs: auditLogs });
});

app.get("/api/admin/payments/:id/audit", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return sendError(res, 400, "유효한 결제 ID가 필요합니다.");
  const pay = await get("SELECT id, enrollment_id FROM public.payments WHERE id = ?", [id]);
  if (!pay) return sendError(res, 404, "결제 정보를 찾을 수 없습니다.");
  const rows = await all(
    `SELECT id, payment_id, enrollment_id, action, before_status, after_status, amount, note, actor_user_id, meta, created_at
     FROM public.payment_audit_logs
     WHERE enrollment_id = ?
     ORDER BY id DESC
     LIMIT 100`,
    [pay.enrollment_id]
  );
  return res.json(rows);
});

app.patch("/api/admin/payments/:id", requireAuth, requireAdmin, adminWriteRateLimiter, async (req, res) => {
  const id = Number(req.params.id);
  const status = String(req.body.status || "").trim();
  const reviewNote = req.body.reviewNote == null ? null : String(req.body.reviewNote || "").trim().slice(0, 500);
  const refundAmountRaw = Number(req.body.refundAmount);
  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, 400, "유효한 결제 ID가 필요합니다.");
  }
  if (!status) return sendError(res, 400, "status가 필요합니다.");
  const allowed = new Set(["pending", "awaiting_confirmation", "completed", "failed", "refunded"]);
  if (!allowed.has(status)) return sendError(res, 400, "지원하지 않는 결제 상태입니다.");
  const txResult = await withTransaction(async (tx) => {
    const pay = await tx.get("SELECT * FROM public.payments WHERE id = ? FOR UPDATE", [id]);
    if (!pay) return { error: { status: 404, message: "결제 정보를 찾을 수 없습니다." } };
    await tx.get("SELECT id FROM public.enrollments WHERE id = ? FOR UPDATE", [pay.enrollment_id]);
    let updatedPaymentId = id;

    if (status === "refunded") {
      if (pay.status !== "completed" && pay.status !== "refunded") {
        return { error: { status: 400, message: "환불 처리는 완료된 결제에서만 가능합니다." } };
      }
      const summaryBefore = await summarizeEnrollmentPayments(pay.enrollment_id, tx);
      if (!summaryBefore || summaryBefore.netPaid <= 0) {
        return { error: { status: 409, message: "환불 가능한 결제 금액이 없습니다." } };
      }
      const maxRefund = summaryBefore.netPaid;
      const refundAmount = Number.isFinite(refundAmountRaw) ? Math.floor(refundAmountRaw) : maxRefund;
      if (!Number.isInteger(refundAmount) || refundAmount <= 0) {
        return { error: { status: 400, message: "환불 금액은 1원 이상이어야 합니다." } };
      }
      if (refundAmount > maxRefund) {
        return {
          error: {
            status: 400,
            message: `환불 금액은 환불 가능 금액(${maxRefund.toLocaleString("ko-KR")}원) 이하만 가능합니다.`,
          },
        };
      }

      if (pay.status === "refunded") {
        await tx.run(
          "UPDATE public.payments SET amount = ?, review_note = ?, reviewed_by = ?, reviewed_at = now() WHERE id = ?",
          [refundAmount, reviewNote, req.auth.sub, id]
        );
      } else {
        const inserted = await tx.run(
          `INSERT INTO public.payments
            (enrollment_id, amount, method, status, depositor_name, transfer_note, submitted_at, review_note, reviewed_by, reviewed_at)
           VALUES (?, ?, ?, 'refunded', NULL, NULL, now(), ?, ?, now())
           RETURNING id`,
          [pay.enrollment_id, refundAmount, pay.method || "bank_transfer", reviewNote, req.auth.sub]
        );
        updatedPaymentId = inserted.rows[0].id;
      }
      await logPaymentAudit(
        {
          paymentId: updatedPaymentId,
          enrollmentId: pay.enrollment_id,
          action: "admin_refund",
          beforeStatus: pay.status,
          afterStatus: "refunded",
          amount: refundAmount,
          note: reviewNote,
          actorUserId: req.auth.sub,
          meta: { sourcePaymentId: id },
        },
        tx
      );
    } else {
      await tx.run(
        "UPDATE public.payments SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = now() WHERE id = ?",
        [status, reviewNote, req.auth.sub, id]
      );
      await logPaymentAudit(
        {
          paymentId: id,
          enrollmentId: pay.enrollment_id,
          action: "admin_status_update",
          beforeStatus: pay.status,
          afterStatus: status,
          amount: pay.amount,
          note: reviewNote,
          actorUserId: req.auth.sub,
          meta: {},
        },
        tx
      );
    }

    const summary = await syncEnrollmentPaymentState(pay.enrollment_id, tx);
    return { summary, updatedPaymentId };
  });
  if (txResult && txResult.error) {
    return sendError(res, txResult.error.status, txResult.error.message);
  }

  const summary = txResult.summary;
  const updated = await get("SELECT * FROM public.payments WHERE id = ?", [txResult.updatedPaymentId]);
  return res.json({ ...updated, payment_summary: summary });
});

app.use("/api", (req, res) => {
  return sendError(res, 404, "API 엔드포인트를 찾을 수 없습니다.");
});

app.use((error, req, res, _next) => {
  if (String(error && error.message) === "Not allowed by CORS") {
    return sendError(res, 403, "Not allowed by CORS");
  }
  console.error(error);
  return sendError(res, 500, "서버 내부 오류가 발생했습니다.");
});

async function start() {
  await initSchema();
  await migrateAuthOAuthColumns();
  await seedData();
  app.listen(PORT, () => {
    console.log(`PASSmaster API server running on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
