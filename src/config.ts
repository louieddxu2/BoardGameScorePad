
// Preferred source: Vite env var.
// Fallback is kept for backward compatibility in local environments.
export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '646550209695-tfc6hm50qoao3nfc6sv0j1jbkvmhr9lt.apps.googleusercontent.com';

// Google Drive API Scope - drive.file 權限最小，只能存取 App 自己建立的檔案
export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/drive.file';
