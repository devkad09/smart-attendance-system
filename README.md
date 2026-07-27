# Accra Technical University — Smart Biometric Attendance System

A modern, high-fidelity multimodal biometric attendance terminal and Learning Management System (LMS) skeleton custom-built for Accra Technical University (ATU). 

This pilot build implements a premium glassmorphism dark-theme user interface (`#0b0f19`) and supports webcam-based QR Code scanning, Face ID simulations (featuring face-oval overlays, biometric scanning HUDs, and double-beep audio feedback), historical date browsers, course catalog registries, secure passcode lock screens, and exams eligibility reports mapping the ATU 75% attendance threshold.

---

## ⚡ Multimodal Biometric Features

### 1. Attendance Terminal
A kiosk-style walk-up terminal supporting three verification modes:
- **👆 Fingerprint Scanner**: A high-tech vector fingerprint graphic that runs a simulated biometric reader matching students against hex template hashes.
- **📷 QR Code Scanner**: Activates the webcam to scan unique student QR cards. Recognizes codes in real time and registers attendance instantly with synth audio double-beeps.
- **👤 Face ID Scanner**: Opens the webcam with a circular biometric target reticle and pulsing facial mesh HUD, executing a simulated 3-second landmark analysis matching profiles.

### 2. Lecturer Security Gate (Default PIN: `1234`)
- Administrative tabs (**Dashboard**, **Enrollment**, and **ATU Courses**) are safeguarded behind a passcode lock screen.
- Features a secure numeric entry pad with error shake feedback animations.
- Lecturers can lock the terminal using the header action, restricting access and automatically redirecting display back to the public walk-up Biometric Terminal.

### 3. HND/BTech Course Catalog
- Add, update, and manage ATU courses (credits, codes, departments).
- Seeded with typical modules like *CSC 301 (Software Engineering)*, *CSC 304 (Web Technology)*, and *EEE 301 (Electrical Circuit Analysis)*.
- Enroll students into specific course modules and select the active course session on the Biometric Terminal.

### 4. Exams Eligibility & Reports
- **ATU 75% Threshold**: Course reports dynamically check student attendance records against the ATU academic limit. Displays green **✓ Eligible** or red **❌ Barred (<75%)** badges.
- **Spreadsheet Exports**: Generates downloadable CSV attendance sheets for entire courses or specific date-and-session logs.
- **Biometric Analytics Grid**: Click any student to view their overall metrics and a contribution-style 14-day grid visualizing scans.

---

## 📂 Project Structure

```
smart-attendance-system/
├── backend/
│   ├── server.js            # Express app endpoints, routing, and login/seeder APIs (Port 5002)
│   ├── db.js                # lowdb JSON store setup, seeds ATU courses & PIN defaults
│   ├── data/db.json         # JSON database file (auto-created/seeded)
│   └── routes/
│       ├── students.js      # Enrollment routes & Face ID base64 photo capture storage
│       └── attendance.js    # Course session scanning, logs, and course-filtered stats
└── frontend/
    └── src/
        ├── App.jsx          # React app wrapper, tab routing, and PIN lock overlay
        ├── api.js           # Fetch API client (getStats, simulateScan, seedData, login)
        ├── index.css        # Glassmorphic dark HUD stylesheet & scanning animations
        └── components/
            ├── Dashboard.jsx  # KPI metrics, Date Browser, Course Filter, CSV Export, Settings
            ├── Students.jsx   # Webcam photo capture, student cards, printable QRs, Analytics Modal
            ├── Courses.jsx    # ATU Course Management & Exam Eligibility Reports modal
            └── ScanSimulator.jsx # Biometric Terminal (WebRTC camera streams, QR, Face ID, synth Audio)
```

---

## 🚀 Getting Started

### Prerequisites
Make sure you have Node.js (v16+) and npm installed.

### 1. Terminal 1 — Backend API Server
```bash
cd backend
npm install
npm run dev        # nodemon auto-restarts on server changes (Runs on http://localhost:5002)
```

### 2. Terminal 2 — Frontend Client
```bash
cd frontend
npm install
npm run dev        # Starts Vite dev server on http://localhost:5173
```

Open `http://localhost:5173` in your browser.

### 3. Seeding Demo Data
To immediately test dashboards, historical date selectors, and student analytical grids:
1. Access any admin tab (e.g. click **Dashboard**).
2. Enter the default passcode: `1234`.
3. Click the **⚙️ Cutoff Time** settings button in the top right.
4. Click **⚡ Seed Demo Data**. The system will populate 15 Ghanaian student profiles, unique vector avatars, and 14 days of weekday lecture scan logs.

---

## 🔌 Biometric Hardware Integration Guide

To transition from software simulation to real biometric hardware in a production environment, follow these instructions:

### 1. Physical USB Fingerprint Scanner Integration
Real USB fingerprint scanners (e.g., ZKTeco, DigitalPersona U.are.U) run locally on client machines. To connect them to the system:

1. **Local Daemon Wrapper**: Write a lightweight local script (in Python, C#, or Node.js) on the terminal client machine. This script interfaces with the manufacturer's SDK.
2. **Scan Event Handler**: Listen for sensor touch events. Once a fingerprint is captured:
   - Run the SDK matching function against stored templates.
   - Match the template to the corresponding `studentId`.
3. **HTTP API Request**: Send an HTTP POST request to the backend's scan route:
   ```bash
   curl -X POST http://localhost:5002/api/attendance/scan \
     -H "Content-Type: application/json" \
     -d '{"studentId": "matched-student-db-uuid", "courseId": "active-course-session-uuid"}'
   ```
4. **Varying Scanner Hardware**: Since the database stores the matched student UUID, you can swap out scanner models/SDKs without changing the backend database structure.

### 2. Physical Camera Face Recognition Integration
To convert the Face ID webcam simulator into a fully automated facial-recognition attendance scanner:

1. **Webcam Frame Capture**: Set up a local webcam stream (or use the browser's WebRTC API directly).
2. **Local Machine Learning Daemon**: Run a Python daemon on the client machine using:
   - OpenCV (for camera frame reading).
   - `face_recognition` library (a lightweight dlib-based face matching library).
3. **Face Embedding Comparison**:
   - Extract face embeddings from the camera frames.
   - Periodically compare camera frame embeddings against base64 profile pictures (`facePhoto`) fetched from `GET http://localhost:5002/api/students`.
4. **Attendance Logging**: Once a match is confirmed (Euclidean distance < threshold, e.g. 0.6):
   - Capture a beep tone or visual overlay.
   - Send the HTTP POST `/api/attendance/scan` request with the student's ID and active `courseId`.
