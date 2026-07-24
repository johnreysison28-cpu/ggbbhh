// ═══════════════════════════════════════════════
// trades.js — Trade Card Rendering, Modal, Like, Comment, Share, Follow, Sold Status
// ═══════════════════════════════════════════════

/* ── BUILD TRADE CARD HTML ── */
function tradeCardHTML(t, showOwnerControls) {
  const game = GAMES.find(g => g.id === t.game) || { name: t.game, icon: '🎮' };
  const isOwner = showOwnerControls ||
    (state.currentUser && state.currentUser.email === t.userEmail);

  const isSold    = t.status === 'sold';
  const isPending = t.status === 'pending';

  const imgContent = t.img
    ? (t.img.startsWith('data:') || t.img.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
        ? `<img src="${t.img}" style="width:100%;height:100%;object-fit:cover;border-radius:0${isSold ? ';filter:grayscale(0.4) brightness(0.85)' : ''}" alt="">`
        : `<span style="font-size:4rem">${t.img}</span>`)
    : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:var(--bg-card2);color:var(--text-muted);font-size:0.8rem;flex-direction:column;gap:6px"><span style="font-size:2.5rem">🖼️</span><span>No image</span></div>`;

  const statusBadge = isSold
    ? `<div style="position:absolute;top:12px;right:12px;background:rgba(220,38,38,0.9);color:#fff;padding:3px 10px;border-radius:20px;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;backdrop-filter:blur(4px);box-shadow:0 2px 8px rgba(0,0,0,0.3)">🔴 SOLD OUT</div>`
    : isPending
    ? `<div style="position:absolute;top:12px;right:12px;background:rgba(255,193,7,0.92);color:#1a1a1a;padding:3px 10px;border-radius:20px;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;backdrop-filter:blur(4px);box-shadow:0 2px 8px rgba(0,0,0,0.3)">🤝 TRADE PENDING</div>`
    : `<div style="position:absolute;top:12px;right:12px;background:rgba(5,150,105,0.9);color:#fff;padding:3px 10px;border-radius:20px;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;backdrop-filter:blur(4px);box-shadow:0 2px 8px rgba(0,0,0,0.3)">🟢 AVAILABLE</div>`;

  const ownerActions = isOwner ? `
    <div class="owner-controls" onclick="event.stopPropagation()" style="display:flex;gap:6px;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);flex-wrap:wrap">
      <button class="action-btn edit-btn" onclick="openEditModal('${t.id}')" style="flex:1;min-width:60px;background:rgba(0,212,255,0.1);color:var(--accent-cyan);border:1px solid rgba(0,212,255,0.3)">
        ✏️ Edit
      </button>
      <button class="action-btn sold-toggle-btn-${t.id}" onclick="toggleSoldStatus('${t.id}', this, event)" style="flex:1;min-width:100px;background:${isSold ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)'};color:${isSold ? '#10b981' : '#ef4444'};border:1px solid ${isSold ? 'rgba(5,150,105,0.3)' : 'rgba(220,38,38,0.3)'}">
        ${isSold ? '✅ Mark Available' : '🔴 Mark Sold'}
      </button>
      <button class="action-btn delete-btn" onclick="deleteTrade('${t.id}')" style="flex:1;min-width:60px;background:rgba(255,59,59,0.1);color:#ff5555;border:1px solid rgba(255,59,59,0.3)">
        🗑️ Delete
      </button>
    </div>` : '';

  return `
  <div class="trade-card${isSold ? ' trade-sold' : ''}" onclick="openTradeModal('${t.id}')">
    <div class="trade-card-img">
      ${imgContent}
      <div class="trade-card-img-overlay"></div>
      <div class="trade-category-badge">${game.name}</div>
      ${statusBadge}
    </div>
    <div class="trade-card-body">
      <div class="trade-card-user">
        <div class="mini-avatar" onclick="event.stopPropagation();viewUserProfile('${t.userEmail||''}','${escapeHtml(t.user)}')" style="cursor:pointer">${getAvatarEl(t.user, t.userAvatar)}</div>
        <span class="trade-username" onclick="event.stopPropagation();viewUserProfile('${t.userEmail||''}','${escapeHtml(t.user)}')" style="cursor:pointer;text-decoration:none;transition:color 0.2s" onmouseover="this.style.color='var(--accent-cyan)'" onmouseout="this.style.color=''">${t.user}</span>
        <span class="trade-time">${formatTime(t.created_at)}</span>
      </div>
      <div class="trade-title">${t.title}${isSold ? ' <span style="color:#ef4444;font-size:0.68rem;font-weight:700;background:rgba(220,38,38,0.1);padding:1px 6px;border-radius:8px;border:1px solid rgba(220,38,38,0.3)">[SOLD]</span>' : ''}</div>
      <div class="trade-desc">${t.desc}</div>
      ${t.offer ? `<div class="trade-offer"><span>Offer: </span>${t.offer}</div>` : ''}
      <div class="trade-actions" onclick="event.stopPropagation()">
        <button class="action-btn like-btn-${t.id} ${t.likedByMe ? 'liked' : ''}" onclick="toggleLike('${t.id}', this)">
          ${t.likedByMe ? '❤️' : '🤍'} <span class="like-count">${t.likes || 0}</span>
        </button>
        <button class="action-btn" onclick="openTradeModal('${t.id}')">
          💬 ${t.commentCount || 0}
        </button>
        <button class="action-btn" onclick="shareTrade('${t.id}','${escapeHtml(t.title)}',event)" title="Share">
          🔗
        </button>
        ${!isOwner && !isSold && !isPending && state.currentUser ? `<button class="trade-contact" style="background:rgba(0,229,255,0.12);border-color:rgba(0,229,255,0.35);color:var(--accent-cyan)" onclick="quickOffer('${t.id}', event)">🤝 Offer</button>` : ''}
        ${isOwner ? '' : `<button class="trade-contact" onclick="goContact('${t.user}','${t.userEmail||''}','${t.userId||''}','${t.userAvatar||''}')">Contact</button>`}
      </div>
      ${ownerActions}
    </div>
  </div>`;
}

/* ── TOGGLE SOLD STATUS ── */
async function toggleSoldStatus(tradeId, btnEl, event) {
  if (event) event.stopPropagation();
  if (!state.currentUser) { showToast('Sign in first', 'error'); return; }
  if (btnEl) { btnEl.disabled = true; btnEl.textContent = '⏳ Saving...'; }
  try {
    const { status } = await apiPost(`/trades/${tradeId}/sold`);
    const isSold = status === 'sold';
    showToast(isSold ? '🔴 Post marked as Sold Out' : '✅ Post marked as Available');
    // Refresh all trade card views
    if (typeof renderLatestTrades === 'function') renderLatestTrades();
    if (typeof renderBrowseGrid   === 'function') renderBrowseGrid();
    if (typeof renderMyTrades     === 'function') { renderMyTrades(); if (typeof renderProfile === 'function') renderProfile(); }
  } catch (e) {
    showToast(e.message || 'Could not update status.', 'error');
    if (btnEl) { btnEl.disabled = false; }
  }
}

/* ── FORMAT TIMESTAMP ── */
function formatTime(ts) {
  if (!ts) return '';
  const d    = new Date(ts);
  const now  = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)   return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

/* ── DELETE TRADE ── */
async function deleteTrade(id) {
  if (!state.currentUser) return;
  if (!confirm('Delete this trade post? This cannot be undone.')) return;
  try {
    await apiDelete('/trades/' + id);
    state.trades = state.trades.filter(t => t.id !== id);
    showToast('🗑️ Trade deleted.');
    if (typeof renderLatestTrades === 'function') renderLatestTrades();
    if (typeof renderBrowseGrid   === 'function') renderBrowseGrid();
    if (typeof renderMyTrades     === 'function') { renderMyTrades(); if (typeof renderProfile === 'function') renderProfile(); }
  } catch (e) {
    showToast(e.message || 'Could not delete trade.', 'error');
  }
}

/* ── OPEN EDIT MODAL ── */
async function openEditModal(id) {
  let t;
  try {
    t = await apiGet('/trades/' + id);
  } catch (e) {
    showToast('Could not load trade.', 'error'); return;
  }
  if (!state.currentUser || t.userEmail !== state.currentUser.email) return;

  const gameOpts = GAMES.map(g =>
    `<option value="${g.id}" ${g.id === t.game ? 'selected' : ''}>${g.icon} ${g.name}</option>`
  ).join('');

  const imgPreview = t.img
    ? (t.img.startsWith('data:') || t.img.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
        ? `<img id="editImgPreviewEl" src="${t.img}" style="width:100%;max-height:160px;object-fit:cover;border-radius:8px;margin-top:8px" alt="">`
        : `<div id="editImgPreviewEl" style="font-size:3rem;text-align:center;padding:12px;background:var(--bg-card2);border-radius:8px;margin-top:8px">${t.img}</div>`)
    : `<img id="editImgPreviewEl" style="display:none;width:100%;max-height:160px;object-fit:cover;border-radius:8px;margin-top:8px" alt="">`;

  const noImgHint = !t.img
    ? `<div id="editNoImgHint" style="text-align:center;padding:16px;color:var(--text-muted);font-size:0.82rem">📷 No image yet — click to add one</div>`
    : '';

  const removeBtn = t.img
    ? `<button onclick="clearEditImg('${id}')" style="margin-top:6px;background:none;border:none;color:#ff5555;cursor:pointer;font-size:0.8rem">✕ Remove image</button>`
    : '';

  let overlay = document.getElementById('editTradeOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'editTradeOverlay';
    overlay.className = 'modal-overlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeEditTradeModal(); };
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="modal" onclick="event.stopPropagation()">
      <div class="modal-header">
        <div class="modal-title">✏️ Edit Trade Post</div>
        <button class="modal-close" onclick="closeEditTradeModal()">✕</button>
      </div>
      <div style="padding:0 4px">
        <div class="form-group">
          <label class="form-label">Game Category *</label>
          <select class="form-input" id="editPostGame">${gameOpts}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Post Title *</label>
          <input class="form-input" id="editPostTitle" type="text" value="${escapeHtml(t.title)}">
        </div>
        <div class="form-group">
          <label class="form-label">Description *</label>
          <textarea class="form-input" id="editPostDesc" style="min-height:100px">${escapeHtml(t.desc)}</textarea>
        </div>
        <div class="form-group">
          <label class="form-label">Trade Offer / Price</label>
          <input class="form-input" id="editPostOffer" type="text" value="${escapeHtml(t.offer || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Post Image</label>
          <div class="post-img-upload" style="min-height:80px;padding:12px;cursor:pointer" onclick="document.getElementById('editImgInput').click()">
            <input type="file" accept="image/*" id="editImgInput" style="display:none" onchange="previewEditImg(this,'${id}')">
            ${noImgHint}
            ${imgPreview}
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:6px;text-align:center">${t.img ? 'Click to replace image' : ''}</div>
          </div>
          <div id="editImgBtnWrap">${removeBtn}</div>
        </div>
        <div class="error-msg" id="editTradeError"></div>
        <div style="display:flex;gap:12px;margin-top:16px">
          <button class="btn btn-ghost" onclick="closeEditTradeModal()" style="flex:1">Cancel</button>
          <button class="btn btn-primary" onclick="saveEditedTrade('${id}')" style="flex:2;padding:12px">💾 Save Changes</button>
        </div>
      </div>
    </div>`;

  overlay.classList.add('open');
  state._editImgDataURL = t.img || null;
}

function closeEditTradeModal() {
  const ov = document.getElementById('editTradeOverlay');
  if (ov) ov.classList.remove('open');
  state._editImgDataURL = null;
}

function previewEditImg(input, id) {
  if (!input.files[0]) return;
  const r = new FileReader();
  r.onload = e => {
    state._editImgDataURL = e.target.result;
    const el   = document.getElementById('editImgPreviewEl');
    const hint = document.getElementById('editNoImgHint');
    if (hint) hint.style.display = 'none';
    if (el)   { el.src = e.target.result; el.style.display = 'block'; }
    const btnWrap = document.getElementById('editImgBtnWrap');
    if (btnWrap && !btnWrap.querySelector('button')) {
      btnWrap.innerHTML = `<button onclick="clearEditImg('${id}')" style="margin-top:6px;background:none;border:none;color:#ff5555;cursor:pointer;font-size:0.8rem">✕ Remove image</button>`;
    }
  };
  r.readAsDataURL(input.files[0]);
}

function clearEditImg(id) {
  state._editImgDataURL = '';
  const el = document.getElementById('editImgPreviewEl');
  if (el) { el.src = ''; el.style.display = 'none'; }
  const hint = document.getElementById('editNoImgHint');
  if (hint) hint.style.display = 'block';
  const btnWrap = document.getElementById('editImgBtnWrap');
  if (btnWrap) btnWrap.innerHTML = '';
}

async function saveEditedTrade(id) {
  const game  = document.getElementById('editPostGame').value;
  const title = document.getElementById('editPostTitle').value.trim();
  const desc  = document.getElementById('editPostDesc').value.trim();
  const offer = document.getElementById('editPostOffer').value.trim();
  const err   = document.getElementById('editTradeError');

  err.style.display = 'none';
  if (!game)  { showErr(err, 'Please select a game.'); return; }
  if (!title) { showErr(err, 'Title is required.'); return; }
  if (!desc)  { showErr(err, 'Description is required.'); return; }

  const body = { game, title, desc, offer };
  if (state._editImgDataURL !== null) body.img = state._editImgDataURL || '';

  try {
    await apiPut('/trades/' + id, body);
    const idx = state.trades.findIndex(t => t.id === id);
    if (idx !== -1) {
      state.trades[idx] = { ...state.trades[idx], game, title, desc, offer };
      if (state._editImgDataURL !== null) state.trades[idx].img = state._editImgDataURL || null;
    }
    closeEditTradeModal();
    showToast('✅ Trade updated!');
    if (typeof renderLatestTrades === 'function') renderLatestTrades();
    if (typeof renderBrowseGrid   === 'function') renderBrowseGrid();
    if (typeof renderMyTrades     === 'function') { renderMyTrades(); if (typeof renderProfile === 'function') renderProfile(); }
  } catch (e) {
    showErr(err, e.message || 'Could not save changes.');
  }
}

/* ── HTML ESCAPE ── */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── TRADE DETAIL MODAL ── */
async function openTradeModal(id) {
  let t;
  try {
    t = await apiGet('/trades/' + id);
  } catch (e) {
    showToast('Could not load trade.', 'error'); return;
  }

  const game = GAMES.find(g => g.id === t.game) || { name: t.game, icon: '🎮' };
  const isSold = t.status === 'sold';

  const imgBlock = t.img
    ? (t.img.startsWith('data:') || t.img.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)
        ? `<img src="${t.img}" style="width:100%;height:200px;object-fit:cover;border-radius:8px;margin-bottom:16px${isSold ? ';filter:grayscale(0.3)' : ''}" alt="">`
        : `<div style="font-size:5rem;text-align:center;padding:20px;background:var(--bg-card2);border-radius:8px;margin-bottom:16px">${t.img}</div>`)
    : '';

  const isOwner   = state.currentUser && state.currentUser.email === t.userEmail;
  const isPending = t.status === 'pending';

  const statusBadgeModal = isSold
    ? `<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(220,38,38,0.15);color:#ef4444;border:1px solid rgba(220,38,38,0.4);padding:5px 14px;border-radius:20px;font-size:0.78rem;font-weight:700;margin-bottom:14px">🔴 SOLD OUT — This account has been sold</div>`
    : isPending
    ? `<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,193,7,0.15);color:#ffc107;border:1px solid rgba(255,193,7,0.4);padding:5px 14px;border-radius:20px;font-size:0.78rem;font-weight:700;margin-bottom:14px">🤝 TRADE PENDING — An offer has been accepted</div>`
    : `<div style="display:inline-flex;align-items:center;gap:6px;background:rgba(5,150,105,0.15);color:#10b981;border:1px solid rgba(5,150,105,0.4);padding:5px 14px;border-radius:20px;font-size:0.78rem;font-weight:700;margin-bottom:14px">🟢 AVAILABLE — Still up for trade</div>`;

  const ownerModalControls = isOwner ? `
    <div style="display:flex;gap:10px;margin-bottom:16px;flex-wrap:wrap">
      <button class="btn btn-ghost" style="flex:1;font-size:0.82rem;padding:8px" onclick="closeModal();openEditModal('${t.id}')">
        ✏️ Edit Post
      </button>
      <button onclick="closeModal();toggleSoldStatus('${t.id}', null, null)" style="flex:1;font-size:0.82rem;padding:8px;background:${isSold ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)'};color:${isSold ? '#10b981' : '#ef4444'};border:1px solid ${isSold ? 'rgba(5,150,105,0.3)' : 'rgba(220,38,38,0.3)'};border-radius:var(--radius);cursor:pointer;font-family:inherit">
        ${isSold ? '✅ Mark as Available' : '🔴 Mark as Sold'}
      </button>
      <button onclick="closeModal();deleteTrade('${t.id}')" style="flex:1;font-size:0.82rem;padding:8px;background:rgba(255,59,59,0.1);color:#ff5555;border:1px solid rgba(255,59,59,0.35);border-radius:var(--radius);cursor:pointer;font-family:inherit">
        🗑️ Delete Post
      </button>
    </div>
    <button onclick="closeModal();window.location.href='offers.html'" style="width:100%;margin-bottom:16px;font-size:0.82rem;padding:9px;background:rgba(0,229,255,0.1);color:var(--accent-cyan);border:1px solid rgba(0,229,255,0.3);border-radius:var(--radius);cursor:pointer;font-family:inherit">
      🤝 View Trade Offers on this Post
    </button>` : '';

  const commentForm = state.currentUser
    ? `<div style="display:flex;gap:10px;align-items:flex-start;margin-top:12px;padding:12px;background:var(--bg-card2);border-radius:12px">
         <div class="mini-avatar" style="width:32px;height:32px;font-size:0.78rem;flex-shrink:0">${getAvatarEl(state.currentUser.name, state.currentUser.avatar)}</div>
         <div style="flex:1;position:relative">
           <textarea class="form-input" id="commentInput" placeholder="Write a comment... (Ctrl+Enter to send)"
             style="min-height:52px;border-radius:10px;flex:1;padding-right:80px;resize:none" onkeydown="handleCommentKey(event,'${t.id}')"></textarea>
           <button class="btn btn-primary" style="position:absolute;right:8px;bottom:8px;padding:6px 14px;font-size:0.78rem;border-radius:8px"
             onclick="addComment('${t.id}')">Post</button>
         </div>
       </div>`
    : `<p style="font-size:0.82rem;color:var(--text-muted);margin-top:8px">
         <a href="login.html" style="color:var(--accent-cyan)">Sign in</a> to comment.
       </p>`;

  document.getElementById('modalTitle').textContent = t.title;
  document.getElementById('modalBody').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:14px">
      <div class="tag tag-cyan">${game.icon} ${game.name}</div>
      ${statusBadgeModal}
    </div>
    ${imgBlock}
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
      <div class="mini-avatar" style="width:34px;height:34px;font-size:0.85rem;cursor:pointer" onclick="closeModal();viewUserProfile('${t.userEmail||''}','${t.user}')">${getAvatarEl(t.user, t.userAvatar)}</div>
      <div>
        <div style="font-size:0.88rem;font-weight:600;cursor:pointer;transition:color 0.2s" onmouseover="this.style.color='var(--accent-cyan)'" onmouseout="this.style.color=''" onclick="closeModal();viewUserProfile('${t.userEmail||''}','${t.user}')">${t.user}</div>
        <div style="font-size:0.72rem;color:var(--text-muted)">${formatTime(t.created_at)}</div>
      </div>
      ${!isOwner && state.currentUser ? `
        <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
          ${!isSold && !isPending ? `<button class="btn btn-primary" style="font-size:0.82rem;padding:8px 14px" onclick="toggleOfferForm('${t.id}')">🤝 Make Trade Offer</button>` : ''}
          <button class="trade-contact" onclick="goContact('${t.user}','${t.userEmail||''}','${t.userId||''}','${t.userAvatar||''}');closeModal()">Contact Trader</button>
        </div>` : ''}
    </div>
    <p style="font-size:0.88rem;color:var(--text-secondary);line-height:1.7;margin-bottom:14px">${t.desc}</p>
    ${t.offer ? `<div class="trade-offer" style="margin-bottom:18px"><span>Looking for: </span>${t.offer}</div>` : ''}
    <div id="offerFormArea" data-open="0"></div>
    <div class="divider"></div>
    ${ownerModalControls}
    <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap;border-bottom:1px solid var(--border);padding-bottom:14px">
      <button class="action-btn modal-like-btn ${t.likedByMe ? 'liked' : ''}" style="font-size:0.88rem"
        onclick="toggleLikeInModal('${t.id}', this)">
        ${t.likedByMe ? '❤️' : '🤍'} <span class="like-count">${t.likes || 0}</span> Likes
      </button>
      <span style="color:var(--text-muted);font-size:0.85rem;display:flex;align-items:center;gap:4px">💬 <span id="modalCommentCount">${(t.comments||[]).length}</span> Comments</span>
      <button class="action-btn" style="font-size:0.88rem;margin-left:auto" onclick="shareTrade('${t.id}','${escapeHtml(t.title)}',event)">🔗 Share</button>
    </div>
    <div class="comments-list" id="modalCommentsList">${renderComments(t.comments || [], t.id)}</div>
    ${commentForm}
  `;

  document.getElementById('modalOverlay').classList.add('open');
}

/* ── RENDER COMMENTS (Facebook-style) ── */
function renderComments(comments, tradeId) {
  if (!comments || !comments.length)
    return `<p style="font-size:0.82rem;color:var(--text-muted);padding:12px 0">No comments yet. Be the first!</p>`;

  return comments.map((c, idx) => {
    const repliesHtml = (c.replies || []).map(r => `
      <div style="display:flex;gap:8px;margin-top:8px;padding-left:4px">
        <div class="mini-avatar" style="width:26px;height:26px;font-size:0.7rem;flex-shrink:0">${getAvatarEl(r.user, r.userAvatar)}</div>
        <div style="flex:1">
          <div style="background:var(--bg-card2);border-radius:12px;padding:8px 12px">
            <div style="font-weight:600;font-size:0.78rem;color:var(--text-primary)">${r.user}</div>
            <div style="font-size:0.82rem;color:var(--text-secondary);margin-top:2px">${escapeHtml(r.text)}</div>
          </div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-top:3px;padding-left:8px">${formatTime(r.time)}</div>
        </div>
      </div>`).join('');

    const replyFormId = `replyForm_${tradeId}_${idx}`;
    const replyForm = state.currentUser ? `
      <div id="${replyFormId}" style="display:none;gap:8px;align-items:flex-start;margin-top:8px;padding-left:4px">
        <div class="mini-avatar" style="width:26px;height:26px;font-size:0.7rem;flex-shrink:0">${getAvatarEl(state.currentUser.name, state.currentUser.avatar)}</div>
        <div style="flex:1;position:relative">
          <textarea class="form-input" id="replyInput_${tradeId}_${idx}" placeholder="Write a reply..." style="min-height:44px;font-size:0.8rem;border-radius:10px;flex:1;padding-right:70px;resize:none"></textarea>
          <button class="btn btn-primary" style="position:absolute;right:6px;bottom:6px;font-size:0.72rem;padding:4px 10px;border-radius:6px" onclick="addReply('${tradeId}','${idx}','${c.id}')">Reply</button>
        </div>
      </div>` : '';

    const commentLikes = c.likes || 0;
    const commentLikedByMe = c.likedByMe || false;

    return `
    <div style="display:flex;gap:10px;margin-bottom:14px">
      <div class="mini-avatar" style="width:32px;height:32px;font-size:0.8rem;flex-shrink:0">${getAvatarEl(c.user, c.userAvatar)}</div>
      <div style="flex:1">
        <div style="background:var(--bg-card2);border-radius:14px;padding:10px 14px">
          <div style="font-weight:600;font-size:0.82rem;color:var(--text-primary);margin-bottom:3px">${c.user}</div>
          <div style="font-size:0.85rem;color:var(--text-secondary);line-height:1.5">${escapeHtml(c.text)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;margin-top:4px;padding-left:8px">
          <span style="font-size:0.7rem;color:var(--text-muted)">${formatTime(c.time)}</span>
          ${state.currentUser ? `<button onclick="toggleCommentLike('${tradeId}','${c.id}',this)" style="background:none;border:none;font-size:0.72rem;cursor:pointer;color:${commentLikedByMe ? '#ff4d6d' : 'var(--text-muted)'};font-weight:600;padding:2px 4px;border-radius:4px;transition:all 0.2s" class="comment-like-btn-${c.id}">
            ${commentLikedByMe ? '❤️' : '🤍'} <span class="clikes-${c.id}">${commentLikes > 0 ? commentLikes : ''}</span> Like
          </button>` : ''}
          ${state.currentUser ? `<button onclick="toggleReplyForm('${replyFormId}')" style="background:none;border:none;font-size:0.72rem;cursor:pointer;color:var(--text-muted);font-weight:600;padding:2px 4px;border-radius:4px;transition:all 0.2s;font-family:inherit">↩ Reply${c.replies && c.replies.length ? ` (${c.replies.length})` : ''}</button>` : ''}
        </div>
        ${repliesHtml ? `<div style="margin-top:4px">${repliesHtml}</div>` : ''}
        ${replyForm}
      </div>
    </div>`;
  }).join('');
}

/* ── TOGGLE COMMENT LIKE ── */
async function toggleCommentLike(tradeId, commentId, btnEl) {
  if (!state.currentUser) { showToast('Sign in to like comments', 'error'); return; }
  const wasLiked = btnEl.style.color === 'rgb(255, 77, 109)' || btnEl.style.color.includes('255, 77');
  btnEl.disabled = true;
  try {
    const { liked, likes } = await apiPost(`/trades/${tradeId}/comments/${commentId}/like`);
    btnEl.style.color = liked ? '#ff4d6d' : 'var(--text-muted)';
    btnEl.innerHTML = `${liked ? '❤️' : '🤍'} <span class="clikes-${commentId}">${likes > 0 ? likes : ''}</span> Like`;
  } catch (e) {
    showToast('Could not like comment', 'error');
  } finally {
    btnEl.disabled = false;
  }
}

/* ── HANDLE COMMENT KEY (Ctrl/Cmd+Enter to submit) ── */
function handleCommentKey(e, tradeId) {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    addComment(tradeId);
  }
}

/* ── TOGGLE REPLY FORM ── */
function toggleReplyForm(id) {
  const form = document.getElementById(id);
  if (!form) return;
  form.style.display = form.style.display === 'none' ? 'flex' : 'none';
  if (form.style.display === 'flex') form.querySelector('textarea')?.focus();
}

/* ── ADD REPLY ── */
async function addReply(tradeId, commentIdx, commentId) {
  if (!state.currentUser) return;
  const input = document.getElementById(`replyInput_${tradeId}_${commentIdx}`);
  const text  = input?.value.trim();
  if (!text) return;

  const btn = input?.nextElementSibling;
  if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }

  try {
    await apiPost(`/trades/${tradeId}/comments/${commentId}/replies`, { text });
    await refreshModalComments(tradeId);
  } catch (e) {
    showToast(e.message || 'Could not send reply.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Reply'; }
  }
}

/* ── ADD COMMENT ── */
async function addComment(tradeId) {
  if (!state.currentUser) return;
  const input = document.getElementById('commentInput');
  const text = input?.value.trim();
  if (!text) return;

  const btn = input?.parentElement?.querySelector('button');
  if (btn) { btn.disabled = true; btn.textContent = 'Posting...'; }
  if (input) input.disabled = true;

  try {
    await apiPost(`/trades/${tradeId}/comments`, { text });
    if (input) { input.value = ''; input.disabled = false; }
    if (btn) { btn.disabled = false; btn.textContent = 'Post'; }
    await refreshModalComments(tradeId);
    const t = state.trades.find(tr => tr.id === tradeId);
    if (t) t.commentCount = (t.commentCount || 0) + 1;
  } catch (e) {
    showToast(e.message || 'Could not post comment.', 'error');
    if (input) input.disabled = false;
    if (btn) { btn.disabled = false; btn.textContent = 'Post'; }
  }
}

/* ── REFRESH COMMENTS IN-PLACE ── */
async function refreshModalComments(tradeId) {
  try {
    const t = await apiGet('/trades/' + tradeId);
    const list = document.getElementById('modalCommentsList');
    const countEl = document.getElementById('modalCommentCount');
    if (list) list.innerHTML = renderComments(t.comments || [], tradeId);
    if (countEl) countEl.textContent = (t.comments || []).length;
    if (list) list.scrollTop = list.scrollHeight;
  } catch (e) { /* silent */ }
}

/* ── TOGGLE LIKE ── */
async function toggleLike(id, btnEl) {
  if (!state.currentUser) { showToast('Sign in to like posts', 'error'); return; }
  const t = state.trades.find(tr => tr.id === id);
  const wasLiked = t ? t.likedByMe : false;
  const prevLikes = t ? (t.likes || 0) : 0;
  const newLiked = !wasLiked;
  const newLikes = newLiked ? prevLikes + 1 : Math.max(0, prevLikes - 1);

  if (btnEl) {
    btnEl.innerHTML = `${newLiked ? '❤️' : '🤍'} <span class="like-count">${newLikes}</span>`;
    btnEl.classList.toggle('liked', newLiked);
    btnEl.disabled = true;
  }

  try {
    const { liked, likes } = await apiPost(`/trades/${id}/like`);
    if (t) { t.likedByMe = liked; t.likes = likes; }
    if (btnEl) {
      btnEl.innerHTML = `${liked ? '❤️' : '🤍'} <span class="like-count">${likes}</span>`;
      btnEl.classList.toggle('liked', liked);
    }
    const modalLikeBtn = document.querySelector('.modal-like-btn');
    if (modalLikeBtn) {
      modalLikeBtn.innerHTML = `${liked ? '❤️' : '🤍'} <span class="like-count">${likes}</span> Likes`;
      modalLikeBtn.classList.toggle('liked', liked);
    }
  } catch (e) {
    if (btnEl) {
      btnEl.innerHTML = `${wasLiked ? '❤️' : '🤍'} <span class="like-count">${prevLikes}</span>`;
      btnEl.classList.toggle('liked', wasLiked);
    }
    showToast(e.message || 'Could not update like.', 'error');
  } finally {
    if (btnEl) btnEl.disabled = false;
  }
}

/* ── SHARE TRADE ── */
function shareTrade(id, title, event) {
  if (event) event.stopPropagation();
  const url = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}browse.html?trade=${id}`;
  const text = `Check out this trade: "${title}" on GameBarterHub`;

  if (navigator.share) {
    navigator.share({ title, text, url }).catch(() => {});
    return;
  }
  navigator.clipboard.writeText(url).then(() => {
    showToast('🔗 Link copied to clipboard!');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = url;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('🔗 Link copied to clipboard!');
  });
}

/* ── CONTACT HELPER ── */
async function goContact(username, userEmail, targetUid, targetAvatar) {
  if (!state.currentUser) {
    showToast('Sign in to contact traders', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 800);
    return;
  }
  if (userEmail && userEmail === state.currentUser.email) {
    showToast("You can't message yourself!", 'error');
    return;
  }

  // If UID was passed directly, use it
  if (targetUid) {
    openChatWith(targetUid, username, targetAvatar || null);
    return;
  }

  // Fallback: look up UID by email (older call sites)
  try {
    showToast('Opening chat…');
    const snap = await firebase.firestore()
      .collection('users')
      .where('email', '==', userEmail)
      .limit(1)
      .get();
    if (snap.empty) throw new Error('User not found');
    const uid    = snap.docs[0].id;
    const data   = snap.docs[0].data();
    const avatar = data.avatar || data.photoURL || null;
    openChatWith(uid, username, avatar);
  } catch (e) {
    showToast(e.message || 'Could not open chat.', 'error');
  }
}

/* ── TOGGLE LIKE IN MODAL ── */
async function toggleLikeInModal(id, btnEl) {
  if (!state.currentUser) { showToast('Sign in to like posts', 'error'); return; }
  const t = state.trades.find(tr => tr.id === id);
  const wasLiked = t ? t.likedByMe : btnEl.classList.contains('liked');
  const prevCount = parseInt(btnEl.querySelector('.like-count')?.textContent || '0');
  const newLiked = !wasLiked;
  const newCount = newLiked ? prevCount + 1 : Math.max(0, prevCount - 1);

  btnEl.innerHTML = `${newLiked ? '❤️' : '🤍'} <span class="like-count">${newCount}</span> Likes`;
  btnEl.classList.toggle('liked', newLiked);
  btnEl.disabled = true;

  try {
    const { liked, likes } = await apiPost(`/trades/${id}/like`);
    if (t) { t.likedByMe = liked; t.likes = likes; }
    btnEl.innerHTML = `${liked ? '❤️' : '🤍'} <span class="like-count">${likes}</span> Likes`;
    btnEl.classList.toggle('liked', liked);
    document.querySelectorAll(`.like-btn-${id}`).forEach(btn => {
      btn.innerHTML = `${liked ? '❤️' : '🤍'} <span class="like-count">${likes}</span>`;
      btn.classList.toggle('liked', liked);
    });
  } catch (e) {
    btnEl.innerHTML = `${wasLiked ? '❤️' : '🤍'} <span class="like-count">${prevCount}</span> Likes`;
    btnEl.classList.toggle('liked', wasLiked);
    showToast(e.message || 'Could not update like.', 'error');
  } finally {
    btnEl.disabled = false;
  }
}

/* ── FOLLOW / UNFOLLOW ── */
async function toggleFollow(targetUid, btnEl) {
  if (!state.currentUser) {
    showToast('Sign in to follow users', 'error');
    setTimeout(() => { window.location.href = 'login.html'; }, 800);
    return;
  }
  const isFollowing = btnEl.dataset.following === 'true';
  btnEl.disabled = true;
  btnEl.textContent = isFollowing ? 'Unfollowing...' : 'Following...';

  try {
    const { following, followersCount } = await apiPost(`/follow/${targetUid}`);
    btnEl.dataset.following = following ? 'true' : 'false';
    btnEl.textContent = following ? '✔ Following' : '➕ Follow';
    btnEl.style.background = following ? 'rgba(0,229,255,0.15)' : 'var(--accent-cyan)';
    btnEl.style.color = following ? 'var(--accent-cyan)' : '#000';
    btnEl.style.border = following ? '1px solid var(--accent-cyan)' : 'none';
    // Update follower count display
    const fcEl = document.getElementById('followerCountDisplay');
    if (fcEl) fcEl.textContent = followersCount;
    showToast(following ? '✔ Now following!' : 'Unfollowed');
  } catch (e) {
    showToast(e.message || 'Could not update follow.', 'error');
    btnEl.textContent = isFollowing ? '✔ Following' : '➕ Follow';
  } finally {
    btnEl.disabled = false;
  }
}
