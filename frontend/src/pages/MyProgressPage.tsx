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
      <div className="bg-gray-100 py-8 px-4">
        <div
          className="max-w-6xl mx-auto bg-gray-50 rounded-lg shadow-md border border-gray-200 p-4 sm:p-8 md:p-10 space-y-6"
          style={backgroundStyle}>

          {/* Page header */}
          <div className="flex items-center gap-3 mb-6">
            {/*<Trophy className="text-yellow-500" size={32} />*/}
            <div>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">My Progress</h1>

            </div>
          </div>

          {/* Graph Section */}
          <div className="w-full bg-white border-gray-300 px-4 py-8 rounded-lg shadow mb-10">
            <Graph />
          </div>

          {/* Progress Message */}
          <ProgressMessage history={history} mastery={mastery} streakCount={streakCount} />

          {/* Stats Viewer */}
          <StatsViewer />

          {/* History Table Section */}
          <HistoryTable />
        </div>
      </div>
    </Layout>
  );
};

export default MyProgressPage;
