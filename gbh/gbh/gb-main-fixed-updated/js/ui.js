// ═══════════════════════════════════════════════
// ui.js — Toast, Modal, Shared UI Helpers
// ═══════════════════════════════════════════════

function val(id) {
  return document.getElementById(id)?.value || '';
}

function viewUserProfile(userEmail, username) {
  if (state.currentUser && state.currentUser.email === userEmail) {
    window.location.href = 'profile.html';
    return;
  }
  if (userEmail) {
    window.location.href = `user-profile.html?u=${encodeURIComponent(userEmail)}`;
  } else {
    showToast('User profile not available', 'error');
  }
}

function showErr(el, msg) {
  el.textContent   = '⚠️ ' + msg;
  el.style.display = 'block';
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className   = 'toast show' + (type ? ' ' + type : '');
  setTimeout(() => { t.className = 'toast'; }, 3000);
}

function openModal() {
  document.getElementById('modalOverlay')?.classList.add('open');
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modalOverlay')) return;
  document.getElementById('modalOverlay')?.classList.remove('open');
}

// avatarUrl can now be passed directly (no more scanning state.users by name)
function getAvatarEl(username, avatarUrl) {
  if (avatarUrl) return `<img src="${avatarUrl}" alt="">`;
  return username ? username[0].toUpperCase() : '?';
}

function injectNavbar(activePage = '') {
  const nav = document.getElementById('mainNav');
  if (!nav) return;
  nav.style.display = 'flex';
  updateNavUser();
  setActiveNav();
}
