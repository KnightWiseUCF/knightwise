////////////////////////////////////////////////////////////////
//
//  Project:       KnightWise
//  Year:          2025-2026
//  Author(s):     KnightWise Team
//  File:          Layout.tsx
//  Description:   Common layout components.
//
//  Dependencies:  react
//                 Sidebar
//                 Header
//
////////////////////////////////////////////////////////////////

import React, { PropsWithChildren, useState, useRef, useCallback } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";
import CreditsModal from "../pages/CreditsPage";

const Layout: React.FC<PropsWithChildren> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const logoClickCount = useRef(0);

  const handleLogoClick = useCallback(() => {
    logoClickCount.current += 1;
    if (logoClickCount.current === 10) {
      logoClickCount.current = 0;
      setCreditsOpen(true);
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <Header onMenuClick={() => setSidebarOpen(true)} onLogoClick={handleLogoClick} />

      <div className="flex flex-1 overflow-hidden">
        {/* desktop Sidebar */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* small Sidebar */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)}>
            <div
              className="absolute left-0 top-0 h-full w-[85vw] max-w-72 bg-white shadow-lg"
              onClick={(event) => event.stopPropagation()}
            >
              <Sidebar />
              <button
                className="absolute right-2 top-2 rounded-md p-2 text-gray-600"
                onClick={() => setSidebarOpen(false)}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* main */}
        <main className="min-h-0 w-full flex-grow overflow-x-hidden overflow-y-auto">
          {children}
        </main>
      </div>
      <CreditsModal open={creditsOpen} onClose={() => setCreditsOpen(false)} />
    </div>
  );
};

export default Layout;
