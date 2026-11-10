import React, { useState, useMemo, useEffect } from 'react';
import { DegreeTemplate } from '../../types/data';
import { fetchAvailableYears, fetchDegreeTemplates, CatalogYearOption } from '../../utils/dataLoader';
import BaseModal from './BaseModal';

interface TemplateSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: DegreeTemplate[];
  onSelectTemplate: (template: DegreeTemplate, selectedYear?: string) => void;
  isSwitching?: boolean;
  customTitle?: string;
  onExport: () => void;
}

export function sortDegreeTemplates(templates: DegreeTemplate[]): DegreeTemplate[] {
  const getSortInfo = (tmpl: DegreeTemplate) => {
    const key = (tmpl.id || '').toLowerCase();
    const name = tmpl.name || tmpl.id || '';
    const match = name.match(/^(\d{2})(?:\/(\d{2}))?\s*-\s*(.*)$/);
    const primaryNum = match ? parseInt(match[1], 10) : 999;
    const isDual = match && match[2] ? 1 : 0;
    const secondaryNum = match && match[2] ? parseInt(match[2], 10) : 0;
    const restName = match ? match[3] : name;

    const lowerName = name.toLowerCase();

    let isBase = 0;
    if (
      key.includes('general') ||
      lowerName.includes('כללי') ||
      lowerName.includes('הכללית') ||
      key === 'electrical-engineering' ||
      key === 'chemical-engineering' ||
      key === 'biotechnology-food-engineering' ||
      key === 'industrial-engineering-management' ||
      key === 'mathematics-general' ||
      key === 'physics-3yr' ||
      key === 'chemistry-3yr' ||
      key === 'biology-general' ||
      key === 'architecture' ||
      key === 'materials-engineering' ||
      key === 'biomedical-engineering' ||
      key === 'medical-sciences-preclinical' ||
      key === 'cs-4yr' ||
      (isDual && (key === 'physics-aerospace-dual' || lowerName.includes('דו-חוגי') || lowerName.includes('משולב')))
    ) {
      isBase = -1;
    }

    return { tmpl, name, primaryNum, isDual, secondaryNum, isBase, restName };
  };

  const list = [...templates].map(getSortInfo);

  list.sort((a, b) => {
    // 1. Primary number (01, 03, 04, 05, 06, 08, 09, 10, 11, 12, 13, 20, 21, 23, 27, 31, 33...)
    if (a.primaryNum !== b.primaryNum) {
      return a.primaryNum - b.primaryNum;
    }
    // 2. Base degree of the faculty comes first
    if (a.isDual !== b.isDual) {
      return a.isDual - b.isDual;
    }
    if (a.isBase !== b.isBase) {
      return a.isBase - b.isBase;
    }
    // 3. Alphabetical by Hebrew collation
    return a.name.localeCompare(b.name, 'he');
  });

  return list.map(item => item.tmpl);
}

export const TemplateSelectionModal: React.FC<TemplateSelectionModalProps> = ({
  isOpen,
  onClose,
  templates,
  onSelectTemplate,
  isSwitching = false,
  customTitle = 'בחר תכנית לימודים',
  onExport,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [availableYears, setAvailableYears] = useState<CatalogYearOption[]>([
    { id: '2026-2027', label: 'תשפ"ז (2026-2027)', isDefault: true },
  ]);
  const [selectedYear, setSelectedYear] = useState<string>('2026-2027');
  const [yearTemplates, setYearTemplates] = useState<DegreeTemplate[] | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    fetchAvailableYears().then(years => {
      setAvailableYears(years);
      const def = years.find(y => y.isDefault) || years[0];
      if (def) setSelectedYear(def.id);
    });
  }, [isOpen]);

  const handleYearChange = async (newYear: string) => {
    setSelectedYear(newYear);
    const data = await fetchDegreeTemplates(newYear);
    const loaded: DegreeTemplate[] = [];
    for (const [key, val] of Object.entries(data)) {
      if (key !== 'globalRules' && val && typeof val === 'object' && 'semesters' in val && !Array.isArray(val)) {
        const item = { ...(val as DegreeTemplate), id: (val as DegreeTemplate).id || key };
        loaded.push(item);
      }
    }
    if (loaded.length > 0) {
      setYearTemplates(loaded);
    } else {
      setYearTemplates(null);
    }
  };

  const activeTemplates = yearTemplates || templates;

  const sortedTemplates = useMemo(() => {
    return sortDegreeTemplates(activeTemplates);
  }, [activeTemplates]);

  const filteredTemplates = useMemo(() => {
    if (!searchTerm) {
      return sortedTemplates;
    }
    return sortedTemplates.filter(template =>
      template.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sortedTemplates, searchTerm]);

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={customTitle}
      maxWidth="max-w-lg"
    >
      {isSwitching && (
        <div className="mb-3 p-3 bg-yellow-100 dark:bg-yellow-800/80 text-yellow-800 dark:text-yellow-200 rounded-md text-xs">
          <p className="font-medium">אזהרה: החלפת תכנית תמחק את התכנית הנוכחית.</p>
          <button
            onClick={onExport}
            className="mt-2 px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors"
          >
            ייצא תכנית נוכחית
          </button>
        </div>
      )}

      {/* Academic Year Selector */}
      <div className="mb-3 p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700" dir="rtl">
        <div className="flex items-center justify-between gap-2">
          <label className="text-xs font-bold text-gray-700 dark:text-gray-200 whitespace-nowrap">
            📅 שנתון קטלוג לימודים:
          </label>
          <select
            value={selectedYear}
            onChange={e => handleYearChange(e.target.value)}
            className="flex-1 p-1.5 text-xs font-semibold border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 outline-none"
          >
            {availableYears.map(yr => (
              <option key={yr.id} value={yr.id}>
                {yr.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-tight">
          * שנתונים עתידיים (כגון 2027-2028) יופיעו אוטומטית ברשימה זו לאחר הוספת תיקיית הקטלוגים שלהם והרצת סקריפט העדכון (ראו קובץ HOW_TO_UPDATE.md).
        </p>
      </div>

      <div className="mb-3">
        <input
          type="text"
          placeholder="חפש לפי שם פקולטה או תכנית..."
          className="w-full p-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-gray-200 focus:ring-1 focus:ring-blue-500 outline-none"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="overflow-y-auto flex-grow pr-2 max-h-[48vh] min-h-[200px]">
        {filteredTemplates.length > 0 ? (
          <ul className="space-y-2">
            {filteredTemplates.map(template => (
              <li key={template.id}>
                <button
                  onClick={() => onSelectTemplate(template, selectedYear)}
                  className="w-full text-right p-2.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors text-gray-800 dark:text-gray-200 font-medium"
                >
                  {template.name}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500 dark:text-gray-400 text-sm text-center py-4">לא נמצאו תכניות מתאימות</p>
        )}
      </div>
    </BaseModal>
  );
};
