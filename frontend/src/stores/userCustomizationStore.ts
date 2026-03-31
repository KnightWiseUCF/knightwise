import { useSyncExternalStore } from "react";
import axios from "axios";
import api from "../api";
import type { ApiMessageResponse, PurchasedItem, PurchasesResponse, UserInfo, UserInfoResponse } from "../models";

interface UserCustomizationState {
  userId: number | null;
  user: UserInfo | null;
  equippedItems: PurchasedItem[];
  purchases: PurchasedItem[];
  isLoading: boolean;
  error: string | null;
}

let state: UserCustomizationState = {
  userId: null,
  user: null,
  equippedItems: [],
  purchases: [],
  isLoading: false,
  error: null,
};

let stateVersion = 0;
let refreshInFlight: Promise<void> | null = null;
let refreshInFlightUserId: number | null = null;

const listeners = new Set<() => void>();

const emit = () => {
  listeners.forEach((listener) => listener());
};

const setState = (partial: Partial<UserCustomizationState>) => {
  state = {
    ...state,
    ...partial,
  };
  stateVersion += 1;
  emit();
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

const normalizeStoredToken = (rawToken: string | null): string | null => {
  if (!rawToken) {
    return null;
  }

  let normalized = rawToken.trim();
  if (!normalized) {
    return null;
  }

  if (
    (normalized.startsWith('"') && normalized.endsWith('"')) ||
    (normalized.startsWith("'") && normalized.endsWith("'"))
  ) {
    normalized = normalized.slice(1, -1).trim();
  }

  normalized = normalized.replace(/^bearer\s+/i, "").trim();

  if (!normalized || normalized === "null" || normalized === "undefined") {
    return null;
  }

  return normalized;
};

const decodeBase64Url = (value: string): string | null => {
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`;
    return atob(padded);
  } catch {
    return null;
  }
};

const getTokenUserId = (): number | null => {
  const token = normalizeStoredToken(localStorage.getItem("token"));
  if (!token) {
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const payloadString = decodeBase64Url(parts[1]);
  if (!payloadString) {
    return null;
  }

  try {
    const payload = JSON.parse(payloadString) as { userId?: unknown; id?: unknown; sub?: unknown };
    return toNumber(payload.userId ?? payload.id ?? payload.sub);
  } catch {
    return null;
  }
};

const getStoredUserId = (): number | null => {
  try {
    const rawUserData = localStorage.getItem("user_data");
    if (!rawUserData) {
      return null;
    }

    const parsed = JSON.parse(rawUserData) as { id?: unknown; ID?: unknown };
    return toNumber(parsed.id ?? parsed.ID);
  } catch {
    return null;
  }
};

const getStoredAccountType = (): string => {
  return (localStorage.getItem("account_type") || "").trim().toLowerCase();
};

const canLoadUserCustomization = (): boolean => {
  const accountType = getStoredAccountType();
  return accountType === "" || accountType === "student";
};

const normalizePurchasedItem = (item: PurchasedItem): PurchasedItem => {
  const equipped = item.IS_EQUIPPED === true || item.IS_EQUIPPED === 1;

  return {
    ...item,
    IS_EQUIPPED: equipped,
  };
};

const loadUserInfo = async (userId: number): Promise<void> => {
  const response = await api.get<UserInfoResponse>(`/api/users/${userId}`);

  const normalizedEquippedItems = response.data.equippedItems.map((item) => ({
    ...item,
    IS_EQUIPPED: true,
  }));

  setState({
    userId,
    user: response.data.user,
    equippedItems: normalizedEquippedItems,
  });
};

const loadPurchases = async (userId: number): Promise<void> => {
  const response = await api.get<PurchasesResponse>(`/api/users/${userId}/purchases`);
  const normalizedPurchases = response.data.purchases.map(normalizePurchasedItem);

  setState({
    userId,
    purchases: normalizedPurchases,
  });
};

const resolveUserId = (providedUserId?: number): number => {
  const id = providedUserId ?? getTokenUserId() ?? state.userId ?? getStoredUserId();

  if (!id) {
    throw new Error("Unable to resolve authenticated user id.");
  }

  return id;
};

const refresh = async (providedUserId?: number): Promise<void> => {
  if (!canLoadUserCustomization()) {
    setState({ isLoading: false, error: null, user: null, equippedItems: [], purchases: [] });
    return;
  }

  let userId: number;
  try {
    userId = resolveUserId(providedUserId);
  } catch {
    setState({ isLoading: false, error: null, user: null, equippedItems: [], purchases: [] });
    return;
  }

  if (refreshInFlight && refreshInFlightUserId === userId) {
    return refreshInFlight;
  }

  setState({ isLoading: true, error: null });

  const request = (async () => {
    try {
      await Promise.all([loadUserInfo(userId), loadPurchases(userId)]);
      setState({ isLoading: false, error: null });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setState({
          isLoading: false,
          user: null,
          equippedItems: [],
          purchases: [],
          error: "Profile customization data is unavailable for this account.",
        });
        return;
      }

      const message = error instanceof Error ? error.message : "Failed to load user customization data.";
      setState({ isLoading: false, error: message });
    }
  })();

  refreshInFlight = request;
  refreshInFlightUserId = userId;

  try {
    await request;
  } finally {
    if (refreshInFlight === request) {
      refreshInFlight = null;
      refreshInFlightUserId = null;
    }
  }
};

const updateProfile = async (newFirstName: string, newLastName: string): Promise<void> => {
  setState({ isLoading: true, error: null });

  try {
    const userId = resolveUserId();
    await api.put<ApiMessageResponse>(`/api/users/${userId}`, { newFirstName, newLastName });
    await loadUserInfo(userId);
    setState({ isLoading: false, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update user profile.";
    setState({ isLoading: false, error: message });
    throw error;
  }
};

const equipItem = async (itemId: number): Promise<void> => {
  setState({ isLoading: true, error: null });

  try {
    const userId = resolveUserId();
    await api.put<ApiMessageResponse>(`/api/users/${userId}/equip`, { itemId });
    await Promise.all([loadUserInfo(userId), loadPurchases(userId)]);
    setState({ isLoading: false, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to equip item.";
    setState({ isLoading: false, error: message });
    throw error;
  }
};

const unequipItem = async (itemId: number): Promise<void> => {
  setState({ isLoading: true, error: null });

  try {
    const userId = resolveUserId();
    await api.put<ApiMessageResponse>(`/api/users/${userId}/unequip`, { itemId });
    await Promise.all([loadUserInfo(userId), loadPurchases(userId)]);
    setState({ isLoading: false, error: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to unequip item.";
    setState({ isLoading: false, error: message });
    throw error;
  }
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getSnapshot = (): number => {
  return stateVersion;
};

const getStateSnapshot = (): UserCustomizationState => {
  return state;
};

export const userCustomizationStore = {
  subscribe,
  getSnapshot,
  getStateSnapshot,
  refresh,
  updateProfile,
  equipItem,
  unequipItem,
};

export const useUserCustomizationStore = () => {
  useSyncExternalStore(
    userCustomizationStore.subscribe,
    userCustomizationStore.getSnapshot,
    userCustomizationStore.getSnapshot
  );

  return userCustomizationStore.getStateSnapshot();
};
