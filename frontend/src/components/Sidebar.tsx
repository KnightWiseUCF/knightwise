// This code is based on Dr. Leinecker's code: LoggedInName.tsx

import { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LogOut,
  BookOpen,
  BarChart2,
  Lightbulb,
  GraduationCap,
  UserCircle,
  UserRoundCog,
  FileCode,
  Shield,
  Trophy,
} from "lucide-react"; // for icons
import { useUserCustomizationStore, userCustomizationStore } from "../stores/userCustomizationStore";
import { getFlairPresentation } from "../utils/flairPresentation";

const Sidebar = () => {
  const location = useLocation();
  const accountType = localStorage.getItem("account_type");
  const isProfessor = accountType === "professor";
  const { user, equippedItems } = useUserCustomizationStore();

  useEffect(() => {
    void userCustomizationStore.refresh();
  }, []);

  const userData = (() => {
    try {
      const rawUserData = localStorage.getItem("user_data");
      return rawUserData ? JSON.parse(rawUserData) as {
        firstName?: string;
        lastName?: string;
        name?: string;
      } : null;
    } catch (error) {
      console.error("Error parsing user data:", error);
      return null;
    }
  })();

  const displayName = useMemo(() => {
    const firstName = (user?.FIRSTNAME || userData?.firstName || "").trim();
    const lastName = (user?.LASTNAME || userData?.lastName || "").trim();
    return `${firstName} ${lastName}`.trim() || user?.USERNAME || userData?.name || "Hello";
  }, [user, userData?.firstName, userData?.lastName, userData?.name]);

  const flairItems = useMemo(
    () => equippedItems.filter((item) => item.TYPE === "flair"),
    [equippedItems]
  );

  // function: logout
  const doLogout = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();
    localStorage.removeItem("user_data");
    window.location.href = "/";
  };

  const menuItems = [
    { 
      name: "Dashboard", 
      icon: <BookOpen size={24} />, 
      path: "/dashboard" },
    ...(isProfessor
      ? [
          {
            name: "Question Drafts",
            icon: <FileCode size={24} />,
            path: "/professor-drafts",
          },
        ]
      : []),
    {
      name: "Topic Practice",
      icon: <Lightbulb size={24} />,
      path: "/topic-practice",
    },
    {
      name: "Build an Exam",
      icon: <GraduationCap size={24} />,
      path: "/mock-test",
    },
    ...(isProfessor
      ? [
          {
            name: "Statistics",
            icon: <BarChart2 size={24} />,
            path: "/professor-stats",
          },
        ]
      : [
          {
            name: "My Progress",
            icon: <BarChart2 size={24} />,
            path: "/my-progress",
          },
        ]),
    {
      name: "Guilds",
      icon: <Shield size={24} />,
      path: "/guilds"
    },
    {
      name: "Leaderboard",
      icon: <Trophy size={24} />,
      path: "/leaderboard"
    },
    {
      name: "Profile",
      icon: <UserCircle size={24} />,
      path: "/profile"
    },
    {
      name: "Account",
      icon: <UserRoundCog size={24} />,
      path: "/account"
    },
  ];

  return (
    <div className="flex h-full w-[85vw] max-w-72 flex-col bg-gray-100 p-3 shadow-lg sm:p-6 md:w-72">
      {/* user name */}
      <div className="pt-6 sm:pt-10 mb-6 sm:mb-10 text-center">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold">
          {displayName}
        </h1>
        {flairItems.length > 0 && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {flairItems.map((item) => {
              const flairStyle = getFlairPresentation(item.NAME);

              return (
                <span
                  key={item.ID}
                  className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${flairStyle.className}`}
                >
                  <span className="mr-1" aria-hidden="true">{flairStyle.emoji}</span>
                  <span>{item.NAME}</span>
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* menu*/}
      <nav className="flex-1 overflow-y-auto">
        {menuItems.map((item) => {
          const isDisabled = item.path === "";
          const isActive = !isDisabled && (
            (item.path === "/topic-practice" && location.pathname.includes("/topic")) ||
            location.pathname.startsWith(item.path)
          );

          const itemClassName = `flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg mb-2 sm:mb-3 text-sm sm:text-base md:text-lg transition-colors ${
            isActive
              ? "bg-yellow-500 text-white font-semibold"
              : isDisabled
                ? "text-gray-500 cursor-default"
                : "hover:bg-gray-200 cursor-pointer"
          }`;

          if (isDisabled) {
            return (
              <div key={item.name} className={itemClassName}>
                {item.icon}
                {item.name}
              </div>
            );
          }

          return (
            <Link
              key={item.name}
              to={item.path}
              className={itemClassName}
            >
              {item.icon}
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* logout*/}
      <button
        className="mt-auto flex items-center gap-3 rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-700 shadow-md transition-all hover:bg-gray-200 sm:gap-4 sm:p-4 sm:text-base md:text-lg"
        onClick={doLogout}
      >
        <LogOut size={24} className="text-gray-700" />
        <span className="font-semibold">Log out</span>
      </button>
    </div>
  );
};

export default Sidebar;
