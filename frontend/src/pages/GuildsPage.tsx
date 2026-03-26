import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Coins, Lock, LockOpen } from "lucide-react";
import Layout from "../components/Layout";
import api from "../api";
import type {
  ApiMessageResponse,
  GuildInfoResponse,
  GuildInvite,
  GuildInvitesResponse,
  GuildJoinRequest,
  GuildLeaderboardResponse,
  GuildMember,
  GuildRole,
  GuildSummary,
  GuildUnlockItem,
  StoreItem,
  StoreItemsResponse,
} from "../models";

type GuildTab = "overview" | "inbox";

interface UserSearchResult {
  ID: number;
  USERNAME: string;
  FIRSTNAME: string | null;
  LASTNAME: string | null;
}

interface UserSearchResponse {
  users: UserSearchResult[];
}

const toNumber = (value: number | string | null | undefined): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const toBoolean = (value: boolean | number | null | undefined): boolean => {
  if (typeof value === "boolean") {
    return value;
  }

  return value === 1;
};

const formatRoleLabel = (role: GuildRole | string | undefined): string => {
  if (!role) {
    return "Member";
  }

  return role;
};

const toDisplayName = (member: { FIRSTNAME?: string | null; LASTNAME?: string | null; USERNAME?: string | null }): string => {
  const fullName = `${member.FIRSTNAME || ""} ${member.LASTNAME || ""}`.trim();
  return fullName || member.USERNAME || "Unknown User";
};

const getStoredUserId = (): number | null => {
  try {
    const raw = localStorage.getItem("user_data");
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { id?: unknown; ID?: unknown };
    const resolved = Number(parsed.id ?? parsed.ID);
    return Number.isInteger(resolved) && resolved > 0 ? resolved : null;
  } catch {
    return null;
  }
};

const getApiMessage = (error: unknown, fallback: string): string => {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const data = error.response?.data as { message?: unknown; error?: unknown } | undefined;
  const message = typeof data?.message === "string" && data.message.trim()
    ? data.message
    : typeof data?.error === "string" && data.error.trim()
      ? data.error
      : "";

  return message || error.message || fallback;
};

const GuildsPage: React.FC = () => {
  const userId = useMemo(() => getStoredUserId(), []);

  const [tab, setTab] = useState<GuildTab>("overview");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [guildId, setGuildId] = useState<number | null>(null);
  const [guild, setGuild] = useState<GuildSummary | null>(null);
  const [guildMembers, setGuildMembers] = useState<GuildMember[]>([]);
  const [equippedItems, setEquippedItems] = useState<GuildUnlockItem[]>([]);
  const [unlockedItems, setUnlockedItems] = useState<GuildUnlockItem[]>([]);
  const [guildRequests, setGuildRequests] = useState<GuildJoinRequest[]>([]);
  const [guildStoreItems, setGuildStoreItems] = useState<StoreItem[]>([]);

  const [invites, setInvites] = useState<GuildInvite[]>([]);
  const [nameSuggestion, setNameSuggestion] = useState("");
  const [createName, setCreateName] = useState("");
  const [contributionAmount, setContributionAmount] = useState(100);

  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const myMembership = useMemo(() => {
    if (!userId) {
      return null;
    }

    return guildMembers.find((member) => member.ID === userId) || null;
  }, [guildMembers, userId]);

  const myRole: GuildRole | null = myMembership?.ROLE || null;
  const canModerate = myRole === "Owner" || myRole === "Officer";
  const isOwner = myRole === "Owner";

  const coinBank = toNumber(guild?.COINS);

  const guildUnlockProgress = useMemo(() => {
    const allGuildItems = guildStoreItems;
    const unlockedIds = new Set(unlockedItems.map((item) => item.ID));
    const unlockedCount = allGuildItems.filter((item) => unlockedIds.has(item.ID)).length;
    const totalCount = allGuildItems.length;
    const overallPercent = totalCount > 0
      ? Math.round((unlockedCount / totalCount) * 100)
      : 0;

    const lockedItems = allGuildItems
      .filter((item) => !unlockedIds.has(item.ID))
      .sort((left, right) => toNumber(left.COST) - toNumber(right.COST));

    const nextItem = lockedItems[0] || null;
    const nextThreshold = nextItem ? toNumber(nextItem.COST) : null;

    const unlockedThresholds = allGuildItems
      .filter((item) => unlockedIds.has(item.ID))
      .map((item) => toNumber(item.COST))
      .sort((left, right) => left - right);

    const previousThreshold = unlockedThresholds.length > 0
      ? unlockedThresholds[unlockedThresholds.length - 1]
      : 0;

    const progressToNext = (() => {
      if (nextThreshold === null) {
        return 100;
      }

      const span = Math.max(1, nextThreshold - previousThreshold);
      const raw = ((coinBank - previousThreshold) / span) * 100;
      return Math.min(100, Math.max(0, Math.round(raw)));
    })();

    return {
      unlockedCount,
      totalCount,
      overallPercent,
      nextItem,
      nextThreshold,
      previousThreshold,
      progressToNext,
    };
  }, [coinBank, guildStoreItems, unlockedItems]);

  const refreshGuild = useCallback(async (targetGuildId: number) => {
    const response = await api.get<GuildInfoResponse>(`/api/guilds/${targetGuildId}`);
    setGuild(response.data.guild);
    setGuildMembers(response.data.members || []);
    setEquippedItems((response.data.equippedItems || []).map((item) => ({ ...item, IS_EQUIPPED: true })));
    setUnlockedItems(response.data.unlockedItems || []);
  }, []);

  const refreshGuildRequests = useCallback(async (targetGuildId: number) => {
    try {
      const response = await api.get<{ requests?: GuildJoinRequest[] }>(`/api/guilds/${targetGuildId}/requests`);
      setGuildRequests(Array.isArray(response.data.requests) ? response.data.requests : []);
    } catch {
      setGuildRequests([]);
    }
  }, []);

  const refreshInvites = useCallback(async () => {
    const response = await api.get<GuildInvitesResponse>("/api/users/me/guild-invites");
    setInvites(response.data.invites || []);
  }, []);

  const refreshGuildStoreItems = useCallback(async () => {
    const response = await api.get<StoreItemsResponse>("/api/store");
    const items = Array.isArray(response.data.items) ? response.data.items : [];
    setGuildStoreItems(items.filter((item) => item.IS_GUILD_ITEM === true || item.IS_GUILD_ITEM === 1));
  }, []);

  const refreshMyGuild = useCallback(async () => {
    const response = await api.get<GuildLeaderboardResponse>("/api/leaderboard/guilds/weekly?page=1");
    const resolvedGuildId = typeof response.data.guildId === "number" ? response.data.guildId : null;

    setGuildId(resolvedGuildId);

    if (resolvedGuildId) {
      await refreshGuild(resolvedGuildId);
      return;
    }

    setGuild(null);
    setGuildMembers([]);
    setEquippedItems([]);
    setUnlockedItems([]);
    setGuildRequests([]);
  }, [refreshGuild]);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      setIsLoading(true);
      setError(null);

      try {
        await Promise.all([
          refreshInvites(),
          refreshGuildStoreItems(),
          refreshMyGuild(),
        ]);
      } catch (requestError) {
        if (!cancelled) {
          setError(getApiMessage(requestError, "Failed to load guild data."));
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [refreshGuildStoreItems, refreshInvites, refreshMyGuild]);

  useEffect(() => {
    if (!guildId || !canModerate) {
      setGuildRequests([]);
      return;
    }

    void refreshGuildRequests(guildId);
  }, [canModerate, guildId, refreshGuildRequests]);

  const handleGenerateGuildName = async () => {
    setError(null);
    setNotice(null);

    try {
      const response = await api.get<{ name: string }>("/api/guilds/name/generate");
      setNameSuggestion(response.data.name || "");
      setCreateName(response.data.name || "");
    } catch (requestError) {
      setError(getApiMessage(requestError, "Failed to generate guild name."));
    }
  };

  const handleCreateGuild = async () => {
    const trimmedName = createName.trim();
    if (!trimmedName) {
      setError("Guild name is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await api.post<{ guildId: number; message: string }>("/api/guilds", { name: trimmedName });
      setNotice(response.data.message || "Guild created.");
      setGuildId(response.data.guildId);
      setTab("overview");
      await refreshGuild(response.data.guildId);
      await refreshMyGuild();
    } catch (requestError) {
      setError(getApiMessage(requestError, "Failed to create guild."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContribute = async () => {
    if (!guildId) {
      return;
    }

    const amount = Math.max(1, Math.floor(contributionAmount));

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await api.post<{ message: string }>(`/api/guilds/${guildId}/contribute`, { amount });
      setNotice(response.data.message || "Contribution successful.");
      await refreshGuild(guildId);
      await refreshMyGuild();
    } catch (requestError) {
      setError(getApiMessage(requestError, "Failed to contribute."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGuild = async () => {
    if (!guildId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await api.delete<ApiMessageResponse>(`/api/guilds/${guildId}`);
      setNotice(response.data.message || "Guild deleted.");
      setGuildId(null);
      setGuild(null);
      setGuildMembers([]);
      setEquippedItems([]);
      setUnlockedItems([]);
      setGuildRequests([]);
      await refreshMyGuild();
    } catch (requestError) {
      setError(getApiMessage(requestError, "Failed to delete guild."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLeaveGuild = async () => {
    if (!guildId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await api.delete<ApiMessageResponse>(`/api/guilds/${guildId}/leave`);
      setNotice(response.data.message || "You left the guild.");
      setGuildId(null);
      setGuild(null);
      setGuildMembers([]);
      setEquippedItems([]);
      setUnlockedItems([]);
      setGuildRequests([]);
      await refreshMyGuild();
    } catch (requestError) {
      setError(getApiMessage(requestError, "Failed to leave guild."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleOpen = async (nextOpen: boolean) => {
    if (!guildId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await api.patch<{ message: string }>(`/api/guilds/${guildId}/open`, { isOpen: nextOpen });
      setNotice(response.data.message || "Guild join settings updated.");
      await refreshGuild(guildId);
    } catch (requestError) {
      setError(getApiMessage(requestError, "Failed to update guild join settings."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSearchUsers = async () => {
    const query = searchInput.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    setError(null);

    try {
      const response = await api.get<UserSearchResponse>(`/api/users/search?username=${encodeURIComponent(query)}&page=1`);
      setSearchResults(response.data.users || []);
    } catch (requestError) {
      setError(getApiMessage(requestError, "Failed to search users."));
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleInviteUser = async (targetUserId: number) => {
    if (!guildId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await api.post<ApiMessageResponse>(`/api/guilds/${guildId}/invite`, { targetUserId });
      setNotice(response.data.message || "Invite sent.");
    } catch (requestError) {
      setError(getApiMessage(requestError, "Failed to send invite."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveInvite = async (targetGuildId: number, action: "accept" | "reject", confirmLeave = false) => {
    if (!userId) {
      setError("Unable to resolve your user id.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await api.patch<{ message?: string; requiresConfirmation?: boolean }>(
        `/api/guilds/${targetGuildId}/entry/${userId}`,
        { action, confirmLeave }
      );

      if (response.data.requiresConfirmation && !confirmLeave) {
        const shouldProceed = window.confirm("You are already in another guild. Leave it and accept this invite?");
        if (shouldProceed) {
          await handleResolveInvite(targetGuildId, action, true);
        }
        return;
      }

      setNotice(response.data.message || `Invite ${action}ed.`);
      await refreshInvites();
      await refreshMyGuild();
    } catch (requestError) {
      setError(getApiMessage(requestError, "Failed to resolve invite."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveJoinRequest = async (targetUserId: number, action: "accept" | "reject", confirmLeave = false) => {
    if (!guildId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await api.patch<{ message?: string; requiresConfirmation?: boolean }>(
        `/api/guilds/${guildId}/entry/${targetUserId}`,
        { action, confirmLeave }
      );

      if (response.data.requiresConfirmation && !confirmLeave) {
        const shouldProceed = window.confirm("This user is in another guild. Remove them from that guild and continue?");
        if (shouldProceed) {
          await handleResolveJoinRequest(targetUserId, action, true);
        }
        return;
      }

      setNotice(response.data.message || `Request ${action}ed.`);
      await refreshGuild(guildId);
      await refreshGuildRequests(guildId);
    } catch (requestError) {
      setError(getApiMessage(requestError, "Failed to resolve request."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKickMember = async (targetUserId: number) => {
    if (!guildId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await api.delete<ApiMessageResponse>(`/api/guilds/${guildId}/members/${targetUserId}`);
      setNotice(response.data.message || "Member removed.");
      await refreshGuild(guildId);
    } catch (requestError) {
      setError(getApiMessage(requestError, "Failed to remove member."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRoleUpdate = async (targetUserId: number, newRole: "Member" | "Officer") => {
    if (!guildId) {
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await api.patch<ApiMessageResponse>(`/api/guilds/${guildId}/members/${targetUserId}/role`, { newRole });
      setNotice(response.data.message || "Role updated.");
      await refreshGuild(guildId);
    } catch (requestError) {
      setError(getApiMessage(requestError, "Failed to update role."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEquipToggle = async (item: GuildUnlockItem) => {
    if (!guildId) {
      return;
    }

    const isEquipped = toBoolean(item.IS_EQUIPPED);
    const endpoint = isEquipped ? "unequip" : "equip";

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await api.put<ApiMessageResponse>(`/api/guilds/${guildId}/${endpoint}`, { itemId: item.ID });
      setNotice(response.data.message || "Guild item updated.");
      await refreshGuild(guildId);
    } catch (requestError) {
      setError(getApiMessage(requestError, "Failed to update guild item."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentGuildOpen = toBoolean(guild?.IS_OPEN);

  return (
    <Layout>
      <div className="bg-gray-100 py-8 px-4 min-h-full">
        <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-900">Guilds</h1>
          <p className="mt-2 text-gray-600">
            Build your community: create or join a guild, contribute coins, and manage members based on role.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {[
              { key: "overview", label: "My Guild" },
              { key: "inbox", label: "Inbox" },
            ].map((tabOption) => (
              <button
                key={tabOption.key}
                type="button"
                onClick={() => setTab(tabOption.key as GuildTab)}
                className={`rounded-lg px-4 py-2 text-sm font-semibold ${
                  tab === tabOption.key
                    ? "bg-yellow-500 text-black"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {tabOption.label}
              </button>
            ))}
          </div>

          {error && (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
              {error}
            </div>
          )}

          {notice && (
            <div className="mt-5 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">
              {notice}
            </div>
          )}

          {isLoading && <p className="mt-5 text-gray-600">Loading guild data...</p>}

          {tab === "overview" && (
            <section className="mt-6 space-y-6">
              {!guild ? (
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                    <h2 className="text-xl font-semibold text-gray-900">Create a Guild</h2>
                    <p className="mt-1 text-sm text-gray-600">
                      Guild names are permanent. You can generate a random name and create immediately.
                    </p>

                    {nameSuggestion && (
                      <p className="mt-4 text-sm text-gray-700">
                        Suggested name: <span className="font-semibold">{nameSuggestion}</span>
                      </p>
                    )}

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                      <input
                        type="text"
                        value={createName}
                        onChange={(event) => setCreateName(event.target.value)}
                        placeholder="Guild name"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2"
                      />
                      <button
                        type="button"
                        onClick={() => void handleGenerateGuildName()}
                        className="rounded-lg bg-gray-200 px-4 py-2 font-semibold text-gray-800 hover:bg-gray-300"
                      >
                        Shuffle Name
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => void handleCreateGuild()}
                      className="mt-4 rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-black hover:bg-yellow-600 disabled:opacity-50"
                    >
                      {isSubmitting ? "Creating..." : "Create Guild"}
                    </button>
                  </div>

                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                    <h2 className="text-xl font-semibold text-gray-900">Need a Guild?</h2>
                    <p className="mt-1 text-sm text-gray-600">
                      Guild discovery and leaderboard are moving to the upcoming Statistics page.
                    </p>
                    <button
                      type="button"
                      onClick={() => setTab("inbox")}
                      className="mt-4 rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-black"
                    >
                      Open Inbox
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900">{guild.NAME}</h2>
                        <p className="mt-1 text-sm text-gray-600">
                          Your role: <span className="font-semibold">{formatRoleLabel(myRole || undefined)}</span>
                        </p>
                        <p className="mt-1 text-sm text-gray-600">
                          Join requests are currently: <span className="font-semibold">{currentGuildOpen ? "Open" : "Closed"}</span>
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                          <p className="text-gray-500">Coin Bank</p>
                          <p className="font-semibold text-gray-900">{toNumber(guild.COINS).toLocaleString()}</p>
                        </div>
                        <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                          <p className="text-gray-500">Members</p>
                          <p className="font-semibold text-gray-900">{guildMembers.length}</p>
                        </div>
                        <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                          <p className="text-gray-500">Weekly EXP</p>
                          <p className="font-semibold text-gray-900">{toNumber(guild.WEEKLY_EXP).toLocaleString()}</p>
                        </div>
                        <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                          <p className="text-gray-500">Lifetime EXP</p>
                          <p className="font-semibold text-gray-900">{toNumber(guild.LIFETIME_EXP).toLocaleString()}</p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-end gap-3">
                      <div>
                        <label className="text-sm font-semibold text-gray-700">Contribute Coins</label>
                        <input
                          type="number"
                          min={1}
                          value={contributionAmount}
                          onChange={(event) => setContributionAmount(Number(event.target.value || 1))}
                          className="mt-1 block w-40 rounded-lg border border-gray-300 px-3 py-2"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => void handleContribute()}
                        className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-black hover:bg-yellow-600 disabled:opacity-50"
                      >
                        <Coins size={16} aria-hidden="true" />
                        {isSubmitting ? "Submitting..." : "Contribute"}
                      </button>

                      {canModerate && (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => void handleToggleOpen(!currentGuildOpen)}
                          className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 font-semibold disabled:opacity-50 ${
                            currentGuildOpen
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                              : "bg-rose-100 text-rose-800 hover:bg-rose-200"
                          }`}
                        >
                          {currentGuildOpen ? <LockOpen size={16} aria-hidden="true" /> : <Lock size={16} aria-hidden="true" />}
                          {currentGuildOpen ? "Status: Open" : "Status: Closed"}
                        </button>
                      )}

                      {!isOwner && (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => void handleLeaveGuild()}
                          className="rounded-lg bg-red-100 px-4 py-2 font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50"
                        >
                          Leave Guild
                        </button>
                      )}

                      {isOwner && (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => {
                            const shouldDelete = window.confirm("Delete this guild permanently?");
                            if (shouldDelete) {
                              void handleDeleteGuild();
                            }
                          }}
                          className="rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Delete Guild
                        </button>
                      )}
                    </div>

                    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-base font-semibold text-gray-900">Guild Unlock Progress</h3>
                        <p className="text-sm text-gray-600">
                          {guildUnlockProgress.unlockedCount}/{guildUnlockProgress.totalCount} unlocked
                        </p>
                      </div>

                      <div className="mt-3">
                        <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                          <span>Overall</span>
                          <span>{guildUnlockProgress.overallPercent}%</span>
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-yellow-500 transition-all"
                            style={{ width: `${guildUnlockProgress.overallPercent}%` }}
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                          <span>
                            {guildUnlockProgress.nextItem
                              ? `Next: ${guildUnlockProgress.nextItem.NAME}`
                              : "All guild items unlocked"}
                          </span>
                          <span>{guildUnlockProgress.progressToNext}%</span>
                        </div>
                        <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-emerald-500 transition-all"
                            style={{ width: `${guildUnlockProgress.progressToNext}%` }}
                          />
                        </div>
                        {guildUnlockProgress.nextItem && guildUnlockProgress.nextThreshold !== null && (
                          <p className="mt-2 text-xs text-gray-600">
                            Coin bank: {coinBank.toLocaleString()} / {guildUnlockProgress.nextThreshold.toLocaleString()} ({Math.max(0, guildUnlockProgress.nextThreshold - coinBank).toLocaleString()} coins to unlock)
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                      <h3 className="text-lg font-semibold text-gray-900">Members</h3>

                      <div className="mt-4 space-y-3">
                        {guildMembers.map((member) => {
                          const canKick = canModerate
                            && member.ROLE !== "Owner"
                            && !(isOwner && member.ID === userId);

                          const canPromote = canModerate && member.ROLE === "Member";
                          const canDemote = isOwner && member.ROLE === "Officer";

                          return (
                            <div key={member.ID} className="rounded-lg border border-gray-200 bg-white p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-gray-900">{toDisplayName(member)}</p>
                                  <p className="text-sm text-gray-600">@{member.USERNAME} • {member.ROLE}</p>
                                </div>
                                <p className="text-xs text-gray-500">
                                  Coins Contributed: {toNumber(member.COINS_CONTRIBUTED).toLocaleString()}
                                </p>
                              </div>

                              {(canKick || canPromote || canDemote) && (
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {canPromote && (
                                    <button
                                      type="button"
                                      disabled={isSubmitting}
                                      onClick={() => void handleRoleUpdate(member.ID, "Officer")}
                                      className="rounded-md bg-gray-200 px-3 py-1 text-sm font-semibold text-gray-800 hover:bg-gray-300"
                                    >
                                      Promote to Officer
                                    </button>
                                  )}
                                  {canDemote && (
                                    <button
                                      type="button"
                                      disabled={isSubmitting}
                                      onClick={() => void handleRoleUpdate(member.ID, "Member")}
                                      className="rounded-md bg-gray-200 px-3 py-1 text-sm font-semibold text-gray-800 hover:bg-gray-300"
                                    >
                                      Demote to Member
                                    </button>
                                  )}
                                  {canKick && (
                                    <button
                                      type="button"
                                      disabled={isSubmitting}
                                      onClick={() => {
                                        const shouldKick = window.confirm(`Kick ${member.USERNAME} from guild?`);
                                        if (shouldKick) {
                                          void handleKickMember(member.ID);
                                        }
                                      }}
                                      className="rounded-md bg-red-100 px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-200"
                                    >
                                      Kick
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                        <h3 className="text-lg font-semibold text-gray-900">Guild Inventory</h3>
                        <p className="mt-1 text-sm text-gray-600">
                          Guild items unlock automatically when coin bank reaches item cost.
                        </p>

                        <div className="mt-4 space-y-3">
                          {unlockedItems.length === 0 && (
                            <p className="text-sm text-gray-600">No guild items unlocked yet.</p>
                          )}

                          {unlockedItems.map((item) => {
                            const isEquipped = toBoolean(item.IS_EQUIPPED);
                            const canEdit = canModerate;

                            return (
                              <div key={item.ID} className="rounded-lg border border-gray-200 bg-white p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <div>
                                    <p className="font-semibold text-gray-900">{item.NAME}</p>
                                    <p className="text-sm text-gray-600">{item.TYPE.replace("_", " ")} • Cost {toNumber(item.COST)}</p>
                                  </div>
                                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                                    isEquipped ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                                  }`}>
                                    {isEquipped ? "Equipped" : "Unlocked"}
                                  </span>
                                </div>

                                {canEdit && (
                                  <button
                                    type="button"
                                    disabled={isSubmitting}
                                    onClick={() => void handleEquipToggle(item)}
                                    className="mt-3 rounded-md bg-gray-200 px-3 py-1 text-sm font-semibold text-gray-800 hover:bg-gray-300"
                                  >
                                    {isEquipped ? "Unequip" : "Equip"}
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {equippedItems.length > 0 && (
                          <div className="mt-4 rounded-lg border border-gray-200 bg-white p-3">
                            <p className="text-sm font-semibold text-gray-700">Currently Equipped</p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {equippedItems.map((item) => (
                                <span key={item.ID} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                                  {item.NAME}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {canModerate && (
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                          <h3 className="text-lg font-semibold text-gray-900">Invite Users</h3>
                          <div className="mt-3 flex gap-2">
                            <input
                              type="text"
                              value={searchInput}
                              onChange={(event) => setSearchInput(event.target.value)}
                              placeholder="Search username"
                              className="w-full rounded-lg border border-gray-300 px-3 py-2"
                            />
                            <button
                              type="button"
                              onClick={() => void handleSearchUsers()}
                              className="rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-black"
                            >
                              Search
                            </button>
                          </div>

                          {searchLoading && <p className="mt-3 text-sm text-gray-600">Searching...</p>}

                          <div className="mt-3 space-y-2">
                            {searchResults.map((result) => (
                              <div key={result.ID} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-3">
                                <p className="text-sm text-gray-800">
                                  {toDisplayName(result)} ({result.USERNAME})
                                </p>
                                <button
                                  type="button"
                                  disabled={isSubmitting}
                                  onClick={() => void handleInviteUser(result.ID)}
                                  className="rounded-md bg-yellow-500 px-3 py-1 text-sm font-semibold text-black hover:bg-yellow-600 disabled:opacity-50"
                                >
                                  Invite
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {tab === "inbox" && (
            <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                <h2 className="text-xl font-semibold text-gray-900">Invites</h2>
                <p className="mt-1 text-sm text-gray-600">Invitations sent to you.</p>

                <div className="mt-4 space-y-3">
                  {invites.map((invite) => (
                    <div key={`${invite.GUILD_ID}-${invite.OWNER_ID}`} className="rounded-lg border border-gray-200 bg-white p-3">
                      <p className="font-semibold text-gray-900">{invite.guildName}</p>
                      <p className="text-sm text-gray-600">Guild ID: {invite.GUILD_ID}</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => void handleResolveInvite(invite.GUILD_ID, "accept")}
                          className="rounded-md bg-yellow-500 px-3 py-1 text-sm font-semibold text-black hover:bg-yellow-600 disabled:opacity-50"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => void handleResolveInvite(invite.GUILD_ID, "reject")}
                          className="rounded-md bg-gray-200 px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}

                  {invites.length === 0 && (
                    <p className="text-sm text-gray-600">No pending invites.</p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                <h2 className="text-xl font-semibold text-gray-900">Guild Join Requests</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Officers and owners can approve or reject pending requests.
                </p>

                {!canModerate && (
                  <p className="mt-4 text-sm text-gray-600">You need Officer or Owner role to manage join requests.</p>
                )}

                {canModerate && (
                  <div className="mt-4 space-y-3">
                    {guildRequests.map((request) => (
                      <div key={request.USER_ID} className="rounded-lg border border-gray-200 bg-white p-3">
                        <p className="font-semibold text-gray-900">{toDisplayName(request)}</p>
                        <p className="text-sm text-gray-600">@{request.USERNAME}</p>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => void handleResolveJoinRequest(request.USER_ID, "accept")}
                            className="rounded-md bg-yellow-500 px-3 py-1 text-sm font-semibold text-black hover:bg-yellow-600 disabled:opacity-50"
                          >
                            Accept
                          </button>
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => void handleResolveJoinRequest(request.USER_ID, "reject")}
                            className="rounded-md bg-gray-200 px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-300 disabled:opacity-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}

                    {guildRequests.length === 0 && (
                      <p className="text-sm text-gray-600">No pending join requests.</p>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default GuildsPage;
