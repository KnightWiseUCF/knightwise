import React from "react";
import Layout from "../components/Layout";

interface StoredUserData {
  id?: number;
  ID?: number;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

const ProfilePage: React.FC = () => {
  const rawUserData = localStorage.getItem("user_data");

  let userData: StoredUserData | null = null;
  try {
    userData = rawUserData ? JSON.parse(rawUserData) as StoredUserData : null;
  } catch {
    userData = null;
  }

  const firstName = (userData?.firstName || "").trim();
  const lastName = (userData?.lastName || "").trim();
  const fullName = `${firstName} ${lastName}`.trim() || (userData?.name || "KnightWise User");
  const email = userData?.email || "No email available";
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "KU";

  return (
    <Layout>
      <div className="bg-gray-100 py-8 px-4 min-h-full">
        <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-8 pb-4 border-b-2 border-gray-200">
            Profile
          </h1>

          <div className="flex flex-col sm:flex-row sm:items-center gap-5 mb-8">
            <div className="h-20 w-20 rounded-full bg-yellow-500 text-white text-2xl font-bold flex items-center justify-center">
              {initials}
            </div>
            <div>
              <p className="text-2xl font-semibold text-gray-900">{fullName}</p>
              <p className="text-gray-600">{email}</p>
            </div>
          </div>

          <section>
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Community Profile</h2>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 space-y-3">
              <div className="flex">
                <span className="font-semibold text-gray-600 min-w-[140px]">Display Name:</span>
                <span className="text-gray-800">{fullName}</span>
              </div>
              <div className="flex">
                <span className="font-semibold text-gray-600 min-w-[140px]">Email:</span>
                <span className="text-gray-800">{email}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default ProfilePage;
