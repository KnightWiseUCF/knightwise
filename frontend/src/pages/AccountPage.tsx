////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     Daniel Landsman
//  File:          AccountPage.tsx
//  Description:   Page for account customization/settings.
//
//  Dependencies: react
//                react-router-dom
//                DeleteAccount component 
//                Layout component
//
////////////////////////////////////////////////////////////////

import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DeleteAccount from "../components/DeleteAccount";
import Layout from "../components/Layout";
import api from "../api";
import { useUserCustomizationStore, userCustomizationStore } from "../stores/userCustomizationStore";
import { formatTenths } from "../utils/numberFormat";

interface UserInfoResponse {
  user: {
    IS_SHARING_STATS: boolean;
  };
}

interface StatsOptInResponse {
  message: string;
  optIn:   boolean;
}

const AccountPage: React.FC = () => {
  const navigate = useNavigate();
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSharingStats, setIsSharingStats] = useState(false);
  const { user, isLoading, error } = useUserCustomizationStore();

  useEffect(() => {
    void userCustomizationStore.refresh();
  }, []);

  // Get user info from localStorage
  const userDataString = localStorage.getItem("user_data");

  let userData = null;
  let parseError = false;

  try
  {
    userData = userDataString ? JSON.parse(userDataString) : null;
  }
  catch
  {
    console.error("Failed to get user data");
    parseError = true;
  }

  const getUserOptInStatus = useCallback(async (id: number) => {
    setLoading(true);

    try
    {
      const response = await api.get<UserInfoResponse>(`/api/users/${id}`);
      setIsSharingStats(response.data.user.IS_SHARING_STATS);
    }
    catch
    {
      console.error("Failed to get opt-in status");
    }
    finally
    {
      setLoading(false);
    }
  }, []);

  const isProfessor = localStorage.getItem("account_type") === "professor";
  const userId = user?.ID || userData?.id;

  const updateOptInStatus = useCallback(async (optIn: boolean) => {
    try
    {
      await api.put<StatsOptInResponse>(`/api/users/${userId}/stats-opt-in`, {
        id:    userId,
        optIn,
      });
    }
    catch
    {
      console.error("Failed to update opt-in status");
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      void getUserOptInStatus(userId);
    }
  }, [userId, getUserOptInStatus]);

  const userEmail = userData?.email;
  const userName = (user?.USERNAME || userData?.name || "").trim();
  const firstName = (user?.FIRSTNAME || userData?.firstName || "").trim();
  const lastName = (user?.LASTNAME || userData?.lastName || "").trim();
  const fullName = `${firstName} ${lastName}`.trim();

  // Delete success, remove items from localStorage, redirect to login
  const handleDeleteSuccess = () => {
    setDeleteSuccess(true);
    
    setTimeout(() => {
      localStorage.removeItem("token");
      localStorage.removeItem("user_data");
      localStorage.removeItem("reset-email");
      navigate("/");
    }, 1500);
  };

  // Show error if user data couldn't be parsed
  if (parseError) {
    return (
      <Layout>
        <div className="bg-gray-100 py-8 px-4 min-h-screen flex items-center justify-center">
          <div className="max-w-md text-center">
            <div className="bg-red-50 border-2 border-red-200 text-red-700 px-8 py-6 rounded-lg">
              <p className="text-2xl font-semibold mb-2">Error Loading User Data</p>
              <p className="text-2xl">Please refresh the page.</p>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="bg-gray-100 py-8 px-4 min-h-full">
        <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-8 pb-4 border-b-2 border-gray-200">
            Account Settings
          </h1>

          {/* Success Message */}
          {deleteSuccess && (
            <div className="bg-green-50 border border-green-500 text-green-700 px-4 py-3 rounded-lg mb-6 animate-fade-in">
              Account deleted successfully! Redirecting to login...
            </div>
          )}

          {/* User Information Section */}
          <section className="mb-10">
            <h2 className="text-xl font-semibold text-gray-700 mb-4">
              Profile Information
            </h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-3">
              {isLoading && (
                <p className="text-gray-600">Loading account data...</p>
              )}
              {error && (
                <p className="text-red-600">{error}</p>
              )}
              {fullName && (
                <div className="flex">
                  <label className="font-semibold text-gray-600 min-w-[120px]">
                    Name:
                  </label>
                  <span className="text-gray-800">{fullName}</span>
                </div>
              )}
              {userEmail && (
                <div className="flex">
                  <label className="font-semibold text-gray-600 min-w-[120px]">
                    Email:
                  </label>
                  <span className="text-gray-800">{userEmail}</span>
                </div>
              )}
              {userName && (
                <div className="flex">
                  <label className="font-semibold text-gray-600 min-w-[120px]">
                    Username:
                  </label>
                  <span className="text-gray-800">{userName}</span>
                </div>
              )}
              {!isProfessor && (
                <>
                  <div className="flex">
                    <label className="font-semibold text-gray-600 min-w-[120px]">
                      Coins:
                    </label>
                    <span className="text-gray-800">{formatTenths(user?.COINS, "-")}</span>
                  </div>
                  <div className="flex">
                    <label className="font-semibold text-gray-600 min-w-[120px]">
                      Lifetime EXP:
                    </label>
                    <span className="text-gray-800">{formatTenths(user?.LIFETIME_EXP, "-")}</span>
                  </div>
                  <div className="flex">
                    <label className="font-semibold text-gray-600 min-w-[120px]">
                      Weekly EXP:
                    </label>
                    <span className="text-gray-800">{formatTenths(user?.WEEKLY_EXP, "-")}</span>
                  </div>
                  <div className="flex">
                    <label className="font-semibold text-gray-600 min-w-[120px]">
                      Daily EXP:
                    </label>
                    <span className="text-gray-800">{formatTenths(user?.DAILY_EXP, "-")}</span>
                  </div>
                </>
              )}
              {!userEmail && !userName && !fullName && (
                <p className="text-gray-500">No user information available</p>
              )}
            </div>
          </section>

          {/* Privacy */}
          {!loading && !isProfessor && (
            <section className="p-6 border-t border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Privacy</h2>
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <p className="font-semibold text-gray-700">Statistics Sharing</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Allow your performance statistics to be visible to professors and used for course analytics.
                  </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-amber-500"
                    checked={isSharingStats}
                    onChange={() => {
                      const next = !isSharingStats;
                      setIsSharingStats(next);
                      void updateOptInStatus(next);
                    }}
                  />
                  <span className="text-sm font-medium text-gray-600">
                    {isSharingStats ? "Enabled" : "Disabled"}
                  </span>
                </label>
              </div>
            </section>
          )}

          {/* Delete Account */}
          <DeleteAccount onDeleteSuccess={handleDeleteSuccess} />
        </div>
      </div>
    </Layout>
  );
};

export default AccountPage;