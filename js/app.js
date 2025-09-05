// js/app.js - Smart Crop Frontend
const API_BASE = "https://smart-crop-backend.onrender.com/api";

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
  window.location.href = "index.html";
}

// ---------- FIELDS / DASHBOARD ----------
async function createField(e) {
  e.preventDefault();

  const name = document.getElementById("fieldName").value.trim();
  const location = document.getElementById("location").value.trim();
  const crop = document.getElementById("crop").value.trim();

  let soilPh = parseFloat(document.getElementById("soilPh").value);
  if (isNaN(soilPh)) soilPh = 7.0;

  let N = parseFloat(document.getElementById("N").value);
  if (isNaN(N)) N = 120;

  try {
    const res = await fetch(`${API_BASE}/fields`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ name, location, crop, soilPh, N }),
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

// ---------- WEATHER ----------
async function loadWeather(fieldId, location) {
  try {
    const res = await fetch(`${API_BASE}/weather?location=${encodeURIComponent(location)}`, {
      headers: { ...authHeaders() },
    });
    const data = await res.json();
    if (res.ok && data.forecast) {
      const tempEl = document.getElementById(`temp-${fieldId}`);
      const humEl = document.getElementById(`humidity-${fieldId}`);
      if (tempEl) tempEl.textContent = data.forecast.temperature.toFixed(1);
      if (humEl) humEl.textContent = data.forecast.humidity.toFixed(0);
    }
  } catch (err) {
    console.error("Weather fetch error:", err);
  }
}
let deleteMode = false;

// ---------- LOAD CARDS (DASHBOARD OR ADVISORY) ----------
async function loadCards(containerId, showButtons = true) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "<p>Loading…</p>";

  try {
    const res = await fetch(`${API_BASE}/fields`, { headers: { ...authHeaders() } });
    const data = await res.json();
    if (!res.ok) {
      container.innerHTML = `<p style="color:crimson;">${data.error || "Failed to load"}</p>`;
      return;
    }

    const fields = data.fields || [];
    if (!fields.length) {
      container.innerHTML = `<p>No fields found. Add one → <a href="field.html">Add Field</a></p>`;
      return;
    }

    container.innerHTML = "";
    fields.forEach(f => {
  const card = document.createElement("div");
  card.className = "card";
  card.style.position = "relative";

  if (deleteMode) {
    // Delete mode: only name + delete button
    card.innerHTML = `
      <h3>${escapeHtml(f.name)}</h3>
      <button class="btnfield" id="deletered"; onclick="deleteField('${f._id}')">🗑 Delete</button>
    `;
  } else {
    // Normal mode (existing code)
    const weatherDiv = document.createElement("div");
    weatherDiv.style.position = "absolute";
    weatherDiv.style.top = "10px";
    weatherDiv.style.right = "10px";
    weatherDiv.style.textAlign = "right";
    weatherDiv.innerHTML = `🌡️ <span id="temp-${f._id}">--</span> °C<br>💧 <span id="humidity-${f._id}">--</span> %`;
    card.appendChild(weatherDiv);

    const contentDiv = document.createElement("div");
    contentDiv.innerHTML = `
      <h3>${escapeHtml(f.name)} <small style="font-weight:400">(${escapeHtml(f.crop || "—")})</small></h3>
      <p>📍 ${escapeHtml(f.location || "—")}</p>
      <p>🌱 Soil pH: ${f.soilPh ?? "N/A"}, 🟦 N: ${f.N ?? 120}</p>
    `;

    if (showButtons) {
      const btnDiv = document.createElement("div");
      btnDiv.innerHTML = `
        <button class="btnfield" onclick="requestAdvisory('${f._id}')">Get Advisory</button>
        <button class="btnfield" onclick="requestRecommendation('${f._id}')">Get Recommendation</button>
        <button class="btnfield" onclick="sendAdvisorySMS('${f._id}')">Send SMS</button>
      `;
      contentDiv.appendChild(btnDiv);
    }

    const resultDiv = document.createElement("div");
    resultDiv.id = `result-${f._id}`;
    resultDiv.style.marginTop = "10px";
    contentDiv.appendChild(resultDiv);

    card.appendChild(contentDiv);
    container.appendChild(card);

    loadWeather(f._id, f.location);
  }

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
    target.innerText = (res.ok && data.success)
      ? `Advisory: ${data.advice.join(", ")}`
      : `Advisory error: ${data.error || "failed"}`;
  } catch (err) { console.error(err); }
}

async function requestRecommendation(fieldId) {
  try {
    const soilPhEl = document.getElementById("soilPh");
    const NEl = document.getElementById("N");
    const soilPh = soilPhEl ? parseFloat(soilPhEl.value) : undefined;
    const N = NEl ? parseFloat(NEl.value) : undefined;

    const params = new URLSearchParams();
    if (soilPh !== undefined) params.append("soilPh", soilPh);
    if (N !== undefined) params.append("N", N);

    const res = await fetch(`${API_BASE}/recommendation/${fieldId}?${params.toString()}`, {
      headers: { ...authHeaders() },
    });
    const data = await res.json();
    const target = document.getElementById(`result-${fieldId}`);
    target.innerText = (res.ok && data.success)
      ? `Recommendation: ${data.recommendation}`
      : `Recommendation error: ${data.error || "failed"}`;
  } catch (err) { console.error(err); }
}

async function sendAdvisorySMS(fieldId) {
  try {
    const res = await fetch(`${API_BASE}/advisory/sms/${fieldId}`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
    });
    const data = await res.json();
    const target = document.getElementById(`result-${fieldId}`);
    target.innerText = (res.ok && data.success)
      ? `SMS: ${data.message || "sent"} — ${data.advisory?.join(", ") || ""}`
      : `SMS error: ${data.error || "failed"}`;
  } catch (err) { console.error(err); }
}


const toggleDeleteBtn = document.getElementById("toggleDeleteBtn");
if (toggleDeleteBtn) {
  toggleDeleteBtn.addEventListener("click", () => {
    deleteMode = !deleteMode;
    toggleDeleteBtn.textContent = deleteMode ? "Exit Delete Mode" : "Delete Mode";
    loadCards("fieldsGrid", true); // reload cards in new mode
  });
}


async function deleteField(fieldId) {
  if (!confirm("Are you sure you want to delete this field?")) return;

  try {
    const res = await fetch(`${API_BASE}/fields/${fieldId}`, {
      method: "DELETE",
      headers: { ...authHeaders() },
    });
    const data = await res.json();
    if (res.ok && data.success) {
      alert("Field deleted.");
      loadCards("fieldsGrid", true); // refresh dashboard
    } else {
      alert(data.error || "Delete failed");
    }
  } catch (err) {
    console.error(err);
    alert("Server error");
  }
}


// ---------- Utilities ----------
function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ---------- Navbar ----------
function renderNavbar() {
  const navbar = document.getElementById("navbar");
  if (!navbar) return;
  const token = getToken();
  navbar.innerHTML = token
    ? `<a href="index.html">Home</a>
       <a href="dashboard.html">Dashboard</a>
       <a href="advisory.html">Advisory</a>
       <a href="#" onclick="logoutUser()">Logout</a>`
    : `<a href="index.html">Home</a>
       <a href="register.html">Register</a>
       <a href="login.html">Login</a>`;
}

// ---------- DOM Ready ----------
document.addEventListener("DOMContentLoaded", () => {
  renderNavbar();

  const registerForm = document.getElementById("registerForm");
  if (registerForm) registerForm.addEventListener("submit", registerUser);

  const loginForm = document.getElementById("loginForm");
  if (loginForm) loginForm.addEventListener("submit", loginUser);

  const fieldForm = document.getElementById("fieldForm");
  if (fieldForm) fieldForm.addEventListener("submit", createField);

  // Dashboard cards with buttons
  if (document.getElementById("fieldsGrid")) loadCards("fieldsGrid", true);

  // Advisory page: cards without buttons
  if (document.getElementById("advisoryList")) loadCards("advisoryList", false);
});



// Advisory page: load only name, crop, and advisory
async function loadAdvisoryCards() {
  const container = document.getElementById("advisoryList");
  if (!container) return;
  container.innerHTML = "<p>Loading advisory…</p>";

  try {
    const res = await fetch(`${API_BASE}/fields`, { headers: { ...authHeaders() } });
    const data = await res.json();
    if (!res.ok) {
      container.innerHTML = `<p style="color:crimson;">${data.error || "Failed to load"}</p>`;
      return;
    }

    const fields = data.fields || [];
    if (!fields.length) {
      container.innerHTML = `<p>No fields found. Add one → <a href="field.html">Add Field</a></p>`;
      return;
    }

    container.innerHTML = "";

    for (const f of fields) {
      const card = document.createElement("div");
      card.className = "card";

      // Field name and crop
      const title = document.createElement("h3");
      title.innerHTML = `${escapeHtml(f.name)} <small style="font-weight:400">(${escapeHtml(f.crop || "—")})</small>`;
      card.appendChild(title);

      // Advisory placeholder
      const advisoryDiv = document.createElement("p");
      advisoryDiv.id = `result-${f._id}`;
      advisoryDiv.textContent = "Loading advisory…";
      card.appendChild(advisoryDiv);

      container.appendChild(card);

      // Fetch advisory for this field
      fetchAdvisoryForCard(f._id);
    }

  } catch (err) {
    console.error(err);
    container.innerHTML = "<p style='color:crimson'>Server error</p>";
  }
}

// Fetch advisory for advisory page only
async function fetchAdvisoryForCard(fieldId) {
  try {
    const res = await fetch(`${API_BASE}/advisory/${fieldId}`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
    });
    const data = await res.json();
    const target = document.getElementById(`result-${fieldId}`);
    if (target) {
      target.textContent = (res.ok && data.success)
        ? `Advisory: ${data.advice.join(", ")}`
        : `No advisory available`;
    }
  } catch (err) {
    console.error(err);
  }
}

// Run on advisory.html only
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("advisoryList")) loadAdvisoryCards();
});
