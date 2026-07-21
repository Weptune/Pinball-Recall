import React, { useState } from 'react';
import { LogIn, UserPlus, X, ShieldAlert, CheckCircle2, Lock, User } from 'lucide-react';
import { 
  isSupabaseConfigured, 
  isSecretKeyDetected,
  signInUser, 
  signUpUser 
} from '../utils/supabaseClient';
import { soundEngine } from '../utils/soundEngine';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (username: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [tab, setTab] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isConfigured = isSupabaseConfigured();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (tab === 'signin') {
        const user = await signInUser(username, password);
        if (user) {
          soundEngine.playSuccess();
          onSuccess(user.username);
          onClose();
        }
      } else {
        const user = await signUpUser(username, password);
        if (user) {
          soundEngine.playSuccess();
          setSuccessMsg("Account created! You are now logged in.");
          onSuccess(user.username);
          setTimeout(() => onClose(), 800);
        }
      }
    } catch (err: any) {
      soundEngine.playError();
      setErrorMsg(err.message || "Authentication failed. Please check credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="auth-modal-card">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
          <div>
            <h2 className="modal-title-header" style={{ border: 'none', padding: 0, margin: 0, fontSize: '1.25rem' }}>
              {tab === 'signin' ? 'Sign In to Account' : 'Create New Account'}
            </h2>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0.2rem 0 0 0' }}>
              Sync stats & compete on global cloud leaderboards
            </p>
          </div>
          <button type="button" onClick={onClose} className="auth-close-btn" aria-label="Close modal">
            <X style={{ width: '16px', height: '16px' }} />
          </button>
        </div>

        {!isConfigured ? (
          <div className="locked-feature-card" style={{ textAlign: 'left', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b', fontWeight: 700, marginBottom: '0.5rem' }}>
              <ShieldAlert style={{ width: '20px', height: '20px' }} />
              <span>Supabase Credentials Missing</span>
            </div>
            <p className="locked-desc" style={{ fontSize: '0.8rem', marginBottom: '0.85rem' }}>
              To enable cloud accounts and global leaderboards, add your Supabase credentials to <code>.env.local</code>:
            </p>
            <pre style={{
              background: '#090b12',
              padding: '0.65rem',
              borderRadius: '6px',
              fontSize: '0.725rem',
              color: '#38bdf8',
              overflowX: 'auto',
              border: '1px solid #252b3d'
            }}>
              VITE_SUPABASE_URL=https://your-app.supabase.co{"\n"}
              VITE_SUPABASE_ANON_KEY=your-anon-key
            </pre>
            <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.75rem' }}>
              The game continues to save high scores locally in Guest Mode!
            </p>
          </div>
        ) : isSecretKeyDetected() ? (
          <div className="locked-feature-card" style={{ textAlign: 'left', marginTop: '0.5rem', borderColor: '#ef4444' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', fontWeight: 700, marginBottom: '0.5rem' }}>
              <ShieldAlert style={{ width: '20px', height: '20px' }} />
              <span>Secret API Key Detected in .env.local</span>
            </div>
            <p className="locked-desc" style={{ fontSize: '0.825rem', color: '#f87171', marginBottom: '0.75rem' }}>
              Supabase blocks <code>sb_secret_...</code> service keys in browser applications for security.
            </p>
            <p className="locked-desc" style={{ fontSize: '0.8rem', marginBottom: '0.5rem' }}>
              Please copy your <strong>public <code>anon</code> key</strong> from Supabase Dashboard $\to$ Project Settings $\to$ API:
            </p>
            <pre style={{
              background: '#090b12',
              padding: '0.65rem',
              borderRadius: '6px',
              fontSize: '0.725rem',
              color: '#4ade80',
              overflowX: 'auto',
              border: '1px solid #252b3d'
            }}>
              VITE_SUPABASE_ANON_KEY=eyJhbGciOi... (or sb_anon_...)
            </pre>
          </div>
        ) : (
          <>
            {/* Segmented Tab Selector */}
            <div className="auth-segmented-control">
              <button
                type="button"
                onClick={() => { setTab('signin'); setErrorMsg(null); }}
                className={`auth-segment-btn ${tab === 'signin' ? 'active' : ''}`}
              >
                <LogIn style={{ width: '15px', height: '15px' }} />
                <span>Sign In</span>
              </button>
              <button
                type="button"
                onClick={() => { setTab('signup'); setErrorMsg(null); }}
                className={`auth-segment-btn ${tab === 'signup' ? 'active' : ''}`}
              >
                <UserPlus style={{ width: '15px', height: '15px' }} />
                <span>Create Account</span>
              </button>
            </div>

            {/* Notifications */}
            {errorMsg && (
              <div style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '0.8rem',
                margin: '0.4rem 0'
              }}>
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div style={{
                padding: '0.65rem 0.85rem',
                borderRadius: '8px',
                background: 'rgba(34, 197, 94, 0.15)',
                border: '1px solid rgba(34, 197, 94, 0.3)',
                color: '#4ade80',
                fontSize: '0.8rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                margin: '0.4rem 0'
              }}>
                <CheckCircle2 style={{ width: '16px', height: '16px' }} />
                {successMsg}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.9rem', marginTop: '0.4rem' }}>
              <div className="auth-field-group">
                <label className="auth-field-label">Username</label>
                <div className="auth-input-wrapper">
                  <User className="auth-input-icon" />
                  <input
                    type="text"
                    required
                    placeholder="PinballMaster"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="auth-input-control"
                  />
                </div>
              </div>

              <div className="auth-field-group">
                <label className="auth-field-label">Password</label>
                <div className="auth-input-wrapper">
                  <Lock className="auth-input-icon" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="auth-input-control"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="auth-submit-btn"
              >
                {tab === 'signin' ? <LogIn style={{ width: '16px', height: '16px' }} /> : <UserPlus style={{ width: '16px', height: '16px' }} />}
                <span>{loading ? 'Processing...' : (tab === 'signin' ? 'Sign In' : 'Create Account')}</span>
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
