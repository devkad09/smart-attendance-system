// routes/attendance.js
// Implements the "Daily Scan -> Logging -> Reporting" workflow from
// proposal section 5 (System Architecture & Workflow).
//
// POST /api/attendance/scan simulates a student placing a finger on a
// scanner. Later, when real hardware is wired up, the scanner's SDK
// event handler just needs to call this same endpoint (or the matching
// function directly) with the matched studentId.

const express = require("express");
const { v4: uuidv4 } = require("uuid");
const db = require("../db");

const router = express.Router();

// Attendance is "late" if the scan happens after this hour:minute.
// Matches proposal wording: "tagged with student ID, class, and status
// (on-time/late)". Easy to move to a settings/config table later.
function todayDateString(d = new Date()) {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

function computeStatus(timestamp) {
  const t = new Date(timestamp);
  const cutoff = new Date(timestamp);
  
  const settings = db.get("settings").value() || { cutoffHour: 8, cutoffMinute: 0 };
  cutoff.setHours(settings.cutoffHour, settings.cutoffMinute, 0, 0);
  return t <= cutoff ? "on-time" : "late";
}

// POST /api/attendance/scan
// body: { studentId, courseId }  (this is the enrolled student's `id`, and optional ATU course ID)
router.post("/scan", (req, res) => {
  const { studentId, courseId } = req.body;
  if (!studentId) return res.status(400).json({ error: "studentId is required" });

  const student = db.get("students").find({ id: studentId }).value();
  if (!student) return res.status(404).json({ error: "No enrolled student with that id" });

  const now = new Date();
  const today = todayDateString(now);

  // Lookup course details if provided
  let courseDetails = {};
  if (courseId) {
    const course = db.get("courses").find({ id: courseId }).value();
    if (course) {
      courseDetails = {
        courseId: course.id,
        courseCode: course.code,
        courseTitle: course.title
      };
    }
  }

  // Avoid double-logging the same student on the same day for the same course session
  const alreadyScanned = db
    .get("attendance")
    .find((r) => r.studentId === studentId && r.date === today && r.courseId === courseId)
    .value();

  if (alreadyScanned) {
    return res.status(200).json({
      message: "Student already scanned in today",
      record: alreadyScanned
    });
  }

  const record = {
    id: uuidv4(),
    studentId: student.id,
    studentName: student.name,
    className: student.className,
    ...courseDetails, // courseId, courseCode, courseTitle
    date: today,
    timestamp: now.toISOString(),
    status: computeStatus(now)
  };

  db.get("attendance").push(record).write();
  res.status(201).json(record);
});

// GET /api/attendance  (defaults to today, pass all=true for entire history, support courseId filter)
router.get("/", (req, res) => {
  const { date, all, courseId } = req.query;
  let records;

  if (all === "true") {
    records = db.get("attendance").value();
  } else {
    const filterDate = date || todayDateString();
    records = db.get("attendance").filter({ date: filterDate }).value();
  }

  if (courseId) {
    records = records.filter((r) => r.courseId === courseId);
  }

  res.json(records);
});

// GET /api/attendance/stats?date=YYYY-MM-DD&courseId=... (defaults to today, filters by courseId)
router.get("/stats", (req, res) => {
  const { date, courseId } = req.query;
  const filterDate = date || todayDateString();

  let studentList = db.get("students").value();
  if (courseId) {
    studentList = studentList.filter((s) => s.courseIds && s.courseIds.includes(courseId));
  }
  const totalStudents = studentList.length;

  let records = db.get("attendance").filter({ date: filterDate }).value();
  if (courseId) {
    records = records.filter((r) => r.courseId === courseId);
  }

  const onTime = records.filter((r) => r.status === "on-time").length;
  const late = records.filter((r) => r.status === "late").length;
  const present = records.length;
  const absent = Math.max(totalStudents - present, 0);

  res.json({ date: filterDate, totalStudents, present, absent, onTime, late });
});

module.exports = router;
