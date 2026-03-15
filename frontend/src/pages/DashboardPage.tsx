import React from "react";
import Layout from "../components/Layout";
import Dashboard from "../components/Dashboard";
import ProfessorDashboard from "../components/ProfessorDashboard";

const DashBoardPage: React.FC = () => {
  const isProfessor = localStorage.getItem("account_type") === "professor";

  return (
    <Layout>
      {isProfessor ? <ProfessorDashboard /> : <Dashboard />}
    </Layout>
  );
};

export default DashBoardPage;

