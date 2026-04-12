////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          Dashboard.tsx
//  Description:   Student dashboard with actionable cards,
//                 progress insights, and quick links.
//
//  Dependencies:  react
//                 react-router-dom
//                 api instance
//                 models
//                 topicLabels
//
////////////////////////////////////////////////////////////////

import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import api from "../api";
import { HistoryEntry, UserInfoResponse } from "../models";
import { useUserCustomizationStore, userCustomizationStore } from "../stores/userCustomizationStore";
import { getBackgroundUrlByItemName } from "../utils/storeCosmetics";
import { ALL_TOPICS, formatSubcategoryLabel } from "../utils/topicLabels";
import { formatTenths } from "../utils/numberFormat";

interface MessageDataResponse {
  history?: Array<{ datetime: string; topic: string }>;
  mastery?: Record<string, number>;
  streak?: number;
}

interface LeaderboardResponse {
  userRank: number | null;
  userExp: number | null;
}

interface DashboardHistoryResponse {
  history: HistoryEntry[];
  totalPages: number;
  currentPage: number;
}

const DAILY_GOAL_QUESTIONS = 10;
const DAILY_GOAL_FIRE_MULTIPLIER = 2;
const DAILY_GOAL_GOOUTSIDE_MULTIPLIER = 3;

const toCanonicalTopicSlug = (topic?: string): string | null => {
  const value = String(topic || "").trim();
  if (!value) {
    return null;
  }
  const normalized = value === "Input/Output" ? "InputOutput" : value;
  return (ALL_TOPICS as readonly string[]).includes(normalized) ? normalized : null;
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

const toFiniteNumber = (value: unknown): number => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { equippedItems } = useUserCustomizationStore();
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [mastery, setMastery] = useState<Record<string, number>>({});
  const [streakCount, setStreakCount] = useState<number>(0);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [weeklyExp, setWeeklyExp] = useState<number | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [lifetimeExp, setLifetimeExp] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
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

  const dashboardBackgroundStyle = backgroundUrl ? {
    backgroundImage: `linear-gradient(rgba(245,245,245,0.86), rgba(245,245,245,0.86)), url(${backgroundUrl})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  } : undefined;

  const fetchDashboardData = useCallback(async () => {
    setIsLoading(true);

    const userId = getStoredUserId();

    const historyPromise = (async () => {
      const firstPageResponse = await api.get<DashboardHistoryResponse>("/api/progress/history", {
        params: { page: 1 },
      });

      const firstPageHistory = Array.isArray(firstPageResponse.data.history)
        ? firstPageResponse.data.history
        : [];

      const totalPages = Number(firstPageResponse.data.totalPages || 1);
      if (totalPages <= 1) {
        return firstPageHistory;
      }

      const remainingPageRequests: Array<Promise<DashboardHistoryResponse>> = [];
      for (let page = 2; page <= totalPages; page += 1) {
        remainingPageRequests.push(
          api.get<DashboardHistoryResponse>("/api/progress/history", { params: { page } }).then((response) => response.data)
        );
      }

      const remainingPages = await Promise.all(remainingPageRequests);
      const remainingHistory = remainingPages.flatMap((pageData) =>
        Array.isArray(pageData.history) ? pageData.history : []
      );

      return [...firstPageHistory, ...remainingHistory];
    })();

    const messagePromise = api.get<MessageDataResponse>("/api/progress/messageData");
    const leaderboardPromise = api.get<LeaderboardResponse>("/api/leaderboard/weekly?page=1");
    const userPromise = userId ? api.get<UserInfoResponse>(`/api/users/${userId}`) : Promise.resolve(null);

    const [messageResult, historyResult, leaderboardResult, userResult] = await Promise.allSettled([
      messagePromise,
      historyPromise,
      leaderboardPromise,
      userPromise,
    ]);

    if (messageResult.status === "fulfilled") {
      setMastery(messageResult.value.data.mastery || {});
      setStreakCount(Number(messageResult.value.data.streak || 0));
    }

    if (historyResult.status === "fulfilled") {
      setHistory(Array.isArray(historyResult.value) ? historyResult.value : []);
    } else {
      setHistory([]);
    }

    if (leaderboardResult.status === "fulfilled") {
      setUserRank(leaderboardResult.value.data.userRank ?? null);
      setWeeklyExp(leaderboardResult.value.data.userExp ?? null);
    }

    if (userResult.status === "fulfilled" && userResult.value) {
      setCoins(userResult.value.data.user.COINS ?? null);
      setLifetimeExp(userResult.value.data.user.LIFETIME_EXP ?? null);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void fetchDashboardData();

    const refreshIntervalId = window.setInterval(() => {
      void fetchDashboardData();
    }, 30000);

    const handleFocus = () => {
      void fetchDashboardData();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchDashboardData();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(refreshIntervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchDashboardData]);

  const today = new Date();
  const todayKey = today.toDateString();

  const recentHistory = useMemo(() => {
    return [...history].sort(
      (first, second) => new Date(second.datetime).getTime() - new Date(first.datetime).getTime()
    );
  }, [history]);

  const todayEntries = useMemo(() => {
    return recentHistory.filter((entry) => new Date(entry.datetime).toDateString() === todayKey);
  }, [recentHistory, todayKey]);

  const correctTodayEntries = useMemo(() => {
    return todayEntries.filter((entry) => Boolean(entry.isCorrect));
  }, [todayEntries]);

  const questionsToday = correctTodayEntries.length;
  const fireGoalThreshold = DAILY_GOAL_QUESTIONS * DAILY_GOAL_FIRE_MULTIPLIER;
  const goOutsideThreshold = DAILY_GOAL_QUESTIONS * DAILY_GOAL_GOOUTSIDE_MULTIPLIER;
  const goalProgress = Math.min(100, Math.round((questionsToday / DAILY_GOAL_QUESTIONS) * 100));
  const pointsToday = todayEntries.reduce((sum, entry) => sum + toFiniteNumber(entry.pointsEarned), 0);
  const goalCompleted = questionsToday >= DAILY_GOAL_QUESTIONS;
  const goOutside = questionsToday > goOutsideThreshold;
  const onFire = questionsToday > fireGoalThreshold;
  const pointsTodayText = pointsToday.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const weeklyEntries = useMemo(() => {
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    return recentHistory.filter((entry) => new Date(entry.datetime).getTime() >= sevenDaysAgo);
  }, [recentHistory]);

  const weeklyAccuracy = weeklyEntries.length > 0
    ? Math.round((weeklyEntries.filter((entry) => Boolean(entry.isCorrect)).length / weeklyEntries.length) * 100)
    : 0;

  const weeklyAverageScore = weeklyEntries.length > 0
    ? Math.round(
      (weeklyEntries.reduce((sum, entry) => {
        const earned = toFiniteNumber(entry.pointsEarned);
        const possible = toFiniteNumber(entry.pointsPossible) > 0
          ? toFiniteNumber(entry.pointsPossible)
          : 0;
        return sum + (possible > 0 ? earned / possible : 0);
      }, 0) / weeklyEntries.length) * 100
    )
    : 0;

  const weeklyAvgTime = useMemo(() => {
    // We don't want to consider all the legacy untimed responses
    const timedResponses = weeklyEntries.filter(e => toFiniteNumber(e.elapsedTime) > 0);
    if (timedResponses.length === 0) return 0; // Let's not divide by 0
    return Math.round(timedResponses.reduce((sum, e) => sum + toFiniteNumber(e.elapsedTime), 0) / timedResponses.length);
  }, [weeklyEntries]);

  const weeklyActivity = useMemo(() => {
    const days: Array<{ key: string; label: string; attempts: number; correct: number }> = [];

    for (let index = 6; index >= 0; index -= 1) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - index);

      const key = day.toDateString();
      const label = day.toLocaleDateString(undefined, { weekday: "short" });

      const attemptsForDay = weeklyEntries.filter((entry) => {
        const entryDate = new Date(entry.datetime);
        return entryDate.toDateString() === key;
      });

      days.push({
        key,
        label,
        attempts: attemptsForDay.length,
        correct: attemptsForDay.filter((entry) => Boolean(entry.isCorrect)).length,
      });
    }

    return days;
  }, [weeklyEntries]);

  const maxDailyAttempts = Math.max(1, ...weeklyActivity.map((day) => day.attempts));

  const weakestTopics = useMemo(() => {
    const canonicalScores = new Map<string, number>();

    Object.entries(mastery).forEach(([topic, value]) => {
      if (!Number.isFinite(value)) {
        return;
      }

      const canonicalTopic = toCanonicalTopicSlug(topic);
      if (!canonicalTopic) {
        return;
      }

      const existing = canonicalScores.get(canonicalTopic);
      if (typeof existing !== "number" || value < existing) {
        canonicalScores.set(canonicalTopic, value);
      }
    });

    return [...canonicalScores.entries()]
      .sort((first, second) => first[1] - second[1])
      .slice(0, 3);
  }, [mastery]);

  const lastAttempt = recentHistory[0] || null;
  const lastTopicSlug = toCanonicalTopicSlug(lastAttempt?.topic);
  const lastTopicLabel = formatSubcategoryLabel(lastTopicSlug || lastAttempt?.topic);
  const weakTopicLabel = weakestTopics.length > 0 ? formatSubcategoryLabel(weakestTopics[0][0]) : null;
  const lifetimeExpText = formatTenths(lifetimeExp ?? 0);
  const coinsText = formatTenths(coins ?? 0);
  const weeklyExpText = formatTenths(weeklyExp ?? 0);

  const handlePracticeTopic = (topic: string) => {
    const slug = toCanonicalTopicSlug(topic);
    if (!slug) {
      navigate("/topic-practice");
      return;
    }
    navigate(`/topic-practice/${encodeURIComponent(slug)}`);
  };

  return (
    <div className="p-4 sm:p-8 md:p-10 min-h-full bg-gray-100">
      <div
        className="max-w-6xl mx-auto rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
        style={dashboardBackgroundStyle}
      >
        <div className="p-4 sm:p-8 md:p-10 space-y-6">
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">Your Dashboard</h1>
          </div>
        </div>

        {isLoading && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-gray-600">
            Loading dashboard data...
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Continue Learning</p>
            <h2 className="text-2xl font-bold text-gray-900 mt-1">
              {lastAttempt ? `Last topic: ${lastTopicLabel}` : "Start your first practice set"}
            </h2>
            <p className="text-gray-600 mt-2">
              {lastAttempt
                ? `Last attempt: ${new Date(lastAttempt.datetime).toLocaleString()}`
                : "No attempts yet. Begin with a topic to build momentum."}
            </p>
            {weakTopicLabel && (
              <p className="mt-2 text-sm text-amber-900 font-medium">
                Your weakest topic: {weakTopicLabel}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-3">
              {lastAttempt && (
                <button
                  type="button"
                  onClick={() => handlePracticeTopic(lastTopicSlug || "")}
                  disabled={!lastTopicSlug}
                  className="px-4 py-2 rounded-lg bg-gray-900 text-white hover:bg-black"
                >
                  Resume Topic
                </button>
              )}
              {weakTopicLabel && (
                <button
                  type="button"
                  onClick={() => handlePracticeTopic(weakTopicLabel)}
                  className="px-4 py-2 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200"
                >
                  Practice Weakest Topic
                </button>
              )}
            </div>
          </section>

          <section className={`rounded-xl border p-5 transition-colors ${
            goOutside
              ? "border-violet-300 bg-violet-50"
              : onFire
              ? "border-amber-300 bg-amber-50"
              : goalCompleted
              ? "border-green-300 bg-green-50"
              : "border-gray-200 bg-white"
          }`}>
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Daily Goal</p>
            <div className="mt-1 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-bold text-gray-900">
                {questionsToday} / {DAILY_GOAL_QUESTIONS} correct questions
              </h2>
              {goalCompleted && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                  goOutside
                    ? "border border-violet-300 bg-violet-100 text-violet-900"
                    : onFire
                    ? "border border-amber-300 bg-amber-100 text-amber-900"
                    : "border border-green-300 bg-green-100 text-green-800"
                }`}>
                  {goOutside ? <span aria-hidden="true">🛸</span> : onFire ? <span aria-hidden="true">🔥</span> : <CheckCircle2 size={14} />}
                  {goOutside ? "Go Outside" : onFire ? "You're on fire!" : "Goal Complete"}
                </span>
              )}
            </div>
            <p className="text-gray-600 mt-2">Points earned today: {pointsTodayText}</p>
            <div className="mt-4 h-3 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  goOutside ? "bg-violet-500" : onFire ? "bg-amber-500" : goalCompleted ? "bg-green-500" : "bg-yellow-400"
                }`}
                style={{ width: `${goalProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {goOutside
                ? "Learning is awesome. Life is awesome too! Remember to take a break and get some well-deserved rest every now and then."
                : onFire
                ? "You're on fire! You crushed more than 2x your daily goal."
                : goalCompleted
                ? "Daily goal complete. Nice work!"
                : `${DAILY_GOAL_QUESTIONS - questionsToday} more correct question${DAILY_GOAL_QUESTIONS - questionsToday === 1 ? "" : "s"} to finish today's goal.`}
            </p>
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Weekly Performance</p>
            <div className="mt-3 grid grid-cols-4 gap-3">
              <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                <p className="text-xs text-gray-500">Attempts</p>
                <p className="text-xl font-bold text-gray-900">{weeklyEntries.length}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                <p className="text-xs text-gray-500">Accuracy</p>
                <p className="text-xl font-bold text-gray-900">{weeklyAccuracy}%</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                <p className="text-xs text-gray-500">Avg Score</p>
                <p className="text-xl font-bold text-gray-900">{weeklyAverageScore}%</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                <p className="text-xs text-gray-500">Avg Time</p>
                <p className="text-xl font-bold text-gray-900">
                  {weeklyAvgTime > 0 ? `${weeklyAvgTime}s` : "—"}
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <p className="text-xs text-gray-500 mb-2">7-day activity</p>
              <div className="flex items-end gap-2 h-20">
                {weeklyActivity.map((day) => {
                  const barHeight = Math.max(8, Math.round((day.attempts / maxDailyAttempts) * 100));
                  const accuracy = day.attempts > 0 ? Math.round((day.correct / day.attempts) * 100) : 0;

                  return (
                    <div key={day.key} className="flex-1 min-w-0 flex flex-col items-center gap-1">
                      <div className="w-full h-14 flex items-end">
                        <div
                          className={`w-full rounded-t ${day.attempts > 0 ? "bg-blue-500" : "bg-gray-300"}`}
                          style={{ height: `${barHeight}%` }}
                          title={`${day.label}: ${day.attempts} attempts, ${accuracy}% accuracy`}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 leading-none">{day.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Weakest Topics</p>
            {weakestTopics.length === 0 ? (
              <p className="text-gray-600 mt-3">No mastery data yet. Complete a few topic questions first.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {weakestTopics.map(([topic, score]) => (
                  <div key={topic} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 bg-gray-50">
                    <div>
                      <p className="font-semibold text-gray-900">{formatSubcategoryLabel(topic)}</p>
                      <p className="text-xs text-gray-500">Mastery: {Math.round(score * 100)}%</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handlePracticeTopic(topic)}
                      className="px-3 py-1.5 rounded-md bg-yellow-300 hover:bg-yellow-400 text-black text-sm font-semibold"
                    >
                      Practice
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Streak and XP</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                <p className="text-xs text-gray-500">Current Streak</p>
                <p className="text-2xl font-bold text-gray-900">{streakCount} day{streakCount === 1 ? "" : "s"}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                <p className="text-xs text-gray-500">Lifetime XP</p>
                <p className="text-2xl font-bold text-gray-900">{lifetimeExpText}</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Rank and Rewards</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                <p className="text-xs text-gray-500">Weekly Rank</p>
                <p className="text-2xl font-bold text-gray-900">{userRank !== null ? `#${userRank}` : "Unranked"}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 border border-gray-200">
                <p className="text-xs text-gray-500">Coins</p>
                <p className="text-2xl font-bold text-gray-900">{coinsText}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600 mt-3">Weekly XP: {weeklyExpText}</p>
          </section>
        </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
