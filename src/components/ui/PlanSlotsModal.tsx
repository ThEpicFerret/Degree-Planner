import React, { useState, useEffect } from 'react';
import BaseModal from './BaseModal';
import { PlanSlot, DEFAULT_SLOTS, getAllPlanSlots, saveCurrentPlanToSlot, setActiveSlotId } from '../../utils/slotStorage';
import { StoredPlan } from '../../utils/planStorage';
import { User } from 'firebase/auth';

interface PlanSlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeSlotId: string;
  currentPlanData: StoredPlan;
  onLoadPlanFromSlot: (slot: PlanSlot) => void;
  onActiveSlotChange: (slotId: string) => void;
  currentUser: User | null;
  onSignInWithGoogle: () => void;
  onSignOut: () => void;
}

export const PlanSlotsModal: React.FC<PlanSlotsModalProps> = ({
  isOpen,
  onClose,
  activeSlotId,
  currentPlanData,
  onLoadPlanFromSlot,
  onActiveSlotChange,
  currentUser,
  onSignInWithGoogle,
  onSignOut,
}) => {
  const [slots, setSlots] = useState<Record<string, PlanSlot>>(() => getAllPlanSlots());
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSlots(getAllPlanSlots());
    }
  }, [isOpen]);

  const handleStartRename = (slotId: string, currentName: string) => {
    setEditingSlotId(slotId);
    setEditingName(currentName);
  };

  const handleSaveRename = (slotId: string) => {
    if (!editingName.trim()) {
      setEditingSlotId(null);
      return;
    }
    const currentSlots = getAllPlanSlots();
    if (currentSlots[slotId]) {
      currentSlots[slotId].name = editingName.trim();
      currentSlots[slotId].updatedAt = new Date().toISOString();
      const updated = saveCurrentPlanToSlot(slotId, editingName.trim(), currentSlots[slotId].plan);
      setSlots({ ...updated });
    }
    setEditingSlotId(null);
  };

  const handleSaveCurrentToSlot = (slotId: string, slotDefaultName: string) => {
    const existing = slots[slotId];
    const nameToUse = existing?.name || slotDefaultName;
    const updated = saveCurrentPlanToSlot(slotId, nameToUse, currentPlanData);
    setSlots({ ...updated });
    onActiveSlotChange(slotId);
    setStatusMessage(`התוכנית הנוכחית נשמרה בהצלחה בסלוט "${nameToUse}"!`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleLoadSlot = (slot: PlanSlot) => {
    setActiveSlotId(slot.id);
    onActiveSlotChange(slot.id);
    onLoadPlanFromSlot(slot);
    onClose();
  };

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="ניהול גרסאות תוכנית לימודים (סלוטים וסנכרון ענן)"
      maxWidth="max-w-2xl"
    >
      <div dir="rtl" className="space-y-4 text-right">
        {/* Cloud sync status / Google banner */}
        <div className="p-3 rounded-xl border bg-slate-50 dark:bg-gray-800/80 border-slate-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/60 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
            </div>
            <div>
              {currentUser ? (
                <div>
                  <div className="text-xs font-bold text-gray-900 dark:text-gray-100 flex items-center gap-1.5">
                    <span>מחובר עם Google:</span>
                    <span className="text-blue-600 dark:text-blue-400">{currentUser.email}</span>
                  </div>
                  <div className="text-[11px] text-green-600 dark:text-green-400 font-medium">
                    ✓ סנכרון תוכניות וסלוטים בענן מופעל
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-xs font-bold text-gray-800 dark:text-gray-200">
                    שמירה מקומית פעילה (Local Storage)
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    התוכניות נשמרות מיידית בדפדפן. התחבר עם Google לגיבוי וסנכרון ענן בין מכשירים.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            {currentUser ? (
              <button
                type="button"
                onClick={onSignOut}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 transition-colors"
              >
                התנתק
              </button>
            ) : (
              <button
                type="button"
                onClick={onSignInWithGoogle}
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors flex items-center gap-1.5"
              >
                <span>התחבר עם Google</span>
              </button>
            )}
          </div>
        </div>

        {/* Temporary feedback banner */}
        {statusMessage && (
          <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-950/70 border border-green-300 dark:border-green-800 text-xs text-green-800 dark:text-green-200 font-medium">
            ✓ {statusMessage}
          </div>
        )}

        <div className="text-xs text-gray-600 dark:text-gray-300">
          באפשרותך לנהל עד 5 גרסאות תוכנית שונות (למשל: תוכנית עם נתיב אופטיקה, תוכנית עם רובוטיקה, פריסה ל-9 סמסטרים וכו׳) ולעבור ביניהן בלחיצה אחת:
        </div>

        {/* Slots List */}
        <div className="space-y-2.5 max-h-[50vh] overflow-y-auto pl-1">
          {DEFAULT_SLOTS.map(({ id, defaultName }) => {
            const slotData = slots[id];
            const isActive = activeSlotId === id;
            const isEditing = editingSlotId === id;

            const courseCount = slotData?.plan?.template?.semesters
              ? Object.values(slotData.plan.template.semesters).flat().filter(cid => cid && cid !== 'bonus_credits').length
              : 0;
            const semesterCount = slotData?.plan?.template?.semesters
              ? Object.keys(slotData.plan.template.semesters).length
              : 0;

            const updatedStr = slotData?.updatedAt
              ? new Date(slotData.updatedAt).toLocaleDateString('he-IL', {
                  day: 'numeric',
                  month: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : null;

            return (
              <div
                key={id}
                className={`p-3 rounded-xl border transition-all ${
                  isActive
                    ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/40 ring-1 ring-blue-500 shadow-sm'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/80 hover:border-gray-300'
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-black px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 shrink-0">
                      סלוט {id.replace('slot_', '')}
                    </span>

                    {isEditing ? (
                      <div className="flex items-center gap-1 flex-1">
                        <input
                          type="text"
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveRename(id);
                            if (e.key === 'Escape') setEditingSlotId(null);
                          }}
                          autoFocus
                          className="px-2 py-0.5 text-xs font-bold rounded border border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none w-full max-w-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(id)}
                          className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded font-bold hover:bg-blue-700"
                        >
                          שמור
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate">
                          {slotData?.name || defaultName}
                        </span>
                        {slotData && (
                          <button
                            type="button"
                            onClick={() => handleStartRename(id, slotData.name)}
                            className="text-gray-400 hover:text-blue-500 text-xs px-1"
                            title="ערוך שם סלוט"
                          >
                            ✎
                          </button>
                        )}
                      </div>
                    )}

                    {isActive && (
                      <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-500 text-white shadow-sm shrink-0">
                        פעיל כעת ✨
                      </span>
                    )}
                  </div>

                  {/* Actions for this slot */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {slotData && !isActive && (
                      <button
                        type="button"
                        onClick={() => handleLoadSlot(slotData)}
                        className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                        title="טען גרסה זו ללוח"
                      >
                        טען גרסה
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleSaveCurrentToSlot(id, defaultName)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                        isActive
                          ? 'bg-blue-600 hover:bg-blue-700 text-white font-bold'
                          : 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200'
                      }`}
                      title="שמור את התוכנית הפעילה כרגע על המסך לתוך סלוט זה"
                    >
                      {isActive ? 'עדכן שמירה' : 'שמור לכאן'}
                    </button>
                  </div>
                </div>

                {/* Slot Details */}
                <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-4">
                  {slotData ? (
                    <>
                      <span>📚 {courseCount} קורסים</span>
                      <span>🗓️ {semesterCount} סמסטרים</span>
                      {updatedStr && <span>🕒 עודכן: {updatedStr}</span>}
                    </>
                  ) : (
                    <span className="italic text-gray-400">סלוט ריק (לחץ "שמור לכאן" כדי לשמור את התוכנית הנוכחית)</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </BaseModal>
  );
};
