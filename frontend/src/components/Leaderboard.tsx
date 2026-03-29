/*
import { lstat } from 'fs'
import React, { FC, useState, useEffect, useMemo } from 'react'
import { useNavigate } from "react-router-dom";
import api from "../api";
import { LeaderboardT, LeaderboardResponse  } from '../models';
import { getProfilePictureUrlByItemName } from '../utils/storeCosmetics';
*/

import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import api from "../api";
import { getProfilePictureUrlByItemName } from "../utils/storeCosmetics";
import { getBackgroundUrlByItemName } from "../utils/storeCosmetics";
import { getProfilePathForUser } from "../utils/profileRouting";
import { useUserCustomizationStore, userCustomizationStore } from "../stores/userCustomizationStore";
import { Trophy, ChevronLeft, ChevronRight, Swords, Users } from "lucide-react";

interface LeaderboardEntry
{
  userId?:        number | string | null;
  id?:            number | string | null;
  ID?:            number | string | null;
  rank:           number;
  username:       string;
  firstName:      string;
  exp:            number;
  profilePicture: string | null;
}

interface LeaderboardResponse
{
  userRank:    number | null;
  userExp:     number | null;
  page:        number;
  totalPages:  number;
  leaderboard: LeaderboardEntry[];
}

type Tab  = "weekly" | "lifetime";
type Mode = "individual" | "guild";

interface LeaderboardNavigationState {
  focusLeaderboardUsername?: string;
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

const Leaderboard: React.FC = () =>
{
  const location = useLocation();
  const [mode, setMode]             = useState<Mode>("individual");
  const [activeTab, setActiveTab]   = useState<Tab>("weekly");
  const [data, setData]             = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [page, setPage]             = useState(1);
  const [focusedUsername, setFocusedUsername] = useState<string | null>(null);
  const [searchUsername, setSearchUsername] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState<UserSearchResult[]>([]);
  const [searchSuggestionsLoading, setSearchSuggestionsLoading] = useState(false);
  const { equippedItems } = useUserCustomizationStore();

  const { user } = useUserCustomizationStore();

  useEffect(() =>
  {
    void userCustomizationStore.refresh();
  }, []);
  
  const backgroundItem = useMemo(
    () => equippedItems.find((item) => item.TYPE === "background") || null,
    [equippedItems]
  );

  const backgroundUrl = useMemo(
    () => (backgroundItem ? getBackgroundUrlByItemName(backgroundItem.NAME) : null),
    [backgroundItem]
  );

  const backgroundStyle = backgroundUrl ? {
    backgroundImage: `linear-gradient(rgba(245,245,245,0.86), rgba(245,245,245,0.86)), url(${backgroundUrl})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  } : undefined;

  const currentUsername = user?.USERNAME?.toLowerCase() ?? null;

  const fetchLeaderboard = useCallback(async (tab: Tab, pageNum: number) =>
  {
    setLoading(true);
    setError(null);
    try
    {
      const response = await api.get<LeaderboardResponse>(
        `/api/leaderboard/${tab}?page=${pageNum}`
      );
      setData(response.data);
    }
    catch
    {
      setError("Failed to load leaderboard. Please try again.");
    }
    finally
    {
      setLoading(false);
    }
  }, []);

  useEffect(() =>
  {
    if (mode === "individual") void fetchLeaderboard(activeTab, page);
  }, [mode, activeTab, page, fetchLeaderboard]);

  const handleTabChange = (tab: Tab) =>
  {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setPage(1);
    setData(null);
  };

  const getRankOrdinal = (rank: number) => {
    if (rank % 10 === 1 && (rank > 20 || rank < 10))
      return 'st';
    else if (rank % 10 === 2 && (rank > 20 || rank < 10))
      return 'nd';
    else if (rank % 10 === 3 && (rank > 20 || rank < 10))
      return 'rd';
    else return 'th';
  }

  const rankBadge = (rank: number) =>
  {
    if (rank === 1) return { symbol: "🥇", color: "text-yellow-500", size: "text-3xl" };
    if (rank === 2) return { symbol: "🥈", color: "text-gray-400", size: "text-3xl"   };
    if (rank === 3) return { symbol: "🥉", color: "text-orange-400", size: "text-3xl" };
    return { symbol: `${rank}${getRankOrdinal(rank)}`, color: "text-gray-600", size: "text-base" };
  };

  const userRef = useRef<HTMLTableRowElement | null>(null);
  const focusedUserRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    const navigationState = location.state as LeaderboardNavigationState | null;
    const requestedUsername = (navigationState?.focusLeaderboardUsername || "").trim().toLowerCase();
    if (!requestedUsername) {
      return;
    }

    setMode("individual");
    setActiveTab("weekly");
    setPage(1);
    setData(null);
    setFocusedUsername(requestedUsername);
  }, [location.state]);

  useEffect(() => {
    if (!focusedUsername || mode !== "individual" || loading || !data) {
      return;
    }

    const matchingEntry = data.leaderboard.find(
      (entry) => entry.username.toLowerCase() === focusedUsername
    );

    if (matchingEntry) {
      focusedUserRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    let cancelled = false;

    const findUserPage = async () => {
      for (let i = 1; i <= data.totalPages; i += 1) {
        if (i === page) {
          continue;
        }

        try {
          const response = await api.get<LeaderboardResponse>(`/api/leaderboard/${activeTab}?page=${i}`);
          const found = response.data.leaderboard.some(
            (entry) => entry.username.toLowerCase() === focusedUsername
          );

          if (found) {
            if (!cancelled) {
              setPage(i);
            }
            return;
          }
        } catch {
          // Keep existing leaderboard errors and continue trying remaining pages.
        }
      }

      if (!cancelled) {
        setError(`Could not find @${focusedUsername} on the ${activeTab} leaderboard.`);
      }
    };

    void findUserPage();

    return () => {
      cancelled = true;
    };
  }, [activeTab, data, focusedUsername, loading, mode, page]);

  const scrollToUser = async () => 
  {
    if(loading == false){
      userRef.current?.scrollIntoView({ behavior: 'smooth', block: "center"})

      if (userRef.current == null) 
      {
        let userFound = false; 

        if(data?.totalPages != undefined)
        {
          //go thru all leaderboard pages and find user
          for(let i = 1; i <= data?.totalPages && !userFound; i++) 
          {
            setError(null);
            try
            {
              const response = await api.get<LeaderboardResponse>(
                `/api/leaderboard/${activeTab}?page=${i}`
              );

              
              for(let k = 0; k < response.data.leaderboard.length && !userFound; k++) 
              {
                if (response.data?.leaderboard[k].username.toLowerCase() === currentUsername?.toLowerCase()) 
                {
                  //set page to user's page and scroll to them
                  setPage(i);
                  scrollToUser();
                  //stops searching in both loops
                  userFound = true;
                }
              }
            }
            catch
            {
              setError("Failed to load leaderboard. Please try again.");
            }
          }
        }
      }
    }
  };

  const handleUserSearch = () => {
    const normalizedQuery = searchUsername.trim().replace(/^@+/, "").toLowerCase();

    if (!normalizedQuery) {
      setError("Enter a username to search.");
      return;
    }

    setMode("individual");
    setError(null);
    setPage(1);
    setFocusedUsername(normalizedQuery);
    setSearchSuggestions([]);
  };

  const handleSelectSuggestedUser = (username: string) => {
    setSearchUsername(username);
    setMode("individual");
    setError(null);
    setPage(1);
    setFocusedUsername(username.toLowerCase());
    setSearchSuggestions([]);
  };

  useEffect(() => {
    const normalizedQuery = searchUsername.trim().replace(/^@+/, "").toLowerCase();

    if (!normalizedQuery) {
      setSearchSuggestions([]);
      setSearchSuggestionsLoading(false);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setSearchSuggestionsLoading(true);

      try {
        const response = await api.get<UserSearchResponse>(`/api/users/search?username=${encodeURIComponent(normalizedQuery)}&page=1`);
        const prefixMatches = (response.data.users || [])
          .filter((candidate) => candidate.USERNAME.trim().toLowerCase().startsWith(normalizedQuery))
          .slice(0, 6);

        if (!cancelled) {
          setSearchSuggestions(prefixMatches);
        }
      } catch {
        if (!cancelled) {
          setSearchSuggestions([]);
        }
      } finally {
        if (!cancelled) {
          setSearchSuggestionsLoading(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [searchUsername]);

  return (
    
      <div className="bg-gray-100 py-8 px-4">
        <div 
          className="max-w-6xl mx-auto bg-gray-50 rounded-lg shadow-md border border-gray-200 p-4 sm:p-8 md:p-10 space-y-6"
          style={backgroundStyle}>
          
          {/* Page header */}
          <div className="flex items-center gap-3 mb-6">
            {/*<Trophy className="text-yellow-500" size={32} />*/}
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Leaderboard</h1>

            </div>
          </div>

          {/* Controls row: mode selector + weekly/lifetime tabs */}
          <div className="flex items-center justify-between mb-6 gap-10">
            {/* Left: Individual / Guild */}
            <div className="flex gap-1 p-1 bg-white border border-gray-200 rounded-lg w-fit">
              <button
                onClick={() => setMode("individual")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-md font-semibold transition-colors ${
                  mode === "individual"
                    ? "bg-gray-800 text-white shadow"
                    : "bg-white text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Users size={15} />
                Individual
              </button>
              <button
                onClick={() => setMode("guild")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-md font-semibold transition-colors ${
                  mode === "guild"
                    ? "bg-gray-800 text-white shadow"
                    : "bg-white text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Swords size={15} />
                Guilds
              </button>
            </div>
            
            {/*Find Yourself Button next to Weekly/Lifetime*/}
            <div className="flex items-center justify-between gap-10">
              <div className="relative flex items-center gap-2">
                <input
                  type="text"
                  value={searchUsername}
                  onChange={(event) => setSearchUsername(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleUserSearch();
                    }
                  }}
                  placeholder="Search @username"
                  className="w-48 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800"
                />
                <button
                  type="button"
                  onClick={handleUserSearch}
                  className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-black"
                >
                  Find User
                </button>

                {(searchSuggestionsLoading || searchSuggestions.length > 0) && (
                  <div className="absolute left-0 top-full z-20 mt-1 w-64 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                    {searchSuggestionsLoading && (
                      <p className="px-3 py-2 text-xs text-gray-500">Searching users...</p>
                    )}

                    {!searchSuggestionsLoading && searchSuggestions.map((candidate) => (
                      <button
                        key={candidate.ID}
                        type="button"
                        onClick={() => handleSelectSuggestedUser(candidate.USERNAME)}
                        className="block w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <span className="font-semibold text-gray-900">@{candidate.USERNAME}</span>
                        {candidate.FIRSTNAME ? (
                          <span className="ml-2 text-xs text-gray-500">{candidate.FIRSTNAME}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button 
                onClick={async () => {scrollToUser()}}
                
                className="px-4 py-2 rounded-lg text-md font-semibold transition-colors capitalize bg-blue-600 text-white shadow"
              >
                {mode === "individual" ? "Find Yourself" : "Find Your Guild"}
              </button>

              {/* Right: Weekly / Lifetime */}
              <div className="flex gap-1 p-1 bg-white border border-gray-200 rounded-lg w-fit">
                {(["weekly", "lifetime"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => handleTabChange(tab)}
                    className={`px-4 py-2 rounded-lg text-md font-semibold transition-colors capitalize ${
                      activeTab === tab
                        ? "bg-blue-600 text-white shadow"
                        : "bg-white text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              
            </div>
          </div>

          {/* Guild placeholder */}
          {mode === "guild" && (
            <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
              <Swords className="text-gray-300" size={56} />
              <h2 className="text-xl font-bold text-gray-500">Guild Leaderboard Coming Soon</h2>
              <p className="text-sm text-gray-400 max-w-sm">
                Guilds haven't been implemented yet. Check back later to compete as a team!
              </p>
            </div>
          )}

          {/* Your rank banner */}
          {mode === "individual" && data && (
            <div className="mb-10 flex items-center gap-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
              <Trophy className="text-blue-400 shrink-0" size={32} />
              <div>
                <p className="text-sm text-blue-500 font-medium uppercase tracking-wide">
                  Your {activeTab === "weekly" ? "Weekly" : "Lifetime"} Rank
                </p>
                <p className="text-xl font-bold text-blue-700">
                  {data.userRank !== null ? `${data.userRank}${getRankOrdinal(data.userRank)}` : "Unranked"}
                  {data.userExp !== null && (
                    <span className="ml-3 text-base font-normal text-blue-500">
                      {data.userExp.toLocaleString()} XP
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Loading state */}
          {mode === "individual" && loading && (
            <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
          )}

          {/* Error state */}
          {mode === "individual" && error && !loading && (
            <div className="text-center py-8 text-red-500 text-sm">{error}</div>
          )}

          
          {/* Table */}
          {mode === "individual" && !loading && data && (
            <>
              <div className="w-full flex justify-center items-center">
                <div className="bg-white rounded-lg w-full border border-gray-200 py-4 max-h-190 shadow-md overflow-auto overscroll-contain
                  [&::-webkit-scrollbar]:rounded-full
                  [&::-webkit-scrollbar]:w-2 
                  [&::-webkit-scrollbar-thumb]:bg-gray-400 
                  [&::-webkit-scrollbar-thumb]:rounded-lg
                  ">
                  <table className="w-full text-sm py-12">
                    <thead>
                      <tr className="border-b border-gray-200 text-left text-gray-500 text-sm uppercase tracking-wide">
                        <th className="pb-3 pr-4 pl-10 w-16 text-center">Rank</th>
                        <th className="pb-3 pl-5">User</th>
                        <th className="pb-3 text-right pr-10">
                          {activeTab === "weekly" ? "Weekly XP" : "Lifetime XP"}
                        </th>
                      </tr>
                    </thead>
                    
                    <tbody>
                      {data.leaderboard.map((entry) =>
                      {
                        const isCurrentUser =
                          currentUsername !== null &&
                          entry.username.toLowerCase() === currentUsername;
                        const isFocusedUser = focusedUsername !== null
                          && entry.username.toLowerCase() === focusedUsername;

                        const pfpUrl = entry.profilePicture
                          ? getProfilePictureUrlByItemName(entry.profilePicture)
                          : null;

                        const { symbol, color, size } = rankBadge(entry.rank);

                        const profilePath = getProfilePathForUser({
                          userId: entry.userId,
                          id: entry.id,
                          ID: entry.ID,
                          username: entry.username,
                          fallbackToOwnProfile: isCurrentUser,
                        });

                        return (
                          <tr
                            key={`${entry.username}-${entry.rank}`}
                            className={`border-b border-gray-100 transition-colors ${
                              isFocusedUser
                                ? "bg-amber-100"
                                : isCurrentUser
                                ? "bg-blue-100"
                                : "hover:bg-gray-200"
                            }`}
                            ref={isFocusedUser ? focusedUserRef : (isCurrentUser ? userRef : null)}
                          >
                            {/* Rank */}
                            <td className="py-3 pl-10 pr-4 text-center">
                              <span className={`font-bold ${color} ${size}`}>
                                {symbol}
                              </span>
                            </td>

                            {/* User */}
                            <td className="py-4 pl-5 text-base">
                              {profilePath ? (
                                <Link
                                  to={profilePath}
                                  state={{
                                    leaderboardEntry: {
                                      username: entry.username,
                                      firstName: entry.firstName,
                                      profilePicture: entry.profilePicture,
                                      exp: entry.exp,
                                      tab: activeTab,
                                    }
                                  }}
                                  className="group inline-flex max-w-full items-center gap-3 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                  aria-label={`View ${entry.username}'s profile`}
                                >
                                  {pfpUrl ? (
                                    <img
                                      src={pfpUrl}
                                      alt={entry.firstName}
                                      className="w-10 h-10 rounded-full object-cover border border-gray-200 bg-white shrink-0"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-sm font-bold shrink-0">
                                      {(entry.firstName?.[0] ?? entry.username?.[0] ?? "?").toUpperCase()}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className={`leading-tight truncate transition-colors pb-1 group-hover:text-blue-600 ${isCurrentUser ? "font-semibold text-gray-800" : "text-gray-800"}`}>
                                      {entry.firstName}
                                    </p>
                                    <p className="text-gray-500 text-sm truncate">@{entry.username}</p>
                                  </div>
                                  {isCurrentUser && (
                                      <span className="ml-1 shrink-0 text-xs bg-blue-200 border border-blue-600 text-blue-600 px-2 py-0.5 rounded-full font-semibold">
                                        You
                                      </span>
                                  )}
                                </Link>
                              ) : (
                                <div
                                  className="inline-flex max-w-full items-center gap-3"
                                  title="Profile unavailable"
                                >
                                  {pfpUrl ? (
                                    <img
                                      src={pfpUrl}
                                      alt={entry.firstName}
                                      className="w-9 h-9 rounded-full object-cover border border-gray-200 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-bold shrink-0">
                                      {(entry.firstName?.[0] ?? entry.username?.[0] ?? "?").toUpperCase()}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className={`leading-tight truncate ${isCurrentUser ? "font-semibold text-gray-800" : "text-gray-800"}`}>
                                      {entry.firstName}
                                    </p>
                                    <p className="text-gray-400 text-xs truncate">@{entry.username}</p>
                                  </div>
                                  {isCurrentUser && (
                                    <span className="ml-1 shrink-0 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-semibold">
                                      You
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* XP */}
                            <td className="py-3 pr-10 text-right font-semibold text-gray-700 text-sm">
                              {entry.exp.toLocaleString()} XP
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              {data.totalPages > 1 && (
                <div className="flex w-full h-10 relative items-center justify-center">
                  <div className="flex w-full gap-10 items-center justify-center absolute">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className={backgroundUrl ? "flex gap-1 px-3 py-2 items-center rounded-lg text-sm text-gray-600 enabled:hover:bg-white ${} disabled:opacity-40 disabled:cursor-not-allowed transition-colors" : 
                        "flex gap-1 px-3 py-2 items-center rounded-lg text-sm text-gray-600 enabled:hover:bg-gray-200 ${} disabled:opacity-40 disabled:cursor-not-allowed transition-colors"}
                    >
                      <ChevronLeft size={16} />
                      Prev
                    </button>
                    <span className="text-sm text-gray-500">
                      Page {data.page} of {data.totalPages}
                    </span>
                    <button
                      disabled={page >= data.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className={backgroundUrl ? "flex gap-1 px-3 py-2 items-center rounded-lg text-sm text-gray-600 enabled:hover:bg-white ${} disabled:opacity-40 disabled:cursor-not-allowed transition-colors" : 
                        "flex gap-1 px-3 py-2 items-center rounded-lg text-sm text-gray-600 enabled:hover:bg-gray-200 ${} disabled:opacity-40 disabled:cursor-not-allowed transition-colors"}
                    >
                      Next
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

        </div>
      </div>
  );
};

export default Leaderboard;