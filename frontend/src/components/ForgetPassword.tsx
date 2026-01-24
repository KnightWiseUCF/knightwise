////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          ForgetPassword.tsx
//  Description:   Handles password reset functionality.
//
//  Dependencies:  react
//                 react-router-dom
//                 api instance
//
////////////////////////////////////////////////////////////////

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import logo from "../assets/ucflogo.png";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const navigate = useNavigate();

  // Send verification code
  const handleSendOtp = async () => {
    setError("");
    setSuccessMessage("");
    try 
    {
      await api.post("/api/auth/sendotp", { email, purpose: "reset" });
      setSuccessMessage("Check your email");
    } 
    catch 
    {
      setError("Failed to send verification code. Please try again.");
    }
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    setError("");
    setSuccessMessage("");
    try {
      await api.post("/api/auth/verify", { email, otp });
      setIsVerified(true);
      setSuccessMessage("Email verified!");
      // Verified, redirect and send reset email
      localStorage.setItem("reset_email", email);
      setTimeout(() => {
        navigate("/reset-password");
      }, 1000);
    } 
    catch 
    {
      setError("Verification failed. Please check your code and try again.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 py-8 px-4">
      <div className="bg-white p-6 sm:p-10 md:p-12 rounded-xl shadow-xl w-full max-w-lg">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img
            src={logo}
            alt="KnightPrep Logo"
            className="w-48 sm:w-64 md:w-80 h-auto"
          />
        </div>

        <h2 className="text-2xl md:text-3xl font-semibold text-center text-gray-800 mb-4">
          Reset Your Password
        </h2>

        <p className="text-sm md:text-lg text-center text-gray-600 mb-4">
          Enter your email to receive a verification code.
        </p>

        {/* Enter email */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Email
          </label>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            disabled={isVerified}
          />
          <button
            type="button"
            onClick={handleSendOtp}
            className="mt-2 w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 rounded-lg transition"
            disabled={isVerified || !email}
          >
            Send Code
          </button>
        </div>

        {/* OTP input */}
        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700 mb-1 block">
            Enter OTP
          </label>
          <input
            type="text"
            placeholder="6-digit code"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
            disabled={isVerified}
          />
          <button
            type="button"
            onClick={handleVerifyOtp}
            className="mt-2 w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold py-2 rounded-lg transition"
            disabled={isVerified || otp.length !== 6}
          >
            Verify
          </button>
        </div>

        {/* Message output */}
        {error && (
          <p className="text-red-500 text-sm text-center mt-2">{error}</p>
        )}
        {successMessage && (
          <p className="text-green-500 text-sm text-center mt-2">
            {successMessage}
          </p>
        )}

        {/* Go back to login page */}
        <div className="text-center mt-6">
          <p className="text-sm text-gray-600">
            Remember your password?{" "}
            <button
              onClick={() => navigate("/")}
              className="text-blue-500 hover:underline"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
