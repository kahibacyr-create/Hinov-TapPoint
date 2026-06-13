import { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import { LogIn, Key, HelpCircle, Shield, User, Smartphone } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (token: string, user: any) => void;
  onEnterStationKiosk: () => void;
}

export default function Login({ onLoginSuccess, onEnterStationKiosk }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stationCode, setStationCode] = useState('');
  const [mode, setMode] = useState<'login' | 'kiosk'>('login');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // First connection force password change states
  const [forceResetSession, setForceResetSession] = useState<{ token: string, user: any } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);

  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Identifiants invalides');
      }
      
      // If the user is flagged with first-connection password change requirement
      if (data.must_change_password) {
        setForceResetSession({ token: data.token, user: data.user });
        return;
      }

      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForceResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setResetError(null);

    if (newPassword.trim().length < 4) {
      setResetError("Le mot de passe doit faire au moins 4 caractères.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setResetError("Les mots de passe ne correspondent pas.");
      return;
    }

    setResetLoading(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${forceResetSession?.token}`
        },
        body: JSON.stringify({ password: newPassword })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Échec de l'enregistrement du mot de passe.");
      }

      // Success! Log the user in fully with updated safe data
      onLoginSuccess(forceResetSession!.token, data.user);
    } catch (err: any) {
      setResetError(err.message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleKioskSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch('/api/stations/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: stationCode })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Code invalide ou expiré');
      }
      // Save station details in local storage for the kiosk mode
      localStorage.setItem('kiosk_station', JSON.stringify(data.station));
      localStorage.setItem('kiosk_token_access', data.token_access);
      onEnterStationKiosk();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="login-container" className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div id="login-header-group" className="sm:mx-auto sm:w-full sm:max-w-md">
        <center>
          <motion.img 
            id="logo-brand-img"
            src="https://res.cloudinary.com/dzthrix45/image/upload/q_auto/f_auto/v1781278377/1781276285421_qvyann.png"
            alt="Application Logo"
            className="w-32 h-32 object-contain mb-6"
            animate={{ scale: [1, 1.15, 1] }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            referrerPolicy="no-referrer"
          />
        </center>
      </div>

      <div id="login-card-holder" className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div id="login-card" className="bg-white py-8 px-4 shadow-sm border border-slate-100 rounded-2xl sm:px-10">
                   {/* Mode Tabs */}
          {!forceResetSession && (
            <div id="login-tabs" className="flex rounded-lg bg-slate-100 p-1 mb-8" role="tablist">
              <button
                id="tab-login"
                onClick={() => { setMode('login'); setError(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                  mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <User className="w-4 h-4" /> Portails Utilisateurs
              </button>
              <button
                id="tab-kiosk"
                onClick={() => { setMode('kiosk'); setError(null); }}
                className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all ${
                  mode === 'kiosk' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Smartphone className="w-4 h-4" /> Station QR Kiosque
              </button>
            </div>
          )}

          {error && !forceResetSession && (
            <div id="login-error-alert" className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          {forceResetSession ? (
            <form onSubmit={handleForceResetSubmit} className="space-y-6">
              <div className="text-center pb-2">
                <h3 className="font-bold text-slate-900 text-sm tracking-tight uppercase text-blue-600">Sécurité du Compte</h3>
                <h4 className="font-black text-slate-900 text-lg leading-tight mt-1">Première Connexion</h4>
                <p className="text-xs text-slate-500 mt-1.5 leading-normal">
                  Changement de mot de passe obligatoire. Définissez votre mot de passe pour finaliser l'activation de votre espace.
                </p>
              </div>

              {resetError && (
                <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-xl text-xs text-rose-850">
                  {resetError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-550 mb-1">
                  Nouveau mot de passe
                </label>
                <input
                  type={showPass ? "text" : "password"}
                  required
                  value={newPassword}
                  disabled={resetLoading}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Saisissez un mot de passe sécurisé"
                  className="block w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-550 mb-1">
                  Confirmer le mot de passe
                </label>
                <input
                  type={showPass ? "text" : "password"}
                  required
                  value={confirmNewPassword}
                  disabled={resetLoading}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Rentrez à nouveau le mot de passe"
                  className="block w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-sm"
                />
              </div>

              <div className="flex items-center">
                <input
                  id="show-pass-checkbox"
                  type="checkbox"
                  checked={showPass}
                  onChange={() => setShowPass(!showPass)}
                  className="h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="show-pass-checkbox" className="ml-2 block text-xs text-slate-600 select-none cursor-pointer font-medium">
                  Afficher les caractères
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setForceResetSession(null);
                    setNewPassword('');
                    setConfirmNewPassword('');
                    setResetError(null);
                  }}
                  className="flex-1 py-3 px-4 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold tracking-wider uppercase rounded-xl transition cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={resetLoading}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold tracking-wider uppercase rounded-xl transition disabled:opacity-50 cursor-pointer shadow-md shadow-blue-105"
                >
                  {resetLoading ? 'Enregistrement...' : 'Valider'}
                </button>
              </div>
            </form>
          ) : mode === 'login' ? (
            <form id="employee-login-form" onSubmit={handleLoginSubmit} className="space-y-6">
              <div>
                <label id="lbl-email" htmlFor="email-input" className="block text-sm font-medium text-slate-700">
                  Adresse email
                </label>
                <div className="mt-1">
                  <input
                    id="email-input"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre.email@entreprise.com"
                    className="block w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all sm:text-sm"
                  />
                </div>
              </div>

              <div>
                <label id="lbl-password" htmlFor="password-input" className="block text-sm font-medium text-slate-700">
                  Mot de passe
                </label>
                <div className="mt-1">
                  <input
                    id="password-input"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all sm:text-sm"
                  />
                </div>
              </div>

              <button
                id="btn-login-submit"
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-200"
              >
                {loading ? 'Connexion...' : 'Se connecter'}
                <LogIn className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form id="kiosk-code-form" onSubmit={handleKioskSubmit} className="space-y-6">
              <div id="kiosk-instructions">
                <p className="text-sm text-slate-600 mb-4 text-center">
                  Entrez le code à 6 chiffres généré depuis le tableau de bord Administrateur pour configurer la tablette Kiosque QR.
                </p>
              </div>

              <div>
                <label id="lbl-code" htmlFor="code-input" className="block text-sm font-medium text-slate-700 text-center">
                  Code d'accès Station
                </label>
                <div id="kiosk-input-container" className="mt-2 flex justify-center">
                  <input
                    id="code-input"
                    name="stationCode"
                    type="text"
                    maxLength={6}
                    required
                    value={stationCode}
                    onChange={(e) => setStationCode(e.target.value)}
                    placeholder="123456"
                    className="block w-48 text-center text-2xl tracking-widest font-mono px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-950 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <button
                id="btn-kiosk-submit"
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200"
              >
                {loading ? 'Lancement...' : 'Activer la Station'}
                <Key className="w-4 h-4" />
              </button>
            </form>
          )}

        </div>
      </div>
    </div>
  );
}
