// assets/backend-config.js
// ברירת מחדל: מצב ללא Backend (נרות + מילים נשמרים מקומית בלבד).
// כדי להפעיל שיתוף לכולם דרך Supabase:
// 1) צרו פרויקט ב-Supabase
// 2) מלאו את supabaseUrl ואת supabaseAnonKey למטה
// 3) ודאו שה- SQL ב-SETUP_SUPABASE.md רץ
//
// לאחר מכן, החליפו provider ל-"supabase".

window.BACKEND = {
  provider: "disabled",
  supabaseUrl: "",
  supabaseAnonKey: ""
};
