import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Lock, RefreshCw, AlertTriangle, Monitor, Sparkles, CheckCircle2 
} from 'lucide-react';
import { Station } from '../types';

interface QRStationProps {
  stationIdFromRoute?: string;
  onExitKiosk: () => void;
}

export default function QRStation({ stationIdFromRoute, onExitKiosk }: QRStationProps) {
  const [station, setStation] = useState<Station | null>(null);
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(15);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Successful flash alert popup overlay
  const [latestCheckIn, setLatestCheckIn] = useState<{
    id: string;
    nom: string;
    prenom: string;
    photo_url: string;
    type: 'entry' | 'exit';
    heure: string;
  } | null>(null);

  // Read station details from localStorage or route props
  useEffect(() => {
    const initStation = async () => {
      setLoading(true);
      setErrorMsg(null);
      
      let targetId = stationIdFromRoute;
      let targetTokenAccess = localStorage.getItem('kiosk_token_access');

      if (!targetId) {
        // Fallback check in localstorage
        const stored = localStorage.getItem('kiosk_station');
        if (stored) {
          const parsed = JSON.parse(stored);
          targetId = parsed.id;
        }
      }

      if (!targetId) {
        setErrorMsg("Accès interdit: Station non configurée. Utilisez un Code d'Accès sur la page de connexion.");
        setLoading(false);
        return;
      }

      try {
        // Unauthenticated station verify / public details retrieve
        const res = await fetch(`/api/stations/public/${targetId}`);
        if (res.ok) {
          const found = await res.json();
          if (found && found.active) {
            setStation(found);
            fetchTokenForStation(targetId);
          } else {
            throw new Error("Station inactive ou inexistantes.");
          }
        } else {
          throw new Error("Impossible de joindre le serveur pour authentifier la station.");
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Erreur de chargement de la station");
      } finally {
        setLoading(false);
      }
    };

    initStation();
  }, [stationIdFromRoute]);

  // Fetch dynamic expiring tokens
  const fetchTokenForStation = async (id: string) => {
    try {
      const res = await fetch(`/api/stations/${id}/qr-token`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      const payloadString = JSON.stringify({
        station_id: id,
        token: data.token,
        timestamp: Math.floor(Date.now() / 1000)
      });
      
      setQrToken(payloadString);
      setCountdown(15); // Refresh interval to 15s
    } catch (err) {
      console.error("Error fetching token", err);
    }
  };

  // Timer countdown hook for dynamic token refresh
  useEffect(() => {
    if (!station) return;
    
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Trigger refresh
          fetchTokenForStation(station.id);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [station]);

  // REALTIME MONITORED CHECK-INS (SSE) FOR THIS SPECIFIC KIOSK STATION
  useEffect(() => {
    if (!station) return;

    console.log("Setting up station live arrival SSE monitoring listener...");
    const eventSource = new EventSource('/api/realtime');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'presence_added') {
          const p = data.payload;
          // Filter if scan is on this station
          if (p.station_id === station.id) {
            setLatestCheckIn({
              id: p.id,
              nom: p.user_nom,
              prenom: p.user_prenom,
              photo_url: p.user_photo_url,
              type: p.type,
              heure: p.heure
            });
            // Auto hide after 4 seconds
            setTimeout(() => {
              setLatestCheckIn(null);
            }, 4000);
          }
        }
      } catch (err) {
        console.error("SSE parsing err in station", err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [station]);

  if (loading) {
    return (
      <div id="kiosk-loading-screen" className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mb-4" />
        <p className="text-sm font-sans font-medium">Initialisation du Kiosque QR...</p>
      </div>
    );
  }

  // Security Lock Screen is displayed if access is violated
  if (errorMsg || !station) {
    return (
      <div id="kiosk-lock-screen" className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-6 text-center text-slate-300 font-sans">
        <div className="w-16 h-16 bg-red-950 rounded-2xl flex items-center justify-center border border-red-800 text-red-500 mb-6 shadow-xl shadow-red-950/40">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-white tracking-tight">Accès Station Verrouillé</h2>
        <p className="max-w-md text-sm text-slate-400 mt-2 leading-relaxed">
          {errorMsg || "Cette borne n'a pas été configurée avec un jeton d'accès ou code d'authentification valide."}
        </p>
        
        <div className="mt-8 flex gap-3">
          <button
            onClick={onExitKiosk}
            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-750 text-xs font-bold text-white rounded-xl transition cursor-pointer"
          >
            Quitter et Revenir
          </button>
        </div>
      </div>
    );
  }

  // Pure Kiosk Image code source
  // Standard free stable qr generator
  const qrImageSrc = qrToken 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(qrToken)}`
    : '';

  return (
    <div id="kiosk-fullscreen-layout" className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-between p-6 overflow-hidden relative font-sans select-none">
      
      {/* Background radial soft light gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(99,102,241,0.07)_0%,_transparent_60%)] pointer-events-none"></div>

      {/* TOP HEADER DETAILS */}
      <header id="kiosk-header" className="w-full max-w-lg flex justify-between items-center z-10 pt-4">
        <div className="flex items-center gap-3">
          <img 
            id="kiosk-logo-brand"
            src="https://res.cloudinary.com/dzthrix45/image/upload/q_auto/f_auto/v1781278377/1781276285421_qvyann.png"
            alt="Logo"
            className="w-10 h-10 object-contain"
            referrerPolicy="no-referrer"
          />
          <div>
            <h4 className="text-slate-200 font-bold text-sm tracking-tight leading-tight uppercase">{station.nom_station}</h4>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Prends place • Borne active</span>
          </div>
        </div>

        <button
          onClick={onExitKiosk}
          className="text-slate-500 hover:text-slate-300 text-xs font-bold tracking-tight bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg transition"
        >
          Sortir Kiosque
        </button>
      </header>

      {/* CORE QR DISPLAY BOX */}
      <div id="kiosk-body-core" className="flex flex-col items-center justify-center z-10 my-auto">
        
        <div className="bg-white p-6 rounded-3xl relative shadow-[0_0_50px_rgba(99,102,241,0.25)] border border-slate-800 flex items-center justify-center">
          
          <AnimatePresence mode="wait">
            {qrToken ? (
              <motion.img
                key={qrToken}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                src={qrImageSrc}
                alt="Station Temporary dynamic QR Token Code"
                className="w-64 h-64 sm:w-80 sm:h-80 block object-contain"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-64 h-64 sm:w-80 sm:h-80 bg-slate-150 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-slate-400 animate-spin" />
              </div>
            )}
          </AnimatePresence>

          {/* Core watermark inside QR for professional brand representation */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-1 rounded-xl border border-slate-200 shadow-md flex items-center justify-center">
            <img
              src="https://res.cloudinary.com/dzthrix45/image/upload/q_auto/f_auto/v1781278377/1781276285421_qvyann.png"
              alt="Brand watermark"
              className="w-7 h-7 object-contain"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>

        {/* TIMER PROGRESS LOADER BAR */}
        <div className="mt-8 flex flex-col items-center space-y-2">
          
          {/* Circular Countdown Progress Badge */}
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-full">
            <RefreshCw className="w-3.5 h-3.5 text-indigo-400 animate-spin duration-3000" />
            <span className="text-slate-300 text-xs font-semibold">
              Mise à jour automatique dans <strong className="font-mono text-indigo-400 font-bold">{countdown}s</strong>
            </span>
          </div>
          
          <p className="text-[11px] text-slate-500 font-medium max-w-xs text-center leading-normal pt-2">
            Ouvrez votre appareil photo ou votre espace employé, puis scannez ce QR code pour pointer.
          </p>
        </div>

      </div>

      {/* FOOTER CLOCK TICKER */}
      <footer id="kiosk-footer" className="w-full flex justify-center items-center z-10 pb-4">
        <div className="text-center">
          <div className="text-2xl font-mono tracking-widest font-bold text-white">
            {new Date().toLocaleTimeString()}
          </div>
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </div>
        </div>
      </footer>

      {/* SUCCESS FLASH OVERLAY popup ON SUCCESSFUL CHECK-IN (real-time notification) */}
      <AnimatePresence>
        {latestCheckIn && (
          <motion.div
            id="success-flash-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none"
          >
            
            <motion.div
              initial={{ scale: 0.9, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 15 }}
              className="flex flex-col items-center"
            >
              <div className="w-24 h-24 bg-emerald-600 rounded-3xl flex items-center justify-center text-white mb-6 shadow-2xl shadow-emerald-500/20 relative">
                <CheckCircle2 className="w-12 h-12" />
                <div className="absolute inset-0 bg-emerald-500 rounded-3xl animate-ping opacity-25"></div>
              </div>

              <span className={`px-4 py-1.5 rounded-full text-xs font-extrabold tracking-widest uppercase mb-4 shadow ${
                latestCheckIn.type === 'entry' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              }`}>
                {latestCheckIn.type === 'entry' ? 'ENTRÉE ENREGISTRÉE' : 'SORTIE ENREGISTRÉE'}
              </span>

              <h2 className="text-white text-3xl font-extrabold tracking-tight">
                {latestCheckIn.prenom} {latestCheckIn.nom}
              </h2>
              
              <div className="mt-4 flex items-center gap-2 bg-slate-900 border border-slate-800 py-2 px-4 rounded-xl text-slate-400 font-semibold text-xs font-mono">
                <span>🕒 Pointage validé à {latestCheckIn.heure}</span>
              </div>

              <img
                src={latestCheckIn.photo_url}
                alt="Scanned Employee"
                className="w-24 h-24 rounded-2xl object-cover ring-4 ring-slate-800 shadow-2xl mt-8"
                referrerPolicy="no-referrer"
              />

              <div className="mt-8 text-xs text-slate-500 font-bold flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> Bon travail • Retour au code QR dans quelques secondes
              </div>
              
            </motion.div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
