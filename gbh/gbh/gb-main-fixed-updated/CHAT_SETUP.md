# 🔥 Real-Time Chat — Setup Guide

## What Was Added

| File | Purpose |
|------|---------|
| `js/chat.js` | Core chat engine (messages, typing, presence) |
| `messages.html` | Rebuilt chat UI (replaces old version) |
| `firestore.rules` | Updated Firestore security rules (adds `chats` collection) |
| `database.rules.json` | Firebase Realtime Database rules for online/offline presence |

---

## Firestore Data Structure

```
chats (collection)
  {uid1}_{uid2} (document — chatId, always alphabetically sorted)
    participants:        [uid1, uid2]           // array for queries
    participantNames:    { uid1: "Alice", uid2: "Bob" }
    participantAvatars:  { uid1: "https://...", uid2: null }
    lastMessage:         "Hey, wanna trade?"    // preview (trimmed to 60 chars)
    updatedAt:           Timestamp
    typingUsers:         { uid1: false, uid2: true }   // typing indicator
    unread:              { uid1: 0, uid2: 2 }           // unread counts

    messages (subcollection)
      {auto-id} (document)
        senderId:   "uid1"
        text:       "Hey, wanna trade?"
        createdAt:  Timestamp
        read:       false
```

---

## Realtime Database (Presence) Structure

```
presence/
  {uid}/
    online:   true | false
    lastSeen: ServerTimestamp
```

---

## Step 1 — Enable Realtime Database

The online/offline presence feature requires Firebase Realtime Database:

1. Go to [Firebase Console](https://console.firebase.google.com) → your project
2. Click **Build → Realtime Database** in the sidebar
3. Click **Create database** → choose your region → Start in **locked mode**
4. Go to **Rules** tab and paste the contents of `database.rules.json`
5. Copy your **database URL** (looks like `https://gbhub-25a16-default-rtdb.firebaseio.com`)

Then open `messages.html` and uncomment + fill in line ~30:
```js
// databaseURL: "https://gbhub-25a16-default-rtdb.firebaseio.com",
```

> ⚠️ Without this step, presence (online/offline dots) simply won't show — everything else still works.

---

## Step 2 — Deploy Updated Firestore Rules

```bash
# From project root
firebase deploy --only firestore:rules
```

Or copy-paste the contents of `firestore.rules` into the Firebase Console under
**Firestore Database → Rules**.

---

## Step 3 — Deploy Updated RTDB Rules

```bash
firebase deploy --only database
```

Or paste `database.rules.json` contents into **Realtime Database → Rules**.

---

## Step 4 — Add Firestore Index

The chat list query requires a composite index. Deploy it with:

```bash
firebase deploy --only firestore:indexes
```

Or create it manually in the Firebase Console:

- **Collection:** `chats`
- **Fields:** `participants` (Array Contains) + `updatedAt` (Descending)

---

## Step 5 — Opening a Chat from Other Pages

To let users message each other from trade posts or profiles, call:

```js
// In browse.html / user-profile.html button onclick:
openChatWith('target_user_uid_here');
```

This function is exposed globally by `chat.js`. It builds the `chatId`, stores it in `sessionStorage`, and redirects to `messages.html` which auto-opens the correct conversation.

---

## How It Works

### Real-Time Messaging (`onSnapshot`)
- When a chat is opened, `startMessagesListener()` attaches a Firestore `onSnapshot` listener to `chats/{chatId}/messages` ordered by `createdAt asc`.
- Every new message (from either party) fires the listener instantly — no polling.
- The listener automatically marks received messages as `read: true` in a batch write.

### Sending a Message
- `sendMessage()` does a single **batch write**: it `set({ merge: true })` the parent `chats` document (updating `lastMessage`, `updatedAt`, `unread.{partnerId}++`) and adds a new document to the `messages` subcollection — both in one atomic commit.

### Typing Indicator
- `onTypingInput()` fires on every keystroke, writing `typingUsers.{myUid}: true` to the chat doc, then a 2.5s debounce resets it to `false`.
- A separate `onSnapshot` on the chat doc watches `typingUsers` and shows/hides the animated dots.

### Online / Offline Status
- On page load, `initPresence(uid)` connects to RTDB's special `.info/connected` path.
- When connected it sets `presence/{uid}/online: true` and registers an `onDisconnect()` hook to flip it to `false` + record `lastSeen`.
- `watchPresence(uid, callback)` streams these updates to the header and sidebar dots in real time.

### Chat ID Generation
```js
function buildChatId(uid1, uid2) {
  return [uid1, uid2].sort().join('_');
}
```
Sorting ensures `alice_bob` and `bob_alice` always produce the same ID regardless of who initiates the chat.

### Security
- Firestore rules verify `request.auth.uid in resource.data.participants` for every read/write.
- Message `create` rules additionally enforce `senderId == request.auth.uid` and a 2000-char max.
- Only the `read` field can be updated on existing messages (for read receipts).
- RTDB rules only allow `presence/{uid}` to be written by the matching authenticated user.

---

## Feature Summary

| Feature | Status |
|---------|--------|
| Real-time messages via `onSnapshot` | ✅ |
| Message timestamps | ✅ |
| Full chat history | ✅ |
| 1-on-1 chats with stable `chatId` | ✅ |
| Unread message counter | ✅ |
| Read receipts (✓ Sent / ✓✓ Seen) | ✅ |
| Typing indicator (animated dots) | ✅ |
| Online / offline status dots | ✅ (requires RTDB) |
| Last seen timestamp | ✅ (requires RTDB) |
| Emoji picker | ✅ |
| Mobile responsive | ✅ |
| Chat sidebar with search | ✅ |
| Firestore security rules | ✅ |
| RTDB security rules | ✅ |
