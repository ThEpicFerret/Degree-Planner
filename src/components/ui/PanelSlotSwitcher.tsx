import React from 'react';

export type PanelSlot = 1 | 2 | 3 | 4;

interface PanelSlotSwitcherProps {
  currentSlot: PanelSlot;
  onSlotChange: (slot: PanelSlot) => void;
  colorScheme?: 'blue' | 'emerald' | 'purple' | 'orange';
}

const ACTIVE_COLOR_CLASSES: Record<string, string> = {
  blue: 'bg-blue-600 text-white ring-1 ring-blue-400 shadow-sm',
  emerald: 'bg-emerald-600 text-white ring-1 ring-emerald-400 shadow-sm',
  purple: 'bg-purple-600 text-white ring-1 ring-purple-400 shadow-sm',
  orange: 'bg-orange-600 text-white ring-1 ring-orange-400 shadow-sm',
};

export const getPanelSlotStyle = (slot: PanelSlot = 1): React.CSSProperties => {
  switch (slot) {
    case 1:
      // Rightmost slot (עמדה 1 - ימין קיצוני)
      return { position: 'fixed', top: '5rem', right: '1rem', left: 'auto', zIndex: 30 };
    case 2:
      // Mid-right slot (עמדה 2 - מרכז ימין)
      return { position: 'fixed', top: '5rem', right: 'calc(1rem + 340px + 10px)', left: 'auto', zIndex: 30 };
    case 3:
      // Mid-left slot (עמדה 3 - מרכז שמאל)
      return { position: 'fixed', top: '5rem', left: 'calc(1rem + 340px + 10px)', right: 'auto', zIndex: 30 };
    case 4:
    default:
      // Leftmost slot (עמדה 4 - שמאל קיצוני)
      return { position: 'fixed', top: '5rem', left: '1rem', right: 'auto', zIndex: 30 };
  }
};

export const PanelSlotSwitcher: React.FC<PanelSlotSwitcherProps> = ({
  currentSlot,
  onSlotChange,
  colorScheme = 'blue',
}) => {
  const activeClass = ACTIVE_COLOR_CLASSES[colorScheme] || ACTIVE_COLOR_CLASSES.blue;

  return (
    <div
      className="flex items-center gap-1 bg-gray-100/90 dark:bg-gray-800/90 px-1.5 py-0.5 rounded-lg border border-gray-200/80 dark:border-gray-700/80"
      title="חלוקת מסך: לחץ על 1-4 כדי להעביר את החלונית לעמדה הרצויה (אם עמדה תפוסה החלוניות יחליפו מקום)"
    >
      <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 ml-0.5 select-none">
        עמדה:
      </span>
      <div className="flex items-center gap-0.5">
        {([1, 2, 3, 4] as PanelSlot[]).map(s => {
          const isActive = currentSlot === s;
          return (
            <button
              key={s}
              type="button"
              onClick={e => {
                e.stopPropagation();
                onSlotChange(s);
              }}
              className={`w-5 h-5 flex items-center justify-center rounded text-[11px] font-bold transition-all ${
                isActive
                  ? activeClass
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200/90 dark:hover:bg-gray-700'
              }`}
              title={`עמדה ${s} במסך ${isActive ? '(נוכחית)' : '(החלפה אם תפוס)'}`}
            >
              {s}
            </button>
          );
        })}
      </div>
    </div>
  );
};
