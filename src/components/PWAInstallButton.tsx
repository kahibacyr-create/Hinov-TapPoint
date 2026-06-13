import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

export default function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // 1. Check if already installed / running in standalone mode
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isNavigatorStandalone = (navigator as any).standalone === true;
      if (isStandaloneMedia || isNavigatorStandalone) {
        setIsStandalone(true);
      }
    };

    checkStandalone();

    // 2. Listen for the browser's PWA install invite event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true); // show it when event triggers
    };

    // 3. Listen for successful installation event
    const handleAppInstalled = () => {
      console.log('Présence QR Code: Installation réussie avec succès !');
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Trigger prompt
    deferredPrompt.prompt();
    
    // Wait for the user confirmation response
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA Install Choice Outcome: ${outcome}`);
    
    // Clear prompt regardless of outcome (browser handles retry conditions)
    setDeferredPrompt(null);
  };

  // If already installed or already standalone desktop PWA, do not show
  if (isStandalone || !deferredPrompt || !isVisible) {
    return null;
  }

  return (
    <div 
      id="pwa-install-banner" 
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-sm bg-white/95 backdrop-blur-md border border-slate-250/90 rounded-2xl shadow-xl p-4 sm:p-5 z-100 flex items-start gap-4 animate-fadeIn"
      style={{
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Icon Capsule */}
      <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl shrink-0">
        <Smartphone className="w-5 h-5" />
      </div>

      {/* Main text content */}
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5 font-sans">
          Installer l'Application
        </h4>
        <p className="text-[11px] text-slate-500 leading-normal mt-1 font-sans">
          Accédez au code QR et à vos pointages en un clic depuis votre écran d'accueil sans navigateur !
        </p>
        <div className="flex gap-2 mt-3.5">
          <button
            id="pwa-btn-install"
            type="button"
            onClick={handleInstallClick}
            className="flex items-center justify-center gap-1.5 py-1.5 px-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-[11px] font-bold rounded-lg shadow-sm transition active:scale-[0.98] cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" /> Installer
          </button>
          <button
            id="pwa-btn-close"
            type="button"
            onClick={() => setIsVisible(false)}
            className="py-1.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-[11px] font-bold rounded-lg transition cursor-pointer"
          >
            Plus tard
          </button>
        </div>
      </div>

      {/* Extreme Right Close Button X */}
      <button 
        id="pwa-close-cross-btn"
        onClick={() => setIsVisible(false)} 
        className="text-slate-400 hover:text-slate-600 transition shrink-0 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
