// ═══════════════════════════════════════════════
// support.js — Customer Service:
//   1) Floating FAQ chatbot widget (rule-based, no backend)
//   2) Support ticket system on top of Firestore:
//        supportTickets/{ticketId}                  ← meta doc
//        supportTickets/{ticketId}/messages/{msgId} ← thread
//   Widget is injected site-wide. The ticket helper functions
//   (createSupportTicket / listenTicketMessages / etc.) are also
//   reused by admin.html for the admin-side inbox.
// ═══════════════════════════════════════════════

'use strict';

// ── FAQ knowledge base ────────────────────────
// Each entry: keywords used for matching + the question/answer shown.
const SUPPORT_FAQS = [
  {
    q: 'How do I post a trade?',
    a: 'Go to <b>Post Trade</b> in the navbar, pick the game, add a title, description, what you\'re offering, and an optional photo, then submit. Your trade will appear in the Browse feed right away.',
    kw: ['post', 'trade', 'create', 'list', 'sell', 'listing'],
  },
  {
    q: 'How do I make an offer on someone\'s trade?',
    a: 'Open any trade card and click <b>Make Offer</b>. Describe what you\'d like to trade and send it — the trade owner will get a notification and can accept, decline, or chat with you first.',
    kw: ['offer', 'make offer', 'propose', 'bid'],
  },
  {
    q: 'How does accepting/declining offers work?',
    a: 'Check <b>Trade Offers</b> in the navbar for offers you\'ve received or sent. As the trade owner you can accept or decline; once accepted, both sides can mark the trade complete.',
    kw: ['accept', 'decline', 'offer status', 'pending offer', 'reject offer'],
  },
  {
    q: 'When can I see the other trader\'s contact info?',
    a: 'Phone numbers and other private contact details unlock automatically for both users only after a trade offer between you has been accepted or completed — this protects everyone\'s privacy beforehand.',
    kw: ['contact', 'phone number', 'unlock', 'private info', 'number'],
  },
  {
    q: 'How does messaging/chat work?',
    a: 'Use <b>Messages</b> in the navbar for full conversations, or the inline chat button right on a trade offer for a quick back-and-forth about that specific trade.',
    kw: ['message', 'chat', 'inbox', 'talk', 'conversation'],
  },
  {
    q: 'Why do I need to verify my identity (KYC)?',
    a: 'ID + selfie verification helps keep trades safe by confirming traders are real people. Submit it during registration or from your Profile — once an admin approves it, a verified badge appears on your profile.',
    kw: ['verify', 'verification', 'kyc', 'id', 'selfie', 'badge', 'identity'],
  },
  {
    q: 'How long does verification review take?',
    a: 'Our team reviews KYC submissions as quickly as possible. You\'ll get a notification the moment your account is approved or if we need a clearer photo resubmitted.',
    kw: ['how long', 'review time', 'pending verification', 'waiting'],
  },
  {
    q: 'Can I hide my trade history and stats from other people?',
    a: 'Yes — in your Profile settings you can enable a privacy toggle that hides your trade history, join date, and stats from other users\' view of your profile. Your trade posts still show normally in Browse.',
    kw: ['privacy', 'hide', 'private profile', 'hide stats', 'hide history'],
  },
  {
    q: 'How do favorites/wishlist work?',
    a: 'Tap the heart/star icon on any trade to save it to your favorites. You can review saved trades any time from your profile.',
    kw: ['favorite', 'wishlist', 'save', 'bookmark'],
  },
  {
    q: 'How do ratings work?',
    a: 'After completing a trade, both traders can leave each other a rating. Ratings build up on a user\'s profile so others can see how trustworthy they are.',
    kw: ['rating', 'review', 'reputation', 'feedback', 'stars'],
  },
  {
    q: 'How do I report a user or a trade?',
    a: 'Open the user\'s profile or the trade in question and use the Report option. Our team reviews every report — please include as much detail as you can.',
    kw: ['report', 'scam', 'abuse', 'fraud', 'fake'],
  },
  {
    q: 'What should I keep in mind for safe trading?',
    a: 'Stick to in-app chat until you\'re comfortable, avoid sharing passwords/OTPs, prefer trading with verified accounts, and use the in-app report button if something feels off.',
    kw: ['safety', 'safe', 'scam tips', 'secure trading'],
  },
  {
    q: 'I forgot my password / can\'t log in.',
    a: 'Use the "Forgot password" link on the Login page to get a reset email. If you still can\'t get in, open a support ticket below and our team will help.',
    kw: ['password', 'forgot', 'login', 'log in', 'can\'t sign in', 'reset'],
  },
  {
    q: 'How do I delete or edit a trade I posted?',
    a: 'Open the trade you posted and use the edit (✎) or delete controls on the card — only you can edit or remove your own trade posts.',
    kw: ['delete trade', 'edit trade', 'remove trade', 'update listing'],
  },
];

// ── State ─────────────────────────────────────
let _supEls = {};
let _supActiveTab = 'faq';
let _supActiveTicketId = null;
let _supMyTicketsUnsub = null;
let _supThreadUnsub = null;
let _supMyTicketsCache = [];

function _sdb() { return firebase.firestore(); }
function _supMyUid() {
  const u = state && state.currentUser;
  return (u && (u.uid || u.id)) || null;
}

// ═══════════════════════════════════════════════
// WIDGET INJECTION (site-wide floating bubble)
// ═══════════════════════════════════════════════

(function injectSupportWidget() {
  const chatSVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>`;

  const html = `
  <button class="support-fab" id="supportFab" onclick="toggleSupportPanel()" aria-label="Customer Support" title="Help & Support">
    ${chatSVG}
    <span class="support-fab-badge hidden" id="supportFabBadge">0</span>
  </button>

  <div class="support-panel" id="supportPanel">
    <div class="support-panel-header">
      <div class="support-panel-header-title">🎧 Help &amp; Support</div>
      <button class="support-panel-close" onclick="closeSupportPanel()">✕</button>
    </div>
    <div class="support-tabs">
      <button class="support-tab active" id="supTabFaq" onclick="switchSupportTab('faq')">FAQ</button>
      <button class="support-tab" id="supTabTickets" onclick="switchSupportTab('tickets')">My Tickets</button>
    </div>
    <div class="support-body" id="supportBody"></div>
  </div>`;

  document.body.insertAdjacentHTML('beforeend', html);

  _supEls.body = document.getElementById('supportBody');
  renderFaqTab('');

  // Keep the "My Tickets" badge in sync once we know who's logged in.
  restoreSession().then(() => {
    if (_supMyUid()) _startMyTicketsBadgeListener();
  });
})();

function toggleSupportPanel() {
  const p = document.getElementById('supportPanel');
  if (!p) return;
  p.classList.contains('open') ? closeSupportPanel() : openSupportPanel();
}
function openSupportPanel() {
  document.getElementById('supportPanel')?.classList.add('open');
}
function closeSupportPanel() {
  document.getElementById('supportPanel')?.classList.remove('open');
}

function switchSupportTab(tab) {
  _supActiveTab = tab;
  document.getElementById('supTabFaq')?.classList.toggle('active', tab === 'faq');
  document.getElementById('supTabTickets')?.classList.toggle('active', tab === 'tickets');
  if (tab === 'faq') renderFaqTab('');
  else renderMyTicketsTab();
}

// ═══════════════════════════════════════════════
// FAQ TAB
// ═══════════════════════════════════════════════

function renderFaqTab(query) {
  _supEls.body.classList.remove('no-pad');
  const q = (query || '').trim().toLowerCase();
  let items = SUPPORT_FAQS;
  if (q) {
    items = SUPPORT_FAQS
      .map(f => ({ f, score: _faqScore(f, q) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(x => x.f);
  }

  const listHtml = items.length
    ? items.map((f, i) => `
      <div class="support-faq-item" id="supFaq${i}">
        <div class="support-faq-q" onclick="_toggleFaq(${i})">
          <span>${_escS(f.q)}</span>
          <span class="chev">▾</span>
        </div>
        <div class="support-faq-a">${f.a}</div>
      </div>`).join('')
    : `<div class="support-faq-empty">No matching answers. Try different words, or contact support below.</div>`;

  _supEls.body.innerHTML = `
    <input type="text" class="support-search" placeholder="Search for help, e.g. &quot;how do offers work&quot;"
      value="${_escS(query || '')}" oninput="renderFaqTab(this.value)">
    ${listHtml}
    <div class="support-cta-box">
      <p>Didn't find what you needed?</p>
      <button class="support-btn full" onclick="showTicketForm()">✉️ Contact Support</button>
    </div>`;
}

function _toggleFaq(i) {
  document.getElementById('supFaq' + i)?.classList.toggle('open');
}

function _faqScore(faq, q) {
  let score = 0;
  const hay = (faq.q + ' ' + faq.kw.join(' ')).toLowerCase();
  if (hay.includes(q)) score += 5;
  q.split(/\s+/).forEach(word => {
    if (word.length < 3) return;
    if (faq.kw.some(k => k.includes(word))) score += 2;
    if (faq.q.toLowerCase().includes(word)) score += 1;
  });
  return score;
}

// ═══════════════════════════════════════════════
// NEW TICKET FORM
// ═══════════════════════════════════════════════

function showTicketForm() {
  if (!_supMyUid()) {
    _supEls.body.classList.remove('no-pad');
    _supEls.body.innerHTML = `
      <div class="support-login-gate">
        <div style="font-size:2rem;margin-bottom:8px">🔒</div>
        <p>Please sign in to open a support ticket.</p>
        <a href="login.html" class="support-btn">Sign In</a>
      </div>`;
    return;
  }

  _supEls.body.classList.remove('no-pad');
  _supEls.body.innerHTML = `
    <div class="support-back-row" onclick="switchSupportTab('faq')">← Back to FAQ</div>
    <div class="support-form-group">
      <label>Category</label>
      <select id="supTicketCategory">
        <option value="Account & Verification">Account &amp; Verification</option>
        <option value="Trades & Offers">Trades &amp; Offers</option>
        <option value="Payments / Scam Concern">Payments / Scam Concern</option>
        <option value="Bug Report">Bug Report</option>
        <option value="Other">Other</option>
      </select>
    </div>
    <div class="support-form-group">
      <label>Subject</label>
      <input type="text" id="supTicketSubject" placeholder="Brief summary of your issue" maxlength="120">
    </div>
    <div class="support-form-group">
      <label>Message</label>
      <textarea id="supTicketMessage" placeholder="Describe your issue in detail…" maxlength="2000"></textarea>
    </div>
    <button class="support-btn full" onclick="submitNewTicket()">Submit Ticket</button>`;
}

async function submitNewTicket() {
  const category = val('supTicketCategory') || 'Other';
  const subject  = val('supTicketSubject').trim();
  const message  = val('supTicketMessage').trim();

  if (!subject || !message) {
    showToast('Please fill in a subject and message.', 'error');
    return;
  }

  try {
    const ticketId = await createSupportTicket({ subject, category, message });
    showToast('✅ Support ticket submitted');
    switchSupportTab('tickets');
    openTicketThread(ticketId);
  } catch (e) {
    showToast(e.message || 'Could not submit ticket.', 'error');
  }
}

// ── Shared ticket helpers (also used by admin.html) ──

async function createSupportTicket({ subject, category, message }) {
  const uid = _supMyUid();
  if (!uid) throw new Error('You must be signed in to contact support.');
  const db = _sdb();

  const ticketRef = await db.collection('supportTickets').add({
    userId:      uid,
    userName:    state.currentUser.name  || 'User',
    userEmail:   state.currentUser.email || '',
    subject,
    category,
    status:      'open',
    lastMessage: message,
    lastSender:  'user',
    userUnread:  false,
    adminUnread: true,
    createdAt:   firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
  });

  await ticketRef.collection('messages').add({
    senderId:   uid,
    senderName: state.currentUser.name || 'User',
    senderRole: 'user',
    text:       message,
    createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
  });

  return ticketRef.id;
}

async function sendSupportMessage(ticketId, text, role) {
  text = (text || '').trim();
  if (!text) return;
  const uid = _supMyUid();
  if (!uid) throw new Error('Not signed in.');
  const db = _sdb();

  await db.collection('supportTickets').doc(ticketId).collection('messages').add({
    senderId:   uid,
    senderName: state.currentUser.name || (role === 'admin' ? 'Support' : 'User'),
    senderRole: role,
    text,
    createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
  });

  await db.collection('supportTickets').doc(ticketId).update({
    lastMessage: text,
    lastSender:  role,
    updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
    userUnread:  role === 'admin',
    adminUnread: role === 'user',
  });
}

function listenTicketMessages(ticketId, callback) {
  return _sdb().collection('supportTickets').doc(ticketId).collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, () => callback([]));
}

async function markTicketRead(ticketId, role) {
  const field = role === 'admin' ? 'adminUnread' : 'userUnread';
  try {
    await _sdb().collection('supportTickets').doc(ticketId).update({ [field]: false });
  } catch (_) {}
}

async function setTicketStatus(ticketId, status) {
  await _sdb().collection('supportTickets').doc(ticketId).update({
    status, updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

// ═══════════════════════════════════════════════
// MY TICKETS TAB (user side)
// ═══════════════════════════════════════════════

function renderMyTicketsTab() {
  if (!_supMyUid()) {
    _supEls.body.classList.remove('no-pad');
    _supEls.body.innerHTML = `
      <div class="support-login-gate">
        <div style="font-size:2rem;margin-bottom:8px">🔒</div>
        <p>Sign in to view your support tickets.</p>
        <a href="login.html" class="support-btn">Sign In</a>
      </div>`;
    return;
  }

  _supEls.body.classList.remove('no-pad');
  _supEls.body.innerHTML = `<div class="support-loading">Loading your tickets…</div>
    <div style="margin-top:10px"><button class="support-btn full ghost" onclick="showTicketForm()">+ New Ticket</button></div>`;

  if (_supMyTicketsUnsub) { _supMyTicketsUnsub(); _supMyTicketsUnsub = null; }

  _supMyTicketsUnsub = _sdb().collection('supportTickets')
    .where('userId', '==', _supMyUid())
    .orderBy('updatedAt', 'desc')
    .onSnapshot(snap => {
      _supMyTicketsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _updateSupportBadge();
      if (_supActiveTab === 'tickets' && !_supActiveTicketId) _renderMyTicketsList();
    }, () => {
      if (_supActiveTab === 'tickets') {
        _supEls.body.innerHTML = `<div class="support-empty"><span class="icon">⚠️</span>Couldn't load tickets.</div>`;
      }
    });
}

function _renderMyTicketsList() {
  if (!_supMyTicketsCache.length) {
    _supEls.body.innerHTML = `
      <div class="support-empty"><span class="icon">📭</span>No support tickets yet.</div>
      <button class="support-btn full" onclick="showTicketForm()">+ New Ticket</button>`;
    return;
  }

  _supEls.body.innerHTML = `
    <button class="support-btn full ghost" style="margin-bottom:10px" onclick="showTicketForm()">+ New Ticket</button>
    ${_supMyTicketsCache.map(t => `
      <div class="support-ticket-item ${t.userUnread ? 'unread' : ''}" onclick="openTicketThread('${t.id}')">
        <div class="support-ticket-top">
          <span class="support-ticket-subject">${_escS(t.subject)}</span>
          <span class="support-status-badge ${t.status}">${t.status}</span>
        </div>
        <div class="support-ticket-meta">${_escS(t.category || '')} · ${_supTimeAgo(t.updatedAt)}</div>
        <div class="support-ticket-preview">${t.lastSender === 'admin' ? '🎧 ' : ''}${_escS(t.lastMessage || '')}</div>
      </div>`).join('')}`;
}

// ═══════════════════════════════════════════════
// TICKET THREAD (user side)
// ═══════════════════════════════════════════════

function openTicketThread(ticketId) {
  _supActiveTicketId = ticketId;
  const ticket = _supMyTicketsCache.find(t => t.id === ticketId) || {};
  markTicketRead(ticketId, 'user');

  _supEls.body.classList.add('no-pad');
  _supEls.body.innerHTML = `
    <div class="support-thread-header">
      <div class="support-back-row" style="margin-bottom:8px" onclick="closeTicketThread()">← Back to My Tickets</div>
      <div class="support-thread-subject">${_escS(ticket.subject || 'Support ticket')}</div>
      <div class="support-thread-meta">${_escS(ticket.category || '')} · <span class="support-status-badge ${ticket.status || 'open'}">${ticket.status || 'open'}</span></div>
    </div>
    <div class="support-thread-msgs" id="supThreadMsgs"><div class="support-loading">Loading conversation…</div></div>
    ${ticket.status === 'closed'
      ? `<div class="support-thread-closed-note">This ticket is closed. Send a message to reopen it.</div>`
      : ''}
    <div class="support-thread-input-row">
      <input type="text" id="supThreadInput" placeholder="Type a message…" onkeydown="if(event.key==='Enter')sendMyTicketReply('${ticketId}')">
      <button class="support-btn" onclick="sendMyTicketReply('${ticketId}')">Send</button>
    </div>`;

  if (_supThreadUnsub) { _supThreadUnsub(); _supThreadUnsub = null; }
  _supThreadUnsub = listenTicketMessages(ticketId, msgs => {
    const el = document.getElementById('supThreadMsgs');
    if (!el) return;
    el.innerHTML = msgs.map(m => `
      <div class="support-msg ${m.senderRole === 'user' ? 'mine' : 'theirs'}">
        <div class="support-msg-sender">${m.senderRole === 'admin' ? '🎧 Support' : 'You'}</div>
        ${_escS(m.text)}
        <div class="support-msg-time">${_supTimeAgo(m.createdAt)}</div>
      </div>`).join('');
    el.scrollTop = el.scrollHeight;
  });
}

function closeTicketThread() {
  _supActiveTicketId = null;
  if (_supThreadUnsub) { _supThreadUnsub(); _supThreadUnsub = null; }
  _renderMyTicketsList();
}

async function sendMyTicketReply(ticketId) {
  const input = document.getElementById('supThreadInput');
  const text = input ? input.value : '';
  if (!text || !text.trim()) return;
  input.value = '';
  try {
    await sendSupportMessage(ticketId, text, 'user');
    // Reopen a closed ticket if the user writes back in.
    const t = _supMyTicketsCache.find(x => x.id === ticketId);
    if (t && t.status === 'closed') await setTicketStatus(ticketId, 'open');
  } catch (e) {
    showToast(e.message || 'Could not send message.', 'error');
  }
}

// ═══════════════════════════════════════════════
// Badge (unread admin replies) on the floating button
// ═══════════════════════════════════════════════

function _startMyTicketsBadgeListener() {
  if (_supMyTicketsUnsub) return; // renderMyTicketsTab() will attach it
  _sdb().collection('supportTickets')
    .where('userId', '==', _supMyUid())
    .onSnapshot(snap => {
      _supMyTicketsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      _updateSupportBadge();
    }, () => {});
}

function _updateSupportBadge() {
  const count = _supMyTicketsCache.filter(t => t.userUnread).length;
  const badge = document.getElementById('supportFabBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 9 ? '9+' : String(count);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// ═══════════════════════════════════════════════
// Small utils
// ═══════════════════════════════════════════════

function _escS(str) {
  if (str == null) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _supTimeAgo(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return 'just now';
  if (secs < 3600) return Math.floor(secs / 60) + 'm ago';
  if (secs < 86400) return Math.floor(secs / 3600) + 'h ago';
  if (secs < 604800) return Math.floor(secs / 86400) + 'd ago';
  return d.toLocaleDateString();
}
