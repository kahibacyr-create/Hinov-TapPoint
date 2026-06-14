import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share2, PlusSquare, Info, ChevronRight } from 'lucide-react';

export default function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // 1. Check if already running in standalone PWA mode
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isNavigatorStandalone = (navigator as any).standalone === true;
      if (isStandaloneMedia || isNavigatorStandalone) {
        setIsStandalone(true);
      }
    };

    checkStandalone();

    // 2. Detect if user is on iOS / Apple device
    const detectIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isApple = /iphone|ipad|ipod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      setIsIOS(isApple);
    };

    detectIOS();

    // 3. Listen for browser's native PWA install banner event (Chrome/Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    // 4. Listen for successful installation event
    const handleAppInstalled = () => {
      console.log('Présence QR Code: App installée avec succès !');
      setDeferredPrompt(null);
      setIsStandalone(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // If dismissed in previous sessions, respect user choice but let them see it if they manually trigger or on a clean refresh
    const dismissed = sessionStorage.getItem('pwa_banner_dismissed') === 'true';
    if (dismissed) {
      setIsVisible(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Trigger browser native installation dialog
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA Install Choice Outcome: ${outcome}`);
      setDeferredPrompt(null);
    } else {
      // Show custom visual guide for Safari / iOS or alternative browser
      setShowManualGuide(true);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  // If already running inside standalone app, don't show the setup helper
  if (isStandalone || !isVisible) {
    return null;
  }

  return (
    <div 
      id="pwa-install-banner" 
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:max-w-md bg-white/98 backdrop-blur-md border border-slate-200 rounded-2xl shadow-2xl p-4 sm:p-5 z-[999] flex flex-col gap-3 animate-fadeIn"
      style={{
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      }}
    >
      <div className="flex items-start gap-3.5">
        {/* Rounded Icon Backdrop */}
        <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl shrink-0">
          <Smartphone className="w-5 h-5" />
        </div>

        {/* Content Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-slate-900 tracking-tight font-sans">
              Installer l'Application
            </h4>
            <button 
              id="pwa-close-cross-btn"
              onClick={handleDismiss} 
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed mt-1 font-sans">
            Accédez à vos scans de présence et à l'affichage QR Kiosque instantanément en un clic depuis votre écran d'accueil !
          </p>
        </div>
      </div>

      {!showManualGuide ? (
        <div className="flex gap-2 justify-end mt-1">
          <button
            id="pwa-btn-close"
            type="button"
            onClick={handleDismiss}
            className="py-2 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Plus tard
          </button>
          <button
            id="pwa-btn-install"
            type="button"
            onClick={handleInstallClick}
            className="flex items-center justify-center gap-1.5 py-2 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer transition active:scale-[0.98]"
          >
            <Download className="w-4 h-4" /> {deferredPrompt ? 'Installer' : "Mode d'emploi"}
          </button>
        </div>
      ) : (
        <div className="mt-2 bg-slate-50 rounded-xl p-3 border border-slate-100 animate-fadeIn">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-2">
            <Info className="w-4 h-4 text-blue-500 shrink-0" />
            <span>Guide d'installation rapide :</span>
          </div>

          {isIOS ? (
            /* iOS / iPhone instructions */
            <div className="space-y-2 text-xs text-slate-600 font-sans">
              <div className="flex gap-2 items-start">
                <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</span>
                <p>
                  Ouvrez ce portail dans le navigateur <strong className="text-slate-800">Safari</strong> de votre iPhone/iPad.
                </p>
              </div>
              <div className="flex gap-2 items-start">
                <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</span>
                <p className="flex items-center gap-1 flex-wrap">
                  Appuyez sur le bouton de Partage <Share2 className="w-3.5 h-3.5 text-blue-500 inline" /> dans la barre de navigation.
                </p>
              </div>
              <div className="flex gap-2 items-start">
                <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">3</span>
                <p className="flex items-center gap-1 flex-wrap">
                  Défilez vers le bas et choisissez <strong className="text-slate-800 inline-flex items-center gap-1 bg-white px-1.5 py-0.5 rounded border border-slate-200">Sur l'écran d'accueil <PlusSquare className="w-3.5 h-3.5 ml-0.5 inline text-slate-700" /></strong>.
                </p>
              </div>
            </div>
          ) : (
            /* Android/Other browsers alternative menu navigation guide */
            <div className="space-y-2 text-xs text-slate-600 font-sans">
              <div className="flex gap-2 items-start">
                <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</span>
                <p>
                  Ouvrez le menu de votre navigateur (les trois points <strong className="text-slate-800">⁝</strong> ou paramètres en haut/bas).
                </p>
              </div>
              <div className="flex gap-2 items-start">
                <span className="bg-blue-100 text-blue-700 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</span>
                <p>
                  Sélectionnez l'option <strong className="text-slate-800">"Installer l'application"</strong> ou <strong className="text-slate-800">"Ajouter à l'écran d'accueil"</strong>.
                </p>
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end mt-4 pt-1 border-t border-slate-150">
            <button
              type="button"
              onClick={() => setShowManualGuide(false)}
              className="text-[11px] text-slate-500 hover:text-slate-800 font-semibold"
            >
              Retour
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] py-1 px-3 rounded-lg"
            >
              J'ai compris
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
