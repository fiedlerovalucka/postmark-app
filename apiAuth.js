import { createClient } from '@supabase/supabase-js';

// A server-side Supabase client that can verify the user's access token
// and is also used with the service behavior of respecting RLS as that user.
export function supabaseForRequest(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } }
    }
  );
}

export async function getUserAndProfile(req) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return { error: 'Not signed in' };

  const client = supabaseForRequest(token);
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData?.user) return { error: 'Invalid session' };

  const user = userData.user;
  let { data: profile } = await client
    .from('profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    profile = { voice: '', style_rules: '', name: '', about_me: '', portfolio_link: '' };
  }

  return { client, user, profile };
}
