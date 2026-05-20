# 🦊 Exam Heist

> The high-stakes revision game where knowledge is currency and rivals are targets.

An interactive, competitive IGCSE revision game built with React, Vite, Firebase, and Tailwind CSS. Students answer exam-style questions, climb a live leaderboard, and steal points from rivals — all while learning from detailed feedback. Teachers upload past papers as PDFs and the system extracts concepts to generate unlimited question variations.

---

## ✨ Features

- **🦊 Campaign Mode**: 40-50 questions across EASY → MEDIUM → HARD → EXPERT difficulty
- **💰 Steal Mechanic**: Answer correctly → rob points from rivals
- **📊 Live Leaderboard**: Real-time updates via Firestore
- **📚 PDF Upload**: Teachers upload exam papers + answer keys (one or multiple PDFs)
- **🎯 Concept-Based Generation**: Game creates NEW questions from the concepts in your PDFs, so students learn concepts (not memorize answers)
- **💬 Smart Feedback**: Command-word-specific learning tips (Define vs Explain vs Justify)
- **🏆 Achievements**: Master Thief, Sharpshooter, Kingpin, and more
- **🎵 Music & SFX**: Heist-themed background music (optional) + synthesized SFX
- **🔒 Teacher Vault**: Password-protected dashboard
- **🌐 GitHub Deployable**: Host the frontend on GitHub Pages or Firebase Hosting

---

## 🚀 Quick Start

### 1. Install dependencies

```bash
cd exam-heist
npm install
```

### 2. Set up Firebase

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project (free Spark plan is fine).
2. In your project:
   - Enable **Firestore Database** (start in test mode)
   - Enable **Storage** (start in test mode)
3. Go to Project Settings → General → "Your apps" → Add a web app
4. Copy the Firebase config object you get.

### 3. Configure environment

```bash
cp .env.example .env
```

Fill in your Firebase credentials in `.env`:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...

VITE_TEACHER_PASSWORD=pick_a_secure_password
```

### 4. Run locally

```bash
npm run dev
```

Open http://localhost:5173

### 5. Deploy security rules (recommended)

Install Firebase CLI:
```bash
npm install -g firebase-tools
firebase login
firebase use --add # select your project
firebase deploy --only firestore:rules,storage
```

---

## 📚 Teacher Workflow

1. **Click "Teacher Vault"** on the home page
2. **Enter your password** (set in `.env`)
3. **Upload PDF(s)**:
   - You can upload the question paper and the answer key as **separate PDFs** (system auto-detects which is which)
   - Or as a **single combined PDF** (system splits them)
   - Supports multiple papers — upload several to build a larger question bank
4. **Wait for parsing** (~5-15 seconds depending on PDF size)
5. **Select the question bank** by clicking it
6. **Enter a class code** (e.g. `9A-BIZ`) and click "Start Class"
7. **Share the code** with students who go to `/join`
8. **Watch the live leaderboard** as they play
9. **Reset Scores** between groups/sessions if needed

> **Tip**: Upload MULTIPLE past papers to create a bigger, more varied question bank. The system mixes concepts from all uploaded papers.

---

## 🎮 Student Workflow

1. Go to the website → "Join a Heist"
2. Enter the class code from teacher
3. Pick a thief name
4. Answer 40+ questions across difficulty tiers
5. Each correct answer = points + chance to rob a rival
6. Learn from feedback on wrong answers
7. Race for the top of the leaderboard

---

## 🎵 Adding Music

Background music is optional. To add it:

1. Find a royalty-free track (see `public/assets/music/README.txt` for sources)
2. Save it as `public/assets/music/heist-theme.mp3`
3. The game picks it up automatically

If no file is present, sound effects still work — just no music.

---

## 🌐 Deploying to GitHub

### Option A: GitHub Pages (frontend only — easiest)

1. Create a new repo on GitHub
2. Push your code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/exam-heist.git
   git push -u origin main
   ```
3. Install gh-pages: `npm install --save-dev gh-pages`
4. Add to `package.json`:
   ```json
   "homepage": "https://YOUR_USERNAME.github.io/exam-heist",
   "scripts": {
     "predeploy": "npm run build",
     "deploy:pages": "gh-pages -d dist"
   }
   ```
5. In `vite.config.js`, set `base: '/exam-heist/'`
6. Deploy: `npm run deploy:pages`
7. In GitHub repo settings → Pages → Source → `gh-pages` branch

⚠️ For GitHub Pages: you'll need to make Firebase env vars available at build time. Use GitHub Actions secrets:

`.github/workflows/deploy.yml`:
```yaml
name: Deploy
on: { push: { branches: [main] } }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run build
        env:
          VITE_FIREBASE_API_KEY: ${{ secrets.FB_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.FB_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.FB_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.FB_STORAGE }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.FB_SENDER }}
          VITE_FIREBASE_APP_ID: ${{ secrets.FB_APP_ID }}
          VITE_TEACHER_PASSWORD: ${{ secrets.TEACHER_PASSWORD }}
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

### Option B: Firebase Hosting (recommended)

```bash
npm run build
firebase deploy --only hosting
```

You get a custom `*.web.app` domain instantly.

---

## 🏗️ Project Structure

```
exam-heist/
├── src/
│   ├── components/
│   │   ├── Game/         # QuestionCard, FeedbackModal, StealModal, EventTicker
│   │   ├── Leaderboard/  # LiveLeaderboard
│   │   └── UI/
│   ├── pages/
│   │   ├── LandingPage.jsx
│   │   ├── TeacherDashboard.jsx
│   │   ├── StudentLobby.jsx
│   │   ├── GamePlay.jsx
│   │   └── GameResults.jsx
│   ├── firebase/         # Firebase config, Firestore, Storage
│   ├── utils/            # PDF parsing, question generation
│   ├── hooks/            # useSound (Howler + Web Audio)
│   └── App.jsx
├── public/
│   └── assets/music/     # Drop heist-theme.mp3 here
├── firebase.json
├── firestore.rules
├── storage.rules
└── package.json
```

---

## 🔧 Customization

### Change difficulty point values
Edit `src/utils/questionGenerator.js` → `getGamePoints()`:
```js
const points = {
  EASY: 40,    // change these
  MEDIUM: 60,
  HARD: 100,
  EXPERT: 160
};
```

### Add more business scenarios
Edit `src/utils/questionGenerator.js` → `BUSINESS_TEMPLATES` array — add as many as you want.

### Change campaign length
Edit `src/utils/questionGenerator.js` → `generateCampaign()` and adjust the counts per tier.

### Tune scoring leniency
Edit `src/utils/questionGenerator.js` → `scoreAnswer()`:
```js
if (coverage >= 0.6) { /* full points */ }
else if (coverage >= 0.3) { /* half points */ }
```

---

## 🛡️ Security Notes

- The teacher password is client-side (acceptable for classroom use, not for high-security needs)
- Firestore rules are open by default — tighten them in `firestore.rules` if you go public
- For a more secure setup, use Firebase Auth with email/password and restrict teacher routes server-side

---

## 📝 PDF Compatibility

The parser works best with:
- ✅ Standard Cambridge IGCSE format papers
- ✅ Text-based PDFs (not scanned images)
- ✅ Questions numbered with letters: (a), (b), (c), (d), (e)
- ✅ Mark values shown as `[X]`

If parsing fails:
- Check the PDF is text-extractable (open it and try selecting text)
- For scanned PDFs, run them through OCR first (free at [ocr.space](https://ocr.space))

---

## 🐛 Troubleshooting

**"No class found with that code"** — Make sure the teacher started a class with that exact code (case-insensitive).

**PDF parsing fails or finds 0 questions** — The PDF might be image-based. Run it through OCR first.

**Music doesn't play** — Add a file at `public/assets/music/heist-theme.mp3`. SFX still work without it.

**Leaderboard not updating** — Check Firebase console → Firestore. If rules block writes, deploy the rules: `firebase deploy --only firestore:rules`.

---

## 🎓 Educational Philosophy

This game is designed to:
1. **Test concepts, not exact answers** — by generating new business scenarios from the concepts in your PDFs
2. **Reward strategic thinking** — the stealing mechanic adds psychology, not just speed
3. **Teach exam technique** — feedback is specific to command words (Define vs Explain vs Justify)
4. **Encourage replayability** — every campaign is randomly assembled, no two games are the same

---

## License

MIT — feel free to use, modify, and share.

Built with ❤️ for IGCSE teachers and students.
