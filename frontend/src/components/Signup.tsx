////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          Signup.tsx
//  Description:   Frontend user registration functionality.
//                 Code based on Dr. Leinecker's Login.tsx code.
//                 Password checklist based on the following article:
//                 https://www.geeksforgeeks.org/how-to-create-password-checklist-in-reactjs/
//
//  Dependencies:  react
//                 react-password-checklist
//                 api instance
//
////////////////////////////////////////////////////////////////

import React, { useState } from "react";
import PasswordChecklist from "react-password-checklist";
import api from "../api";

const Signup: React.FC<{ onToggle: () => void }> = ({ onToggle }) => {
  const [firstName, setFirstname] = useState("");
  const [lastName, setLastname] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [otp, setOtp] = useState("");

  const nameRegex = /^[A-Za-z]{1,}$/;
  const usernameRegex = /^[A-Za-z\d]{5,}$/;
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{5,}$/;

  const handleSendOtp = async () => {
    try 
    {
      await api.post("/api/auth/sendotp", 
      {
        email,
        purpose: "signup",
      });
      setSuccessMessage("Verification email sent!");
      setError("");
    } 
    catch 
    {
      setError("Failed to send verification code. Please try again.");
      setSuccessMessage("");
    }
  };

  const handleVerifyOtp = async () => {
    try 
    {
      await api.post("/api/auth/verify", 
      {
        email, otp 
      });
      setIsVerified(true);
      setSuccessMessage("Email verified");
      setError("");
    } 
    catch 
    {
      setError("Verification failed. Please check your code and try again.");
      setSuccessMessage("");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!nameRegex.test(firstName) || !nameRegex.test(lastName)) {
      setError("Name must be at least one letter");
      return;
    }

    if (!usernameRegex.test(username)) {
      setError("Username must be at least 5 characters (letters or numbers)");
      return;
    }

    if (!passwordRegex.test(password)) {
      setError("Password must be at least 5 characters with uppercase, lowercase, number, and special character");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    try 
    {
      const response = await api.post("/api/auth/signup", 
      {
        username,
        email,
        password,
        firstName,
        lastName,
      });

      setSuccessMessage(response.data.message);
      setTimeout(() => onToggle(), 2000);
    } 
    catch
    {
      setError("Registration failed. Please try again.");
    }
  };

  return (
    <div className="flex flex-col items-center">
      <div className="bg-gray-100 p-8 sm:p-12 rounded-xl shadow-lg w-full max-w-3xl min-h-[600px] flex flex-col items-center justify-center">
        <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-center text-gray-800 mb-6">
          Sign Up
        </h2>

        <form onSubmit={handleSignup} className="space-y-4 w-full max-w-2xl">
          {/* First Name */}
          <div className="flex items-center space-x-6 w-full">
            <label className="w-2/5 text-base sm:text-lg font-semibold text-gray-700">
              First Name
            </label>
            <input
              type="text"
              placeholder="First Name"
              className="w-3/5 px-6 py-3 text-sm sm:text-base md:text-lg border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              value={firstName}
              onChange={(e) => setFirstname(e.target.value)}
              required
            />
          </div>

          {/* Last Name */}
          <div className="flex items-center space-x-6 w-full">
            <label className="w-2/5 text-base sm:text-lg font-semibold text-gray-700">
              Last Name
            </label>
            <input
              type="text"
              placeholder="Last Name"
              className="w-3/5 px-6 py-3 text-sm sm:text-base md:text-lg border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              value={lastName}
              onChange={(e) => setLastname(e.target.value)}
              required
            />
          </div>

          {/* Username */}
          <div className="flex flex-col w-full">
            <div className="flex items-center space-x-6 w-full">
              <label className="w-2/5 text-base sm:text-lg font-semibold text-gray-700">
                Username
              </label>
              <input
                type="text"
                placeholder="Username"
                className="w-3/5 px-6 py-3 text-sm sm:text-base md:text-lg border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <p className="text-xs sm:text-sm text-gray-600 mt-1 ml-[40%]">
              Username must be at least 5 characters
            </p>
          </div>

          {/* Password */}
          <div className="flex flex-col w-full">
            <div className="flex items-center space-x-6 w-full">
              <label className="w-2/5 text-base sm:text-lg font-semibold text-gray-700">
                Password
              </label>
              <input
                type="password"
                placeholder="Password"
                className="w-3/5 px-6 py-3 text-sm sm:text-base md:text-lg border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <PasswordChecklist
              className="ml-[40%] mt-2 text-xs sm:text-sm md:text-base text-gray-700"
              rules={[
                "minLength",
                "specialChar",
                "number",
                "capital",
                "lowercase",
              ]}
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

          {/* Confirm Password */}
          <div className="flex items-center space-x-6 w-full">
            <label className="w-2/5 text-base sm:text-lg font-semibold text-gray-700">
              Confirm Password
            </label>
            <input
              type="password"
              placeholder="Confirm Password"
              className="w-3/5 px-6 py-3 text-sm sm:text-base md:text-lg border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {/* Email*/}
          <div className="flex items-center space-x-6 w-full mb-4">
            <label className="w-2/5 text-base sm:text-lg font-semibold text-gray-700">
              Email
            </label>
            <div className="w-3/5 flex space-x-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-6 py-3 text-sm sm:text-base md:text-lg border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                placeholder="Enter your email"
                disabled={isVerified}
                required
              />
              <button
                type="button"
                onClick={handleSendOtp}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-4 py-2 rounded-lg transition"
                disabled={isVerified || !email}
              >
                Send Code
              </button>
            </div>
          </div>

          {/* OTP verify */}
          <div className="flex items-center space-x-6 w-full mb-4">
            <label className="w-2/5 text-base sm:text-lg font-semibold text-gray-700">
              Enter OTP
            </label>
            <div className="w-3/5 flex space-x-2">
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full px-6 py-3 text-sm sm:text-base md:text-lg border border-gray-300 bg-white rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                placeholder="6-digit code"
                disabled={isVerified}
              />
              <button
                type="button"
                onClick={handleVerifyOtp}
                className="bg-yellow-500 hover:bg-yellow-600 text-black font-semibold px-4 py-2 rounded-lg transition"
                disabled={isVerified || otp.length !== 6}
              >
                Verify
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-yellow-500 text-sm sm:text-base md:text-xl font-bold py-3 rounded-xl shadow-lg hover:bg-yellow-600 transition"
          >
            SIGN UP
          </button>
        </form>

        {/* Error/Success messages */}
        {error && (
          <p className="text-red-500 text-base text-center mt-2">{error}</p>
        )}
        {successMessage && (
          <p className="text-green-500 text-sm text-center mt-2">
            {successMessage}
          </p>
        )}

        {/* Toggle to Login */}
        <p className="text-sm sm:text-base text-gray-600 mt-4 text-center">
          Already have an account?{" "}
          <button onClick={onToggle} className="text-blue-500 hover:underline">
            Sign in here.
          </button>
        </p>
      </div>
    </div>
  );
};

export default Signup;