import { useEffect, useState } from "react";
import { api } from "../api";

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({ code: "", title: "", department: "", credits: "3" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Course Reports Modal states
  const [reportCourse, setReportCourse] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const load = async () => {
    try {
      const data = await api.getCourses();
      setCourses(data);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!form.code || !form.title) {
      setError("Course code and title are required.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.createCourse(form);
      setForm({ code: "", title: "", department: "", credits: "3" });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this course? This will remove it from future terminal sessions.")) return;
    try {
      await api.deleteCourse(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  };

  // Open course report and calculate stats
  const openReport = async (course) => {
    setReportCourse(course);
    setReportLoading(true);
    try {
      const [stList, attList] = await Promise.all([
        api.getStudents(),
        api.getAttendance(null, true) // fetch entire history
      ]);

      // 1. Filter students registered in this course
      const registeredStudents = stList.filter((s) => s.courseIds && s.courseIds.includes(course.id));

      // 2. Find unique dates where scans for this course occurred (sessions run)
      const courseSessions = Array.from(
        new Set(attList.filter((r) => r.courseId === course.id).map((r) => r.date))
      ).sort();

      // 3. Compile stats for each student
      const studentStats = registeredStudents.map((s) => {
        const studentScans = attList.filter((r) => r.courseId === course.id && r.studentId === s.id);
        const presentCount = studentScans.length;
        const rate = courseSessions.length > 0
          ? Math.round((presentCount / courseSessions.length) * 100)
          : 100;
        
        // Accra Technical University rule: 75% attendance needed to write exams
        const isEligible = rate >= 75;

        return {
          id: s.id,
          name: s.name,
          studentId: s.studentId,
          facePhoto: s.facePhoto,
          className: s.className,
          present: presentCount,
          rate,
          isEligible
        };
      });

      // 4. Calculate overall course metrics
      const totalPossibleScans = courseSessions.length * registeredStudents.length;
      const totalScans = attList.filter((r) => r.courseId === course.id).length;
      const overallRate = totalPossibleScans > 0
        ? Math.round((totalScans / totalPossibleScans) * 100)
        : 100;

      setReportData({
        totalStudents: registeredStudents.length,
        totalSessions: courseSessions.length,
        averageRate: overallRate,
        studentsList: studentStats
      });
    } catch (err) {
      console.warn("Failed to generate course report:", err);
      setError("Failed to load course report metrics.");
    } finally {
      setReportLoading(false);
    }
  };

  const closeReportModal = () => {
    setReportCourse(null);
    setReportData(null);
  };

  // Export Course Performance report to CSV
  const exportCourseCSV = () => {
    if (!reportCourse || !reportData || reportData.studentsList.length === 0) return;

    const headers = ["Student Name", "Student ID", "Class", "Sessions Attended", "Total Sessions", "Attendance Rate", "ATU Exam Status"];
    
    const rows = reportData.studentsList.map((s) => [
      s.name,
      s.studentId,
      s.className,
      s.present,
      reportData.totalSessions,
      `${s.rate}%`,
      s.isEligible ? "ELIGIBLE" : "BARRED (<75%)"
    ]);

    const csvContent = [
      [`Accra Technical University - Attendance Report: ${reportCourse.code} (${reportCourse.title})`],
      [`Generated Date: ${new Date().toLocaleDateString()}`],
      [],
      headers,
      ...rows
    ]
      .map((row) => row.map((val) => `"${val.toString().replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `atu_exams_eligibility_${reportCourse.code.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="card">
      <h2>Accra Technical University Course Catalog</h2>
      <p className="muted" style={{ marginBottom: "1.5rem" }}>
        View and manage the academic course registry. Click the <strong>📊 Reports</strong> button next to a course to verify exam eligibility based on the ATU 75% attendance rule.
      </p>

      {/* Course Creation Form */}
      <form className="enroll-form" onSubmit={handleCreateCourse}>
        <div style={{ display: "flex", gap: "1rem", width: "100%", flexWrap: "wrap", alignItems: "center" }}>
          <input
            placeholder="Course Code (e.g. CSC 304)"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            style={{ flex: 1 }}
          />
          <input
            placeholder="Course Title (e.g. Web Technology)"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            style={{ flex: 1.5 }}
          />
          <input
            placeholder="Department (e.g. Computer Science)"
            value={form.department}
            onChange={(e) => setForm({ ...form, department: e.target.value })}
            style={{ flex: 1 }}
          />
          <input
            type="number"
            min="1"
            max="6"
            placeholder="Credits"
            value={form.credits}
            onChange={(e) => setForm({ ...form, credits: e.target.value })}
            style={{ flex: 0.5, minWidth: "80px" }}
          />
          <button type="submit" disabled={busy}>
            {busy ? "Registering..." : "➕ Add Course"}
          </button>
        </div>
      </form>

      {error && <p className="error">{error}</p>}

      {/* Courses List Table */}
      <h3 style={{ marginTop: "2rem", marginBottom: "1rem", color: "#ffffff" }}>Active Course Registry ({courses.length})</h3>
      {courses.length === 0 ? (
        <p className="muted">No courses registered in the system. Add one above to get started!</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Department</th>
                <th>Credits</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id}>
                  <td>
                    <strong style={{ color: "var(--secondary)", fontFamily: "var(--font-mono)", fontSize: "0.9rem" }}>{c.code}</strong>
                  </td>
                  <td>
                    <strong style={{ color: "#ffffff" }}>{c.title}</strong>
                  </td>
                  <td>{c.department}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem" }}>{c.credits}</td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "0.75rem", alignItems: "center" }}>
                      <button className="secondary-btn" style={{ padding: "0.3rem 0.75rem", fontSize: "0.8rem" }} onClick={() => openReport(c)}>
                        📊 Reports
                      </button>
                      <button className="link-btn" onClick={() => handleDelete(c.id)}>
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

      {/* Course Reports Eligibility Modal */}
      {reportCourse && (
        <div className="modal-backdrop" onClick={closeReportModal}>
          <div className="modal-content" style={{ maxWidth: "600px", width: "95%" }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="badge" style={{ background: "rgba(6, 182, 212, 0.08)", color: "var(--secondary)", border: "1px solid rgba(6, 182, 212, 0.2)", marginBottom: "0.25rem" }}>
                  {reportCourse.code}
                </span>
                <h3 style={{ margin: 0, color: "#ffffff" }}>{reportCourse.title}</h3>
              </div>
              <button className="modal-close-btn" onClick={closeReportModal}>✕</button>
            </div>

            {reportLoading ? (
              <p className="muted" style={{ textAlign: "center", padding: "2rem" }}>Computing student session analytics...</p>
            ) : reportData ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                
                {/* Course KPIs */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.5rem" }}>
                  <div style={{ background: "rgba(0,0,0,0.2)", padding: "0.75rem", borderRadius: "8px", textAlign: "center", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--secondary)", fontFamily: "var(--font-mono)" }}>
                      {reportData.averageRate}%
                    </div>
                    <div className="muted" style={{ fontSize: "0.65rem", textTransform: "uppercase" }}>Avg Attendance</div>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.2)", padding: "0.75rem", borderRadius: "8px", textAlign: "center", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--primary)", fontFamily: "var(--font-mono)" }}>
                      {reportData.totalSessions}
                    </div>
                    <div className="muted" style={{ fontSize: "0.65rem", textTransform: "uppercase" }}>Sessions Held</div>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.2)", padding: "0.75rem", borderRadius: "8px", textAlign: "center", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "#ffffff", fontFamily: "var(--font-mono)" }}>
                      {reportData.totalStudents}
                    </div>
                    <div className="muted" style={{ fontSize: "0.65rem", textTransform: "uppercase" }}>Registered Students</div>
                  </div>
                </div>

                {/* ATU Exams Eligibility Student Sheet */}
                <div style={{ maxHeight: "250px", overflowY: "auto", border: "1px solid var(--border)", borderRadius: "8px" }}>
                  {reportData.studentsList.length === 0 ? (
                    <p className="muted" style={{ textAlign: "center", padding: "1.5rem 0" }}>No students registered in this course module.</p>
                  ) : (
                    <table style={{ margin: 0, border: "none", borderRadius: "0", boxShadow: "none" }}>
                      <thead>
                        <tr style={{ background: "rgba(0,0,0,0.3)" }}>
                          <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem" }}>Student</th>
                          <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem" }}>School ID</th>
                          <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem" }}>Attended</th>
                          <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem" }}>Rate</th>
                          <th style={{ padding: "0.5rem 0.75rem", fontSize: "0.75rem", textAlign: "right" }}>ATU Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.studentsList.map((s) => (
                          <tr key={s.id}>
                            <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.85rem" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                {s.facePhoto ? (
                                  <img 
                                    src={s.facePhoto} 
                                    alt="profile" 
                                    style={{ width: "24px", height: "24px", borderRadius: "50%", objectFit: "cover" }}
                                  />
                                ) : (
                                  <div style={{ width: "24px", height: "24px", borderRadius: "50%", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem" }}>👤</div>
                                )}
                                <strong style={{ color: "#ffffff" }}>{s.name}</strong>
                              </div>
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.80rem", fontFamily: "var(--font-mono)" }}>{s.studentId}</td>
                            <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.80rem" }}>{s.present}/{reportData.totalSessions}</td>
                            <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.80rem", fontWeight: 700, color: s.rate >= 75 ? "var(--primary)" : "var(--danger)" }}>
                              {s.rate}%
                            </td>
                            <td style={{ padding: "0.5rem 0.75rem", fontSize: "0.80rem", textAlign: "right" }}>
                              {s.isEligible ? (
                                <span className="badge badge-ontime" style={{ fontSize: "0.65rem", padding: "0.1rem 0.35rem" }}>✓ Eligible</span>
                              ) : (
                                <span className="badge badge-late" style={{ fontSize: "0.65rem", padding: "0.1rem 0.35rem", background: "var(--danger-glow)", color: "var(--danger)", borderColor: "rgba(239, 68, 68, 0.2)" }}>
                                  ❌ Barred
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button onClick={exportCourseCSV} style={{ flex: 1, background: "linear-gradient(135deg, var(--secondary), var(--secondary-hover))" }}>
                    📥 Download Attendance Sheet
                  </button>
                  <button className="secondary-btn" onClick={closeReportModal} style={{ flex: 0.5 }}>
                    Close
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
