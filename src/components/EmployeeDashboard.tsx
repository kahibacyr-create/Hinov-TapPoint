import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Html5Qrcode } from 'html5-qrcode';
import { 
  Camera, History, LogOut, CheckCircle, Clock, X, Info, HelpCircle, 
  Upload, Link as LinkIcon, Image as ImageIcon, Check, Edit2, Loader2,
  Eye, EyeOff, Lock
} from 'lucide-react';
import { User, Presence, Station } from '../types';

interface EmployeeDashboardProps {
  user: User;
  onLogout: () => void;
  onUserUpdate?: (user: User) => void;
}

const PRESET_AVATARS = [
  { url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop', label: 'Féminin Professionnel' },
  { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop', label: 'Masculin Professionnel' },
  { url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop', label: 'Féminin Casual' },
  { url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop', label: 'Masculin Casual' },
  { url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop', label: 'Féminin Neutre' },
  { url: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop', label: 'Masculin Élégant' },
  { url: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&h=150&fit=crop', label: 'Féminin Tech' },
  { url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&h=150&fit=crop', label: 'Masculin Moderne' },
];

export default function EmployeeDashboard({ user, onLogout, onUserUpdate }: EmployeeDashboardProps) {
  const [presences, setPresences] = useState<Presence[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  
  const [showScanner, setShowScanner] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Profile and Password modification state
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newPrenom, setNewPrenom] = useState(user.prenom || '');
  const [newNom, setNewNom] = useState(user.nom || '');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState(user.photo_url || '');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Sync state if user prop changes
  useEffect(() => {
    if (user.photo_url) setNewPhotoUrl(user.photo_url);
    if (user.prenom) setNewPrenom(user.prenom);
    if (user.nom) setNewNom(user.nom);
  }, [user.photo_url, user.prenom, user.nom]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      setProfileError("Veuillez sélectionner un fichier image valide (PNG, JPG, etc.).");
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      setProfileError("L'image est trop volumineuse (maximum 5 Mo).");
      return;
    }

    setUploadingPhoto(true);
    setProfileError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const imgElement = document.createElement('img');
      imgElement.src = event.target?.result as string;

      imgElement.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 250;
        const MAX_HEIGHT = 250;
        let width = imgElement.width;
        let height = imgElement.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(imgElement, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          setNewPhotoUrl(dataUrl);
        } else {
          setNewPhotoUrl(event.target?.result as string);
        }
        setUploadingPhoto(false);
      };

      imgElement.onerror = () => {
        setProfileError("Impossible de charger l'image sélectionnée.");
        setUploadingPhoto(false);
      };
    };

    reader.onerror = () => {
      setProfileError("Erreur lors de la lecture du fichier.");
      setUploadingPhoto(false);
    };

    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    if (!newPrenom.trim()) {
      setProfileError("Le prénom est obligatoire.");
      return;
    }
    if (!newNom.trim()) {
      setProfileError("Le nom est obligatoire.");
      return;
    }
    if (!newPhotoUrl) {
      setProfileError("Veuillez sélectionner ou de saisir une URL d'image.");
      return;
    }

    setSavingProfile(true);
    setProfileError(null);

    try {
      let finalPhotoUrl = newPhotoUrl;
      if (newPhotoUrl.startsWith('data:image/')) {
        try {
          const cloudRes = await fetch('/api/cloudinary/upload', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ image: newPhotoUrl })
          });
          if (cloudRes.ok) {
            const cloudData = await cloudRes.json();
            if (cloudData.url) {
              finalPhotoUrl = cloudData.url;
            }
          }
        } catch (e) {
          console.warn("Cloudinary upload failed, falling back to base64", e);
        }
      }

      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          prenom: newPrenom,
          nom: newNom,
          photo_url: finalPhotoUrl,
          password: newPassword ? newPassword : undefined
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Une erreur est survenue lors de la mise à jour.");
      }

      if (onUserUpdate) {
        onUserUpdate(data.user);
      }
      
      setSuccessMsg("Votre profil a été mis à jour avec succès !");
      setNewPassword(''); // Reset password input
      setShowProfileModal(false);
    } catch (err: any) {
      setProfileError(err.message || "Erreur de connexion.");
    } finally {
      setSavingProfile(false);
    }
  };

  // Fetch employee specific logs and stations list
  const fetchMyLogs = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` };
      
      const [resLogs, resStations] = await Promise.all([
        fetch('/api/presences', { headers }),
        fetch('/api/stations', { headers })
      ]);
      
      if (resLogs.ok) {
        const list = await resLogs.ok ? await resLogs.json() : [];
        setPresences(list.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      }
      
      if (resStations.ok) {
        const sList = await resStations.json();
        setStations(sList);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg("Impossible de récupérer vos informations de pointage.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyLogs();
  }, []);

  // Initialize Camera Scanning via Html5Qrcode (back camera automatically)
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let isMounted = true;
    
    if (showScanner) {
      setCameraError(null);
      // Wait for div "reader" to mount fully
      const timer = setTimeout(() => {
        if (!isMounted) return;
        try {
          html5QrCode = new Html5Qrcode("reader");
          
          html5QrCode.start(
            { facingMode: "environment" }, 
            { fps: 15, qrbox: { width: 250, height: 250 } }, 
            async (decodedText) => {
              console.log("Decoded QR:", decodedText);
              if (html5QrCode) {
                try {
                  await html5QrCode.stop();
                } catch (e) {
                  console.warn("Error stopping scanner:", e);
                }
              }
              setShowScanner(false);
              handleProcessScannedQr(decodedText);
            },
            (error) => {
              // Quiet callback for non-critical decode errors
            }
          ).catch((err) => {
            console.error("Camera startup failed async:", err);
            if (isMounted) {
              setCameraError(
                "L'accès caméra a été bloqué par votre navigateur ou l'environnement bac à sable (Iframe). Utilisez le panneau d'émulation ci-dessous pour tester !"
              );
            }
          });
        } catch (err: any) {
          console.error("Camera startup failed:", err);
          if (isMounted) {
            setCameraError(
              "L'accès caméra a été bloqué par votre navigateur ou l'environnement bac à sable (Iframe). Utilisez le panneau d'émulation ci-dessous pour tester !"
            );
          }
        }
      }, 300);

      return () => {
        clearTimeout(timer);
        isMounted = false;
        if (html5QrCode) {
          try {
            if (html5QrCode.isScanning) {
              html5QrCode.stop().catch(e => console.warn("Clean-up warning:", e));
            }
          } catch (e) {
            console.warn("Cleanup checks exception:", e);
          }
        }
      };
    }
  }, [showScanner]);

  // Decode the scanned QR Code payload (Usually JSON format)
  const handleProcessScannedQr = async (text: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      // Parse QR contents
      let payload: { station_id?: string; token?: string } = {};
      try {
        payload = JSON.parse(text);
      } catch (err) {
        throw new Error("Format du QR Code incorrect ou illisible.");
      }

      if (!payload.station_id || !payload.token) {
        throw new Error("Contenu du QR Code incomplet ou expiré.");
      }

      const res = await fetch('/api/presences/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          station_id: payload.station_id,
          token: payload.token
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Échec de l'enregistrement de présence");
      }

      setSuccessMsg(data.message);
      fetchMyLogs(); // Refresh employee's individual history logs
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helpers to count total entries
  const entryCount = presences.filter(p => p.type === 'entry').length;
  const exitCount = presences.filter(p => p.type === 'exit').length;

  const lastPresence = presences[0];
  const isNextEntry = !lastPresence || lastPresence.type === 'exit';

  return (
    <div id="employee-root" className="min-h-screen bg-slate-50 flex flex-col font-sans">
      
      {/* NO SIDEBAR AS REQUESTED : Clean, responsive top bar */}
      <nav id="employee-navbar" className="bg-white border-b border-slate-200 px-3 sm:px-6 py-3 sm:py-4 shadow-sm">
        <div className="max-w-4xl mx-auto flex justify-between items-center gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <img 
              id="employee-logo-brand"
              src="https://res.cloudinary.com/dzthrix45/image/upload/q_auto/f_auto/v1781278377/1781276285421_qvyann.png"
              alt="Logo"
              className="w-8 h-8 sm:w-9 sm:h-9 object-contain"
              referrerPolicy="no-referrer"
            />
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-xs sm:text-sm md:text-base block">Espace Collaborateur</span>
              <span className="text-[9px] sm:text-[10px] text-blue-600 font-extrabold uppercase tracking-wider block">HINOV TapPoinT</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              id="employee-profile-navbar-btn"
              onClick={() => {
                setNewPhotoUrl(user.photo_url || '');
                setNewPrenom(user.prenom || '');
                setNewNom(user.nom || '');
                setProfileError(null);
                setShowProfileModal(true);
              }}
              className="flex items-center gap-1.5 sm:gap-2 py-1.5 sm:py-2 px-2.5 sm:px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl transition cursor-pointer"
              title="Modifier mon profil & mot de passe"
            >
              <img 
                src={user.photo_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop"} 
                alt="Avatar" 
                className="w-4 h-4 rounded-md object-cover"
                referrerPolicy="no-referrer"
              />
              <span className="hidden md:inline font-sans">Mon Profil & Mot de Passe</span>
              <span className="hidden sm:inline md:hidden font-sans">Profil & MDP</span>
              <span className="sm:hidden font-sans">Profil</span>
            </button>

            <button
              id="employee-logout-btn"
              onClick={onLogout}
              className="flex items-center gap-1.5 sm:gap-2 py-1.5 sm:py-2 px-2.5 sm:px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline font-sans">Se déconnecter</span>
            </button>
          </div>
        </div>
      </nav>

      {/* CORE WRAPPER SCREEN */}
      <main id="employee-main-panel" className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-5 lg:p-8 space-y-5 sm:space-y-8">
        
        {/* COLLABORATOR PROFILE HEADER CARD */}
        <div id="employee-card-profile" className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-5 sm:gap-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative group shrink-0">
              <img 
                id="emp-profile-pic"
                src={user.photo_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop"} 
                alt="Avatar" 
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover ring-4 ring-slate-50 shadow-md transition group-hover:brightness-90"
                referrerPolicy="no-referrer"
              />
              <button
                id="btn-trigger-edit-photo"
                onClick={() => {
                  setNewPhotoUrl(user.photo_url || '');
                  setNewPrenom(user.prenom || '');
                  setNewNom(user.nom || '');
                  setProfileError(null);
                  setShowProfileModal(true);
                }}
                className="absolute -bottom-1 -right-1 p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-md transition cursor-pointer"
                title="Modifier le profil & mot de passe"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="min-w-0">
              <h2 id="emp-profile-name" className="text-lg sm:text-xl font-bold text-slate-900 truncate font-sans">{user.prenom} {user.nom}</h2>
              <div id="emp-profile-meta" className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-xs text-slate-500">
                <span className="font-bold font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10.5px] sm:text-xs">
                  Matricule : {user.matricule}
                </span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <span className="text-slate-600 break-all text-[11px] sm:text-xs font-medium">{user.email}</span>
                <span className="hidden sm:inline text-slate-300">•</span>
                <button
                  id="link-btn-trigger-edit-photo"
                  type="button"
                  onClick={() => {
                    setNewPhotoUrl(user.photo_url || '');
                    setNewPrenom(user.prenom || '');
                    setNewNom(user.nom || '');
                    setProfileError(null);
                    setShowProfileModal(true);
                  }}
                  className="text-emerald-600 hover:text-emerald-700 font-bold hover:underline cursor-pointer flex items-center gap-1 text-[11px] sm:text-xs mt-0.5 sm:mt-0"
                >
                  <Edit2 className="w-3 h-3" /> Modifier profil & mot de passe
                </button>
              </div>
            </div>
          </div>

          {/* Core Daily totals stats info */}
          <div id="employee-stats-capsules" className="flex gap-3 sm:gap-4 w-full sm:w-auto shrink-0">
            <div className="bg-emerald-50/50 border border-emerald-100 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-center flex-1 sm:flex-none sm:min-w-[100px]">
              <span className="text-lg sm:text-xl font-extrabold text-emerald-800 block">{entryCount}</span>
              <span className="text-[9.5px] sm:text-[10px] text-emerald-600 font-bold uppercase tracking-wider block">Arrivées</span>
            </div>
            <div className="bg-amber-50/50 border border-amber-100 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-center flex-1 sm:flex-none sm:min-w-[100px]">
              <span className="text-lg sm:text-xl font-extrabold text-amber-800 block">{exitCount}</span>
              <span className="text-[9.5px] sm:text-[10px] text-amber-600 font-bold uppercase tracking-wider block">Départs</span>
            </div>
          </div>
        </div>

        {/* ALERTS FEEDBACK */}
        {(errorMsg || successMsg) && (
          <div id="employee-feedback-strip" className="animate-fadeIn">
            {errorMsg && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl text-xs sm:text-sm text-red-700 font-semibold flex justify-between items-center shadow-xs">
                <div>⚠️ {errorMsg}</div>
                <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-800"><X className="w-4 h-4" /></button>
              </div>
            )}
            {successMsg && (
              <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-xl text-xs sm:text-sm text-emerald-800 font-semibold flex justify-between items-center shadow-xs">
                <div>🎉 {successMsg}</div>
                <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-800"><X className="w-4 h-4" /></button>
              </div>
            )}
          </div>
        )}

        {/* PRIMARY LAUNCH POINT ACTIONS */}
        <div id="employee-pioneer-cards" className="w-full">
          
          {/* CAMERA QR SCAN ACTION CARD */}
          <div id="scan-interaction-card" className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8 shadow-sm flex flex-col justify-center items-center w-full min-h-[150px] sm:min-h-[180px]">
            <button
              id="btn-employee-launch-scan"
              onClick={() => { setShowScanner(true); setErrorMsg(null); setSuccessMsg(null); }}
              className={`w-full max-w-sm flex items-center justify-center gap-3 py-4 sm:py-6 px-6 sm:px-8 text-white font-extrabold text-sm sm:text-base uppercase tracking-wider rounded-2xl transition cursor-pointer shadow-md active:scale-[0.98] outline-none focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isNextEntry 
                  ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-250 focus:ring-emerald-500' 
                  : 'bg-red-600 hover:bg-red-700 shadow-rose-250 focus:ring-red-500'
              }`}
            >
              <Camera className="w-5 h-5 sm:w-5.5 sm:h-5.5 animate-pulse" />
              {isNextEntry ? 'Pointez Arrivée' : 'Pointez Départ'}
            </button>
          </div>

        </div>

        {/* INDIVIDUAL HISTORY LOG LIST */}
        <div id="employee-history-card" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6">
          <h3 className="text-base font-bold text-slate-900 pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" /> Historique Personnel de Pointage
          </h3>

          <div className="mt-2.5">
            {presences.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-sans text-xs">
                Aucun passage enregistré pour le moment. Réalisez votre premier pointage !
              </div>
            ) : (
              <>
                {/* Desktop and Tablet full structural table layout */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="min-w-full text-left divide-y divide-slate-100 text-xs text-slate-700">
                    <thead>
                      <tr className="bg-slate-50 font-bold uppercase tracking-wider text-[10.5px] text-slate-500">
                        <th className="px-4 py-3">Borne Station</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Heure précise</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-sans font-medium">
                      {presences.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-semibold text-slate-800">{p.station_nom}</td>
                          <td className="px-4 py-3 font-sans">
                            <span className={`inline-block font-bold px-2 py-0.5 rounded text-[10px] ${
                              p.type === 'entry' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'
                            }`}>
                              {p.type === 'entry' ? 'ENTRÉE' : 'SORTIE'}
                            </span>
                            {p.type === 'entry' && (
                              <span className={`ml-2 inline-block font-bold px-2 py-0.5 rounded text-[10px] ${
                                p.late ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'
                              }`}>
                                {p.late ? 'En retard' : 'À l\'heure'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-500 font-mono">{p.date}</td>
                          <td className="px-4 py-3 text-slate-900 font-semibold font-mono">{p.heure}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile visual card feed (Prevents overflow/truncation) */}
                <div className="sm:hidden space-y-3">
                  {presences.map((p) => (
                    <div 
                      key={p.id} 
                      className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 flex flex-col gap-2 hover:bg-slate-100/70 transition animate-fadeIn"
                    >
                      <div className="flex justify-between items-start gap-4">
                        <span className="font-bold text-slate-800 text-xs truncate max-w-[170px]">{p.station_nom}</span>
                        <div id={`mobile-presence-type-${p.id}`} className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`inline-block font-bold px-2 py-0.5 rounded text-[9px] tracking-wider ${
                            p.type === 'entry' ? 'bg-emerald-100 text-emerald-900' : 'bg-amber-100 text-amber-900'
                          }`}>
                            {p.type === 'entry' ? 'ENTRÉE' : 'SORTIE'}
                          </span>
                          {p.type === 'entry' && (
                            <span className={`inline-block font-bold px-1.5 py-0.5 rounded text-[8px] uppercase ${
                              p.late ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {p.late ? 'En retard' : 'À l\'heure'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-[10.5px] text-slate-500 font-mono pt-2 border-t border-slate-150">
                        <span className="flex items-center gap-1">📅 {p.date}</span>
                        <span className="font-semibold text-slate-800 bg-white border border-slate-200 rounded px-1.5 py-0.5 shadow-2xs">⏰ {p.heure}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

      </main>

      {/* FULLSCREEN CAMERA QR CONTROLLER DIALOG OVERLAY */}
      <AnimatePresence>
        {showScanner && (
          <motion.div
            id="scanner-camera-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <div className="bg-white w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl relative">
              <div className="bg-slate-950 text-white px-6 py-4 flex justify-between items-center">
                <div>
                  <h4 className="font-bold text-sm">📷 Scanner Caméra QR Code</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">Viser la Station de Pointage Kiosque</p>
                </div>
                <button
                  id="btn-close-scanner"
                  onClick={() => setShowScanner(false)}
                  className="text-slate-400 hover:text-white cursor-pointer p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 flex flex-col items-center">
                {cameraError ? (
                  <div id="camera-restrict-alert" className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-xl text-xs leading-relaxed space-y-2 text-center">
                    <p>{cameraError}</p>
                    <p className="font-bold pt-2 border-t border-amber-100 text-[11px]">
                      Pour utiliser la caméra dans cet environnement de développement, veuillez autoriser l'accès ou ouvrir l'application dans un nouvel onglet.
                    </p>
                  </div>
                ) : (
                  <div className="w-full flex flex-col items-center">
                    <div id="reader" className="w-full bg-slate-50 rounded-xl overflow-hidden border border-slate-200 max-w-sm"></div>
                    <p className="text-[11px] text-slate-400 mt-4 text-center">
                      Présentez le code QR dynamique affiché sur la tablette Kiosque pour déclencher le pointage d'arrivée ou de départ.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {showProfileModal && (
          <motion.div
            id="profile-settings-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/85 backdrop-blur-sm z-50 flex items-center justify-center p-0 xs:p-4 overflow-hidden"
          >
            <div className="bg-white w-full max-w-lg h-full sm:h-auto sm:max-h-[90vh] flex flex-col rounded-none xs:rounded-2xl overflow-hidden shadow-2xl relative animate-fadeIn">
              
              {/* Header */}
              <div className="bg-slate-900 text-white px-5 sm:px-6 py-3.5 sm:py-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-emerald-500" />
                  <div>
                    <h4 className="font-bold text-sm">Modifier mon Profil & Sécurité</h4>
                    <p className="text-[10px] text-slate-400 mt-0.5">Personnalisez votre compte et vos accès</p>
                  </div>
                </div>
                <button
                  id="btn-close-profile-modal"
                  onClick={() => setShowProfileModal(false)}
                  className="text-slate-400 hover:text-white cursor-pointer p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-4 sm:p-6 space-y-4 flex-1 overflow-y-auto">

                {/* Nom & Prénom */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Prénom</label>
                    <input
                      id="input-profile-prenom"
                      type="text"
                      value={newPrenom}
                      onChange={(e) => { setNewPrenom(e.target.value); setProfileError(null); }}
                      className="block w-full text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:bg-white outline-none font-medium font-sans"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Nom</label>
                    <input
                      id="input-profile-nom"
                      type="text"
                      value={newNom}
                      onChange={(e) => { setNewNom(e.target.value); setProfileError(null); }}
                      className="block w-full text-xs bg-slate-50 border border-slate-200 p-2.5 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:bg-white outline-none font-medium font-sans"
                    />
                  </div>
                </div>

                {/* Mot de passe */}
                <div className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100 space-y-3">
                  <div className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Sécurité & Mot de Passe</span>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Nouveau Mot de Passe</label>
                    <div className="relative">
                      <input
                        id="input-profile-password"
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); setProfileError(null); }}
                        placeholder="Laisser vide pour ne pas modifier"
                        className="block w-full text-xs bg-white border border-slate-200 pl-3 pr-10 py-2.5 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:bg-white outline-none font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                        title={showPassword ? "Masquer" : "Afficher"}
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1.5 leading-normal">
                      Laissez vide si vous ne souhaitez pas modifier. Le nouveau mot de passe sera exigé lors de vos prochaines connexions.
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div className="border-t border-slate-100 my-4 pt-4">
                  <span className="block text-[11px] font-bold uppercase text-slate-500 mb-2">Photo de profil</span>
                </div>
                
                {/* Visual Preview */}
                <div className="flex flex-col items-center justify-center bg-slate-50 p-4 rounded-xl border border-dashed border-slate-200">
                  <div className="relative">
                    <img 
                      id="img-edit-preview"
                      src={newPhotoUrl || "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&h=150&fit=crop"} 
                      alt="Aperçu du profil" 
                      className="w-20 h-20 rounded-2xl object-cover ring-4 ring-emerald-500 shadow-lg"
                      referrerPolicy="no-referrer"
                    />
                    {uploadingPhoto && (
                      <div className="absolute inset-0 bg-slate-950/60 rounded-2xl flex items-center justify-center text-white">
                        <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase mt-1 tracking-wider">Aperçu en direct</span>
                </div>

                {/* Tab Customizers */}
                <div className="space-y-4">
                  
                  {/* Option 1 - Local File Upload */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-emerald-600" /> Téléverser un fichier local
                    </label>
                    <div className="relative group border border-dashed border-slate-200 hover:border-emerald-500 rounded-xl transition bg-slate-100/50 hover:bg-slate-100 flex flex-col items-center justify-center p-4 text-center cursor-pointer">
                      <input 
                        id="input-file-photo-upload"
                        type="file" 
                        accept="image/*"
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <Upload className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 mb-1 transition" />
                      <span className="text-xs font-bold text-slate-700">Sélectionner ou Glisser une photo</span>
                    </div>
                  </div>

                  {/* Option 2 - Preset Selection */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 flex items-center gap-1.5 font-sans">
                      <ImageIcon className="w-3.5 h-3.5 text-emerald-600" /> Choisir parmi des illustrations
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-[110px] overflow-y-auto p-1.5 border border-slate-150 rounded-xl bg-slate-50">
                      {PRESET_AVATARS.map((avatar, idx) => {
                        const isSelected = newPhotoUrl === avatar.url;
                        return (
                          <button
                            key={idx}
                            id={`btn-preset-avatar-${idx}`}
                            type="button"
                            onClick={() => {
                              setNewPhotoUrl(avatar.url);
                              setProfileError(null);
                            }}
                            className={`relative aspect-square rounded-lg overflow-hidden border-2 transition hover:scale-105 cursor-pointer ${
                              isSelected ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-slate-200'
                            }`}
                            title={avatar.label}
                          >
                            <img 
                              src={avatar.url} 
                              alt={avatar.label} 
                              className="w-full h-full object-cover animate-fadeIn" 
                              referrerPolicy="no-referrer"
                            />
                            {isSelected && (
                              <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                                <div className="bg-emerald-600 text-white p-1 rounded-full shadow-md">
                                  <Check className="w-2 h-2" />
                                </div>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Option 3 - Direct HTTP Link URL */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1.5 flex items-center gap-1.5">
                      <LinkIcon className="w-3.5 h-3.5 text-emerald-600" /> Saisir l'adresse URL d'une image
                    </label>
                    <input 
                      id="input-url-photo"
                      type="url"
                      value={newPhotoUrl}
                      onChange={(e) => {
                        setNewPhotoUrl(e.target.value);
                        setProfileError(null);
                      }}
                      placeholder="https://images.unsplash.com/your-image.jpg"
                      className="block w-full text-xs bg-slate-50 border border-slate-200 p-2 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:bg-white outline-none"
                    />
                  </div>

                </div>

                {/* Inner Error banner */}
                {profileError && (
                  <div id="photo-error-display" className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 rounded-xl text-xs font-semibold">
                    ⚠️ {profileError}
                  </div>
                )}

              </div>

              {/* Actions Footer */}
              <div className="bg-slate-50 border-t border-slate-200 p-4 sm:px-6 sm:py-4 flex justify-end gap-2.5 shrink-0">
                <button
                  id="btn-cancel-edit-photo"
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="py-2 px-4 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                  disabled={savingProfile}
                >
                  Annuler
                </button>
                <button
                  id="btn-confirm-save-photo"
                  type="button"
                  onClick={handleSaveProfile}
                  className="py-2 px-5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
                  disabled={savingProfile || uploadingPhoto}
                >
                  {savingProfile ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Enregistrement...
                    </>
                  ) : (
                    "Valider et Sauvegarder"
                  )}
                </button>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
