import React from "react";

const Footer: React.FC = () => {
  return (
    <footer className="bg-black text-white py-4 px-4 sm:px-8 flex flex-col sm:flex-row items-center justify-between text-center">
      <p className="text-xs sm:text-sm md:text-base mt-2 sm:mt-0">
        © 2025 KnightWise. All rights reserved.
      </p>

      <a
        href="https://github.com/PoshuaJaz/COP4331_LargeProject"
        className="underline text-xs sm:text-sm md:text-base"
        target="_blank"
        rel="noopener noreferrer"
      >
        GitHub Repository
      </a>
    </footer>
  );
};

export default Footer;
