// routes/students.js
// Handles student/staff enrollment.
//
// In the real system (per the proposal, section 5.1 "Enrollment"), a
// fingerprint scanner captures a fingerprint once and stores it as an
// encrypted mathematical template - never a raw image.
//
// Since we don't have scanner hardware yet, we SIMULATE that step:
// enrolling a student generates a fake "template" (just a random hash)
// so the rest of the system - matching, logging, dashboards - can be
// built and tested exactly as it will work once real hardware is
// plugged in. Swapping the simulated template generator for a real
// SDK call later is a one-function change (see simulateFingerprintCapture).

const express = require("express");
const { v4: uuidv4 } = require("uuid");
const crypto = require("crypto");
const db = require("../db");

const router = express.Router();

// --- Simulated fingerprint capture -----------------------------------
// Replace this function with a real SDK call once scanner hardware is
// available. It must keep returning a string "template" so nothing else
// in the app needs to change.
function simulateFingerprintCapture() {
  return crypto.randomBytes(16).toString("hex");
}

// GET /api/students - list all enrolled students
router.get("/", (req, res) => {
  const students = db.get("students").value();
  res.json(students);
});

// GET /api/students/:id
router.get("/:id", (req, res) => {
  const student = db.get("students").find({ id: req.params.id }).value();
  if (!student) return res.status(404).json({ error: "Student not found" });
  res.json(student);
});

// POST /api/students - enroll a new student
// body: { name, studentId, className }
router.post("/", (req, res) => {
  const { name, studentId, className, facePhoto, courseIds } = req.body;

  if (!name || !studentId) {
    return res.status(400).json({ error: "name and studentId are required" });
  }

  const existing = db.get("students").find({ studentId }).value();
  if (existing) {
    return res.status(409).json({ error: "A student with that studentId is already enrolled" });
  }

  const student = {
    id: uuidv4(),
    studentId,
    name,
    className: className || "Unassigned",
    fingerprintTemplate: simulateFingerprintCapture(), // encrypted template, never a raw image
    facePhoto: facePhoto || null,
    courseIds: courseIds || [],
    enrolledAt: new Date().toISOString()
  };

  db.get("students").push(student).write();
  res.status(201).json(student);
});

// DELETE /api/students/:id
router.delete("/:id", (req, res) => {
  const student = db.get("students").find({ id: req.params.id }).value();
  if (!student) return res.status(404).json({ error: "Student not found" });

  db.get("students").remove({ id: req.params.id }).write();
  res.json({ success: true });
});

module.exports = router;
