////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025
//  Author(s):     Daniel Landsman
//  File:          api.ts
//  Description:   Defines Axios instance used across app.
//                 Applies base URL from .env, used for
//                 all API calls.
//
//  Dependencies:  axios
//
////////////////////////////////////////////////////////////////

import axios from "axios";

const normalizeStoredToken = (rawToken: string | null): string | null => {
  if (!rawToken) {
    return null;
  }

  let normalized = rawToken.trim();
  if (!normalized) {
    return null;
  }

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  normalized = normalized.replace(/^bearer\s+/i, "").trim();

  if (!normalized || normalized === "null" || normalized === "undefined") {
    return null;
  }

  return normalized;
};

const isLikelyJwt = (token: string): boolean => {
  const segments = token.split(".");
  return segments.length === 3 && segments.every((segment) => segment.length > 0);
};

// Try to get base URL from .env
const baseURL = import.meta.env.VITE_API_BASE_URL;
if (!baseURL)
{
  console.warn("VITE_API_BASE_URL not set, using http://localhost:5000.");
}

const api = axios.create(
  {
    baseURL: baseURL || "http://localhost:5000",
  }
);

const normalizeApiPathForBase = (requestUrl: string | undefined, requestBaseUrl: string | undefined): string | undefined => {
  if (!requestUrl || !requestBaseUrl) {
    return requestUrl;
  }

  const normalizedBase = requestBaseUrl.trim().replace(/\/+$/, "").toLowerCase();
  const normalizedUrl = requestUrl.trim();

  if (normalizedBase.endsWith("/api") && /^\/api(\/|$)/i.test(normalizedUrl)) {
    const withoutLeadingApi = normalizedUrl.replace(/^\/api(?=\/|$)/i, "");
    return withoutLeadingApi.length > 0 ? withoutLeadingApi : "/";
  }

  return requestUrl;
};

const clearAuthStorage = () => {
  localStorage.removeItem("token");
  localStorage.removeItem("user_data");
  localStorage.removeItem("account_type");
  localStorage.setItem("session_expired", "1");
};

const shouldSkipAutoLogout = (requestUrl: string): boolean => {
  const accountType = (localStorage.getItem("account_type") || "").trim().toLowerCase();
  if (accountType !== "professor") {
    return false;
  }

  return /\/api\/admin\/problems(\/|$)/.test(requestUrl);
};

// Interceptor to add token
api.interceptors.request.use((config) => {
  config.url = normalizeApiPathForBase(config.url, config.baseURL);

  const token = normalizeStoredToken(localStorage.getItem('token'));
  const accountType = (localStorage.getItem("account_type") || "").trim().toLowerCase();
  const requiresJwt = accountType !== "admin";

  if (token && requiresJwt && !isLikelyJwt(token)) {
    clearAuthStorage();
    if (config.headers?.Authorization) {
      delete config.headers.Authorization;
    }

    if (typeof window !== "undefined") {
      if (window.location.pathname === "/") {
        window.location.reload();
      } else {
        window.location.replace("/");
      }
    }

    return config;
  }

  // Add token if it exists (protected routes) 
  if (token) 
  {
    config.headers.Authorization = `Bearer ${token}`;
  }
  else if (config.headers?.Authorization)
  {
    delete config.headers.Authorization;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const hadAuthHeader = Boolean(error.config?.headers?.Authorization);
      const requestUrl = String(error.config?.url || "");

      if (hadAuthHeader && !shouldSkipAutoLogout(requestUrl)) {
        clearAuthStorage();

        if (typeof window !== "undefined") {
          if (window.location.pathname === "/") {
            window.location.reload();
          } else {
            window.location.replace("/");
          }
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;