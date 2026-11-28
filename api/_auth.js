// Shared helper (not a route): confirms the caller is signed-in, active CRM staff.
export const SUPABASE_URL = 'https://ktsvmkfrrxuijmgjdbwr.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_E-C0YA_K3UpDWbbWqS9Lng__7pR26p9';

// Returns null when the caller is staff; otherwise sends an error response and returns true.
export async function denyUnlessStaff(req, res) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) { res.status(401).json({ error: 'Sign in first.' }); return true; }
  try {
    const u = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` } });
    if (!u.ok) { res.status(401).json({ error: 'Your session has expired. Sign in again.' }); return true; }
    const s = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_staff`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' });
    if (!s.ok || (await s.json()) !== true) { res.status(403).json({ error: 'Only staff can do this.' }); return true; }
  } catch (err) {
    console.error('Auth check failed', err);
    res.status(502).json({ error: 'Could not check your sign-in. Try again.' }); return true;
  }
  return null;
}
