// db.js
// Lightweight JSON-file database using lowdb v1.
// Good enough for development / a student project pilot. No native
// dependencies to compile, so `npm install` just works everywhere.

const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");
const path = require("path");
const fs = require("fs");

const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const adapter = new FileSync(path.join(dataDir, "db.json"));
const db = low(adapter);

// Seed default structure if the file is empty
db.defaults({
  students: [],
  attendance: [],
  courses: [],
  settings: {
    cutoffHour: 8,
    cutoffMinute: 0,
    adminPin: "1234"
  }
}).write();

// Ensure settings exist if the database file was already populated
if (!db.has("settings").value()) {
  db.set("settings", { cutoffHour: 8, cutoffMinute: 0, adminPin: "1234" }).write();
} else {
  const currentSettings = db.get("settings").value();
  if (currentSettings && currentSettings.adminPin === undefined) {
    db.set("settings.adminPin", "1234").write();
  }
}

// Ensure courses collection exists
if (!db.has("courses").value()) {
  db.set("courses", []).write();
}

// Seed default ATU courses if empty
const defaultCourses = [
  { id: "atu-csc301", code: "CSC 301", title: "Software Engineering", department: "Computer Science", credits: 3 },
  { id: "atu-csc302", code: "CSC 302", title: "Database Management Systems", department: "Computer Science", credits: 3 },
  { id: "atu-csc304", code: "CSC 304", title: "Web Technology", department: "Computer Science", credits: 3 },
  { id: "atu-csc306", code: "CSC 306", title: "Mobile Application Development", department: "Computer Science", credits: 3 },
  { id: "atu-eee301", code: "EEE 301", title: "Electrical Circuit Analysis", department: "Electrical Engineering", credits: 3 }
];

// Ensure lecturers collection exists and is seeded
const defaultLecturers = [
  { id: "lect-01", name: "Dr. K. Appiah", department: "Computer Science", pin: "1234" },
  { id: "lect-02", name: "Prof. E. Mensah", department: "Electrical Engineering", pin: "5678" },
  { id: "lect-03", name: "Dr. A. Osei", department: "Information Technology", pin: "4321" }
];

if (!db.has("lecturers").value() || db.get("lecturers").size().value() === 0) {
  db.set("lecturers", defaultLecturers).write();
}

module.exports = db;
