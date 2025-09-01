// js/app.js - frontend logic for Smart Crop
const API_BASE = "http://localhost:5000/api";

// ---------- Helpers ----------
function getToken() {
  return localStorage.getItem("token");
}
function setToken(t) {
  if (t) localStorage.setItem("token", t);
}
function clearToken() {
  localStorage.removeItem("token");
}
function authHeaders() {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
function showMsg(elId, text, success = true) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.textContent = text;
  el.style.color = success ? "green" : "crimson";
}

// ---------- AUTH ----------
async function registerUser(e) {
  e.preventDefault();
  const name = document.getElementById("name").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, email, password }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showMsg("registerMsg", "Registered. Please login.", true);
      setTimeout(() => (window.location.href = "login.html"), 900);
    } else {
      showMsg("registerMsg", data.error || "Registration failed", false);
    }
  } catch (err) {
    console.error(err);
    showMsg("registerMsg", "Server error", false);
  }
}

async function loginUser(e) {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      setToken(data.token);
      window.location.href = "dashboard.html";
    } else {
      showMsg("loginMsg", data.error || "Login failed", false);
    }
  } catch (err) {
    console.error(err);
    showMsg("loginMsg", "Server error", false);
  }
}

function logoutUser() {
  clearToken();
  window.location.href = "login.html";
}

// ---------- FIELDS / DASHBOARD ----------
async function createField(e) {
  e.preventDefault();
  const name = document.getElementById("fieldName").value.trim();
  const location = document.getElementById("location").value.trim();
  const soilPh = parseFloat(document.getElementById("soilPh").value);
  const crop = document.getElementById("crop").value.trim();

  try {
    const res = await fetch(`${API_BASE}/fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ name, location, soilPh, crop }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showMsg("fieldMsg", "Field saved.", true);
      setTimeout(() => (window.location.href = "dashboard.html"), 700);
    } else {
      showMsg("fieldMsg", data.error || "Save failed", false);
    }
  } catch (err) {
    console.error(err);
    showMsg("fieldMsg", "Server error", false);
  }
}

async function loadDashboard() {
  const container = document.getElementById("fieldsGrid");
  if (!container) return;
  container.innerHTML = "<p>Loading your fields…</p>";

  try {
    const res = await fetch(`${API_BASE}/fields`, {
      headers: { ...authHeaders() },
    });
    const data = await res.json();
    if (!res.ok) {
      container.innerHTML = `<p style="color:crimson;">${data.error || "Failed to load"}</p>`;
      return;
    }
    const fields = data.fields || [];
    if (fields.length === 0) {
      container.innerHTML = `<p>You have no fields yet. Add one → <a href="field.html">Add Field</a></p>`;
      return;
    }

    container.innerHTML = "";
    fields.forEach((f) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <h3>${escapeHtml(f.name)} <small style="font-weight:400">(${escapeHtml(f.crop || "—")})</small></h3>
        <p>📍 ${escapeHtml(f.location || "—")}</p>
        <p>Soil pH: ${f.soilPh ?? "N/A"}</p>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button class="btn" onclick="requestAdvisory('${f._id}')">Get Advisory</button>
          <button class="btn" onclick="requestRecommendation('${f._id}')">Get Recommendation</button>
          <button class="btn" onclick="sendAdvisorySMS('${f._id}')">Send SMS</button>
        </div>
        <div id="result-${f._id}" style="margin-top:10px;"></div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p style='color:crimson'>Server error</p>";
  }
}

// ---------- ADVISORY / RECOMMENDATION / SMS ----------
async function requestAdvisory(fieldId) {
  try {
    const res = await fetch(`${API_BASE}/advisory/${fieldId}`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
    });
    const data = await res.json();
    const target = document.getElementById(`result-${fieldId}`);
    if (res.ok && data.success) {
      target.innerText = `Advisory: ${data.advice.join(", ")}`;
    } else {
      target.innerText = `Advisory error: ${data.error || "failed"}`;
    }
  } catch (err) {
    console.error(err);
  }
}

async function requestRecommendation(fieldId) {
  try {
    const res = await fetch(`${API_BASE}/recommendation/${fieldId}`, {
      headers: { ...authHeaders() },
    });
    const data = await res.json();
    const target = document.getElementById(`result-${fieldId}`);
    if (res.ok && data.success) {
      target.innerText = `Recommendation: ${data.recommendation}`;
    } else {
      target.innerText = `Recommendation error: ${data.error || "failed"}`;
    }
  } catch (err) {
    console.error(err);
  }
}

async function sendAdvisorySMS(fieldId) {
  try {
    const res = await fetch(`${API_BASE}/advisory/sms/${fieldId}`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
    });
    const data = await res.json();
    const target = document.getElementById(`result-${fieldId}`);
    if (res.ok && data.success) {
      target.innerText = `SMS: ${data.message || "sent (fallback)"} — ${data.advisory?.join(", ") || ""}`;
    } else {
      target.innerText = `SMS error: ${data.error || "failed"}`;
    }
  } catch (err) {
    console.error(err);
  }
}

// ---------- small util ----------
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// ---------- Bind events ----------
document.addEventListener("DOMContentLoaded", () => {
  // register form
  const registerForm = document.getElementById("registerForm");
  if (registerForm) registerForm.addEventListener("submit", registerUser);

  // login form
  const loginForm = document.getElementById("loginForm");
  if (loginForm) loginForm.addEventListener("submit", loginUser);

  // field form
  const fieldForm = document.getElementById("fieldForm");
  if (fieldForm) fieldForm.addEventListener("submit", createField);

  // dashboard load
  if (document.querySelector(".dashboard")) {
    loadDashboard();
  }

  // advisory page: show last advisories (using fields and calling advisory for each)
  if (document.querySelector(".advisory")) {
    (async () => {
      const list = document.getElementById("advisoryList");
      list.innerHTML = "<p>Loading…</p>";
      try {
        const res = await fetch(`${API_BASE}/fields`, { headers: { ...authHeaders() } });
        const data = await res.json();
        if (!res.ok) {
          list.innerHTML = `<p style="color:crimson">${data.error || "Failed"}</p>`;
          return;
        }
        const fields = data.fields || [];
        if (!fields.length) {
          list.innerHTML = "<p>No fields found. Add a field in Dashboard.</p>";
          return;
        }
        list.innerHTML = "";
        for (const f of fields) {
          const card = document.createElement("div");
          card.className = "card";
          card.innerHTML = `<h3>${escapeHtml(f.name)}</h3><p>Crop: ${escapeHtml(f.crop||"—")}</p><p>Soil pH: ${f.soilPh ?? "N/A"}</p><div id="adv-${f._id}">Loading advice…</div>`;
          list.appendChild(card);
          // fetch advisory for each field (best-effort)
          try {
            const r = await fetch(`${API_BASE}/advisory/${f._id}`, { method: "POST", headers:{...authHeaders(), "Content-Type":"application/json"} });
            const advData = await r.json();
            const container = document.getElementById(`adv-${f._id}`);
            if (r.ok && advData.success) container.innerText = advData.advice.join(", ");
            else container.innerText = advData.error || "No advice";
          } catch (e) {
            document.getElementById(`adv-${f._id}`).innerText = "Error fetching advice";
          }
        }
      } catch (err) {
        console.error(err);
        list.innerHTML = "<p>Server error</p>";
      }
    })();
  }
});


// ==================== NAVBAR ====================
function renderNavbar() {
  const navbar = document.getElementById("navbar");
  if (!navbar) return;

  const token = localStorage.getItem("token");

  if (token) {
    navbar.innerHTML = `
      <a href="index.html">Home</a>
      <a href="dashboard.html">Dashboard</a>
      <a href="advisory.html">Advisory</a>
      <a href="#" onclick="logoutUser()">Logout</a>
    `;
  } else {
    navbar.innerHTML = `
      <a href="index.html">Home</a>
      <a href="register.html">Register</a>
      <a href="login.html">Login</a>
    `;
  }
}

function logoutUser() {
  localStorage.removeItem("token");
  alert("👋 Logged out successfully");
  window.location.href = "index.html";
}

// Call when page loads
document.addEventListener("DOMContentLoaded", renderNavbar);
