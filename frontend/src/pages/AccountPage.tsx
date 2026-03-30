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

interface UserInfoResponse {
  user: {
    IS_SHARING_STATS: boolean;
  };
}

const AccountPage: React.FC = () => {
  const navigate = useNavigate();
  const [deleteSuccess, setDeleteSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusRetrieved, setStatusRetrieved] = useState(false);
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
    setStatusRetrieved(false);

    try
    { 
      const response = await api.get<UserInfoResponse>(`/api/users/${id}`);
      //console.log(response.data.user.IS_SHARING_STATS)
      setIsSharingStats(response.data.user.IS_SHARING_STATS)
      setStatusRetrieved(true);
    }
    catch
    {
      console.error("Failed to update opt-in status");
      parseError = true;
    }
    finally
    {
      setLoading(false);
    }
  }, []);

  const isProfessor = localStorage.getItem("account_type") === "professor";
  const userId = user?.ID || userData?.id;
  //console.log(userId);

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
              <div className="flex">
                <label className="font-semibold text-gray-600 min-w-[120px]">
                  Coins:
                </label>
                <span className="text-gray-800">{user?.COINS ?? "-"}</span>
              </div>
              <div className="flex">
                <label className="font-semibold text-gray-600 min-w-[120px]">
                  Lifetime EXP:
                </label>
                <span className="text-gray-800">{user?.LIFETIME_EXP ?? "-"}</span>
              </div>
              <div className="flex">
                <label className="font-semibold text-gray-600 min-w-[120px]">
                  Weekly EXP:
                </label>
                <span className="text-gray-800">{user?.WEEKLY_EXP ?? "-"}</span>
              </div>
              <div className="flex">
                <label className="font-semibold text-gray-600 min-w-[120px]">
                  Daily EXP:
                </label>
                <span className="text-gray-800">{user?.DAILY_EXP ?? "-"}</span>
              </div>
              {!userEmail && !userName && !fullName && (
                <p className="text-gray-500">No user information available</p>
              )}
            </div>
          </section>

          {/* Statistics Sharing Toggle */}
          {!loading && !isProfessor && (
          <div className="p-6 flex justify-start items-center accent-amber-500">
            <input className="mr-4 w-5 h-5" 
              type="checkbox"
              defaultChecked={isSharingStats}
              onChange={() => {setIsSharingStats(!isSharingStats)
                console.log(isSharingStats, "=>", !isSharingStats)}
              }>
            </input>            
            <span className="font-semibold text-gray-600">Opt-in to Statistics Sharing:</span>
          </div>
          )}

          {/* Delete Account */}
          <DeleteAccount onDeleteSuccess={handleDeleteSuccess} />
        </div>
      </div>
    </Layout>
  );
};

export default AccountPage;