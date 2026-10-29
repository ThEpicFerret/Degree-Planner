import { DegreeTemplate } from '../types/data';
import { StoredPlan } from './planStorage';

export interface PlanSlot {
  id: string; // 'slot_1', 'slot_2', ...
  name: string; // Custom name, e.g., "תוכנית ראשית - אופטיקה"
  plan: StoredPlan;
  updatedAt: string; // ISO date string
}

const SLOTS_STORAGE_KEY = 'degreePlanner_multi_slots_v1';
const ACTIVE_SLOT_KEY = 'degreePlanner_active_slot_id_v1';

export const DEFAULT_SLOTS: Array<{ id: string; defaultName: string }> = [
  { id: 'slot_1', defaultName: 'תוכנית א׳ (ראשית)' },
  { id: 'slot_2', defaultName: 'תוכנית ב׳ (חלופית)' },
  { id: 'slot_3', defaultName: 'תוכנית ג׳ (פריסה מורחבת)' },
  { id: 'slot_4', defaultName: 'תוכנית ד׳' },
  { id: 'slot_5', defaultName: 'תוכנית ה׳' },
];

export function getAllPlanSlots(): Record<string, PlanSlot> {
  try {
    const raw = localStorage.getItem(SLOTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, PlanSlot>;
      }
    }
  } catch (err) {
    console.error('[slotStorage] Error reading slots from localStorage:', err);
  }
  return {};
}

export function saveAllPlanSlots(slots: Record<string, PlanSlot>): void {
  try {
    localStorage.setItem(SLOTS_STORAGE_KEY, JSON.stringify(slots));
  } catch (err) {
    console.error('[slotStorage] Error saving slots to localStorage:', err);
  }
}

export function saveCurrentPlanToSlot(
  slotId: string,
  slotName: string,
  plan: StoredPlan
): Record<string, PlanSlot> {
  const currentSlots = getAllPlanSlots();
  currentSlots[slotId] = {
    id: slotId,
    name: slotName.trim() || `תוכנית ${slotId.replace('slot_', '')}`,
    plan,
    updatedAt: new Date().toISOString(),
  };
  saveAllPlanSlots(currentSlots);
  setActiveSlotId(slotId);
  return currentSlots;
}

export function getActiveSlotId(): string {
  try {
    return localStorage.getItem(ACTIVE_SLOT_KEY) || 'slot_1';
  } catch {
    return 'slot_1';
  }
}

export function setActiveSlotId(slotId: string): void {
  try {
    localStorage.setItem(ACTIVE_SLOT_KEY, slotId);
  } catch (err) {
    console.error('[slotStorage] Error setting active slot id:', err);
  }
}
