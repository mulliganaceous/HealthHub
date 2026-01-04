import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authService = {
  login: (email, password) => api.post("/login", { email, password }),
  register: (email, password, role) =>
    api.post("/users", { email, password, role }),
};

export const userService = {
  getCurrentUser: () => api.get("/users/me"),
  register: (userData) => api.post("/register", userData),
};

export const doctorService = {
  getDoctors: () => api.get("/doctors"),
  getDoctor: (id) => api.get(`/doctors/${id}`),
  createDoctor: (data) => api.post("/doctors", data),
  updateDoctor: (id, data) => api.put(`/doctors/${id}`, data),
  deleteDoctor: (id) => api.delete(`/doctors/${id}`),
};

export const patientService = {
  getPatients: () => api.get("/patients"),
  getPatient: (id) => api.get(`/patients/${id}`),
  createPatient: (data) => api.post("/patients", data),
  updatePatient: (id, data) => api.put(`/patients/${id}`, data),
  deletePatient: (id) => api.delete(`/patients/${id}`),
};

export const appointmentService = {
  getAppointments: () => api.get("/appointments"),
  getAppointment: (id) => api.get(`/appointments/${id}`),
  createAppointment: (data) => api.post("/appointments", data),
  updateAppointment: (id, data) => api.put(`/appointments/${id}`, data),
  deleteAppointment: (id) => api.delete(`/appointments/${id}`),
};

export const transcriptionService = {
  getTranscriptions: () => api.get("/transcriptions"),
  getTranscription: (id) => api.get(`/transcriptions/${id}`),
  createTranscription: (data) => api.post("/transcriptions", data),
  updateTranscription: (id, data) => api.put(`/transcriptions/${id}`, data),
  deleteTranscription: (id) => api.delete(`/transcriptions/${id}`),
  transcribeAudio: (formData) =>
    api.post("/transcriptions/transcribe", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }),
};

export const medicalImageService = {
  getMedicalImages: () => api.get("/medical-images"),
  getMedicalImage: (id) => api.get(`/medical-images/${id}`),
  uploadMedicalImage: (data) => api.post("/medical-images", data),
  updateMedicalImage: (id, data) => api.put(`/medical-images/${id}`, data),
  deleteMedicalImage: (id) => api.delete(`/medical-images/${id}`),
  analyzeMedicalImage: (id) => api.post(`/medical-images/${id}/analyze`),
};

export const aiInteractionService = {
  virtualAssistant: (query, userId) =>
    api.post("/ai-interactions/virtual-assistant", { query, userId }),
  getAIInteractions: (params) => api.get("/ai-interactions", params),
  getAIInteraction: (id) => api.get(`/ai-interactions/${id}`),
  createAIInteraction: (data) => api.post("/ai-interactions", data),
  textToSpeech: (text, language) =>
    api.post("/ai-interactions/text-to-speech", { text, language }),
};

export default api;
