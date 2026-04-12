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
    <header className="flex items-center justify-between bg-black px-4 py-3 text-white sm:px-6 sm:py-4">
      <div className="flex items-center space-x-3 sm:space-x-4">
        {!hideMenu && (
          <button className="mr-1 rounded-md p-2 md:hidden" onClick={onMenuClick}>
            <Menu size={24} />
          </button>
        )}
        <img
          src={logo}
          alt="KnightWise Logo"
          className="h-10 w-10 brightness-0 invert sm:h-12 sm:w-12"
          onClick={onLogoClick}
        />
        <h1 className="hidden text-base font-bold sm:block sm:text-lg">
          KNIGHTWISE
        </h1>
      </div>
    </header>
  );
};

export default Header;


