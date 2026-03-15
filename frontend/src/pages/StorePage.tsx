import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Layout from "../components/Layout";
import api from "../api";
import type { StoreItem, StoreItemsResponse } from "../models";
import { useUserCustomizationStore, userCustomizationStore } from "../stores/userCustomizationStore";

const StorePage: React.FC = () => {
  const { purchases, isLoading } = useUserCustomizationStore();
  const [items, setItems] = useState<StoreItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [purchaseInFlight, setPurchaseInFlight] = useState<number | null>(null);

  useEffect(() => {
    void userCustomizationStore.refresh();
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadStoreItems = async () => {
      setLoadingItems(true);
      setError(null);
      try {
        const response = await api.get<StoreItemsResponse>("/api/store");
        if (mounted) {
          setItems(response.data.items);
        }
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : "Failed to load store items.";
        if (mounted) {
          setError(message);
        }
      } finally {
        if (mounted) {
          setLoadingItems(false);
        }
      }
    };

    void loadStoreItems();

    return () => {
      mounted = false;
    };
  }, []);

  const purchasedItemIds = useMemo(() => new Set(purchases.map((item) => item.ID)), [purchases]);

  const handlePurchase = async (itemId: number) => {
    setPurchaseInFlight(itemId);
    setError(null);

    try {
      await api.post(`/api/store/${itemId}/purchase`);
      await userCustomizationStore.refresh();
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        const apiMessage = requestError.response?.data?.error;
        if (typeof apiMessage === "string" && apiMessage.trim()) {
          setError(apiMessage);
        } else {
          setError(requestError.message || "Failed to purchase item.");
        }
      } else {
        setError("Failed to purchase item.");
      }
    } finally {
      setPurchaseInFlight(null);
    }
  };

  return (
    <Layout>
      <div className="bg-gray-100 py-8 px-4 min-h-full">
        <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Store</h1>
          <p className="text-gray-600 mb-6">Spend your coins on profile customization items.</p>

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {error}
            </div>
          )}

          {(loadingItems || isLoading) && (
            <p className="text-gray-600 mb-4">Loading store data...</p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((item) => {
              const isOwned = purchasedItemIds.has(item.ID);
              const isPurchasing = purchaseInFlight === item.ID;

              return (
                <article key={item.ID} className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">{item.TYPE.replace("_", " ")}</p>
                  <h2 className="text-lg font-semibold text-gray-900">{item.NAME}</h2>
                  <p className="text-gray-700 mt-2">Cost: {item.COST} coins</p>

                  <button
                    type="button"
                    onClick={() => void handlePurchase(item.ID)}
                    disabled={isOwned || isPurchasing}
                    className={`mt-4 w-full rounded-lg px-4 py-2 font-semibold transition ${
                      isOwned
                        ? "bg-gray-200 text-gray-600 cursor-not-allowed"
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
    </Layout>
  );
};

export default StorePage;
