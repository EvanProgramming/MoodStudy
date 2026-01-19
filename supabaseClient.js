// Supabase client initialization (fill these in)
const SUPABASE_URL = 'https://besxecezprqzwqynuuwj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Y0loo-Dv1TBSiIjC3HpRoQ_lMme8eca';

// Supabase SDK is loaded via CDN and exposes `window.supabase`
if (!window.supabase || typeof window.supabase.createClient !== 'function') {
  console.error('Supabase SDK not found. Did the CDN script load?');
} else {
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
}

