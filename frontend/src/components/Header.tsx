import React from "react";
import logo from "../assets/kw_logo.png";
import { Menu } from "lucide-react";
import { useLocation } from "react-router-dom";


interface HeaderProps {
  onMenuClick?: () => void;
  onLogoClick?: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, onLogoClick }) => {
  const location = useLocation();
  const hideMenu = location.pathname === "/";

  return (
    <header className="bg-black text-white py-4 px-6 flex items-center justify-between">
      <div className="flex items-center space-x-4">
        {!hideMenu && (
          <button className="md:hidden mr-2" onClick={onMenuClick}>
            <Menu size={28} />
          </button>
        )}
        <img
          src={logo}
          alt="KnightWise Logo"
          className="w-12 h-12 brightness-0 invert"
          onClick={onLogoClick}
        />
        <h1 className="text-lg font-bold hidden sm:block">
          KNIGHTWISE
        </h1>
      </div>
    </header>
  );
};

export default Header;


