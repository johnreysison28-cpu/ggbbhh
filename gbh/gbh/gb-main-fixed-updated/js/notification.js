// ═══════════════════════════════════════════════
// notification.js — Notification Panel, Badge
// ═══════════════════════════════════════════════

let _notifFilter = 'all';

function toggleNotifPanel() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;
  panel.classList.contains('notif-panel-open') ? closeNotifPanel() : openNotifPanel();
}

async function openNotifPanel() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;
  panel.style.display = 'block';
  panel.getBoundingClientRect();
  panel.classList.add('notif-panel-open');

  // Refresh from server
  if (state.currentUser) {
    try {
      state.notifications = await apiGet('/notifications');
      updateNotifBadge();
    } catch (_) {}
  }
  renderNotifList();
}

function closeNotifPanel() {
  const panel = document.getElementById('notifPanel');
  if (!panel) return;
  panel.classList.remove('notif-panel-open');
  setTimeout(() => {
    if (!panel.classList.contains('notif-panel-open')) panel.style.display = 'none';
  }, 180);
}

function renderNotifList(filter) {
  if (filter !== undefined) _notifFilter = filter;

  const el = document.getElementById('notifList');
  if (!el) return;

  if (!state.currentUser) {
    el.innerHTML = `<div class="notif-empty"><div class="notif-empty-icon">🔔</div><p>Sign in to see your notifications</p></div>`;
    return;
  }

  let notifs = state.notifications.slice(0, 50);
  if (_notifFilter === 'unread')   notifs = notifs.filter(n => !n.is_read);
  else if (_notifFilter === 'likes')    notifs = notifs.filter(n => n.type === 'like');
  else if (_notifFilter === 'comments') notifs = notifs.filter(n => n.type === 'comment' || n.type === 'reply');

  if (!notifs.length) {
    const msgs = {
      all:      ['No notifications yet.', 'Likes and comments on your trades will appear here.'],
      unread:   ['All caught up!', 'No unread notifications.'],
      likes:    ['No likes yet.', 'When someone likes your trade, it shows here.'],
      comments: ['No comments yet.', 'Comments on your trades will appear here.'],
    };
    const [title, sub] = msgs[_notifFilter] || msgs.all;
    el.innerHTML = `<div class="notif-empty"><div class="notif-empty-icon">🔔</div><p>${title}</p><small>${sub}</small></div>`;
    return;
  }

  const offerIcons = {
    trade_offer: '🤝', offer_accepted: '✅', offer_declined: '❌',
    offer_cancelled: '🚫', trade_completed: '🎉', trade_complete_pending: '⏳',
    verification_approved: '🛡️', verification_rejected: '⚠️',
  };

  el.innerHTML = notifs.map(n => {
    const isLike    = n.type === 'like';
    const icon      = offerIcons[n.type] || (isLike ? '❤️' : (n.type === 'message' ? '💬' : '💬'));
    const iconClass = offerIcons[n.type] ? 'type-comment' : (isLike ? 'type-like' : 'type-comment');
    const msg       = `<b>${escapeHtml(n.title || '')}</b>${n.body ? ': ' + escapeHtml(n.body) : ''}`;

    const tradeIdVal  = n.related_trade_id ? `'${n.related_trade_id}'` : 'null';
    const offerIdVal  = n.related_offer_id ? `'${n.related_offer_id}'` : 'null';
    const notifIdVal  = `'${n.id}'`;
    const tsRaw = n.createdAt
      ? (n.createdAt.toDate ? n.createdAt.toDate().toISOString() : n.createdAt)
      : (n.created_at || '');

    return `
    <div class="notif-item${n.is_read ? '' : ' unread'}"
         onclick="openNotifItem(${tradeIdVal}, ${notifIdVal}, ${offerIdVal})">
      <div class="notif-icon-wrap ${iconClass}">${icon}</div>
      <div class="notif-content">
        <div class="notif-msg">${msg}</div>
        <div class="notif-time">${formatTime(tsRaw)}</div>
      </div>
      ${!n.is_read ? `<span class="notif-dot"></span>` : ''}
    </div>`;
  }).join('');
}

async function openNotifItem(tradeId, notifId, offerId) {
  // Mark as read
  try {
    await firebase.firestore().collection("notifications").doc(String(notifId)).update({ is_read: true });
    const n = state.notifications.find(x => x.id === notifId);
    if (n) n.is_read = true;
    updateNotifBadge();
    renderNotifList();
  } catch (_) {}

  closeNotifPanel();
  // Offer-related notifications route to the Trade Offers page instead of the trade modal
  if (offerId) { window.location.href = 'offers.html'; return; }
  if (tradeId && typeof openTradeModal === 'function') openTradeModal(tradeId);
}

async function markAllNotifsRead() {
  try {
    await apiPost("/notifications/read-all")
    state.notifications.forEach(n => n.is_read = true);
    updateNotifBadge();
    renderNotifList();
  } catch (_) {}
}

async function clearAllNotifs() {
  try {
    await apiPost('/notifications/clear');
    state.notifications = [];
    updateNotifBadge();
    renderNotifList();
  } catch (_) {}
}

function updateNotifBadge() {
  const count = unreadNotifCount();

  ['notifBadge'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) { el.textContent = count > 9 ? '9+' : count; el.classList.remove('hidden'); }
    else           { el.classList.add('hidden'); }
  });

  const chip = document.getElementById('notifUnreadChip');
  if (chip) {
    if (count > 0) { chip.textContent = count + ' new'; chip.classList.remove('hidden'); }
    else           { chip.classList.add('hidden'); }
  }

  const mobileBadge = document.getElementById('mobileNotifBadge');
  if (mobileBadge) {
    if (count > 0) { mobileBadge.textContent = count > 9 ? '9+' : count; mobileBadge.style.display = 'inline'; }
    else           { mobileBadge.style.display = 'none'; }
  }

  const badgeTxt = document.getElementById('navNotifBadgeText');
  if (badgeTxt) {
    if (count > 0) { badgeTxt.textContent = count > 9 ? '9+' : count; badgeTxt.style.display = 'inline-block'; }
    else           { badgeTxt.style.display = 'none'; }
  }
}

function setNotifFilter(filter, tabEl) {
  _notifFilter = filter;
  document.querySelectorAll('.notif-filter-tab').forEach(t => t.classList.remove('active'));
  if (tabEl) tabEl.classList.add('active');
  renderNotifList(filter);
}

// Close on outside click
document.addEventListener('click', function(e) {
  const panel     = document.getElementById('notifPanel');
  const btn       = document.getElementById('notifBtn');
  const mobileBtn = document.getElementById('mobileNotifBtn');
  if (!panel || !panel.classList.contains('notif-panel-open')) return;
  if (panel.contains(e.target) || (btn && btn.contains(e.target)) || (mobileBtn && mobileBtn.contains(e.target))) return;
  closeNotifPanel();
});

// Safe escapeHtml fallback
if (typeof escapeHtml !== 'function') {
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
}
