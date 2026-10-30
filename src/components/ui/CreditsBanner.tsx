import React, { useState, useEffect } from 'react';

export const CreditsBanner: React.FC = () => {
  const [showDetails, setShowDetails] = useState(false);

  // Close on Escape key
  useEffect(() => {
    if (!showDetails) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDetails(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDetails]);

  return (
    <>
      {/* Sleek, Non-Colliding Header Pill Button */}
      <button
        type="button"
        onClick={() => setShowDetails(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg shadow-sm backdrop-blur-sm bg-amber-50/90 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/70 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs font-semibold transition-all hover:scale-[1.02] active:scale-95"
        title="פרויקט Vibe Coded (קטלוג 2026-2027) — לחץ להבהרות, מקורות וקרדיטים"
        dir="rtl"
      >
        <span className="text-amber-600 dark:text-amber-400 text-sm">⚠️</span>
        <span className="font-bold">פרויקט Vibe Coded</span>
        <span className="text-[10px] text-amber-700/90 dark:text-amber-300/90 hidden sm:inline">
          (הבהרות וקרדיטים ▾)
        </span>
      </button>

      {/* Full Credits & Disclaimer Centered Modal Dialog */}
      {showDetails && (
        <div
          dir="rtl"
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowDetails(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl p-5 text-xs text-gray-800 dark:text-gray-200 space-y-3.5"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🙏</span>
                <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                  אודות, הבהרות חשובות וקרדיטים
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 font-bold transition-colors"
                title="סגור (Esc)"
              >
                ✕
              </button>
            </div>

            {/* Main Text */}
            <p className="leading-relaxed text-gray-700 dark:text-gray-300">
              מבוסס על{' '}
              <a
                href="https://github.com/NuclearGandhi/degree-planner"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
              >
                NuclearGandhi/degree-planner
              </a>{' '}
              וכלי ה-SAP הפתוחים. עדכון והוספת הקטלוגים (2026-2027) הוא <strong>Vibe Coded</strong> כמעט ב-100% ונוצר נטו ככלי עזר לסטודנטים.
            </p>

            <p className="leading-relaxed text-gray-700 dark:text-gray-300 text-[11px]">
              העדכון הזה נעשה בכמה שעות ולא כפרויקט קוד רשמי — הייתי צריך כלי וה-DegreePlanner לא היה מעודכן לשנת הלימודים הנוכחית. הוספתי כרגע בעיקר את המסלולים/רשימות קורסים של הנדסת מכונות; קטלוגים של תארים אחרים נוספו אוטומטית מקטלוגי הטכניון אך לא נבדקו ידנית.
            </p>

            {/* Warning Box */}
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 space-y-2">
              <div className="font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                <span>⚠️</span>
                <span>האתר אינו מקור רשמי — אל תסתמכו עליו בעיניים עצומות!</span>
              </div>
              <div>
                סרגלי הנתיבים והרשימות לא נבדקו ידנית. תמיד תוודאו את הדרישות והסילבוס מול קטלוג הלימודים הרשמי של הטכניון ואתר הפקולטה שלכם.
              </div>
              <div className="text-slate-700 dark:text-slate-300">
                ❄️🌸☀️ הקורסים לא בהכרח זמינים/לא זמינים בסמסטרים הכתובים — זמינות הקורסים בסילבוס אינה מחייבת את הפקולטה.
              </div>
              <div className="text-teal-800 dark:text-teal-300 font-medium">
                כל המשתמשים יותר ממוזמנים לתחזק את הפרויקט ולדייק אותו יותר — זה כלי שיכול להביא תועלת רבה לכל סטודנט.
              </div>
            </div>

            {/* Links Section */}
            <div className="space-y-1.5 bg-gray-50 dark:bg-gray-800/70 p-3 rounded-xl border border-gray-100 dark:border-gray-700">
              <div className="font-bold text-gray-900 dark:text-gray-100 mb-1">
                הקרדיט מגיע ליוצרי הפרויקטים הפתוחים:
              </div>
              <ul className="list-disc list-inside space-y-1.5 text-[11px]">
                <li>
                  <strong>DegreePlanner המקורי:</strong>{' '}
                  <a
                    href="https://github.com/NuclearGandhi/degree-planner"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline font-mono"
                  >
                    github.com/NuclearGandhi/degree-planner
                  </a>{' '}
                  (אתר מקורי:{' '}
                  <a
                    href="https://nucleargandhi.github.io/degree-planner/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline font-mono"
                  >
                    nucleargandhi.github.io
                  </a>
                  )
                </li>
                <li>
                  <strong>סקריפט משיכת הנתונים מה-SAP:</strong>{' '}
                  <a
                    href="https://github.com/eyalroz/technion-sap-info-fetcher"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline font-mono"
                  >
                    github.com/eyalroz/technion-sap-info-fetcher
                  </a>
                </li>
                <li>
                  <strong>CheeseFork:</strong>{' '}
                  <a
                    href="https://github.com/michael-maltsev/cheese-fork"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline font-mono"
                  >
                    github.com/michael-maltsev/cheese-fork
                  </a>
                </li>
              </ul>
            </div>

            {/* Close Button */}
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-sm transition-all"
              >
                סגור חלון
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
