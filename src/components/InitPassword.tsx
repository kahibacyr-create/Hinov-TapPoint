import { useState, FormEvent } from 'react';
import { motion } from 'motion/react';
import { KeyRound, ShieldAlert, CheckCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';

interface InitPasswordProps {
  token: string;
  onSuccess: () => void;
}

export default function InitPassword({ token, onSuccess }: InitPasswordProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (password.trim().length < 4) {
      setError("Le mot de passe doit faire au moins 4 caractères.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/init-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Échec de l'initialisation du mot de passe.");
      }

      setSuccess("Mot de passe enregistré avec succès !");
      setTimeout(() => {
        onSuccess();
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="init-password-view" className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-100 text-blue-600 mb-6"
        >
          <KeyRound className="h-7 w-7" />
        </motion.div>
        
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">
          Initialisez votre Mot de passe
        </h2>
        <p className="mt-2 text-xs font-medium text-slate-500 max-w-sm mx-auto leading-normal">
          Bonjour ! Votre compte collaborateur a été créé. Veuillez définir un mot de passe d'accès pour finaliser l'activation.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl border border-slate-100 rounded-3xl sm:px-10">
          
          {error && (
            <div className="mb-5 bg-red-50 border border-red-200 text-xs text-red-700 p-4 rounded-xl flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 shrink-0 text-red-500" />
              <div>
                <span className="font-bold">Erreur :</span> {error}
              </div>
            </div>
          )}

          {success && (
            <div className="mb-5 bg-emerald-50 border border-emerald-250 text-xs text-emerald-800 p-4 rounded-xl flex items-start gap-2.5">
              <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
              <div className="space-y-1">
                <span className="font-bold">Succès :</span> {success}
                <p className="text-[10px] text-emerald-650 opacity-90">Redirection vers l'accueil dans un instant...</p>
              </div>
            </div>
          )}

          {!success && (
            <form onSubmit={handleSubmit} className="space-y-5">
              
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-505 mb-1.5">
                  Nouveau mot de passe
                </label>
                <div className="relative rounded-md shadow-xs">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    disabled={loading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Saisissez un mot de passe fort"
                    className="block w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-505 mb-1.5">
                  Confirmer le mot de passe
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  disabled={loading}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirmez le mot de passe"
                  className="block w-full px-4 py-2.5 border border-slate-200 rounded-xl text-slate-950 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-[10px] text-slate-500 leading-normal">
                ⭐ <strong>Conseil :</strong> Choisissez un mot de passe mémorable contenant des lettres, chiffres ou symboles.
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center items-center gap-2 py-3 px-4 border border-transparent rounded-xl text-xs font-bold tracking-wider uppercase text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all cursor-pointer shadow-md shadow-blue-200"
              >
                {loading ? 'Activation du compte...' : 'Activer mon compte'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {success && (
            <button
              onClick={onSuccess}
              className="w-full block text-center py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Retour à la Connexion maintenant
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
