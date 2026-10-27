import React from 'react';

export interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const features = [
    {
      emoji: '🔗',
      title: 'שרשראות קדמים והמשכים',
      desc: 'לחיצה על קורס מציגה את מפת התלויות שלו: קדמים בימין (אדום 🔴) והמשכים בשמאל (כתום 🟠). שאר הקורסים מתעמעמים למיקוד מושלם.',
    },
    {
      emoji: '🏷️',
      title: 'קדם ישיר והמשך ישיר (דרגה 1)',
      desc: 'קורסים במרחק צעד אחד מקבלים תגית בולטת \'קדם ישיר\' או \'המשך ישיר\' וקווים ב-100% שקיפות ובולטות עליונה.',
    },
    {
      emoji: '🔢',
      title: 'מספרי מרחק בשרשרת (דרגות 2, 3, 4...)',
      desc: 'לקורסים עקיפים מוצג מספר המרחק: 2 (קדם של קדם), 3 (קדם של דרגה 2) וכך הלאה. קווים רחוקים הופכים למקווקוים ועדינים.',
    },
    {
      emoji: '⭕',
      title: 'הילת זוהר (Halo) לקורסים מקושרים',
      desc: 'קורס שנבחר עטוף בהילה כחולה, קדמים ישירים בהילה אדומה זוהרת, והמשכים ישירים בהילה כתומה.',
    },
    {
      emoji: '🖥️',
      title: 'חלוקת מסך וחלונות נצמדים (עמדות 1 עד 4)',
      desc: 'סרגל 1-4 בראש כל סרגל צד מעביר אותו לעמדה (1 בימין עד 4 בשמאל). לחיצה על עמדה תפוסה מחליפה מיקומים ביניהם.',
    },
    {
      emoji: '🎓',
      title: 'סמסטר 0 (עבר אקדמי / פטורים / אפיקי מעבר)',
      desc: 'מיועד לקורסים שנלקחו לפני התואר. קורסים שמוצבים בו נחשבים כהושלמו ומאפשרים לקחת את המשכיהם כבר בסמסטר א\'.',
    },
    {
      emoji: '🎁',
      title: 'קורס בונוסים בסמסטר 0',
      desc: 'מאפשר להגדיר נקודות זכות בונוס בקפיצות של 0.5 (כגון 0.5, 2.5, 7, 18.5) שמתווספות אוטומטית לסך הנק"ז לתואר.',
    },
    {
      emoji: '⏱️',
      title: 'עומס שעות שבועיות (ש"ש)',
      desc: 'מציג שעות שבועיות לכל קורס, סיכום לכל סמסטר וממוצע לתואר (קורסי ספורט מחושבים כ-1.5 ש"ש, ונבחרות כ-3 ש"ש).',
    },
    {
      emoji: '📅',
      title: 'סמסטר מוקדם ביותר (החל מ-...)',
      desc: 'מחשב אוטומטית מתי ניתן לקחת את הקורס לכל המוקדם, בהתאם לקדמים, פטורים ועונות הוראה (חורף / אביב).',
    },
    {
      emoji: '↩️',
      title: 'ביטול ושחזור פעולות (Undo / Redo)',
      desc: 'כפתורי ביטול ושחזור בראש הדף וב-HUD התחתון (תמיכה מלאה גם בקיצורי מקלדת Ctrl+Z ו-Ctrl+Y).',
    },
    {
      emoji: '📌',
      title: 'העברת קורסים מהירה בין סמסטרים',
      desc: 'בסימון קורס מופיעים כפתורי \'סמסטר קודם\' ו\'סמסטר הבא\' בסרגל התחתון להזזה בלחיצה אחת.',
    },
    {
      emoji: '❄️🌸☀️',
      title: 'עונות הוראה לקורס',
      desc: 'תגית צבעונית מציגה מתי הקורס מוצע: ❄️ חורף, 🌸 אביב, ☀️ קיץ (לפי נתוני הקטלוג).',
    },
    {
      emoji: '📊',
      title: 'ממוצע וציונים',
      desc: 'הזנת ציונים (0-100) או סימון פטור בינארי; כרטיס הסיכום מחשב ממוצע משוקלל לכל סמסטר ולתואר כולו.',
    },
    {
      emoji: '📁',
      title: 'שמירה בענן, ייצוא וייבוא',
      desc: 'שמירה אוטומטית מקומית ובענן למשתמשים מחוברים, עם אפשרות הורדת קובץ גיבוי JSON וייבוא שלו בכל מכשיר.',
    },
  ];

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-right"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/60">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">💡</span>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                מדריך מהיר ופיצ'רים באתר
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                סקירה תמציתית של כל הכלים והיכולות לתכנון התואר
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title="סגור"
          >
            ✕
          </button>
        </div>

        {/* Feature List */}
        <div className="p-6 overflow-y-auto space-y-3 divide-y divide-gray-100 dark:divide-gray-800">
          {features.map((feat, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 text-xs leading-relaxed ${idx > 0 ? 'pt-3' : ''}`}
            >
              <div className="text-lg shrink-0 w-7 text-center">{feat.emoji}</div>
              <div className="flex-1">
                <span className="font-bold text-gray-900 dark:text-gray-100 ml-1.5">
                  {feat.title}:
                </span>
                <span className="text-gray-700 dark:text-gray-300">
                  {feat.desc}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-slate-50 dark:bg-gray-800/60 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>טיפ: לחצו על קורס כלשהו כדי לראות את שרשרת הקדמים שלו</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
          >
            הבנתי, תודה!
          </button>
        </div>
      </div>
    </div>
  );
};
