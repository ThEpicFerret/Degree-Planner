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
          {!currentUser ? (
            <button
              onClick={() => {
                onSignIn();
                setIsDropdownOpen(false);
              }}
              className="w-full text-right p-2.5 mb-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/70 dark:hover:bg-blue-900/70 border border-blue-200 dark:border-blue-800 transition-all flex items-center justify-between group cursor-pointer shadow-sm"
              title="התחבר עם חשבון Google לשמירה וסנכרון אוטומטי בענן"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                <div className="text-right">
                  <span className="block text-xs font-bold text-blue-900 dark:text-blue-100 leading-tight">
                    התחבר עם Google
                  </span>
                  <span className="block text-[10px] text-blue-700 dark:text-blue-300">
                    שמירה וסנכרון תוכנית בענן
                  </span>
                </div>
              </div>
              <span className="text-xs text-blue-600 dark:text-blue-400 font-bold group-hover:translate-x-0.5 transition-transform">
                ◀
              </span>
            </button>
          ) : (
            <div className="p-2 mb-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  מחובר ומסונכרן לענן Google
                </span>
              </div>
              <p className="text-[11px] text-gray-600 dark:text-gray-300 mt-1 truncate">
                {currentUser.displayName || currentUser.email}
              </p>
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