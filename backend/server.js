require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "passmaster-dev-secret";
const JWT_EXPIRES_IN = "8h";
const DATABASE_URL = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
const CORS_ORIGINS = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

if (!DATABASE_URL) {
  console.error("SUPABASE_DB_URL (or DATABASE_URL) is required.");
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
  if (!req.auth || req.auth.role !== "admin") {
    return sendError(res, 403, "관리자 권한이 필요합니다.");
  }
  return next();
}

async function initSchema() {
  await run(`
    CREATE TABLE IF NOT EXISTS public.users (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

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
      author_name TEXT NOT NULL,
      score INTEGER NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
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
      ('IS', '산업안전기사 필기 완성반', '안전관리', 219000, 'open'),
      ('EE', '전기기사 필기 완성반', '전기이론', 199000, 'open'),
      ('IT', '정보처리기사 필기 완성반', '소프트웨어', 179000, 'open')`
    );
  }

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
      { method: "PATCH", path: "/me/enrollments/:id/deposit", auth: true },
      { method: "GET", path: "/me/payments", auth: true },
      { method: "GET", path: "/faqs" },
      { method: "GET", path: "/reviews" },
      { method: "GET", path: "/inquiries" },
      { method: "GET", path: "/inquiries/:id" },
      { method: "POST", path: "/inquiries", auth: true },
      { method: "POST", path: "/auth/register" },
      { method: "POST", path: "/auth/login" },
      { method: "GET", path: "/auth/me", auth: true },
      { method: "PATCH", path: "/auth/password", auth: true },
      { method: "GET", path: "/admin/dashboard", auth: true, admin: true },
      { method: "GET", path: "/admin/enrollments", auth: true, admin: true },
      { method: "GET", path: "/admin/enrollments/:id", auth: true, admin: true },
      { method: "PATCH", path: "/admin/enrollments/:id", auth: true, admin: true },
      { method: "GET", path: "/admin/payments", auth: true, admin: true },
      { method: "GET", path: "/admin/payments/:id", auth: true, admin: true },
      { method: "PATCH", path: "/admin/payments/:id", auth: true, admin: true },
      { method: "PATCH", path: "/inquiries/:id/status", auth: true, admin: true },
      { method: "PATCH", path: "/inquiries/:id/assignee", auth: true, admin: true },
      { method: "POST", path: "/inquiries/:id/messages", auth: true, admin: true },
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
  const rows = await all("SELECT * FROM public.reviews WHERE status = 'approved' ORDER BY id DESC");
  res.json(rows);
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

app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return sendError(res, 400, "name, email, password는 필수입니다.");
  }
  if (password.length < 8) {
    return sendError(res, 400, "비밀번호는 8자 이상이어야 합니다.");
  }
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await run(
      "INSERT INTO public.users (name, email, password, role) VALUES (?, ?, ?, 'user') RETURNING id",
      [name, email, hash]
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

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return sendError(res, 400, "email, password는 필수입니다.");
  }
  const row = await get("SELECT * FROM public.users WHERE email = ?", [email]);
  if (!row) {
    return sendError(res, 401, "이메일 또는 비밀번호가 올바르지 않습니다.");
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

  const user = {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    created_at: row.created_at,
  };
  const token = signToken(user);
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  return res.json({ token, expiresAt, user });
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
  return res.json({ ...row, payments });
});

app.patch("/api/me/enrollments/:id/deposit", requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, 400, "유효한 수강 ID가 필요합니다.");
  }
  const row = await get("SELECT id FROM public.enrollments WHERE id = ? AND user_id = ?", [id, req.auth.sub]);
  if (!row) return sendError(res, 404, "수강 정보를 찾을 수 없습니다.");
  await run("UPDATE public.enrollments SET payment_status = 'deposit_submitted' WHERE id = ?", [id]);
  await run("UPDATE public.payments SET status = 'awaiting_confirmation' WHERE enrollment_id = ?", [id]);
  const updated = await get(
    `SELECT e.*, c.title AS course_title FROM public.enrollments e JOIN public.courses c ON c.id = e.course_id WHERE e.id = ?`,
    [id]
  );
  return res.json(updated);
});

app.get("/api/me/payments", requireAuth, async (req, res) => {
  const rows = await all(
    `SELECT p.id, p.amount, p.method, p.status, p.created_at,
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
  if (payment_status === "paid") {
    await run("UPDATE public.payments SET status = 'completed' WHERE enrollment_id = ?", [id]);
  }
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
    `SELECT p.*, e.user_id, e.approval_status, c.title AS course_title
     FROM public.payments p
     JOIN public.enrollments e ON e.id = p.enrollment_id
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
    `SELECT p.*, e.user_id, e.id AS enrollment_id, c.title AS course_title
     FROM public.payments p
     JOIN public.enrollments e ON e.id = p.enrollment_id
     JOIN public.courses c ON c.id = e.course_id
     WHERE p.id = ?`,
    [id]
  );
  if (!row) return sendError(res, 404, "결제 정보를 찾을 수 없습니다.");
  return res.json(row);
});

app.patch("/api/admin/payments/:id", requireAuth, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body;
  if (!Number.isInteger(id) || id <= 0) {
    return sendError(res, 400, "유효한 결제 ID가 필요합니다.");
  }
  if (!status) return sendError(res, 400, "status가 필요합니다.");
  const pay = await get("SELECT * FROM public.payments WHERE id = ?", [id]);
  if (!pay) return sendError(res, 404, "결제 정보를 찾을 수 없습니다.");
  await run("UPDATE public.payments SET status = ? WHERE id = ?", [status, id]);
  if (status === "completed") {
    await run("UPDATE public.enrollments SET payment_status = 'paid' WHERE id = ?", [pay.enrollment_id]);
  }
  const updated = await get("SELECT * FROM public.payments WHERE id = ?", [id]);
  return res.json(updated);
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
  await seedData();
  app.listen(PORT, () => {
    console.log(`PASSmaster API server running on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
