import { useEffect, useState, useRef } from "react";
import { api } from "../api";
import QRCode from "qrcode";

export default function Students() {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ name: "", studentId: "", className: "", facePhoto: "" });
  const [selectedCourses, setSelectedCourses] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Camera capture states
  const [showCamera, setShowCamera] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // QR Modal states
  const [qrStudent, setQrStudent] = useState(null);
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  // Analytics Profile Modal states
  const [analyticsStudent, setAnalyticsStudent] = useState(null);
  const [allAttendance, setAllAttendance] = useState([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const load = async () => {
    try {
      const [stList, crList] = await Promise.all([
        api.getStudents(),
        api.getCourses()
      ]);
      setStudents(stList);
      setCourses(crList);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleEnroll = async (e) => {
    e.preventDefault();
    if (!form.name || !form.studentId) {
      setError("Name and Student ID are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.enrollStudent({
        ...form,
        courseIds: selectedCourses
      });
      setForm({ name: "", studentId: "", className: "", facePhoto: "" });
      setSelectedCourses([]);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to remove this student?")) return;
    try {
      await api.deleteStudent(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  // WebRTC Camera control
  const startCamera = async () => {
    setCameraError("");
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 300, height: 300, facingMode: "user" }
      });
      streamRef.current = stream;
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      setCameraError("Could not access camera. Please check permissions.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement("canvas");
      canvas.width = 300;
      canvas.height = 300;
      const ctx = canvas.getContext("2d");
      ctx.translate(300, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, 300, 300);
      
      const dataUrl = canvas.toDataURL("image/jpeg");
      setForm((prev) => ({ ...prev, facePhoto: dataUrl }));
      stopCamera();
    }
  };

  // QR Code display
  const showQrCode = async (student) => {
    try {
      const url = await QRCode.toDataURL(student.id, {
        width: 250,
        margin: 2,
        color: {
          dark: "#0b0f19",
          light: "#ffffff"
        }
      });
      setQrStudent(student);
      setQrCodeUrl(url);
    } catch (err) {
      setError("Failed to generate QR Code");
    }
  };

  const closeQrModal = () => {
    setQrStudent(null);
    setQrCodeUrl("");
  };

  // Toggle course registration selection
  const handleToggleCourse = (courseId) => {
    if (selectedCourses.includes(courseId)) {
      setSelectedCourses((prev) => prev.filter((id) => id !== courseId));
    } else {
      setSelectedCourses((prev) => [...prev, courseId]);
    }
  };

  // Student analytics
  const openAnalytics = async (student) => {
    setAnalyticsStudent(student);
    setAnalyticsLoading(true);
    try {
      const history = await api.getAttendance(null, true);
      setAllAttendance(history);
    } catch (err) {
      console.warn("Failed to load attendance history:", err);
      setError("Failed to load attendance history.");
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const closeAnalyticsModal = () => {
    setAnalyticsStudent(null);
    setAllAttendance([]);
  };

  // Analytics calculator
  const calculateAnalytics = () => {
    if (!analyticsStudent) return null;
    const studentRecords = allAttendance.filter((r) => r.studentId === analyticsStudent.id);
    
    // Overall Stats
    const uniqueSchoolDates = Array.from(new Set(allAttendance.map((r) => r.date))).sort();
    const presentCount = studentRecords.length;
    const onTimeCount = studentRecords.filter((r) => r.status === "on-time").length;
    const lateCount = studentRecords.filter((r) => r.status === "late").length;
    const absentCount = Math.max(0, uniqueSchoolDates.length - presentCount);
    
    const attendanceRate = uniqueSchoolDates.length > 0 
      ? Math.round((presentCount / uniqueSchoolDates.length) * 100) 
      : 100;

    // Course Breakdown Stats
    const courseBreakdown = (analyticsStudent.courseIds || []).map((cid) => {
      const course = courses.find((c) => c.id === cid);
      if (!course) return null;

      const courseRecords = studentRecords.filter((r) => r.courseId === cid);
      // Active sessions of this course = unique dates where this course logged any scans
      const activeSessions = Array.from(
        new Set(allAttendance.filter((r) => r.courseId === cid).map((r) => r.date))
      );

      const rate = activeSessions.length > 0 
        ? Math.round((courseRecords.length / activeSessions.length) * 100)
        : 100;

      return {
        code: course.code,
        title: course.title,
        present: courseRecords.length,
        totalSessions: activeSessions.length,
        rate
      };
    }).filter(Boolean);

    // Generate recent 14 calendar days
    const recentDays = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      
      const record = studentRecords.find((r) => r.date === dateStr);
      const wasSchoolDay = allAttendance.some((a) => a.date === dateStr);
      
      let status = "inactive";
      let label = "No Session";
      
      if (record) {
        status = record.status;
        label = record.status === "on-time" 
          ? `Present: ${record.courseCode || "General"}` 
          : `Late: ${record.courseCode || "General"}`;
      } else if (wasSchoolDay) {
        status = "absent";
        label = "Absent";
      }

      recentDays.push({
        date: dateStr,
        dayName: d.toLocaleDateString(undefined, { weekday: "short" }),
        status,
        label
      });
    }

    return {
      present: presentCount,
      onTime: onTimeCount,
      late: lateCount,
      absent: absentCount,
      rate: attendanceRate,
      history: recentDays,
      courses: courseBreakdown
    };
  };

  const report = calculateAnalytics();

  return (
    <div className="card">
      <h2>Student Enrollment</h2>
      <p className="muted" style={{ marginBottom: "1.5rem" }}>
        Fill in student details, select their registered Accra Technical University (ATU) courses, capture their Face ID template, and enroll. Click on any student to view course-specific attendance analytics.
      </p>

      {/* Enrollment Form */}
      <form onSubmit={handleEnroll} style={{ display: "flex", flexDirection: "column", gap: "1rem", background: "rgba(17, 24, 39, 0.3)", padding: "1.25rem", borderRadius: "12px", border: "1px solid var(--border)", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", gap: "1rem", width: "100%", flexWrap: "wrap" }}>
          <input
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            style={{ flex: 1.5 }}
          />
          <input
            placeholder="Student ID (e.g. ATU-01240127C)"
            value={form.studentId}
            onChange={(e) => setForm({ ...form, studentId: e.target.value })}
            style={{ flex: 1.5 }}
          />
          <input
            placeholder="Class (e.g. HND Computer Science 2)"
            value={form.className}
            onChange={(e) => setForm({ ...form, className: e.target.value })}
            style={{ flex: 1 }}
          />
        </div>

        {/* Courses Multi-Select Grid */}
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
          <label className="muted" style={{ fontSize: "0.85rem", display: "block", marginBottom: "0.5rem", fontWeight: 500 }}>
            Register Student for ATU Course Modules:
          </label>
          {courses.length === 0 ? (
            <p className="muted" style={{ fontSize: "0.8rem" }}>No courses available. Register courses in the Courses tab first.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "0.5rem" }}>
              {courses.map((c) => (
                <label 
                  key={c.id} 
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "0.5rem", 
                    padding: "0.4rem 0.6rem", 
                    background: selectedCourses.includes(c.id) ? "rgba(16, 185, 129, 0.08)" : "rgba(0,0,0,0.15)", 
                    border: selectedCourses.includes(c.id) ? "1px solid var(--primary)" : "1px solid var(--border)", 
                    borderRadius: "6px", 
                    cursor: "pointer",
                    fontSize: "0.85rem",
                    transition: "all 0.15s ease"
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedCourses.includes(c.id)}
                    onChange={() => handleToggleCourse(c.id)}
                    style={{ width: "auto", minWidth: "auto", flex: "none" }}
                  />
                  <span>
                    <strong style={{ color: "var(--secondary)" }}>{c.code}</strong> - {c.title}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            {form.facePhoto ? (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <img
                  src={form.facePhoto}
                  alt="Captured face"
                  style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--primary)" }}
                />
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => setForm((prev) => ({ ...prev, facePhoto: "" }))}
                  style={{ padding: "0.2rem 0.6rem", fontSize: "0.8rem", color: "var(--danger)" }}
                >
                  ✕ Remove Face Photo
                </button>
              </div>
            ) : (
              <button type="button" className="secondary-btn" onClick={startCamera}>
                📷 Capture Face ID
              </button>
            )}
          </div>
          
          <button type="submit" disabled={busy} style={{ minWidth: "150px" }}>
            {busy ? "Enrolling..." : "Enroll Student"}
          </button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      {/* Student Directory */}
      <h3 style={{ marginTop: "2rem", marginBottom: "1rem", color: "#ffffff" }}>Enrolled Directory ({students.length})</h3>
      {students.length === 0 ? (
        <p className="muted">No students enrolled yet. Set up courses and enroll a student!</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Profile</th>
                <th>Name</th>
                <th>Student ID</th>
                <th>Class</th>
                <th>Modules Registered</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.facePhoto ? (
                      <img
                        src={s.facePhoto}
                        alt={s.name}
                        className="student-list-item-photo"
                      />
                    ) : (
                      <div className="student-list-item-photo" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem" }}>
                        👤
                      </div>
                    )}
                  </td>
                  <td>
                    <button 
                      className="link-btn" 
                      onClick={() => openAnalytics(s)} 
                      style={{ color: "#ffffff", fontWeight: 700, textAlign: "left" }}
                      title="View student course analytics"
                    >
                      {s.name}
                    </button>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>{s.studentId}</td>
                  <td>{s.className}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", maxWidth: "240px" }}>
                      {(s.courseIds || []).length === 0 ? (
                        <span className="muted" style={{ fontSize: "0.75rem" }}>No courses</span>
                      ) : (
                        s.courseIds.map((cid) => {
                          const course = courses.find((c) => c.id === cid);
                          return course ? (
                            <span 
                              key={cid} 
                              className="badge" 
                              style={{ 
                                background: "rgba(6, 182, 212, 0.08)", 
                                color: "var(--secondary)", 
                                border: "1px solid rgba(6, 182, 212, 0.2)",
                                padding: "0.1rem 0.35rem",
                                fontSize: "0.7rem"
                              }}
                              title={course.title}
                            >
                              {course.code}
                            </span>
                          ) : null;
                        })
                      )}
                    </div>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "0.75rem", alignItems: "center" }}>
                      <button className="secondary-btn" style={{ padding: "0.3rem 0.75rem", fontSize: "0.8rem" }} onClick={() => showQrCode(s)}>
                        🔍 QR Code
                      </button>
                      <button className="link-btn" onClick={() => handleDelete(s.id)}>
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Camera Capture Modal */}
      {showCamera && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Face ID Capture</h3>
              <button className="modal-close-btn" onClick={stopCamera}>✕</button>
            </div>
            
            {cameraError ? (
              <p className="error">{cameraError}</p>
            ) : (
              <div className="camera-preview-box">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{ width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }}
                />
                <div style={{
                  position: "absolute",
                  border: "2px dashed var(--primary)",
                  borderRadius: "50%",
                  width: "200px",
                  height: "200px",
                  pointerEvents: "none"
                }} />
              </div>
            )}
            
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
              <button className="secondary-btn" onClick={stopCamera}>Cancel</button>
              <button onClick={capturePhoto} disabled={!!cameraError}>📸 Take Photo</button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {qrStudent && (
        <div className="modal-backdrop" onClick={closeQrModal}>
          <div className="modal-content" style={{ maxWidth: "340px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>Scan QR Code</h3>
              <button className="modal-close-btn" onClick={closeQrModal}>✕</button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", margin: "1rem 0" }}>
              <div className="qr-container">
                <img src={qrCodeUrl} alt="QR Code" style={{ display: "block" }} />
              </div>
              <div>
                <h4 style={{ color: "#ffffff", margin: "0 0 0.25rem" }}>{qrStudent.name}</h4>
                <p className="muted" style={{ fontSize: "0.85rem", fontFamily: "var(--font-mono)" }}>ID: {qrStudent.studentId}</p>
                <p className="muted" style={{ fontSize: "0.85rem" }}>Class: {qrStudent.className}</p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "stretch" }}>
              <a
                href={qrCodeUrl}
                download={`${qrStudent.name.replace(/\s+/g, "_")}_QR.png`}
                style={{ flex: 1, textDecoration: "none" }}
              >
                <button style={{ width: "100%" }}>⬇️ Download QR</button>
              </a>
              <button className="secondary-btn" onClick={closeQrModal} style={{ flex: 0.5 }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Student Biometric Analytics Profile Modal */}
      {analyticsStudent && (
        <div className="modal-backdrop" onClick={closeAnalyticsModal}>
          <div className="modal-content" style={{ maxWidth: "480px" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0 }}>ATU Biometric Profile</h3>
              <button className="modal-close-btn" onClick={closeAnalyticsModal}>✕</button>
            </div>

            {analyticsLoading ? (
              <p className="muted" style={{ textAlign: "center", padding: "2rem" }}>Analyzing biometric database logs...</p>
            ) : report ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {/* Profile Avatar & Details */}
                <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                  {analyticsStudent.facePhoto ? (
                    <img 
                      src={analyticsStudent.facePhoto} 
                      alt="Face template" 
                      style={{ width: "64px", height: "64px", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--secondary)" }}
                    />
                  ) : (
                    <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.75rem" }}>👤</div>
                  )}
                  <div>
                    <h4 style={{ color: "#ffffff", fontSize: "1.2rem", margin: 0 }}>{analyticsStudent.name}</h4>
                    <p className="muted" style={{ fontSize: "0.85rem", fontFamily: "var(--font-mono)" }}>School ID: {analyticsStudent.studentId}</p>
                    <p className="muted" style={{ fontSize: "0.85rem" }}>Class Assignment: {analyticsStudent.className}</p>
                  </div>
                </div>

                <hr style={{ border: "0", borderTop: "1px solid var(--border)" }} />

                {/* Overall Attendance Metrics */}
                <div>
                  <h4 style={{ color: "#ffffff", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>General Metrics</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                    <div style={{ background: "rgba(0,0,0,0.2)", padding: "0.75rem", borderRadius: "8px", textAlign: "center", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--secondary)", fontFamily: "var(--font-mono)" }}>{report.rate}%</div>
                      <div className="muted" style={{ fontSize: "0.65rem", textTransform: "uppercase" }}>Attendance</div>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.2)", padding: "0.75rem", borderRadius: "8px", textAlign: "center", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--primary)", fontFamily: "var(--font-mono)" }}>{report.present}</div>
                      <div className="muted" style={{ fontSize: "0.65rem", textTransform: "uppercase" }}>Days Present</div>
                    </div>
                    <div style={{ background: "rgba(0,0,0,0.2)", padding: "0.75rem", borderRadius: "8px", textAlign: "center", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--danger)", fontFamily: "var(--font-mono)" }}>{report.absent}</div>
                      <div className="muted" style={{ fontSize: "0.65rem", textTransform: "uppercase" }}>Days Absent</div>
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem", fontSize: "0.8rem", justifyContent: "center" }} className="muted">
                    <span>On-time scans: <strong style={{ color: "var(--primary)" }}>{report.onTime}</strong></span>
                    <span>•</span>
                    <span>Late scans: <strong style={{ color: "var(--late)" }}>{report.late}</strong></span>
                  </div>
                </div>

                <hr style={{ border: "0", borderTop: "1px solid var(--border)" }} />

                {/* Course Breakdown List */}
                <div>
                  <h4 style={{ color: "#ffffff", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
                    Module Attendance breakdown
                  </h4>
                  {report.courses.length === 0 ? (
                    <p className="muted" style={{ fontSize: "0.8rem" }}>No ATU courses registered for this student.</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                      {report.courses.map((c, idx) => (
                        <div 
                          key={idx}
                          style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center", 
                            padding: "0.5rem 0.75rem", 
                            background: "rgba(0, 0, 0, 0.15)", 
                            borderRadius: "6px",
                            border: "1px solid var(--border)",
                            fontSize: "0.85rem"
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 600, color: "var(--secondary)", fontFamily: "var(--font-mono)", marginRight: "0.5rem" }}>{c.code}</span>
                            <span style={{ color: "#ffffff" }}>{c.title}</span>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <strong style={{ color: c.rate >= 75 ? "var(--primary)" : "var(--danger)" }}>{c.rate}%</strong>
                            <span className="muted" style={{ fontSize: "0.75rem", marginLeft: "0.35rem" }}>({c.present}/{c.totalSessions} sessions)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <hr style={{ border: "0", borderTop: "1px solid var(--border)" }} />

                {/* 14-Day Contribution Grid */}
                <div>
                  <h4 style={{ color: "#ffffff", fontSize: "0.9rem", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.75rem" }}>
                    Recent 14-Day Activity Log
                  </h4>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "0.45rem" }}>
                    {report.history.map((day, idx) => {
                      let color = "rgba(255, 255, 255, 0.05)";
                      let border = "1px solid rgba(255, 255, 255, 0.05)";
                      if (day.status === "on-time") {
                        color = "var(--primary-glow)";
                        border = "1px solid var(--primary)";
                      } else if (day.status === "late") {
                        color = "var(--late-glow)";
                        border = "1px solid var(--late)";
                      } else if (day.status === "absent") {
                        color = "var(--danger-glow)";
                        border = "1px solid var(--danger)";
                      }

                      return (
                        <div 
                          key={idx}
                          style={{
                            background: color,
                            border: border,
                            borderRadius: "6px",
                            padding: "0.5rem 0.25rem",
                            textAlign: "center",
                            fontSize: "0.75rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.15rem",
                            alignItems: "center"
                          }}
                          title={`${day.date}: ${day.label}`}
                        >
                          <span style={{ fontSize: "0.65rem", textTransform: "uppercase", color: "var(--text-muted)", fontWeight: 600 }}>
                            {day.dayName}
                          </span>
                          <span style={{ fontSize: "0.6rem", fontWeight: 700, fontFamily: "var(--font-mono)", color: "#ffffff" }}>
                            {day.date.slice(8, 10)}
                          </span>
                          <div style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: day.status === "on-time" ? "var(--primary)" : (day.status === "late" ? "var(--late)" : (day.status === "absent" ? "var(--danger)" : "transparent"))
                          }} />
                        </div>
                      );
                    })}
                  </div>
                  
                  <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem", fontSize: "0.7rem", justifyContent: "center" }} className="muted">
                    <span style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--primary)" }}></span> Present
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.2,rem" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--late)" }}></span> Late
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--danger)" }}></span> Absent
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "rgba(255,255,255,0.08)" }}></span> Inactive
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  <button className="secondary-btn" onClick={() => showQrCode(analyticsStudent)} style={{ flex: 1 }}>
                    🔍 Generate QR Code
                  </button>
                  <button className="secondary-btn" onClick={closeAnalyticsModal} style={{ flex: 1 }}>
                    Close Profile
                  </button>
                </div>
              </div>
            ) : (
              <p className="error">Could not calculate metrics.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
