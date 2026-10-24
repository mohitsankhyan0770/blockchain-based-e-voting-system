import axios from "axios";

// The access token lives in memory only (never localStorage), so a script injected into the
// page cannot read it from storage. AuthContext updates it on login, refresh and logout.
let accessToken = "";

export const setAccessToken = (token: string) => {
  accessToken = token;
};

const client = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:8000",
  withCredentials: true,
});

client.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers = { ...(config.headers || {}), Authorization: `Bearer ${accessToken}` };
  }
  return config;
});

export default client;
