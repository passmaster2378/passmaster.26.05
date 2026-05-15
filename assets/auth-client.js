(() => {
  const DEFAULT_REMOTE_API_BASE = "https://passmaster-26-05.onrender.com/api";
  const DEFAULT_TIMEOUT_MS = 30000;
  const AUTH_TIMEOUT_MS = 45000;
  const isLocalHost =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  const isFileProtocol = window.location.protocol === "file:";
  const isGitHubPages = /\.github\.io$/i.test(window.location.hostname);

  function detectGitHubPagesProjectBase() {
    if (!isGitHubPages) return "";
    const normalized = String(window.location.pathname || "").replace(/\\/g, "/");
    const segments = normalized.split("/").filter(Boolean);
    if (!segments.length) return "";
    const first = segments[0];
    if (!first || first.endsWith(".html")) return "";
    return `/${first}`;
  }

  const GH_PROJECT_BASE = detectGitHubPagesProjectBase();

  function toSitePath(path) {
    const value = String(path || "").trim();
    if (!value) return value;
    if (!value.startsWith("/") || value.startsWith("//")) return value;
    if (!GH_PROJECT_BASE) return value;
    if (value === GH_PROJECT_BASE || value.startsWith(`${GH_PROJECT_BASE}/`)) return value;
    return `${GH_PROJECT_BASE}${value}`;
  }

  function normalizePassmasterApiBase(raw) {
    if (raw == null || typeof raw !== "string") return null;
    let t = raw.trim().replace(/\/+$/, "");
    if (!t) return null;
    if (!t.endsWith("/api")) t = `${t}/api`;
    return t;
  }

  const API_BASE =
    normalizePassmasterApiBase(window.PASSMASTER_API_BASE) ||
    (isLocalHost || isFileProtocol
      ? "http://localhost:4000/api"
      : isGitHubPages
        ? DEFAULT_REMOTE_API_BASE
        : "/api");

  /** OAuth 시작 URL은 API 호스트와 동일해야 합니다. 별도 게이트가 있으면 여기만 지정하세요. */
  const OAUTH_API_BASE =
    normalizePassmasterApiBase(window.PASSMASTER_OAUTH_API_BASE) ||
    normalizePassmasterApiBase(window.PASSMASTER_API_BASE) ||
    API_BASE;

  /** 메인 랜딩 자격증 카드 slug ↔ 표시명 (모집 필터·cert 딥링크와 동일) */
  const CERT_SLUG_LABEL_MAP = {
    forklift: "지게차기능사",
    excavator: "굴착기기능사",
    electric: "전기기능사",
    welding: "용접기능사",
    carrepair: "자동차정비기능사",
    beautician: "일반미용사",
    makeup: "메이크업 미용사",
    skin: "피부미용사",
    nail: "네일미용사",
    elevator: "승강기능사",
    cookkr: "한식조리기능사",
    cookwest: "양식조리기능사",
    cookcn: "중식조리기능사",
    cookjp: "일식조리기능사",
  };

  function openingMatchesCertSlug(o, slug) {
    const key = String(slug || "").trim().toLowerCase();
    if (!key) return true;
    const code = String(o.course_code || "").trim().toLowerCase();
    const title = String(o.course_title || "").trim();
    const label = CERT_SLUG_LABEL_MAP[key] || key;
    return code === key || title.includes(label);
  }

  let apiWarmupPromise = null;

  function getStoredSession() {
    try {
      const raw = localStorage.getItem("passmaster_auth");
      return raw ? JSON.parse(raw) : null;
    } catch (_error) {
      return null;
    }
  }

  /** 로그인 세션(토큰) 보유 여부 — 클라이언트 만료 시각으로 세션을 지우지 않습니다. */
  function hasSupportMemberSession() {
    const session = getStoredSession();
    return Boolean(session && session.user);
  }

  /** `[data-support-guest-only]` / `[data-support-member-only]` 표시 동기화 */
  function syncSupportGuestMemberSections() {
    const member = hasSupportMemberSession();
    document.querySelectorAll("[data-support-member-only]").forEach((el) => {
      el.hidden = !member;
    });
    document.querySelectorAll("[data-support-guest-only]").forEach((el) => {
      el.hidden = member;
    });
    refreshPassmasterSiteNavigation();
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
    const method = String((options && options.method) || "GET").toUpperCase();
    const shouldRetryNetworkError = retryNetworkError || method === "GET" || method === "HEAD";
    const maxAttempts = shouldRetryNetworkError ? 3 : 1;
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
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        response = await fetchWithTimeout(`${API_BASE}${path}`, fetchOptions, timeoutMs);
        break;
      } catch (error) {
        const isLastAttempt = attempt === maxAttempts - 1;
        if (!isLastAttempt) {
          // Render free tier cold start can cause first request timeout/network failure.
          await new Promise((resolve) => setTimeout(resolve, 700 * (attempt + 1)));
          continue;
        }
        const isTimeout = error && error.name === "AbortError";
        throw new Error(
          isTimeout
            ? `요청 시간이 초과되었습니다. (${API_BASE}) 초기 기동 시 20~40초가 걸릴 수 있어 잠시 후 다시 시도해 주세요.`
            : `API 서버에 연결할 수 없습니다. (${API_BASE}) 백엔드 실행 또는 배포 환경변수를 확인해 주세요.`
        );
      }
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        /* 세션은 유지합니다. 필요 시 사용자가 로그아웃하거나 재로그인합니다. */
      }
      throw new Error(data.message || "요청 처리 중 오류가 발생했습니다.");
    }
    return data;
  }

  function getLoginHref() {
    const nav = document.querySelector(".pm-header nav.pm-nav") || document.querySelector("nav.pm-nav");
    const fromNav = nav && nav.dataset && nav.dataset.pmOrigLoginHref;
    if (fromNav) return fromNav;
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

  async function mountOAuthButtons() {
    let googleEnabled = true;
    let kakaoEnabled = true;
    try {
      const r = await fetchWithTimeout(
        `${API_BASE}/auth/oauth/public-config`,
        { method: "GET" },
        8000
      );
      const j = await r.json().catch(() => ({}));
      if (r.ok && j && typeof j.googleEnabled === "boolean") {
        googleEnabled = j.googleEnabled;
        kakaoEnabled = j.kakaoEnabled;
      }
    } catch (_error) {
      /* 콜드스타트·CORS 등으로 실패해도 버튼은 눌러 볼 수 있게 둠 */
    }

    const isRegisterPage = /(^|\/)register\.html$/i.test(window.location.pathname);

    document.querySelectorAll("[data-oauth-provider]").forEach((btn) => {
      const provider = btn.getAttribute("data-oauth-provider");
      const ok =
        provider === "google" ? googleEnabled : provider === "kakao" ? kakaoEnabled : false;
      if (!ok) {
        btn.disabled = true;
        btn.setAttribute("aria-disabled", "true");
        btn.title = isRegisterPage
          ? "현재 소셜 계정 가입은 사용할 수 없습니다. 이메일 회원가입을 이용해 주세요."
          : provider === "google"
            ? "Render에 GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET을 설정한 뒤 사용할 수 있습니다."
            : "Render에 KAKAO_REST_API_KEY(및 필요 시 KAKAO_CLIENT_SECRET)를 설정한 뒤 사용할 수 있습니다.";
        btn.style.opacity = "0.5";
        btn.style.cursor = "not-allowed";
      }
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        if (!provider) return;
        const returnTo = encodeURIComponent(
          `${window.location.origin}${window.location.pathname}${window.location.search}`
        );
        window.location.href = `${OAUTH_API_BASE}/auth/oauth/${provider}/start?returnTo=${returnTo}`;
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
            session.user.role === "admin" ? "./admin/index.html" : "./mypage/index.html";
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
    return session.user;
  }

  function showMessage(target, message, type) {
    if (!target) return;
    target.textContent = message;
    target.className = `auth-message ${type}`;
    target.removeAttribute("hidden");
  }

  function toPaymentStatusLabel(status) {
    const value = String(status || "").trim().toLowerCase();
    const map = {
      pending: "결제대기",
      deposit_submitted: "입금요청",
      partial_paid: "부분결제",
      paid: "결제완료",
      refunded: "환불완료",
      awaiting_confirmation: "입금확인대기",
      completed: "확인완료",
      failed: "확인실패",
    };
    return map[value] || (status || "-");
  }

  function toApprovalStatusLabel(status) {
    const value = String(status || "").trim().toLowerCase();
    const map = {
      pending: "승인대기",
      approved: "승인완료",
      rejected: "반려",
      cancelled: "취소",
    };
    return map[value] || (status || "-");
  }

  function toApplicationStatusLabel(status) {
    const value = String(status || "").trim().toLowerCase();
    const map = {
      draft: "작성중",
      submitted: "제출완료",
      withdrawn: "철회",
    };
    return map[value] || (status || "-");
  }

  function toLearningStatusLabel(status) {
    const value = String(status || "").trim().toLowerCase();
    const map = {
      not_started: "학습전",
      in_progress: "학습중",
      completed: "학습완료",
    };
    return map[value] || (status || "-");
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

      const fallbackNext = data.user.role === "admin" ? "./admin/index.html" : "./mypage/index.html";
      const candidate = returnToParam || returnToStored;
      const next = candidate && candidate.startsWith("/") && !candidate.startsWith("//")
        ? toSitePath(candidate)
        : fallbackNext;
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
    const phone = form.phone ? String(form.phone.value).trim() : "";
    const password = form.password.value;
    const passwordConfirm = form.passwordConfirm ? form.passwordConfirm.value : "";
    const messageNode = form.querySelector("[data-auth-message]");
    const submitButton = form.querySelector("[data-auth-submit]");

    if (!name || !email || !password || !phone) {
      showMessage(messageNode, "이름, 이메일, 휴대전화, 비밀번호를 모두 입력해 주세요.", "error");
      return;
    }

    if (password.length < 8) {
      showMessage(messageNode, "비밀번호는 8자 이상 입력해 주세요.", "error");
      return;
    }

    if (password !== passwordConfirm) {
      showMessage(messageNode, "비밀번호와 비밀번호 확인이 일치하지 않습니다.", "error");
      return;
    }

    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 11 || !digits.startsWith("0")) {
      showMessage(messageNode, "올바른 휴대전화 번호를 입력해 주세요. (예: 01012345678)", "error");
      return;
    }

    try {
      submitButton.disabled = true;
      showMessage(messageNode, "서버 연결 확인 후 회원가입 처리 중입니다...", "info");
      await warmupApi();
      await request("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, phone: digits, password }),
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

    if (!hasSupportMemberSession()) {
      showMessage(
        messageNode,
        "1:1 문의는 로그인 후 이용할 수 있습니다. 로그인 또는 회원가입을 진행해 주세요.",
        "error"
      );
      return;
    }

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
      showMessage(messageNode, "비밀번호가 변경되었습니다. 로그인 상태는 유지됩니다.", "success");
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

    syncSupportGuestMemberSections();

    const summaryNode = document.querySelector("[data-inquiry-list-summary]");
    if (!hasSupportMemberSession()) {
      tableBody.innerHTML =
        "<tr><td colspan=\"5\">1:1 문의 목록은 로그인한 회원만 이용할 수 있습니다. 로그인 또는 회원가입 후 다시 접속해 주세요.</td></tr>";
      if (summaryNode) summaryNode.textContent = "로그인 필요";
      return;
    }

    try {
      const inquiries = await request("/me/inquiries");
      const list = Array.isArray(inquiries) ? inquiries : [];
      tableBody.innerHTML = "";

      if (!list.length) {
        tableBody.innerHTML = "<tr><td colspan='5'>등록된 문의가 없습니다.</td></tr>";
        if (summaryNode) summaryNode.textContent = "총 0건";
        const pageNode = document.querySelector("[data-inquiry-pagination]");
        if (pageNode) pageNode.innerHTML = "";
        return;
      }

      list.forEach((item) => {
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
        summaryNode.textContent = `내 문의 ${list.length}건`;
      }

      const pageNode = document.querySelector("[data-inquiry-pagination]");
      if (pageNode) pageNode.innerHTML = "";
    } catch (error) {
      tableBody.innerHTML = `<tr><td colspan='5'>문의 목록을 불러오지 못했습니다: ${error.message}</td></tr>`;
      if (summaryNode) summaryNode.textContent = "조회 실패";
    }
  }

  async function mountInquiryDetail() {
    const detailRoot = document.querySelector("[data-inquiry-detail]");
    if (!detailRoot) return;

    syncSupportGuestMemberSections();

    if (!hasSupportMemberSession()) {
      const errorNode = detailRoot.querySelector("[data-inquiry-error]");
      const tableWrap = detailRoot.querySelector(".pm-table-wrap");
      if (errorNode) {
        errorNode.textContent =
          "문의 상세는 로그인한 회원만 볼 수 있습니다. 로그인 또는 회원가입 후 이용해 주세요.";
        errorNode.className = "auth-message error";
      }
      if (tableWrap) tableWrap.hidden = true;
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") || "1";

    try {
      const item = await request(`/inquiries/${id}`);
      const session = getStoredSession();
      const myId = session && session.user ? Number(session.user.id) : 0;
      if (item.user_id != null && Number(item.user_id) !== myId) {
        throw new Error("본인이 작성한 문의만 확인할 수 있습니다.");
      }
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

  function compareCourseOpeningListOrder(a, b) {
    const ds = Number(a.display_seq ?? 0) - Number(b.display_seq ?? 0);
    if (ds !== 0) return ds;
    return Number(a.id) - Number(b.id);
  }

  /** 서버가 내려주는 display_seq(공개 모집 노출 번호) 또는 구 링크 호환용 내부 id */
  function courseOpeningClientLinkKey(o) {
    if (o.display_seq != null && Number(o.display_seq) > 0) return Number(o.display_seq);
    return Number(o.id);
  }

  /** GET /course-openings/:id 와 동일: 활성 모집에서 display_seq 우선, 없으면 내부 id */
  function resolveOpeningRequestToLinkKey(openings, requestedId) {
    if (!requestedId || !Number.isFinite(Number(requestedId)) || Number(requestedId) <= 0) return 0;
    const n = Number(requestedId);
    const list = Array.isArray(openings) ? openings : [];
    const byDisplay = list.find((o) => Number(o.display_seq) === n);
    if (byDisplay) return courseOpeningClientLinkKey(byDisplay);
    const byInternal = list.find((o) => Number(o.id) === n);
    if (byInternal) return courseOpeningClientLinkKey(byInternal);
    return 0;
  }

  function enrollApplyHref(openingId) {
    return `./apply/index.html?openingId=${openingId}`;
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
    return m ? Number(m[1]) : 0;
  }

  function formatEnrollPublicCourseTitle(raw) {
    const t = String(raw || "").trim();
    if (!t) return "-";
    if (/국가자격증/.test(t)) return t;
    return `${t} 국가자격증 필기반`;
  }

  async function mountCourseOpeningsList() {
    const targets = [
      { tbody: document.querySelector("[data-api='course-openings-body']"), status: document.querySelector("[data-api='course-openings-status']") },
      {
        tbody: document.querySelector("[data-api='enroll-public-openings-body']"),
        status: document.querySelector("[data-api='enroll-openings-public-status']"),
      },
    ].filter((t) => t.tbody);
    if (!targets.length) return;

    const filterBar = document.querySelector("[data-api='enroll-cert-filter-bar']");
    const certSlug = String(new URLSearchParams(window.location.search).get("cert") || "")
      .trim()
      .toLowerCase();

    const renderRows = (tbody, rows) => {
      tbody.innerHTML = "";
      const mode = tbody.getAttribute("data-api") || "";
      const enrollPublic = mode === "enroll-public-openings-body";
      const emptyColSpan = enrollPublic ? "5" : "6";
      const ordered = [...(Array.isArray(rows) ? rows : [])].sort(compareCourseOpeningListOrder);
      if (!ordered.length) {
        tbody.innerHTML = `<tr><td colspan='${emptyColSpan}'>모집 중인 과정이 없습니다.</td></tr>`;
        return;
      }
      ordered.forEach((o) => {
        const tr = document.createElement("tr");
        const linkKey = courseOpeningClientLinkKey(o);
        const href = enrollApplyHref(linkKey);
        const titleCell = enrollPublic ? formatEnrollPublicCourseTitle(o.course_title) : o.course_title || "-";
        const periodCell = enrollPublic
          ? "2개월 (입금 확인 후 학습 기간 안내)"
          : `${o.start_date || "-"} ~ ${o.end_date || "-"}`;
        const priceCell = `${Number(o.price || 0).toLocaleString("ko-KR")}원`;

        if (enrollPublic) {
          const displayNo = o.display_seq != null ? o.display_seq : "-";
          tr.innerHTML = `
            <td>${displayNo}</td>
            <td>${titleCell}</td>
            <td>${periodCell}</td>
            <td>${priceCell}</td>
            <td><a class="pm-btn pm-btn-primary" style="display:inline-flex;padding:6px 10px;font-size:13px" href="${href}">상세·신청 안내</a></td>
          `;
        } else {
          tr.innerHTML = `
            <td>${o.id}</td>
            <td>${titleCell}</td>
            <td>${periodCell}</td>
            <td>${o.application_status || "-"}</td>
            <td>${priceCell}</td>
            <td><a class="pm-btn pm-btn-primary" style="display:inline-flex;padding:6px 10px;font-size:13px" href="${href}">상세·신청 안내</a></td>
          `;
        }
        tbody.appendChild(tr);
      });
    };

    function renderCertFilterBar() {
      if (!filterBar) return;
      const chips = [{ slug: "", label: "전체" }].concat(
        Object.entries(CERT_SLUG_LABEL_MAP).map(([slug, label]) => ({ slug, label }))
      );
      filterBar.innerHTML = `<div class="pm-cert-chip-row" role="group" aria-label="자격 과정 필터">${chips
        .map(({ slug, label }) => {
          const active = slug ? certSlug === slug : !certSlug;
          const href = slug
            ? `./index.html?cert=${encodeURIComponent(slug)}#enroll-openings`
            : `./index.html#enroll-openings`;
          const cls = active ? "pm-cert-chip pm-cert-chip-active" : "pm-cert-chip";
          return `<a class="${cls}" href="${href}">${label}</a>`;
        })
        .join("")}</div>`;
    }

    try {
      const rows = await request("/course-openings");
      const allRows = Array.isArray(rows) ? rows : [];
      const rowsForPublicFiltered =
        filterBar && certSlug ? allRows.filter((o) => openingMatchesCertSlug(o, certSlug)) : allRows;

      renderCertFilterBar();

      targets.forEach(({ tbody }) => {
        const isEnrollPublic = tbody.getAttribute("data-api") === "enroll-public-openings-body";
        const list = isEnrollPublic && filterBar ? rowsForPublicFiltered : allRows;
        renderRows(tbody, list);
      });

      targets.forEach(({ tbody, status }) => {
        if (!status) return;
        const isEnrollPublic = tbody.getAttribute("data-api") === "enroll-public-openings-body";
        const list = isEnrollPublic && filterBar ? rowsForPublicFiltered : allRows;
        if (isEnrollPublic && filterBar) {
          if (certSlug && list.length === 0 && allRows.length > 0) {
            showMessage(
              status,
              `선택한 과정(${CERT_SLUG_LABEL_MAP[certSlug] || certSlug})에 해당하는 모집이 없습니다. 다른 과정을 선택하거나 전체를 확인해 주세요.`,
              "info"
            );
          } else if (list.length) {
            showMessage(
              status,
              certSlug
                ? `${CERT_SLUG_LABEL_MAP[certSlug] || certSlug} 관련 모집 ${list.length}건입니다. 버튼을 누르면 신청서 작성으로 이동합니다.`
                : `모집 ${list.length}건을 불러왔습니다. 버튼을 누르면 신청서 작성으로 이동합니다.`,
              "success"
            );
          } else {
            showMessage(status, "현재 신청 가능한 공개 모집이 없습니다.", "info");
          }
        } else if (allRows.length) {
          showMessage(status, `모집 ${allRows.length}건을 불러왔습니다. 버튼을 누르면 신청서 작성으로 이동합니다.`, "success");
        } else {
          showMessage(status, "현재 신청 가능한 공개 모집이 없습니다.", "info");
        }
      });
    } catch (error) {
      targets.forEach(({ tbody }) => {
        const enrollPublic = tbody.getAttribute("data-api") === "enroll-public-openings-body";
        const cs = enrollPublic ? "5" : "6";
        tbody.innerHTML = `<tr><td colspan='${cs}'>목록을 불러오지 못했습니다: ${error.message}</td></tr>`;
      });
      targets.forEach(({ status }) => {
        if (status) showMessage(status, error.message, "error");
      });
    }
  }

  async function mountEnrollMyOnlyTable() {
    const tbody = document.querySelector("[data-api='enroll-index-enrollments-body']");
    const ctaPanel = document.querySelector("[data-api='enroll-cert-cta-panel']");
    const certParam = String(new URLSearchParams(window.location.search).get("cert") || "")
      .trim()
      .toLowerCase();

    function escapeHtml(raw) {
      return String(raw ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    }

    function openingMatchesCert(o) {
      if (!certParam) return false;
      return openingMatchesCertSlug(o, certParam);
    }

    function hideCertCtaPanel() {
      if (!ctaPanel) return;
      ctaPanel.style.display = "none";
      ctaPanel.innerHTML = "";
    }

    function renderCertApplyCta(matchingOpenings) {
      if (!ctaPanel || !matchingOpenings.length) return "";
      const items = matchingOpenings
        .map((o) => {
          const title = escapeHtml(formatEnrollPublicCourseTitle(o.course_title || "과정"));
          const linkKey = courseOpeningClientLinkKey(o);
          const oid = encodeURIComponent(String(linkKey));
          const applyHref = `./apply/index.html?openingId=${oid}`;
          const price = Number(o.price || 0).toLocaleString("ko-KR");
          return `
          <li class="pm-card" style="margin: 0; list-style: none; padding: 14px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: space-between">
            <div>
              <strong>${title}</strong>
              <div style="font-size:13px;color:#667085;margin-top:4px">2개월 · ${price}원</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <a class="pm-btn pm-btn-primary" style="display:inline-flex;padding:6px 10px;font-size:13px" href="${applyHref}">신청서 작성</a>
            </div>
          </li>`;
        })
        .join("");
      return `
        <h3 style="margin-top: 0">수강신청 진행</h3>
        <p class="pm-summary" style="margin-top: 8px">
          선택하신 자격 과정 모집이 열려 있으면 아래에서 <strong>수강신청 진행</strong>을 눌러 신청서를 작성해 주세요.
        </p>
        <ul style="list-style: none; padding: 0; margin: 16px 0 0; display: flex; flex-direction: column; gap: 12px">
          ${items}
        </ul>
      `;
    }

    if (!tbody) {
      if (!certParam || !ctaPanel) return;
      hideCertCtaPanel();
      try {
        const openingsSnapshot = await request("/course-openings");
        const list = Array.isArray(openingsSnapshot) ? openingsSnapshot : [];
        const matchingOpenings = list.filter(openingMatchesCert);
        const label = CERT_SLUG_LABEL_MAP[certParam] || certParam;
        if (matchingOpenings.length) {
          ctaPanel.style.display = "";
          ctaPanel.innerHTML = `
            <h2 style="margin-top: 0">${label} 수강신청</h2>
            <p class="pm-summary">로그인 후 신청서 작성 및 입금 안내까지 이어집니다. 신청 내역은 <a href="../mypage/index.html">마이페이지</a>에서 확인할 수 있습니다.</p>
            ${renderCertApplyCta(matchingOpenings)}
          `;
        } else {
          ctaPanel.style.display = "";
          ctaPanel.innerHTML = `<p class="pm-summary"><strong>${label}</strong> 과정은 현재 모집 준비 중입니다. 모집이 열리면 이 안내가 갱신됩니다.</p>`;
        }
      } catch (error) {
        ctaPanel.style.display = "";
        ctaPanel.innerHTML = `<p class="auth-message error">${error.message}</p>`;
      }
      return;
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
      root.querySelector("[data-field='title']").textContent = formatEnrollPublicCourseTitle(o.course_title);
      root.querySelector("[data-field='period']").textContent = "2개월 (입금 확인 후 학습 기간 안내)";
      root.querySelector("[data-field='price']").textContent = `${Number(o.price || 0).toLocaleString("ko-KR")}원`;
      root.querySelector("[data-field='category']").textContent = o.category || "-";
    } catch (error) {
      const msg = root.querySelector("[data-api='opening-detail-error']");
      if (msg) showMessage(msg, error.message, "error");
    }

    const legacyBtn = document.querySelector("[data-api='opening-enroll-btn']");
    if (legacyBtn) {
      legacyBtn.addEventListener("click", (event) => {
        event.preventDefault();
        window.location.href = `../apply/index.html?openingId=${openingId}`;
      });
    }
  }

  async function mountEnrollApplyForm() {
    const form = document.querySelector("[data-api='enroll-apply-form']");
    const root = document.querySelector("[data-api='enroll-apply-root']");
    if (!form || !root) return;

    const messageEl = root.querySelector("[data-api='enroll-apply-message']");
    const submitBtn = form.querySelector("[data-api='enroll-apply-submit']");
    const openingSelect = form.querySelector("[data-api='enroll-apply-opening-select']");
    const hiddenOpeningId = form.querySelector("input[name='openingId']");
    const back = document.querySelector("[data-api='enroll-apply-back']");
    const rememberCheckbox = form.querySelector("[data-api='enroll-remember-opening']");
    const REMEMBER_OPENING_KEY = "passmaster_prefs_remember_opening";
    const LAST_OPENING_LINK_KEY = "passmaster_prefs_last_opening_link_id";

    function readRememberOpeningPref() {
      try {
        return localStorage.getItem(REMEMBER_OPENING_KEY) === "1";
      } catch (_e) {
        return false;
      }
    }

    function setRememberOpeningPref(on) {
      try {
        if (on) localStorage.setItem(REMEMBER_OPENING_KEY, "1");
        else {
          localStorage.removeItem(REMEMBER_OPENING_KEY);
          localStorage.removeItem(LAST_OPENING_LINK_KEY);
        }
      } catch (_e) {
        /* ignore */
      }
    }

    function savePreferredOpeningLinkId(linkId) {
      if (!readRememberOpeningPref() || !linkId) return;
      try {
        localStorage.setItem(LAST_OPENING_LINK_KEY, String(linkId));
      } catch (_e) {
        /* ignore */
      }
    }

    function syncBackLink(openingId) {
      if (!back) return;
      back.href = "../index.html";
    }

    function applyOpeningToDisplay(o) {
      const titleDisplay = formatEnrollPublicCourseTitle(o.course_title);
      const titleNode = root.querySelector("[data-field='title']");
      const periodNode = root.querySelector("[data-field='period']");
      const priceNode = root.querySelector("[data-field='price']");
      if (titleNode) titleNode.textContent = titleDisplay;
      if (periodNode) {
        periodNode.textContent = "2개월 (입금 확인 완료일부터 안내된 학습 기간이 적용됩니다)";
      }
      if (priceNode) priceNode.textContent = `${Number(o.price || 0).toLocaleString("ko-KR")}원`;
    }

    let openingsCache = [];
    const initialOpeningIdFromUrl = parseOpeningIdFromUrl();
    let activeOpeningId = initialOpeningIdFromUrl;

    try {
      openingsCache = await request("/course-openings");
      if (!Array.isArray(openingsCache)) openingsCache = [];
    } catch (error) {
      if (messageEl) showMessage(messageEl, error.message, "error");
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    if (openingSelect) {
      openingSelect.innerHTML = "";
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "과정을 선택하세요";
      openingSelect.appendChild(placeholder);
      [...openingsCache].sort(compareCourseOpeningListOrder).forEach((o) => {
        const opt = document.createElement("option");
        const linkKey = courseOpeningClientLinkKey(o);
        opt.value = String(linkKey);
        opt.textContent = `${formatEnrollPublicCourseTitle(o.course_title)} · 모집 ${o.display_seq ?? linkKey}번`;
        openingSelect.appendChild(opt);
      });
    }

    if (!openingsCache.length) {
      if (messageEl) showMessage(messageEl, "현재 신청 가능한 모집이 없습니다.", "error");
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    if (initialOpeningIdFromUrl > 0) {
      activeOpeningId = resolveOpeningRequestToLinkKey(openingsCache, initialOpeningIdFromUrl);
      if (!activeOpeningId && messageEl) {
        showMessage(
          messageEl,
          "요청한 모집을 현재 목록에서 찾을 수 없습니다. 수강 신청 목록에서 다시 선택해 주세요.",
          "error"
        );
      }
    } else if (readRememberOpeningPref()) {
      let saved = 0;
      try {
        saved = Number(localStorage.getItem(LAST_OPENING_LINK_KEY) || 0);
      } catch (_e) {
        saved = 0;
      }
      if (Number.isFinite(saved) && saved > 0) {
        const remembered = openingsCache.find((o) => courseOpeningClientLinkKey(o) === saved);
        if (remembered) activeOpeningId = saved;
      }
    }

    if (activeOpeningId && activeOpeningId !== initialOpeningIdFromUrl && window.history.replaceState) {
      try {
        const u = new URL(window.location.href);
        u.searchParams.set("openingId", String(activeOpeningId));
        window.history.replaceState(null, "", u.pathname + u.search + u.hash);
      } catch (_e) {
        /* ignore */
      }
    }

    if (hiddenOpeningId) {
      hiddenOpeningId.value = activeOpeningId ? String(activeOpeningId) : "";
    }
    if (openingSelect) {
      openingSelect.value = activeOpeningId ? String(activeOpeningId) : "";
    }
    syncBackLink(activeOpeningId);

    async function loadOpening(openingId) {
      if (!openingId) {
        const titleNode = root.querySelector("[data-field='title']");
        const periodNode = root.querySelector("[data-field='period']");
        const priceNode = root.querySelector("[data-field='price']");
        if (titleNode) titleNode.textContent = "-";
        if (periodNode) periodNode.textContent = "-";
        if (priceNode) priceNode.textContent = "-";
        if (messageEl) {
          showMessage(messageEl, "상단 목록에서 신청할 과정을 선택해 주세요.", "info");
        }
        if (submitBtn) submitBtn.disabled = true;
        return;
      }
      if (hiddenOpeningId) hiddenOpeningId.value = String(openingId);
      syncBackLink(openingId);
      try {
        const o = await request(`/course-openings/${openingId}`);
        applyOpeningToDisplay(o);
        sessionStorage.setItem("passmaster_last_apply_opening_id", String(openingId));
        savePreferredOpeningLinkId(courseOpeningClientLinkKey(o));
        if (messageEl) {
          showMessage(messageEl, "모집 정보를 불러왔습니다. 인적 사항과 동의를 확인한 뒤 신청해 주세요.", "success");
        }
        if (submitBtn) submitBtn.disabled = false;
      } catch (error) {
        if (messageEl) showMessage(messageEl, error.message, "error");
        if (submitBtn) submitBtn.disabled = true;
      }
    }

    if (openingSelect) {
      openingSelect.addEventListener("change", () => {
        const next = Number(openingSelect.value);
        activeOpeningId = next;
        const u = new URL(window.location.href);
        if (next) {
          u.searchParams.set("openingId", String(next));
        } else {
          u.searchParams.delete("openingId");
        }
        try {
          window.history.replaceState(null, "", u.pathname + u.search);
        } catch (_e) {
          /* ignore */
        }
        loadOpening(next);
      });
    }

    if (rememberCheckbox) {
      rememberCheckbox.checked = readRememberOpeningPref();
      rememberCheckbox.addEventListener("change", () => {
        const on = rememberCheckbox.checked;
        setRememberOpeningPref(on);
        if (on) {
          const cur = Number(hiddenOpeningId && hiddenOpeningId.value);
          if (cur) savePreferredOpeningLinkId(cur);
        }
      });
    }

    try {
      const u = new URL(window.location.href);
      if (activeOpeningId) {
        u.searchParams.set("openingId", String(activeOpeningId));
        try {
          window.history.replaceState(null, "", u.pathname + u.search);
        } catch (_e) {
          /* ignore */
        }
      }
      await loadOpening(activeOpeningId);
    } catch (error) {
      if (messageEl) showMessage(messageEl, error.message, "error");
      if (submitBtn) submitBtn.disabled = true;
    }

    const user = getCurrentUser();
    if (user) {
      const nameInput = form.querySelector("input[name='applicantName']");
      const emailInput = form.querySelector("input[name='applicantEmail']");
      const phoneInput = form.querySelector("input[name='applicantPhone']");
      if (nameInput && user.name) nameInput.value = user.name;
      if (emailInput && user.email) emailInput.value = user.email;
      if (phoneInput && user.phone) phoneInput.value = user.phone;
    } else if (messageEl) {
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
      const oid = Number(hiddenOpeningId && hiddenOpeningId.value);
      if (!oid) {
        if (messageEl) showMessage(messageEl, "과정을 선택해 주세요.", "error");
        return;
      }

      const name = (form.querySelector("input[name='applicantName']") || {}).value?.trim() || "";
      const birthDate = (form.querySelector("input[name='applicantBirth']") || {}).value?.trim() || "";
      const phone = (form.querySelector("input[name='applicantPhone']") || {}).value?.trim() || "";
      const email = (form.querySelector("input[name='applicantEmail']") || {}).value?.trim() || "";

      if (!name || !birthDate || !phone || !email) {
        if (messageEl) showMessage(messageEl, "신청자 정보를 모두 입력해 주세요.", "error");
        return;
      }
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 10 || digits.length > 11 || !digits.startsWith("0")) {
        if (messageEl) showMessage(messageEl, "올바른 연락처(휴대전화)를 입력해 주세요.", "error");
        return;
      }

      const agreeRefund = form.querySelector("input[name='agreeRefund']");
      const agreePrivacy = form.querySelector("input[name='agreePrivacy']");
      if (!agreeRefund?.checked || !agreePrivacy?.checked) {
        if (messageEl) showMessage(messageEl, "필수 동의 항목에 체크해 주세요.", "error");
        return;
      }

      const applicationMeta = {
        applicant: {
          name,
          birthDate,
          phone: digits,
          email,
        },
        agreements: {
          refund: true,
          privacy: true,
        },
      };

      try {
        if (submitBtn) submitBtn.disabled = true;
        const created = await request("/enrollments", {
          method: "POST",
          body: JSON.stringify({ openingId: oid, applicationMeta }),
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
        tbody.innerHTML = "<tr><td colspan='6'>현재 신청 내역이 없습니다.</td></tr>";
        return;
      }
      rows.forEach((e) => {
        const tr = document.createElement("tr");
        const detailHref = toSitePath(`/my-courses/enrollment-001/index.html?id=${encodeURIComponent(String(e.id))}`);
        tr.innerHTML = `
          <td>${e.id}</td>
          <td>${e.course_title || "-"}</td>
          <td>${toPaymentStatusLabel(e.payment_status)}</td>
          <td>${toApprovalStatusLabel(e.approval_status)}</td>
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
    const msg = root.querySelector("[data-api='me-enrollment-error']");
    const setFields = (e) => {
      root.querySelector("[data-field='id']").textContent = String(e.id);
      root.querySelector("[data-field='course']").textContent = e.course_title || "-";
      root.querySelector("[data-field='payment']").textContent = toPaymentStatusLabel(e.payment_status);
      root.querySelector("[data-field='approval']").textContent = toApprovalStatusLabel(e.approval_status);
      root.querySelector("[data-field='learning']").textContent = e.learning_status || "-";
      root.querySelector("[data-field='progress']").textContent = `${e.progress_percent ?? 0}%`;
    };
    try {
      if (!id) throw new Error("INVALID_OR_MISSING_ID");
      const e = await request(`/me/enrollments/${id}`);
      setFields(e);
      if (msg) showMessage(msg, "수강 상세를 불러왔습니다.", "success");
    } catch (error) {
      try {
        const rows = await request("/me/enrollments");
        if (!Array.isArray(rows) || !rows.length) {
          if (msg) showMessage(msg, "수강 신청 내역이 없습니다.", "info");
          return;
        }
        const fallback = rows[0];
        setFields(fallback);
        const current = new URL(window.location.href);
        current.searchParams.set("id", String(fallback.id));
        window.history.replaceState(null, "", `${current.pathname}${current.search}`);
        if (msg) showMessage(msg, "요청한 수강 ID를 찾을 수 없어 내 최근 수강으로 표시했습니다.", "info");
      } catch (fallbackError) {
        if (msg) showMessage(msg, fallbackError.message || error.message, "error");
      }
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
    const form = document.querySelector("[data-api='payment-transfer-form']");
    const btn = document.querySelector("[data-api='deposit-submit']");

    try {
      const e = await request(`/me/enrollments/${enrollmentId}`);
      root.querySelector("[data-field='course']").textContent = e.course_title || "-";
      root.querySelector("[data-field='amount']").textContent = `${Number(e.price || 0).toLocaleString("ko-KR")}원`;
      root.querySelector("[data-field='enrollmentId']").textContent = String(e.id);
    } catch (error) {
      showMessage(root.querySelector("[data-api='payment-message']"), error.message, "error");
      return;
    }
    if (btn) {
      btn.addEventListener("click", async () => {
        try {
          const depositorName =
            form && form.depositorName && typeof form.depositorName.value === "string"
              ? form.depositorName.value.trim()
              : "";
          const transferNote =
            form && form.transferNote && typeof form.transferNote.value === "string"
              ? form.transferNote.value.trim()
              : "";
          if (!depositorName) {
            alert("입금자명을 입력해 주세요.");
            return;
          }
          btn.disabled = true;
          await request(`/me/enrollments/${enrollmentId}/deposit`, {
            method: "PATCH",
            body: JSON.stringify({ depositorName, transferNote }),
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
      root.innerHTML =
        '<li class="enroll-complete-line"><strong>안내</strong><span>완료된 신청 정보를 찾을 수 없습니다.</span></li>';
      return;
    }
    root.innerHTML =
      '<li class="enroll-complete-line"><strong>안내</strong><span>불러오는 중…</span></li>';
    try {
      const e = await request(`/me/enrollments/${enrollmentId}`);
      const courseTitle = formatEnrollPublicCourseTitle(e.course_title);
      root.innerHTML = `
        <li class="enroll-complete-line"><strong>신청 번호</strong><span>${e.id}</span></li>
        <li class="enroll-complete-line"><strong>신청 과정</strong><span>${courseTitle}</span></li>
        <li class="enroll-complete-line"><strong>결제 상태</strong><span>${toPaymentStatusLabel(e.payment_status)}</span></li>
        <li class="enroll-complete-line"><strong>승인 상태</strong><span>${toApprovalStatusLabel(e.approval_status)}</span></li>
        <li class="enroll-complete-line"><strong>학습 상태</strong><span>${toLearningStatusLabel(e.learning_status)}</span></li>
        <li class="enroll-complete-line"><strong>진행률</strong><span>${e.progress_percent ?? 0}%</span></li>
        <li class="enroll-complete-line"><strong>신청 처리</strong><span>${toApplicationStatusLabel(e.application_status)}</span></li>`;
    } catch (error) {
      root.innerHTML = `<li class="enroll-complete-line">${error.message}</li>`;
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
          <td>${toPaymentStatusLabel(e.payment_status)}</td>
          <td>${toApprovalStatusLabel(e.approval_status)}</td>
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
    const id = Number(params.get("id"));
    const errEl = root.querySelector("[data-api='admin-enrollment-error']");

    function applyEnrollmentToDom(e) {
      const idSpan = root.querySelector("[data-field='id']");
      if (idSpan) idSpan.textContent = String(e.id);
      const userSpan = root.querySelector("[data-field='user']");
      if (userSpan) userSpan.textContent = `${e.user_name} (${e.user_email})`;
      const courseSpan = root.querySelector("[data-field='course']");
      if (courseSpan) courseSpan.textContent = e.course_title || "-";
      const paymentSpan = root.querySelector("[data-field='payment']");
      if (paymentSpan) paymentSpan.textContent = toPaymentStatusLabel(e.payment_status);
      const approvalSpan = root.querySelector("[data-field='approval']");
      if (approvalSpan) approvalSpan.textContent = toApprovalStatusLabel(e.approval_status);
      const learningSpan = root.querySelector("[data-field='learning']");
      if (learningSpan) learningSpan.textContent = toLearningStatusLabel(e.learning_status);
    }

    if (!Number.isInteger(id) || id <= 0) {
      if (errEl) showMessage(errEl, "목록에서 ‘관리’를 눌러 들어오거나 URL에 유효한 ?id=(신청 번호)를 넣어 주세요.", "error");
      return;
    }

    try {
      const e = await request(`/admin/enrollments/${id}`);
      applyEnrollmentToDom(e);
    } catch (error) {
      if (errEl) showMessage(errEl, error.message, "error");
    }

    const form = document.querySelector("[data-api='admin-enrollment-patch']");
    if (!form || form.dataset.bound) return;
    form.dataset.bound = "1";
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const payment_status = form.payment_status.value || undefined;
      const approval_status = form.approval_status.value || undefined;
      const learning_status = form.learning_status.value || undefined;
      const body = {};
      if (payment_status) body.payment_status = payment_status;
      if (approval_status) body.approval_status = approval_status;
      if (learning_status) body.learning_status = learning_status;
      if (!Object.keys(body).length) {
        const msg = form.querySelector("[data-api='admin-enrollment-form-msg']");
        showMessage(msg, "변경할 항목을 하나 이상 선택해 주세요.", "error");
        return;
      }
      try {
        const updated = await request(`/admin/enrollments/${id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
        applyEnrollmentToDom(updated);
        form.payment_status.value = "";
        form.approval_status.value = "";
        form.learning_status.value = "";
        const msg = form.querySelector("[data-api='admin-enrollment-form-msg']");
        showMessage(msg, "저장되었습니다.", "success");
      } catch (error) {
        const msg = form.querySelector("[data-api='admin-enrollment-form-msg']");
        showMessage(msg, error.message, "error");
      }
    });
  }

  async function mountAdminPaymentsList() {
    const tbody = document.querySelector("[data-api='admin-payments-body']");
    if (!tbody) return;
    const searchInput = document.getElementById("admin-payments-search");
    const statusFilter = document.getElementById("admin-payments-status-filter");
    const refreshBtn = document.getElementById("admin-payments-refresh");
    const totalEl = document.getElementById("admin-payments-total");
    const awaitingEl = document.getElementById("admin-payments-awaiting");
    const completedEl = document.getElementById("admin-payments-completed");
    const visibleEl = document.getElementById("admin-payments-visible");
    let allRows = [];

    const render = () => {
      const q = searchInput ? searchInput.value.trim().toLowerCase() : "";
      const status = statusFilter ? statusFilter.value : "";
      const filtered = allRows.filter((p) => {
        const searchText =
          `${p.id || ""} ${p.enrollment_id || ""} ${p.user_name || ""} ${p.user_email || ""} ${p.course_title || ""}`.toLowerCase();
        const qMatch = !q || searchText.includes(q);
        const statusMatch = !status || String(p.status || "") === status;
        return qMatch && statusMatch;
      });
      tbody.innerHTML = "";
      if (!filtered.length) {
        tbody.innerHTML = "<tr><td colspan='6'>조건에 맞는 결제 데이터가 없습니다.</td></tr>";
      } else {
        filtered.forEach((p) => {
          const tr = document.createElement("tr");
          if (p.status === "awaiting_confirmation") tr.className = "pm-payment-row--awaiting";
          else if (p.status === "completed") tr.className = "pm-payment-row--completed";
          tr.innerHTML = `
            <td>${p.enrollment_id}<br/><small>결제 #${p.id}</small></td>
            <td>${p.user_name || "-"}<br/><small>${p.user_email || "-"}</small></td>
            <td>${p.course_title || "-"}</td>
            <td>${Number(p.amount || 0).toLocaleString("ko-KR")}원</td>
            <td>${toPaymentStatusLabel(p.status)}</td>
            <td><a href="./detail-001.html?id=${p.id}">상세</a></td>
          `;
          tbody.appendChild(tr);
        });
      }
      if (visibleEl) visibleEl.textContent = String(filtered.length);
    };

    const bindUi = () => {
      if (searchInput && !searchInput.dataset.bound) {
        searchInput.addEventListener("input", render);
        searchInput.dataset.bound = "1";
      }
      if (statusFilter && !statusFilter.dataset.bound) {
        statusFilter.addEventListener("change", render);
        statusFilter.dataset.bound = "1";
      }
      if (refreshBtn && !refreshBtn.dataset.bound) {
        refreshBtn.addEventListener("click", loadRows);
        refreshBtn.dataset.bound = "1";
      }
    };

    const updateStats = () => {
      if (totalEl) totalEl.textContent = String(allRows.length);
      if (awaitingEl) awaitingEl.textContent = String(allRows.filter((r) => r.status === "awaiting_confirmation").length);
      if (completedEl) completedEl.textContent = String(allRows.filter((r) => r.status === "completed").length);
    };

    const loadRows = async () => {
      try {
        const rows = await request("/admin/payments");
        allRows = Array.isArray(rows) ? rows : [];
        if (!allRows.length) {
          tbody.innerHTML = "<tr><td colspan='6'>데이터가 없습니다.</td></tr>";
          if (totalEl) totalEl.textContent = "0";
          if (awaitingEl) awaitingEl.textContent = "0";
          if (completedEl) completedEl.textContent = "0";
          if (visibleEl) visibleEl.textContent = "0";
          return;
        }
        updateStats();
        render();
      } catch (error) {
        tbody.innerHTML = `<tr><td colspan='6'>${error.message}</td></tr>`;
      }
    };

    bindUi();
    try {
      await loadRows();
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

    const renderDetail = (p) => {
      root.querySelector("[data-field='id']").textContent = String(p.id);
      root.querySelector("[data-field='amount']").textContent = `${Number(p.amount || 0).toLocaleString("ko-KR")}원`;
      root.querySelector("[data-field='status']").textContent = toPaymentStatusLabel(p.status);
      root.querySelector("[data-field='enrollment']").textContent = String(p.enrollment_id);
      if (root.querySelector("[data-field='user']")) {
        root.querySelector("[data-field='user']").textContent = `${p.user_name || "-"} (${p.user_email || "-"})`;
      }
      if (root.querySelector("[data-field='depositor']")) {
        root.querySelector("[data-field='depositor']").textContent = p.depositor_name || "-";
      }
      if (root.querySelector("[data-field='submittedAt']")) {
        root.querySelector("[data-field='submittedAt']").textContent = p.submitted_at
          ? formatDateTime(String(p.submitted_at))
          : "-";
      }
      if (root.querySelector("[data-field='reviewNote']")) {
        root.querySelector("[data-field='reviewNote']").textContent = p.review_note || "-";
      }
      if (root.querySelector("[data-field='netPaid']")) {
        const netPaid = p.payment_summary ? Number(p.payment_summary.netPaid || 0) : 0;
        root.querySelector("[data-field='netPaid']").textContent = `${netPaid.toLocaleString("ko-KR")}원`;
      }
      if (root.querySelector("[data-field='outstanding']")) {
        const outstanding = p.payment_summary ? Number(p.payment_summary.outstandingAmount || 0) : 0;
        root.querySelector("[data-field='outstanding']").textContent = `${outstanding.toLocaleString("ko-KR")}원`;
      }
    };

    const renderHistory = (p) => {
      const historyBody = root.querySelector("[data-api='admin-payment-history-body']");
      if (historyBody) {
        const historyRows = Array.isArray(p.payment_history) ? p.payment_history : [];
        historyBody.innerHTML = "";
        if (!historyRows.length) {
          historyBody.innerHTML = "<tr><td colspan='5'>결제 이력이 없습니다.</td></tr>";
        } else {
          historyRows.forEach((h) => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
              <td>${h.id}</td>
              <td>${toPaymentStatusLabel(h.status)}</td>
              <td>${Number(h.amount || 0).toLocaleString("ko-KR")}원</td>
              <td>${h.depositor_name || "-"}</td>
              <td>${h.submitted_at ? formatDateTime(String(h.submitted_at)) : "-"}</td>
            `;
            historyBody.appendChild(tr);
          });
        }
      }
    };

    const renderAudit = (p) => {
      const auditBody = root.querySelector("[data-api='admin-payment-audit-body']");
      if (!auditBody) return;
      const logs = Array.isArray(p.payment_audit_logs) ? p.payment_audit_logs : [];
      auditBody.innerHTML = "";
      if (!logs.length) {
        auditBody.innerHTML = "<tr><td colspan='5'>감사 로그가 없습니다.</td></tr>";
        return;
      }
      logs.forEach((log) => {
        const tr = document.createElement("tr");
        const before = log.before_status ? toPaymentStatusLabel(log.before_status) : "-";
        const after = log.after_status ? toPaymentStatusLabel(log.after_status) : "-";
        tr.innerHTML = `
          <td>${log.created_at ? formatDateTime(String(log.created_at)) : "-"}</td>
          <td>${log.action || "-"}</td>
          <td>${before} -> ${after}</td>
          <td>${Number(log.amount || 0).toLocaleString("ko-KR")}원</td>
          <td>${log.note || "-"}</td>
        `;
        auditBody.appendChild(tr);
      });
    };

    const syncForm = (form, p) => {
      if (!form) return;
      if (form.status && p.status) {
        const hasOption = Array.from(form.status.options).some((o) => o.value === p.status);
        if (hasOption) form.status.value = p.status;
      }
      if (form.review_note) form.review_note.value = p.review_note || "";
      if (form.refund_amount && p.payment_summary) {
        const maxRefund = Number(p.payment_summary.netPaid || 0);
        form.refund_amount.max = maxRefund > 0 ? String(maxRefund) : "";
      }
    };

    const fetchAndRender = async (form) => {
      const p = await request(`/admin/payments/${id}`);
      loadedPayment = p;
      renderDetail(p);
      renderHistory(p);
      renderAudit(p);
      syncForm(form, p);
      return p;
    };

    try {
      await fetchAndRender(null);
    } catch (error) {
      const msg = root.querySelector("[data-api='admin-payment-error']");
      if (msg) showMessage(msg, error.message, "error");
    }

    const form = document.querySelector("[data-api='admin-payment-patch']");
    if (form && loadedPayment) {
      syncForm(form, loadedPayment);
    }
    if (form) {
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const status = form.status.value;
        const reviewNote =
          form.review_note && typeof form.review_note.value === "string" ? form.review_note.value.trim() : "";
        const refundAmount =
          form.refund_amount && typeof form.refund_amount.value === "string" && form.refund_amount.value.trim()
            ? Number(form.refund_amount.value)
            : undefined;
        if (status === "refunded" && refundAmount !== undefined && (!Number.isFinite(refundAmount) || refundAmount <= 0)) {
          const msg = form.querySelector("[data-api='admin-payment-form-msg']");
          showMessage(msg, "환불 금액은 1원 이상 입력해 주세요.", "error");
          return;
        }
        try {
          const body = { status, reviewNote };
          if (status === "refunded" && refundAmount !== undefined) body.refundAmount = refundAmount;
          await request(`/admin/payments/${id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          });
          const msg = form.querySelector("[data-api='admin-payment-form-msg']");
          showMessage(msg, "결제 상태가 반영되었습니다.", "success");
          const p = await fetchAndRender(form);
          if (form.refund_amount) form.refund_amount.value = "";
        } catch (error) {
          const msg = form.querySelector("[data-api='admin-payment-form-msg']");
          showMessage(msg, error.message, "error");
        }
      });

      const refundFullBtn = form.querySelector("[data-api='admin-payment-refund-full']");
      if (refundFullBtn) {
        refundFullBtn.addEventListener("click", async () => {
          const ok = window.confirm("현재 신청 건의 환불 가능 금액 전체를 환불 처리할까요?");
          if (!ok) return;
          const reviewNoteRaw =
            form.review_note && typeof form.review_note.value === "string" ? form.review_note.value.trim() : "";
          const reviewNote = reviewNoteRaw || "관리자 전액환불 처리";
          try {
            refundFullBtn.disabled = true;
            await request(`/admin/payments/${id}`, {
              method: "PATCH",
              body: JSON.stringify({ status: "refunded", reviewNote }),
            });
            const msg = form.querySelector("[data-api='admin-payment-form-msg']");
            showMessage(msg, "전액환불이 반영되었습니다.", "success");
            await fetchAndRender(form);
            if (form.status) form.status.value = "refunded";
            if (form.review_note) form.review_note.value = reviewNote;
            if (form.refund_amount) form.refund_amount.value = "";
          } catch (error) {
            const msg = form.querySelector("[data-api='admin-payment-form-msg']");
            showMessage(msg, error.message, "error");
          } finally {
            refundFullBtn.disabled = false;
          }
        });
      }
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
          <td>${toPaymentStatusLabel(p.status)}</td>
          <td>${p.created_at ? formatDateTime(String(p.created_at)) : "-"}</td>
        `;
        tbody.appendChild(tr);
      });
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan='5'>${error.message}</td></tr>`;
    }
  }

  function escapeHtmlLite(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function mountAdminCoursesList() {
    const tbody = document.querySelector("[data-api='admin-courses-body']");
    if (!tbody) return;
    try {
      const rows = await request("/courses");
      if (!Array.isArray(rows) || !rows.length) {
        tbody.innerHTML = "<tr><td colspan='6'>등록된 과정이 없습니다.</td></tr>";
        return;
      }
      tbody.innerHTML = rows
        .map(
          (c) => `
        <tr>
          <td>${c.id}</td>
          <td>${escapeHtmlLite(c.code)}</td>
          <td>${escapeHtmlLite(c.title)}</td>
          <td>${escapeHtmlLite(c.category || "-")}</td>
          <td>${escapeHtmlLite(c.status || "-")}</td>
          <td style="white-space:nowrap">
            <a class="pm-btn pm-btn-ghost" style="display:inline-flex;padding:6px 10px;font-size:13px;margin-right:4px" href="./detail-001.html?id=${encodeURIComponent(String(c.id))}">상세</a>
            <a class="pm-btn pm-btn-primary" style="display:inline-flex;padding:6px 10px;font-size:13px" href="./questions-upload/index.html?courseId=${encodeURIComponent(String(c.id))}">문제은행 업로드</a>
          </td>
        </tr>
      `
        )
        .join("");
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan='6'>${escapeHtmlLite(error.message)}</td></tr>`;
    }
  }

  async function mountAdminQuestionImportPage() {
    const root = document.querySelector("[data-api='admin-questions-upload-root']");
    if (!root) return;
    const msg = root.querySelector("[data-api='admin-q-upload-msg']");
    const summaryEl = root.querySelector("[data-api='admin-q-summary']");
    const previewEl = root.querySelector("[data-api='admin-q-preview']");
    const fileInput = root.querySelector("[data-api='admin-q-file']");
    const btnPreview = root.querySelector("[data-api='admin-q-btn-preview']");
    const btnCommit = root.querySelector("[data-api='admin-q-btn-commit']");

    const params = new URLSearchParams(window.location.search);
    const courseId = Number(params.get("courseId") || params.get("id") || "0");

    let pendingPayload = null;
    let sourceFilename = null;

    const setMsg = (text, variant) => {
      if (!msg) return;
      msg.textContent = text || "";
      msg.classList.remove("success", "error", "info");
      msg.classList.add(variant === "error" ? "error" : variant === "success" ? "success" : "info");
    };

    if (!Number.isInteger(courseId) || courseId <= 0) {
      setMsg("URL에 유효한 courseId 파라미터가 필요합니다. 예: questions-upload/index.html?courseId=1", "error");
      if (btnPreview) btnPreview.disabled = true;
      if (btnCommit) btnCommit.disabled = true;
      return;
    }

    async function loadSummary() {
      if (!summaryEl) return;
      try {
        const data = await request(`/admin/courses/${courseId}/questions/summary`);
        const c = data.course || {};
        const s = data.activeSet;
        summaryEl.innerHTML = `
          <li><strong>과정:</strong> ${escapeHtmlLite(c.title)} (${escapeHtmlLite(c.code)}) — ID ${escapeHtmlLite(String(c.id))}</li>
          <li><strong>활성 문제은행 세트:</strong> ${
            s
              ? `ID ${escapeHtmlLite(String(s.id))}, 문항 ${escapeHtmlLite(String(s.questionCount))}개, ${escapeHtmlLite(s.createdAt || "-")}`
              : "아직 업로드된 세트 없음"
          }</li>
        `;
      } catch (e) {
        summaryEl.innerHTML = `<li>${escapeHtmlLite(e.message)}</li>`;
      }
    }

    btnPreview?.addEventListener("click", async () => {
      if (!pendingPayload) {
        setMsg("JSON 파일을 먼저 선택해 주세요.", "error");
        return;
      }
      try {
        setMsg("검증 중…", "info");
        const result = await request(`/admin/courses/${courseId}/questions/import`, {
          method: "POST",
          body: JSON.stringify({ payload: pendingPayload, dryRun: true }),
        });
        if (previewEl) previewEl.textContent = JSON.stringify(result, null, 2);
        setMsg(`${result.total}건 형식 검증 완료(미저장). 내용 확인 후 업로드를 눌러 저장합니다.`, "success");
      } catch (error) {
        setMsg(error.message, "error");
      }
    });

    btnCommit?.addEventListener("click", async () => {
      if (!pendingPayload) {
        setMsg("파일 선택 후 미리 검증 또는 바로 업로드할 JSON을 준비해 주세요.", "error");
        return;
      }
      const ok =
        typeof window.confirm !== "function" ||
        window.confirm(
          `과정(ID ${courseId})의 활성 문제은행을 이 파일로 교체합니다. 이전 활성 세트는 비활성 처리됩니다. 진행할까요?`
        );
      if (!ok) return;
      try {
        setMsg("업로드 및 저장 중…", "info");
        if (btnCommit) btnCommit.disabled = true;
        const result = await request(`/admin/courses/${courseId}/questions/import`, {
          method: "POST",
          body: JSON.stringify({
            payload: pendingPayload,
            sourceFilename,
            dryRun: false,
          }),
        });
        setMsg(result.message || "저장했습니다.", "success");
        await loadSummary();
      } catch (error) {
        setMsg(error.message, "error");
      } finally {
        if (btnCommit) btnCommit.disabled = false;
      }
    });

    fileInput?.addEventListener("change", async (event) => {
      const input = event.currentTarget;
      const file = input.files && input.files[0];
      pendingPayload = null;
      sourceFilename = null;
      if (previewEl) previewEl.textContent = "";
      if (!file) {
        setMsg("파일을 선택해 주세요.", "info");
        return;
      }
      if (file.size > 11 * 1024 * 1024) {
        setMsg("파일 크기 상한은 약 10MB입니다. 파일을 줄이거나 분할해 주세요.", "error");
        input.value = "";
        return;
      }
      sourceFilename = file.name;
      try {
        const text = await file.text();
        pendingPayload = JSON.parse(text);
        setMsg(`파일 로드 완료: ${file.name}. [미리 검증] 또는 [저장 업로드]를 진행할 수 있습니다.`, "success");
      } catch (_e) {
        setMsg("JSON 파싱 실패입니다. 형식 및 UTF-8 인코딩을 확인해 주세요.", "error");
        pendingPayload = null;
        sourceFilename = null;
        input.value = "";
      }
    });

    await loadSummary();
  }

  const ADMIN_DASH_LS = "passmaster.admin.dashboard.quick";
  const ADMIN_QUICK_ITEMS = [
    { key: "courses", label: "과정 · 문제", href: "./courses/index.html" },
    { key: "enrollments", label: "수강신청", href: "./enrollments/index.html" },
    { key: "payments", label: "결제", href: "./payments/index.html" },
    { key: "users", label: "회원", href: "./users/index.html" },
    { key: "inquiries", label: "문의", href: "./inquiries/index.html" },
    { key: "faqs", label: "FAQ 관리", href: "./faqs/index.html" },
    { key: "reviews", label: "후기", href: "./reviews/index.html" },
    { key: "learning", label: "학습 이력", href: "./learning/index.html" },
  ];

  function readAdminDashboardPrefs() {
    try {
      const raw = localStorage.getItem(ADMIN_DASH_LS);
      const parsed = raw ? JSON.parse(raw) : {};
      const links =
        parsed && typeof parsed.links === "object" && parsed.links !== null ? parsed.links : {};
      const next = {
        showQuick: parsed.showQuick !== false,
        links: {},
      };
      ADMIN_QUICK_ITEMS.forEach((item) => {
        next.links[item.key] = links[item.key] !== false;
      });
      return next;
    } catch (_e) {
      return { showQuick: true, links: Object.fromEntries(ADMIN_QUICK_ITEMS.map((i) => [i.key, true])) };
    }
  }

  function writeAdminDashboardPrefs(prefs) {
    try {
      localStorage.setItem(ADMIN_DASH_LS, JSON.stringify(prefs));
    } catch (_e) {
      /* ignore */
    }
  }

  function runCountUp(el, nextValue, opts) {
    if (!el) return;
    const duration = (opts && opts.duration) || 550;
    const raw = String(el.textContent).replace(/[^\d.-]/g, "");
    const start = Number.isFinite(Number(raw)) ? Number(raw) : 0;
    const end = Math.max(0, Math.floor(Number(nextValue) || 0));
    if (start === end) {
      el.textContent = String(end);
      return;
    }
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - (1 - p) * (1 - p);
      const cur = Math.round(start + (end - start) * eased);
      el.textContent = String(cur);
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function mountAdminQuicklinksUI(prefs, onChange) {
    const wrap = document.querySelector("[data-admin-quick-wrap]");
    const host = document.querySelector("[data-admin-quick-toggles]");
    const bar = document.querySelector("[data-admin-quick-bar]");
    const master = document.getElementById("admin-dash-show-quick");
    if (!wrap || !host || !bar) return;

    const applyVisibility = () => {
      wrap.hidden = !prefs.showQuick;
      if (master) master.checked = prefs.showQuick;
    };

    const renderBar = () => {
      bar.innerHTML = ADMIN_QUICK_ITEMS.filter((item) => prefs.links[item.key]).map(
        (item) => `<a href="${item.href}">${item.label}</a>`
      ).join("");
    };

    if (!host.dataset.passmasterQuickInit) {
      host.dataset.passmasterQuickInit = "1";
      host.innerHTML = ADMIN_QUICK_ITEMS.map(
        (item) => `
          <label>
            <input type="checkbox" data-admin-quick-key="${item.key}" />
            ${item.label}
          </label>
        `
      ).join("");

      host.querySelectorAll("input[data-admin-quick-key]").forEach((input) => {
        input.addEventListener("change", () => {
          const key = input.getAttribute("data-admin-quick-key");
          if (!key) return;
          prefs.links[key] = Boolean(input.checked);
          writeAdminDashboardPrefs(prefs);
          renderBar();
          onChange();
        });
      });

      if (master) {
        master.addEventListener("change", () => {
          prefs.showQuick = Boolean(master.checked);
          writeAdminDashboardPrefs(prefs);
          applyVisibility();
          onChange();
        });
      }
    }

    host.querySelectorAll("input[data-admin-quick-key]").forEach((input) => {
      const key = input.getAttribute("data-admin-quick-key");
      if (key) input.checked = Boolean(prefs.links[key]);
    });
    applyVisibility();
    renderBar();
  }

  async function mountAdminDashboard() {
    const tbody = document.querySelector("[data-api='admin-dashboard-body']");
    const hasStatCards = Boolean(document.querySelector("[data-dash-stats]"));
    if (!tbody && !hasStatCards) return;
    const msg = document.querySelector("[data-api='admin-dashboard-msg']");
    const refreshBtn = document.getElementById("admin-dash-refresh");
    const dashPrefs = readAdminDashboardPrefs();
    mountAdminQuicklinksUI(dashPrefs, () => {});

    let loadSeq = 0;
    let lastSnapshot = null;

    const setMessage = (text, isError) => {
      if (!msg) return;
      msg.textContent = text || "";
      msg.classList.toggle("error", Boolean(isError));
    };

    const applyPulse = () => {
      const n = lastSnapshot ? lastSnapshot.inquiries : 0;
      document.querySelectorAll("[data-dash-stat-card]").forEach((card) => {
        card.classList.remove("pm-dash-pulse");
      });
      const inqCard = document.querySelector('[data-dash-stat-card="inquiries"]');
      if (inqCard && n > 0) inqCard.classList.add("pm-dash-pulse");
    };

    const fillTableAndCards = () => {
      if (!lastSnapshot) return;
      const { users, courses, enrollments, inquiries } = lastSnapshot;
      const rows = [
        ["회원 수", `${users}명`],
        ["개설 과정 수", `${courses}건`],
        ["수강신청 수", `${enrollments}건`],
        ["미처리 문의", `${inquiries}건`],
      ];
      if (tbody) {
        tbody.innerHTML = rows
          .map(
            ([label, value]) => `
          <tr>
            <th scope="row">${label}</th>
            <td>${value}</td>
          </tr>
        `
          )
          .join("");
      }
      runCountUp(document.querySelector("[data-dash-value='users']"), users);
      runCountUp(document.querySelector("[data-dash-value='courses']"), courses);
      runCountUp(document.querySelector("[data-dash-value='enrollments']"), enrollments);
      runCountUp(document.querySelector("[data-dash-value='inquiries']"), inquiries);
      applyPulse();
    };

    const load = async () => {
      const mySeq = ++loadSeq;
      if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.classList.add("pm-dash-refresh-spin");
        window.setTimeout(() => refreshBtn.classList.remove("pm-dash-refresh-spin"), 700);
      }
      try {
        const dashboard = await request("/admin/dashboard");
        if (mySeq !== loadSeq) return;
        const users = Number(dashboard && dashboard.users) || 0;
        const courses = Number(dashboard && dashboard.courses) || 0;
        const enrollments = Number(dashboard && dashboard.enrollments) || 0;
        const inquiries = Number(dashboard && dashboard.openInquiries) || 0;
        lastSnapshot = { users, courses, enrollments, inquiries };
        setMessage("실시간 API 기준 운영 현황입니다.", false);
        fillTableAndCards();
      } catch (error) {
        if (mySeq !== loadSeq) return;
        lastSnapshot = { users: 0, courses: 0, enrollments: 0, inquiries: 0 };
        if (tbody) {
          tbody.innerHTML = [
            ["회원 수", "-"],
            ["개설 과정 수", "-"],
            ["수강신청 수", "-"],
            ["미처리 문의", "-"],
          ]
            .map(
              ([label, value]) =>
                `<tr><th scope="row">${label}</th><td>${value}</td></tr>`
            )
            .join("");
        }
        runCountUp(document.querySelector("[data-dash-value='users']"), 0);
        runCountUp(document.querySelector("[data-dash-value='courses']"), 0);
        runCountUp(document.querySelector("[data-dash-value='enrollments']"), 0);
        runCountUp(document.querySelector("[data-dash-value='inquiries']"), 0);
        applyPulse();
        setMessage(`대시보드 데이터를 불러오지 못했습니다: ${error.message}`, true);
      } finally {
        if (refreshBtn) refreshBtn.disabled = false;
      }
    };

    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        load();
      });
    }

    const OPS_RESET_CONFIRM_PHRASE = "RESET_PASSMASTER_OPERATIONS";
    const opsResetBtn = document.getElementById("admin-ops-reset");
    if (opsResetBtn && !opsResetBtn.dataset.bound) {
      opsResetBtn.dataset.bound = "1";
      opsResetBtn.addEventListener("click", async () => {
        const ok = window.confirm(
          "일반 회원, 개설 과정, 수강신청·결제, 문의, 후기, 학습 메모 등이 서버 DB에서 삭제됩니다.\n관리자 계정과 FAQ는 유지됩니다.\n\n진행할까요?"
        );
        if (!ok) return;
        const typed = window.prompt(`계속하려면 다음 문구를 그대로 입력하세요:\n${OPS_RESET_CONFIRM_PHRASE}`);
        if (typed !== OPS_RESET_CONFIRM_PHRASE) {
          setMessage("확인 문구가 일치하지 않아 초기화를 취소했습니다.", true);
          return;
        }
        opsResetBtn.disabled = true;
        try {
          const result = await request("/admin/operations-reset", {
            method: "POST",
            body: JSON.stringify({ confirm: OPS_RESET_CONFIRM_PHRASE }),
          });
          try {
            localStorage.removeItem(ADMIN_DASH_LS);
          } catch (_removeErr) {
            /* ignore */
          }
          mountAdminQuicklinksUI(readAdminDashboardPrefs(), () => {});
          const d = result && result.dashboard ? result.dashboard : {};
          lastSnapshot = {
            users: Number(d.users) || 0,
            courses: Number(d.courses) || 0,
            enrollments: Number(d.enrollments) || 0,
            inquiries: Number(d.openInquiries) || 0,
          };
          fillTableAndCards();
          setMessage((result && result.message) || "운영 데이터가 초기화되었습니다.", false);
        } catch (error) {
          setMessage(error.message, true);
        } finally {
          opsResetBtn.disabled = false;
        }
      });
    }

    await load();
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

  function refreshPassmasterSiteNavigation() {
    try {
      if (typeof window.__PASSMASTER_REFRESH_NAV__ === "function") {
        window.__PASSMASTER_REFRESH_NAV__();
      }
    } catch (_e) {
      /* ignore */
    }
  }

  function bindPasswordRevealToggles() {
    document.querySelectorAll("[data-password-toggle]").forEach((btn) => {
      const row = btn.closest(".pm-password-row");
      const input = row && row.querySelector("[data-password-field]");
      if (!input || btn.dataset.pwToggleBound === "1") return;
      btn.dataset.pwToggleBound = "1";
      btn.addEventListener("click", () => {
        const showing = input.type === "text";
        input.type = showing ? "password" : "text";
        btn.textContent = showing ? "표시" : "숨김";
        btn.setAttribute("aria-pressed", showing ? "false" : "true");
      });
    });
  }

  async function mountProfileSummary() {
    const root = document.querySelector("[data-api='profile-summary-root']");
    if (!root) return;
    const msg = root.querySelector("[data-api='profile-summary-message']");
    try {
      const me = await request("/auth/me");
      const nameEl = root.querySelector("[data-field='name']");
      const emailEl = root.querySelector("[data-field='email']");
      const phoneEl = root.querySelector("[data-field='phone']");
      const joinedEl = root.querySelector("[data-field='joined']");
      if (nameEl) nameEl.textContent = me.name || "-";
      if (emailEl) emailEl.textContent = me.email || "-";
      if (phoneEl) phoneEl.textContent = me.phone || "-";
      if (joinedEl)
        joinedEl.textContent = me.created_at ? formatDateTime(me.created_at) : "-";
      if (msg) showMessage(msg, "프로필 정보를 불러왔습니다.", "success");
    } catch (error) {
      if (msg) showMessage(msg, error.message, "error");
    }
  }

  async function mountLearningDashboard() {
    const root = document.querySelector("[data-api='learning-dashboard-root']");
    if (!root) return;
    const bars = root.querySelector("[data-api='learning-bars']");
    const msg = root.querySelector("[data-api='learning-dashboard-message']");
    try {
      const rows = await request("/me/enrollments");
      const list = Array.isArray(rows) ? rows : [];
      const appliedOnly = list.filter((e) => {
        const oid = e.opening_id;
        return oid != null && Number(oid) > 0;
      });
      if (!bars) return;
      bars.innerHTML = "";
      if (!appliedOnly.length) {
        bars.innerHTML =
          '<p class="pm-detail">수강 중인 과정이 없습니다. <a href="../../enroll/index.html">수강 신청</a>에서 과정을 신청하면 여기에 진도 그래프가 표시됩니다.</p>';
        if (msg) showMessage(msg, "신청한 수강 정보가 없어 표시할 학습 데이터가 없습니다.", "info");
        return;
      }
      appliedOnly.forEach((e) => {
        const pct = Math.min(100, Math.max(0, Number(e.progress_percent ?? 0)));
        const rowEl = document.createElement("div");
        rowEl.className = "pm-learning-course-row";
        rowEl.innerHTML = `
          <div class="pm-learning-course-head">
            <strong>${e.course_title || "과정"}</strong>
            <span>${toLearningStatusLabel(e.learning_status)} · ${pct}%</span>
          </div>
          <div class="pm-learning-bar-track"><div class="pm-learning-bar-fill" style="width:${pct}%"></div></div>
          <div class="pm-learning-meta">결제 ${toPaymentStatusLabel(e.payment_status)} · 승인 ${toApprovalStatusLabel(
          e.approval_status
        )}</div>`;
        bars.appendChild(rowEl);
      });
      if (msg) showMessage(msg, `신청 과정 학습 현황 ${appliedOnly.length}건을 불러왔습니다.`, "success");
    } catch (error) {
      if (bars) bars.innerHTML = "";
      if (msg) showMessage(msg, error.message, "error");
    }
  }

  async function mountMypageInquiriesSection() {
    const tbody = document.querySelector("[data-api='mypage-inquiries-body']");
    const msg = document.querySelector("[data-api='mypage-inquiries-message']");
    if (!tbody) return;
    try {
      const rows = await request("/me/inquiries");
      const list = Array.isArray(rows) ? rows : [];
      tbody.innerHTML = "";
      if (!list.length) {
        tbody.innerHTML =
          "<tr><td colspan='5'>등록한 문의가 없습니다. 아래 버튼으로 새 문의를 작성할 수 있습니다.</td></tr>";
        if (msg) showMessage(msg, "문의 내역이 없습니다.", "info");
        return;
      }
      list.slice(0, 20).forEach((item) => {
        const tr = document.createElement("tr");
        const detailHref = `../../support/inquiry/detail-001.html?id=${encodeURIComponent(String(item.id))}`;
        tr.innerHTML = `
          <td>INQ-${item.id}</td>
          <td>${item.type || "-"}</td>
          <td><a href="${detailHref}">${item.title || "-"}</a></td>
          <td>${normalizeStatus(item.status)}</td>
          <td>${formatDateTime(item.created_at)}</td>`;
        tbody.appendChild(tr);
      });
      if (msg) showMessage(msg, `최근 문의 ${Math.min(list.length, 20)}건을 표시합니다.`, "success");
    } catch (error) {
      tbody.innerHTML = `<tr><td colspan='5'>${error.message}</td></tr>`;
      if (msg) showMessage(msg, error.message, "error");
    }
  }

  function mountPasswordWizardMeta() {
    document.querySelectorAll("[data-pw-flow-email]").forEach((el) => {
      const session = getStoredSession();
      const email = session && session.user && session.user.email ? String(session.user.email).trim() : "";
      el.textContent = email || "—";
    });
  }

  async function mountAuthForms() {
    warmupApi().catch(() => null);
    await mountOAuthButtons();
    if (consumeOAuthHashReturn() === true) {
      refreshPassmasterSiteNavigation();
      syncSupportGuestMemberSections();
      return;
    }

    refreshPassmasterSiteNavigation();
    syncSupportGuestMemberSections();
    bindPasswordRevealToggles();
    mountPasswordWizardMeta();

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
    mountAdminCoursesList();
    mountAdminQuestionImportPage();
    mountAdminDashboard();

    mountCourseOpeningsList();
    mountEnrollMyOnlyTable();
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

    mountProfileSummary();
    mountLearningDashboard();
    mountMypageInquiriesSection();
  }

  window.addEventListener("DOMContentLoaded", mountAuthForms);
})();
