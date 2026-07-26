// ═══════════════════════════════════════════════
// navbar.js — Nav User Display, Dropdown, Mobile Menu
// ═══════════════════════════════════════════════

function updateNavUser() {
  const u            = state.currentUser;
  const authBtns     = document.getElementById('navAuthBtns');
  const loggedInArea = document.getElementById('navLoggedInArea');
  const mobileAuth   = document.getElementById('mobileAuthLink');
  const mobileLogout = document.getElementById('mobileLogoutLink');
  const mobileNotifBtn = document.getElementById('mobileNotifBtn');

  if (!authBtns) return;

  if (u) {
    authBtns.style.display     = 'none';
    loggedInArea.style.display = 'flex';

    document.getElementById('navUsername').textContent = u.name.split(' ')[0];
    const av = document.getElementById('navAvatar');
    if (u.avatar) av.innerHTML  = `<img src="${u.avatar}" alt="">`;
    else          av.textContent = u.name[0].toUpperCase();

    if (mobileAuth)     mobileAuth.style.display     = 'none';
    if (mobileLogout)   mobileLogout.style.display   = 'block';
    if (mobileNotifBtn) mobileNotifBtn.style.display = 'block';

    updateNotifBadge();
  } else {
    authBtns.style.display     = 'flex';
    loggedInArea.style.display = 'none';

    if (mobileAuth)     mobileAuth.style.display     = 'block';
    if (mobileLogout)   mobileLogout.style.display   = 'none';
    if (mobileNotifBtn) mobileNotifBtn.style.display = 'none';
  }
}

function toggleDropdown() {
  document.getElementById('profileDropdown')?.classList.toggle('open');
}

function closeDropdown() {
  document.getElementById('profileDropdown')?.classList.remove('open');
}

function toggleMobileMenu() {
  document.getElementById('mobileMenu')?.classList.toggle('open');
}

function closeMobileMenu() {
  document.getElementById('mobileMenu')?.classList.remove('open');
}

document.addEventListener('click', e => {
  if (!e.target.closest('.nav-user-wrap')) closeDropdown();
});

function setActiveNav() {
  const page = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a[data-page]').forEach(a => {
    a.classList.toggle('active', a.dataset.page === page);
  });
}
