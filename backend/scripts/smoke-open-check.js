/* eslint-disable no-console */
const API_BASE = String(process.env.PASSMASTER_API_BASE || "http://localhost:4000/api").replace(/\/+$/, "");
const ADMIN_EMAIL = String(process.env.PASSMASTER_ADMIN_EMAIL || "").trim().toLowerCase();
const ADMIN_PASSWORD = String(process.env.PASSMASTER_ADMIN_PASSWORD || "");

function must(value, message) {
  if (!value) throw new Error(message);
  return value;
}

async function api(path, options = {}) {
  const mergedHeaders = { "Content-Type": "application/json", ...(options.headers || {}) };
  const { headers: _ignoredHeaders, ...rest } = options;
  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: mergedHeaders,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed (${res.status}): ${body.message || "unknown error"}`);
  }
  return body;
}

async function login(email, password) {
  return api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

async function main() {
  console.log(`[smoke] API_BASE=${API_BASE}`);
  must(ADMIN_EMAIL, "PASSMASTER_ADMIN_EMAIL is required");
  must(ADMIN_PASSWORD, "PASSMASTER_ADMIN_PASSWORD is required");

  const stamp = Date.now();
  const testEmail = `smoke_${stamp}@passmaster.kr`;
  const testPassword = "pass1234";
  const testName = "스모크체크";

  await api("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: testName, email: testEmail, password: testPassword }),
  });

  const studentSession = await login(testEmail, testPassword);
  const adminSession = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
  const studentAuth = { Authorization: `Bearer ${studentSession.token}` };
  const adminAuth = { Authorization: `Bearer ${adminSession.token}` };

  const openings = await api("/course-openings");
  const opening = openings[0];
  if (!opening || !opening.id) throw new Error("No opening available");

  const enrollment = await api("/enrollments", {
    method: "POST",
    headers: studentAuth,
    body: JSON.stringify({ openingId: Number(opening.id) }),
  });
  const enrollmentId = Number(enrollment.id);

  await api(`/me/enrollments/${enrollmentId}/deposit`, {
    method: "PATCH",
    headers: studentAuth,
    body: JSON.stringify({ depositorName: "스모크입금자", amount: 4000, transferNote: "open smoke" }),
  });

  const payments = await api("/admin/payments", { headers: adminAuth });
  const awaiting = payments.find(
    (p) => Number(p.enrollment_id) === enrollmentId && String(p.status) === "awaiting_confirmation"
  );
  if (!awaiting) throw new Error("awaiting_confirmation payment not found");

  await api(`/admin/payments/${awaiting.id}`, {
    method: "PATCH",
    headers: adminAuth,
    body: JSON.stringify({ status: "completed", reviewNote: "smoke approve" }),
  });

  const paymentDetail = await api(`/admin/payments/${awaiting.id}`, { headers: adminAuth });
  const auditLogs = Array.isArray(paymentDetail.payment_audit_logs) ? paymentDetail.payment_audit_logs : [];
  if (auditLogs.length === 0) throw new Error("payment_audit_logs empty");

  const hasApproveAudit = auditLogs.some((log) => String(log.action) === "admin_status_update");
  if (!hasApproveAudit) throw new Error("admin_status_update audit log missing");

  const me = await api(`/me/enrollments/${enrollmentId}`, { headers: studentAuth });
  if (!me.payment_summary) throw new Error("payment_summary missing");

  console.log("[smoke] OK");
  console.log(
    JSON.stringify(
      {
        enrollmentId,
        paymentId: awaiting.id,
        paymentStatus: me.payment_status,
        approvalStatus: me.approval_status,
        netPaid: me.payment_summary.netPaid,
        outstanding: me.payment_summary.outstandingAmount,
        auditCount: auditLogs.length,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(`[smoke] FAILED: ${error.message}`);
  process.exit(1);
});

