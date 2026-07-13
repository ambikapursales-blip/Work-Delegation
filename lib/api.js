import axios from "axios";

export const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  timeout: 10000, // 10 second timeout
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Auth endpoints
export const authAPI = {
  login: (email, password) => api.post("/auth/login", { email, password }),
  register: (data) => api.post("/auth/register", data),
  getMe: () => api.get("/auth/me"),
  logout: () => api.post("/auth/logout"),
  updateProfile: (data) => api.put("/auth/profile", data),
  changePassword: (currentPassword, newPassword) =>
    api.put("/auth/change-password", { currentPassword, newPassword }),
  updateLocation: (lat, lng, address) =>
    api.post("/auth/location", { lat, lng, address }),
  forgotPassword: (email) => api.post("/auth/forgot-password", { email }),
  resetPassword: (email, otp, newPassword) =>
    api.post("/auth/reset-password", { email, otp, newPassword }),
};

// Users API
export const usersAPI = {
  getAll: (filters) => api.get("/users", { params: filters }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post("/users", data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
  getTeam: (id) => api.get(`/users/${id}/team`),
};

// DWR API - enhanced
export const dwrAPI = {
  getAll: (filters) => api.get("/dwr", { params: filters }),
  getById: (id) => api.get(`/dwr/${id}`),
  create: (data) => api.post("/dwr", data),
  update: (id, data) => api.put(`/dwr/${id}`, data),
  getPendingReview: (filters) =>
    api.get("/dwr/pending-review", { params: filters }),
  approve: (id, data) => api.put(`/dwr/${id}/approve`, data),
  reject: (id, data) => api.put(`/dwr/${id}/reject`, data),
};

// Attendance API
export const attendanceAPI = {
  getAll: (filters) => api.get("/attendance", { params: filters }),
  getById: (id) => api.get(`/attendance/${id}`),
  mark: (data) => api.post("/attendance", data),
};

// Events API
export const eventsAPI = {
  getAll: (filters) => api.get("/events", { params: filters }),
  getById: (id) => api.get(`/events/${id}`),
  create: (data) => api.post("/events", data),
  update: (id, data) => api.put(`/events/${id}`, data),
  delete: (id) => api.delete(`/events/${id}`),
};

// Notifications API
export const notificationsAPI = {
  getAll: (filters) => api.get("/notifications", { params: filters }),
  getById: (id) => api.get(`/notifications/${id}`),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  delete: (id) => api.delete(`/notifications/${id}`),
};

// Activity API
export const activityAPI = {
  getAll: (filters) => api.get("/activity", { params: filters }),
  getById: (id) => api.get(`/activity/${id}`),
};

// Dashboard API
export const dashboardAPI = {
  getUserStats: (userId) => api.get(`/dashboard/user/${userId}`),
  getRecentActivities: () => api.get("/activity"),
};

// Task API - with complete CRUD
export const taskAPI = {
  getTasks: (filters) => api.get("/tasks", { params: filters }),
  getTask: (id) => api.get(`/tasks/${id}`),
  createTask: (data) => api.post("/tasks", data),
  updateTask: (id, data) => api.put(`/tasks/${id}`, data),
  deleteTask: (id) => api.delete(`/tasks/${id}`),
  reassign: (id, data) => api.put(`/tasks/${id}/reassign`, data),
  escalate: (id, data) => api.put(`/tasks/${id}/escalate`, data),
  addComment: (id, data) => api.post(`/tasks/${id}/comments`, data),
};

// Action Center API
export const actionCenterAPI = {
  getItems: (filters) => api.get("/action-center", { params: filters }),
  respondExtension: (data) => api.post("/action-center/extend-response", data),
};

// Team API
export const teamAPI = {
  getMembers: () => api.get("/team/members"),
  getStats: () => api.get("/team/stats"),
  getEmployeeTasks: (userId, filters) =>
    api.get(`/team/${userId}/tasks`, { params: filters }),
  getEmployeeActivity: (userId, filters) =>
    api.get(`/team/${userId}/activity`, { params: filters }),
  getEmployeeDWRs: (userId, filters) =>
    api.get(`/team/${userId}/dwr`, { params: filters }),
  getEmployeePerformance: (userId, filters) =>
    api.get(`/team/${userId}/performance`, { params: filters }),
};

// Performance API - enhanced
export const performanceAPI = {
  getAll: (filters) => api.get("/performance", { params: filters }),
  update: (userId, data) => api.put(`/performance/${userId}`, data),
  getLeaderboard: (filters) =>
    api.get("/performance/leaderboard", { params: filters }),
  compare: (filters) => api.get("/performance/compare", { params: filters }),
  getTrends: (userId, filters) =>
    api.get(`/performance/${userId}/trends`, { params: filters }),
};

// Reports API
export const reportsAPI = {
  getTasks: (filters) => api.get("/reports/tasks", { params: filters }),
  getDWR: (filters) => api.get("/reports/dwr", { params: filters }),
  getAttendance: (filters) =>
    api.get("/reports/attendance", { params: filters }),
  getPerformance: (filters) =>
    api.get("/reports/performance", { params: filters }),
  getActivity: (filters) => api.get("/reports/activity", { params: filters }),
  getDashboardAnalytics: (filters) =>
    api.get("/reports/dashboard-analytics", { params: filters }),
};
