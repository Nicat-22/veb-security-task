// ==================== API KONFIQURASIYA ====================
const API = 'http://localhost:3000/api';

// ==================== TOKEN İDARƏSİ ====================
function getToken()        { return localStorage.getItem('itrm_token'); }
function setToken(t)       { localStorage.setItem('itrm_token', t); }
function removeToken()     { localStorage.removeItem('itrm_token'); localStorage.removeItem('itrm_user'); }
function getStoredUser()   { const u = localStorage.getItem('itrm_user'); return u ? JSON.parse(u) : null; }
function storeUser(u)      { localStorage.setItem('itrm_user', JSON.stringify(u)); }

// ==================== API YARDIMCI ====================
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;

  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Xəta baş verdi');
  return data;
}

// ==================== SƏHİFƏ NAVİQASİYASI ====================
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
  document.querySelectorAll('.nav-item[data-page]').forEach(a => a.classList.remove('active'));
  const section = document.getElementById('page-' + page);
  if (section) section.classList.remove('hidden');
  const navLink = document.querySelector(`[data-page="${page}"]`);
  if (navLink) navLink.classList.add('active');
  if (page === 'roadmap') loadRoadmap('web');
  return false;
}

// ==================== AUTENTİFİKASİYA ====================
async function login() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value.trim();
  const msg      = document.getElementById('loginMsg');

  if (!username || !password) {
    return showMsg(msg, '⚠️ Bütün sahələri doldurun.', 'red');
  }
  showMsg(msg, '⏳ Yüklənir...', 'blue');
  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    setToken(data.token);
    storeUser(data.user);
    updateNav(data.user);
    showMsg(msg, '✅ Giriş uğurlu!', 'green');
    setTimeout(() => showPage('roadmap'), 700);
  } catch (err) {
    showMsg(msg, '❌ ' + err.message, 'red');
  }
}

async function register() {
  const name     = document.getElementById('regName').value.trim();
  const username = document.getElementById('regUser').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPass').value.trim();
  const msg      = document.getElementById('regMsg');

  if (!name || !username || !email || !password) {
    return showMsg(msg, '⚠️ Bütün sahələri doldurun.', 'red');
  }
  showMsg(msg, '⏳ Qeydiyyat olunur...', 'blue');
  try {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, username, email, password })
    });
    setToken(data.token);
    storeUser(data.user);
    updateNav(data.user);
    showMsg(msg, '✅ Qeydiyyat uğurlu!', 'green');
    setTimeout(() => showPage('roadmap'), 700);
  } catch (err) {
    showMsg(msg, '❌ ' + err.message, 'red');
  }
}

function logout() {
  removeToken();
  updateNav(null);
  showPage('home');
  return false;
}

function updateNav(user) {
  const loginBtn  = document.getElementById('loginNavBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const navUser   = document.getElementById('navUsername');
  if (user) {
    loginBtn  && loginBtn.classList.add('hidden');
    logoutBtn && logoutBtn.classList.remove('hidden');
    if (navUser) navUser.textContent = user.username;
  } else {
    loginBtn  && loginBtn.classList.remove('hidden');
    logoutBtn && logoutBtn.classList.add('hidden');
  }
}

// ==================== ROADMAP ====================
let currentPath = 'web';

async function loadRoadmap(slug) {
  currentPath = slug;

  // Tab düymələrini yenilə
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.slug === slug);
  });
  document.querySelectorAll('.path-container').forEach(p => p.classList.add('hidden'));

  const container = document.getElementById('path-' + slug);
  if (!container) return;
  container.classList.remove('hidden');

  const stepsDiv = container.querySelector('.roadmap-steps');
  stepsDiv.innerHTML = '<p style="color:var(--muted);font-family:var(--font-mono);padding:20px">Yüklənir...</p>';

  try {
    const data = await apiFetch('/paths/' + slug + '/steps');
    const user = getStoredUser();
    const isPro = user && user.is_pro;

    // Pulsuz banner
    const banner = document.getElementById('freeBanner');
    banner && banner.classList.toggle('hidden', !!isPro);

    stepsDiv.innerHTML = '';
    data.steps.forEach((step, i) => {
      if (i > 0) {
        const line = document.createElement('div');
        line.className = 'step-line';
        stepsDiv.appendChild(line);
      }

      const div = document.createElement('div');
      const isFreeStep = step.is_free;
      const isUnlocked = isFreeStep || isPro;

      if (!isUnlocked) {
        div.className = 'step pro-step';
        div.innerHTML = `
          <div class="step-num lock-num">🔒</div>
          <div class="step-info">
            <h4>${step.title} <span class="pro-tag">PRO</span></h4>
            <p>${step.description || ''}</p>
          </div>
          <button class="badge pro-unlock-btn" onclick="showPaymentModal()">Kilidi Aç</button>`;
      } else if (step.progress === 'done') {
        div.className = 'step done';
        div.innerHTML = `
          <div class="step-num">✓</div>
          <div class="step-info"><h4>${step.title}</h4><p>${step.description || ''}</p></div>
          <span class="badge done-badge">✓ Tamamlandı</span>`;
      } else if (step.progress === 'in_progress') {
        div.className = 'step active-step';
        div.innerHTML = `
          <div class="step-num green-num">${step.order_num}</div>
          <div class="step-info"><h4>${step.title}</h4><p>${step.description || ''}</p></div>
          <button class="badge active-badge" onclick="markStep('${step.id}','done')">✓ Bitir</button>`;
      } else {
        div.className = 'step';
        div.innerHTML = `
          <div class="step-num">${step.order_num}</div>
          <div class="step-info"><h4>${step.title}</h4><p>${step.description || ''}</p></div>
          <button class="badge lock-badge" onclick="markStep('${step.id}','in_progress')">Başla</button>`;
      }
      stepsDiv.appendChild(div);
    });
  } catch (err) {
    stepsDiv.innerHTML = `<p style="color:#ff4444;font-family:var(--font-mono);padding:20px">❌ ${err.message}</p>`;
  }
}

async function markStep(stepId, status) {
  if (!getToken()) { showPage('login'); return; }
  try {
    await apiFetch('/paths/progress', {
      method: 'POST',
      body: JSON.stringify({ stepId, status })
    });
    // Aktual istifadəçini yenilə
    const fresh = await apiFetch('/auth/me');
    storeUser(fresh);
    loadRoadmap(currentPath);
  } catch (err) {
    alert('❌ ' + err.message);
  }
}

function showPath(slug, btn) {
  loadRoadmap(slug);
}

// ==================== ÖDƏNİŞ ====================
function showPaymentModal() {
  if (!getToken()) { showPage('login'); return; }
  document.getElementById('paymentModal').classList.remove('hidden');
  document.getElementById('payStep1').classList.remove('hidden');
  document.getElementById('payStep2').classList.add('hidden');
  document.getElementById('payMsg').textContent = '';
}

function closePaymentModal() {
  document.getElementById('paymentModal').classList.add('hidden');
}

function formatCardNum(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 16);
  input.value = v.replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(input) {
  let v = input.value.replace(/\D/g, '').substring(0, 4);
  if (v.length >= 2) v = v.slice(0, 2) + '/' + v.slice(2);
  input.value = v;
}

async function processPayment() {
  const cardName   = document.getElementById('cardName').value.trim();
  const cardNumber = document.getElementById('cardNumber').value.replace(/\s/g, '');
  const cardExpiry = document.getElementById('cardExpiry').value.trim();
  const cardCvv    = document.getElementById('cardCvv').value.trim();
  const msg        = document.getElementById('payMsg');

  if (!cardName || !cardNumber || !cardExpiry || !cardCvv) {
    return showMsg(msg, '⚠️ Bütün kart məlumatlarını doldurun.', 'red');
  }
  if (cardNumber.length < 16) return showMsg(msg, '⚠️ Kart nömrəsi 16 rəqəm olmalıdır.', 'red');
  if (cardCvv.length < 3)     return showMsg(msg, '⚠️ CVV 3 rəqəm olmalıdır.', 'red');

  showMsg(msg, '⏳ Ödəniş emal olunur...', 'blue');
  try {
    await apiFetch('/payments/checkout', {
      method: 'POST',
      body: JSON.stringify({ cardName, cardNumber, cardExpiry })
    });

    // Aktual istifadəçini yenilə (is_pro indi true)
    const fresh = await apiFetch('/auth/me');
    storeUser(fresh);
    updateNav(fresh);

    document.getElementById('payStep1').classList.add('hidden');
    document.getElementById('payStep2').classList.remove('hidden');
  } catch (err) {
    showMsg(msg, '❌ ' + err.message, 'red');
  }
}

function afterPayment() {
  closePaymentModal();
  showPage('roadmap');
}

// ==================== TAB ====================
function switchTab(formId, btn) {
  document.querySelectorAll('#loginForm, #registerForm').forEach(f => f.classList.add('hidden'));
  document.querySelectorAll('.auth-tab').forEach(b => b.classList.remove('active'));
  document.getElementById(formId).classList.remove('hidden');
  btn.classList.add('active');
}

// ==================== YARDIMCI ====================
function showMsg(el, text, color) {
  el.textContent = text;
  el.style.color = color === 'red' ? '#ff4444' : color === 'green' ? '#00ff88' : '#00aaff';
}

// ==================== TERMİNAL ====================
const phrases = ['roadmap başla','cyber security öyrən','python yaz','docker qur','html yazan dev ol'];
let pi = 0, ci = 0, deleting = false;
function typeEffect() {
  const el = document.getElementById('typedText');
  if (!el) return;
  const cur = phrases[pi];
  if (!deleting) {
    el.textContent = cur.slice(0, ++ci);
    if (ci === cur.length) { deleting = true; setTimeout(typeEffect, 1200); return; }
  } else {
    el.textContent = cur.slice(0, --ci);
    if (ci === 0) { deleting = false; pi = (pi + 1) % phrases.length; }
  }
  setTimeout(typeEffect, deleting ? 50 : 90);
}

// ==================== BAŞLANĞIC ====================
window.addEventListener('DOMContentLoaded', async () => {
  const token = getToken();
  if (token) {
    try {
      const user = await apiFetch('/auth/me');
      storeUser(user);
      updateNav(user);
    } catch {
      removeToken();
    }
  }
  showPage('home');
  typeEffect();
});