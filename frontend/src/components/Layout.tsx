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

import React, { PropsWithChildren, useState } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

const Layout: React.FC<PropsWithChildren> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false); 

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <Header onMenuClick={() => setSidebarOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        {/* desktop Sidebar */}
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {/* small Sidebar */}
        {sidebarOpen && (
          <div className="fixed inset-0 z-40 bg-black bg-opacity-50 md:hidden">
            <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-lg">
              <Sidebar />
              <button
                className="absolute top-2 right-2 text-gray-600"
                onClick={() => setSidebarOpen(false)}
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* main */}
        <main className="flex-grow min-h-0 overflow-y-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
