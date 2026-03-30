import React, { useEffect, useState, useMemo } from "react";
import Layout from "../components/Layout";
import Graph from "../components/Graph";
import HistoryTable from "../components/HistoryTable";
import ProgressMessage from "../components/ProgressMessage";
import api from "../api";
import { getBackgroundUrlByItemName } from "../utils/storeCosmetics";
import { useUserCustomizationStore, userCustomizationStore } from "../stores/userCustomizationStore";
import StatsViewer from "../components/StatsViewer";

const MyProgressPage: React.FC = () => {
  const [history, setHistory] = useState<{ datetime: string; topic: string }[]>([]);
  const [mastery, setMastery] = useState<{ [topic: string]: number }>({});
  const [streakCount, setStreakCount] = useState<number>(0);
  const { equippedItems } = useUserCustomizationStore();
  
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


  useEffect(() => {
    const fetchProgressData = async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await api.get("api/progress/messageData", 
        {
          headers: 
          { 
            Authorization: `Bearer ${token}` 
          },
        });

        const { history, mastery, streak } = response.data;
        setHistory(history);
        setMastery(mastery);
        setStreakCount(streak);
      } catch (error) {
        console.error("Error fetching progress data:", error);
      }
    };

    fetchProgressData();
  }, []);

  return (
    <Layout>
      <div className="min-h-screen flex flex-col items-center space-y-8 pt-8">
        <h1 className="text-5xl font-bold mb-4">My Progress</h1>

        {/* Graph Section */}
        <div className="w-3/4 border-3 border-gray-300 p-4 rounded-lg shadow mb-6">
          <Graph />
        </div>

        {/* Progress Message */}
        <ProgressMessage history={history} mastery={mastery} streakCount={streakCount} />

        {/* History Table Section */}
        <div className="w-3/4 border-3 border-gray-300 p-4 rounded-lg shadow">
          <HistoryTable />
        </div>
      </div>
    </Layout>
  );
};

export default MyProgressPage;
