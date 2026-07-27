// api.js - small fetch wrapper for the backend API.
// Vite's dev-server proxy (see vite.config.js) forwards "/api/*" to
// http://localhost:5002, so these calls work in dev without CORS setup.

const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request to ${path} failed`);
  return data;
}

export const api = {
  getStudents: () => request("/students"),
  enrollStudent: (student) =>
    request("/students", { method: "POST", body: JSON.stringify(student) }),
  deleteStudent: (id) => request(`/students/${id}`, { method: "DELETE" }),

  getAttendance: (date, all = false, courseId = "") => {
    const params = [];
    if (all) params.push("all=true");
    else if (date) params.push(`date=${date}`);
    if (courseId) params.push(`courseId=${courseId}`);
    const query = params.length > 0 ? "?" + params.join("&") : "";
    return request(`/attendance${query}`);
  },
  getStats: (date, courseId = "") => {
    const params = [];
    if (date) params.push(`date=${date}`);
    if (courseId) params.push(`courseId=${courseId}`);
    const query = params.length > 0 ? "?" + params.join("&") : "";
    return request(`/attendance/stats${query}`);
  },
  simulateScan: (studentId, courseId = "") =>
    request("/attendance/scan", { method: "POST", body: JSON.stringify({ studentId, courseId }) }),

  getCourses: () => request("/courses"),
  createCourse: (course) =>
    request("/courses", { method: "POST", body: JSON.stringify(course) }),
  deleteCourse: (id) => request(`/courses/${id}`, { method: "DELETE" }),

  getSettings: () => request("/settings"),
  updateSettings: (settings) =>
    request("/settings", { method: "POST", body: JSON.stringify(settings) }),

  login: (pin) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ pin }) }),

  seedData: () => request("/auth/seed", { method: "POST" })
};
