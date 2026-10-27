import React, { useState, useRef, useEffect } from 'react';

export const CreditsBanner: React.FC = () => {
  const [showDetails, setShowDetails] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showDetails) return;
    const handlePointerDownOutside = (e: PointerEvent) => {
      if (bannerRef.current && !bannerRef.current.contains(e.target as Node)) {
        setShowDetails(false);
      }
    };
    window.addEventListener('pointerdown', handlePointerDownOutside, true);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDownOutside, true);
    };
  }, [showDetails]);

  return (
    <div
      ref={bannerRef}
      dir="rtl"
      className="fixed top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 max-w-[95vw]"
    >
      {/* Main Compact Banner */}
      <div className="bg-slate-50/90 dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700 rounded-lg shadow-md backdrop-blur-sm px-3.5 py-1.5 text-[11px] text-gray-700 dark:text-gray-200 leading-snug text-right max-w-2xl">
        <div>
          מבוסס על{' '}
          <a
            href="https://github.com/NuclearGandhi/degree-planner"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            NuclearGandhi/degree-planner
          </a>{' '}
          וכלי ה-SAP הפתוחים. עדכון והוספת הקטלוגים (2026-2027) הוא <strong>Vibe Coded</strong> כמעט ב-100% ונוצר נטו ככלי עזר.
        </div>
        <div className="text-[10px] text-amber-700 dark:text-amber-300/90 mt-0.5">
          ⚠️ סרגלי הנתיבים/רשימות לא נבדקו ידנית, יש עוד הרבה מה לשפר (מוזמנים להגיב/לתת הערות) — <strong>האתר לא מקור רשמי, אל תסתמכו עליו בעיניים עצומות!</strong>
        </div>
        <div className="text-[10px] text-slate-600 dark:text-slate-300 mt-1">
          ❄️🌸☀️ הקורסים לא בהכרח זמינים/לא זמינים בסמסטרים הכתובים, אני יודע בוודאות שהנתונים לא מעודכנים אבל לא הצלחתי להשיג מקור מהימן יותר כדי לדייק.
        </div>
        <div className="text-[10px] text-teal-700 dark:text-teal-300 font-medium mt-0.5">
          כל המשתמשים יותר ממוזמנים לתחזק את הפרוייקט ולדייק אותו יותר, זה כלי שיכול להביא תועלת לכל סטודנט.
        </div>
      </div>

      {/* Full Credits Button to the LEFT of the banner (as marked in blue circle) */}
      <button
        type="button"
        onClick={() => setShowDetails(prev => !prev)}
        className="flex-shrink-0 px-3 py-2 rounded-lg shadow-md backdrop-blur-sm bg-blue-600/90 hover:bg-blue-700 text-white font-semibold text-xs transition-colors whitespace-nowrap"
      >
        {showDetails ? 'סגור ▲' : 'קרדיטים מלאים ▼'}
      </button>

      {/* Expandable Full Credits Popover */}
      {showDetails && (
        <div
          dir="rtl"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-[92vw] max-w-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl p-4 text-xs text-gray-800 dark:text-gray-200 space-y-3"
        >
          <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 pb-2">
            <h3 className="font-bold text-sm">🙏 קרדיטים, מקורות והערות חשובות</h3>
            <button
              type="button"
              onClick={() => setShowDetails(false)}
              className="text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 font-bold px-1.5"
            >
              ✕
            </button>
          </div>

          <p className="leading-relaxed text-gray-700 dark:text-gray-300">
            העדכון הזה הוא <strong>Vibe Coded</strong> שנעשה בכמה שעות ולא פרויקט קוד אישי שלי — הייתי צריך כלי וה-DegreePlanner לא היה מעודכן לשנת הלימודית הנוכחית, הוספתי כרגע רק את המסלולים/רשימות קורסים של הנדסת מכונות, אני לא בדקתי/מכיר את התארים האחרים, הוספתי את הקטלוגים שלהם למקרה ומישהו ימצא את זה שימושי אבל לא בדקתי אותם בכלל.
          </p>

          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 space-y-1">
            <div>⚠️ אני לא לוקח שום אחריות על טעויות, קדמים חסרים או חוסר דיוקים בנתונים. אל תשתמשו בכלי הזה בעיניים עצומות — תמיד תוודאו מול קטלוג הלימודים הרשמי ואתר הקורסים של הפקולטה שלכם.</div>
            <div className="text-slate-700 dark:text-slate-300">❄️🌸☀️ הקורסים לא בהכרח זמינים/לא זמינים בסמסטרים הכתובים, אני יודע בוודאות שהנתונים לא מעודכנים אבל לא הצלחתי להשיג מקור מהימן יותר כדי לדייק.</div>
            <div className="text-teal-800 dark:text-teal-300 font-semibold">כל המשתמשים יותר ממוזמנים לתחזק את הפרוייקט ולדייק אותו יותר, זה כלי שיכול להביא תועלת לכל סטודנט.</div>
          </div>

          <div className="space-y-1.5 bg-gray-50 dark:bg-gray-800/70 p-3 rounded-lg border border-gray-100 dark:border-gray-700">
            <div className="font-bold text-gray-900 dark:text-gray-100 mb-1">
              הקרדיט האמיתי מגיע ליוצרים של הפרויקטים הבאים:
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px]">
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
                (אתר המקור:{' '}
                <a
                  href="https://nucleargandhi.github.io/degree-planner/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline font-mono"
                >
                  nucleargandhi.github.io/degree-planner
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
        </div>
      )}
    </div>
  );
};
