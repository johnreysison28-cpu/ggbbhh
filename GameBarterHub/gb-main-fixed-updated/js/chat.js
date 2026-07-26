// ═══════════════════════════════════════════════
// chat.js — Firebase Firestore Real-Time Chat
// Messages stored in Firestore:
//   /chats/{chatId}                  ← meta doc
//   /chats/{chatId}/messages/{msgId} ← individual messages
// ═══════════════════════════════════════════════

'use strict';

// ── State ─────────────────────────────────────
let _chatId          = null;
let _partnerUid      = null;
let _partnerData     = null;
let _allChats        = [];
let _searchQ         = '';
let _pendingImage    = null;   // base64 data URL of an image staged to send

// Firestore unsubscribe handles
let _chatsUnsub      = null;   // sidebar listener
let _messagesUnsub   = null;   // active chat messages listener
let _presenceUnsubs  = {};     // uid → unsubscribe fn

// ── Firestore shorthand ───────────────────────
function _fdb() { return firebase.firestore(); }
function _rtdb() { return firebase.database(); }

function buildChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}

// ── Resolve current user uid safely ──────────
function _myUid() {
  const u = state && state.currentUser;
  return (u && (u.uid || u.id)) || null;
}

// ═══════════════════════════════════════════════
// PRESENCE  (Firebase Realtime Database)
// initPresence/watchPresence/setPresenceOffline now live in
// data.js so they're available site-wide (not just on this page).
// ═══════════════════════════════════════════════

// ═══════════════════════════════════════════════
// CHAT LIST LISTENER  (sidebar)
// ═══════════════════════════════════════════════

function startChatsListener() {
  const uid = _myUid();
  if (!uid) return;

  // Unsubscribe any previous listener
  if (_chatsUnsub) { _chatsUnsub(); _chatsUnsub = null; }

  // Show loading state
  const el = document.getElementById('chatList');
  if (el) el.innerHTML = '<div class="chat-empty-sidebar"><div style="font-size:2rem;margin-bottom:8px">⏳</div><p>Loading…</p></div>';

  const _handleChatsSnapshot = (snapshot) => {
    _allChats = snapshot.docs.map((doc) => {
      const d = doc.data();
      const partnerId = (d.participants || []).find((id) => id !== uid) || '';
      return {
        chatId:        doc.id,
        partnerId,
        partnerName:   (d.participantNames   || {})[partnerId] || 'Unknown',
        partnerAvatar: (d.participantAvatars || {})[partnerId] || null,
        lastMessage:   d.lastMessage || '',
        updatedAt:     d.updatedAt   ? (d.updatedAt.toMillis ? d.updatedAt.toMillis() : d.updatedAt) : null,
        unread:        (d.unread     || {})[uid] || 0,
      };
    });
    _allChats.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    renderSidebar();
    updateTotalUnread();
  };

  _chatsUnsub = _fdb()
    .collection('chats')
    .where('participants', 'array-contains', uid)
    .orderBy('updatedAt', 'desc')
    .onSnapshot(_handleChatsSnapshot, (err) => {
      console.error('Chat list listener error:', err);
      // Fallback: query without orderBy if composite index not deployed yet
      if (_chatsUnsub) { _chatsUnsub(); _chatsUnsub = null; }
      _chatsUnsub = _fdb()
        .collection('chats')
        .where('participants', 'array-contains', uid)
        .onSnapshot(_handleChatsSnapshot, (e) => console.error('Fallback chat listener error:', e));
    });
}

function stopChatsListener() {
  if (_chatsUnsub) { _chatsUnsub(); _chatsUnsub = null; }
}

// ═══════════════════════════════════════════════
// SIDEBAR RENDER
// ═══════════════════════════════════════════════

function renderSidebar() {
  const q    = _searchQ.toLowerCase();
  const list = q
    ? _allChats.filter((c) => c.partnerName.toLowerCase().indexOf(q) !== -1)
    : _allChats;
  const el = document.getElementById('chatList');
  if (!el) return;

  if (!list.length) {
    el.innerHTML = '<div class="chat-empty-sidebar"><div style="font-size:2rem;margin-bottom:8px">💬</div><p>No conversations yet.<br>Visit a user profile and click "Message" to start chatting.</p></div>';
    return;
  }

  el.innerHTML = list.map((c) => {
    const isActive   = _chatId === c.chatId;
    const initials   = (c.partnerName || '?')[0].toUpperCase();
    const preview    = escHtml(c.lastMessage || 'Start a conversation');
    const timeStr    = c.updatedAt ? formatRelativeTime(new Date(c.updatedAt).toISOString()) : '';
    const avatarHtml = c.partnerAvatar
      ? '<img src="' + escHtml(c.partnerAvatar) + '" alt="">'
      : '<span>' + initials + '</span>';
    const unreadHtml = c.unread > 0
      ? '<span class="unread-badge">' + (c.unread > 99 ? '99+' : c.unread) + '</span>'
      : '';
    return '<div class="chat-contact ' + (isActive ? 'active' : '') + ' ' + (c.unread > 0 ? 'has-unread' : '') + '" onclick="openChat(\'' + c.chatId + '\',\'' + escHtml(c.partnerId) + '\')">'
      + '<div class="contact-avatar" id="avatar-' + escHtml(c.partnerId) + '">' + avatarHtml + '<span class="presence-dot" id="dot-' + escHtml(c.partnerId) + '"></span></div>'
      + '<div class="contact-info"><div class="contact-name">' + escHtml(c.partnerName) + '</div><div class="contact-preview">' + preview + '</div></div>'
      + '<div class="contact-meta"><span class="contact-time">' + timeStr + '</span>' + unreadHtml + '</div>'
      + '</div>';
  }).join('');

  // Detach old presence listeners that are no longer visible, attach new ones
  list.forEach((c) => _attachPresenceDot(c.partnerId));
}

let _sidebarSearchTimer = null;
function filterChats(q) {
  clearTimeout(_sidebarSearchTimer);
  _sidebarSearchTimer = setTimeout(() => { _searchQ = q; renderSidebar(); }, 150);
}

function updateTotalUnread() {
  const total = _allChats.reduce((s, c) => s + (c.unread || 0), 0);
  const badge = document.getElementById('totalUnreadBadge');
  if (!badge) return;
  if (total > 0) { badge.textContent = total > 99 ? '99+' : total; badge.style.display = 'inline-flex'; }
  else           { badge.style.display = 'none'; }
}

function _attachPresenceDot(uid) {
  if (_presenceUnsubs[uid]) return;
  _presenceUnsubs[uid] = watchPresence(uid, (status) => {
    const dot = document.getElementById('dot-' + uid);
    if (!dot) return;
    dot.className = 'presence-dot ' + (status && status.online ? 'online' : 'offline');
  });
}

// ═══════════════════════════════════════════════
// OPEN CHAT
// ═══════════════════════════════════════════════

async function openChat(chatId, partnerUid) {
  // Stop previous message listener
  if (_messagesUnsub) { _messagesUnsub(); _messagesUnsub = null; }

  _pendingImage = null; // don't carry a staged image across chats

  _chatId     = chatId;
  _partnerUid = partnerUid;

  // Get partner info from sidebar cache or Firestore
  const cached = _allChats.find((c) => c.chatId === chatId);
  if (cached) {
    _partnerData = { name: cached.partnerName, avatar: cached.partnerAvatar };
  } else {
    try {
      const snap = await _fdb().collection('chats').doc(chatId).get();
      if (snap.exists) {
        const d = snap.data();
        _partnerData = {
          name:   (d.participantNames   || {})[partnerUid] || 'Unknown',
          avatar: (d.participantAvatars || {})[partnerUid] || null,
        };
      } else {
        _partnerData = { name: partnerUid, avatar: null };
      }
    } catch (_) {
      _partnerData = { name: partnerUid, avatar: null };
    }
  }

  // Override with pending partner data from sessionStorage
  if (window._pendingPartnerData) {
    _partnerData = window._pendingPartnerData;
    window._pendingPartnerData = null;
  }

  renderSidebar();
  renderChatShell();
  _startMessagesListener();
  _markRead(chatId);

  if (window.innerWidth <= 768) {
    const sidebar = document.getElementById('chatSidebar');
    const main    = document.getElementById('chatMain');
    if (sidebar) sidebar.classList.add('mobile-hidden');
    if (main)    main.classList.add('mobile-open');
  }
}

// ── Render chat shell (header + input area) ───
function renderChatShell() {
  const p        = _partnerData || { name: 'Unknown', avatar: null };
  const initials = (p.name || '?')[0].toUpperCase();
  const avatarHtml = p.avatar
    ? '<img src="' + escHtml(p.avatar) + '" alt="">'
    : '<span>' + initials + '</span>';

  const emojis = ['😀','😂','🥰','😎','🤔','🙄','😭','😡','🤣','❤️','👍','👎','🔥','💯','🎮','⚔️','🏆','💎','🚀','✨','🎉','💀','😤','🤯','👀','🫡','😴','🥳'];
  const emojiHtml = emojis.map((e) => '<span onclick="insertEmoji(\'' + e + '\')">' + e + '</span>').join('');

  document.getElementById('chatMain').innerHTML =
    '<div class="chat-header" id="chatHeader">'
    + '<button class="back-btn" onclick="closeMobileChat()"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg></button>'
    + '<div class="header-avatar" id="headerAvatar">' + avatarHtml + '<span class="presence-dot" id="headerDot"></span></div>'
    + '<div class="header-info"><div class="header-name">' + escHtml(p.name) + '</div><div class="header-status" id="headerStatus"><span class="online-label">● Active</span></div></div>'
    + '</div>'
    + '<div class="messages-area" id="messagesArea"><div class="empty-chat"><div class="empty-chat-icon">⏳</div><p>Loading messages…</p></div></div>'
    + '<div class="input-area-wrap" id="inputAreaWrap">'
    + '<div class="img-preview-bar" id="imgPreviewBar">'
    + '<img id="imgPreviewThumb" src="" alt="">'
    + '<span class="img-preview-label">Photo ready to send</span>'
    + '<button class="img-preview-remove" onclick="removePendingImage()" title="Remove image">✕</button>'
    + '</div>'
    + '<div class="input-area">'
    + '<input type="file" accept="image/*" id="imgInput" style="display:none" onchange="handleImageSelect(this)">'
    + '<button class="attach-btn" onclick="document.getElementById(\'imgInput\').click()" title="Send image"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></button>'
    + '<div class="emoji-wrap"><button class="emoji-toggle-btn" onclick="toggleEmojiPicker(event)" title="Emoji"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 13s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg></button>'
    + '<div class="emoji-picker" id="emojiPicker">' + emojiHtml + '</div></div>'
    + '<textarea class="msg-input" id="msgInput" placeholder="Type a message…" rows="1" oninput="autoResize(this)" onkeydown="handleKey(event)"></textarea>'
    + '<button class="send-btn" onclick="sendMessage()" title="Send"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>'
    + '</div>'
    + '</div>';

  watchPresence(_partnerUid, (status) => {
    const dot = document.getElementById('headerDot');
    const txt = document.getElementById('headerStatus');
    if (!dot || !txt) return;
    if (status && status.online) {
      dot.className = 'presence-dot online';
      txt.innerHTML = '<span class="online-label">● Active</span>';
    } else {
      dot.className = 'presence-dot offline';
      txt.textContent = status && status.lastSeen
        ? 'Last seen ' + formatRelativeTime(new Date(status.lastSeen).toISOString())
        : 'Offline';
    }
  });

  setTimeout(() => { const inp = document.getElementById('msgInput'); if (inp) inp.focus(); }, 100);
}

// ═══════════════════════════════════════════════
// REAL-TIME MESSAGES LISTENER
// ═══════════════════════════════════════════════

function _startMessagesListener() {
  if (_messagesUnsub) { _messagesUnsub(); _messagesUnsub = null; }
  if (!_chatId) return;

  const uid = _myUid();
  const chatIdAtStart = _chatId;

  // Safety net: if Firestore never calls back (blocked by an ad-blocker,
  // offline, bad network, silently hung listener, etc.) don't leave the
  // user staring at "Loading messages…" forever.
  setTimeout(() => {
    if (_chatId !== chatIdAtStart) return; // user switched chats already
    const area = document.getElementById('messagesArea');
    if (area && area.textContent.indexOf('Loading messages') !== -1) {
      area.innerHTML = '<div class="empty-chat"><div class="empty-chat-icon">⚠️</div><p>Messages are taking too long to load.<br>Check your internet connection, or that an ad-blocker/extension isn\'t blocking firestore.googleapis.com, then try reopening the conversation.</p></div>';
    }
  }, 8000);

  _messagesUnsub = _fdb()
    .collection('chats').doc(_chatId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot((snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      _renderMessages(msgs, uid);

      // Mark incoming messages as read
      snapshot.docs.forEach((doc) => {
        const m = doc.data();
        if (m.senderId !== uid && !m.read) {
          doc.ref.update({ read: true }).catch(() => {});
        }
      });
    }, (err) => {
      console.error('Messages listener error:', err);
      const area = document.getElementById('messagesArea');
      if (area) {
        const isPerm = err && (err.code === 'permission-denied' || /permission/i.test(err.message || ''));
        area.innerHTML = '<div class="empty-chat"><div class="empty-chat-icon">⚠️</div><p>'
          + (isPerm
              ? 'Could not load messages: permission denied.<br>Your Firestore security rules on the live project may not match this code yet — make sure <code>firestore.rules</code> has been deployed.'
              : 'Could not load messages.<br>' + escHtml(err && err.message ? err.message : 'Unknown error') )
          + '</p></div>';
      }
    });
}

// ── Render messages from Firestore snapshot ───
function _renderMessages(msgs, uid) {
  const area = document.getElementById('messagesArea');
  if (!area) return;

  const wasAtBottom = area.scrollHeight - area.scrollTop - area.clientHeight < 100;

  if (!msgs.length) {
    area.innerHTML = '<div class="empty-chat"><div class="empty-chat-icon">👋</div><p>Say hello! This is the start of your conversation with <strong>' + escHtml((_partnerData && _partnerData.name) || 'them') + '</strong>.</p></div>';
    return;
  }

  let html = '';
  let lastDateStr = '';

  msgs.forEach((m, i) => {
    const isMine  = m.senderId === uid;
    // Handle Firestore Timestamp or plain number
    const ts      = m.createdAt && m.createdAt.toMillis ? m.createdAt.toMillis() : (m.createdAt || 0);
    const dateStr = new Date(ts).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' });
    if (dateStr !== lastDateStr) {
      html += '<div class="date-divider"><span>' + dateStr + '</span></div>';
      lastDateStr = dateStr;
    }
    const timeStr   = new Date(ts).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit', hour12: true });
    const isLastSent = isMine && !msgs.slice(i + 1).some((x) => x.senderId === uid);
    const receipt   = isLastSent
      ? '<div class="read-receipt ' + (m.read ? 'seen' : '') + '">' + (m.read ? '✓✓ Seen' : '✓ Sent') + '</div>'
      : '';
    const hasImg    = !!m.imageUrl;
    const bubbleContent = hasImg
      ? '<img class="msg-img" src="' + escHtml(m.imageUrl) + '" alt="Photo" loading="lazy">' + (m.text ? '<div class="msg-caption">' + escHtml(m.text) + '</div>' : '')
      : escHtml(m.text);
    html += '<div class="msg-row ' + (isMine ? 'mine' : 'theirs') + '"><div class="msg-bubble-wrap"><div class="msg-bubble' + (hasImg ? ' has-image' : '') + '">' + bubbleContent + '</div><div class="msg-time">' + timeStr + '</div>' + receipt + '</div></div>';
  });

  area.innerHTML = html;
  if (wasAtBottom || msgs.length <= 1) area.scrollTop = area.scrollHeight;
}

// ═══════════════════════════════════════════════
// SEND MESSAGE  ← FIXED
// ═══════════════════════════════════════════════

async function sendMessage() {
  const inputEl = document.getElementById('msgInput');
  const text    = (inputEl && inputEl.value.trim()) || '';
  const imageDataUrl = _pendingImage;
  if (!text && !imageDataUrl) return;

  // Guard: must have an open chat
  if (!_chatId || !_partnerUid) {
    console.warn('sendMessage: no active chat (_chatId or _partnerUid missing)');
    return;
  }

  // Guard: resolve uid
  const uid = _myUid();
  if (!uid) {
    console.error('sendMessage: no uid on currentUser', state && state.currentUser);
    if (typeof showToast === 'function') showToast('You must be signed in to send messages.', 'error');
    return;
  }

  // Resolve names/avatars safely
  const myName   = (state.currentUser.displayName || state.currentUser.name || 'Unknown');
  const myAvatar = (state.currentUser.photoURL    || state.currentUser.avatar || null);
  const partnerName   = (_partnerData && _partnerData.name)   || 'Unknown';
  const partnerAvatar = (_partnerData && _partnerData.avatar) || null;

  // Save text/image then clear the input & staged preview
  const saved   = text;
  inputEl.value = '';
  inputEl.style.height = 'auto';
  removePendingImage();

  // Build a short preview for the sidebar's "last message" line
  let previewText;
  if (imageDataUrl) {
    previewText = saved
      ? '📷 ' + (saved.length > 50 ? saved.slice(0, 47) + '…' : saved)
      : '📷 Photo';
  } else {
    previewText = saved.length > 60 ? saved.slice(0, 57) + '…' : saved;
  }

  const now     = firebase.firestore.FieldValue.serverTimestamp();
  const db      = _fdb();
  const chatRef = db.collection('chats').doc(_chatId);
  const msgRef  = chatRef.collection('messages').doc();

  try {
    // ── Step 1: ALWAYS ensure chat doc exists FIRST ──────────────
    // The Firestore rule for messages uses get() on the chat doc to
    // verify isParticipant(). If the chat doc doesn't exist yet, the
    // message write will be denied. We must create/merge the chat doc
    // BEFORE writing any message.
    await chatRef.set({
      participants: [uid, _partnerUid],
      participantNames: {
        [uid]:         myName,
        [_partnerUid]: partnerName,
      },
      participantAvatars: {
        [uid]:         myAvatar,
        [_partnerUid]: partnerAvatar,
      },
      lastMessage: previewText,
      updatedAt:   now,
      // Only set unread keys if they don't exist yet (merge handles this)
      ['unread.' + uid]: 0,
    }, { merge: true });

    // ── Step 2: Now safe to write the message ────────────────────
    const msgData = {
      senderId:  uid,
      text:      saved,
      createdAt: now,
      read:      false,
    };
    if (imageDataUrl) msgData.imageUrl = imageDataUrl;
    await msgRef.set(msgData);

    // ── Step 3: Increment partner's unread count ─────────────────
    await chatRef.update({
      ['unread.' + _partnerUid]: firebase.firestore.FieldValue.increment(1),
    });

  } catch (err) {
    console.error('Send message error:', err);
    if (typeof showToast === 'function') showToast('Failed to send message. Please try again.', 'error');
    // Restore typed text/image so the user doesn't lose it
    if (inputEl) { inputEl.value = saved; autoResize(inputEl); }
    if (imageDataUrl) { _pendingImage = imageDataUrl; _showImagePreview(imageDataUrl); }
  }
}

// ═══════════════════════════════════════════════
// IMAGE ATTACHMENTS  (staged client-side as a
// compressed base64 data URL, same pattern already
// used for trade-post images elsewhere in the app)
// ═══════════════════════════════════════════════

const MAX_IMG_SOURCE_BYTES = 15 * 1024 * 1024; // reject absurdly large picks early
const MAX_IMG_DATAURL_CHARS = 900000;          // keep well under Firestore's 1MiB doc cap

async function handleImageSelect(input) {
  const file = input && input.files && input.files[0];
  input.value = ''; // allow re-selecting the same file later
  if (!file) return;

  if (!file.type || file.type.indexOf('image/') !== 0) {
    if (typeof showToast === 'function') showToast('Please choose an image file.', 'error');
    return;
  }
  if (file.size > MAX_IMG_SOURCE_BYTES) {
    if (typeof showToast === 'function') showToast('That image is too large (max 15MB).', 'error');
    return;
  }

  try {
    const dataUrl = await _compressImageFile(file);
    if (!dataUrl || dataUrl.length > MAX_IMG_DATAURL_CHARS) {
      if (typeof showToast === 'function') showToast('Could not shrink that image enough to send. Try a smaller one.', 'error');
      return;
    }
    _pendingImage = dataUrl;
    _showImagePreview(dataUrl);
  } catch (err) {
    console.error('Image processing error:', err);
    if (typeof showToast === 'function') showToast('Could not process that image.', 'error');
  }
}

// Resize to a reasonable max dimension and compress as JPEG, shrinking
// quality (and, if needed, dimensions again) until it fits comfortably
// inside a single Firestore document.
function _compressImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load image'));
      img.onload = () => {
        try {
          let w = img.width, h = img.height;
          const maxDim = 1280;
          const scaleDown = (factor) => {
            w = Math.round(w * factor);
            h = Math.round(h * factor);
          };
          if (Math.max(w, h) > maxDim) {
            scaleDown(maxDim / Math.max(w, h));
          }

          const canvas = document.createElement('canvas');
          const ctx    = canvas.getContext('2d');
          let dataUrl, attempts = 0;

          do {
            canvas.width  = w;
            canvas.height = h;
            ctx.clearRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            let quality = 0.8;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
            while (dataUrl.length > MAX_IMG_DATAURL_CHARS && quality > 0.35) {
              quality -= 0.1;
              dataUrl = canvas.toDataURL('image/jpeg', quality);
            }
            if (dataUrl.length > MAX_IMG_DATAURL_CHARS) scaleDown(0.75);
            attempts++;
          } while (dataUrl.length > MAX_IMG_DATAURL_CHARS && attempts < 4);

          resolve(dataUrl);
        } catch (err) { reject(err); }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function _showImagePreview(dataUrl) {
  const bar   = document.getElementById('imgPreviewBar');
  const thumb = document.getElementById('imgPreviewThumb');
  if (!bar || !thumb) return;
  thumb.src = dataUrl;
  bar.style.display = 'flex';
}

function removePendingImage() {
  _pendingImage = null;
  const bar = document.getElementById('imgPreviewBar');
  if (bar) bar.style.display = 'none';
  const inputEl = document.getElementById('imgInput');
  if (inputEl) inputEl.value = '';
}

// ── Full-size image lightbox (event-delegated so it survives re-renders) ──
document.addEventListener('click', (e) => {
  if (e.target && e.target.classList && e.target.classList.contains('msg-img')) {
    openImageLightbox(e.target.src);
  }
});

function openImageLightbox(url) {
  let overlay = document.getElementById('imgLightbox');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'imgLightbox';
    overlay.className = 'img-lightbox';
    overlay.addEventListener('click', closeImageLightbox);
    overlay.innerHTML = '<img id="imgLightboxPic" src="" alt="">';
    document.body.appendChild(overlay);
  }
  document.getElementById('imgLightboxPic').src = url;
  overlay.classList.add('open');
}

function closeImageLightbox() {
  const overlay = document.getElementById('imgLightbox');
  if (overlay) overlay.classList.remove('open');
}

// ── Mark messages as read ─────────────────────
async function _markRead(chatId) {
  const uid = _myUid();
  if (!uid) return;
  try {
    await _fdb().collection('chats').doc(chatId).set(
      { unread: { [uid]: 0 } },
      { merge: true }
    );
  } catch (_) {}
}

// ═══════════════════════════════════════════════
// OPEN CHAT WITH A SPECIFIC USER (from profile/browse)
// ═══════════════════════════════════════════════

async function openChatWith(targetUid, targetName, targetAvatar) {
  const uid = _myUid();
  if (!uid) {
    if (typeof showToast === 'function') showToast('Please sign in first.', 'error');
    window.location.href = 'login.html';
    return;
  }
  if (targetUid === uid) {
    if (typeof showToast === 'function') showToast("You can't message yourself!", 'error');
    return;
  }

  const chatId   = buildChatId(uid, targetUid);
  const myName   = (state.currentUser.displayName || state.currentUser.name   || 'Unknown');
  const myAvatar = (state.currentUser.photoURL    || state.currentUser.avatar || null);

  // Pre-create chat document so the sidebar shows up immediately
  try {
    await _fdb().collection('chats').doc(chatId).set({
      participants: [uid, targetUid],
      participantNames: {
        [uid]:       myName,
        [targetUid]: targetName || 'Unknown',
      },
      participantAvatars: {
        [uid]:       myAvatar,
        [targetUid]: targetAvatar || null,
      },
      lastMessage: '',
      updatedAt:   firebase.firestore.FieldValue.serverTimestamp(),
      unread:      { [uid]: 0, [targetUid]: 0 },
    }, { merge: true });
  } catch (e) {
    console.error('openChatWith init error:', e);
  }

  sessionStorage.setItem('gbh_openChat', JSON.stringify({
    chatId, partnerUid: targetUid,
    partnerName: targetName || null, partnerAvatar: targetAvatar || null,
  }));
  window.location.href = 'messages.html';
}

// ═══════════════════════════════════════════════
// UI HELPERS
// ═══════════════════════════════════════════════

function handleKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 130) + 'px';
}

function toggleEmojiPicker(e) {
  e.stopPropagation();
  const ep = document.getElementById('emojiPicker');
  if (ep) ep.classList.toggle('open');
}
document.addEventListener('click', () => {
  const ep = document.getElementById('emojiPicker');
  if (ep) ep.classList.remove('open');
});

function insertEmoji(emoji) {
  const inp = document.getElementById('msgInput');
  if (!inp) return;
  const pos = inp.selectionStart || inp.value.length;
  inp.value = inp.value.slice(0, pos) + emoji + inp.value.slice(pos);
  inp.focus();
  inp.setSelectionRange(pos + emoji.length, pos + emoji.length);
  const ep = document.getElementById('emojiPicker');
  if (ep) ep.classList.remove('open');
}

function closeMobileChat() {
  if (_messagesUnsub) { _messagesUnsub(); _messagesUnsub = null; }
  _chatId = null; _partnerUid = null;
  renderSidebar();
  const sidebar = document.getElementById('chatSidebar');
  const main    = document.getElementById('chatMain');
  if (sidebar) sidebar.classList.remove('mobile-hidden');
  if (main)    main.classList.remove('mobile-open');
  if (main)    main.innerHTML = '<div class="chat-welcome"><div class="welcome-icon">💬</div><h3>Your Messages</h3><p>Select a conversation to start chatting, or visit a user profile and click <strong>"Message"</strong> to connect.</p></div>';
}

function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function formatRelativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)  return 'Just now';
  const m = Math.floor(s / 60);
  if (m < 60)  return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24)  return h + 'h ago';
  const d = Math.floor(h / 24);
  if (d < 7)   return d + 'd ago';
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}

if (typeof formatTime === 'undefined') {
  window.formatTime = formatRelativeTime;
}