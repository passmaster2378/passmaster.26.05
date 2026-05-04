(() => {
  const DEFAULT_REMOTE_API_BASE = "https://passmaster-26-05.onrender.com/api";
  const DEFAULT_TIMEOUT_MS = 15000;
  const AUTH_TIMEOUT_MS = 35000;
  const isLocalHost =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const isFileProtocol = window.location.protocol === "file:";
  const isGitHubPages = /\.github\.io$/i.test(window.location.hostname);
  const API_BASE =
    window.PASSMASTER_API_BASE ||
    (isLocalHost || isFileProtocol
      ? "http://localhost:4000/api"
      : isGitHubPages
        ? DEFAULT_REMOTE_API_BASE
        : "/api");
  let apiWarmupPromise = null;

  function getStoredSession() {
    try {
      const raw = localStorage.getItem("passmaster_auth");
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function request(path, options = {}, config = {}) {
    const { timeoutMs = DEFAULT_TIMEOUT_MS, retryNetworkError = false } = config;
    const session = getStoredSession();
    const authHeader =
      session && session.token ? { Authorization: `Bearer ${session.token}` } : {};

    const fetchOptions = {
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
      },
      ...options,
    };

    let response;
    for (let attempt = 0; attempt < (retryNetworkError ? 2 : 1); attempt += 1) {
      try {
        response = await fetchWithTimeout(`${API_BASE}${path}`, fetchOptions, timeoutMs);
        break;
      } catch (error) {
        const isLastAttempt = attempt === (retryNetworkError ? 1 : 0);
        if (!isLastAttempt) {
          // Render free tier cold start can cause first request timeout/network failure.
          await new Promise((resolve) => setTimeout(resolve, 600));
          continue;
        }
        const isTimeout = error && error.name === "AbortError";
        throw new Error(
          isTimeout
            ? `요청 시간이 초과되었습니다. (${API_BASE}) 잠시 후 다시 시도해 주세요.`
            : `API 서버에 연결할 수 없습니다. (${API_BASE}) 백엔드 실행 또는 배포 환경변수를 확인해 주세요.`
        );
      }
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem("passmaster_auth");
      }
      throw new Error(data.message || "요청 처리 중 오류가 발생했습니다.");
    }
    return data;
  }

  function getLoginHref() {
    const navLogin = document.querySelector(".pm-nav a[href*='login.html']");
    return navLogin ? navLogin.getAttribute("href") : "./login.html";
  }

  function parsePmAuthHashPayload(b64url) {
    const pad = b64url.length % 4 === 2 ? "==" : b64url.length % 4 === 3 ? "=" : "";
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
    const str = new TextDecoder().decode(bytes);
    return JSON.parse(str);
  }

  function mountOAuthButtons() {
    document.querySelectorAll("[data-oauth-provider]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const provider = btn.getAttribute("data-oauth-provider");
        if (!provider) return;
        const returnTo = encodeURIComponent(
          `${window.location.origin}${window.location.pathname}${window.location.search}`
        );
        window.location.href = `${API_BASE}/auth/oauth/${provider}/start?returnTo=${returnTo}`;
      });
    });
  }

  function consumeOAuthHashReturn() {
    const hash = window.location.hash;
    if (!hash) return false;
    if (hash.startsWith("#pm_auth=")) {
      const raw = decodeURIComponent(hash.slice(9));
      const clean = window.location.pathname + window.location.search;
      const loginForm = document.querySelector("[data-auth-form='login']");
      const registerForm = document.querySelector("[data-auth-form='register']");
      const messageNode =
        (loginForm && loginForm.querySelector("[data-auth-message]")) ||
        (registerForm && registerForm.querySelector("[data-auth-message]"));
      try {
        const session = parsePmAuthHashPayload(raw);
        if (session && session.token && session.user) {
          localStorage.setItem("passmaster_auth", JSON.stringify(session));
          window.history.replaceState(null, "", clean);
          const next =
            session.user.role === "admin" ? "./admin/index.html" : "./my-courses/index.html";
          window.location.replace(next);
          return true;
        }
      } catch (_error) {
        /* handled below */
      }
      window.history.replaceState(null, "", clean);
      if (messageNode) {
        showMessage(messageNode, "로그인 정보를 처리하지 못했습니다. 다시 시도해 주세요.", "error");
      }
      return false;
    }
    if (hash.startsWith("#pm_oauth_error=")) {
      const msg = decodeURIComponent(hash.slice(16));
      const clean = window.location.pathname + window.location.search;
      window.history.replaceState(null, "", clean);
      const loginForm = document.querySelector("[data-auth-form='login']");
      const registerForm = document.querySelector("[data-auth-form='register']");
      const messageNode =
        (loginForm && loginForm.querySelector("[data-auth-message]")) ||
        (registerForm && registerForm.querySelector("[data-auth-message]"));
      if (messageNode) showMessage(messageNode, msg, "error");
      return false;
    }
    return false;
  }

  function getCurrentUser() {
    const session = getStoredSession();
    if (!session || !session.user) return null;
    if (session.expiresAt && new Date(session.expiresAt).getTime() < Date.now()) {
      localStorage.removeItem("passmaster_auth");
      return null;
    }
    return session.user;
  }

  function showMessage(target, message, type) {
    if (!target) return;
    target.textContent = message;
    target.className = `auth-message ${type}`;
  }

  async function warmupApi() {
    if (apiWarmupPromise) return apiWarmupPromise;
    apiWarmupPromise = fetchWithTimeout(`${API_BASE}/health`, { method: "GET" }, AUTH_TIMEOUT_MS)
      .catch(() => null)
      .finally(() => {
        apiWarmupPromise = null;
      });
    return apiWarmupPromise;
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = form.email.value.trim();
    const password = form.password.value;
    const messageNode = form.querySelector("[data-auth-message]");
    const submitButton = form.querySelector("[data-auth-submit]");

    if (!email || !password) {
      showMessage(messageNode, "이메일과 비밀번호를 모두 입력해 주세요.", "error");
      return;
    }

    try {
      submitButton.disabled = true;
      showMessage(messageNode, "서버 연결 확인 후 로그인 중입니다...", "info");
      await warmupApi();
      const data = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }, { timeoutMs: AUTH_TIMEOUT_MS, retryNetworkError: true });
      localStorage.setItem("passmaster_auth", JSON.stringify(data));
      showMessage(messageNode, `${data.user.name}님, 로그인 되었습니다.`, "success");
      const params = new URLSearchParams(window.location.search);
      const returnToParam = params.get("returnTo");
      let returnToStored = null;
      try {
        returnToStored = sessionStorage.getItem("passmaster_return_to");
        sessionStorage.removeItem("passmaster_return_to");
      } catch (_error) {
        returnToStored = null;
      }

      const fallbackNext = data.user.role === "admin" ? "./admin/index.html" : "./my-courses/index.html";
      const candidate = returnToParam || returnToStored;
      const next =
        candidate && candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : fallbackNext;
      setTimeout(() => {
        window.location.href = next;
      }, 800);
    } catch (error) {
      showMessage(messageNode, error.message, "error");
    } finally {
      submitButton.disabled = false;
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const password = form.password.value;
    const messageNode = form.querySelector("[data-auth-message]");
    const submitButton = form.querySelector("[data-auth-submit]");

    if (!name || !email || !password) {
      showMessage(messageNode, "이름, 이메일, 비밀번호를 모두 입력해 주세요.", "error");
      return;
    }

    if (password.length < 8) {
      showMessage(messageNode, "비밀번호는 8자 이상 입력해 주세요.", "error");
      return;
    }

    try {
      submitButton.disabled = true;
      showMessage(messageNode, "서버 연결 확인 후 회원가입 처리 중입니다...", "info");
      await warmupApi();
      await request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      }, { timeoutMs: AUTH_TIMEOUT_MS, retryNetworkError: true });
      showMessage(
        messageNode,
        "회원가입이 완료되었습니다. 로그인 페이지로 이동합니다.",
        "success"
      );
      setTimeout(() => {
        window.location.href = "./login.html?registered=1";
      }, 900);
    } catch (error) {
      showMessage(messageNode, error.message, "error");
    } finally {
      submitButton.disabled = false;
    }
  }

  async function handleInquirySubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const userName = form.userName.value.trim();
    const type = form.type.value;
    const title = form.title.value.trim();
    const content = form.content.value.trim();
    const messageNode = form.querySelector("[data-auth-message]");
    const submitButton = form.querySelector("[data-auth-submit]");

    if (!userName || !type || !title || !content) {
      showMessage(messageNode, "문의자명, 유형, 제목, 내용을 모두 입력해 주세요.", "error");
      return;
    }

    try {
      submitButton.disabled = true;
      showMessage(messageNode, "문의를 등록하고 있습니다...", "info");
      await request("/inquiries", {
        method: "POST",
        body: JSON.stringify({ userName, type, title, content }),
      });
      showMessage(messageNode, "문의가 접수되었습니다. 목록 페이지로 이동합니다.", "success");
      const successHref = form.getAttribute("data-success-href") || "../index.html";
      setTimeout(() => {
        window.location.href = successHref;
      }, 900);
    } catch (error) {
      if (error.message.includes("인증") || error.message.includes("토큰")) {
        showMessage(messageNode, "로그인 세션이 필요합니다. 로그인 페이지로 이동합니다.", "error");
        setTimeout(() => {
          window.location.href = getLoginHref();
        }, 900);
        return;
      }
      showMessage(messageNode, error.message, "error");
    } finally {
      submitButton.disabled = false;
    }
  }

  async function handlePasswordChangeSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const currentPassword = form.currentPassword.value;
    const newPassword = form.newPassword.value;
    const newPasswordConfirm = form.newPasswordConfirm.value;
    const messageNode = form.querySelector("[data-auth-message]");
    const submitButton = form.querySelector("[data-auth-submit]");

    if (!currentPassword || !newPassword || !newPasswordConfirm) {
      showMessage(messageNode, "모든 비밀번호 항목을 입력해 주세요.", "error");
      return;
    }
    if (newPassword.length < 8) {
      showMessage(messageNode, "새 비밀번호는 8자 이상 입력해 주세요.", "error");
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      showMessage(messageNode, "새 비밀번호 확인 값이 일치하지 않습니다.", "error");
      return;
    }
    if (currentPassword === newPassword) {
      showMessage(messageNode, "새 비밀번호는 현재 비밀번호와 달라야 합니다.", "error");
      return;
    }

    try {
      submitButton.disabled = true;
      showMessage(messageNode, "비밀번호를 변경하고 있습니다...", "info");
      await request("/auth/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      }, { timeoutMs: AUTH_TIMEOUT_MS, retryNetworkError: true });
      showMessage(messageNode, "변경 완료! 보안을 위해 다시 로그인해 주세요.", "success");
      localStorage.removeItem("passmaster_auth");
      setTimeout(() => {
        window.location.href = getLoginHref();
      }, 900);
    } catch (error) {
      showMessage(messageNode, error.message, "error");
    } finally {
      submitButton.disabled = false;
    }
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value.replace(" ", "T"));
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function normalizeStatus(status) {
    const map = {
      received: "접수",
      processing: "처리중",
      done: "완료",
    };
    return map[status] || status || "-";
  }

  async function mountInquiryList() {
    const tableBody = document.querySelector("[data-inquiry-list-body]");
    if (!tableBody) return;

    const summaryNode = document.querySelector("[data-inquiry-list-summary]");
    try {
      const params = new URLSearchParams(window.location.search);
      const page = params.get("page") || "1";
      const status = params.get("status") || "";
      const type = params.get("type") || "";
      const q = params.get("q") || "";
      const query = new URLSearchParams({ page, pageSize: "10" });
      if (status) query.set("status", status);
      if (type) query.set("type", type);
      if (q) query.set("q", q);

      const payload = await request(`/inquiries?${query.toString()}`);
      const inquiries = Array.isArray(payload.items) ? payload.items : [];
      const meta = payload.meta || { total: inquiries.length, page: 1, totalPages: 1 };
      tableBody.innerHTML = "";

      if (!Array.isArray(inquiries) || inquiries.length === 0) {
        tableBody.innerHTML = "<tr><td colspan='5'>등록된 문의가 없습니다.</td></tr>";
        if (summaryNode) summaryNode.textContent = "총 0건";
        return;
      }

      inquiries.forEach((item) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>INQ-${item.id}</td>
          <td>${item.type || "-"}</td>
          <td><a href="./detail-001.html?id=${item.id}">${item.title || "-"}</a></td>
          <td>${normalizeStatus(item.status)}</td>
          <td>${formatDateTime(item.created_at)}</td>
        `;
        tableBody.appendChild(tr);
      });

      if (summaryNode) {
        summaryNode.textContent = `총 ${meta.total}건 · ${meta.page}/${meta.totalPages} 페이지`;
      }

      const pageNode = document.querySelector("[data-inquiry-pagination]");
      if (pageNode) {
        const prevPage = Math.max(1, Number(meta.page) - 1);
        const nextPage = Math.min(Number(meta.totalPages), Number(meta.page) + 1);
        const base = new URLSearchParams(params);
        const prevParams = new URLSearchParams(base);
        prevParams.set("page", String(prevPage));
        const nextParams = new URLSearchParams(base);
        nextParams.set("page", String(nextPage));
        pageNode.innerHTML = `
          <a class="pm-btn pm-btn-ghost" href="?${prevParams.toString()}">이전</a>
          <a class="pm-btn pm-btn-ghost" href="?${nextParams.toString()}">다음</a>
        `;
      }
    } catch (error) {
      tableBody.innerHTML = `<tr><td colspan='5'>문의 목록을 불러오지 못했습니다: ${error.message}</td></tr>`;
      if (summaryNode) summaryNode.textContent = "조회 실패";
    }
  }

  async function mountInquiryDetail() {
    const detailRoot = document.querySelector("[data-inquiry-detail]");
    if (!detailRoot) return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") || "1";

    try {
      const item = await request(`/inquiries/${id}`);
      const fields = {
        id: `INQ-${item.id}`,
        type: item.type || "-",
        status: normalizeStatus(item.status),
        title: item.title || "-",
        userName: item.user_name || "-",
        createdAt: formatDateTime(item.created_at),
        content: item.content || "-",
      };

      Object.entries(fields).forEach(([key, value]) => {
        const node = detailRoot.querySelector(`[data-inquiry-field='${key}']`);
        if (node) node.textContent = value;
      });

      const errorNode = detailRoot.querySelector("[data-inquiry-error]");
      if (errorNode) {
        errorNode.textContent = "문의 상세 조회가 완료되었습니다.";
        errorNode.className = "auth-message success";
      }
    } catch (error) {
      const errorNode = detailRoot.querySelector("[data-inquiry-error]");
      if (errorNode) {
        errorNode.textContent = `문의 상세를 불러오지 못했습니다: ${error.message}`;
        errorNode.className = "auth-message error";
      }
    }
  }

  async function handleAdminInquiryStatusSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const status = form.status.value;
    const messageNode = form.querySelector("[data-admin-inquiry-message]");
    const submitButton = form.querySelector("[data-admin-inquiry-submit]");
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") || "1";

    try {
      submitButton.disabled = true;
      showMessage(messageNode, "상태를 변경하고 있습니다...", "info");
      const updated = await request(`/inquiries/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      const targetNode = document.querySelector("[data-admin-inquiry-status]");
      if (targetNode) targetNode.textContent = normalizeStatus(updated.status);
      showMessage(messageNode, "문의 상태가 변경되었습니다.", "success");
    } catch (error) {
      showMessage(messageNode, error.message, "error");
    } finally {
      submitButton.disabled = false;
    }
  }

  async function mountAdminInquiryList() {
    const tableBody = document.querySelector("[data-admin-inquiry-list-body]");
    if (!tableBody) return;

    const params = new URLSearchParams(window.location.search);
    const query = new URLSearchParams({
      page: params.get("page") || "1",
      pageSize: "10",
    });
    if (params.get("status")) query.set("status", params.get("status"));
    if (params.get("type")) query.set("type", params.get("type"));
    if (params.get("q")) query.set("q", params.get("q"));

    try {
      const payload = await request(`/inquiries?${query.toString()}`);
      const items = Array.isArray(payload.items) ? payload.items : [];
      const meta = payload.meta || { total: items.length, page: 1, totalPages: 1 };
      tableBody.innerHTML = "";

      if (!items.length) {
        tableBody.innerHTML = "<tr><td colspan='6'>조회 결과가 없습니다.</td></tr>";
      } else {
        items.forEach((item) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>INQ-${item.id}</td>
            <td>${item.user_name}</td>
            <td>${item.type}</td>
            <td><a href="./detail-001.html?id=${item.id}">${item.title}</a></td>
            <td>${normalizeStatus(item.status)}</td>
            <td>${formatDateTime(item.created_at)}</td>
          `;
          tableBody.appendChild(tr);
        });
      }

      const summary = document.querySelector("[data-admin-inquiry-summary]");
      if (summary) {
        summary.textContent = `총 ${meta.total}건 · ${meta.page}/${meta.totalPages} 페이지`;
      }
    } catch (error) {
      tableBody.innerHTML = `<tr><td colspan='6'>목록 조회 실패: ${error.message}</td></tr>`;
    }
  }

  async function mountAdminInquiryDetail() {
    const detailRoot = document.querySelector("[data-admin-inquiry-detail]");
    if (!detailRoot) return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") || "1";
    try {
      const item = await request(`/inquiries/${id}`);
      const fields = {
        id: `INQ-${item.id}`,
        userName: item.user_name || "-",
        type: item.type || "-",
        title: item.title || "-",
        content: item.content || "-",
        status: normalizeStatus(item.status),
        createdAt: formatDateTime(item.created_at),
        assigneeName: item.assignee_name || "미배정",
      };
      Object.entries(fields).forEach(([key, value]) => {
        const node = detailRoot.querySelector(`[data-admin-inquiry-field='${key}']`);
        if (node) node.textContent = value;
      });

      const statusSelect = detailRoot.querySelector("select[name='status']");
      if (statusSelect) statusSelect.value = item.status;

      const assigneeInput = detailRoot.querySelector("input[name='assigneeName']");
      if (assigneeInput) assigneeInput.value = item.assignee_name || "";

      const timelineNode = detailRoot.querySelector("[data-admin-inquiry-timeline]");
      if (timelineNode) {
        const messages = Array.isArray(item.messages) ? item.messages : [];
        if (!messages.length) {
          timelineNode.innerHTML = "<li>등록된 대화 이력이 없습니다.</li>";
        } else {
          timelineNode.innerHTML = messages
            .map(
              (entry) =>
                `<li><strong>[${entry.author_role}] ${entry.author_name}</strong> · ${formatDateTime(
                  entry.created_at
                )}<br/>${entry.message}</li>`
            )
            .join("");
        }
      }
    } catch (error) {
      const errorNode = detailRoot.querySelector("[data-admin-inquiry-message]");
      if (errorNode) showMessage(errorNode, `상세 조회 실패: ${error.message}`, "error");
    }
  }

  async function handleAdminAssigneeSubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const assigneeName = form.assigneeName.value.trim();
    const messageNode = document.querySelector("[data-admin-inquiry-message]");
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") || "1";

    try {
      const updated = await request(`/inquiries/${id}/assignee`, {
        method: "PATCH",
        body: JSON.stringify({ assigneeName }),
      });
      const fieldNode = document.querySelector("[data-admin-inquiry-field='assigneeName']");
      if (fieldNode) fieldNode.textContent = updated.assignee_name || "미배정";
      showMessage(messageNode, "담당자 배정이 반영되었습니다.", "success");
    } catch (error) {
      showMessage(messageNode, error.message, "error");
    }
  }

  function openingDetailHref(openingId) {
    return `./opening/index.html?openingId=${openingId}`;
  }

  function parseOpeningIdFromUrl() {
    const q = new URLSearchParams(window.location.search).get("openingId");
    if (q && Number(q) > 0) return Number(q);
    const m = window.location.pathname.match(/opening-(\d+)/i);
    if (m && Number(m[1]) > 0) return Number(m[1]);
    return 0;
  }

  function parseEnrollmentIdFromUrl() {
    const q = new URLSearchParams(window.location.search).get("id");
    if (q && Number(q) > 0) return Number(q);
    const m = window.location.pathname.match(/enrollment-(\d+)/i);
    return m ? Number(m[1]) : 1;
  }

  async function mountCourseOpeningsList() {
    const tbody = document.querySelector("[data-api='course-openings-body']");
    if (!tbody) return;
    const statusEl = document.querySelector("[data-api='course-openings-status']");
    try {
      const rows = await request("/course-openings");
      tbody.innerHTML = "";
      if (!Array.isArray(rows) || !rows.length) {
        tbody.innerHTML = "<tr><td colspan='6'>모집 중인 과정이 없습니다.</td></tr>";
        if (statusEl) showMessage(statusEl, "표시할 모집이 없습니다.", "info");
        return;
      }
      rows.forEach((o) => {
        const tr = document.createElement("tr");
        const href = openingDetailHref(o.id);
        tr.innerHTML = `
          <td>${o.id}</td>
          <td>${o.course_title || "-"}</td>
          <td>${o.start_date || "-"} ~ ${o.end_date || "-"}</td>
          <td>${o.application_status || "-"}</td>
          <td>${Number(o.price || 0).toLocaleString("ko-KR")}원</td>
          <td><a class="pm-btn pm-btn-primary" style="display:inline-flex;padding:6px 10px;font-size:13px" href="${href}">상세</a></td>
        `;
        tbody.appendChild(tr);
      });
      if (statusEl) showMessage(statusEl, `총 ${rows.length}건을 API에서 불러왔습니다.`, "success");
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan='6'>목록을 불러오지 못했습니다: ${error.message}</td></tr>`;
      if (statusEl) showMessage(statusEl, error.message, "error");
    }
  }

  async function mountOpeningDetail() {
    const root = document.querySelector("[data-api='opening-detail']");
    if (!root) return;
    const openingId = parseOpeningIdFromUrl();
    const applyLink = document.querySelector("[data-api='opening-apply-link']");
    if (applyLink) {
      if (openingId) {
        applyLink.href = `../apply/index.html?openingId=${openingId}`;
      } else {
        applyLink.href = "../index.html";
      }
    }

    if (!openingId) {
      const msg = root.querySelector("[data-api='opening-detail-error']");
      if (msg) {
        showMessage(
          msg,
          "모집을 찾을 수 없습니다. 수강 신청 목록에서 다시 선택해 주세요.",
          "error"
        );
      }
      return;
    }

    try {
      const o = await request(`/course-openings/${openingId}`);
      root.querySelector("[data-field='title']").textContent = o.course_title || "-";
      root.querySelector("[data-field='period']").textContent = `${o.start_date || "-"} ~ ${o.end_date || "-"}`;
      root.querySelector("[data-field='status']").textContent = o.application_status || "-";
      root.querySelector("[data-field='price']").textContent = `${Number(o.price || 0).toLocaleString("ko-KR")}원`;
      root.querySelector("[data-field='category']").textContent = o.category || "-";
    } catch (error) {
      const msg = root.querySelector("[data-api='opening-detail-error']");
      if (msg) showMessage(msg, error.message, "error");
    }

    const legacyBtn = document.querySelector("[data-api='opening-enroll-btn']");
    if (legacyBtn) {
      legacyBtn.addEventListener("click", async () => {
        try {
          legacyBtn.disabled = true;
          const created = await request("/enrollments", {
            method: "POST",
            body: JSON.stringify({ openingId }),
          });
          localStorage.setItem("passmaster_last_enrollment_id", String(created.id));
          window.location.href = "../payment/index.html?enrollmentId=" + encodeURIComponent(String(created.id));
        } catch (error) {
          alert(error.message);
        } finally {
          legacyBtn.disabled = false;
        }
      });
    }
  }

  async function mountEnrollApplyForm() {
    const form = document.querySelector("[data-api='enroll-apply-form']");
    const root = document.querySelector("[data-api='enroll-apply-root']");
    if (!form || !root) return;

    const messageEl = root.querySelector("[data-api='enroll-apply-message']");
    const openingId = parseOpeningIdFromUrl();
    const back = document.querySelector("[data-api='enroll-apply-back']");
    if (back) {
      back.href = openingId ? `../opening/index.html?openingId=${openingId}` : "../index.html";
    }

    const submitBtn = form.querySelector("[data-api='enroll-apply-submit']");

    if (!openingId) {
      if (messageEl) {
        showMessage(messageEl, "잘못된 주소입니다. 수강 신청 목록으로 돌아가 주세요.", "error");
      }
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    try {
      const o = await request(`/course-openings/${openingId}`);
      root.querySelector("[data-field='title']").textContent = o.course_title || "-";
      root.querySelector("[data-field='period']").textContent = `${o.start_date || "-"} ~ ${o.end_date || "-"}`;
      root.querySelector("[data-field='price']").textContent = `${Number(o.price || 0).toLocaleString("ko-KR")}원`;
      sessionStorage.setItem("passmaster_last_apply_opening_id", String(openingId));
      if (messageEl) showMessage(messageEl, "모집 정보를 불러왔습니다. 아래 내용을 확인한 뒤 제출해 주세요.", "success");
    } catch (error) {
      if (messageEl) showMessage(messageEl, error.message, "error");
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    const user = getCurrentUser();
    if (!user && messageEl) {
      showMessage(
        messageEl,
        "로그인한 회원만 신청할 수 있습니다. 로그인 후 다시 시도해 주세요.",
        "info"
      );
    }

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!getCurrentUser()) {
        window.location.href = getLoginHref();
        return;
      }
      if (!form.agreeTerms.checked || !form.agreeRefund.checked) {
        if (messageEl) showMessage(messageEl, "필수 동의 항목에 체크해 주세요.", "error");
        return;
      }
      try {
        if (submitBtn) submitBtn.disabled = true;
        const created = await request("/enrollments", {
          method: "POST",
          body: JSON.stringify({ openingId }),
        });
        localStorage.setItem("passmaster_last_enrollment_id", String(created.id));
        window.location.href = `../payment/index.html?enrollmentId=${encodeURIComponent(String(created.id))}`;
      } catch (error) {
        if (messageEl) showMessage(messageEl, error.message, "error");
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  async function mountMeEnrollmentsTable(selector) {
    const tbody = document.querySelector(selector);
    if (!tbody) return;
    try {
      const rows = await request("/me/enrollments");
      tbody.innerHTML = "";
      if (!Array.isArray(rows) || !rows.length) {
        tbody.innerHTML = "<tr><td colspan='6'>신청 내역이 없습니다.</td></tr>";
        return;
      }
      rows.forEach((e) => {
        const tr = document.createElement("tr");
        const detailHref = `../../my-courses/enrollment-001/index.html?id=${e.id}`;
        tr.innerHTML = `
          <td>${e.id}</td>
          <td>${e.course_title || "-"}</td>
          <td>${e.payment_status || "-"}</td>
          <td>${e.approval_status || "-"}</td>
          <td>${e.progress_percent ?? 0}%</td>
          <td><a href="${detailHref}">상세</a></td>
        `;
        tbody.appendChild(tr);
      });
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan='6'>${error.message}</td></tr>`;
    }
  }

  async function mountMeEnrollmentDetail() {
    const root = document.querySelector("[data-api='me-enrollment-detail']");
    if (!root) return;
    const id = parseEnrollmentIdFromUrl();
    try {
      const e = await request(`/me/enrollments/${id}`);
      root.querySelector("[data-field='id']").textContent = String(e.id);
      root.querySelector("[data-field='course']").textContent = e.course_title || "-";
      root.querySelector("[data-field='payment']").textContent = e.payment_status || "-";
      root.querySelector("[data-field='approval']").textContent = e.approval_status || "-";
      root.querySelector("[data-field='learning']").textContent = e.learning_status || "-";
      root.querySelector("[data-field='progress']").textContent = `${e.progress_percent ?? 0}%`;
    } catch (error) {
      const msg = root.querySelector("[data-api='me-enrollment-error']");
      if (msg) showMessage(msg, error.message, "error");
    }
  }

  async function mountDepositConfirm() {
    const root = document.querySelector("[data-api='payment-panel']");
    if (!root) return;
    const params = new URLSearchParams(window.location.search);
    const fromUrl = Number(params.get("enrollmentId"));
    const stored = Number(localStorage.getItem("passmaster_last_enrollment_id"));
    const enrollmentId =
      Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : Number.isFinite(stored) && stored > 0 ? stored : 0;
    if (enrollmentId) {
      localStorage.setItem("passmaster_last_enrollment_id", String(enrollmentId));
    }
    if (!enrollmentId) {
      root.querySelector("[data-api='payment-message']").textContent =
        "먼저 신청서 단계에서 수강 신청을 완료해 주세요.";
      return;
    }

    const backApply = document.querySelector("[data-api='payment-back-apply']");
    if (backApply) {
      const oid = sessionStorage.getItem("passmaster_last_apply_opening_id");
      backApply.href = oid ? `../apply/index.html?openingId=${encodeURIComponent(oid)}` : "../index.html";
    }

    try {
      const e = await request(`/me/enrollments/${enrollmentId}`);
      root.querySelector("[data-field='course']").textContent = e.course_title || "-";
      root.querySelector("[data-field='amount']").textContent = `${Number(e.price || 0).toLocaleString("ko-KR")}원`;
      root.querySelector("[data-field='enrollmentId']").textContent = String(e.id);
    } catch (error) {
      showMessage(root.querySelector("[data-api='payment-message']"), error.message, "error");
      return;
    }

    const btn = document.querySelector("[data-api='deposit-submit']");
    if (btn) {
      btn.addEventListener("click", async () => {
        try {
          btn.disabled = true;
          await request(`/me/enrollments/${enrollmentId}/deposit`, {
            method: "PATCH",
            body: JSON.stringify({}),
          });
          window.location.href = "../complete/index.html";
        } catch (error) {
          alert(error.message);
        } finally {
          btn.disabled = false;
        }
      });
    }
  }

  async function mountEnrollComplete() {
    const root = document.querySelector("[data-api='enroll-complete']");
    if (!root) return;
    const enrollmentId = Number(localStorage.getItem("passmaster_last_enrollment_id"));
    if (!enrollmentId) {
      root.textContent = "완료된 신청 정보를 찾을 수 없습니다.";
      return;
    }
    try {
      const e = await request(`/me/enrollments/${enrollmentId}`);
      root.innerHTML = `신청번호 <strong>${e.id}</strong> · ${e.course_title} · 결제상태 ${e.payment_status} · 승인 ${e.approval_status}`;
    } catch (error) {
      root.textContent = error.message;
    }
  }

  async function mountAdminEnrollmentsList() {
    const tbody = document.querySelector("[data-api='admin-enrollments-body']");
    if (!tbody) return;
    try {
      const rows = await request("/admin/enrollments");
      tbody.innerHTML = "";
      if (!Array.isArray(rows) || !rows.length) {
        tbody.innerHTML = "<tr><td colspan='7'>데이터가 없습니다.</td></tr>";
        return;
      }
      rows.forEach((e) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${e.id}</td>
          <td>${e.user_name || "-"}<br/><small>${e.user_email || ""}</small></td>
          <td>${e.course_title || "-"}</td>
          <td>${e.payment_status || "-"}</td>
          <td>${e.approval_status || "-"}</td>
          <td>${e.progress_percent ?? 0}%</td>
          <td><a href="./detail-001.html?id=${e.id}">관리</a></td>
        `;
        tbody.appendChild(tr);
      });
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan='7'>${error.message}</td></tr>`;
    }
  }

  async function mountAdminEnrollmentDetail() {
    const root = document.querySelector("[data-api='admin-enrollment-detail']");
    if (!root) return;
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get("id")) || 1;
    try {
      const e = await request(`/admin/enrollments/${id}`);
      root.querySelector("[data-field='id']").textContent = String(e.id);
      root.querySelector("[data-field='user']").textContent = `${e.user_name} (${e.user_email})`;
      root.querySelector("[data-field='course']").textContent = e.course_title || "-";
      root.querySelector("[data-field='payment']").textContent = e.payment_status || "-";
      root.querySelector("[data-field='approval']").textContent = e.approval_status || "-";
    } catch (error) {
      const msg = root.querySelector("[data-api='admin-enrollment-error']");
      if (msg) showMessage(msg, error.message, "error");
    }

    const form = document.querySelector("[data-api='admin-enrollment-patch']");
    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const payment_status = form.payment_status.value || undefined;
        const approval_status = form.approval_status.value || undefined;
        const learning_status = form.learning_status.value || undefined;
        const body = {};
        if (payment_status) body.payment_status = payment_status;
        if (approval_status) body.approval_status = approval_status;
        if (learning_status) body.learning_status = learning_status;
        try {
          const updated = await request(`/admin/enrollments/${id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          });
          root.querySelector("[data-field='payment']").textContent = updated.payment_status || "-";
          root.querySelector("[data-field='approval']").textContent = updated.approval_status || "-";
          const msg = form.querySelector("[data-api='admin-enrollment-form-msg']");
          showMessage(msg, "저장되었습니다.", "success");
        } catch (error) {
          const msg = form.querySelector("[data-api='admin-enrollment-form-msg']");
          showMessage(msg, error.message, "error");
        }
      });
    }
  }

  async function mountAdminPaymentsList() {
    const tbody = document.querySelector("[data-api='admin-payments-body']");
    if (!tbody) return;
    try {
      const rows = await request("/admin/payments");
      tbody.innerHTML = "";
      if (!Array.isArray(rows) || !rows.length) {
        tbody.innerHTML = "<tr><td colspan='6'>데이터가 없습니다.</td></tr>";
        return;
      }
      rows.forEach((p) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${p.id}</td>
          <td>${p.enrollment_id}</td>
          <td>${p.course_title || "-"}</td>
          <td>${Number(p.amount || 0).toLocaleString("ko-KR")}원</td>
          <td>${p.status || "-"}</td>
          <td><a href="./detail-001.html?id=${p.id}">상세</a></td>
        `;
        tbody.appendChild(tr);
      });
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan='6'>${error.message}</td></tr>`;
    }
  }

  async function mountAdminPaymentDetail() {
    const root = document.querySelector("[data-api='admin-payment-detail']");
    if (!root) return;
    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get("id")) || 1;
    let loadedPayment = null;
    try {
      const p = await request(`/admin/payments/${id}`);
      loadedPayment = p;
      root.querySelector("[data-field='id']").textContent = String(p.id);
      root.querySelector("[data-field='amount']").textContent = `${Number(p.amount || 0).toLocaleString("ko-KR")}원`;
      root.querySelector("[data-field='status']").textContent = p.status || "-";
      root.querySelector("[data-field='enrollment']").textContent = String(p.enrollment_id);
    } catch (error) {
      const msg = root.querySelector("[data-api='admin-payment-error']");
      if (msg) showMessage(msg, error.message, "error");
    }

    const form = document.querySelector("[data-api='admin-payment-patch']");
    if (form && form.status && loadedPayment && loadedPayment.status) {
      const hasOption = Array.from(form.status.options).some((o) => o.value === loadedPayment.status);
      if (hasOption) form.status.value = loadedPayment.status;
    }
    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const status = form.status.value;
        try {
          await request(`/admin/payments/${id}`, {
            method: "PATCH",
            body: JSON.stringify({ status }),
          });
          const msg = form.querySelector("[data-api='admin-payment-form-msg']");
          showMessage(msg, "결제 상태가 반영되었습니다.", "success");
          const p = await request(`/admin/payments/${id}`);
          root.querySelector("[data-field='status']").textContent = p.status || "-";
        } catch (error) {
          const msg = form.querySelector("[data-api='admin-payment-form-msg']");
          showMessage(msg, error.message, "error");
        }
      });
    }
  }

  async function mountMePaymentsTable() {
    const tbody = document.querySelector("[data-api='me-payments-body']");
    if (!tbody) return;
    try {
      const rows = await request("/me/payments");
      tbody.innerHTML = "";
      if (!Array.isArray(rows) || !rows.length) {
        tbody.innerHTML = "<tr><td colspan='5'>결제 내역이 없습니다.</td></tr>";
        return;
      }
      rows.forEach((p) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${p.id}</td>
          <td>${p.course_title || "-"}</td>
          <td>${Number(p.amount || 0).toLocaleString("ko-KR")}원</td>
          <td>${p.status || "-"}</td>
          <td>${p.created_at ? formatDateTime(String(p.created_at)) : "-"}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan='5'>${error.message}</td></tr>`;
    }
  }

  async function handleAdminReplySubmit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = form.message.value.trim();
    const messageNode = document.querySelector("[data-admin-inquiry-message]");
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") || "1";

    if (!message) {
      showMessage(messageNode, "답변 내용을 입력해 주세요.", "error");
      return;
    }

    try {
      await request(`/inquiries/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      form.reset();
      showMessage(messageNode, "답변이 등록되었습니다.", "success");
      await mountAdminInquiryDetail();
    } catch (error) {
      showMessage(messageNode, error.message, "error");
    }
  }

  function mountAuthForms() {
    mountOAuthButtons();
    if (consumeOAuthHashReturn() === true) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("registered") === "1") {
      const loginFormEarly = document.querySelector("[data-auth-form='login']");
      const messageEarly = loginFormEarly && loginFormEarly.querySelector("[data-auth-message]");
      if (messageEarly) {
        showMessage(messageEarly, "회원가입이 완료되었습니다. 이메일로 로그인해 주세요.", "success");
      }
      try {
        window.history.replaceState(null, "", window.location.pathname);
      } catch (_error) {
        /* ignore */
      }
    }

    const loginForm = document.querySelector("[data-auth-form='login']");
    if (loginForm) {
      warmupApi();
      loginForm.addEventListener("submit", handleLoginSubmit);
    }

    const registerForm = document.querySelector("[data-auth-form='register']");
    if (registerForm) {
      warmupApi();
      registerForm.addEventListener("submit", handleRegisterSubmit);
    }

    const inquiryForm = document.querySelector("[data-support-form='inquiry-new']");
    if (inquiryForm) {
      const currentUser = getCurrentUser();
      const nameInput = inquiryForm.querySelector("input[name='userName']");
      if (nameInput && currentUser && currentUser.name) {
        nameInput.value = currentUser.name;
      }
      if (!currentUser) {
        const messageNode = inquiryForm.querySelector("[data-auth-message]");
        showMessage(messageNode, "문의 등록은 로그인 후 이용 가능합니다.", "info");
      }
      inquiryForm.addEventListener("submit", handleInquirySubmit);
    }

    const passwordForm = document.querySelector("[data-auth-form='password-change']");
    if (passwordForm) {
      passwordForm.addEventListener("submit", handlePasswordChangeSubmit);
    }

    mountInquiryList();
    mountInquiryDetail();

    const adminFilterForm = document.querySelector("[data-admin-inquiry-filter-form]");
    if (adminFilterForm) {
      adminFilterForm.addEventListener("submit", (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const params = new URLSearchParams();
        const status = form.status.value;
        const type = form.type.value;
        const q = form.q.value.trim();
        if (status) params.set("status", status);
        if (type) params.set("type", type);
        if (q) params.set("q", q);
        params.set("page", "1");
        window.location.search = params.toString();
      });
    }

    const adminStatusForm = document.querySelector("[data-admin-inquiry-status-form]");
    if (adminStatusForm) {
      adminStatusForm.addEventListener("submit", handleAdminInquiryStatusSubmit);
    }

    const adminAssigneeForm = document.querySelector("[data-admin-inquiry-assignee-form]");
    if (adminAssigneeForm) {
      adminAssigneeForm.addEventListener("submit", handleAdminAssigneeSubmit);
    }

    const adminReplyForm = document.querySelector("[data-admin-inquiry-reply-form]");
    if (adminReplyForm) {
      adminReplyForm.addEventListener("submit", handleAdminReplySubmit);
    }

    mountAdminInquiryList();
    mountAdminInquiryDetail();

    mountCourseOpeningsList();
    mountOpeningDetail();
    mountEnrollApplyForm();
    mountMeEnrollmentsTable("[data-api='me-enrollments-body']");
    mountMeEnrollmentsTable("[data-api='mypage-enrollments-body']");
    mountMeEnrollmentDetail();
    mountDepositConfirm();
    mountEnrollComplete();
    mountMePaymentsTable();
    mountAdminEnrollmentsList();
    mountAdminEnrollmentDetail();
    mountAdminPaymentsList();
    mountAdminPaymentDetail();
  }

  window.addEventListener("DOMContentLoaded", mountAuthForms);
})();
