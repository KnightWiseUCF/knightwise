////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          ResetPassword.tsx
//  Description:   Frontend password reset functionality.
//
//  Dependencies:  react
//                 react-password-checklist
//                 react-router-dom
//                 api instance
//
////////////////////////////////////////////////////////////////

import React, { useEffect, useState } from "react";
import PasswordChecklist from "react-password-checklist";
import { useNavigate } from "react-router-dom";
import logo from "../assets/ucflogo.png";
import api from "../api";

const ResetPassword: React.FC = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();
  const email = localStorage.getItem("reset_email");

  useEffect(() => {
    if (!email) {
      navigate("/forgot-password");
    }
  }, [email, navigate]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try 
    {
      await api.post("/api/auth/resetPassword", { email, password });
      setSuccessMessage("Password changed successfully!");
      localStorage.removeItem("reset_email");
      setTimeout(() => navigate("/"), 1000);
    } 
    catch 
    {
      setError("Failed to reset password. Please try again.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 py-8">
      <div className="bg-white p-12 rounded-xl shadow-xl w-full max-w-lg">
        <div className="flex justify-center mb-6">
          <img src={logo} alt="KnightPrep Logo" className="w-80 h-80 mb-4" />
        </div>
        <h2 className="text-3xl font-semibold text-center text-gray-800 mb-6">
          Reset Your Password
        </h2>
        <p className="text-center text-gray-600 mb-4">
          Enter your new password below.
        </p>
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="flex flex-col w-full">
            <div className="flex items-center space-x-6 w-full">
              <label className="w-2/5 text-lg font-semibold text-gray-700">
                New Password
              </label>
              <input
                type="password"
                placeholder="New Password"
                className="w-3/5 px-6 py-3 text-lg border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <PasswordChecklist
              className="ml-[40%] mt-2 text-gray-700"
              rules={["minLength", "specialChar", "number", "capital","lowercase"]}
              minLength={5}
              value={password}
              messages={{
                minLength: "At least 5 characters",
                specialChar: "At least one special character",
                number: "At least one number",
                capital: "At least one uppercase letter",
                lowercase: "At least one lowercase letter",
              }}
            />
          </div>

          <div className="flex items-center space-x-6 w-full">
            <label className="w-2/5 text-lg font-semibold text-gray-700">
              Confirm Password
            </label>
            <input
              type="password"
              placeholder="Confirm Password"
              className="w-3/5 px-6 py-3 text-lg border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="w-full bg-yellow-500 text-black font-bold py-3 text-xl rounded-xl shadow-lg hover:bg-yellow-600 transition"
          >
            Reset Password
          </button>
        </form>

        {error && (
          <p className="text-red-500 text-lg text-center mt-4">{error}</p>
        )}
        {successMessage && (
          <p className="text-green-500 text-lg text-center mt-4">
            {successMessage}
          </p>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
