/**
 * Run as soon as possible on index.html: if user has a session, redirect to dashboard.
 * Supabase persists session in localStorage by default, so this restores "stay logged in".
 */
import './supabaseClient.js';

async function checkSession() {
  const supabase = window.supabaseClient;
  if (!supabase) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    console.log('Session found, redirecting...');
    window.location.href = 'dashboard.html';
  }
}

checkSession();
