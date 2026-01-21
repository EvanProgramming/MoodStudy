import { CONFIG } from './config.js';

// Supabase SDK is loaded via CDN and exposes `window.supabase`
if (!window.supabase || typeof window.supabase.createClient !== 'function') {
  console.error('Supabase SDK not found. Did the CDN script load?');
} else {
  const url = String(CONFIG?.SUPABASE_URL || '').trim();
  const key = String(CONFIG?.SUPABASE_KEY || '').trim();

  if (!url || !key || url === 'YOUR_SUPABASE_URL_HERE' || key === 'YOUR_NEW_SUPABASE_ANON_KEY_HERE') {
    console.error('Supabase is not configured. Fill in SUPABASE_URL and SUPABASE_KEY in config.js.');
    window.supabaseClient = null;
  } else {
    window.supabaseClient = window.supabase.createClient(url, key);
  }
}

