////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     Daniel Landsman
//  File:          DeleteAccount.tsx
//  Description:   Handles user account deletion.
//
//  Dependencies:  react
//                 react-router-dom
//                 api instance
//                 axios (isAxiosError)
//
////////////////////////////////////////////////////////////////

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { isAxiosError } from "axios";

// Prop to pass back to AccountPage to indicate successful deletion
interface DeleteAccountProps 
{
  onDeleteSuccess?: () => void;
}

/**
 * Component for handling account deletion with confirmation dialog
 * Requires user authentication, parent callback for post-deletion actions.
 */
const DeleteAccount: React.FC<DeleteAccountProps> = ({ onDeleteSuccess }) => {
  const navigate = useNavigate();

  // State variables
  const [isConfirming, setIsConfirming] = useState(false); // For deletion confirmation
  const [loading, setLoading] = useState(false);           // API call in progress
  const [error, setError] = useState<string | null>(null); // For tracking errors

  const handleDelete = async () => {

    // Parse user_data to get id
    const userDataString = localStorage.getItem("user_data");

    let userData = null;

    try
    {
      userData = userDataString ? JSON.parse(userDataString) : null;
    }
    catch
    {
      setError("Invalid user data. Please log in again.");
      return;
    }
    const userId = userData?.id;
  
    if (!userId) 
    {
      setError("User not authenticated");
      return;
    }

    // Now loading... no error yet.
    setLoading(true);
    setError(null);

    try 
    {
      // Make API call to delete account
      await api.delete(`/api/users/${userId}`);
      
      // Success, parent handler redirects to login, clears localStorage
      onDeleteSuccess?.();
    } 
    catch (err: unknown) 
    {
      if (isAxiosError(err))
      {
        if (err.response?.status === 401)
        {
          setError("Session expired. Please log in again.");
          localStorage.removeItem("token");
          localStorage.removeItem("user_data");
          localStorage.removeItem("reset-email");
          setTimeout(() => {
            navigate("/");
          }, 1500);
          return;
        }
        setError("Failed to delete account. Please try again.");
      }
      else
      {
        setError("Something went wrong. Please try again.");
      }
    } 
    finally 
    {
      setLoading(false);
      setIsConfirming(false);
    }
  };

   return (
    <div className="mt-4">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
          {error}
        </div>
      )}
      
      {isConfirming ? (
        <div className="bg-white border-2 border-red-500 rounded-lg p-6">
          <p className="text-gray-800 font-medium mb-6">
            Are you sure you want to delete your account? This action will permanently delete your profile, answer submissions, and all associated data.
          </p>
          <div className="flex gap-4">
            <button 
              onClick={handleDelete} 
              disabled={loading}
              className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Deleting..." : "Yes, delete"}
            </button>
            <button 
              onClick={() => setIsConfirming(false)} 
              disabled={loading}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsConfirming(true)}
          disabled={loading}
          className="px-6 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          Delete Account
        </button>
      )}
    </div>
  );
};

export default DeleteAccount;