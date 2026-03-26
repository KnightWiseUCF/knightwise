// this page displays the available topics
import React from "react";
import Layout from "../components/Layout";
import Leaderboard from "../components/Leaderboard";

const LeaderboardPage: React.FC = () => (
  <div className="overscroll-contain">
    <Layout>
      <Leaderboard/>
    </Layout>
  </div>
);

export default LeaderboardPage;