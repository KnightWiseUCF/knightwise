import React from "react";

interface CreditsModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const CreditsModal: React.FC<CreditsModalProps> = ({ open, onClose, children }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 relative text-gray-900"
        onClick={e => e.stopPropagation()}
      >
        <button
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 text-xl font-bold"
          onClick={onClose}
          aria-label="Close credits"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
};

export default CreditsModal;
