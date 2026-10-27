# מדריך תחזוקה, הוספת שנתונים עתידיים והעלאה ל-GitHub Pages (`HOW_TO_UPDATE.md`)

> **הערה חשובה לתורמים ולסטודנטים:**
> * שדרוג הקטלוגים (תשפ"ז 2026-2027) בפרויקט זה הוא **Vibe Coded** שנבנה בכמה שעות במטרה לעזור לסטודנטים בטכניון, ומבוסס על הפרויקט המקורי [**NuclearGandhi/degree-planner**](https://github.com/NuclearGandhi/degree-planner) ועל סקריפטי ה-SAP הפתוחים ([**eyalroz/technion-sap-info-fetcher**](https://github.com/eyalroz/technion-sap-info-fetcher) ו-[**michael-maltsev/cheese-fork**](https://github.com/michael-maltsev/cheese-fork)).
> * **מה נבדק לעומק:** סרגלי הצד של **רשימות הבחירה** ו-**14 נתיבי ההתמחות** הוטמעו ונבדקו עבור **הנדסת מכונות בלבד**. בשאר 15 הפקולטות הוטמעו תוכניות הלימודים המומלצות מהקטלוגים של תשפ"ז, אך יש עוד מקום רב לשיפורים, דיוקים והוספת רשימות בחירה פקולטיות — מוזמנים לפתוח Issue או Pull Request ב-GitHub!

---

## 1. איך להוסיף שנתון לימודים חדש בעתיד (למשל `2027-2028` / תשפ"ח)

במסך **"בחר תכנית לימודים / החלף תכנית"** קיימת תיבת בחירה של **📅 שנתון קטלוג לימודים**.
כברירת מחדל מוצג בה כרגע רק **`תשפ"ז (2026-2027)`** (מתוך הקובץ `public/data/years.json`). שנתון חדש (כגון `2027-2028`) יתווסף לתיבת הבחירה **אך ורק כאשר תוסיפו תיקייה חדשה עבורו** ותריצו את סקריפט העדכון:

### שלב א': יצירת תיקיית הקטלוגים של השנה החדשה
1. בתיקייה `catalogs/` צרו תיקיית משנה חדשה עם שם השנתון, למשל:
   ```text
   catalogs/2027-2028/
   ```
   *(הקטלוגים הנוכחיים של תשפ"ז שמורים בתיקייה `catalogs/2026-2027/`).*
2. הורידו את קבצי ה-PDF של קטלוג הלימודים החדש מאתר לימודי הסמכה של הטכניון והכניסו אותם לתוך `catalogs/2027-2028/`.

### שלב ב' (אופציונלי): משיכת נתוני קורסים חדשים מ-SAP הטכניון
אם ברצונכם לעדכן גם את מאגר הקורסים הכללי מה-SAP של אותה שנה:
1. השתמשו בכלי הפתוח [`technion-sap-info-fetcher`](https://github.com/eyalroz/technion-sap-info-fetcher) (שנמצא גם בתיקייה `course-mapper-master/`) כדי להפיק קובצי JSON של סמסטר חורף/אביב/קיץ באופן מכבד וללא הצפת השרת.
2. שימו את קובצי ה-JSON שהופקו בתוך תיקיית משנה:
   ```text
   catalogs/2027-2028/sap/
   ```

### שלב ג': הרצת סקריפט העדכון (`scripts/update-year-data.mjs`)
מתוך התיקייה `degree-planner-main`, הריצו:
```bash
node scripts/update-year-data.mjs 2027-2028 "תשפ\"ח (2027-2028)" --set-default
```
**מה הסקריפט עושה אוטומטית?**
1. בודק שהתיקייה `catalogs/2027-2028/` אכן קיימת.
2. יוצר את התיקייה `public/data/2027-2028/` עם קובצי `degrees.json`, `merged_courses.json`, ו-`sports_courses.json` לאותה שנה (וממזג פנימה נתוני SAP חדשים אם שמתם כאלו ב-`catalogs/2027-2028/sap/`).
3. מעדכן את הקובץ `public/data/years.json` כך שבתפריט בחירת התואר באתר תופיע מיד האפשרות **`תשפ"ח (2027-2028)`** לצד **`תשפ"ז (2026-2027)`**!
4. אם השתנו מספרי קורסים בתוכנית מומלצת של פקולטה מסוימת בשנתון החדש, ערכו את `public/data/2027-2028/degrees.json` (או היעזרו ב-AI שיקרא את ה-PDF החדש מ-`catalogs/2027-2028/` ויעדכן את `public/data/2027-2028/degrees.json`).

---

## 2. איך להעלות את הפרויקט ל-GitHub שלך כ-Fork רשמי ולהפעיל את GitHub Pages (`github.io`)

### שלב 1: יצירת Fork רשמי ב-GitHub (נותן קרדיט מובנה ליוצר המקורי)
1. היכנסו בחשבון ה-GitHub שלכם לעמוד הפרויקט המקורי:
   👉 **`https://github.com/NuclearGandhi/degree-planner`**
2. לחצו על הכפתור **`Fork`** בפינה הימנית העליונה, ולחצו **`Create fork`**.
3. כעת נוצר אצלכם המאגר `https://github.com/<your-username>/degree-planner`, ומתחת לשמו מופיע הכיתוב הרשמי של GitHub:
   `forked from NuclearGandhi/degree-planner`.

### שלב 2: העלאת הקוד המעודכן מהמחשב שלכם אל ה-Fork ב-GitHub
פתחו טרמינל (PowerShell) בתיקייה `c:\Users\Jonathan\Documents\DegreePlanner\degree-planner-main` והריצו:
```powershell
cd c:\Users\Jonathan\Documents\DegreePlanner\degree-planner-main
git init
git remote add origin https://github.com/<your-username>/degree-planner.git
git branch -M main
git add .
git commit -m "Update to 2026-2027 (5787) catalogs, add all 16 faculties, ME paths & sports HUD"
git push -u origin main --force
```
*(החליפו את `<your-username>` בשם המשתמש שלכם ב-GitHub).*

### שלב 3: הפעלת האתר החי ב-GitHub Pages (`https://<your-username>.github.io/degree-planner/`)
בתיקייה `.github/workflows/deploy.yml` כבר מוכן תהליך בנייה אוטומטי ל-GitHub Pages!
1. במאגר שלכם ב-GitHub, היכנסו ללשונית **`Settings`** -> בתפריט הצד לחצו על **`Pages`**.
2. תחת **`Build and deployment`** -> **`Source`**, בחרו באפשרות **`GitHub Actions`** (או `Deploy from a branch` -> `gh-pages` אם ה-Action יצר ענף `gh-pages`).
3. תוך כדקה-שתיים מה-Push, האתר שלכם יהיה באוויר בכתובת:
   **`https://<your-username>.github.io/degree-planner/`**!

---

## 3. סדר בתיקיות הפרויקט — מה כל תיקייה עושה ומה צריך/אפשר למחוק?

בתיקייה הראשית `c:\Users\Jonathan\Documents\DegreePlanner\` קיימות התיקיות הבאות:

1. **`degree-planner-main/` (תיקיית האפליקציה הראשית — חובה לשמור!)**:
   * זוהי תיקיית האתר עצמו (React + TypeScript + Vite).
   * כל הנתונים שהאתר טוען בזמן ריצה כבר נמצאים בתוכה תחת `degree-planner-main/public/data/` (כולל `2026-2027/`, `degrees.json`, `merged_courses.json`, `sports_courses.json`, `years.json`).
   * כשמעלים ל-GitHub Pages, מעלים את `degree-planner-main/` (או גם את `catalogs/` ו-`collisions/` אם רוצים לשמור אותם במאגר לתיעוד עתידי).
2. **`catalogs/2026-2027/` (תיקיית קבצי ה-PDF של הקטלוגים — מומלץ לשמור)**:
   * מכילה את כל 17 קבצי ה-PDF של קטלוגי הפקולטות לשנתון תשפ"ז (2026-2027).
   * הקובץ הכפול שהיה בתיקייה הראשית (`קטלוג 2027 הנדסת מכונות.pdf`) הוסר כדי למנוע כפילות, מאחר שכל הקטלוגים מרוכזים באופן מסודר בתוך `catalogs/2026-2027/`.
3. **`collisions/` (תיקיית דוחות ההתנגשויות והבדיקות — מומלץ לשמור)**:
   * מכילה את הקבצים המסודרים עם סימון `[x]` למה שתוקן ו-`[!]` להתנגשויות מובנות בקטלוג הטכניון (כמו מלכודת פיזיקה 1מ'/2ממ' בהנדסת מכונות).
4. **`run-local.bat` ו-`node-portable/` (להרצה מקומית במחשב שלך בלי להתקין Node גלובלי)**:
   * מאפשרים לך להפעיל את האתר בלחיצה כפולה על `run-local.bat` על המחשב המקומי שלך. **אין צורך להעלות את `node-portable/` ל-GitHub** (הוא כבד ומיועד רק להרצה מקומית במחשב שלך).
5. **מה הוסר / נוקה כדי שלא יהיה בלגן?**
   * הוסר קובץ ה-PDF הכפול מהתיקייה הראשית (`קטלוג 2027 הנדסת מכונות.pdf`), כי הוא שמור בתוך `catalogs/2026-2027/`.
   * הוסר קובץ ה-ZIP הישן (`degree-planner-main.zip`) כדי לחסוך מקום ולמנוע בלבול.
   * התיקייה `course-mapper-master/` מכילה את קובצי המקור ההיסטוריים של ה-SAP (`sap_2025_200.json`, `sap_2026_200.json`) — כל הנתונים מתוכה כבר מוזגו לתוך `degree-planner-main/public/data/merged_courses.json`, כך שאין צורך להעלות אותה ל-GitHub (אפשר לשמור אותה מקומית לגיבוי או למחוק).
