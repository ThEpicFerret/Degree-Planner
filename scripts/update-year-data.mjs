#!/usr/bin/env node
/**
 * Future-Proof Academic Year Data Updater for Technion DegreePlanner
 *
 * Usage:
 *   node scripts/update-year-data.mjs <year-folder-name> [hebrew-label] [--set-default]
 *
 * Example (for next year):
 *   1. Place the new PDF catalogs inside: ../catalogs/2027-2028/
 *   2. (Optional) Place new SAP JSON dumps (e.g. sap_winter.json, sap_spring.json) inside: ../catalogs/2027-2028/sap/
 *   3. Run:
 *      node scripts/update-year-data.mjs 2027-2028 "תשפ\"ח (2027-2028)" --set-default
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appRoot = path.resolve(__dirname, '..');
const workspaceRoot = path.resolve(appRoot, '..');
const catalogsRoot = path.join(workspaceRoot, 'catalogs');
const publicDataRoot = path.join(appRoot, 'public', 'data');

const args = process.argv.slice(2);
const yearId = args.find(a => !a.startsWith('--'));
const labelArg = args.filter(a => !a.startsWith('--'))[1];
const setDefault = args.includes('--set-default');

if (!yearId) {
  console.log('===================================================================');
  console.log(' Technion DegreePlanner — Year Catalog & SAP Data Updater');
  console.log('===================================================================');
  console.log('Usage:');
  console.log('  node scripts/update-year-data.mjs <YYYY-YYYY> [Hebrew Label] [--set-default]');
  console.log('\nExample:');
  console.log('  node scripts/update-year-data.mjs 2027-2028 "תשפ\\"ח (2027-2028)" --set-default');
  console.log('\nAvailable catalog folders in ../catalogs/:');
  if (fs.existsSync(catalogsRoot)) {
    const dirs = fs.readdirSync(catalogsRoot, { withFileTypes: true }).filter(d => d.isDirectory());
    for (const d of dirs) {
      console.log(`  - ${d.name}`);
    }
  }
  process.exit(0);
}

const targetCatalogDir = path.join(catalogsRoot, yearId);
if (!fs.existsSync(targetCatalogDir)) {
  console.error(`\n[ERROR] Catalog folder not found: ${targetCatalogDir}`);
  console.error(`To add year "${yearId}", first create the folder "catalogs/${yearId}" and place that year's PDF catalogs inside it.`);
  process.exit(1);
}

const pdfFiles = fs.readdirSync(targetCatalogDir).filter(f => f.toLowerCase().endsWith('.pdf'));
console.log(`Found ${pdfFiles.length} PDF catalog files in catalogs/${yearId}/`);

// Create public/data/<yearId>/
const targetDataDir = path.join(publicDataRoot, yearId);
if (!fs.existsSync(targetDataDir)) {
  fs.mkdirSync(targetDataDir, { recursive: true });
}

// Base files from current default data
const baseCoursesPath = path.join(publicDataRoot, 'merged_courses.json');
const baseDegreesPath = path.join(publicDataRoot, 'degrees.json');
const baseSportsPath = path.join(publicDataRoot, 'sports_courses.json');

const courses = JSON.parse(fs.readFileSync(baseCoursesPath, 'utf8'));
const degrees = JSON.parse(fs.readFileSync(baseDegreesPath, 'utf8'));
const sports = fs.existsSync(baseSportsPath) ? JSON.parse(fs.readFileSync(baseSportsPath, 'utf8')) : [];

// Check if optional SAP JSON dumps exist in catalogs/<yearId>/sap/
const sapDir = path.join(targetCatalogDir, 'sap');
if (fs.existsSync(sapDir)) {
  const sapFiles = fs.readdirSync(sapDir).filter(f => f.toLowerCase().endsWith('.json'));
  let updatedFromSap = 0;
  for (const sf of sapFiles) {
    try {
      const sapRaw = JSON.parse(fs.readFileSync(path.join(sapDir, sf), 'utf8'));
      if (Array.isArray(sapRaw)) {
        for (const item of sapRaw) {
          const cid = item?.general?.['מספר מקצוע'];
          if (cid && courses[cid]) {
            if (item.general['שם מקצוע']) courses[cid].name = item.general['שם מקצוע'];
            if (item.general['נקודות']) courses[cid].credits = String(item.general['נקודות']);
            if (item.general['סילבוס']) courses[cid].syllabus = item.general['סילבוס'];
            updatedFromSap++;
          }
        }
      }
    } catch (err) {
      console.warn(`Warning reading SAP file ${sf}:`, err.message);
    }
  }
  console.log(`Merged ${updatedFromSap} course records from catalogs/${yearId}/sap/`);
}

// Write year-specific data files
const outCoursesPath = path.join(targetDataDir, 'merged_courses.json');
const outDegreesPath = path.join(targetDataDir, 'degrees.json');
const outSportsPath = path.join(targetDataDir, 'sports_courses.json');

if (!fs.existsSync(outCoursesPath)) {
  fs.writeFileSync(outCoursesPath, JSON.stringify(courses, null, 4), 'utf8');
}
if (!fs.existsSync(outDegreesPath)) {
  fs.writeFileSync(outDegreesPath, JSON.stringify(degrees, null, 2), 'utf8');
}
if (!fs.existsSync(outSportsPath)) {
  fs.writeFileSync(outSportsPath, JSON.stringify(sports, null, 2), 'utf8');
}

// Update public/data/years.json manifest
const yearsJsonPath = path.join(publicDataRoot, 'years.json');
let yearsList = [];
if (fs.existsSync(yearsJsonPath)) {
  try {
    yearsList = JSON.parse(fs.readFileSync(yearsJsonPath, 'utf8'));
  } catch {
    yearsList = [];
  }
}

const existingIdx = yearsList.findIndex(y => y.id === yearId);
const yearLabel = labelArg || `שנתון ${yearId}`;

if (setDefault) {
  yearsList.forEach(y => {
    y.isDefault = false;
  });
}

if (existingIdx >= 0) {
  yearsList[existingIdx].label = yearLabel;
  if (setDefault) yearsList[existingIdx].isDefault = true;
} else {
  yearsList.push({
    id: yearId,
    label: yearLabel,
    isDefault: setDefault || yearsList.length === 0
  });
}

fs.writeFileSync(yearsJsonPath, JSON.stringify(yearsList, null, 2), 'utf8');
console.log(`\n[SUCCESS] Year "${yearId}" (${yearLabel}) is now active in public/data/years.json!`);
console.log(`Data files written to: public/data/${yearId}/`);
