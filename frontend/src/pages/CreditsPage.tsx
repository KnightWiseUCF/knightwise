import React from "react";

import CreditsModal from "../components/Modal";

/* This project has and continues to be an absolute joy and an honor to work on with you guys,
 * there's nobody else that I'd rather have standing next to me in the final presentations.  
 * Thank you so much for all of your hard work. 
 *
 * Have a great summer and happy graduation!!  
 * - Dahlia <3 
 */


const CreditsPage: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => (
  <CreditsModal open={open} onClose={onClose}>
    <div className="text-center">
      <h1 className="text-3xl font-bold mb-4">Secret Credits</h1>
      <p className="mb-6 text-lg">This project was made possible by the following contributors:</p>
      <ul className="mb-6 text-left list-disc list-inside space-y-2">
        <li><span className="font-semibold">Daniel Landsman</span> – API</li>
        <li><span className="font-semibold">Mina Georgoudiou</span> – DB + API</li>
        <li><span className="font-semibold">Dayton Hawk</span> – Frontend and Prototyping</li>
        <li><span className="font-semibold">Dahlia Frederico</span> – Frontend + Project Manager</li>
        <br />
        <span className="font-semibold">Special Thanks To:</span> 
        <li><span className="font-semibold">Joshua Paz</span> </li>
        <li><span className="font-semibold">Carla McBurnie</span> </li>
        <li><span className="font-semibold">Yeoneui Lee</span> </li>
        <li><span className="font-semibold">Pinx, Tawny, HP, Racc, and the rest of the Sour Brigade</span> </li>
        <li><span className="font-semibold">Cacti, Dew, Kupliva, Mr. Knows, Haru, Matt, Pidgey, Linca, and Welsh</span></li>
        <li><span className="font-semibold">Wendy Frederico</span> </li>
        <li><span className="font-semibold">Dr. Matthew Gerber</span> </li>
      </ul>
      <p className="text-sm text-gray-500">KnightWise © 2026. All rights reserved.</p>
    </div>
  </CreditsModal>
);

export default CreditsPage;


