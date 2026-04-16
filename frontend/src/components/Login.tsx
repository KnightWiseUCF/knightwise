////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          Login.tsx
//  Description:   Login component based on Dr. Leinecker's code.
//
//  Dependencies:  react
//                 react-router-dom
//                 api instance
//
////////////////////////////////////////////////////////////////

import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { isAxiosError } from "axios";
import { CircleHelp } from "lucide-react";

const Login: React.FC<{ onToggle: () => void }> = ({ onToggle }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const sessionExpired = localStorage.getItem("session_expired") === "1";
    if (sessionExpired) {
      setSessionExpiredMessage("Session expired. Please sign in again.");
      localStorage.removeItem("session_expired");
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setSessionExpiredMessage("");

    try {
      const response = await api.post("/api/auth/login", 
      {
        username,
        password,
      });

      localStorage.setItem("token", response.data.token);

      if (response.data.user) {
        // set accout type based on endpoint response
        localStorage.setItem("account_type", response.data.user.account_type);

        localStorage.setItem("user_data", JSON.stringify(response.data.user));
      }

      // move to dashboard if the user logs in
      setSuccessMessage(response.data.message);
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } 
    catch (error: unknown)
    {
      // if an unverified professor tries to log in, let them know to check back later
      if (isAxiosError(error) && error.response?.status === 403) {
        setError("This account has yet to be verified. Please check back in 12-24 hours.");
      }
      else {
        setError("Invalid username or password. Please try again.");
      }
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="bg-gray-100 p-8 sm:p-12 rounded-xl shadow-lg w-full max-w-2xl min-h-[500px] flex flex-col items-center justify-center">
        <div className="mb-10 flex items-center justify-center">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-center text-gray-800">
            Sign In
          </h2>
          <div className="group relative ml-1.5 inline-flex">
            <button
              type="button"
              className="inline-flex translate-y-[1px] items-center justify-center rounded-full text-gray-500 hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500"
              aria-label="How sign in works by account type"
            >
              <CircleHelp size={20} />
            </button>
            <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 text-left text-xs text-gray-700 opacity-0 shadow-xl transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100 sm:text-sm">
              <p>
                <span className="font-semibold">Student:</span> Create an account and sign in right away.
              </p>
              <p className="mt-2">
                <span className="font-semibold">Professors:</span> Apply for a professor account, and you can sign in once approved. 
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 w-full max-w-lg">
          {/* username */}
          <div className="flex items-center space-x-6 w-full">
            <label className="w-1/3 text-base sm:text-lg font-semibold text-gray-700">
              Username
            </label>
            <input
              type="text"
              placeholder="Enter your username"
              className="w-2/3 px-6 py-4 text-sm sm:text-base md:text-lg border border-gray-300 bg-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          {/* password */}
          <div className="flex items-center space-x-6 w-full">
            <label className="w-1/3 text-base sm:text-lg font-semibold text-gray-700">
              Password
            </label>
            <input
              type="password"
              placeholder="Enter your password"
              className="w-2/3 px-6 py-4 text-sm sm:text-base md:text-lg border border-gray-300 bg-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* button */}
          <button
            type="submit"
            className="w-full bg-yellow-500 text-sm sm:text-base md:text-xl font-bold py-4 rounded-xl shadow-lg hover:bg-yellow-600 transition"
          >
            LOGIN
          </button>
        </form>

        {/* messages */}
        {error && (
          <p className="text-red-500 text-base text-center mt-2">{error}</p>
        )}
        {sessionExpiredMessage && (
          <p className="text-amber-600 text-base text-center mt-2">{sessionExpiredMessage}</p>
        )}
        {successMessage && (
          <p className="text-green-500 text-sm text-center mt-2">
            {successMessage}
          </p>
        )}

        {/* move to signup */}
        <p className="text-sm sm:text-base text-gray-600 mt-4 text-center">
          Not registered?{" "}
          <button onClick={onToggle} className="text-blue-500 hover:underline">
            Create an account
          </button>
        </p>
        {/* move to professor application */}
        <p className="text-sm sm:text-base text-gray-600 mt-1 text-center">
          Professor or Teacher?{" "}
          <button
            onClick={() => navigate("/professor-apply")}
            className="text-blue-500 hover:underline"
          >
            Apply for a professor account
          </button>
        </p>

        {/* password reset */}
        <p className="text-sm sm:text-base text-gray-600 mt-4 text-center">
          Forgot password?{" "}
          <button
            onClick={() => {
              navigate("/forgot-password");
            }}
            className="text-blue-500 hover:underline"
          >
            Reset Password
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;