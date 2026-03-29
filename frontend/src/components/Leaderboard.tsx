/*
import { lstat } from 'fs'
import React, { FC, useState, useEffect, useMemo } from 'react'
import { useNavigate } from "react-router-dom";
import api from "../api";
import { LeaderboardT, LeaderboardResponse  } from '../models';
import { getProfilePictureUrlByItemName } from '../utils/storeCosmetics';
*/

import React, { useCallback, useEffect, useState, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { getProfilePictureUrlByItemName } from "../utils/storeCosmetics";
import { getBackgroundUrlByItemName } from "../utils/storeCosmetics";
import { useUserCustomizationStore, userCustomizationStore } from "../stores/userCustomizationStore";
import { Trophy, ChevronLeft, ChevronRight, Swords, Users, UserCheck } from "lucide-react";

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

interface GuildLeaderboardEntry
{
  id?:            number | string | null;
  rank:           number;
  name:           string;
  exp:            number;
  guildPicture:   string | null;
}

interface GuildLeaderboardResponse
{
  guildRank:    number | null;
  guildExp:     number | null;
  guildID:      number | null;
  page:         number;
  totalPages:   number;
  leaderboard:  GuildLeaderboardEntry[];
}



type Tab  = "weekly" | "lifetime";
type Mode = "individual" | "guild" | "followed";

const Leaderboard: React.FC = () =>
{
  const [mode, setMode]             = useState<Mode>("individual");
  const [activeTab, setActiveTab]   = useState<Tab>("weekly");
  const [data, setData]             = useState<LeaderboardResponse | null>(null);
  const [guildData, setguildData]   = useState<GuildLeaderboardResponse | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [page, setPage]             = useState(1);
  const { equippedItems } = useUserCustomizationStore();
  const { user } = useUserCustomizationStore();

  const generateGuildLeaderboard = (n: number) => {
    let i = 0;
    let output: GuildLeaderboardEntry[] = [];
    for (i = 0; i < n; i++)
    {
      if(i === 7) output[i] = {id: i, rank: n-i, name: 'MyGuild' + i, exp: (n%(i+1))*(2/(i+1)), guildPicture: null};
      else output[i] = {id: i, rank: n-i, name: 'Guild' + i, exp: (n%(i+1))*(2/(i+1)), guildPicture: null};
      
    }
    output.sort((a: GuildLeaderboardEntry, b: GuildLeaderboardEntry) => {return a.rank - b.rank})
    return output;
  }

  const generateGuildLeaderboardResponse = (n: number) => {
    let output: GuildLeaderboardResponse = {guildRank: n-7, guildExp: (n%(7+1))*(2/(7+1)), guildID: 7, page: 1, totalPages: n%25, leaderboard: generateGuildLeaderboard(n)}
    return output
  }

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

  const fetchFollowedLeaderboard = useCallback(async (tab: Tab, pageNum: number) =>
  {
    setLoading(true);
    setError(null);
    try
    {
      
      const response = await api.get<LeaderboardResponse>(
        `/api/leaderboard/followed/${tab}?page=${pageNum}`
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

  const fetchGuildLeaderboard = useCallback(async (tab: Tab, pageNum: number) =>
  {
    setLoading(true);
    setError(null);
    try
    {

      const response = await api.get<GuildLeaderboardResponse>(
        `/api/leaderboard/guild/${tab}?page=${pageNum}`
      );
      setguildData(response.data);

      //setguildData(generateGuildLeaderboardResponse(52));
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
    else if (mode === "followed") void fetchFollowedLeaderboard(activeTab, page);
    else if (mode === "guild") void fetchGuildLeaderboard(activeTab, page);
  }, [mode, activeTab, page, fetchLeaderboard, fetchFollowedLeaderboard, fetchGuildLeaderboard]);

  const handleTabChange = (tab: Tab) =>
  {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setPage(1);
    setData(null);
  };

  const handleModeChange = (newMode: Mode) =>
  {
    if (mode === newMode) return;
    setMode(newMode);
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
  const guildRef = useRef<HTMLTableRowElement | null>(null);

  const scrollToUser = async () => 
  {
    if(loading == false && mode !== "guild"){
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
    else if(loading == false && mode === "guild"){
      guildRef.current?.scrollIntoView({ behavior: 'smooth', block: "center"})

      if (guildRef.current == null) 
      {
        let userFound = false; 

        if(guildData?.totalPages != undefined)
        {
          //go thru all leaderboard pages and find user
          for(let i = 1; i <= guildData?.totalPages && !userFound; i++) 
          {
            setError(null);
            try
            {
              
              const response = await api.get<GuildLeaderboardResponse>(
                `/api/leaderboard/guilds/${activeTab}?page=${i}`
              );

              for(let k = 0; k < response.data.leaderboard.length && !userFound; k++) 
              {
                if (response.data?.leaderboard[k].id === response.data?.guildID) 
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

  return (
    
      <div className="bg-gray-100 py-8 px-4">
        <div 
          className="max-w-6xl mx-auto bg-gray-50 rounded-lg shadow-md border border-gray-200 p-4 sm:p-8 md:p-10 space-y-6"
          style={backgroundStyle}>
          
          {/* Page header */}
          <div className="flex items-center gap-3 mb-6">
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Leaderboard</h1>
            </div>
          </div>

          {/* Controls row: mode selector + weekly/lifetime tabs */}
          <div className="flex items-center justify-between mb-6 gap-10">
            {/* Left: Individual / Guild */}
            <div className="flex gap-1 p-1 bg-white border border-gray-200 rounded-lg w-fit">
              <button
                onClick={() => handleModeChange("individual")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-md font-semibold transition-colors ${
                  mode === "individual"
                    ? "bg-gray-800 text-white shadow"
                    : "bg-white text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Users size={16} />
                Individual
              </button>
              <button
                onClick={() => handleModeChange("followed")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-md font-semibold transition-colors ${
                  mode === "followed"
                    ? "bg-gray-800 text-white shadow"
                    : "bg-white text-gray-600 hover:bg-gray-200"
                }`}
              >
                <UserCheck size={16} />
                Followed
              </button>
              <button
                onClick={() => handleModeChange("guild")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-md font-semibold transition-colors ${
                  mode === "guild"
                    ? "bg-gray-800 text-white shadow"
                    : "bg-white text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Swords size={16} />
                Guild
              </button>
            </div>
            
            {/*Find Yourself Button next to Weekly/Lifetime*/}
            
              <div className="flex items-center justify-between gap-10">
                {mode === "individual" || mode === "guild" ? (
                  <button 
                    onClick={async () => {scrollToUser()}}
                    className="px-4 py-2 rounded-lg text-md font-semibold transition-colors capitalize bg-blue-600 text-white shadow hover:bg-blue-800"
                  >
                    {mode === "guild" ? "Find Your Guild" : "Find Yourself"}
                  </button>
                ) : null }

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


          {/* Your rank banner; Unsure if User will be added to followed */}
          {((mode === "individual" /*|| mode === "followed"*/) && data) ? (
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
          ) : mode === "guild" && guildData && guildData.guildID !== null && (
            <div className="mb-10 flex items-center gap-4 p-4 rounded-lg bg-blue-50 border border-blue-200">
              <Trophy className="text-blue-400 shrink-0" size={32} />
              <div>
                <p className="text-sm text-blue-500 font-medium uppercase tracking-wide">
                  Your Guild's {activeTab === "weekly" ? "Weekly" : "Lifetime"} Rank
                </p>
                <p className="text-xl font-bold text-blue-700">
                  {guildData.guildRank !== null ? `${guildData.guildRank}${getRankOrdinal(guildData.guildRank)}` : "Unranked"}
                  {guildData.guildExp !== null && (
                    <span className="ml-3 text-base font-normal text-blue-500">
                      {guildData.guildExp.toLocaleString()} XP
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="text-center py-16 text-gray-400 text-sm">Loading...</div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="text-center py-8 text-red-500 text-sm">{error}</div>
          )}

          
          {/* Table for Individual/Follower Leaderboards */}
          

          {(mode === "individual" || mode === "followed") && !loading && data && data.leaderboard.length > 0 ? (
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

                        const pfpUrl = entry.profilePicture
                          ? getProfilePictureUrlByItemName(entry.profilePicture)
                          : null;

                        const { symbol, color, size } = rankBadge(entry.rank);

                        const resolvedUserId = Number(entry.userId ?? entry.id ?? entry.ID);
                        const hasValidUserId = Number.isInteger(resolvedUserId) && resolvedUserId > 0;
                        const hasUsername = typeof entry.username === "string" && entry.username.trim().length > 0;
                        const encodedUsername = hasUsername ? encodeURIComponent(entry.username.trim()) : "";
                        const profilePath = hasValidUserId
                          ? `/profile/${resolvedUserId}`
                          : (hasUsername ? `/profile/u/${encodedUsername}` : (isCurrentUser ? "/profile" : null));

                        return (
                          <tr
                            key={`${entry.username}-${entry.rank}`}
                            className={`border-b border-gray-100 transition-colors ${
                              isCurrentUser
                                ? "bg-blue-100"
                                : "hover:bg-gray-200"
                            }`}
                            ref={isCurrentUser ? userRef : null}
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
                        )
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
          ):<div className="text-center pt-16 text-gray-900 font-bold text-xl">
                {data ? "Nobody's Here!" : null}
            </div> 
          }

          {/* Guild Leaderboard Table */}
          {mode === "guild" && !loading && guildData && (
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
                        <th className="pb-3 pl-5">Guild</th>
                        <th className="pb-3 text-right pr-10">
                          {activeTab === "weekly" ? "Weekly XP" : "Lifetime XP"}
                        </th>
                      </tr>
                    </thead>
                    
                    <tbody>
                      {guildData.leaderboard.map((entry) =>
                      {
                        const isCurrentUserGuild =
                          guildData.guildID !== null &&
                          guildData.guildID === entry.id;

                        // TODO NOT SURE IF THIS WILL WORK
                        const guildPicUrl = entry.guildPicture
                          ? getProfilePictureUrlByItemName(entry.guildPicture)
                          : null;

                        const { symbol, color, size } = rankBadge(entry.rank);
                        
                        
                        const resolvedGuildId = Number(entry.id);
                        const hasValidGuildId = Number.isInteger(resolvedGuildId) && resolvedGuildId > 0;
                        const hasGuildName = typeof entry.name === "string" && entry.name.trim().length > 0;
                        const encodedGuildName = hasGuildName ? encodeURIComponent(entry.name.trim()) : "";
                        
                        // TODO NOT SURE IF THISLL WORK
                        const guildPath = hasValidGuildId
                          ? `/guild/${resolvedGuildId}`
                          : (hasGuildName ? `/guild/u/${encodedGuildName}` : (isCurrentUserGuild ? "/guild" : null));
                          
                          
                        return (
                          <tr
                            key={`${entry.name}-${entry.rank}`}
                            className={`border-b border-gray-100 transition-colors ${
                              isCurrentUserGuild
                                ? "bg-blue-100"
                                : "hover:bg-gray-200"
                            }`}
                            ref={isCurrentUserGuild ? guildRef : null}
                          >
                            {/* Rank */}
                            <td className="py-3 pl-10 pr-4 text-center">
                              <span className={`font-bold ${color} ${size}`}>
                                {symbol}
                              </span>
                            </td>

                            {/* User */}
                            <td className="py-4 pl-5 text-base">
                            
                              { guildPath ? (
                                <Link
                                  to={guildPath}
                                  state={{
                                    guildLeaderboardEntry: {
                                      name: entry.name,
                                      guildPicture: entry.guildPicture,
                                      exp: entry.exp,
                                      tab: activeTab,
                                    }
                                  } }
                                  className="group inline-flex max-w-full items-center gap-3 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                  aria-label={`View the Guild ${entry.name}`}
                                >
                                  {guildPicUrl ? (
                                    <img
                                      src={guildPicUrl}
                                      alt={entry.name}
                                      className="w-10 h-10 rounded-full object-cover border border-gray-200 bg-white shrink-0"
                                    />
                                  ) : (
                                    <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-sm font-bold shrink-0">
                                      {(entry.name?.[0] ?? "?").toUpperCase()}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className={`leading-tight truncate transition-colors pb-1 group-hover:text-blue-600 ${isCurrentUserGuild ? "font-semibold text-gray-800" : "text-gray-800"}`}>
                                      {entry.name}
                                    </p>
                                  </div>
                                  {isCurrentUserGuild && (
                                      <span className="ml-1 shrink-0 text-xs bg-blue-200 border border-blue-600 text-blue-600 px-2 py-0.5 rounded-full font-semibold">
                                        Your Guild
                                      </span>
                                  )}
                                </Link>
                              ) : (
                                <div
                                  className="inline-flex max-w-full items-center gap-3"
                                  title="Profile unavailable"
                                >
                                  {guildPicUrl ? (
                                    <img
                                      src={guildPicUrl}
                                      alt={entry.name}
                                      className="w-9 h-9 rounded-full object-cover border border-gray-200 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-sm font-bold shrink-0">
                                      {(entry.name?.[0] ?? "?").toUpperCase()}
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p className={`leading-tight truncate ${isCurrentUserGuild ? "font-semibold text-gray-800" : "text-gray-800"}`}>
                                      {entry.name}
                                    </p>
                                    <p className="text-gray-400 text-xs truncate">@{entry.name}</p>
                                  </div>
                                  {isCurrentUserGuild && (
                                    <span className="ml-1 shrink-0 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-semibold">
                                      Your Guild
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
              {guildData.totalPages > 1 && (
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
                      Page {guildData.page} of {guildData.totalPages}
                    </span>
                    <button
                      disabled={page >= guildData.totalPages}
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