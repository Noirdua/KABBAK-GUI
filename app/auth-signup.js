/* auth-signup.js — username/password sign-in, trial signup, and email
 * verification in the connection gate. On success it seeds the gate's API key
 * (hidden behind the "advanced" option) and triggers the normal connect flow. */
(function () {
  "use strict";

  const USERNAME_STORAGE_KEY = "tarot-time-account-username";

  function whenReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
    } else {
      callback();
    }
  }

  whenReady(function () {
    const panelEl = document.getElementById("connection-gate-account");
    const panelStatusEl = document.getElementById("connection-gate-account-status");
    const baseUrlEl = document.getElementById("connection-gate-base-url");
    const keyEl = document.getElementById("connection-gate-api-key");
    const statusEl = document.getElementById("connection-gate-status");
    const connectEl = document.getElementById("connection-gate-connect");
    const advancedToggleEl = document.getElementById("connection-gate-advanced-toggle");
    const advancedEl = document.getElementById("connection-gate-advanced");
    const serverToggleEl = document.getElementById("connection-gate-server-toggle");
    const serverEditorEl = document.getElementById("connection-gate-server-editor");
    const serverHostEl = document.getElementById("connection-gate-server-host");
    const serverPortEl = document.getElementById("connection-gate-server-port");
    const serverApplyEl = document.getElementById("connection-gate-server-apply");
    const serverLabelEl = document.getElementById("connection-gate-server-label");

    const signupUsernameEl = document.getElementById("connection-gate-signup-username");
    const signupEmailEl = document.getElementById("connection-gate-signup-email");
    const signupPasswordEl = document.getElementById("connection-gate-signup-password");
    const signupEl = document.getElementById("connection-gate-signup");
    const signinSwitchEl = document.getElementById("connection-gate-signin-switch");
    const captchaPromptEl = document.getElementById("connection-gate-captcha-prompt");
    const captchaChoicesEl = document.getElementById("connection-gate-captcha-choices");
    const captchaAnswerEl = document.getElementById("connection-gate-captcha-answer");
    const captchaRefreshEl = document.getElementById("connection-gate-captcha-refresh");

    const loginUsernameEl = document.getElementById("connection-gate-login-username");
    const loginPasswordEl = document.getElementById("connection-gate-login-password");
    const signinEl = document.getElementById("connection-gate-signin");
    const signupSwitchEl = document.getElementById("connection-gate-signup-switch");

    const verifyEmailEl = document.getElementById("connection-gate-verify-email");
    const verifyCodeEl = document.getElementById("connection-gate-verify-code");
    const verifyEl = document.getElementById("connection-gate-verify");
    const resendEl = document.getElementById("connection-gate-resend");

    const forgotSwitchEl = document.getElementById("connection-gate-forgot-switch");
    const forgotIdentifierEl = document.getElementById("connection-gate-forgot-identifier");
    const forgotSubmitEl = document.getElementById("connection-gate-forgot-submit");
    const forgotCancelEl = document.getElementById("connection-gate-forgot-cancel");
    const resetCodeEl = document.getElementById("connection-gate-reset-code");
    const resetPasswordEl = document.getElementById("connection-gate-reset-password");
    const resetSubmitEl = document.getElementById("connection-gate-reset-submit");
    const resetCancelEl = document.getElementById("connection-gate-reset-cancel");

    if (!panelEl || !signupEl || !signinEl) {
      return;
    }

    const state = {
      step: "login",
      username: "",
      email: "",
      captchaToken: "",
      challengeReady: false,
      devFallback: false
    };
    let probeTimer = 0;

    function readRememberedUsername() {
      try {
        return String(window.localStorage.getItem(USERNAME_STORAGE_KEY) || "").trim();
      } catch (_error) {
        return "";
      }
    }

    function rememberUsername(username) {
      const value = String(username || "").trim();
      if (!value) return;
      try {
        window.localStorage.setItem(USERNAME_STORAGE_KEY, value);
      } catch (_error) {}
    }

    function setStatus(text, tone) {
      const message = String(text || "");
      if (statusEl) {
        statusEl.textContent = message;
        if (tone) statusEl.dataset.tone = tone;
        else delete statusEl.dataset.tone;
      }
      if (panelStatusEl) {
        panelStatusEl.textContent = message;
        if (tone) panelStatusEl.dataset.tone = tone;
        else delete panelStatusEl.dataset.tone;
      }
      if (message) {
        console.debug(`[auth-signup] ${tone || "info"}: ${message}`);
      }
    }

    function setBusy(busy) {
      [signupEl, signinEl, verifyEl, resendEl, captchaRefreshEl, forgotSubmitEl].forEach((button) => {
        if (button) button.disabled = busy;
      });
      panelEl.classList.toggle("is-busy", busy);
    }

    function baseUrl() {
      return String(baseUrlEl?.value || "").trim().replace(/\/+$/, "");
    }

    function parseServerUrl(raw) {
      const value = String(raw || "").trim();
      if (!value) {
        return { protocol: "http:", host: "", port: "" };
      }
      try {
        const url = new URL(/^[a-z]+:\/\//i.test(value) ? value : `http://${value}`);
        return {
          protocol: url.protocol || "http:",
          host: url.hostname || "",
          port: url.port || ""
        };
      } catch (_error) {
        return { protocol: "http:", host: value, port: "" };
      }
    }

    function composeServerUrl() {
      const parsed = parseServerUrl(baseUrl());
      const host = String(serverHostEl?.value || parsed.host || "").trim()
        .replace(/^[a-z]+:\/\//i, "")
        .split("/")[0]
        .split(":")[0];
      const port = String(serverPortEl?.value || "").trim() || "3100";
      if (!host) {
        return "";
      }
      const protocol = parsed.protocol || "http:";
      return `${protocol}//${host}:${port}`;
    }

    function syncServerFields() {
      const parsed = parseServerUrl(baseUrl());
      if (serverHostEl && document.activeElement !== serverHostEl) {
        serverHostEl.value = parsed.host;
      }
      if (serverPortEl && document.activeElement !== serverPortEl) {
        serverPortEl.value = parsed.port || (parsed.host ? "3100" : "");
      }
      if (serverLabelEl) {
        const host = parsed.host;
        const port = parsed.port || (host ? "3100" : "");
        serverLabelEl.textContent = host ? `${host}:${port}` : "Server";
      }
    }

    function setServerHealth(tone) {
      if (serverToggleEl) {
        serverToggleEl.dataset.health = tone;
      }
    }

    async function probeServerHealth() {
      const base = baseUrl();
      if (!base) {
        setServerHealth("unknown");
        return;
      }
      setServerHealth("pending");
      try {
        const response = await fetch(`${base}/api/v1/health`, { cache: "no-store" });
        setServerHealth(response.ok ? "ok" : "bad");
      } catch (_error) {
        setServerHealth("bad");
      }
    }

    function applyServerEditor() {
      const next = composeServerUrl();
      if (!next) {
        setStatus("Enter a host (and port) for the API server.", "error");
        serverHostEl?.focus();
        return;
      }
      if (baseUrlEl) {
        baseUrlEl.value = next;
      }
      const current = window.TarotAppConfig?.getConnectionSettings?.() || {};
      window.TarotAppConfig?.updateConnectionSettings?.({
        apiBaseUrl: next,
        apiKey: current.apiKey || ""
      });
      syncServerFields();
      if (serverEditorEl) {
        serverEditorEl.hidden = true;
      }
      serverToggleEl?.setAttribute("aria-expanded", "false");
      void probeServerHealth();
      void refreshProviders();
    }

    async function apiPost(path, body) {
      const base = baseUrl();
      if (!base) {
        setStatus("Enter the API Base URL first.", "error");
        baseUrlEl?.focus();
        return { ok: false, offline: true };
      }

      let response;
      try {
        response = await fetch(`${base}/api/v1${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body)
        });
      } catch (_error) {
        setStatus(`Could not reach the API at ${base}. Check the URL, Tailscale, and CORS.`, "error");
        return { ok: false, offline: true };
      }

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        const message = payload?.message || payload?.error || `Request to ${path} failed (HTTP ${response.status}).`;
        return {
          ok: false,
          status: response.status,
          error: payload?.error || "request_failed",
          message: response.status === 404
            ? "This API server is out of date and has no signup routes. Restart or update the API."
            : message
        };
      }
      return { ok: true, data: payload?.data || payload };
    }

    function showStep(name) {
      state.step = name;
      panelEl.querySelectorAll("[data-account-step]").forEach((stepEl) => {
        stepEl.hidden = stepEl.dataset.accountStep !== name;
      });
      const captchaEl = document.getElementById("connection-gate-captcha");
      const needsCaptcha = name === "signup" || name === "forgot";
      if (captchaEl) captchaEl.hidden = !needsCaptcha;
      if (needsCaptcha && baseUrl() && (name === "forgot" || !state.challengeReady)) {
        void refreshChallenge();
      }
    }

    function renderCaptchaChoices(choices) {
      if (!captchaChoicesEl) return;
      captchaChoicesEl.innerHTML = "";
      (Array.isArray(choices) ? choices : []).forEach((choice) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "connection-gate-captcha-choice";
        button.textContent = String(choice);
        button.addEventListener("click", () => {
          if (captchaAnswerEl) {
            captchaAnswerEl.value = String(choice);
            captchaAnswerEl.focus();
          }
        });
        captchaChoicesEl.appendChild(button);
      });
    }

    async function refreshChallenge() {
      state.challengeReady = false;
      state.captchaToken = "";
      if (captchaPromptEl) captchaPromptEl.textContent = "Loading challenge…";
      if (captchaChoicesEl) captchaChoicesEl.innerHTML = "";
      if (captchaAnswerEl) captchaAnswerEl.value = "";

      const result = await apiPost("/auth/challenge");
      if (!result.ok) {
        if (captchaPromptEl) captchaPromptEl.textContent = "Challenge unavailable";
        return false;
      }
      state.captchaToken = result.data?.token || "";
      state.challengeReady = Boolean(state.captchaToken);
      if (captchaPromptEl) captchaPromptEl.textContent = result.data?.prompt || "Answer the question";
      renderCaptchaChoices(result.data?.choices);
      return state.challengeReady;
    }

    function finishConnect(apiKey, expiresAt) {
      if (baseUrlEl) baseUrlEl.value = baseUrl();
      if (keyEl) keyEl.value = apiKey;
      const until = expiresAt ? new Date(expiresAt).toLocaleDateString() : "";
      setStatus(until ? `Trial ready — valid until ${until}. Connecting…` : "Trial ready. Connecting…", "success");
      connectEl?.click();
    }

    async function submitSignup() {
      const username = String(signupUsernameEl?.value || "").trim();
      const email = String(signupEmailEl?.value || "").trim();
      const password = String(signupPasswordEl?.value || "");
      const answer = String(captchaAnswerEl?.value || "").trim();

      if (!username) { setStatus("Choose a username.", "error"); signupUsernameEl?.focus(); return; }
      if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) { setStatus("Username must be 3-24 letters, numbers, or underscores.", "error"); return; }
      if (!email) { setStatus("Enter your email address (kept private).", "error"); signupEmailEl?.focus(); return; }
      if (password.length < 8) { setStatus("Password must be at least 8 characters.", "error"); signupPasswordEl?.focus(); return; }
      if (!answer) { setStatus("Answer the captcha question.", "error"); captchaAnswerEl?.focus(); return; }

      setBusy(true);
      try {
        if (!state.challengeReady) {
          setStatus("Fetching a fresh captcha…", "pending");
          const ready = await refreshChallenge();
          setStatus(ready
            ? "A new captcha was issued — answer it and press Start trial again."
            : "The captcha could not load from this server. If you just updated the API, restart it and reload this page.",
            ready ? "pending" : "error");
          return;
        }

        setStatus("Creating your account…", "pending");
        const result = await apiPost("/auth/signup", {
          username,
          email,
          password,
          captchaToken: state.captchaToken,
          captchaAnswer: answer
        });

        if (!result.ok) {
          if (result.error === "captcha_failed") {
            await refreshChallenge();
          }
          setStatus(result.message, "error");
          return;
        }

        state.username = username;
        state.email = email;
        rememberUsername(username);
        if (loginUsernameEl) loginUsernameEl.value = username;
        if (verifyEmailEl) verifyEmailEl.textContent = email;
        if (verifyCodeEl) verifyCodeEl.value = "";
        showStep("verify");

        if (result.data?.devCode) {
          if (verifyCodeEl) verifyCodeEl.value = String(result.data.devCode);
          setStatus("Email sending is not configured on this server, so the code is filled in for testing. Press Verify.", "pending");
        } else {
          setStatus("Account created. Check your email for the 6-digit code.", "success");
        }
      } catch (error) {
        setStatus(`Signup failed: ${error?.message || error}`, "error");
      } finally {
        setBusy(false);
      }
    }

    async function submitVerify() {
      const code = String(verifyCodeEl?.value || "").trim();
      if (!code) { setStatus("Enter the 6-digit code from your email.", "error"); verifyCodeEl?.focus(); return; }

      setBusy(true);
      setStatus("Verifying…", "pending");
      try {
        const result = await apiPost("/auth/verify", { username: state.username, code });
        if (!result.ok) {
          setStatus(result.message, "error");
          return;
        }
        finishConnect(result.data?.apiKey, result.data?.expiresAt);
      } catch (error) {
        setStatus(`Verification failed: ${error?.message || error}`, "error");
      } finally {
        setBusy(false);
      }
    }

    async function submitResend() {
      setBusy(true);
      setStatus("Sending a new code…", "pending");
      try {
        const result = await apiPost("/auth/resend", { username: state.username });
        if (!result.ok) {
          setStatus(result.message, "error");
          return;
        }
        if (result.data?.devCode) {
          if (verifyCodeEl) verifyCodeEl.value = String(result.data.devCode);
          setStatus("New code generated (shown here because email is not configured).", "pending");
        } else {
          setStatus("A new code is on its way. Check your email.", "success");
        }
      } catch (error) {
        setStatus(`Resend failed: ${error?.message || error}`, "error");
      } finally {
        setBusy(false);
      }
    }

    async function submitLogin() {
      const username = String(loginUsernameEl?.value || "").trim();
      const password = String(loginPasswordEl?.value || "");
      if (!username) { setStatus("Enter your username.", "error"); loginUsernameEl?.focus(); return; }
      if (!password) { setStatus("Enter your password.", "error"); loginPasswordEl?.focus(); return; }

      setBusy(true);
      setStatus("Signing in…", "pending");
      try {
        const result = await apiPost("/auth/login", { username, password });
        if (!result.ok) {
          if (result.error === "email_not_verified") {
            state.username = username;
            showStep("verify");
          }
          setStatus(result.message, "error");
          return;
        }
        state.username = username;
        rememberUsername(username);
        if (loginPasswordEl) loginPasswordEl.value = "";
        finishConnect(result.data?.apiKey, result.data?.expiresAt);
      } catch (error) {
        setStatus(`Sign-in failed: ${error?.message || error}`, "error");
      } finally {
        setBusy(false);
      }
    }

    async function submitForgot() {
      const identifier = String(forgotIdentifierEl?.value || "").trim();
      const answer = String(captchaAnswerEl?.value || "").trim();
      if (!identifier) { setStatus("Enter your username or email.", "error"); forgotIdentifierEl?.focus(); return; }
      if (!answer) { setStatus("Answer the captcha question.", "error"); captchaAnswerEl?.focus(); return; }

      setBusy(true);
      setStatus("Sending a reset code…", "pending");
      try {
        if (!state.challengeReady) {
          setStatus("Fetching a fresh captcha…", "pending");
          const ready = await refreshChallenge();
          setStatus(ready
            ? "A new captcha was issued — answer it and press Email me a reset code again."
            : "The captcha could not load from this server.",
          ready ? "pending" : "error");
          return;
        }
        const result = await apiPost("/auth/forgot", {
          identifier,
          captchaToken: state.captchaToken,
          captchaAnswer: answer
        });
        if (!result.ok) {
          if (result.error === "captcha_failed") {
            await refreshChallenge();
          }
          setStatus(result.message, "error");
          return;
        }
        state.identifier = identifier;
        if (resetCodeEl) resetCodeEl.value = "";
        if (resetPasswordEl) resetPasswordEl.value = "";
        showStep("reset");
        if (result.data?.devCode) {
          if (resetCodeEl) resetCodeEl.value = String(result.data.devCode);
          setStatus("Email is not configured on this server, so the reset code is filled in for testing.", "pending");
        } else {
          setStatus("If that account exists, a reset code is on its way. Enter it below.", "success");
        }
      } catch (error) {
        setStatus(`Could not request a reset: ${error?.message || error}`, "error");
      } finally {
        setBusy(false);
      }
    }

    async function submitReset() {
      const code = String(resetCodeEl?.value || "").trim();
      const password = String(resetPasswordEl?.value || "");
      if (!code) { setStatus("Enter the reset code from your email.", "error"); resetCodeEl?.focus(); return; }
      if (password.length < 8) { setStatus("New password must be at least 8 characters.", "error"); resetPasswordEl?.focus(); return; }

      setBusy(true);
      setStatus("Updating your password…", "pending");
      try {
        const result = await apiPost("/auth/reset", { identifier: state.identifier, code, password });
        if (!result.ok) {
          setStatus(result.message, "error");
          return;
        }
        const username = result.data?.account?.username;
        if (username) {
          if (loginUsernameEl) loginUsernameEl.value = username;
          rememberUsername(username);
        }
        const apiKey = result.data?.apiKey;
        if (apiKey) {
          finishConnect(apiKey, result.data?.expiresAt);
          return;
        }
        if (resetPasswordEl) resetPasswordEl.value = "";
        showStep("login");
        setStatus("Password updated. Sign in with your new password.", "success");
      } catch (error) {
        setStatus(`Password reset failed: ${error?.message || error}`, "error");
      } finally {
        setBusy(false);
      }
    }

    async function refreshProviders() {
      const base = baseUrl();
      if (!base) return;
      try {
        const response = await fetch(`${base}/api/v1/auth/providers`, { cache: "no-store" });
        if (!response.ok) {
          setStatus(`This server returned HTTP ${response.status} for signup info. Restart or update the API.`, "error");
          return;
        }
        const payload = await response.json().catch(() => null);
        const data = payload?.data || payload;
        if (!data) return;
        const days = Number(data.trialDays) || 30;
        if (signupEl) signupEl.textContent = `Start ${days}-day trial`;
        state.devFallback = data.emailVerification?.devFallback === true;
        if (data.signupEnabled === false) {
          signupSwitchEl && (signupSwitchEl.hidden = true);
          if (state.step === "signup") {
            showStep("login");
          }
        }
      } catch (_error) {}
    }

    function setAdvancedOpen(open) {
      if (advancedEl) advancedEl.hidden = !open;
      if (panelEl) panelEl.hidden = open;
      if (advancedToggleEl) {
        advancedToggleEl.textContent = open ? "Sign in with username" : "Use an API key instead";
        advancedToggleEl.setAttribute("aria-expanded", open ? "true" : "false");
      }
      if (open) {
        keyEl?.focus();
      } else {
        loginUsernameEl?.focus();
      }
    }

    signupEl.addEventListener("click", () => { void submitSignup(); });
    signinEl.addEventListener("click", () => { void submitLogin(); });
    verifyEl.addEventListener("click", () => { void submitVerify(); });
    resendEl.addEventListener("click", () => { void submitResend(); });
    captchaRefreshEl?.addEventListener("click", () => { void refreshChallenge(); });
    advancedToggleEl?.addEventListener("click", () => setAdvancedOpen(advancedEl.hidden));
    signinSwitchEl?.addEventListener("click", () => {
      setStatus("Sign in with your username and password.", "default");
      showStep("login");
      loginUsernameEl?.focus();
    });
    signupSwitchEl?.addEventListener("click", () => {
      showStep("signup");
      signupUsernameEl?.focus();
    });
    forgotSwitchEl?.addEventListener("click", () => {
      const identifier = String(loginUsernameEl?.value || "").trim() || readRememberedUsername();
      if (forgotIdentifierEl && identifier) forgotIdentifierEl.value = identifier;
      showStep("forgot");
      forgotIdentifierEl?.focus();
    });
    forgotSubmitEl?.addEventListener("click", () => { void submitForgot(); });
    forgotCancelEl?.addEventListener("click", () => { showStep("login"); });
    resetSubmitEl?.addEventListener("click", () => { void submitReset(); });
    resetCancelEl?.addEventListener("click", () => { showStep("login"); });
    resetPasswordEl?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); void submitReset(); }
    });

    signupPasswordEl?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); void submitSignup(); }
    });
    loginPasswordEl?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); void submitLogin(); }
    });
    verifyCodeEl?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); void submitVerify(); }
    });

    baseUrlEl?.addEventListener("input", () => {
      window.clearTimeout(probeTimer);
      probeTimer = window.setTimeout(() => {
        void refreshProviders();
        if (state.step === "signup" && !state.challengeReady && baseUrl()) {
          void refreshChallenge();
        }
      }, 450);
    });

    const rememberedUsername = readRememberedUsername();
    if (rememberedUsername && loginUsernameEl) {
      loginUsernameEl.value = rememberedUsername;
    }
    showStep("login");
    setAdvancedOpen(false);
    syncServerFields();
    serverToggleEl?.addEventListener("click", () => {
      const open = Boolean(serverEditorEl?.hidden);
      if (serverEditorEl) serverEditorEl.hidden = !open;
      serverToggleEl.setAttribute("aria-expanded", open ? "true" : "false");
      if (open) {
        syncServerFields();
        serverHostEl?.focus();
      }
    });
    serverApplyEl?.addEventListener("click", () => applyServerEditor());
    serverPortEl?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        applyServerEditor();
      }
    });
    if (rememberedUsername) loginPasswordEl?.focus();
    void probeServerHealth();

    window.TarotAuthSignup = {
      ...(window.TarotAuthSignup || {}),
      syncServerFields,
      probeServerHealth
    };

    console.debug("[auth-signup] ready", {
      captcha: Boolean(captchaRefreshEl),
      rememberedUsername: Boolean(rememberedUsername),
      steps: panelEl.querySelectorAll("[data-account-step]").length
    });
    void refreshProviders();
  });
})();
