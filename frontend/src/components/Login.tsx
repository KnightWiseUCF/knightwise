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

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

const Login: React.FC<{ onToggle: () => void }> = ({ onToggle }) => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    try {
      const response = await api.post("/api/auth/login", 
      {
        username,
        password,
      });

      localStorage.setItem("token", response.data.token);

      if (response.data.user) {
        localStorage.setItem("user_data", JSON.stringify(response.data.user));
      }

      // move to dashboard if the user logs in
      setSuccessMessage(response.data.message);
      setTimeout(() => {
        navigate("/dashboard");
      }, 2000);
    } 
    catch 
    {
      setError("Invalid username or password. Please try again.");
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="bg-gray-100 p-8 sm:p-12 rounded-xl shadow-lg w-full max-w-2xl min-h-[500px] flex flex-col items-center justify-center">
        <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-center text-gray-800 mb-10">
          Sign In
        </h2>

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

        {/* password reset */}
        <p className="text-sm sm:text-base text-gray-600 mt-4 text-center">
          Forgot password?{" "}
          <button
            onClick={() => navigate("/forgot-password")}
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