# אתר הנצחה – Moonlit Teal (Astro)

הגרסה הזו משתמשת ב־**Astro** כדי לפתור את בעיית ה־DRY (Header/Footer/Head פעם אחת לכל האתר) ועדיין להפיק **HTML סטטי** לפריסה קלה.

## מה יש כאן
- **שדה אורות אינטראקטיבי** (`index.html`)
- **רשימת אנשים + חיפוש סלחני** (`people.html`)
- **יישובים + דף לכל יישוב** (`places.html` + `place/*.html`)
- **דף אישי לכל אדם**
  - דף דינמי: `person.html?id=...`
  - דפים סטטיים לשיתוף (OG עובד ב־WhatsApp/Facebook): `p/*.html`

## מבנה תיקיות
- `src/` – קבצי Astro (עריכה כאן)
  - `src/layouts/Layout.astro` – Layout מרכזי (Head + Header + Footer)
  - `src/pages/` – כל העמודים
- `public/` – נכסים סטטיים שמוגשים כמו־שהם
  - `public/assets/*` – CSS/JS/תמונות
  - `public/data/people.json` – נתוני אנשים
- `legacy/static/` – גיבוי של ה־HTML הישן שנוצר בעבר (לא חייבים לגעת)

## התקנה והרצה
דורש Node.js.

```bash
npm install
npm run dev
```

Build ל־HTML סטטי (לפריסה):
```bash
npm run build
```
התוצרים יהיו ב־`dist/` (זה מה שמעלים לשרת / GitHub Pages).

Preview של ה־build:
```bash
npm run preview
```

## שיתוף + SEO (Open Graph)
- לכל הדפים יש OG בסיסי (כותרת/תיאור/תמונה).
- **לשיתוף אמיתי של “שם האדם”** (בלי "טוען…"), משתמשים בדפים הסטטיים `p/*.html` שמוטמע בהם ה־OG מראש.

### תמונת שיתוף
ברירת מחדל: `public/assets/og-share-image.jpg`

### URL מוחלט ל־og:url + canonical (מומלץ)
Astro יודע להפיק כתובות מוחלטות אם מגדירים `PUBLIC_SITE_URL`.
העתיקו את `.env.example` ל־`.env` ועדכנו:
```
PUBLIC_SITE_URL=https://your-domain.example
```

## Supabase (אופציונלי)
ברירת מחדל: מצב מקומי (localStorage).

כדי להפוך נרות + מילים ל”משותפים לכולם”:
- קראו את `SETUP_SUPABASE.md`
- מלאו `public/assets/backend-config.js`

הערה: אפשר להוסיף `preconnect` כבר בזמן build ע"י `PUBLIC_SUPABASE_URL` ב־.env, וגם ה־JS מוסיף `preconnect` אוטומטית ברגע שמוגדר `supabaseUrl` ב־backend-config.
