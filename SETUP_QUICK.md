# ⚡ Quick Setup Guide (5 Steps)

## Step 1: Install
```bash
cd /Users/alex/Desktop/exam-heist
npm install
```

## Step 2: Create Firebase Project
1. Go to https://console.firebase.google.com
2. "Add Project" → name it (e.g. "exam-heist")
3. Skip Google Analytics (or enable, your choice)

## Step 3: Enable Services
In your Firebase project:

**Firestore Database:**
- Left sidebar → Build → Firestore Database → Create database
- Start in **test mode** (we'll secure later)
- Pick a region (closest to you/students)

**Storage:**
- Left sidebar → Build → Storage → Get started
- Start in **test mode**

## Step 4: Get Config
- Project Settings (gear icon top-left) → General tab
- Scroll to "Your apps" → click `</>` web icon
- Register app (any nickname)
- Copy the `firebaseConfig` values

## Step 5: Fill .env
```bash
cp .env.example .env
```
Edit `.env` and paste your values:
```
VITE_FIREBASE_API_KEY=AIzaSyXXX...
VITE_FIREBASE_AUTH_DOMAIN=exam-heist-xxx.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=exam-heist-xxx
VITE_FIREBASE_STORAGE_BUCKET=exam-heist-xxx.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456:web:abc

VITE_TEACHER_PASSWORD=YourSecurePasswordHere
```

## Run It!
```bash
npm run dev
```
Open http://localhost:5173

---

## 🎯 First Test (5 Minutes)

1. Go to http://localhost:5173
2. Click **"Teacher Vault"** → enter your password
3. Click **"Choose PDF File(s)"** → upload your exam PDF
4. Wait for "✅ Created bank..."
5. Click the bank to select it
6. Enter class code: `TEST1`
7. Click "Start Class"
8. **Open a new tab** → http://localhost:5173 → "Join a Heist"
9. Enter `TEST1` and a name → Start playing!
10. **Switch back** to teacher tab → watch the live leaderboard update

---

## 🌐 Deploy to the Internet

**Easiest: Firebase Hosting (recommended)**
```bash
npm install -g firebase-tools
firebase login
firebase use --add  # select your project
npm run build
firebase deploy --only hosting
```

Your game is now at: `https://your-project.web.app`

---

## ❓ Stuck?
See the full README.md for troubleshooting and customization.
