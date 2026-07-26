// ═══════════════════════════════════════════════
// data.js — App State & Firebase helpers
// ═══════════════════════════════════════════════

// NOTE: This file is loaded as a regular <script> (not ESM) so it uses
// the Firebase compat libraries loaded via CDN <script> tags in each HTML.
// The compat API mirrors the original modular API but works globally.

// Firebase is initialized via the compat CDN scripts in each HTML file.
// No ESM imports needed here.




// ── Game list ─────────────────────────────────
const GAMES = [
  { id: 'ml',   name: 'Mobile Legends',    icon: '⚔️'  },
  { id: 'rb',   name: 'Roblox',            icon: '🟥'  },
  { id: 'val',  name: 'Valorant',          icon: '🎯'  },
  { id: 'gi',   name: 'Genshin Impact',    icon: '✨'  },
  { id: 'codm', name: 'COD Mobile',        icon: '🔫'  },
  { id: 'pubg', name: 'PUBG Mobile',       icon: '🪖'  },
  { id: 'fn',   name: 'Fortnite',          icon: '🏗️'  },
  { id: 'mc',   name: 'Minecraft',         icon: '⛏️'  },
  { id: 'lol',  name: 'League of Legends', icon: '🏆'  },
  { id: 'gta',  name: 'GTA Online',        icon: '🚗'  },
  { id: 'fifa', name: 'EA FC / FIFA',      icon: '⚽'  },
  { id: 'cs2',  name: 'Counter-Strike 2',  icon: '💣'  },
  { id: 'apex', name: 'Apex Legends',      icon: '🪂'  },
  { id: 'ff',   name: 'Free Fire',         icon: '🔥'  },
  { id: 'clash',name: 'Clash of Clans',    icon: '🏰'  },
  { id: 'brawl',name: 'Brawl Stars',       icon: '⭐'  },
  { id: 'dota', name: 'Dota 2',            icon: '🛡️'  },
  { id: 'wr',   name: 'Wild Rift',         icon: '🌀'  },
  { id: 'ow',   name: 'Overwatch 2',       icon: '🦸'  },
  { id: 'sims', name: 'The Sims',          icon: '🏠'  },
];

// ── Global State ──────────────────────────────
const state = {
  currentUser:    null,   // { id/uid, name, email, location, avatar }
  trades:         [],
  notifications:  [],
  currentFilter:  'all',
  avatarDataURL:  null,
  postImgDataURL: null,
  _editImgDataURL: null,
};

// ── Firebase shortcuts (set after SDK loads) ──
let _auth, _db;

function _fbInit() {
  _auth = firebase.auth();
  _db   = firebase.firestore();
}

// ── Session restore via Firebase Auth ─────────
function restoreSession() {
  _fbInit();
  return new Promise((resolve) => {
    const unsubscribe = _auth.onAuthStateChanged(async (fbUser) => {
      unsubscribe(); // Only fire once for initial state
      if (fbUser) {
        const snap = await _db.collection('users').doc(fbUser.uid).get();
        if (snap.exists) {
          state.currentUser = { id: fbUser.uid, uid: fbUser.uid, ...snap.data() };
          try {
            const contactSnap = await _db.collection('users').doc(fbUser.uid)
              .collection('private').doc('contact').get();
            if (contactSnap.exists) Object.assign(state.currentUser, contactSnap.data());
          } catch (e) { /* older accounts may not have this subdoc yet */ }
        } else {
          state.currentUser = {
            id:    fbUser.uid, uid: fbUser.uid,
            name:  fbUser.displayName || 'User',
            email: fbUser.email,
            avatar: null, location: null,
          };
        }
        startNotifListener();
        if (typeof startOfferBadgeListener === 'function') startOfferBadgeListener();
      } else {
        stopNotifListener();
        if (typeof stopOfferBadgeListener === 'function') stopOfferBadgeListener();
        state.currentUser = null;
      }
      if (typeof updateNavUser === 'function') updateNavUser();
      resolve(state.currentUser);
    });
  });
}

// ── Load Trades ───────────────────────────────
async function loadTrades(gameFilter) {
  _fbInit();
  let q = _db.collection('trades').orderBy('createdAt', 'desc');
  if (gameFilter && gameFilter !== 'all') {
    q = _db.collection('trades')
           .where('game', '==', gameFilter)
           .orderBy('createdAt', 'desc');
  }
  const snap = await q.get();
  const uid = state.currentUser ? state.currentUser.uid : null;

  state.trades = snap.docs.map(d => {
    const data = d.data();
    const gameObj = GAMES.find(g => g.id === data.game) || { name: data.game, icon: '🎮' };
    return {
      id:           d.id,
      game:         data.game,
      gameName:     gameObj.name,
      gameIcon:     gameObj.icon,
      title:        data.title,
      desc:         data.desc,
      offer:        data.offer || '',
      img:          data.img || null,
      likes:        data.likes || 0,
      likedByMe:    uid ? (data.likedBy || []).includes(uid) : false,
      commentCount: data.commentCount || 0,
      user:         data.userName,
      userEmail:    data.userEmail,
      userAvatar:   data.userAvatar || null,
      userId:       data.userId,
      created_at:   data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
      status:       data.status || 'available',
    };
  });
  return state.trades;
}

// ── Real-time Notification Listener ──────────
let _notifUnsubscribe = null;

function startNotifListener() {
  if (!state.currentUser) return;
  if (_notifUnsubscribe) _notifUnsubscribe(); // Detach old listener
  _fbInit();
  _notifUnsubscribe = _db.collection('notifications')
    .where('userId', '==', state.currentUser.uid)
    .orderBy('createdAt', 'desc')
    .limit(30)
    .onSnapshot(snap => {
      state.notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (typeof updateNotifBadge === 'function') updateNotifBadge();
      if (typeof renderNotifList === 'function') {
        const panel = document.getElementById('notifPanel');
        if (panel && panel.classList.contains('notif-panel-open')) renderNotifList();
      }
    }, () => {});
}

function stopNotifListener() {
  if (_notifUnsubscribe) { _notifUnsubscribe(); _notifUnsubscribe = null; }
}

// ── Load Notifications ────────────────────────
async function loadNotifications() {
  if (!state.currentUser) return;
  _fbInit();
  const snap = await _db.collection('notifications')
    .where('userId', '==', state.currentUser.uid)
    .orderBy('createdAt', 'desc')
    .limit(30)
    .get();
  state.notifications = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (typeof updateNotifBadge === 'function') updateNotifBadge();
}

function unreadNotifCount() {
  return state.notifications.filter(n => !n.is_read).length;
}

// ── Admin check ────────────────────────────────
// A user is an admin if a doc with their uid exists in /admins.
// (Admins are added manually via the Firebase Console — see README.)
async function isCurrentUserAdmin() {
  if (!state.currentUser) return false;
  _fbInit();
  try {
    const uid = state.currentUser.uid || state.currentUser.id;
    const snap = await _db.collection('admins').doc(uid).get();
    return snap.exists;
  } catch (_) {
    return false;
  }
}

// ═══════════════════════════════════════════════
// PRESENCE  (Firebase Realtime Database)
// Tracks which users are currently online, site-wide.
// ═══════════════════════════════════════════════
let _presenceInited = false;

function initPresence(uid) {
  if (!uid || _presenceInited) return; // avoid attaching duplicate listeners
  _presenceInited = true;

  const presRef = firebase.database().ref('presence/' + uid);
  const connRef = firebase.database().ref('.info/connected');

  connRef.on('value', (snap) => {
    if (!snap.val()) return;
    presRef.onDisconnect().set({ online: false, lastSeen: firebase.database.ServerValue.TIMESTAMP });
    presRef.set({ online: true, lastSeen: firebase.database.ServerValue.TIMESTAMP });
  });

  window.addEventListener('beforeunload', () => {
    presRef.set({ online: false, lastSeen: firebase.database.ServerValue.TIMESTAMP });
  });
}

function setPresenceOffline(uid) {
  if (!uid) return;
  firebase.database().ref('presence/' + uid)
    .set({ online: false, lastSeen: firebase.database.ServerValue.TIMESTAMP })
    .catch(() => {});
}

function watchPresence(uid, callback) {
  const ref = firebase.database().ref('presence/' + uid);
  const handler = (snap) => {
    const val = snap.val();
    callback(val || { online: false, lastSeen: null });
  };
  ref.on('value', handler);
  return () => ref.off('value', handler);
}

// One-time read of how many users are currently online
async function getActiveTradersCount() {
  try {
    const snap = await firebase.database().ref('presence').once('value');
    let count = 0;
    snap.forEach(child => { if (child.val() && child.val().online) count++; });
    return count;
  } catch (e) {
    return null; // e.g. permission denied / offline
  }
}

// Live-updating count of online users. Returns an unsubscribe fn.
function watchActiveTradersCount(callback) {
  const ref = firebase.database().ref('presence');
  const handler = (snap) => {
    let count = 0;
    snap.forEach(child => { if (child.val() && child.val().online) count++; });
    callback(count);
  };
  ref.on('value', handler, () => callback(null)); // null on permission error
  return () => ref.off('value', handler);
}

// ── Conversation helpers ──────────────────────
async function getOrCreateConvo(partnerEmail) {
  _fbInit();
  // Find partner
  const pSnap = await _db.collection('users').where('email', '==', partnerEmail).get();
  if (pSnap.empty) throw new Error('User not found');
  const partnerDoc = pSnap.docs[0];
  const partnerId = partnerDoc.id;
  const myId = state.currentUser.uid;

  if (partnerId === myId) throw new Error("Can't message yourself");

  // Deterministic convo ID
  const [a, b] = [myId, partnerId].sort();
  const convoId = a + '_' + b;
  const convoRef = _db.collection('conversations').doc(convoId);
  const convoSnap = await convoRef.get();
  if (!convoSnap.exists) {
    await convoRef.set({
      userIds: [myId, partnerId],
      users: {
        [myId]:      { name: state.currentUser.name,  email: state.currentUser.email,  avatar: state.currentUser.avatar  || null },
        [partnerId]: { name: partnerDoc.data().name,   email: partnerDoc.data().email,   avatar: partnerDoc.data().avatar   || null },
      },
      lastMessage: null,
      lastAt:      firebase.firestore.FieldValue.serverTimestamp(),
      unread:      { [myId]: 0, [partnerId]: 0 },
    });
  }
  return { convoId };
}

// ── Stubs for backward compat ─────────────────
function pushNotification() {}
function save() {}

// ── Fake apiGet/apiPost/apiPut/apiDelete wrappers ─
// These are thin adapters used by trades.js, auth.js, etc.
// They delegate to Firebase instead of the old REST backend.

async function apiGet(path) {
  _fbInit();

  // ── /auth/me ──
  if (path === '/auth/me') {
    return { user: state.currentUser };
  }

  // ── /trades or /trades?game=x ──
  if (path === '/trades' || path.startsWith('/trades?')) {
    const game = path.includes('?game=') ? path.split('?game=')[1] : null;
    return loadTrades(game);
  }

  // ── /trades/user/:email — trades by a specific user ──
  if (path.startsWith('/trades/user/')) {
    const email = decodeURIComponent(path.replace('/trades/user/', ''));
    const snap = await _db.collection('trades')
      .where('userEmail', '==', email)
      .orderBy('createdAt', 'desc')
      .get();
    const uid = state.currentUser ? state.currentUser.uid : null;
    return snap.docs.map(d => {
      const data = d.data();
      const gameObj = GAMES.find(g => g.id === data.game) || { name: data.game, icon: '🎮' };
      return {
        id: d.id, game: data.game, gameName: gameObj.name,
        title: data.title, desc: data.desc, offer: data.offer || '',
        img: data.img || null, likes: data.likes || 0,
        likedByMe: uid ? (data.likedBy || []).includes(uid) : false,
        commentCount: data.commentCount || 0,
        user: data.userName, userEmail: data.userEmail, userAvatar: data.userAvatar || null,
        userId: data.userId,
        created_at: data.createdAt ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
        status: data.status || 'available',
      };
    });
  }

  // ── /trades/:id — single trade ──
  if (path.startsWith('/trades/')) {
    const id = path.replace('/trades/', '');
    const snap = await _db.collection('trades').doc(id).get();
    if (!snap.exists) throw new Error('Trade not found');
    const data = snap.data();
    const gameObj = GAMES.find(g => g.id === data.game) || { name: data.game, icon: '🎮' };
    const uid = state.currentUser ? state.currentUser.uid : null;
    // Load comments
    const cSnap = await _db.collection('trades').doc(id).collection('comments')
                            .orderBy('createdAt', 'asc').get();
    const comments = await Promise.all(cSnap.docs.map(async c => {
      const rSnap = await _db.collection('trades').doc(id)
        .collection('comments').doc(c.id).collection('replies')
        .orderBy('createdAt', 'asc').get();
      const replies = rSnap.docs.map(r => ({
        id: r.id, text: r.data().text, user: r.data().userName,
        userEmail: r.data().userEmail,
        time: r.data().createdAt ? r.data().createdAt.toDate().toISOString() : new Date().toISOString(),
      }));
      return {
        id: c.id, text: c.data().text, user: c.data().userName,
        userEmail: c.data().userEmail, userAvatar: c.data().userAvatar,
        time: c.data().createdAt ? c.data().createdAt.toDate().toISOString() : new Date().toISOString(),
        likes: c.data().likes || 0,
        likedByMe: uid ? (c.data().likedBy || []).includes(uid) : false,
        replies,
      };
    }));
    return {
      id: snap.id, game: data.game, gameName: gameObj.name,
      title: data.title, desc: data.desc, offer: data.offer || '',
      img: data.img || null, likes: data.likes || 0,
      likedByMe: uid ? (data.likedBy || []).includes(uid) : false,
      user: data.userName, userEmail: data.userEmail, userAvatar: data.userAvatar || null,
      userId: data.userId,
      created_at: data.createdAt ? data.createdAt.toDate().toISOString() : '',
      status: data.status || 'available',
      comments,
    };
  }

  // ── /notifications ──
  if (path === '/notifications') {
    await loadNotifications();
    return state.notifications;
  }

  // ── /messages — list conversations ──
  if (path === '/messages') {
    if (!state.currentUser) throw new Error('Not logged in');
    const uid = state.currentUser.uid;
    const snap = await _db.collection('conversations')
      .where('userIds', 'array-contains', uid)
      .orderBy('lastAt', 'desc')
      .get();
    return snap.docs.map(d => {
      const data = d.data();
      const partnerId = data.userIds.find(id => id !== uid);
      const partner = data.users[partnerId] || { name: 'Unknown', avatar: null };
      return {
        id:      d.id,
        partner: { id: partnerId, ...partner },
        lastMsg: data.lastMessage,
        lastAt:  data.lastAt ? data.lastAt.toDate().toISOString() : null,
        unread:  data.unread ? (data.unread[uid] || 0) : 0,
      };
    });
  }

  // ── /messages/:convoId — messages in a conversation ──
  if (path.startsWith('/messages/')) {
    if (!state.currentUser) throw new Error('Not logged in');
    const convoId = path.replace('/messages/', '');
    const uid = state.currentUser.uid;
    // Verify membership
    const convoSnap = await _db.collection('conversations').doc(convoId).get();
    if (!convoSnap.exists || !convoSnap.data().userIds.includes(uid))
      throw new Error('Access denied');

    const msgsSnap = await _db.collection('conversations').doc(convoId)
      .collection('messages').orderBy('createdAt', 'asc').get();

    // Mark as read
    const batch = _db.batch();
    msgsSnap.docs.forEach(d => {
      if (d.data().sender_id !== uid && !d.data().is_read) {
        batch.update(d.ref, { is_read: true });
      }
    });
    await batch.commit().catch(() => {});

    // Reset unread counter for me
    await _db.collection('conversations').doc(convoId).update({
      ['unread.' + uid]: 0,
    }).catch(() => {});

    return msgsSnap.docs.map(d => ({
      id:          d.id,
      body:        d.data().body,
      sender_id:   d.data().sender_id,
      senderName:  d.data().senderName,
      senderAvatar:d.data().senderAvatar,
      is_read:     d.data().is_read,
      created_at:  d.data().createdAt ? d.data().createdAt.toDate().toISOString() : new Date().toISOString(),
    }));
  }

  // ── /users/:email ──
  if (path.startsWith('/users/')) {
    _fbInit();
    const email = decodeURIComponent(path.replace('/users/', ''));
    const snap = await _db.collection('users').where('email', '==', email).get();
    if (snap.empty) throw new Error('User not found');
    const d = snap.docs[0];
    const data = d.data();
    const createdAt = data.createdAt ? data.createdAt.toDate().toISOString() : null;
    const uid = state.currentUser ? state.currentUser.uid : null;
    const followers = data.followers || [];
    const following = data.following || [];

    // Contact details (email/phone) are private by default. They're only
    // surfaced to a viewer who has an accepted or completed trade with
    // this user — i.e. they're actually transacting, not just browsing.
    let hasConfirmedTrade = false;
    if (uid && uid !== d.id) {
      const [asOfferer, asOwner] = await Promise.all([
        _db.collection('tradeOffers')
          .where('offererId', '==', uid).where('tradeOwnerId', '==', d.id)
          .where('status', 'in', ['accepted', 'completed']).limit(1).get(),
        _db.collection('tradeOffers')
          .where('tradeOwnerId', '==', uid).where('offererId', '==', d.id)
          .where('status', 'in', ['accepted', 'completed']).limit(1).get(),
      ]);
      hasConfirmedTrade = !asOfferer.empty || !asOwner.empty;
    }

    let phone = null;
    if (hasConfirmedTrade) {
      // This read only succeeds under firestore.rules if a matching
      // contactUnlocks doc exists — the flag above and the actual
      // security check are kept in sync by that rule.
      try {
        const contactSnap = await _db.collection('users').doc(d.id).collection('private').doc('contact').get();
        phone = contactSnap.exists ? (contactSnap.data().phone || null) : null;
      } catch (e) { phone = null; }
    }

    return { id: d.id, uid: d.id, name: data.name,
             email: hasConfirmedTrade ? data.email : null,
             phone,
             hasConfirmedTrade,
             verificationStatus: data.verificationStatus || 'unverified',
             isVerified: data.verificationStatus === 'verified',
             location: data.location || null, avatar: data.avatar || null,
             createdAt, followersCount: followers.length, followingCount: following.length,
             isFollowedByMe: uid ? followers.includes(uid) : false };
  }

  // ── /users/:uid/follow-stats ──
  if (path.startsWith('/follow-stats/')) {
    _fbInit();
    const uid = path.replace('/follow-stats/', '');
    const snap = await _db.collection('users').doc(uid).get();
    if (!snap.exists) return { followersCount: 0, followingCount: 0 };
    const data = snap.data();
    return { followersCount: (data.followers || []).length, followingCount: (data.following || []).length };
  }

  throw new Error('Unknown GET path: ' + path);
}

async function apiPost(path, body) {
  _fbInit();

  // ── /auth/register ──
  if (path === '/auth/register') {
    const {
      name, email, password, location, avatar, faceScan,
      dob, phone, idType, idNumber, idPhoto,
    } = body;
    const cred = await _auth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;
    await cred.user.updateProfile({ displayName: name });
    // The ID + selfie are only *submitted* here — they still need to be
    // reviewed and approved by an admin before the account counts as
    // verified. kycVerified stays false until that happens.
    const hasSubmittedKyc = !!(faceScan && idPhoto);
    let kycSaveFailed = false;

    // Sensitive KYC artifacts (raw selfie, ID photo, ID number) go in a
    // separate, locked-down collection (see firestore.rules) — they're
    // never exposed on the public profile doc. Only the owning user and
    // admins can read this collection.
    // NOTE: this is written BEFORE the user doc so that if it fails (e.g.
    // the images push the document over Firestore's 1MiB limit), we know
    // about it and can avoid falsely marking the account as "pending".
    if (faceScan || idPhoto) {
      try {
        await _db.collection('faceVerifications').doc(uid).set({
          photo:      faceScan || null,
          idPhoto:    idPhoto || null,
          idType:     idType || null,
          idNumber:   idNumber || null,
          method:     'selfie-and-id-capture',
          submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } catch (e) {
        console.error('faceVerifications save failed:', e);
        kycSaveFailed = true;
      }
    }

    const userDoc = {
      name, email: email.toLowerCase(), location: location || null, avatar: avatar || null,
      idType: idType || null,
      kycVerified: false,
      verificationStatus: (hasSubmittedKyc && !kycSaveFailed) ? 'pending' : 'unverified',
      verificationSubmittedAt: (hasSubmittedKyc && !kycSaveFailed) ? firebase.firestore.FieldValue.serverTimestamp() : null,
      kycUploadFailed: hasSubmittedKyc && kycSaveFailed, // lets the profile page prompt a resubmit
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await _db.collection('users').doc(uid).set(userDoc);

    // phone/dob are PII, not trade-listing data — they live in a locked
    // subcollection (see firestore.rules) instead of the public users doc.
    await _db.collection('users').doc(uid).collection('private').doc('contact')
      .set({ phone: phone || null, dob: dob || null }).catch(() => {});

    const user = { id: uid, uid, name, email: email.toLowerCase(), location: location || null, avatar: avatar || null,
                    phone: phone || null, dob: dob || null };
    state.currentUser = user;
    return { ok: true, user, kycUploadFailed: hasSubmittedKyc && kycSaveFailed };
  }

  // ── /auth/login ──
  if (path === '/auth/login') {
    const { email, password } = body;
    const cred = await _auth.signInWithEmailAndPassword(email, password);
    const uid = cred.user.uid;
    const snap = await _db.collection('users').doc(uid).get();
    const data = snap.exists ? snap.data() : {};
    const user = { id: uid, uid, name: data.name || cred.user.displayName, email: cred.user.email, location: data.location || null, avatar: data.avatar || null };
    state.currentUser = user;
    return { ok: true, user };
  }

  // ── /auth/logout ──
  if (path === '/auth/logout') {
    await _auth.signOut();
    state.currentUser = null;
    return { ok: true };
  }

  // ── /trades — create trade ──
  if (path === '/trades') {
    if (!state.currentUser) throw new Error('Not logged in');
    const ref = await _db.collection('trades').add({
      ...body,
      userId:       state.currentUser.uid,
      userName:     state.currentUser.name,
      userEmail:    state.currentUser.email,
      userAvatar:   state.currentUser.avatar || null,
      likes:        0,
      likedBy:      [],
      commentCount: 0,
      createdAt:    firebase.firestore.FieldValue.serverTimestamp(),
    });
    return { ok: true, id: ref.id };
  }

  // ── /trades/:id/sold — toggle sold status ──
  if (path.match(/\/trades\/[^/]+\/sold$/)) {
    if (!state.currentUser) throw new Error('Not logged in');
    const id = path.split('/')[2];
    const ref = _db.collection('trades').doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Trade not found');
    if (snap.data().userId !== state.currentUser.uid) throw new Error('Not your trade');
    const currentStatus = snap.data().status || 'available';
    const newStatus = currentStatus === 'sold' ? 'available' : 'sold';
    await ref.update({ status: newStatus });
    // Update in local state
    const t = state.trades.find(tr => tr.id === id);
    if (t) t.status = newStatus;
    return { ok: true, status: newStatus };
  }

  // ── /follow/:uid — follow/unfollow a user ──
  if (path.match(/\/follow\/[^/]+$/)) {
    if (!state.currentUser) throw new Error('Not logged in');
    const targetUid = path.replace('/follow/', '');
    const myUid = state.currentUser.uid;
    if (targetUid === myUid) throw new Error("You can't follow yourself");
    const targetRef = _db.collection('users').doc(targetUid);
    const myRef = _db.collection('users').doc(myUid);
    const targetSnap = await targetRef.get();
    if (!targetSnap.exists) throw new Error('User not found');
    const followers = targetSnap.data().followers || [];
    const alreadyFollowing = followers.includes(myUid);
    if (alreadyFollowing) {
      await targetRef.update({ followers: firebase.firestore.FieldValue.arrayRemove(myUid) });
      await myRef.update({ following: firebase.firestore.FieldValue.arrayRemove(targetUid) });
      const updated = await targetRef.get();
      return { following: false, followersCount: (updated.data().followers || []).length };
    } else {
      await targetRef.update({ followers: firebase.firestore.FieldValue.arrayUnion(myUid) });
      await myRef.update({ following: firebase.firestore.FieldValue.arrayUnion(targetUid) });
      // Send notification
      await _db.collection('notifications').add({
        userId: targetUid, type: 'follow',
        title: state.currentUser.name + ' started following you',
        body: '', is_read: false, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      }).catch(() => {});
      const updated = await targetRef.get();
      return { following: true, followersCount: (updated.data().followers || []).length };
    }
  }

  // ── /trades/:id/comments/:commentId/like — like a comment ──
  if (path.match(/\/trades\/[^/]+\/comments\/[^/]+\/like$/)) {
    if (!state.currentUser) throw new Error('Not logged in');
    const parts = path.split('/');
    const tradeId = parts[2];
    const commentId = parts[4];
    const uid = state.currentUser.uid;
    const ref = _db.collection('trades').doc(tradeId).collection('comments').doc(commentId);
    const snap = await ref.get();
    if (!snap.exists) throw new Error('Comment not found');
    const likedBy = snap.data().likedBy || [];
    const alreadyLiked = likedBy.includes(uid);
    if (alreadyLiked) {
      await ref.update({ likedBy: firebase.firestore.FieldValue.arrayRemove(uid), likes: firebase.firestore.FieldValue.increment(-1) });
    } else {
      await ref.update({ likedBy: firebase.firestore.FieldValue.arrayUnion(uid), likes: firebase.firestore.FieldValue.increment(1) });
    }
    const updated = await ref.get();
    return { liked: !alreadyLiked, likes: updated.data().likes || 0 };
  }

  // ── /trades/:id/like ──
  if (path.match(/\/trades\/[^/]+\/like$/)) {
    if (!state.currentUser) throw new Error('Not logged in');
    const id  = path.split('/')[2];
    const uid = state.currentUser.uid;
    const ref = _db.collection('trades').doc(id);
    const snap = await ref.get();
    const likedBy = snap.data().likedBy || [];
    const alreadyLiked = likedBy.includes(uid);
    if (alreadyLiked) {
      await ref.update({ likedBy: firebase.firestore.FieldValue.arrayRemove(uid), likes: firebase.firestore.FieldValue.increment(-1) });
      const updated = await ref.get();
      return { liked: false, likes: updated.data().likes || 0 };
    } else {
      await ref.update({ likedBy: firebase.firestore.FieldValue.arrayUnion(uid), likes: firebase.firestore.FieldValue.increment(1) });
      const updated = await ref.get();
      const tradeData = updated.data();
      // Send notification to trade owner (not to yourself)
      if (tradeData.userId && tradeData.userId !== uid) {
        await _db.collection('notifications').add({
          userId:         tradeData.userId,
          type:           'like',
          title:          state.currentUser.name + ' liked your trade',
          body:           tradeData.title || '',
          is_read:        false,
          related_trade_id: id,
          createdAt:      firebase.firestore.FieldValue.serverTimestamp(),
        }).catch(() => {});
      }
      return { liked: true, likes: updated.data().likes || 0 };
    }
  }

  // ── /trades/:id/comments — add comment ──
  if (path.match(/\/trades\/[^/]+\/comments$/) && !path.includes('/replies')) {
    if (!state.currentUser) throw new Error('Not logged in');
    const tradeId = path.split('/')[2];
    const tradeSnap = await _db.collection('trades').doc(tradeId).get();
    const ref = await _db.collection('trades').doc(tradeId).collection('comments').add({
      text:       body.text,
      userId:     state.currentUser.uid,
      userName:   state.currentUser.name,
      userEmail:  state.currentUser.email,
      userAvatar: state.currentUser.avatar || null,
      createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
    });
    await _db.collection('trades').doc(tradeId).update({ commentCount: firebase.firestore.FieldValue.increment(1) });
    // Send notification to trade owner (not to yourself)
    if (tradeSnap.exists) {
      const tradeData = tradeSnap.data();
      if (tradeData.userId && tradeData.userId !== state.currentUser.uid) {
        await _db.collection('notifications').add({
          userId:         tradeData.userId,
          type:           'comment',
          title:          state.currentUser.name + ' commented on your trade',
          body:           body.text.slice(0, 100),
          is_read:        false,
          related_trade_id: tradeId,
          createdAt:      firebase.firestore.FieldValue.serverTimestamp(),
        }).catch(() => {});
      }
    }
    return { ok: true, id: ref.id };
  }

  // ── /trades/:id/comments/:commentId/replies — add reply ──
  if (path.includes('/comments/') && path.endsWith('/replies')) {
    if (!state.currentUser) throw new Error('Not logged in');
    const parts = path.split('/');
    const tradeId = parts[2];
    const commentId = parts[4];
    const ref = await _db.collection('trades').doc(tradeId)
      .collection('comments').doc(commentId)
      .collection('replies').add({
        text:       body.text,
        userId:     state.currentUser.uid,
        userName:   state.currentUser.name,
        userEmail:  state.currentUser.email,
        createdAt:  firebase.firestore.FieldValue.serverTimestamp(),
      });
    return { ok: true, id: ref.id };
  }

  // ── /messages/convo — create or get convo ──
  if (path === '/messages/convo') {
    const result = await getOrCreateConvo(body.partnerEmail);
    return result;
  }

  // ── /messages/:convoId — send message ──
  if (path.startsWith('/messages/')) {
    if (!state.currentUser) throw new Error('Not logged in');
    const convoId = path.replace('/messages/', '');
    const uid = state.currentUser.uid;
    const convoRef = _db.collection('conversations').doc(convoId);
    const convoSnap = await convoRef.get();
    if (!convoSnap.exists || !convoSnap.data().userIds.includes(uid)) throw new Error('Access denied');

    const recipientId = convoSnap.data().userIds.find(id => id !== uid);
    const msgRef = await convoRef.collection('messages').add({
      body:         body.body,
      sender_id:    uid,
      senderName:   state.currentUser.name,
      senderAvatar: state.currentUser.avatar || null,
      is_read:      false,
      createdAt:    firebase.firestore.FieldValue.serverTimestamp(),
    });
    // Update convo meta
    await convoRef.update({
      lastMessage: body.body.slice(0, 100),
      lastAt:      firebase.firestore.FieldValue.serverTimestamp(),
      ['unread.' + recipientId]: firebase.firestore.FieldValue.increment(1),
    });
    // Send notification
    await _db.collection('notifications').add({
      userId:    recipientId,
      type:      'message',
      title:     'New message from ' + state.currentUser.name,
      body:      body.body.slice(0, 100),
      is_read:   false,
      convoId:   convoId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return { ok: true, id: msgRef.id };
  }

  // ── /notifications/read-all ──
  if (path === '/notifications/read-all') {
    if (!state.currentUser) return { ok: true };
    const snap = await _db.collection('notifications')
      .where('userId', '==', state.currentUser.uid)
      .where('is_read', '==', false)
      .get();
    const batch = _db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { is_read: true }));
    await batch.commit();
    return { ok: true };
  }

  // ── /notifications/clear ──
  if (path === '/notifications/clear') {
    if (!state.currentUser) return { ok: true };
    const snap = await _db.collection('notifications')
      .where('userId', '==', state.currentUser.uid).get();
    const batch = _db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return { ok: true };
  }

  throw new Error('Unknown POST path: ' + path);
}

async function apiPut(path, body) {
  _fbInit();

  // ── /auth/profile ──
  if (path === '/auth/profile') {
    if (!state.currentUser) throw new Error('Not logged in');
    const uid = state.currentUser.uid;
    await _db.collection('users').doc(uid).update({
      name:     body.name     || state.currentUser.name,
      location: body.location || null,
      avatar:   body.avatar   || null,
    });
    if (body.name) await _auth.currentUser.updateProfile({ displayName: body.name });
    const snap = await _db.collection('users').doc(uid).get();
    const data = snap.data();
    state.currentUser = { id: uid, uid, ...data };
    return { ok: true, user: state.currentUser };
  }

  // ── /trades/:id — update trade ──
  if (path.startsWith('/trades/')) {
    if (!state.currentUser) throw new Error('Not logged in');
    const id = path.replace('/trades/', '');
    await _db.collection('trades').doc(id).update({
      game:  body.game,
      title: body.title,
      desc:  body.desc,
      offer: body.offer || '',
      img:   body.img   || null,
    });
    return { ok: true };
  }

  throw new Error('Unknown PUT path: ' + path);
}

async function apiDelete(path) {
  _fbInit();

  // ── /trades/:id ──
  if (path.startsWith('/trades/')) {
    const id = path.replace('/trades/', '');
    if (!state.currentUser) throw new Error('Not logged in');
    // Delete subcollections first (best-effort): replies, then comments,
    // then the trade doc itself. All deletes commit atomically — see
    // firestore.rules, which lets the trade owner delete any comment/
    // reply on their own post so this cascade doesn't get rejected.
    const cSnap = await _db.collection('trades').doc(id).collection('comments').get();
    const replySnaps = await Promise.all(
      cSnap.docs.map(d => d.ref.collection('replies').get())
    );
    const batch = _db.batch();
    replySnaps.forEach(rSnap => rSnap.docs.forEach(r => batch.delete(r.ref)));
    cSnap.docs.forEach(d => batch.delete(d.ref));
    batch.delete(_db.collection('trades').doc(id));
    await batch.commit();
    return { ok: true };
  }

  throw new Error('Unknown DELETE path: ' + path);
}

// ── Helper used in login.html's forgot-password ──
function val(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

// ── Expose globally ────────────────────────────
window.GAMES             = GAMES;
window.state             = state;
window.restoreSession    = restoreSession;
window.loadTrades        = loadTrades;
window.loadNotifications = loadNotifications;
window.unreadNotifCount  = unreadNotifCount;
window.startNotifListener = startNotifListener;
window.stopNotifListener  = stopNotifListener;
window.getOrCreateConvo  = getOrCreateConvo;
window.initPresence          = initPresence;
window.setPresenceOffline    = setPresenceOffline;
window.watchPresence         = watchPresence;
window.getActiveTradersCount = getActiveTradersCount;
window.watchActiveTradersCount = watchActiveTradersCount;
window.pushNotification  = pushNotification;
window.save              = save;
window.val               = val;
window.apiGet            = apiGet;
window.apiPost           = apiPost;
window.apiPut            = apiPut;
window.apiDelete         = apiDelete;