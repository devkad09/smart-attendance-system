import { useEffect, useState, useRef } from "react";
import { api } from "../api";
import { Html5Qrcode } from "html5-qrcode";

export default function ScanSimulator() {
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [activeMode, setActiveMode] = useState("fingerprint"); // fingerprint, qr, face
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [lastResult, setLastResult] = useState(null);
  
  // HUD Status Text for scanner
  const [hudText, setHudText] = useState("System Ready");

  // Camera & Face ID refs
  const videoRef = useRef(null);
  const faceStreamRef = useRef(null);
  const [faceScanActive, setFaceScanActive] = useState(false);

  // QR Code scanner instance reference
  const qrScannerRef = useRef(null);
  const [qrScanActive, setQrScanActive] = useState(false);

  useEffect(() => {
    // Load students and courses
    Promise.all([api.getStudents(), api.getCourses()])
      .then(([stData, crData]) => {
        setStudents(stData);
        setCourses(crData);
        
        if (stData.length > 0) {
          setSelectedStudentId(stData[0].id);
        }
        if (crData.length > 0) {
          setSelectedCourseId(crData[0].id);
        }
      })
      .catch((err) => setError(err.message));

    return () => {
      cleanupCameras();
    };
  }, []);

  const cleanupCameras = () => {
    if (faceStreamRef.current) {
      faceStreamRef.current.getTracks().forEach(track => track.stop());
      faceStreamRef.current = null;
    }
    setFaceScanActive(false);

    if (qrScannerRef.current) {
      try {
        qrScannerRef.current.stop().then(() => {
          qrScannerRef.current = null;
          setQrScanActive(false);
        }).catch(err => {
          console.warn("Error stopping QR Scanner: ", err);
          qrScannerRef.current = null;
          setQrScanActive(false);
        });
      } catch (e) {
        qrScannerRef.current = null;
        setQrScanActive(false);
      }
    }
  };

  useEffect(() => {
    cleanupCameras();
    setLastResult(null);
    setError("");
    
    if (activeMode === "qr") {
      setHudText("Camera Initialization...");
      startQrScanner();
    } else if (activeMode === "face") {
      setHudText("Position Face inside guide");
      startFaceCamera();
    } else {
      setHudText("Awaiting verification");
    }
  }, [activeMode]);

  // Sound effects helper using Web Audio API
  const playBeep = (isNewScan = true) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (isNewScan) {
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
        
        setTimeout(() => {
          const ctx2 = new AudioCtx();
          const osc2 = ctx2.createOscillator();
          const gain2 = ctx2.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx2.destination);
          osc2.type = "sine";
          osc2.frequency.setValueAtTime(1174, ctx2.currentTime);
          gain2.gain.setValueAtTime(0.05, ctx2.currentTime);
          osc2.start();
          osc2.stop(ctx2.currentTime + 0.1);
        }, 100);
      } else {
        osc.type = "triangle";
        osc.frequency.setValueAtTime(330, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      }
    } catch (e) {
      console.warn("AudioContext blocked or failed: ", e);
    }
  };

  // 1. Simulate Fingerprint scan
  const handleFingerprintScan = async () => {
    if (!selectedStudentId) {
      setError("Please enroll a student first.");
      return;
    }
    setBusy(true);
    setError("");
    setHudText("Scanning fingerprint...");
    
    setTimeout(async () => {
      try {
        const result = await api.simulateScan(selectedStudentId, selectedCourseId);
        setLastResult(result);
        setHudText("Match Found");
        playBeep(!result.message);
      } catch (err) {
        setError(err.message);
        setHudText("Scan Failed");
        playBeep(false);
      } finally {
        setBusy(false);
      }
    }, 1200);
  };

  // 2. Setup & start QR Scanner
  const startQrScanner = async () => {
    setTimeout(async () => {
      try {
        const scanner = new Html5Qrcode("qr-reader");
        qrScannerRef.current = scanner;
        
        await scanner.start(
          { facingMode: "user" },
          {
            fps: 15,
            qrbox: (width, height) => {
              const min = Math.min(width, height);
              return { width: min * 0.7, height: min * 0.7 };
            }
          },
          async (decodedText) => {
            cleanupCameras();
            setBusy(true);
            setHudText("QR Detected. Logging...");
            try {
              const result = await api.simulateScan(decodedText, selectedCourseId);
              setLastResult(result);
              setHudText("Verification Success");
              playBeep(!result.message);
            } catch (err) {
              setError("QR Code does not match any enrolled student ID.");
              setHudText("Invalid ID");
              playBeep(false);
            } finally {
              setBusy(false);
              setTimeout(() => {
                if (activeMode === "qr" && !qrScannerRef.current) {
                  startQrScanner();
                }
              }, 3500);
            }
          },
          (errorMessage) => {
            // Silence debug camera logs
          }
        );
        setQrScanActive(true);
        setHudText("Scan QR Code");
      } catch (err) {
        console.error("Camera init error: ", err);
        setError("Failed to open camera. Make sure webcam is enabled and not in use.");
        setHudText("Camera Error");
      }
    }, 100);
  };

  // 3. Setup Face ID camera feed
  const startFaceCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 400, height: 300, facingMode: "user" }
      });
      faceStreamRef.current = stream;
      setFaceScanActive(true);
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      setError("Cannot access webcam. Face ID requires camera permissions.");
      setHudText("Camera Error");
    }
  };

  // Run Face ID biometric matching
  const handleFaceIDVerify = async () => {
    if (!selectedStudentId) {
      setError("Select a student to match.");
      return;
    }
    if (!faceScanActive) {
      setError("Webcam not running. Refresh or grant permissions.");
      return;
    }
    
    setBusy(true);
    setError("");
    setHudText("Detecting face...");
    
    setTimeout(() => {
      setHudText("Analyzing landmarks...");
    }, 1000);

    setTimeout(() => {
      setHudText("Matching template...");
    }, 2000);

    setTimeout(async () => {
      try {
        const student = students.find(s => s.id === selectedStudentId);
        if (student && !student.facePhoto) {
          throw new Error("This student has no enrolled Face ID template. Capture photo first in Enrollment.");
        }
        
        const result = await api.simulateScan(selectedStudentId, selectedCourseId);
        setLastResult(result);
        setHudText("Face ID Verified");
        playBeep(!result.message);
      } catch (err) {
        setError(err.message);
        setHudText("Face Match Failed");
        playBeep(false);
      } finally {
        setBusy(false);
      }
    }, 3000);
  };

  const getActiveStudent = () => {
    return students.find(s => s.id === selectedStudentId) || null;
  };

  const getActiveCourse = () => {
    return courses.find(c => c.id === selectedCourseId) || null;
  };

  // Verify if student is enrolled in active course
  const isStudentEnrolledInCourse = () => {
    const student = getActiveStudent();
    if (!student || !selectedCourseId) return true;
    return student.courseIds && student.courseIds.includes(selectedCourseId);
  };

  return (
    <div className="card">
      <div className="terminal-layout">
        {/* Left Column: Biometric Camera Viewport */}
        <div>
          <h2>ATU Biometric Terminal</h2>
          <p className="muted" style={{ marginBottom: "1.5rem" }}>
            Select the active course session, then scan student fingerprint, QR code, or verify via Face ID.
          </p>

          <div className="scan-mode-tabs">
            <button 
              className={`scan-mode-btn ${activeMode === "fingerprint" ? "scan-mode-btn-active" : ""}`}
              onClick={() => setActiveMode("fingerprint")}
            >
              👆 Fingerprint
            </button>
            <button 
              className={`scan-mode-btn ${activeMode === "qr" ? "scan-mode-btn-active" : ""}`}
              onClick={() => setActiveMode("qr")}
            >
              📷 QR Scanner
            </button>
            <button 
              className={`scan-mode-btn ${activeMode === "face" ? "scan-mode-btn-active" : ""}`}
              onClick={() => setActiveMode("face")}
            >
              👤 Face ID
            </button>
          </div>

          {/* Biometric Scanner Viewport */}
          <div className="scanner-view-container">
            {activeMode === "fingerprint" && (
              <div 
                className={`fingerprint-scanner ${busy ? "fingerprint-scanner-scanning" : ""}`}
                onClick={!busy ? handleFingerprintScan : null}
              >
                <svg className="fingerprint-icon" viewBox="0 0 24 24">
                  <path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 20,12C20,13.25 19.72,14.44 19.22,15.5L17.5,14.65C17.82,13.82 18,12.93 18,12A6,6 0 0,0 12,6A6,6 0 0,0 6,12C6,12.6 6.1,13.2 6.28,13.77L4.54,14.34C4.19,13.6 4,12.82 4,12A8,8 0 0,1 12,4M12,8A4,4 0 0,1 16,12C16,12.44 15.93,12.87 15.8,13.27L14,12.37C14,12.25 14,12.13 14,12A2,2 0 0,0 12,10A2,2 0 0,0 10,12C10,12.4 10.15,12.77 10.4,13.06L8.83,14.16C8.31,13.56 8,12.82 8,12A4,4 0 0,1 12,8M12,12A1,1 0 0,0 13,11A1,1 0 0,0 12,10A1,1 0 0,0 11,11A1,1 0 0,0 12,12M12,14A2,2 0 0,1 10,16C9.17,16 8.44,15.5 8.13,14.74L6.39,15.31C6.96,16.71 8.35,17.7 10,18V20H14V18.19C15.8,17.9 17.18,16.8 17.61,15.26L15.9,14.42C15.65,15.33 14.9,16 14,16A2,2 0 0,1 12,14" />
                </svg>
                <div className="scan-line"></div>
                <p className="muted" style={{ fontSize: "0.85rem", textAlign: "center" }}>
                  {busy ? "Reading fingerprint sensor..." : "Click scanner to simulate fingerprint touch"}
                </p>
              </div>
            )}

            {activeMode === "qr" && (
              <div style={{ width: "100%", height: "100%", position: "relative" }}>
                <div id="qr-reader" style={{ width: "100%", height: "100%" }}></div>
                {qrScanActive && (
                  <div className="scanner-overlay">
                    <div style={{ border: "2px solid var(--primary)", width: "230px", height: "230px", position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", borderRadius: "12px", boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.55)" }}></div>
                    <div className="scan-line"></div>
                  </div>
                )}
              </div>
            )}

            {activeMode === "face" && (
              <div style={{ width: "100%", height: "100%", position: "relative" }}>
                {faceScanActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="scanner-camera-feed"
                    style={{ transform: "scaleX(-1)" }}
                  />
                ) : (
                  <div style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>Initializing face sensor...</div>
                )}
                {faceScanActive && (
                  <div className="scanner-overlay">
                    <div className="face-id-oval">
                      <div className="face-id-mesh"></div>
                    </div>
                    {busy && <div className="scan-line"></div>}
                  </div>
                )}
              </div>
            )}

            {/* HUD Status Overlay */}
            <div className="hud-overlay">
              <div className="hud-dot" style={{ backgroundColor: busy ? "var(--primary)" : "var(--secondary)" }}></div>
              <span>{hudText}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Course/Student Selector, Details, Logs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div className="card" style={{ background: "rgba(0, 0, 0, 0.25)", padding: "1.25rem", border: "1px solid var(--border)", margin: 0, height: "100%" }}>
            <h3 style={{ fontSize: "1.1rem", marginBottom: "0.75rem" }}>Terminal Settings</h3>
            
            {students.length === 0 ? (
              <p className="muted" style={{ fontSize: "0.9rem" }}>Please enroll students and setup courses first.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                
                {/* 1. Select Active Course Session */}
                <div>
                  <label className="muted" style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.8rem", textTransform: "uppercase", fontWeight: 600 }}>
                    Active Course Session (Lecturer)
                  </label>
                  <select
                    value={selectedCourseId}
                    onChange={(e) => {
                      setSelectedCourseId(e.target.value);
                      setLastResult(null);
                      setError("");
                    }}
                    style={{ width: "100%", borderColor: "var(--secondary)" }}
                    disabled={busy}
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} - {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 2. Select Student Profile (For simulation / Face matching) */}
                <div>
                  <label className="muted" style={{ display: "block", marginBottom: "0.35rem", fontSize: "0.8rem", textTransform: "uppercase" }}>
                    Select Student Profile
                  </label>
                  <select 
                    value={selectedStudentId} 
                    onChange={(e) => {
                      setSelectedStudentId(e.target.value);
                      setLastResult(null);
                      setError("");
                    }}
                    style={{ width: "100%" }}
                    disabled={busy}
                  >
                    {students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.studentId})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Profile info preview & Course Registration Check */}
                {getActiveStudent() && (
                  <div className="student-profile-badge" style={{ padding: "0.75rem", background: "rgba(255,255,255,0.03)", borderRadius: "8px", border: "1px solid var(--border)", flexDirection: "column", alignItems: "flex-start", gap: "0.5rem" }}>
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                      {getActiveStudent().facePhoto ? (
                        <img 
                          src={getActiveStudent().facePhoto} 
                          alt="Profile" 
                          style={{ width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover", border: "1.5px solid var(--secondary)" }}
                        />
                      ) : (
                        <div style={{ width: "42px", height: "42px", borderRadius: "50%", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem" }}>👤</div>
                      )}
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#ffffff" }}>{getActiveStudent().name}</div>
                        <div className="muted" style={{ fontSize: "0.8rem" }}>Class: {getActiveStudent().className}</div>
                      </div>
                    </div>

                    {/* Enrollment Validation Alert */}
                    <div style={{ width: "100%", borderTop: "1px solid var(--border)", paddingTop: "0.4rem", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.75rem" }}>
                      <span style={{ color: "var(--text-muted)" }}>Course status:</span>
                      {isStudentEnrolledInCourse() ? (
                        <span style={{ color: "var(--primary)", fontWeight: 600 }}>✓ Registered</span>
                      ) : (
                        <span style={{ color: "var(--danger)", fontWeight: 600 }} title="Student did not sign up for this course module.">
                          ⚠ Not Registered
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Verification Trigger Button */}
                {activeMode !== "qr" && (
                  <button 
                    onClick={activeMode === "face" ? handleFaceIDVerify : handleFingerprintScan}
                    disabled={busy}
                    style={{ width: "100%", padding: "0.75rem", background: activeMode === "face" ? "linear-gradient(135deg, var(--secondary), var(--secondary-hover))" : "linear-gradient(135deg, var(--primary), var(--primary-hover))" }}
                  >
                    {busy ? "Verifying..." : activeMode === "face" ? "👤 Verify Face ID" : "👆 Simulate Fingerprint"}
                  </button>
                )}
                
                {activeMode === "qr" && (
                  <div style={{ padding: "0.75rem", background: "rgba(6, 182, 212, 0.05)", borderRadius: "8px", border: "1px dashed rgba(6, 182, 212, 0.2)", fontSize: "0.85rem", textAlign: "center" }}>
                    <p style={{ color: "var(--secondary)", fontWeight: 500, marginBottom: "0.25rem" }}>QR scan active for {getActiveCourse() ? getActiveCourse().code : "Session"}</p>
                    <p className="muted">Show the student's enrollment QR card to the webcam to scan.</p>
                  </div>
                )}
              </div>
            )}

            {error && <div className="error" style={{ padding: "0.6rem 0.8rem", fontSize: "0.85rem" }}>{error}</div>}

            {/* Scan Output Toast Display */}
            {lastResult && (
              <div className="scan-result toast-success" style={{ margin: "1rem 0 0", padding: "0.75rem 1rem" }}>
                {lastResult.message ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span style={{ fontSize: "1.2rem" }}>🔁</span>
                    <div>
                      <p style={{ fontWeight: 600, color: "#ffffff" }}>Already Logged</p>
                      <p className="muted" style={{ fontSize: "0.75rem" }}>Student scanned today for {lastResult.record.courseCode}.</p>
                    </div>
                  </div>
                ) : (
                  <div className="scan-result-card">
                    <div style={{ fontSize: "1.5rem" }}>✅</div>
                    <div className="scan-result-details">
                      <div className="scan-result-name">{lastResult.studentName}</div>
                      <div className="scan-result-meta" style={{ display: "flex", flexDirection: "column", gap: "0.1rem" }}>
                        <span style={{ color: "var(--secondary)" }}>
                          MODULE: {lastResult.courseCode} ({lastResult.courseTitle})
                        </span>
                        <span>
                          STATUS:{" "}
                          <span className={`badge ${lastResult.status === "late" ? "badge-late" : "badge-ontime"}`}>
                            {lastResult.status}
                          </span>
                        </span>
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                        Logged at {new Date(lastResult.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
