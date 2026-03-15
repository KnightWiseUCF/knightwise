import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import api from "../api";
import type { StoreItem, StoreItemsResponse } from "../models";
import { useUserCustomizationStore, userCustomizationStore } from "../stores/userCustomizationStore";

interface StoredUserData {
  id?: number;
  ID?: number;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

const ProfilePage: React.FC = () => {
  const { user, equippedItems, purchases, isLoading, error } = useUserCustomizationStore();
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [storeLoading, setStoreLoading] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [purchaseInFlight, setPurchaseInFlight] = useState<number | null>(null);

  useEffect(() => {
    void userCustomizationStore.refresh();
  }, []);

  const loadStoreItems = async () => {
    setStoreLoading(true);
    setStoreError(null);
    try {
      const response = await api.get<StoreItemsResponse>("/api/store");
      setStoreItems(response.data.items);
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "Failed to load store items.";
      setStoreError(message);
    } finally {
      setStoreLoading(false);
    }
  };

  useEffect(() => {
    if (!isStoreOpen) {
      return;
    }

    void loadStoreItems();
  }, [isStoreOpen]);

  const handlePurchase = async (itemId: number) => {
    setPurchaseInFlight(itemId);
    setStoreError(null);

    try {
      await api.post(`/api/store/${itemId}/purchase`);
      await userCustomizationStore.refresh();
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        const apiMessage = requestError.response?.data?.error;
        if (typeof apiMessage === "string" && apiMessage.trim()) {
          setStoreError(apiMessage);
        } else {
          setStoreError(requestError.message || "Failed to purchase item.");
        }
      } else {
        setStoreError("Failed to purchase item.");
      }
    } finally {
      setPurchaseInFlight(null);
    }
  };

  const rawUserData = localStorage.getItem("user_data");

  let userData: StoredUserData | null = null;
  try {
    userData = rawUserData ? JSON.parse(rawUserData) as StoredUserData : null;
  } catch {
    userData = null;
  }

  const firstName = (user?.FIRSTNAME || userData?.firstName || "").trim();
  const lastName = (user?.LASTNAME || userData?.lastName || "").trim();
  const fullName = `${firstName} ${lastName}`.trim() || user?.USERNAME || userData?.name || "KnightWise User";
  const email = userData?.email || "No email available";
  const flairItems = useMemo(() => equippedItems.filter((item) => item.TYPE === "flair"), [equippedItems]);
  const profilePictureItem = useMemo(
    () => equippedItems.find((item) => item.TYPE === "profile_picture") || null,
    [equippedItems]
  );
  const purchasedItemIds = useMemo(() => new Set(purchases.map((item) => item.ID)), [purchases]);
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
              {isLoading && (
                <p className="text-gray-600">Loading profile data...</p>
              )}
              {error && (
                <p className="text-red-600">{error}</p>
              )}
              <div className="flex">
                <span className="font-semibold text-gray-600 min-w-[140px]">Display Name:</span>
                <span className="text-gray-800">{fullName}</span>
              </div>
              <div className="flex">
                <span className="font-semibold text-gray-600 min-w-[140px]">Email:</span>
                <span className="text-gray-800">{email}</span>
              </div>
              <div className="flex">
                <span className="font-semibold text-gray-600 min-w-[140px]">Coins:</span>
                <span className="text-gray-800">{user?.COINS ?? "-"}</span>
              </div>
              <div className="flex">
                <span className="font-semibold text-gray-600 min-w-[140px]">Lifetime EXP:</span>
                <span className="text-gray-800">{user?.LIFETIME_EXP ?? "-"}</span>
              </div>
              <div className="flex">
                <span className="font-semibold text-gray-600 min-w-[140px]">Weekly EXP:</span>
                <span className="text-gray-800">{user?.WEEKLY_EXP ?? "-"}</span>
              </div>
              <div className="flex">
                <span className="font-semibold text-gray-600 min-w-[140px]">Daily EXP:</span>
                <span className="text-gray-800">{user?.DAILY_EXP ?? "-"}</span>
              </div>
              <div className="flex items-start">
                <span className="font-semibold text-gray-600 min-w-[140px]">Profile Picture:</span>
                <span className="text-gray-800">{profilePictureItem?.NAME || "None equipped"}</span>
              </div>
              <div className="flex items-start">
                <span className="font-semibold text-gray-600 min-w-[140px]">Equipped Flair:</span>
                <span className="text-gray-800">
                  {flairItems.length > 0 ? flairItems.map((item) => item.NAME).join(", ") : "None equipped"}
                </span>
              </div>
              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => setIsStoreOpen(true)}
                  className="inline-flex items-center rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-black transition hover:bg-yellow-600"
                >
                  View Store
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>

      {isStoreOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4"
          onClick={() => setIsStoreOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Store"
            className="w-full max-w-5xl max-h-[85vh] overflow-y-auto rounded-xl bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Store</h2>
                <p className="text-gray-600">Spend your coins on profile customization items.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsStoreOpen(false)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100"
              >
                Close
              </button>
            </div>

            {storeError && (
              <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                {storeError}
              </div>
            )}

            {(storeLoading || isLoading) && (
              <p className="mb-4 text-gray-600">Loading store data...</p>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {storeItems.map((item) => {
                const isOwned = purchasedItemIds.has(item.ID);
                const isPurchasing = purchaseInFlight === item.ID;

                return (
                  <article key={item.ID} className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{item.TYPE.replace("_", " ")}</p>
                    <h3 className="text-lg font-semibold text-gray-900">{item.NAME}</h3>
                    <p className="mt-2 text-gray-700">Cost: {item.COST} coins</p>

                    <button
                      type="button"
                      onClick={() => void handlePurchase(item.ID)}
                      disabled={isOwned || isPurchasing}
                      className={`mt-4 w-full rounded-lg px-4 py-2 font-semibold transition ${
                        isOwned
                          ? "cursor-not-allowed bg-gray-200 text-gray-600"
                          : "bg-yellow-500 text-black hover:bg-yellow-600"
                      }`}
                    >
                      {isOwned ? "Owned" : isPurchasing ? "Purchasing..." : "Buy"}
                    </button>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ProfilePage;
