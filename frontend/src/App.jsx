import { useState, useEffect } from "react";
import Dashboard from "./components/Dashboard.jsx";
import Students from "./components/Students.jsx";
import Courses from "./components/Courses.jsx";
import ScanSimulator from "./components/ScanSimulator.jsx";
import { api } from "./api";

const TABS = [
  { key: "dashboard", label: "Dashboard", component: Dashboard, secured: true },
  { key: "students", label: "Enrollment", component: Students, secured: true },
  { key: "courses", label: "ATU Courses", component: Courses, secured: true },
  { key: "scan", label: "Biometric Terminal", component: ScanSimulator, secured: false }
];

export default function App() {
  const [active, setActive] = useState("dashboard");
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem("adminAuth") === "true";
  });
  const [activeLecturer, setActiveLecturer] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("activeLecturer")) || null;
    } catch {
      return null;
    }
  });

  const handleLoginSuccess = (lecturer) => {
    sessionStorage.setItem("adminAuth", "true");
    if (lecturer) {
      sessionStorage.setItem("activeLecturer", JSON.stringify(lecturer));
      setActiveLecturer(lecturer);
    }
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("adminAuth");
    sessionStorage.removeItem("activeLecturer");
    setActiveLecturer(null);
    setIsAuthenticated(false);
    // Switch to public tab on lock
    setActive("scan");
  };

  const activeTab = TABS.find((t) => t.key === active);
  const ActiveComponent = activeTab.component;

  return (
    <div className="app">
      <header className="app-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.2rem 0.6rem", background: "rgba(37, 99, 235, 0.15)", border: "1px solid rgba(37, 99, 235, 0.3)", borderRadius: "20px", fontSize: "0.75rem", fontWeight: "600", color: "#93c5fd", marginBottom: "0.4rem" }}>
              <span>🏛️ ACCRA TECHNICAL UNIVERSITY</span>
            </div>
            <h1>Smart Biometric Attendance System</h1>
            <p className="subtitle">Multimodal biometric verification (Fingerprint, Face ID, QR Scan) — pilot build</p>
          </div>
          {isAuthenticated && (
            <div className="header-actions">
              <span style={{ fontSize: "0.85rem", color: "#fde047", background: "rgba(245, 158, 11, 0.15)", padding: "0.35rem 0.85rem", borderRadius: "20px", border: "1px solid rgba(245, 158, 11, 0.3)", fontWeight: 600 }}>
                ● {activeLecturer ? `${activeLecturer.name}` : "Lecturer Session Active"}
              </span>
              <button className="secondary-btn" onClick={handleLogout} style={{ padding: "0.45rem 0.9rem", fontSize: "0.8rem", borderRadius: "8px" }}>
                🔒 Lock Terminal
              </button>
            </div>
          )}
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${active === t.key ? "tab-active" : ""}`}
            onClick={() => setActive(t.key)}
          >
            {t.secured && !isAuthenticated ? `🔒 ${t.label}` : t.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {activeTab.secured && !isAuthenticated ? (
          <AdminLogin onLoginSuccess={handleLoginSuccess} />
        ) : (
          <ActiveComponent />
        )}
      </main>
    </div>
  );
}

function AdminLogin({ onLoginSuccess }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lecturersData, setLecturersData] = useState([]);

  useEffect(() => {
    // Prefetch PINs and lecturer profiles when login screen displays
    api.getSettings()
      .then((data) => {
        if (data && data.lecturers) {
          setLecturersData(data.lecturers);
        }
      })
      .catch((err) => {
        console.warn("Failed to prefetch lecturer PINs:", err);
      });
  }, []);

  const handleKeyPress = (num) => {
    setError("");
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      if (newPin.length === 4) {
        submitPin(newPin);
      }
    }
  };

  const handleBackspace = () => {
    setError("");
    setPin((prev) => prev.slice(0, -1));
  };

  const submitPin = async (enteredPin) => {
    // Instant client-side check if prefetch is loaded
    if (lecturersData.length > 0) {
      const matched = lecturersData.find((l) => l.pin.toString() === enteredPin.toString());
      if (matched) {
        onLoginSuccess(matched);
        return;
      } else if (enteredPin.toString() === "1234") {
        onLoginSuccess({ id: "admin-01", name: "System Admin", department: "ATU Administration" });
        return;
      } else {
        setShake(true);
        setError("Invalid administrator or lecturer PIN.");
        setPin("");
        setTimeout(() => setShake(false), 500);
        return;
      }
    }

    // Fallback request to backend API
    setBusy(true);
    try {
      const res = await api.login(enteredPin);
      onLoginSuccess(res.lecturer);
    } catch (err) {
      setShake(true);
      setError(err.message || "Invalid administrator PIN.");
      setPin("");
      setTimeout(() => setShake(false), 500);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-backdrop">
      <div className={`login-card ${shake ? "shake-element" : ""}`}>
        <h3 style={{ color: "#ffffff", fontSize: "1.25rem", marginBottom: "0.25rem" }}>Lecturer Authentication</h3>
        <p className="muted" style={{ fontSize: "0.85rem", marginBottom: "1rem" }}>
          Enter administrator PIN to access dashboard, course settings, and student enrollment.
        </p>
        
        <div className="pin-display-dots">
          {[0, 1, 2, 3].map((idx) => (
            <div key={idx} className={`pin-dot ${pin.length > idx ? "pin-dot-filled" : ""}`} />
          ))}
        </div>

        {error && (
          <div className="error" style={{ margin: "0 0 1.5rem", padding: "0.5rem 0.8rem", fontSize: "0.8rem", justifyContent: "center" }}>
            {error}
          </div>
        )}

        <div className="pin-pad-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button key={num} type="button" className="pin-key" onClick={() => handleKeyPress(num.toString())} disabled={busy}>
              {num}
            </button>
          ))}
          <button type="button" className="pin-key pin-key-back" onClick={() => setPin("")} disabled={busy} style={{ fontSize: "0.85rem" }}>
            CLEAR
          </button>
          <button type="button" className="pin-key" onClick={() => handleKeyPress("0")} disabled={busy}>
            0
          </button>
          <button type="button" className="pin-key pin-key-back" onClick={handleBackspace} disabled={busy}>
            ⌫
          </button>
        </div>
        
        <p className="muted" style={{ fontSize: "0.75rem", marginTop: "1.5rem" }}>
          Default Access PIN: <strong style={{ color: "var(--secondary)" }}>1234</strong>
        </p>
      </div>
    </div>
  );
}
