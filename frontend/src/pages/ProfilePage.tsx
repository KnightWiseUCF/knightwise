import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ShoppingCart } from "lucide-react";
import { useLocation, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../api";
import type { ItemType, StoreItem, StoreItemsResponse, UserInfoResponse } from "../models";
import { useUserCustomizationStore, userCustomizationStore } from "../stores/userCustomizationStore";
import { getBackgroundUrlByItemName, getProfilePictureUrlByItemName } from "../utils/storeCosmetics";
import { getFlairPresentation } from "../utils/flairPresentation";

interface StoredUserData {
  id?: number;
  ID?: number;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

interface LeaderboardProfileState {
  leaderboardEntry?: {
    username?: string;
    firstName?: string;
    profilePicture?: string | null;
    exp?: number;
    tab?: "weekly" | "lifetime";
  };
}

type StoreTab = "all" | ItemType;

const STORE_TABS: Array<{ key: StoreTab; label: string }> = [
  { key: "all", label: "All" },
  { key: "flair", label: "Flairs" },
  { key: "profile_picture", label: "Profile Pictures" },
  { key: "background", label: "Backgrounds" },
];

const ProfilePage: React.FC = () => {
  const { userId: userIdParam, username: usernameParam } = useParams<{ userId?: string; username?: string }>();
  const location = useLocation();
  const { user, equippedItems, purchases, isLoading, error } = useUserCustomizationStore();
  const [isStoreOpen, setIsStoreOpen] = useState(false);
  const [storeItems, setStoreItems] = useState<StoreItem[]>([]);
  const [activeStoreTab, setActiveStoreTab] = useState<StoreTab>("all");
  const [storeLoading, setStoreLoading] = useState(false);
  const [storeError, setStoreError] = useState<string | null>(null);
  const [purchaseInFlight, setPurchaseInFlight] = useState<number | null>(null);
  const [equipInFlight, setEquipInFlight] = useState<number | null>(null);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [inventoryNotice, setInventoryNotice] = useState<string | null>(null);
  const [publicProfile, setPublicProfile] = useState<UserInfoResponse | null>(null);
  const [publicProfileLoading, setPublicProfileLoading] = useState(false);
  const [publicProfileError, setPublicProfileError] = useState<string | null>(null);

  const routeUsername = useMemo(
    () => (typeof usernameParam === "string" ? decodeURIComponent(usernameParam).trim() : ""),
    [usernameParam]
  );
  const isUsernameProfileRoute = routeUsername.length > 0;
  const navigationState = location.state as LeaderboardProfileState | null;
  const leaderboardEntry = navigationState?.leaderboardEntry;
  const stateUsernameMatchesRoute =
    typeof leaderboardEntry?.username === "string" &&
    leaderboardEntry.username.trim().toLowerCase() === routeUsername.toLowerCase();
  const routeFirstName = isUsernameProfileRoute && stateUsernameMatchesRoute
    ? (leaderboardEntry?.firstName ?? "")
    : "";
  const routeProfilePictureName = isUsernameProfileRoute && stateUsernameMatchesRoute
    ? (leaderboardEntry?.profilePicture ?? null)
    : null;
  const routeExp = isUsernameProfileRoute && stateUsernameMatchesRoute && typeof leaderboardEntry?.exp === "number"
    ? leaderboardEntry.exp
    : null;
  const routeExpTab = isUsernameProfileRoute && stateUsernameMatchesRoute
    ? leaderboardEntry?.tab
    : undefined;

  const profileUserId = useMemo(() => {
    if (!userIdParam) {
      return null;
    }

    const parsedId = Number(userIdParam);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      return null;
    }

    return parsedId;
  }, [userIdParam]);

  const rawUserData = localStorage.getItem("user_data");

  let userData: StoredUserData | null = null;
  try {
    userData = rawUserData ? JSON.parse(rawUserData) as StoredUserData : null;
  } catch {
    userData = null;
  }

  const currentUserId = user?.ID ?? userData?.id ?? userData?.ID ?? null;
  const hasProfileParam = typeof userIdParam === "string";
  const isInvalidProfileRoute = hasProfileParam && profileUserId === null;
  const isOwnProfileRoute = profileUserId !== null && currentUserId !== null && profileUserId === currentUserId;
  const isReadOnlyProfile = isUsernameProfileRoute || (profileUserId !== null && !isOwnProfileRoute);

  useEffect(() => {
    if (isUsernameProfileRoute) {
      setPublicProfile(null);
      setPublicProfileLoading(false);
      setPublicProfileError(null);
      return;
    }

    if (isInvalidProfileRoute) {
      setPublicProfile(null);
      setPublicProfileLoading(false);
      setPublicProfileError("Invalid profile user id.");
      return;
    }

    if (!isReadOnlyProfile) {
      setPublicProfile(null);
      setPublicProfileError(null);
      setPublicProfileLoading(false);
      void userCustomizationStore.refresh();
      return;
    }

    let cancelled = false;

    const loadPublicProfile = async () => {
      setPublicProfileLoading(true);
      setPublicProfileError(null);

      try {
        const response = await api.get<UserInfoResponse>(`/api/users/${profileUserId}`);
        if (!cancelled) {
          setPublicProfile(response.data);
        }
      } catch (requestError) {
        const message = requestError instanceof Error ? requestError.message : "Failed to load user profile.";
        if (!cancelled) {
          setPublicProfile(null);
          setPublicProfileError(message);
        }
      } finally {
        if (!cancelled) {
          setPublicProfileLoading(false);
        }
      }
    };

    void loadPublicProfile();

    return () => {
      cancelled = true;
    };
  }, [isInvalidProfileRoute, isReadOnlyProfile, isUsernameProfileRoute, profileUserId]);

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

    setActiveStoreTab("all");
    void loadStoreItems();
  }, [isStoreOpen]);

  const filteredStoreItems = useMemo(() => {
    if (activeStoreTab === "all") {
      return storeItems;
    }

    return storeItems.filter((item) => item.TYPE === activeStoreTab);
  }, [activeStoreTab, storeItems]);

  const storeTabCounts = useMemo(() => {
    return {
      all: storeItems.length,
      flair: storeItems.filter((item) => item.TYPE === "flair").length,
      profile_picture: storeItems.filter((item) => item.TYPE === "profile_picture").length,
      background: storeItems.filter((item) => item.TYPE === "background").length,
    } as const;
  }, [storeItems]);

  const handlePurchase = async (itemId: number) => {
    setPurchaseInFlight(itemId);
    setStoreError(null);

    try {
      await api.post(`/api/store/${itemId}/purchase`);
      await userCustomizationStore.refresh();
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        const apiMessage = requestError.response?.data?.message ?? requestError.response?.data?.error;
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

  const handleEquip = async (itemId: number) => {
    const item = purchases.find((purchase) => purchase.ID === itemId);
    const flairCount = equippedItems.filter((equippedItem) => equippedItem.TYPE === "flair").length;
    const itemIsFlair = item?.TYPE === "flair";

    if (itemIsFlair && flairCount >= 3) {
      setInventoryError(null);
      setInventoryNotice("You can equip up to 3 flairs. Unequip one to equip another.");
      return;
    }

    setEquipInFlight(itemId);
    setInventoryError(null);
    setInventoryNotice(null);

    try {
      await userCustomizationStore.equipItem(itemId);
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        const apiMessage = requestError.response?.data?.error;
        if (requestError.response?.status === 409 && itemIsFlair) {
          setInventoryNotice("You can equip up to 3 flairs. Unequip one to equip another.");
        } else if (typeof apiMessage === "string" && apiMessage.trim()) {
          setInventoryError(apiMessage);
        } else {
          setInventoryError(requestError.message || "Failed to equip item.");
        }
      } else {
        setInventoryError("Failed to equip item.");
      }
    } finally {
      setEquipInFlight(null);
    }
  };

  const handleUnequip = async (itemId: number) => {
    setEquipInFlight(itemId);
    setInventoryError(null);
    setInventoryNotice(null);

    try {
      await userCustomizationStore.unequipItem(itemId);
    } catch (requestError) {
      if (axios.isAxiosError(requestError)) {
        const apiMessage = requestError.response?.data?.error;
        if (typeof apiMessage === "string" && apiMessage.trim()) {
          setInventoryError(apiMessage);
        } else {
          setInventoryError(requestError.message || "Failed to unequip item.");
        }
      } else {
        setInventoryError("Failed to unequip item.");
      }
    } finally {
      setEquipInFlight(null);
    }
  };

  const activeUser = isUsernameProfileRoute
    ? null
    : isReadOnlyProfile
      ? publicProfile?.user ?? null
      : isInvalidProfileRoute
        ? null
        : user;
  const activeEquippedItems = isUsernameProfileRoute
    ? []
    : isReadOnlyProfile
      ? publicProfile?.equippedItems ?? []
      : isInvalidProfileRoute
        ? []
        : equippedItems;
  const activeLoading = isUsernameProfileRoute
    ? false
    : isReadOnlyProfile
      ? publicProfileLoading
      : isInvalidProfileRoute
        ? false
        : isLoading;
  const activeError = isReadOnlyProfile || isInvalidProfileRoute ? publicProfileError : error;
  const showStoreInventory = !isReadOnlyProfile && !isInvalidProfileRoute;
  const firstName = (activeUser?.FIRSTNAME || routeFirstName || (showStoreInventory ? userData?.firstName : "") || "").trim();
  const lastName = (activeUser?.LASTNAME || (showStoreInventory ? userData?.lastName : "") || "").trim();
  const fullName = `${firstName} ${lastName}`.trim();
  const username = (activeUser?.USERNAME || routeUsername || (showStoreInventory ? userData?.name : "") || fullName || "KnightWise User").trim();
  const normalizedUsername = username.replace(/^@+/, "");
  const displayName = fullName || normalizedUsername || "KnightWise User";
  const usernameHandle = normalizedUsername ? `@${normalizedUsername}` : "";
  const flairItems = useMemo(() => activeEquippedItems.filter((item) => item.TYPE === "flair"), [activeEquippedItems]);
  const profilePictureItem = useMemo(
    () => activeEquippedItems.find((item) => item.TYPE === "profile_picture") || null,
    [activeEquippedItems]
  );
  const backgroundItem = useMemo(
    () => activeEquippedItems.find((item) => item.TYPE === "background") || null,
    [activeEquippedItems]
  );
  const purchasedItemIds = useMemo(() => new Set(purchases.map((item) => item.ID)), [purchases]);
  const equippedItemIds = useMemo(() => new Set(activeEquippedItems.map((item) => item.ID)), [activeEquippedItems]);
  const purchasedFlairs = useMemo(() => purchases.filter((item) => item.TYPE === "flair"), [purchases]);
  const purchasedProfilePictures = useMemo(() => purchases.filter((item) => item.TYPE === "profile_picture"), [purchases]);
  const purchasedBackgrounds = useMemo(() => purchases.filter((item) => item.TYPE === "background"), [purchases]);
  const profilePictureUrl = useMemo(
    () => {
      if (profilePictureItem) {
        return getProfilePictureUrlByItemName(profilePictureItem.NAME);
      }

      if (routeProfilePictureName) {
        return getProfilePictureUrlByItemName(routeProfilePictureName);
      }

      return null;
    },
    [profilePictureItem, routeProfilePictureName]
  );
  const backgroundUrl = useMemo(
    () => (backgroundItem ? getBackgroundUrlByItemName(backgroundItem.NAME) : null),
    [backgroundItem]
  );
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "KU";

  const renderItemPreview = (item: StoreItem) => {
    if (item.TYPE === "flair") {
      const flairStyle = getFlairPresentation(item.NAME);

      return (
        <div className="mb-3">
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${flairStyle.className}`}>
            <span className="mr-1" aria-hidden="true">{flairStyle.emoji}</span>
            <span>{item.NAME}</span>
          </span>
        </div>
      );
    }

    if (item.TYPE === "profile_picture") {
      const pictureUrl = getProfilePictureUrlByItemName(item.NAME);

      return (
        <div className="mb-3">
          {pictureUrl ? (
            <img
              src={pictureUrl}
              alt={`${item.NAME} preview`}
              className="h-16 w-16 rounded-full border-2 border-yellow-400 object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded-full border-2 border-yellow-400 bg-yellow-500 text-white text-lg font-bold flex items-center justify-center">
              {item.NAME.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      );
    }

    if (item.TYPE === "background") {
      const bgUrl = getBackgroundUrlByItemName(item.NAME);

      return (
        <div className="mb-3 h-20 w-full rounded-lg border border-gray-200 bg-gray-100 overflow-hidden">
          {bgUrl ? (
            <div
              className="h-full w-full"
              style={{
                backgroundImage: `url(${bgUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          ) : null}
        </div>
      );
    }

    return null;
  };

  return (
    <Layout>
      <div className="bg-gray-100 py-8 px-3 sm:px-4 lg:px-6 min-h-full">
        <div
          className="w-full max-w-6xl mx-auto bg-white rounded-lg shadow-md p-6 sm:p-8"
          style={backgroundUrl ? {
            backgroundImage: `linear-gradient(rgba(255,255,255,0.82), rgba(255,255,255,0.82)), url(${backgroundUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          } : undefined}
        >
          <h1 className="text-3xl font-bold text-gray-800 mb-8 pb-4 border-b-2 border-gray-200">
            Profile
          </h1>

          {isReadOnlyProfile && (
            <p className="-mt-5 mb-6 text-sm font-medium text-gray-600">
              Viewing {usernameHandle || displayName}'s public profile.
            </p>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center gap-5 mb-8">
            {profilePictureUrl ? (
              <img
                src={profilePictureUrl}
                alt={`${displayName} profile`}
                className="h-20 w-20 rounded-full object-cover border-2 border-yellow-500"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-yellow-500 text-white text-2xl font-bold flex items-center justify-center">
                {initials}
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-2xl font-semibold text-gray-900 leading-tight">{displayName}</p>
                {flairItems.map((item) => {
                  const flairStyle = getFlairPresentation(item.NAME);

                  return (
                    <span
                      key={item.ID}
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${flairStyle.className}`}
                    >
                      <span className="mr-1" aria-hidden="true">{flairStyle.emoji}</span>
                      <span>{item.NAME}</span>
                    </span>
                  );
                })}
              </div>
              {usernameHandle && (
                <p className="mt-1 text-sm font-medium text-gray-600">{usernameHandle}</p>
              )}
            </div>
          </div>

          <section>
            <h2 className="text-xl font-semibold text-gray-700 mb-4">Progress Stats</h2>
            <div className="bg-white/85 border border-gray-200 rounded-lg p-6 space-y-3 backdrop-blur-[1px]">
              {activeLoading && (
                <p className="text-gray-600">Loading profile data...</p>
              )}
              {activeError && (
                <p className="text-red-600">{activeError}</p>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Coins</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{activeUser?.COINS ?? "-"}</p>
                </article>
                <article className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Lifetime EXP</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {activeUser?.LIFETIME_EXP ?? (routeExpTab === "lifetime" && routeExp !== null ? routeExp : "-")}
                  </p>
                </article>
                <article className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Weekly EXP</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">
                    {activeUser?.WEEKLY_EXP ?? (routeExpTab === "weekly" && routeExp !== null ? routeExp : "-")}
                  </p>
                </article>
                <article className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-500">Daily EXP</p>
                  <p className="mt-2 text-3xl font-bold text-gray-900">{activeUser?.DAILY_EXP ?? "-"}</p>
                </article>
              </div>
            </div>
          </section>

          {showStoreInventory && (
            <section className="mt-8">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-gray-700">Inventory</h2>
              <button
                type="button"
                onClick={() => setIsStoreOpen(true)}
                aria-label="View Store"
                title="View Store"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500 text-black transition hover:bg-yellow-600"
              >
                <ShoppingCart size={20} />
              </button>
            </div>
            <div className="bg-white/85 border border-gray-200 rounded-lg p-6 backdrop-blur-[1px]">
              <p className="text-sm text-gray-600 mb-4">
                Equip and unequip your purchased profile customizations here.
              </p>

              {inventoryError && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                  {inventoryError}
                </div>
              )}

              {inventoryNotice && (
                <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
                  {inventoryNotice}
                </div>
              )}

              {purchases.length === 0 && (
                <p className="text-gray-600">You have not purchased any customization items yet.</p>
              )}

              {purchases.length > 0 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600 mb-2">Flairs</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {purchasedFlairs.map((item) => {
                        const isEquipped = equippedItemIds.has(item.ID);
                        const isEquipping = equipInFlight === item.ID;

                        return (
                          <article key={item.ID} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                            {renderItemPreview(item)}
                            <button
                              type="button"
                              onClick={() => void (isEquipped ? handleUnequip(item.ID) : handleEquip(item.ID))}
                              disabled={isEquipping}
                              className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold transition ${
                                isEquipping
                                  ? "cursor-wait bg-gray-200 text-gray-600"
                                  : isEquipped
                                    ? "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                                    : "bg-black text-white hover:bg-gray-800"
                              }`}
                            >
                              {isEquipping ? "Updating..." : isEquipped ? "Unequip" : "Equip"}
                            </button>
                          </article>
                        );
                      })}
                      {purchasedFlairs.length === 0 && (
                        <p className="text-sm text-gray-500">No flairs purchased.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600 mb-2">Profile Pictures</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {purchasedProfilePictures.map((item) => {
                        const isEquipped = equippedItemIds.has(item.ID);
                        const isEquipping = equipInFlight === item.ID;

                        return (
                          <article key={item.ID} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                            {renderItemPreview(item)}
                            <p className="font-semibold text-gray-900">{item.NAME}</p>
                            <button
                              type="button"
                              onClick={() => void (isEquipped ? handleUnequip(item.ID) : handleEquip(item.ID))}
                              disabled={isEquipping}
                              className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold transition ${
                                isEquipping
                                  ? "cursor-wait bg-gray-200 text-gray-600"
                                  : isEquipped
                                    ? "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                                    : "bg-black text-white hover:bg-gray-800"
                              }`}
                            >
                              {isEquipping ? "Updating..." : isEquipped ? "Unequip" : "Equip"}
                            </button>
                          </article>
                        );
                      })}
                      {purchasedProfilePictures.length === 0 && (
                        <p className="text-sm text-gray-500">No profile pictures purchased.</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600 mb-2">Backgrounds</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {purchasedBackgrounds.map((item) => {
                        const isEquipped = equippedItemIds.has(item.ID);
                        const isEquipping = equipInFlight === item.ID;

                        return (
                          <article key={item.ID} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                            {renderItemPreview(item)}
                            <p className="font-semibold text-gray-900">{item.NAME}</p>
                            <button
                              type="button"
                              onClick={() => void (isEquipped ? handleUnequip(item.ID) : handleEquip(item.ID))}
                              disabled={isEquipping}
                              className={`mt-3 w-full rounded-lg px-3 py-2 text-sm font-semibold transition ${
                                isEquipping
                                  ? "cursor-wait bg-gray-200 text-gray-600"
                                  : isEquipped
                                    ? "bg-white border border-gray-300 text-gray-700 hover:bg-gray-100"
                                    : "bg-black text-white hover:bg-gray-800"
                              }`}
                            >
                              {isEquipping ? "Updating..." : isEquipped ? "Unequip" : "Equip"}
                            </button>
                          </article>
                        );
                      })}
                      {purchasedBackgrounds.length === 0 && (
                        <p className="text-sm text-gray-500">No backgrounds purchased.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            </section>
          )}
        </div>
      </div>

      {showStoreInventory && isStoreOpen && (
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

            <div className="mb-5 flex flex-wrap gap-2">
              {STORE_TABS.map((tab) => {
                const isActive = activeStoreTab === tab.key;
                const count = storeTabCounts[tab.key];

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveStoreTab(tab.key)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      isActive
                        ? "border-gray-900 bg-gray-900 text-white"
                        : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {tab.label} ({count})
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredStoreItems.map((item) => {
                const isOwned = purchasedItemIds.has(item.ID);
                const isPurchasing = purchaseInFlight === item.ID;

                return (
                  <article key={item.ID} className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{item.TYPE.replace("_", " ")}</p>
                    {renderItemPreview(item)}
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

            {!storeLoading && filteredStoreItems.length === 0 && (
              <p className="mt-4 text-sm text-gray-500">
                No items found in this category.
              </p>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ProfilePage;
