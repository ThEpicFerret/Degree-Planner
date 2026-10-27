import React, { useState, useRef, useEffect } from 'react';
import { ArrowUpTrayIcon, ArrowDownTrayIcon, ArrowsRightLeftIcon, ArrowLeftStartOnRectangleIcon, ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline';
import { UserCircleIcon } from '@heroicons/react/24/solid';
import { User } from 'firebase/auth';

interface AuthButtonsProps {
  onExportPlan: () => void;
  onImportPlan: (file: File) => void;
  onSwitchTemplate: () => void;
  currentUser: User | null;
  onSignIn: () => void;
  onSignOut: () => void;
}

const AuthButtons: React.FC<AuthButtonsProps> = ({ onExportPlan, onImportPlan, onSwitchTemplate, currentUser, onSignIn, onSignOut }) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handlePointerDownOutside = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDownOutside, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDownOutside, true);
    };
  }, [isDropdownOpen]);

  const handleSignOut = async () => {
    try {
      onSignOut();
      setIsDropdownOpen(false);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleExportPlan = () => {
    onExportPlan();
    setIsDropdownOpen(false);
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImportPlan(file);
      setIsDropdownOpen(false);
      event.target.value = '';
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={toggleDropdown}
        className="p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center justify-center"
      >
        <UserCircleIcon className="h-10 w-10 text-blue-500" />
      </button>
      
      {isDropdownOpen && (
        <div className="absolute right-0 mt-3 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 p-1.5" dir="rtl">
          <div className="p-2 mb-1 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/50">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400">
                <ArrowRightStartOnRectangleIcon className="h-4 w-4 text-gray-400" />
                התחברות עם Google
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-200 dark:bg-amber-800/80 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded">
                TBA
              </span>
            </div>
            <p className="text-[11px] text-amber-800 dark:text-amber-300 mt-1 leading-snug">
              שמירה דרך גוגל תתווסף בעתיד, ממליץ לשמור כקובץ
            </p>
          </div>
          {currentUser && (
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
              <p className="text-sm text-gray-500 dark:text-gray-400">מחובר כ: {currentUser.displayName || currentUser.email}</p>
            </div>
          )}
          <button
            onClick={handleExportPlan}
            className="w-full text-right px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <ArrowUpTrayIcon className="h-4 w-4 inline" />
            ייצא תכנית לימודים
          </button>
          <>
            <button
              onClick={handleImportClick}
              className="w-full text-right px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <ArrowDownTrayIcon className="h-4 w-4 inline" />
              ייבא תוכנית לימודים
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </>
          <button
            onClick={() => { onSwitchTemplate(); setIsDropdownOpen(false); }}
            className="block w-full text-right px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
          >
            <ArrowsRightLeftIcon className="h-4 w-4 inline" />
            החלף תכנית
          </button>
          {currentUser && (
            <button
              onClick={handleSignOut}
              className="w-full text-right px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <ArrowLeftStartOnRectangleIcon className="h-4 w-4 inline" />
              התנתק
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default AuthButtons; 