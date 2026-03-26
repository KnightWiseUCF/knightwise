////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025
//  Author(s):     KnightWise Team
//  File:          App.tsx
//  Description:   Main app component, defined all routes
//                 and navigation.
//
//  Dependencies:  react-router-dom
//
////////////////////////////////////////////////////////////////

import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import "./App.css";

import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import TopicPage from "./pages/TopicPage";
import MockTestPage from "./pages/MockTestPage";
import MyProgressPage from "./pages/MyProgressPage";
import TopicTestPage from "./pages/TopicTestPage"
import ForgotPassword from "./components/ForgetPassword";
import ResetPassword from "./components/ResetPassword"; 
import ProblemViewPage from "./pages/ProblemViewPage";
import AccountPage from "./pages/AccountPage";
import ProfessorApplyPage from "./pages/ProfessorApplyPage";
import ProfessorDraftsPage from "./pages/ProfessorDraftsPage";
import ProfilePage from "./pages/ProfilePage";
import StorePage from "./pages/StorePage.tsx";
import GuildsPage from "./pages/GuildsPage";
import LeaderboardPage from "./pages/LeaderboardPage.tsx";


function App() 
{
  return (
    <Router>
      <Routes>
        <Route path="/"                           element={<AuthPage />} />
        <Route path="/dashboard"                  element={<DashboardPage />} />
        <Route path="/topic-practice"             element={<TopicPage />} />
        <Route path="/topic-practice/:topicName"  element={<TopicTestPage />} />
        <Route path="/mock-test"                  element={<MockTestPage />} />
        <Route path="/my-progress"                element={<MyProgressPage />} />
        <Route path="/problem-view"               element={<ProblemViewPage />} />
        <Route path="/forgot-password"            element={<ForgotPassword />} />
        <Route path="/reset-password"             element={<ResetPassword />} />
        <Route path="/account"                    element={<AccountPage />} />
        <Route path="/profile"                    element={<ProfilePage />} />
        <Route path="/profile/:userId"            element={<ProfilePage />} />
        <Route path="/profile/u/:username"        element={<ProfilePage />} />
        <Route path="/store"                      element={<StorePage />} />
        <Route path="/guilds"                     element={<GuildsPage />} />
        <Route path="/professor-apply"            element={<ProfessorApplyPage />} />
        <Route path="/professor-drafts"           element={<ProfessorDraftsPage />} />
        <Route path="/leaderboard"                element={<LeaderboardPage />} />
      </Routes>
    </Router>
  );
}

export default App;
