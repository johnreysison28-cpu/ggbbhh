# 🎮 GameBarterHub — Firebase Edition

A fully static, serverless version of GameBarterHub powered by **Firebase Authentication** and **Firestore** — hostable for free on **GitHub Pages**.

---

## 🚀 Quick Setup (15 minutes)

### Step 1 — Create a Firebase Project

1. Go to **[console.firebase.google.com](https://console.firebase.google.com)**
2. Click **"Add project"** → name it (e.g. `gamebarterhub`) → Continue
3. Disable Google Analytics (optional) → **Create project**

---

### Step 2 — Enable Authentication

1. In the Firebase Console, go to **Build → Authentication**
2. Click **"Get started"**
3. Click **Email/Password** → Enable it → **Save**

---

### Step 3 — Enable Firestore Database

1. Go to **Build → Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in production mode"** → Next
4. Pick a region (e.g. `asia-southeast1` for Philippines) → **Enable**

---

### Step 4 — Upload Firestore Security Rules

1. In Firestore, click the **"Rules"** tab
2. Replace everything with the contents of `firestore.rules` from this project
3. Click **Publish**

---

### Step 5 — Create Firestore Indexes

1. In Firestore, click the **"Indexes"** tab
2. You can either:
   - **Option A**: Let Firebase auto-create them when you first use a query (you'll see a link in your browser console)
   - **Option B**: Use Firebase CLI: `firebase deploy --only firestore:indexes`

---

### Step 6 — Get Your Firebase Config

1. In the Firebase Console, click the **gear icon ⚙️** → **Project settings**
2. Scroll down to **"Your apps"** → Click the **</>** (Web) icon
3. Register your app (any nickname) → **Register app**
4. Copy the `firebaseConfig` object shown

---

### Step 7 — Add Your Config to the App

Open **`js/data.js`** and replace the placeholder config at the top:

```javascript
const firebaseConfig = {
  apiKey:            "AIzaSy...",          // ← paste your values here
  authDomain:        "your-project.firebaseapp.com",
  projectId:         "your-project-id",
  storageBucket:     "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId:             "1:123456789:web:abc123",
};
```

---

### Step 8 — Push to GitHub & Enable Pages

1. Create a new **GitHub repository** (public or private)
2. Push this project folder to the `main` branch:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - GameBarterHub Firebase"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```
3. In your GitHub repo: **Settings → Pages**
4. Under **Source**, select **"GitHub Actions"**
5. The workflow in `.github/workflows/deploy.yml` will automatically deploy on every push!

---

### Step 9 — Add Your GitHub Pages URL to Firebase

Firebase Authentication requires your domain to be whitelisted:

1. In Firebase Console → **Authentication → Settings → Authorized domains**
2. Click **"Add domain"**
3. Enter your GitHub Pages URL: `YOUR_USERNAME.github.io`
4. **Save**

---

## ✅ That's it!

Your app will be live at:
```
https://YOUR_USERNAME.github.io/YOUR_REPO/
```

---

## 📁 Project Structure

```
├── index.html              ← Home page
├── browse.html             ← Browse trades
├── login.html              ← Login page
├── register.html           ← Sign up page
├── messages.html           ← Messaging
├── post-trade.html         ← Post a trade
├── profile.html            ← My profile
├── user-profile.html       ← View other profiles
├── css/                    ← Stylesheets
├── js/
│   ├── data.js             ← 🔥 Firebase + all API logic (edit config here!)
│   ├── auth.js             ← Login/register/logout
│   ├── trades.js           ← Trade cards, likes, comments
│   ├── notification.js     ← Notification panel
│   ├── navbar.js           ← Nav state
│   ├── navbar-template.js  ← Nav HTML injection
│   └── ui.js               ← Shared UI helpers
├── images/                 ← Game images
├── firestore.rules         ← Firestore security rules
├── firestore.indexes.json  ← Firestore composite indexes
├── firebase.json           ← Firebase hosting config
└── .github/workflows/
    └── deploy.yml          ← GitHub Pages auto-deploy
```

---

## 🔥 Firebase Collections Structure

| Collection | Description |
|---|---|
| `users/{uid}` | User profile: name, email, location, avatar |
| `trades/{id}` | Trade posts with likedBy array, commentCount |
| `trades/{id}/comments/{id}` | Comments on trades |
| `trades/{id}/comments/{id}/replies/{id}` | Replies to comments |
| `conversations/{a_uid}_{b_uid}` | Chat conversations |
| `conversations/{id}/messages/{id}` | Individual messages |
| `notifications/{id}` | Per-user notifications |
| `tradeOffers/{id}` | Trade offers — the actual "propose / accept / decline / cancel / complete" trade flow (see `js/offers.js` and `offers.html`) |

### 🤝 How an actual trade happens

Trades are no longer just "post it and chat about it" — there's now a real offer flow:

1. A trader opens someone's post and clicks **🤝 Make Trade Offer**, describing what they're offering in exchange.
2. The owner sees it under **Trade Offers → Received**, and can **Accept** or **Decline**. Accepting locks the listing (`trades/{id}.status` becomes `pending`) and auto-declines any other pending offers on that post.
3. Once accepted, either side can jump straight into **Message** to arrange the handover.
4. When the trade is actually done, each side clicks **🎉 Mark as Completed**. Once *both* sides confirm, the offer is marked `completed` and the listing flips to `sold`.
5. Either side can back out with **Cancel** at any point before completion, which reopens the listing.

Everyone gets notified (bell icon) at each step, and a small badge on the **Trade Offers** nav link shows how many offers are waiting on you.

---

## 🛠️ Local Development

Since this is a static site, just open it with any local server:

```bash
# Using VS Code Live Server extension — recommended
# Or using Python:
python3 -m http.server 8080
# Or using Node.js:
npx serve .
```

Then open `http://localhost:8080`

> ⚠️ You must serve from a local server (not file://) because Firebase Auth requires HTTP/HTTPS.

---

## 🔐 Security Notes

- Passwords are handled entirely by **Firebase Authentication** (never stored in Firestore)
- Password reset sends a **real email** via Firebase (no more fake demo codes!)
- Firestore rules prevent users from reading/writing other users' private data
- Avatar images are stored as **base64 in Firestore** (keep under 800KB per image for best performance)

---

## 🛡️ Admin Verification Review Setup

New accounts submit an ID photo + selfie at signup, but they stay
`verificationStatus: "pending"` until an admin reviews and approves them
at **admin.html**. Only then does the user see a "Verified Account" badge
on their profile, and only then is a notification sent to them.

**To make yourself (or anyone) an admin:**
1. Sign up/log in normally as that user first, so their account exists.
2. In the [Firebase Console](https://console.firebase.google.com/), go to
   **Firestore Database**.
3. Create a new collection called `admins` (if it doesn't exist yet).
4. Add a document whose **Document ID** is that user's Firebase Auth UID
   (find it under Authentication → Users). The document's fields don't
   matter — its existence is what grants admin access — but adding a
   field like `addedAt: <timestamp>` is a nice record to keep.
5. That account will now see an "🛡️ Admin: Verifications" link in their
   profile dropdown, leading to `admin.html`, where they can approve or
   reject pending verification requests.

There's no in-app way to grant admin access — it's deliberately
console-only, so a compromised or malicious client can never grant
itself admin rights.

---

## 🆓 Free Tier Limits (Firebase Spark Plan)

| Feature | Free Limit |
|---|---|
| Auth users | Unlimited |
| Firestore reads | 50,000/day |
| Firestore writes | 20,000/day |
| Firestore storage | 1 GB |
| Hosting bandwidth | 360 MB/day |

More than enough for a community trading platform starting out!
