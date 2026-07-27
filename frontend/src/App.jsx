import { useState } from "react";
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

  const handleLoginSuccess = () => {
    sessionStorage.setItem("adminAuth", "true");
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("adminAuth");
    setIsAuthenticated(false);
    // Switch to public tab on lock
    setActive("scan");
  };

  const activeTab = TABS.find((t) => t.key === active);
  const ActiveComponent = activeTab.component;

  return (
    <div className="app">
      <header className="app-header">
        <div>
          <h1>Smart Biometric Attendance System</h1>
          <p className="subtitle">Multimodal biometric verification (Fingerprint, Face ID, QR Scan) — pilot build</p>
        </div>
        {isAuthenticated && (
          <div className="header-actions">
            <span style={{ fontSize: "0.85rem", color: "var(--primary)", fontWeight: 500 }}>● Lecturer Session</span>
            <button className="secondary-btn" onClick={handleLogout} style={{ padding: "0.4rem 0.8rem", fontSize: "0.8rem" }}>
              🔒 Lock Terminal
            </button>
          </div>
        )}
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
    setBusy(true);
    try {
      await api.login(enteredPin);
      onLoginSuccess();
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
