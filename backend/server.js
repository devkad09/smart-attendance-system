// server.js
const express = require("express");
const cors = require("cors");

const studentsRouter = require("./routes/students");
const attendanceRouter = require("./routes/attendance");

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "smart-attendance-backend" });
});

const db = require("./db");

app.use("/api/students", studentsRouter);
app.use("/api/attendance", attendanceRouter);

// GET /api/settings
app.get("/api/settings", (req, res) => {
  const settings = db.get("settings").value();
  res.json(settings);
});

// POST /api/settings
app.post("/api/settings", (req, res) => {
  const { cutoffHour, cutoffMinute } = req.body;
  if (cutoffHour === undefined || cutoffMinute === undefined) {
    return res.status(400).json({ error: "cutoffHour and cutoffMinute are required" });
  }
  const hour = parseInt(cutoffHour);
  const minute = parseInt(cutoffMinute);
  if (isNaN(hour) || hour < 0 || hour > 23 || isNaN(minute) || minute < 0 || minute > 59) {
    return res.status(400).json({ error: "Invalid cutoff time value" });
  }
  const currentSettings = db.get("settings").value() || {};
  const updatedSettings = { ...currentSettings, cutoffHour: hour, cutoffMinute: minute };
  db.set("settings", updatedSettings).write();
  res.json({ success: true, settings: updatedSettings });
});

// POST /api/auth/login
app.post("/api/auth/login", (req, res) => {
  const { pin } = req.body;
  if (pin === undefined) {
    return res.status(400).json({ error: "PIN is required" });
  }
  const settings = db.get("settings").value();
  const storedPin = settings ? settings.adminPin : "1234";
  if (pin.toString() === storedPin.toString()) {
    res.json({ success: true, message: "Authentication successful" });
  } else {
    res.status(401).json({ error: "Invalid administrator PIN" });
  }
});

// POST /api/auth/seed - Reset and seed database with mock ATU data
app.post("/api/auth/seed", (req, res) => {
  const { v4: uuidv4 } = require("uuid");
  const crypto = require("crypto");

  const colors = [
    "#ef4444", "#f97316", "#f59e0b", "#10b981", "#06b6d4",
    "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#ec4899"
  ];

  function generateSvgAvatar(name, color) {
    const initials = name.split(" ").map(n => n[0]).join("").toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><circle cx="50" cy="50" r="48" fill="${color}"/><text x="50" y="55" font-family="'Outfit', sans-serif" font-size="38" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${initials}</text></svg>`;
    return "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");
  }

  try {
    // 1. Clear database
    db.set("students", []).write();
    db.set("attendance", []).write();

    // 2. Fetch courses (seeded by default in db.js)
    const courses = db.get("courses").value();
    if (!courses || courses.length === 0) {
      return res.status(400).json({ error: "No courses found. Seed courses first." });
    }

    // 3. Ghanaian Student Names and Classes
    const names = [
      { name: "Kwaku Mensah", className: "HND Computer Science 2" },
      { name: "Ama Osei", className: "HND Computer Science 2" },
      { name: "Kofi Appiah", className: "HND Computer Science 2" },
      { name: "Yaa Boateng", className: "HND Computer Science 2" },
      { name: "Abena Danquah", className: "HND Computer Science 2" },
      { name: "Kwame Addo", className: "BTech Electrical Eng 1" },
      { name: "Efua Gyasi", className: "BTech Electrical Eng 1" },
      { name: "Yaw Bako", className: "BTech Electrical Eng 1" },
      { name: "Akua Sarfo", className: "BTech Electrical Eng 1" },
      { name: "Kojo Asare", className: "HND Information Tech 3" },
      { name: "Esi Koomson", className: "HND Information Tech 3" },
      { name: "Kwabena Taylor", className: "HND Information Tech 3" },
      { name: "Afia Badu", className: "HND Information Tech 3" },
      { name: "Sena Anang", className: "BTech Computer Eng 4" },
      { name: "Tetteh Mensah", className: "BTech Computer Eng 4" }
    ];

    // 4. Create Students
    const seededStudents = names.map((item, idx) => {
      const studentIdNum = (idx + 1).toString().padStart(3, "0");
      const studentId = `ATU-0126${studentIdNum}C`;
      const id = uuidv4();
      
      // Select 2 to 4 random courses
      const numCourses = Math.floor(Math.random() * 3) + 2; 
      const shuffledCourses = [...courses].sort(() => 0.5 - Math.random());
      const studentCourseIds = shuffledCourses.slice(0, numCourses).map(c => c.id);

      const color = colors[idx % colors.length];
      const facePhoto = generateSvgAvatar(item.name, color);

      return {
        id,
        studentId,
        name: item.name,
        className: item.className,
        fingerprintTemplate: crypto.randomBytes(16).toString("hex"),
        facePhoto,
        courseIds: studentCourseIds,
        enrolledAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
      };
    });
    db.set("students", seededStudents).write();

    // 5. Generate 14 Days of Weekday History
    const seededAttendance = [];
    const settings = db.get("settings").value() || { cutoffHour: 8, cutoffMinute: 0 };

    for (let i = 13; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayOfWeek = date.getDay();
      
      // Skip weekends (0 = Sunday, 6 = Saturday)
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      const dateStr = date.toISOString().slice(0, 10);

      courses.forEach((course) => {
        const registeredStudents = seededStudents.filter(s => s.courseIds.includes(course.id));
        
        registeredStudents.forEach((student) => {
          // 85% attendance rate
          if (Math.random() > 0.15) {
            const checkInTime = new Date(date);
            const hour = 7;
            const minutes = Math.floor(Math.random() * 30) + 45; // 7:45 AM to 8:15 AM
            checkInTime.setHours(hour, minutes, 0, 0);

            let status = "on-time";
            const cutoff = new Date(checkInTime);
            cutoff.setHours(settings.cutoffHour, settings.cutoffMinute, 0, 0);
            if (checkInTime > cutoff) {
              status = "late";
            }

            seededAttendance.push({
              id: uuidv4(),
              studentId: student.id,
              studentName: student.name,
              className: student.className,
              courseId: course.id,
              courseCode: course.code,
              courseTitle: course.title,
              date: dateStr,
              timestamp: checkInTime.toISOString(),
              status
            });
          }
        });
      });
    }
    db.set("attendance", seededAttendance).write();

    res.json({ success: true, message: "Demo database seeded successfully with 15 students and 14 days of logs." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/courses
app.get("/api/courses", (req, res) => {
  const courses = db.get("courses").value();
  res.json(courses);
});

// POST /api/courses
app.post("/api/courses", (req, res) => {
  const { code, title, department, credits } = req.body;
  if (!code || !title) {
    return res.status(400).json({ error: "Course code and title are required" });
  }
  const existing = db.get("courses").find({ code }).value();
  if (existing) {
    return res.status(409).json({ error: "A course with that code already exists" });
  }
  const course = {
    id: "atu-" + code.toLowerCase().replace(/\s+/g, "-"),
    code,
    title,
    department: department || "Unassigned",
    credits: parseInt(credits) || 3
  };
  db.get("courses").push(course).write();
  res.status(201).json(course);
});

// DELETE /api/courses/:id
app.delete("/api/courses/:id", (req, res) => {
  const course = db.get("courses").find({ id: req.params.id }).value();
  if (!course) return res.status(404).json({ error: "Course not found" });
  db.get("courses").remove({ id: req.params.id }).write();
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Smart Attendance backend running on http://localhost:${PORT}`);
});
