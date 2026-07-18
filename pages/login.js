import { useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) return setError(error.message);
      setCheckEmail(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) return setError(error.message);
      router.push('/dashboard');
    }
  }

  return (
    <>
      <div className="airmail-strip" />
      <div className="login-wrap">
        <div className="brand" style={{ marginBottom: 30 }}>
          <h1>Postmark</h1>
          <p>track every pitch like a package</p>
        </div>
        <div className="panel">
          <h2>{mode === 'signup' ? 'Create account' : 'Sign in'}</h2>
          {checkEmail ? (
            <p style={{ fontSize: 14 }}>Check your email for a confirmation link, then sign in.</p>
          ) : (
            <form onSubmit={handleSubmit}>
              <label>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
              <label>Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
              {error && <div className="msg-err">{error}</div>}
              <div className="row">
                <button className="btn" type="submit" disabled={loading}>
                  {loading ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); }}
                >
                  {mode === 'signup' ? 'Have an account? Sign in' : 'New here? Create account'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  );
}
