// ==================== API KONFIQURASIYA ====================
const API = (location.hostname === '127.0.0.1' || location.hostname === 'localhost')
  ? 'http://localhost:3000/api'
  : (window.API_BASE_URL || 'http://localhost:3000/api');

function getToken()    { return localStorage.getItem('itrm_admin_token'); }
function setToken(t)   { localStorage.setItem('itrm_admin_token', t); }
function removeToken() { localStorage.removeItem('itrm_admin_token'); localStorage.removeItem('itrm_admin_user'); }

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res  = await fetch(API + path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Xəta baş verdi');
  return data;
}

// ==================== ADMİN GİRİŞ ====================
async function adminLogin() {
  const username = document.getElementById('adminLoginUser').value.trim();
  const password = document.getElementById('adminLoginPass').value.trim();
  const msg      = document.getElementById('adminLoginMsg');

  if (!username || !password) {
    return showMsg(msg, '⚠️ Bütün sahələri doldurun.', 'red');
  }
  showMsg(msg, '⏳ Yüklənir...', 'blue');
  try {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    if (data.user.role !== 'admin') {
      removeToken();
      return showMsg(msg, '❌ Bu hesab admin deyil.', 'red');
    }
    setToken(data.token);
    localStorage.setItem('itrm_admin_user', JSON.stringify(data.user));
    showAdminPanel(data.user);
  } catch (err) {
    showMsg(msg, '❌ ' + err.message, 'red');
  }
}

function adminLogout() {
  removeToken();
  document.getElementById('adminLoginSection').classList.remove('hidden');
  document.getElementById('adminPanelSection').classList.add('hidden');
  document.getElementById('adminNavRight').style.display = 'none';
  document.getElementById('adminLoginUser').value = '';
  document.getElementById('adminLoginPass').value = '';
  document.getElementById('adminLoginMsg').textContent = '';
}

function showAdminPanel(user) {
  document.getElementById('adminLoginSection').classList.add('hidden');
  document.getElementById('adminPanelSection').classList.remove('hidden');
  document.getElementById('adminNavRight').style.display = 'flex';
  document.getElementById('adminLoggedName').textContent = user.name;
  loadStats();
  loadUsers();
}

// ==================== PANEL YÜKLƏMƏ ====================
async function loadStats() {
  try {
    const s = await apiFetch('/admin/stats');
    document.getElementById('statUsers').textContent   = s.totalUsers;
    document.getElementById('statPro').textContent     = s.proUsers;
    document.getElementById('statRevenue').textContent = '₼' + s.totalRevenue.toFixed(2);
  } catch (err) {
    console.error('Stats xətası:', err.message);
  }
}

async function loadUsers() {
  try {
    const users = await apiFetch('/admin/users');
    renderUserTable(users);
  } catch (err) {
    document.getElementById('userTable').innerHTML =
      `<tr><td colspan="8" style="color:#ff4444;padding:20px;text-align:center">❌ ${err.message}</td></tr>`;
  }
}

function renderUserTable(users) {
  const tbody = document.getElementById('userTable');
  tbody.innerHTML = '';
  users.forEach((u, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${u.name}</td>
      <td><code>${u.username}</code></td>
      <td>${u.email || '—'}</td>
      <td><span class="role-badge ${u.role === 'admin' ? 'role-admin' : 'role-user'}">${u.role === 'admin' ? '👑 Admin' : '👤 User'}</span></td>
      <td><span class="pro-status ${u.is_pro ? 'pro-yes' : 'pro-no'}">${u.is_pro ? '✅ Pro' : '🆓 Pulsuz'}</span></td>
      <td>${new Date(u.created_at).toLocaleDateString('az-AZ')}</td>
      <td class="action-btns">
        ${u.role !== 'admin' ? `
          <button class="tbl-btn ${u.is_pro ? 'btn-downgrade' : 'btn-upgrade'}" onclick="togglePro('${u.id}', ${!u.is_pro})">
            ${u.is_pro ? 'Pro Sil' : 'Pro Et'}
          </button>
          <button class="tbl-btn btn-delete" onclick="deleteUser('${u.id}')">Sil</button>
        ` : '<span style="color:#555">—</span>'}
      </td>`;
    tbody.appendChild(tr);
  });
}

async function loadPayments() {
  try {
    const payments = await apiFetch('/admin/payments');
    renderPaymentTable(payments);
  } catch (err) {
    document.getElementById('paymentTable').innerHTML =
      `<tr><td colspan="8" style="color:#ff4444;padding:20px;text-align:center">❌ ${err.message}</td></tr>`;
  }
}

function renderPaymentTable(payments) {
  const tbody = document.getElementById('paymentTable');
  tbody.innerHTML = '';
  if (payments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#555;padding:30px">Hələ ödəniş yoxdur</td></tr>';
    return;
  }
  payments.forEach((p, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td><code>${p.username}</code></td>
      <td>${p.card_holder}</td>
      <td><code>${p.card_masked}</code></td>
      <td>${p.card_expiry}</td>
      <td style="color:#00ff88">₼${parseFloat(p.amount).toFixed(2)}</td>
      <td>${new Date(p.paid_at).toLocaleDateString('az-AZ')}</td>
      <td><span class="status-badge status-ok">${p.status}</span></td>`;
    tbody.appendChild(tr);
  });
}

// ==================== İSTİFADƏÇİ ƏMƏLİYYATLARI ====================
async function togglePro(userId, newState) {
  try {
    await apiFetch('/admin/users/' + userId + '/pro', {
      method: 'PATCH',
      body: JSON.stringify({ is_pro: newState })
    });
    loadStats();
    loadUsers();
  } catch (err) { alert('❌ ' + err.message); }
}

async function deleteUser(userId) {
  if (!confirm('Bu istifadəçini silmək istəyirsiniz?')) return;
  try {
    await apiFetch('/admin/users/' + userId, { method: 'DELETE' });
    loadStats();
    loadUsers();
  } catch (err) { alert('❌ ' + err.message); }
}

async function addUser() {
  const name     = document.getElementById('newName').value.trim();
  const username = document.getElementById('newUsername').value.trim();
  const email    = document.getElementById('newEmail').value.trim();
  const password = document.getElementById('newPassword').value.trim();
  const role     = document.getElementById('newRole').value;
  const is_pro   = document.getElementById('newPro').value === 'true';
  const msg      = document.getElementById('adminMsg');

  if (!name || !username || !password) {
    return showMsg(msg, '⚠️ Ad, istifadəçi adı və şifrə mütləqdir.', 'red');
  }
  showMsg(msg, '⏳ Əlavə olunur...', 'blue');
  try {
    await apiFetch('/admin/users', {
      method: 'POST',
      body: JSON.stringify({ name, username, email, password, role, is_pro })
    });
    showMsg(msg, '✅ İstifadəçi əlavə edildi!', 'green');
    ['newName','newUsername','newEmail','newPassword'].forEach(id => document.getElementById(id).value = '');
    setTimeout(() => {
      msg.textContent = '';
      showAdminTab('users', document.querySelector('.admin-tab-btn'));
      loadStats();
      loadUsers();
    }, 1000);
  } catch (err) {
    showMsg(msg, '❌ ' + err.message, 'red');
  }
}

async function filterUsers() {
  const q = document.getElementById('searchUsers').value.toLowerCase();
  const rows = document.querySelectorAll('#userTable tr');
  rows.forEach(r => {
    r.style.display = r.textContent.toLowerCase().includes(q) ? '' : 'none';
  });
}

// ==================== TAB ====================
function showAdminTab(tab, btn) {
  document.querySelectorAll('.admin-tab-content').forEach(t => t.classList.add('hidden'));
  document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.remove('hidden');
  if (btn) btn.classList.add('active');
  if (tab === 'payments') loadPayments();
}

// ==================== YARDIMCI ====================
function showMsg(el, text, color) {
  el.textContent = text;
  el.style.color = color === 'red' ? '#ff4444' : color === 'green' ? '#00ff88' : '#00aaff';
}

// ==================== BAŞLANĞIC ====================
window.addEventListener('DOMContentLoaded', async () => {
  const token     = getToken();
  const savedUser = localStorage.getItem('itrm_admin_user');
  if (token && savedUser) {
    try {
      // Token hələ keçərlidir?
      const user = await apiFetch('/auth/me');
      if (user.role === 'admin') {
        showAdminPanel(user);
        return;
      }
    } catch {
      removeToken();
    }
  }
  // Token yoxdur — giriş formu göstər
  document.getElementById('adminLoginSection').classList.remove('hidden');
  document.getElementById('adminPanelSection').classList.add('hidden');
});