# Quizese — Advanced Quiz Management System with AI Prediction Engine

A production-grade, full-stack **MERN stack** (MongoDB, Express, React, Node.js) assessment platform featuring **Anthropic Claude AI** question generation, Item Response Theory (**IRT**) psychometrics, live multiplayer rooms (**Socket.io**), and server-side cheat-deterrent scoring.

---

## 🌟 Key Features

1. **Authentication & Role Governance**
   - Dual-token JWT security (Short-lived access token + rotating HTTP-only refresh cookies).
   - Real-world database records with role-based protection (`admin`, `host`, `participant`).
   - Platform Master Administrator account pre-seeded (`admin@quizese.com`).

2. **Quiz Builder Wizard (`/create-quiz`)**
   - 4-Step Builder: Details → Questions → Policies & Anti-Cheat → Publish.
   - **Claude AI Question Generator**: Generate multi-choice questions with points, difficulty, and explanations.
   - Unique 6-character unambiguous join code generation + High-Resolution QR code PNG.

3. **Student Attempt Engine (`/attempt/:attemptId`)**
   - Distraction-free exam room with active countdown ring.
   - Question palette (Answered, Flagged, Unanswered).
   - Continuous 8-second background autosave.
   - **Anti-Cheat Suite**: Window blur / tab-switch detection, fullscreen enforcement, right-click & copy disabling, violation limits.

4. **Live Multiplayer Arena (`/live/:code`)**
   - Synchronized lobby with real-time connected player rosters.
   - Host-controlled start, synchronized question advancement, and live animated leaderboards.
   - Grand podium finals view.

5. **AI Predictions & Analytics (`/predictions` & `/analytics/:quizId`)**
   - Linear least-squares regression trend forecasts for upcoming exam scores.
   - Item Response Theory (IRT) difficulty and discrimination index calculation.
   - Weak-Topic Radar detecting syllabus vulnerabilities.
   - Recharts score cohort distributions.
   - One-click CSV results export and cryptographically formatted PDF Certificates (`pdfkit`).

6. **Admin Governance Super-Console (`/admin`)**
   - Platform health metrics, live concurrent sockets, user block/unblock toggles, and security audit logs.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- **Node.js**: v18+ or v20+
- **MongoDB**: Running locally on `mongodb://127.0.0.1:27017` or a MongoDB Atlas URI

### 1. Backend Server Setup
```bash
cd server
npm install
node src/utils/seed.js   # Seeds the Master Administrator account
npm run dev
```
- Server runs on: `http://localhost:5000`
- API Base: `http://localhost:5000/api/v1`

### 2. Frontend Client Setup
```bash
cd client
npm install
npm run dev
```
- Client runs on: `http://localhost:5173`

---

## 🔑 Master Administrator Credentials

| Role | Email | Password |
|---|---|---|
| **Administrator** | `admin@quizese.com` | `password123` |

*Note: All teacher (host) and student accounts are created live by registering at `/register`.*

---

## 🐳 Docker Deployment

To launch the complete MongoDB, Node.js Server, and React client stack in Docker containers:
```bash
docker-compose up --build -d
```
- Web Application: `http://localhost:5173`
- API Server: `http://localhost:5000`
- MongoDB: `localhost:27017`

---

## 🌐 Production Deployment Guide

### Option A: MongoDB Atlas + Render / Railway (Backend) + Vercel (Frontend)

1. **Database (MongoDB Atlas)**:
   - Create a free cluster on [MongoDB Atlas](https://www.mongodb.com/atlas).
   - Create a database user and whitelist IP `0.0.0.0/0`.
   - Copy connection URI (e.g. `mongodb+srv://<user>:<password>@cluster.mongodb.net/quizese?retryWrites=true&w=majority`).

2. **Backend (Render / Railway / Fly.io)**:
   - Connect repository, set root directory to `server`.
   - Build Command: `npm install`
   - Start Command: `node src/server.js`
   - Set Environment Variables:
     ```env
     PORT=5000
     NODE_ENV=production
     MONGO_URI=mongodb+srv://...
     CLIENT_URL=https://your-quizese-frontend.vercel.app
     JWT_ACCESS_SECRET=your_long_random_secret_1
     JWT_REFRESH_SECRET=your_long_random_secret_2
     ANTHROPIC_API_KEY=your_claude_api_key
     ```

3. **Frontend (Vercel)**:
   - Import repository on [Vercel](https://vercel.com).
   - Set Framework Preset to **Vite**, Root Directory to `client`.
   - Add Environment Variable:
     ```env
     VITE_API_URL=https://your-quizese-backend.onrender.com/api/v1
     VITE_SOCKET_URL=https://your-quizese-backend.onrender.com
     ```
   - Deploy!
