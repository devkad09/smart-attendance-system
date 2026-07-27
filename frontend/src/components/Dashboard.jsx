import { useEffect, useState, useCallback } from "react";
import { api } from "../api";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [records, setRecords] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [error, setError] = useState("");
  
  // Date selection (default to today's date in local time YYYY-MM-DD)
  const getTodayString = () => new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState(getTodayString());

  // Course Filter selection (empty string = "All Courses")
  const [selectedCourseId, setSelectedCourseId] = useState("");

  // Late Cutoff Settings states
  const [showSettings, setShowSettings] = useState(false);
  const [cutoffHour, setCutoffHour] = useState(8);
  const [cutoffMinute, setCutoffMinute] = useState(0);
  const [settingsStatus, setSettingsStatus] = useState("");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [seederBusy, setSeederBusy] = useState(false);

  const handleSeedData = async () => {
    if (!window.confirm("Warning: Seeding demo data will reset the database, erasing all current student profiles and logs. Proceed?")) return;
    setSeederBusy(true);
    setSettingsStatus("");
    try {
      await api.seedData();
      setSettingsStatus("✓ Demo data seeded successfully!");
      load();
      setTimeout(() => setSettingsStatus(""), 4000);
    } catch (err) {
      setSettingsStatus(`✕ Seeding failed: ${err.message}`);
    } finally {
      setSeederBusy(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const [s, r, st, cr] = await Promise.all([
        api.getStats(selectedDate, selectedCourseId),
        api.getAttendance(selectedDate, false, selectedCourseId),
        api.getStudents(),
        api.getCourses()
      ]);
      setStats(s);
      setRecords(r);
      setStudents(st);
      setCourses(cr);
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, [selectedDate, selectedCourseId]);

  // Load stats and settings on mount or date/course change
  useEffect(() => {
    load();
    const interval = setInterval(load, 5000); // refresh every 5s
    return () => clearInterval(interval);
  }, [load]);

  // Fetch settings on mount
  useEffect(() => {
    api.getSettings()
      .then((cfg) => {
        if (cfg) {
          setCutoffHour(cfg.cutoffHour);
          setCutoffMinute(cfg.cutoffMinute);
        }
      })
      .catch((err) => console.warn("Failed to load settings:", err));
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsBusy(true);
    setSettingsStatus("");
    try {
      await api.updateSettings({ cutoffHour, cutoffMinute });
      setSettingsStatus("✓ Settings saved successfully!");
      load();
      setTimeout(() => setSettingsStatus(""), 3000);
    } catch (err) {
      setSettingsStatus(`✕ Error: ${err.message}`);
    } finally {
      setSettingsBusy(false);
    }
  };

  const exportToCSV = () => {
    if (records.length === 0) {
      alert("No attendance records to export for this selection.");
      return;
    }

    const headers = ["Student Name", "Student ID", "Class", "Course Session", "Date", "Scan Time", "Status"];
    
    const rows = records.map((r) => {
      const student = students.find((s) => s.id === r.studentId);
      const schoolId = student ? student.studentId : "N/A";
      return [
        r.studentName,
        schoolId,
        r.className,
        r.courseCode || "General",
        r.date,
        new Date(r.timestamp).toLocaleTimeString(),
        r.status
      ];
    });

    const csvContent = [headers, ...rows]
      .map((row) => row.map((val) => `"${val.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    
    const filenameCourse = selectedCourseId ? `${selectedCourseId}_` : "";
    link.setAttribute("download", `atu_attendance_report_${filenameCourse}${selectedDate}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Create a photo mapping helper
  const getStudentPhoto = (studentId) => {
    const student = students.find((s) => s.id === studentId);
    return student ? student.facePhoto : null;
  };

  return (
    <div className="card">
      {/* Dashboard Top bar Controls */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem", marginBottom: "1.5rem" }}>
        <h2>ATU Lecture Dashboard</h2>
        
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          
          {/* Course Session Filter */}
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            style={{ width: "180px", background: "rgba(10, 15, 30, 0.6)", padding: "0.45rem 0.75rem" }}
          >
            <option value="">All Course Modules</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} - {c.title}
              </option>
            ))}
          </select>

          {/* Date Picker */}
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ width: "145px", background: "rgba(10, 15, 30, 0.6)", padding: "0.45rem 0.75rem" }}
          />

          <button className="secondary-btn" onClick={exportToCSV} title="Download CSV report">
            📥 Export CSV
          </button>

          <button className="secondary-btn" onClick={() => setShowSettings(!showSettings)} title="Terminal Settings">
            ⚙️ Cutoff Time
          </button>

          <button className="secondary-btn" onClick={load} style={{ padding: "0.55rem" }}>
            🔄
          </button>
        </div>
      </div>
      
      {error && <div className="error">{error}</div>}

      {/* Slide-out Settings Card */}
      {showSettings && (
        <div className="card" style={{ background: "rgba(6, 182, 212, 0.05)", border: "1px dashed var(--secondary)", margin: "0 0 1.5rem" }}>
          <h3 style={{ color: "var(--secondary)", fontSize: "1.1rem", marginBottom: "0.75rem" }}>Late Cutoff Settings</h3>
          <p className="muted" style={{ marginBottom: "1rem" }}>
            Attendance logged after this cutoff time will be automatically flagged as "late". Updates are applied instantly to new scans.
          </p>
          
          <form onSubmit={handleSaveSettings} style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <label className="muted">Cutoff Hour (0-23):</label>
              <input
                type="number"
                min="0"
                max="23"
                value={cutoffHour}
                onChange={(e) => setCutoffHour(parseInt(e.target.value) || 0)}
                style={{ width: "80px", textAlign: "center" }}
              />
            </div>
            
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <label className="muted">Minute (0-59):</label>
              <input
                type="number"
                min="0"
                max="59"
                value={cutoffMinute}
                onChange={(e) => setCutoffMinute(parseInt(e.target.value) || 0)}
                style={{ width: "80px", textAlign: "center" }}
              />
            </div>

            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <button type="submit" disabled={settingsBusy || seederBusy} style={{ background: "linear-gradient(135deg, var(--secondary), var(--secondary-hover))" }}>
                {settingsBusy ? "Saving..." : "Save Settings"}
              </button>
              {settingsStatus && (
                <span style={{ fontSize: "0.9rem", color: settingsStatus.startsWith("✕") ? "var(--danger)" : "var(--primary)" }}>
                  {settingsStatus}
                </span>
              )}
            </div>
          </form>

          {/* Seed demo data row */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", marginTop: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
            <div>
              <span className="muted" style={{ fontSize: "0.85rem" }}>Demo Testing: Populate simulated students & logs</span>
            </div>
            <button 
              type="button" 
              onClick={handleSeedData} 
              disabled={settingsBusy || seederBusy}
              style={{ background: "linear-gradient(135deg, var(--danger), #dc2626)", fontSize: "0.85rem", padding: "0.5rem 1rem" }}
            >
              {seederBusy ? "Seeding Database..." : "⚡ Seed Demo Data"}
            </button>
          </div>
        </div>
      )}

      {/* Statistics Card Grid */}
      {stats && (
        <div className="stat-grid">
          <StatCard 
            label={selectedCourseId ? "Module Registered" : "Enrolled Students"} 
            value={stats.totalStudents} 
            className="stat-card-enrolled"
          />
          <StatCard 
            label="Present Today" 
            value={stats.present} 
            className="stat-card-present"
          />
          <StatCard 
            label="Absent" 
            value={stats.absent} 
            className="stat-card-absent"
          />
          <StatCard 
            label="On-time" 
            value={stats.onTime} 
            className="stat-card-present"
          />
          <StatCard 
            label="Late" 
            value={stats.late} 
            className="stat-card-late"
          />
        </div>
      )}

      {/* Attendance Log Table */}
      <h3 style={{ marginTop: "2rem", marginBottom: "1rem", color: "#ffffff" }}>
        Attendance Log: {new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        {selectedCourseId && ` — Course: ${courses.find(c => c.id === selectedCourseId)?.code || ""}`}
      </h3>
      {records.length === 0 ? (
        <p className="muted" style={{ padding: "2.5rem 0", textAlign: "center", border: "1px dashed var(--border)", borderRadius: "8px" }}>
          No scans recorded for this selection.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Profile</th>
                <th>Student</th>
                <th>Student ID</th>
                <th>Class</th>
                <th>Module Session</th>
                <th>Scan Time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const facePhoto = getStudentPhoto(r.studentId);
                const student = students.find((s) => s.id === r.studentId);
                const schoolId = student ? student.studentId : "N/A";
                return (
                  <tr key={r.id}>
                    <td>
                      {facePhoto ? (
                        <img
                          src={facePhoto}
                          alt={r.studentName}
                          className="student-list-item-photo"
                          style={{ width: "36px", height: "36px" }}
                        />
                      ) : (
                        <div className="student-list-item-photo" style={{ width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>
                          👤
                        </div>
                      )}
                    </td>
                    <td>
                      <strong style={{ color: "#ffffff" }}>{r.studentName}</strong>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>{schoolId}</td>
                    <td>{r.className}</td>
                    <td>
                      <span className="badge" style={{ background: "rgba(6, 182, 212, 0.08)", color: "var(--secondary)", border: "1px solid rgba(6, 182, 212, 0.2)" }}>
                        {r.courseCode || "General"}
                      </span>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                      {new Date(r.timestamp).toLocaleTimeString()}
                    </td>
                    <td>
                      <span className={`badge ${r.status === "late" ? "badge-late" : "badge-ontime"}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, className }) {
  return (
    <div className={`stat-card ${className}`}>
      <div className="stat-value">{value ?? "—"}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
