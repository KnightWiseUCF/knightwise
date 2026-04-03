import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Check, Coins, Inbox, Lock, LockOpen, Search, Shield, Trash2, UserPlus, UserRound, X, Compass } from "lucide-react";
import { Eye, ScrollText, Trophy } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import api from "../api";
import { getBackgroundUrlByItemName, getProfilePictureUrlByItemName } from "../utils/storeCosmetics";
import { getProfilePathForUser } from "../utils/profileRouting";
import { getFlairPresentation } from "../utils/flairPresentation";
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
  UserInfoResponse,
} from "../models";

type GuildTab = "overview" | "inbox" | "browse";
type GuildCharterSort = "xp" | "weeklyXp" | "coinsContributed";

interface MemberCustomizationData {
  firstName: string | null;
  equippedItems: StoreItem[];
  lifetimeExp: number;
  weeklyExp: number;
  dailyExp: number;
  coins: number;
}

interface InviteGuildTheme {
  profilePictureName: string | null;
  backgroundName: string | null;
  flairNames: string[];
}

interface BrowseGuildItem {
  rank: number;
  id: number;
  name: string;
  exp: number;
  guildPicture: string | null;
  backgroundName: string | null;
  profilePictureName: string | null;
}

interface UserSearchResult {
  ID: number;
  USERNAME: string;
  FIRSTNAME: string | null;
  LASTNAME: string | null;
}

interface UserSearchResponse {
  users: UserSearchResult[];
}

interface FollowedLeaderboardEntry {
  username: string;
}

interface FollowedLeaderboardResponse {
  totalPages: number;
  leaderboard: FollowedLeaderboardEntry[];
}

const DELETE_CONFIRMATION_PHRASE = "YES DELETE NOW";

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

const getStoredUsername = (): string | null => {
  try {
    const raw = localStorage.getItem("user_data");
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { name?: unknown; USERNAME?: unknown; username?: unknown };
    const resolved = String(parsed.name ?? parsed.USERNAME ?? parsed.username ?? "").trim();
    return resolved || null;
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

const GUILDS_CACHE_KEY = "guild_snapshot_v1";

interface GuildPageCacheSnapshot {
  userId: number | null;
  savedAt: number;
  guildId: number | null;
  guild: GuildSummary | null;
  guildMembers: GuildMember[];
  memberCustomizations: Array<[number, MemberCustomizationData]>;
  equippedItems: GuildUnlockItem[];
  unlockedItems: GuildUnlockItem[];
  guildStoreItems: StoreItem[];
}

const loadGuildsSnapshot = (): GuildPageCacheSnapshot | null => {
  try {
    const raw = localStorage.getItem(GUILDS_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GuildPageCacheSnapshot;
  } catch {
    return null;
  }
};

const saveGuildsSnapshot = (snapshot: GuildPageCacheSnapshot): void => {
  try {
    localStorage.setItem(GUILDS_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore quota errors
  }
};

const GuildsPage: React.FC = () => {
  const { guildId: guildIdParam } = useParams<{ guildId: string }>();
  const navigate = useNavigate();
  const userId = useMemo(() => getStoredUserId(), []);
  const storedUsername = useMemo(() => getStoredUsername(), []);
  const hasLoadedOnceRef = useRef(false);
  const isFetchingRef = useRef(false);

  const [tab, setTab] = useState<GuildTab>("overview");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    setTab("overview");
  }, [guildIdParam]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [guildId, setGuildId] = useState<number | null>(null);
  const [myGuildId, setMyGuildId] = useState<number | null>(null);
  const [guild, setGuild] = useState<GuildSummary | null>(null);
  const [guildMembers, setGuildMembers] = useState<GuildMember[]>([]);
  const [memberCustomizations, setMemberCustomizations] = useState<Map<number, MemberCustomizationData>>(new Map());
  const [memberSortMetric, setMemberSortMetric] = useState<GuildCharterSort>("xp");
  const [equippedItems, setEquippedItems] = useState<GuildUnlockItem[]>([]);
  const [unlockedItems, setUnlockedItems] = useState<GuildUnlockItem[]>([]);
  const [guildRequests, setGuildRequests] = useState<GuildJoinRequest[]>([]);
  const [guildStoreItems, setGuildStoreItems] = useState<StoreItem[]>([]);

  const [invites, setInvites] = useState<GuildInvite[]>([]);
  const [nameSuggestion, setNameSuggestion] = useState("");
  const [createName, setCreateName] = useState("");
  const [nameToken, setNameToken] = useState("");
  const [contributionAmount, setContributionAmount] = useState(100);

  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [browseGuilds, setBrowseGuilds] = useState<BrowseGuildItem[]>([]);
  const [browseLoading, setBrowseLoading] = useState(false);
  const [browseError, setBrowseError] = useState<string | null>(null);
  const [inviteOwnerUsernames, setInviteOwnerUsernames] = useState<Map<number, string>>(new Map());
  const [inviteGuildThemes, setInviteGuildThemes] = useState<Map<number, InviteGuildTheme>>(new Map());

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState("");
  const [kickTargetMember, setKickTargetMember] = useState<{ id: number; username: string } | null>(null);
  const [followedUsernames, setFollowedUsernames] = useState<Set<string>>(new Set());
  const [followActionUsername, setFollowActionUsername] = useState<string | null>(null);

  useEffect(() => {
    const snapshot = loadGuildsSnapshot();
    if (!snapshot || snapshot.userId !== userId) return;

    setGuildId(snapshot.guildId);
    setMyGuildId(snapshot.guildId);
    setGuild(snapshot.guild);
    setGuildMembers(snapshot.guildMembers);
    setMemberCustomizations(new Map(snapshot.memberCustomizations));
    setEquippedItems(snapshot.equippedItems);
    setUnlockedItems(snapshot.unlockedItems);
    setGuildStoreItems(snapshot.guildStoreItems);
    hasLoadedOnceRef.current = true;
    setIsLoading(false);
  }, [userId]);

  const myMembership = useMemo(() => {
    if (!userId) {
      return null;
    }

    return guildMembers.find((member) => member.ID === userId) || null;
  }, [guildMembers, userId]);

  const myRole: GuildRole | null = myMembership?.ROLE || null;
  const canModerate = myRole === "Owner" || myRole === "Officer";
  const isOwner = myRole === "Owner";
  const isViewingOtherGuild = !!guildIdParam && !myMembership;

  const getMemberMetricValue = useCallback((member: GuildMember, metric: GuildCharterSort): number => {
    const customization = memberCustomizations.get(member.ID);

    if (metric === "coinsContributed") {
      return toNumber(member.COINS_CONTRIBUTED);
    }

    if (metric === "weeklyXp") {
      return toNumber(customization?.weeklyExp);
    }

    return toNumber(customization?.lifetimeExp);
  }, [memberCustomizations]);

  const sortedGuildMembers = useMemo(() => {
    const members = [...guildMembers];
    members.sort((a, b) => {
      const aValue = getMemberMetricValue(a, memberSortMetric);
      const bValue = getMemberMetricValue(b, memberSortMetric);

      if (bValue !== aValue) {
        return bValue - aValue;
      }

      return a.USERNAME.localeCompare(b.USERNAME);
    });

    return members;
  }, [getMemberMetricValue, guildMembers, memberSortMetric]);

  const coinBank = toNumber(guild?.COINS);

  const equippedBackground = useMemo(
    () => equippedItems.find((item) => item.TYPE === "background") || null,
    [equippedItems]
  );

  const equippedProfilePicture = useMemo(
    () => equippedItems.find((item) => item.TYPE === "profile_picture") || null,
    [equippedItems]
  );

  const equippedBackgroundUrl = useMemo(
    () => (equippedBackground ? getBackgroundUrlByItemName(equippedBackground.NAME) : null),
    [equippedBackground]
  );

  const equippedProfilePictureUrl = useMemo(
    () => (equippedProfilePicture ? getProfilePictureUrlByItemName(equippedProfilePicture.NAME) : null),
    [equippedProfilePicture]
  );

  const guildPageBackgroundStyle = equippedBackgroundUrl ? {
    backgroundImage: `linear-gradient(rgba(245,245,245,0.86), rgba(245,245,245,0.86)), url(${equippedBackgroundUrl})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  } : undefined;

  const renderGuildItemPreview = (item: StoreItem, options?: { compact?: boolean; grayscale?: boolean }) => {
    const compact = options?.compact === true;
    const grayscale = options?.grayscale === true;
    const previewClassName = grayscale ? "grayscale opacity-80" : "";

    if (item.TYPE === "flair") {
      const flairStyle = getFlairPresentation(item.NAME);

      return (
        <div className={`${compact ? "mb-2" : "mb-3"} ${previewClassName}`.trim()}>
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
        <div className={`${compact ? "mb-2" : "mb-3"} ${previewClassName}`.trim()}>
          {pictureUrl ? (
            <img
              src={pictureUrl}
              alt={`${item.NAME} preview`}
              className={`${compact ? "h-12 w-12" : "h-16 w-16"} rounded-full border-2 border-yellow-400 object-cover`}
            />
          ) : (
            <div className={`${compact ? "h-12 w-12 text-sm" : "h-16 w-16 text-lg"} rounded-full border-2 border-yellow-400 bg-yellow-500 text-white font-bold flex items-center justify-center`}>
              {item.NAME.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
      );
    }

    if (item.TYPE === "background") {
      const bgUrl = getBackgroundUrlByItemName(item.NAME);

      return (
        <div className={`${compact ? "mb-2 h-14" : "mb-3 h-20"} w-full rounded-lg border border-gray-200 bg-gray-100 overflow-hidden ${previewClassName}`.trim()}>
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

  const unlockRevealPercent = guildUnlockProgress.nextItem ? guildUnlockProgress.progressToNext : 100;
  const unlockRevealStage = !guildUnlockProgress.nextItem
    ? "full"
    : unlockRevealPercent < 25
      ? "question"
      : unlockRevealPercent < 50
        ? "silhouette"
        : "grayscale";

  const refreshGuild = useCallback(async (targetGuildId: number) => {
    const response = await api.get<GuildInfoResponse>(`/api/guilds/${targetGuildId}`);
    setGuild(response.data.guild);
    setGuildMembers(response.data.members || []);
    setEquippedItems((response.data.equippedItems || []).map((item) => ({ ...item, IS_EQUIPPED: true })));
    setUnlockedItems(response.data.unlockedItems || []);
    
    // Fetch full customization data for all guild members
    const members = response.data.members || [];
    const customizationsMap = new Map<number, MemberCustomizationData>();
    
    await Promise.all(
      members.map(async (member) => {
        try {
          const userResponse = await api.get<UserInfoResponse>(`/api/users/${member.ID}`);
          customizationsMap.set(member.ID, {
            firstName: userResponse.data.user?.FIRSTNAME ?? null,
            equippedItems: userResponse.data.equippedItems ?? [],
            lifetimeExp: toNumber(userResponse.data.user?.LIFETIME_EXP),
            weeklyExp: toNumber(userResponse.data.user?.WEEKLY_EXP),
            dailyExp: toNumber(userResponse.data.user?.DAILY_EXP),
            coins: toNumber(userResponse.data.user?.COINS),
          });
        } catch {
          customizationsMap.set(member.ID, {
            firstName: member.FIRSTNAME,
            equippedItems: [],
            lifetimeExp: 0,
            weeklyExp: 0,
            dailyExp: 0,
            coins: 0,
          });
        }
      })
    );
    
    setMemberCustomizations(customizationsMap);
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

  const refreshBrowseGuilds = useCallback(async () => {
    setBrowseLoading(true);
    setBrowseError(null);
    try {
      const response = await api.get<GuildLeaderboardResponse>("/api/leaderboard/guilds/weekly?page=1");
      const rankedGuilds = response.data.leaderboard as BrowseGuildItem[];

      const openGuildChecks = await Promise.all(
        rankedGuilds.map(async (browseGuild) => {
          try {
            const guildResponse = await api.get<GuildInfoResponse>(`/api/guilds/${browseGuild.id}`);
            if (!toBoolean(guildResponse.data.guild?.IS_OPEN)) return null;
            const equipped = guildResponse.data.equippedItems || [];
            const bg = equipped.find((item) => item.TYPE === "background") ?? null;
            const pfp = equipped.find((item) => item.TYPE === "profile_picture") ?? null;
            return {
              ...browseGuild,
              backgroundName: bg ? bg.NAME : null,
              profilePictureName: pfp ? pfp.NAME : null,
            };
          } catch {
            return null;
          }
        })
      );

      setBrowseGuilds(openGuildChecks.filter((guild): guild is BrowseGuildItem => guild !== null));
    } catch (requestError) {
      setBrowseError(getApiMessage(requestError, "Failed to load guilds."));
      setBrowseGuilds([]);
    } finally {
      setBrowseLoading(false);
    }
  }, []);

  const refreshMyGuild = useCallback(async () => {
    const response = await api.get<GuildLeaderboardResponse>("/api/leaderboard/guilds/weekly?page=1");
    const resolvedGuildId = typeof response.data.guildId === "number" ? response.data.guildId : null;

    setGuildId(resolvedGuildId);
    setMyGuildId(resolvedGuildId);

    if (resolvedGuildId) {
      await refreshGuild(resolvedGuildId);
      return;
    }

    setGuild(null);
    setGuildMembers([]);
    setMemberCustomizations(new Map());
    setEquippedItems([]);
    setUnlockedItems([]);
    setGuildRequests([]);
  }, [refreshGuild]);

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      if (!hasLoadedOnceRef.current) {
        setIsLoading(true);
      }
      setError(null);

      try {
        await Promise.all([
          refreshInvites(),
          refreshGuildStoreItems(),
          refreshMyGuild(),
        ]);

        const linkedGuildId = guildIdParam ? parseInt(guildIdParam, 10) : NaN;
        if (!isNaN(linkedGuildId) && linkedGuildId > 0) {
          await refreshGuild(linkedGuildId);
          setGuildId(linkedGuildId);
          setTab("overview");
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(getApiMessage(requestError, "Failed to load guild data."));
        }
      } finally {
        isFetchingRef.current = false;
        if (!cancelled) {
          hasLoadedOnceRef.current = true;
          setIsLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      cancelled = true;
    };
  }, [refreshGuildStoreItems, refreshInvites, refreshMyGuild, refreshGuild, guildIdParam]);

  useEffect(() => {
    if (!guild) return;
    if (isViewingOtherGuild) return;
    saveGuildsSnapshot({
      userId,
      savedAt: Date.now(),
      guildId,
      guild,
      guildMembers,
      memberCustomizations: [...memberCustomizations.entries()],
      equippedItems,
      unlockedItems,
      guildStoreItems,
    });
  }, [userId, guildId, guild, guildMembers, memberCustomizations, equippedItems, unlockedItems, guildStoreItems, isViewingOtherGuild]);

  useEffect(() => {
    if (!guildId || !canModerate) {
      setGuildRequests([]);
      return;
    }

    void refreshGuildRequests(guildId);
  }, [canModerate, guildId, refreshGuildRequests]);

  useEffect(() => {
    if (invites.length === 0) {
      setInviteOwnerUsernames(new Map());
      return;
    }

    let cancelled = false;

    const loadInviteOwnerUsernames = async () => {
      const uniqueOwnerIds = [...new Set(invites.map((invite) => invite.OWNER_ID))];
      const entries = await Promise.all(
        uniqueOwnerIds.map(async (ownerId) => {
          try {
            const response = await api.get<UserInfoResponse>(`/api/users/${ownerId}`);
            const username = (response.data.user?.USERNAME || "").trim();
            return [ownerId, username || "unknown"] as const;
          } catch {
            return [ownerId, "unknown"] as const;
          }
        })
      );

      if (!cancelled) {
        setInviteOwnerUsernames(new Map(entries));
      }
    };

    void loadInviteOwnerUsernames();

    return () => {
      cancelled = true;
    };
  }, [invites]);

  useEffect(() => {
    if (invites.length === 0) {
      setInviteGuildThemes(new Map());
      return;
    }

    let cancelled = false;

    const loadInviteGuildThemes = async () => {
      const uniqueGuildIds = [...new Set(invites.map((invite) => invite.GUILD_ID))];
      const entries: Array<[number, InviteGuildTheme]> = await Promise.all(
        uniqueGuildIds.map(async (inviteGuildId) => {
          try {
            const response = await api.get<GuildInfoResponse>(`/api/guilds/${inviteGuildId}`);
            const guildEquippedItems = response.data.equippedItems || [];
            const profilePictureName = guildEquippedItems.find((item) => item.TYPE === "profile_picture")?.NAME ?? null;
            const backgroundName = guildEquippedItems.find((item) => item.TYPE === "background")?.NAME ?? null;
            const flairNames = guildEquippedItems
              .filter((item) => item.TYPE === "flair")
              .map((item) => item.NAME);

            return [inviteGuildId, { profilePictureName, backgroundName, flairNames }];
          } catch {
            return [inviteGuildId, { profilePictureName: null, backgroundName: null, flairNames: [] }];
          }
        })
      );

      if (!cancelled) {
        setInviteGuildThemes(new Map(entries));
      }
    };

    void loadInviteGuildThemes();

    return () => {
      cancelled = true;
    };
  }, [invites]);

  const handleGenerateGuildName = async () => {
    setError(null);
    setNotice(null);

    try {
      const response = await api.get<{ name: string; nameToken: string }>("/api/guilds/name/generate");
      setNameSuggestion(response.data.name || "");
      setCreateName(response.data.name || "");
      setNameToken(response.data.nameToken || ""); // Set token to verify Guild name is from the generate endpoint
    } catch (requestError) {
      setError(getApiMessage(requestError, "Failed to generate guild name."));
    }
  };

  const handleCreateGuild = async () => {
    // Check name token 
    if (!nameToken)
    {
      setError("Please generate a Guild name first.");
      return;
    }

    const trimmedName = createName.trim();
    if (!trimmedName) {
      setError("Guild name is required.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await api.post<{ guildId: number; name: string; message: string }>("/api/guilds", { name: trimmedName, nameToken });
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

    if (deleteConfirmationInput.trim() !== DELETE_CONFIRMATION_PHRASE) {
      setError(`Deletion cancelled. You must type "${DELETE_CONFIRMATION_PHRASE}" exactly.`);
      setNotice(null);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await api.delete<ApiMessageResponse>(`/api/guilds/${guildId}`);
      setNotice(response.data.message || "Guild deleted.");
      setIsDeleteModalOpen(false);
      setDeleteConfirmationInput("");
      setGuildId(null);
      setGuild(null);
      setGuildMembers([]);
      setMemberCustomizations(new Map());
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
      setMemberCustomizations(new Map());
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

  const refreshFollowedUsernames = useCallback(async () => {
    if (!userId) {
      setFollowedUsernames(new Set());
      return;
    }

    try {
      const firstPageResponse = await api.get<FollowedLeaderboardResponse>("/api/leaderboard/followed/lifetime?page=1");
      const totalPages = Math.max(1, firstPageResponse.data.totalPages || 1);
      const usernames = new Set<string>(
        firstPageResponse.data.leaderboard.map((entry) => entry.username.trim().toLowerCase()).filter(Boolean)
      );

      for (let page = 2; page <= totalPages; page += 1) {
        const pageResponse = await api.get<FollowedLeaderboardResponse>(`/api/leaderboard/followed/lifetime?page=${page}`);
        for (const entry of pageResponse.data.leaderboard) {
          const normalized = entry.username.trim().toLowerCase();
          if (normalized) {
            usernames.add(normalized);
          }
        }
      }

      if (storedUsername) {
        usernames.delete(storedUsername.trim().toLowerCase());
      }

      setFollowedUsernames(usernames);
    } catch {
      // Keep existing follow state if refresh fails to avoid UI jitter.
    }
  }, [storedUsername, userId]);

  useEffect(() => {
    void refreshFollowedUsernames();
  }, [refreshFollowedUsernames]);

  const handleFollowMember = async (targetUserId: number, targetUsername: string) => {
    const normalizedTarget = targetUsername.trim().toLowerCase();
    if (!normalizedTarget || followActionUsername === normalizedTarget) {
      return;
    }

    setFollowActionUsername(normalizedTarget);
    setError(null);
    setNotice(null);

    try {
      if (followedUsernames.has(normalizedTarget)) {
        await api.delete(`/api/users/${targetUserId}/follow`);
        setFollowedUsernames((prev) => {
          const next = new Set(prev);
          next.delete(normalizedTarget);
          return next;
        });
      } else {
        await api.post(`/api/users/${targetUserId}/follow`);
        setFollowedUsernames((prev) => {
          const next = new Set(prev);
          next.add(normalizedTarget);
          return next;
        });
      }

      void refreshFollowedUsernames();
    } catch (requestError) {
      setError(getApiMessage(requestError, "Failed to update follow status."));
    } finally {
      setFollowActionUsername(null);
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
        <div
          className="max-w-6xl mx-auto rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
          style={guildPageBackgroundStyle}
        >
          <div className="p-8">
          <h1 className="text-3xl font-bold text-gray-900">Guilds</h1>

          <div className="mt-6 flex flex-wrap gap-2">
            {[
              { key: "overview", label: "My Guild", icon: <Shield size={16} aria-hidden="true" /> },
              { key: "browse", label: "Browse Guilds", icon: <Compass size={16} aria-hidden="true" /> },
              { key: "inbox", label: "Inbox", icon: <Inbox size={16} aria-hidden="true" /> },
            ].map((tabOption) => (
              <button
                key={tabOption.key}
                type="button"
                onClick={() => {
                  if (tabOption.key === "overview" && guildIdParam) {
                    navigate("/guilds");
                    return;
                  }
                  setTab(tabOption.key as GuildTab);
                  if (tabOption.key === "browse") {
                    void refreshBrowseGuilds();
                  }
                }}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold ${
                  tab === tabOption.key
                    ? "bg-yellow-500 text-black"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {tabOption.icon}
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
                    <h2 className="inline-flex items-center gap-2 text-xl font-semibold text-gray-900">
                      <UserPlus size={20} aria-hidden="true" />
                      Create a Guild
                    </h2>
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
                        readOnly
                        placeholder="Guild name"
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 bg-gray-100 cursor-not-allowed pointer-events-none"
                        tabIndex={-1}
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
                      Check out guilds current accepting new members on the Browse Guilds tab!
                    </p>
                    <button
                      type="button"
                      onClick={() => setTab("browse")}
                      className="mt-4 rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-black"
                    >
                      Open Browse
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 flex-1 flex-col gap-3">
                        <div className="flex items-center gap-3">
                          {equippedProfilePictureUrl ? (
                            <img
                              src={equippedProfilePictureUrl}
                              alt={`${guild.NAME} profile`}
                              className="h-12 w-12 rounded-full border border-gray-200 bg-white object-cover"
                            />
                          ) : (
                            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-gray-200 bg-white text-sm font-bold text-gray-700">
                              {guild.NAME.trim().charAt(0).toUpperCase() || "G"}
                            </div>
                          )}
                          <h2 className="text-2xl font-bold text-gray-900">{guild.NAME}</h2>
                        </div>
                        <div className="space-y-1">
                          {!isViewingOtherGuild && (
                            <p className="text-sm text-gray-600">
                              Your role: <span className="font-semibold">{formatRoleLabel(myRole || undefined)}</span>
                            </p>
                          )}
                          <p className="text-sm text-gray-600">
                            Join requests are currently: <span className="font-semibold">{currentGuildOpen ? "Open" : "Closed"}</span>
                          </p>
                        </div>

                        {isViewingOtherGuild && (
                          <div className="flex flex-col gap-3">
                            <p className="text-sm text-gray-600">You are not a member of this guild.</p>
                            <div className="flex flex-wrap gap-2">
                              {currentGuildOpen && (
                                <button
                                  type="button"
                                  disabled={isSubmitting}
                                  onClick={async () => {
                                    setIsSubmitting(true);
                                    setError(null);
                                    setNotice(null);
                                    try {
                                      await api.post(`/api/guilds/${guildId}/request`);
                                      setNotice("Join request sent!");
                                    } catch (requestError) {
                                      setError(getApiMessage(requestError, "Failed to send join request."));
                                    } finally {
                                      setIsSubmitting(false);
                                    }
                                  }}
                                  className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-black hover:bg-yellow-600 disabled:opacity-50"
                                >
                                  <UserPlus size={16} aria-hidden="true" />
                                  {isSubmitting ? "Sending..." : "Send Join Request"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => navigate("/guilds")}
                                className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-4 py-2 font-semibold text-gray-800 hover:bg-gray-200"
                              >
                                <Shield size={16} aria-hidden="true" />
                                Back to My Guild
                              </button>
                            </div>
                          </div>
                        )}
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

                    {!isViewingOtherGuild && (
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

                      <button
                        type="button"
                        onClick={() => {}}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-100 px-4 py-2 font-semibold text-blue-800 hover:bg-blue-200"
                        title="Guild leaderboard view is coming soon"
                      >
                        <Trophy size={16} aria-hidden="true" />
                        View Guild on Leaderboard
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

                      {!isOwner && myMembership && (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => void handleLeaveGuild()}
                          className="ml-auto rounded-lg bg-red-100 px-4 py-2 font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50"
                        >
                          Leave Guild
                        </button>
                      )}

                      {isOwner && (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => {
                            setDeleteConfirmationInput("");
                            setIsDeleteModalOpen(true);
                          }}
                          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                          Delete Guild
                        </button>
                      )}
                      </div>
                    )}

                    <div className="mt-6 rounded-xl border border-yellow-200 bg-gradient-to-br from-yellow-50 via-white to-amber-50 p-5 shadow-sm">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="inline-flex items-center gap-2 text-lg font-bold text-gray-900">
                          <Trophy size={18} aria-hidden="true" className="text-yellow-600" />
                          Guild Unlock Progress
                        </h3>
                        <span className="rounded-full bg-yellow-100 px-3 py-1 text-sm font-semibold text-yellow-800">
                          {guildUnlockProgress.unlockedCount}/{guildUnlockProgress.totalCount} unlocked
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="rounded-lg border border-yellow-200 bg-white/80 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Overall Progress</p>
                          <p className="mt-1 text-2xl font-bold text-gray-900">{guildUnlockProgress.overallPercent}%</p>
                        </div>
                        <div className="rounded-lg border border-yellow-200 bg-white/80 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Coin Bank</p>
                          <p className="mt-1 text-2xl font-bold text-gray-900">{coinBank.toLocaleString()}</p>
                        </div>
                        <div className="rounded-lg border border-yellow-200 bg-white/80 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Progress To Next</p>
                          <p className="mt-1 text-2xl font-bold text-gray-900">{guildUnlockProgress.progressToNext}%</p>
                        </div>
                      </div>

                      <div className={`mt-5 ${guildUnlockProgress.nextItem ? "grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,1fr)_240px] md:items-start" : ""}`}>
                        <div>
                          <div>
                            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-gray-700">
                              <span>Overall Completion</span>
                              <span>{guildUnlockProgress.overallPercent}%</span>
                            </div>
                            <div className="h-4 w-full overflow-hidden rounded-full bg-yellow-100">
                              <div
                                className="h-full rounded-full bg-yellow-500 transition-all"
                                style={{ width: `${guildUnlockProgress.overallPercent}%` }}
                              />
                            </div>
                          </div>

                          <div className="mt-5">
                            <div className="mb-1 flex items-center justify-between text-xs font-semibold text-gray-700">
                              <span>
                                {guildUnlockProgress.nextItem
                                  ? `Next Unlock: ${guildUnlockProgress.nextItem.NAME}`
                                  : "All guild items unlocked"}
                              </span>
                              <span>{guildUnlockProgress.progressToNext}%</span>
                            </div>
                            <div className="relative h-10 w-full">
                              <div className="absolute inset-x-0 top-1/2 h-4 -translate-y-1/2 overflow-hidden rounded-full bg-emerald-100">
                                <div
                                  className="h-full rounded-full bg-emerald-500 transition-all"
                                  style={{ width: `${guildUnlockProgress.progressToNext}%` }}
                                />
                              </div>
                              {guildUnlockProgress.nextItem && [25, 50, 75, 100].map((milestone) => {
                                const reached = unlockRevealPercent >= milestone;
                                const isFinalMilestone = milestone === 100;
                                const markerSize = isFinalMilestone ? 32 : 24;
                                return (
                                  <span
                                    key={`bar-marker-${milestone}`}
                                    className={`absolute flex items-center justify-center rounded-full border font-bold transition-colors ${
                                      reached
                                        ? "border-emerald-700 bg-emerald-500 text-white"
                                        : "border-emerald-300 bg-emerald-200 text-emerald-700"
                                    } ${isFinalMilestone ? "text-xs" : "text-[10px]"}`}
                                    style={{
                                      width: `${markerSize}px`,
                                      height: `${markerSize}px`,
                                      left: milestone === 100
                                        ? `calc(100% - ${markerSize}px)`
                                        : `calc(${milestone}% - ${markerSize / 2}px)`,
                                      top: `calc(50% - ${markerSize / 2}px)`,
                                    }}
                                    aria-label={`${milestone}% milestone ${reached ? "reached" : "locked"}`}
                                  />
                                );
                              })}
                            </div>
                            {guildUnlockProgress.nextItem && guildUnlockProgress.nextThreshold !== null && (
                              <p className="mt-3 text-xs text-gray-700">
                                Coin bank: {coinBank.toLocaleString()} / {guildUnlockProgress.nextThreshold.toLocaleString()} ({Math.max(0, guildUnlockProgress.nextThreshold - coinBank).toLocaleString()} coins remaining)
                              </p>
                            )}
                          </div>
                        </div>

                        {guildUnlockProgress.nextItem && (
                          <div className="rounded-lg border border-yellow-200 bg-white/90 p-4">
                            <p className="mb-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Next Unlock Preview</p>

                            {unlockRevealStage === "question" ? (
                              <div className="flex items-center justify-center">
                                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-gray-300 bg-gray-100 text-2xl font-bold text-gray-400">
                                  ?
                                </div>
                              </div>
                            ) : (
                              <div
                                className={`flex items-center justify-center ${
                                  unlockRevealStage === "silhouette"
                                    ? "grayscale brightness-0 opacity-70"
                                    : "grayscale"
                                }`}
                              >
                                {renderGuildItemPreview(guildUnlockProgress.nextItem, { compact: true, grayscale: false })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-gray-900">
                          <ScrollText size={18} aria-hidden="true" />
                          Guild Charter
                        </h3>
                        <div className="inline-flex items-center gap-2">
                          <label htmlFor="guild-charter-sort" className="text-sm font-medium text-gray-700">Rank by</label>
                          <select
                            id="guild-charter-sort"
                            value={memberSortMetric}
                            onChange={(event) => setMemberSortMetric(event.target.value as GuildCharterSort)}
                            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800"
                          >
                            <option value="xp">XP</option>
                            <option value="weeklyXp">Weekly XP</option>
                            <option value="coinsContributed">Coins Contributed</option>
                          </select>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {sortedGuildMembers.map((member, index) => {
                          const canKick = canModerate
                            && member.ROLE !== "Owner"
                            && !(isOwner && member.ID === userId);

                          const canPromote = canModerate && member.ROLE === "Member";
                          const canDemote = isOwner && member.ROLE === "Officer";
                          const metricLabel = memberSortMetric === "xp"
                            ? "XP"
                            : memberSortMetric === "weeklyXp"
                              ? "Weekly XP"
                              : "Coins Contributed";
                          const metricValue = getMemberMetricValue(member, memberSortMetric);
                          const memberFlairs = (memberCustomizations.get(member.ID)?.equippedItems ?? [])
                            .filter((item) => item.TYPE === "flair");

                          return (
                            <div key={member.ID} className="rounded-lg border border-gray-200 bg-white p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                  <p className="font-semibold text-gray-900">{toDisplayName(member)}</p>
                                  <p className="text-sm text-gray-600">@{member.USERNAME} • {member.ROLE}</p>
                                  {memberFlairs.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {memberFlairs.slice(0, 3).map((flairItem) => {
                                        const flairStyle = getFlairPresentation(flairItem.NAME);
                                        return (
                                          <span
                                            key={`${member.ID}-${flairItem.ID}`}
                                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${flairStyle.className}`}
                                          >
                                            <span className="mr-1" aria-hidden="true">{flairStyle.emoji}</span>
                                            <span>{flairItem.NAME}</span>
                                          </span>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-xs text-gray-500">#{index + 1}</p>
                                  <p className="text-xs text-gray-500">{metricLabel}: {metricValue.toLocaleString()}</p>
                                </div>
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
                                      onClick={() => setKickTargetMember({ id: member.ID, username: member.USERNAME })}
                                      className="rounded-md bg-red-100 px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-200"
                                    >
                                      Kick
                                    </button>
                                  )}
                                </div>
                              )}

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <Link
                                  to={getProfilePathForUser({ username: member.USERNAME, fallbackToOwnProfile: true }) || "/profile"}
                                  state={{
                                    leaderboardEntry: {
                                      username: member.USERNAME,
                                      firstName: memberCustomizations.get(member.ID)?.firstName || member.FIRSTNAME || undefined,
                                      profilePicture: memberCustomizations.get(member.ID)?.equippedItems?.find(
                                        (item) => item.TYPE === "profile_picture"
                                      )?.NAME ?? null,
                                      equippedItems: memberCustomizations.get(member.ID)?.equippedItems ?? [],
                                      lifetimeExp: memberCustomizations.get(member.ID)?.lifetimeExp,
                                      weeklyExp: memberCustomizations.get(member.ID)?.weeklyExp,
                                      dailyExp: memberCustomizations.get(member.ID)?.dailyExp,
                                      coins: memberCustomizations.get(member.ID)?.coins,
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700 hover:bg-blue-200"
                                  aria-label={`View ${member.USERNAME}'s profile`}
                                >
                                  <Eye size={14} aria-hidden="true" />
                                  View Profile
                                </Link>
                                <Link
                                  to="/leaderboard"
                                  state={{ focusLeaderboardUsername: member.USERNAME }}
                                  className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800 hover:bg-amber-200"
                                  aria-label={`Show ${member.USERNAME} on leaderboard`}
                                >
                                  <Trophy size={14} aria-hidden="true" />
                                  Leaderboard
                                </Link>
                                {member.ID !== userId && (
                                  <button
                                    type="button"
                                    disabled={followActionUsername === member.USERNAME.toLowerCase()}
                                    onClick={() => void handleFollowMember(member.ID, member.USERNAME)}
                                    className={`ml-auto inline-flex items-center gap-1 rounded-md px-3 py-1 text-sm font-semibold disabled:opacity-50 ${
                                      followedUsernames.has(member.USERNAME.toLowerCase())
                                        ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
                                        : "bg-sky-100 text-sky-700 hover:bg-sky-200"
                                    }`}
                                  >
                                    {followActionUsername === member.USERNAME.toLowerCase()
                                      ? "Updating..."
                                      : followedUsernames.has(member.USERNAME.toLowerCase())
                                        ? "Following"
                                        : "Follow"}
                                  </button>
                                )}
                              </div>
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
                                {renderGuildItemPreview(item)}
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
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <h3 className="inline-flex items-center gap-2 text-lg font-semibold text-gray-900">
                              <UserPlus size={18} aria-hidden="true" />
                              Invite Users
                            </h3>
                            <span className="rounded-full bg-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700">
                              {searchResults.length} result{searchResults.length === 1 ? "" : "s"}
                            </span>
                          </div>

                          <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
                            <div className="flex gap-2">
                              <div className="relative w-full">
                                <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                  type="text"
                                  value={searchInput}
                                  onChange={(event) => setSearchInput(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter") {
                                      event.preventDefault();
                                      void handleSearchUsers();
                                    }
                                  }}
                                  placeholder="Search by username"
                                  className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3"
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => void handleSearchUsers()}
                                className="inline-flex items-center gap-1 rounded-lg bg-gray-900 px-4 py-2 font-semibold text-white hover:bg-black"
                              >
                                <Search size={14} aria-hidden="true" />
                                Search
                              </button>
                            </div>
                          </div>

                          {searchLoading && <p className="mt-3 text-sm text-gray-600">Searching users...</p>}

                          {!searchLoading && searchInput.trim().length > 0 && searchResults.length === 0 && (
                            <p className="mt-3 text-sm text-gray-600">No users found for "{searchInput.trim()}".</p>
                          )}

                          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
                            {searchResults.map((result) => (
                              <div key={result.ID} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">{toDisplayName(result)}</p>
                                  <p className="text-xs text-gray-600">@{result.USERNAME}</p>
                                </div>
                                <button
                                  type="button"
                                  disabled={isSubmitting}
                                  onClick={() => void handleInviteUser(result.ID)}
                                  className="inline-flex items-center gap-1 rounded-md bg-yellow-500 px-3 py-1 text-sm font-semibold text-black hover:bg-yellow-600 disabled:opacity-50"
                                >
                                  <UserPlus size={14} aria-hidden="true" />
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
                <h2 className="inline-flex items-center gap-2 text-xl font-semibold text-gray-900">
                  <Inbox size={20} aria-hidden="true" />
                  Invites
                </h2>

                <div className="mt-4 space-y-3">
                  {invites.map((invite) => {
                    const theme = inviteGuildThemes.get(invite.GUILD_ID);
                    const inviteBackgroundUrl = theme?.backgroundName
                      ? getBackgroundUrlByItemName(theme.backgroundName)
                      : null;
                    const inviteProfilePictureUrl = theme?.profilePictureName
                      ? getProfilePictureUrlByItemName(theme.profilePictureName)
                      : null;

                    return (
                      <div
                        key={`${invite.GUILD_ID}-${invite.OWNER_ID}`}
                        className="rounded-lg border border-gray-200 bg-white p-3"
                        style={inviteBackgroundUrl ? {
                          backgroundImage: `linear-gradient(rgba(255,255,255,0.88), rgba(255,255,255,0.88)), url(${inviteBackgroundUrl})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        } : undefined}
                      >
                        <div className="flex items-start gap-3">
                          {inviteProfilePictureUrl ? (
                            <img
                              src={inviteProfilePictureUrl}
                              alt={`${invite.guildName} profile`}
                              className="h-10 w-10 rounded-full border border-gray-200 object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-gray-100 text-sm font-bold text-gray-700">
                              {invite.guildName.trim().charAt(0).toUpperCase() || "G"}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-gray-900">{invite.guildName}</p>
                            <p className="mt-1 inline-flex items-center gap-1 text-sm text-gray-600">
                              <UserRound size={14} aria-hidden="true" />
                              Owner: @{inviteOwnerUsernames.get(invite.OWNER_ID) || "unknown"}
                            </p>
                            {theme && theme.flairNames.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {theme.flairNames.slice(0, 3).map((flairName) => {
                                  const flairStyle = getFlairPresentation(flairName);
                                  return (
                                    <span
                                      key={`${invite.GUILD_ID}-${flairName}`}
                                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${flairStyle.className}`}
                                    >
                                      <span className="mr-1" aria-hidden="true">{flairStyle.emoji}</span>
                                      <span>{flairName}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => void handleResolveInvite(invite.GUILD_ID, "accept")}
                            className="inline-flex items-center gap-1 rounded-md bg-yellow-500 px-3 py-1 text-sm font-semibold text-black hover:bg-yellow-600 disabled:opacity-50"
                          >
                            <Check size={14} aria-hidden="true" />
                            Accept
                          </button>
                          <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => void handleResolveInvite(invite.GUILD_ID, "reject")}
                            className="inline-flex items-center gap-1 rounded-md bg-red-100 px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-200 disabled:opacity-50"
                          >
                            <X size={14} aria-hidden="true" />
                            Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}

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

          {tab === "browse" && (
            <section className="mt-6">
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-5">
                <h2 className="inline-flex items-center gap-2 text-xl font-semibold text-gray-900">
                  <Compass size={20} aria-hidden="true" />
                  Browse Guilds
                </h2>
                <p className="mt-1 text-sm text-gray-600">Explore and join guilds that are currently accepting join requests.</p>

                {browseError && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                    {browseError}
                  </div>
                )}

                {browseLoading && (
                  <div className="mt-4 text-center text-gray-600">Loading guilds...</div>
                )}

                {!browseLoading && browseGuilds.length === 0 && !browseError && (
                  <div className="mt-4 text-center text-gray-600">No open guilds found.</div>
                )}

                {!browseLoading && browseGuilds.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {browseGuilds.map((g) => {
                      const cardBgUrl = g.backgroundName ? getBackgroundUrlByItemName(g.backgroundName) : null;
                      const cardPfpUrl = g.profilePictureName ? getProfilePictureUrlByItemName(g.profilePictureName) : null;
                      const cardStyle = cardBgUrl ? {
                          backgroundImage: `linear-gradient(rgba(245,245,245,0.86), rgba(245,245,245,0.86)), url(${cardBgUrl})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        } : undefined;
                      return (
                      <div key={g.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden" style={cardStyle}>
                        <div className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3 flex-1">
                            {cardPfpUrl ? (
                              <img src={cardPfpUrl} alt={`${g.name} icon`} className="h-10 w-10 rounded-full object-cover border border-gray-200 bg-white shrink-0" />
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-sm font-bold shrink-0">
                                {g.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900">{g.name}</h3>
                              <p className="text-sm text-gray-600">Rank: #{g.rank}</p>
                            </div>
                          </div>
                          <div className="ml-4 text-right">
                            <p className="text-sm font-semibold text-gray-900">{toNumber(g.exp)} XP</p>
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (myGuildId === g.id) {
                                navigate("/guilds");
                              } else {
                                navigate(`/guild/${g.id}`);
                              }
                            }}
                            className={`inline-flex items-center gap-1 rounded-md px-3 py-1 text-sm font-semibold disabled:opacity-50 ${
                              myGuildId === g.id
                                ? "bg-green-100 text-green-800 hover:bg-green-200"
                                : "bg-amber-100 text-amber-800 hover:bg-amber-200"
                            }`}
                          >
                            {myGuildId === g.id ? <Shield size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
                            {myGuildId === g.id ? "My Guild" : "View Guild"}
                          </button>

                          {myGuildId !== g.id && (
                            <button
                              type="button"
                              disabled={isSubmitting}
                              onClick={async () => {
                                setIsSubmitting(true);
                                setError(null);
                                setNotice(null);
                                try {
                                  await api.post(`/api/guilds/${g.id}/request`);
                                  setNotice("Join request sent!");
                                } catch (requestError) {
                                  setError(getApiMessage(requestError, "Failed to send join request."));
                                } finally {
                                  setIsSubmitting(false);
                                }
                              }}
                              className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700 hover:bg-blue-200 disabled:opacity-50"
                            >
                              <Lock size={14} aria-hidden="true" />
                              Request to Join
                            </button>
                          )}
                        </div>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}
          </div>
        </div>
      </div>

      {isDeleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Confirm Guild Deletion</h2>
                <p className="mt-1 text-sm text-gray-600">
                  This action is permanent and cannot be undone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isSubmitting) {
                    setIsDeleteModalOpen(false);
                    setDeleteConfirmationInput("");
                  }
                }}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close delete confirmation"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              Type <span className="font-bold">{DELETE_CONFIRMATION_PHRASE}</span> to confirm deletion.
            </div>

            <input
              type="text"
              value={deleteConfirmationInput}
              onChange={(event) => setDeleteConfirmationInput(event.target.value)}
              placeholder={DELETE_CONFIRMATION_PHRASE}
              className="mt-4 w-full rounded-lg border border-gray-300 px-3 py-2"
              autoFocus
            />

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setDeleteConfirmationInput("");
                }}
                className="rounded-lg bg-gray-200 px-4 py-2 font-semibold text-gray-800 hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || deleteConfirmationInput.trim() !== DELETE_CONFIRMATION_PHRASE}
                onClick={() => void handleDeleteGuild()}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 size={16} aria-hidden="true" />
                {isSubmitting ? "Deleting..." : "Delete Guild"}
              </button>
            </div>
          </div>
        </div>
      )}

      {kickTargetMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Remove Member</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Are you sure you want to kick @{kickTargetMember.username} from this guild?
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!isSubmitting) {
                    setKickTargetMember(null);
                  }
                }}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close kick confirmation"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              This action removes the member from your guild immediately.
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setKickTargetMember(null)}
                className="rounded-lg bg-gray-200 px-4 py-2 font-semibold text-gray-800 hover:bg-gray-300 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={async () => {
                  await handleKickMember(kickTargetMember.id);
                  setKickTargetMember(null);
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 size={16} aria-hidden="true" />
                {isSubmitting ? "Removing..." : "Kick Member"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default GuildsPage;
