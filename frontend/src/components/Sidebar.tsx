// This code is based on Dr. Leinecker's code: LoggedInName.tsx

import { Link, useLocation } from "react-router-dom";
import {
  LogOut,
  BookOpen,
  BarChart2,
  Lightbulb,
  GraduationCap,
  UserRoundCog,
  FileCode,
} from "lucide-react"; // for icons

const Sidebar = () => {
  const location = useLocation();
  const accountType = localStorage.getItem("account_type");
  const isProfessor = accountType === "professor";

  // function: LoggedInName - get first/lastname
  const LoggedInName = () => {
    try {
      const userData = localStorage.getItem("user_data");

      if (userData) {
        const user = JSON.parse(userData);
        return user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.name || "Hello";
      }
    } catch (error) {
      console.error("Error parsing user data:", error);
    }
    return "Hello";
  };

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
    {
      name: "Topic Practice",
      icon: <Lightbulb size={24} />,
      path: "/topic-practice",
    },
    {
      name: "Mock Test",
      icon: <GraduationCap size={24} />,
      path: "/mock-test",
    },
    {
      name: "My Progress",
      icon: <BarChart2 size={24} />,
      path: "/my-progress",
    },
    {
      name: "Account",
      icon: <UserRoundCog size={24} />,
      path: "/account"
    },
    ...(isProfessor
      ? [
          {
            name: "Question Drafts",
            icon: <FileCode size={24} />,
            path: "/professor-drafts",
          },
        ]
      : []),
  ];

  return (
    <div className="h-full w-72 bg-gray-100 p-4 sm:p-6 shadow-lg flex flex-col">
      {/* user name */}
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold pt-6 sm:pt-10 mb-6 sm:mb-10 text-center">
        {LoggedInName()}
      </h1>

      {/* menu*/}
      <nav className="flex-1 overflow-y-auto">
        {menuItems.map((item) => (
          <Link
            key={item.name}
            to={item.path}
            className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-lg mb-2 sm:mb-3 text-base sm:text-lg md:text-xl transition-colors cursor-pointer ${
              (item.path === "/topic-practice" &&
                location.pathname.includes("/topic")) ||
              location.pathname.startsWith(item.path)
                ? "bg-yellow-500 text-white font-semibold"
                : "hover:bg-gray-200"
            }`}
          >
            {item.icon}
            {item.name}
          </Link>
        ))}
      </nav>

      {/* logout*/}
      <button
        className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 mt-auto rounded-lg text-base sm:text-lg md:text-xl text-gray-700 bg-white shadow-md border border-gray-300 hover:bg-gray-200 transition-all"
        onClick={doLogout}
      >
        <LogOut size={24} className="text-gray-700" />
        <span className="font-semibold">Log out</span>
      </button>
    </div>
  );
};

export default Sidebar;
