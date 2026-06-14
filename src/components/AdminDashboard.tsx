import { useState, useEffect, FormEvent, ChangeEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Calendar, Clock, Laptop, Play, Plus, Trash2, Edit2, 
  Search, Upload, LogOut, CheckCircle, Bell, RefreshCw, X, ShieldAlert, KeyRound, Download, ArrowRight, Menu, QrCode,
  Eye, EyeOff, Lock, Copy, Check
} from 'lucide-react';
import { User, Presence, Station, AccessCode } from '../types';

interface AdminDashboardProps {
  user: User;
  onLogout: () => void;
  onUserUpdate?: (user: User) => void;
}

export default function AdminDashboard({ user, onLogout, onUserUpdate }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'employees' | 'stations' | 'history'>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [employees, setEmployees] = useState<User[]>([]);
  const [presences, setPresences] = useState<Presence[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [accessCodes, setAccessCodes] = useState<Record<string, AccessCode>>({});
  
  // App state managers
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Profile settings states
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newPrenom, setNewPrenom] = useState(user.prenom || '');
  const [newNom, setNewNom] = useState(user.nom || '');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState(user.photo_url || '');
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Sync state if user prop changes
  useEffect(() => {
    if (user.photo_url) setNewPhotoUrl(user.photo_url);
    if (user.prenom) setNewPrenom(user.prenom);
    if (user.nom) setNewNom(user.nom);
  }, [user.photo_url, user.prenom, user.nom]);
  
  // Form controllers
  const [newEmployee, setNewEmployee] = useState({ nom: '', prenom: '', email: '', matricule: '', role: 'employee', password: '', photo_url: '' });
  const [editingEmployee, setEditingEmployee] = useState<User | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<User | null>(null);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ prenom: string, nom: string, email: string, temp_password?: string, temp_password_token?: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvRawText, setCsvRawText] = useState("");
  const [newStationName, setNewStationName] = useState('');
  
  // Real-time live notifications list
  const [liveLog, setLiveLog] = useState<Presence[]>([]);
  const [showToast, setShowToast] = useState<Presence | null>(null);

  // Live QR Code Preview for Admin Screen
  const [previewStation, setPreviewStation] = useState<Station | null>(null);
  const [previewQrToken, setPreviewQrToken] = useState<string | null>(null);
  const [previewCountdown, setPreviewCountdown] = useState(15);

  // System general settings states (service days and check-in reference hour)
  const [serviceDays, setServiceDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [heurePointage, setHeurePointage] = useState<string>("08:30");
  const [settingsLoading, setSettingsLoading] = useState<boolean>(false);
  const [settingsSuccess, setSettingsSuccess] = useState<boolean>(false);

  // Copy state for dynamic access codes & static access tokens
  const [copiedText, setCopiedText] = useState<Record<string, boolean>>({});

  const handleCopyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedText((prev) => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setCopiedText((prev) => ({ ...prev, [id]: false }));
      }, 2000);
    }).catch((err) => {
      console.error("Failed to copy!", err);
    });
  };

  // Fetch initial system datasets
  const fetchAllData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` };
      
      const [resUsers, resPresences, resStations, resSettings] = await Promise.all([
        fetch('/api/employees', { headers }),
        fetch('/api/presences', { headers }),
        fetch('/api/stations', { headers }),
        fetch('/api/settings', { headers })
      ]);
      
      if (resUsers.ok) setEmployees(await resUsers.json());
      if (resPresences.ok) {
        const pList = await resPresences.json();
        setPresences(pList.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
      }
      if (resStations.ok) setStations(await resStations.json());
      if (resSettings.ok) {
        const sData = await resSettings.json();
        setServiceDays(sData.service_days || [1, 2, 3, 4, 5]);
        setHeurePointage(sData.heure_pointage || "08:30");
      }
      
    } catch (err) {
      console.error(err);
      setErrorMsg("Erreur de synchronisation avec le serveur");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    setSettingsSuccess(false);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          service_days: serviceDays,
          heure_pointage: heurePointage
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setSettingsSuccess(true);
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur de mise à jour des paramètres");
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();

    // CONNECT SSE LIVE EVENT STREAM
    console.log("Connecting real-time admin stream via Server-Sent Events...");
    const eventSource = new EventSource('/api/realtime');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'presence_added') {
          const presence: Presence = data.payload;
          
          // Prepend to dashboards
          setPresences(prev => [presence, ...prev]);
          setLiveLog(prev => [presence, ...prev].slice(0, 5));
          
          // Fire premium floating screen toast
          setShowToast(presence);
          setTimeout(() => setShowToast(null), 5000);
        } else if (data.type === 'employee_added') {
          // Live reload users list
          fetchAllData();
        }
      } catch (err) {
        console.error("SSE parse issue", err);
      }
    };
    
    eventSource.onerror = (err) => {
      console.log("SSE link resting, retrying shortly...", err);
    };

    return () => {
      eventSource.close();
    };
  }, []);

  // Dynamic Token Retrieval & Countdown for Admin Live QR Preview
  const fetchTokenForPreview = async (id: string) => {
    try {
      const res = await fetch(`/api/stations/${id}/qr-token`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      const payloadString = JSON.stringify({
        station_id: id,
        token: data.token,
        timestamp: Math.floor(Date.now() / 1000)
      });
      
      setPreviewQrToken(payloadString);
      setPreviewCountdown(15);
    } catch (err: any) {
      console.error("Error fetching preview token", err);
    }
  };

  useEffect(() => {
    if (!previewStation) return;
    
    fetchTokenForPreview(previewStation.id);
    
    const interval = setInterval(() => {
      setPreviewCountdown(prev => {
        if (prev <= 1) {
          fetchTokenForPreview(previewStation.id);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [previewStation]);

  // Employee CRUD Functions
  const handleCreateEmployee = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setCreatedCredentials(null);
    setCopiedLink(false);
    setCopiedPassword(false);
    
    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(newEmployee)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible d'ajouter l'employé");
      
      setEmployees(prev => [data, ...prev]);
      setNewEmployee({ nom: '', prenom: '', email: '', matricule: '', role: 'employee', password: '', photo_url: '' });
      setShowEmployeeModal(false);
      setCreatedCredentials({
        prenom: data.prenom,
        nom: data.nom,
        email: data.email,
        temp_password: data.temp_password,
        temp_password_token: data.temp_password_token
      });
      setSuccessMsg(`Employé ${data.prenom} ${data.nom} créé avec succès. Retrouvez ses identifiants d'activation ci-dessous.`);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleUpdateEmployee = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/employees/${editingEmployee.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(editingEmployee)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Impossible de modifier");
      
      setEmployees(prev => prev.map(emp => emp.id === data.id ? data : emp));
      setEditingEmployee(null);
      setSuccessMsg(`Employé mis à jour avec succès.`);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/employees/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setEmployees(prev => prev.filter(emp => emp.id !== id));
      setSuccessMsg("L'employé a été supprimé avec succès.");
      setEmployeeToDelete(null);
    } catch (err: any) {
      setErrorMsg(err.message || "Impossible de supprimer le collaborateur.");
      setEmployeeToDelete(null);
    }
  };

  const handleSaveProfile = async () => {
    if (!newPrenom.trim() || !newNom.trim()) {
      setProfileError("Prénom et Nom sont obligatoires.");
      return;
    }
    if (!newPhotoUrl.trim()) {
      setProfileError("Une URL de photo de profil est requise.");
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
      if (!res.ok) throw new Error(data.error || "Impossible de mettre à jour le profil");

      if (onUserUpdate) {
        onUserUpdate(data.user);
      }
      setSuccessMsg("Votre profil administrateur a été modifié avec succès.");
      setNewPassword('');
      setShowProfileModal(false);
    } catch (err: any) {
      setProfileError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleProfileFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setProfileError("Image invalide.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 150;
        canvas.height = 150;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 150, 150);
          setNewPhotoUrl(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          setNewPhotoUrl(event.target?.result as string);
        }
      };
    };
    reader.readAsDataURL(file);
  };

  const handleImportCSV = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    
    // Parse raw text CSV
    const rows = csvRawText.split('\n');
    const parsedList = [];
    
    for (const row of rows) {
      if (!row.trim()) continue;
      const cols = row.split(',');
      if (cols.length >= 4) {
        parsedList.push({
          nom: cols[0].trim(),
          prenom: cols[1].trim(),
          email: cols[2].trim(),
          matricule: cols[3].trim()
        });
      }
    }

    if (parsedList.length === 0) {
      setErrorMsg("Aucune ligne valide n'a pu être lue. Modèle: nom,prenom,email,matricule");
      return;
    }

    try {
      const res = await fetch('/api/employees/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ list: parsedList })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setSuccessMsg(data.message);
      setShowImportModal(false);
      fetchAllData();
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Station CRUD & Code Generation
  const handleCreateStation = async (e: FormEvent) => {
    e.preventDefault();
    if (!newStationName.trim()) return;
    setErrorMsg(null);

    try {
      const res = await fetch('/api/stations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ nom_station: newStationName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setStations(prev => [...prev, data]);
      setNewStationName('');
      setSuccessMsg(`Station "${data.nom_station}" configurée.`);
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleDeleteStation = async (id: string) => {
    if (!window.confirm("Supprimer cette station de pointage ?")) return;
    setErrorMsg(null);

    try {
      const res = await fetch(`/api/stations/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (!res.ok) throw new Error("Erreur de suppression");
      
      setStations(prev => prev.filter(s => s.id !== id));
      setSuccessMsg("Station supprimée.");
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  const handleGenerateCode = async (stationId: string) => {
    setErrorMsg(null);
    try {
      const res = await fetch('/api/stations/generate-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ station_id: stationId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setAccessCodes(prev => ({ ...prev, [stationId]: data }));
    } catch (err: any) {
      setErrorMsg(err.message);
    }
  };

  // Stats computation (Filtered strictly by the current day to auto-reset after each service day)
  const todayStr = new Date().toISOString().split('T')[0];
  const todayPresences = presences.filter(p => p.date === todayStr);

  const uniqueUsersToday = new Set(todayPresences.map(p => p.user_id)).size;
  const arrivalsCount = todayPresences.filter(p => p.type === 'entry').length;
  const departuresCount = todayPresences.filter(p => p.type === 'exit').length;

  // Filtered employees list
  const filteredEmployees = employees.filter(emp => {
    const term = searchQuery.toLowerCase();
    return (
      emp.nom.toLowerCase().includes(term) ||
      emp.prenom.toLowerCase().includes(term) ||
      emp.email.toLowerCase().includes(term) ||
      emp.matricule.toLowerCase().includes(term)
    );
  });

  return (
    <div id="admin-root-layout" className="min-h-screen bg-slate-50 flex relative">
      
      {/* MOBILE BACKDROP FOR SIDEBAR MENU */}
      {isMobileMenuOpen && (
        <div 
          id="mobile-sidebar-backdrop"
          onClick={() => setIsMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-900/60 z-25 md:hidden transition-opacity duration-300"
        />
      )}
      
      {/* PERSISTENT / SLIDE-OUT SIDEBAR */}
      <aside 
        id="sidebar-navigation" 
        className={`fixed inset-y-0 left-0 w-64 bg-slate-900 text-slate-300 flex flex-col flex-shrink-0 z-30 shadow-xl border-r border-slate-800 transition-transform duration-300 ease-in-out md:translate-x-0 md:static ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div id="sidebar-header" className="p-6 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <img 
              id="sidebar-logo-brand"
              src="https://res.cloudinary.com/dzthrix45/image/upload/q_auto/f_auto/v1781278377/1781276285421_qvyann.png"
              alt="Logo"
              className="w-10 h-10 object-contain"
              referrerPolicy="no-referrer"
            />
            <div>
              <h1 className="text-white font-bold text-base leading-tight">Admin Portal</h1>
              <p className="text-slate-400 text-xs font-semibold">HINOV TapPoinT</p>
            </div>
          </div>
          {/* Close button for mobile screen menu */}
          <button
            id="btn-close-mobile-menu"
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="md:hidden p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer"
            title="Fermer le menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User profile capsule */}
        <button 
          id="sidebar-user-section" 
          onClick={() => {
            setNewPhotoUrl(user.photo_url || '');
            setNewPrenom(user.prenom || '');
            setNewNom(user.nom || '');
            setProfileError(null);
            setShowProfileModal(true);
          }}
          title="Modifier mon profil & mot de passe"
          className="text-left w-[calc(100%-24px)] p-4 mx-3 my-4 bg-slate-800/40 border border-slate-800/60 hover:bg-slate-800/70 hover:border-slate-700 rounded-xl flex items-center gap-3 transition-all cursor-pointer group"
        >
          <img 
            id="admin-profile-pic"
            src={user.photo_url || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop"} 
            alt="Profile Avatar" 
            className="w-10 h-10 rounded-lg object-cover ring-2 ring-transparent group-hover:ring-blue-500 transition-all"
            referrerPolicy="no-referrer"
          />
          <div className="overflow-hidden flex-1">
            <div className="text-white font-semibold text-xs truncate group-hover:text-blue-400 transition-colors">{user.prenom} {user.nom}</div>
            <div className="text-slate-400 text-[10px] truncate">{user.email}</div>
          </div>
        </button>

        {/* Menu Items */}
        <nav id="sidebar-navlist" className="flex-1 px-3 space-y-1">
          <button
            id="nav-dashboard"
            onClick={() => {
              setActiveTab('dashboard');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'dashboard' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Clock className="w-4.5 h-4.5" /> Accueil & Live
          </button>
          
          <button
            id="nav-employees"
            onClick={() => {
              setActiveTab('employees');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'employees' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Users className="w-4.5 h-4.5" /> Gérer Employés
          </button>

          <button
            id="nav-stations"
            onClick={() => {
              setActiveTab('stations');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'stations' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Laptop className="w-4.5 h-4.5" /> Stations & Accès
          </button>

          <button
            id="nav-history"
            onClick={() => {
              setActiveTab('history');
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
              activeTab === 'history' ? 'bg-blue-600 text-white font-semibold' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Calendar className="w-4.5 h-4.5" /> Historique Global
          </button>
        </nav>

        {/* Footer actions */}
        <div id="sidebar-footer" className="p-4 border-t border-slate-800">
          <button
            id="btn-admin-logout"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-red-900/40 hover:text-red-300 text-xs font-semibold rounded-lg text-slate-300 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" /> Déconnexion
          </button>
        </div>
      </aside>

      {/* CORE CONTENT REGION */}
      <main id="main-content-layout" className="flex-1 flex flex-col min-w-0 overflow-y-auto w-full">
        
        {/* TOP BAR */}
        <header id="main-header" className="bg-white border-b border-slate-200 py-4 px-4 md:px-8 flex justify-between items-center sticky top-0 z-10 shadow-sm gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile menu toggle button */}
            <button
              id="btn-toggle-mobile-menu"
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="md:hidden p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer flex-shrink-0"
              title="Afficher le menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <h2 id="header-section-title" className="text-sm md:text-xl font-bold text-slate-900 font-sans uppercase tracking-tight truncate">
                {activeTab === 'dashboard' && '👋 Tableau de Bord Live'}
                {activeTab === 'employees' && '👥 Répertoire & Gestion des Employés'}
                {activeTab === 'stations' && '📷 Configuration Stations QR & Kiosques'}
                {activeTab === 'history' && '📊 Dossier Historique de Présence'}
              </h2>
              <p className="text-[10px] md:text-xs text-slate-500 mt-0.5 truncate hidden sm:block">Vue Administrateur • Supervision temps réel des flux RH</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
            <button
              id="header-profile-btn"
              onClick={() => {
                setNewPhotoUrl(user.photo_url || '');
                setNewPrenom(user.prenom || '');
                setNewNom(user.nom || '');
                setProfileError(null);
                setShowProfileModal(true);
              }}
              className="flex items-center gap-2 py-1.5 px-3 bg-blue-50 hover:bg-blue-100 hover:border-blue-300 text-blue-700 border border-blue-200 text-xs font-semibold rounded-lg transition cursor-pointer"
              title="Modifier mon profil"
            >
              <img 
                src={user.photo_url || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop"} 
                alt="Profile miniature"
                className="w-5 h-5 rounded-md object-cover ring-1 ring-blue-300"
                referrerPolicy="no-referrer"
              />
              <span className="hidden sm:inline">Mon Profil</span>
            </button>

            <button 
              id="header-refresh-btn"
              onClick={fetchAllData} 
              disabled={loading}
              className="p-1.5 md:p-2 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-lg transition cursor-pointer"
              title="Recharger les données"
            >
              <RefreshCw className={`w-3.5 h-3.5 md:w-4 md:h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <span id="badge-sys-time" className="text-[10px] md:text-xs font-mono text-slate-500 bg-slate-100 py-1 md:py-1.5 px-2 md:px-3 rounded-lg border border-slate-200">
              🕒 {new Date().toLocaleTimeString()}
            </span>
          </div>
        </header>

        {/* ERROR / SUCCESS ALERTS */}
        <div id="feedback-alert-strip" className="px-4 md:px-8 mt-6">
          {errorMsg && (
            <div id="error-toast" className="bg-red-50 border-l-4 border-red-500 p-4 rounded-xl text-sm text-red-700 flex justify-between items-center">
              <div>{errorMsg}</div>
              <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-800 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
          )}
          {successMsg && (
            <div id="success-toast" className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-xl text-sm text-emerald-800 flex justify-between items-center">
              <div>{successMsg}</div>
              <button onClick={() => setSuccessMsg(null)} className="text-emerald-400 hover:text-emerald-850 cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
          )}
        </div>

        {/* RENDER ACTIVE TAB VIEW */}
        <div id="main-tab-content-area" className="p-4 md:p-8 flex-1">
          
          {/* TAB 1: DASHBOARD (HOME) */}
          {activeTab === 'dashboard' && (
            <div id="dashboard-tab-root" className="space-y-8 animate-fadeIn">
              
              {/* ANALYTICS HIGHLIGHTS METRICS */}
              <div id="dashboard-stats-grid" className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                <div id="stat-col-present" className="bg-white p-6 border border-slate-150 rounded-2xl shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{uniqueUsersToday}</div>
                    <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Employés actifs aujourd'hui</div>
                  </div>
                </div>

                <div id="stat-col-arrivals" className="bg-white p-6 border border-slate-150 rounded-2xl shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{arrivalsCount}</div>
                    <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Entrées enregistrées</div>
                  </div>
                </div>

                <div id="stat-col-departures" className="bg-white p-6 border border-slate-150 rounded-2xl shadow-sm flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900">{departuresCount}</div>
                    <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Sorties enregistrées</div>
                  </div>
                </div>

              </div>

              {/* LIVE ARRIVALS & NOTIFICATIONS STREAM SECTION */}
              <div id="dashboard-feed-layouts" className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* 1. REALTIME STREAM POINTEUSE */}
                <div id="live-arrivees-card" className="bg-white border border-slate-200 rounded-2xl shadow-md p-6">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
                    <h3 className="text-md font-bold text-slate-950 flex items-center gap-2">
                      <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping"></span>
                      Flux D'Arrivées & Départs en Direct
                    </h3>
                    <span className="text-[11px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      Mise à jour instantanée
                    </span>
                  </div>

                  <div className="space-y-4 min-h-[300px]">
                    {todayPresences.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-2">
                        <Bell className="w-12 h-12 text-slate-200 animate-bounce" />
                        <p className="text-sm font-sans text-slate-500 text-center">Aucun passage enregistré aujourd'hui.</p>
                        <p className="text-xs text-slate-400">Les passages apparaîtront ici dès qu'un employé scanne un QR.</p>
                      </div>
                    ) : (
                      todayPresences.slice(0, 8).map((presence, idx) => (
                        <div 
                          key={presence.id} 
                          id={`live-row-${presence.id}`}
                          className="flex items-center justify-between p-3 bg-slate-50/70 border border-slate-100 hover:bg-slate-100 font-sans rounded-xl transition"
                        >
                          <div className="flex items-center gap-3.5">
                            <img 
                              src={presence.user_photo_url} 
                              alt="Profile" 
                              className="w-11 h-11 rounded-lg object-cover ring-2 ring-white shadow-sm"
                              referrerPolicy="no-referrer"
                            />
                            <div>
                              <div className="font-bold text-slate-900 text-sm">{presence.user_prenom} {presence.user_nom}</div>
                              <div className="text-[11px] text-slate-600 flex items-center gap-1.5 mt-0.5">
                                <span className="font-semibold px-1.5 py-0.5 rounded bg-slate-200 font-mono text-slate-700">{presence.user_matricule}</span>
                                • <span className="text-slate-500">{presence.station_nom}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className={`inline-block text-xs font-bold px-2.5 py-1 rounded-full ${
                              presence.type === 'entry' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {presence.type === 'entry' ? 'ENTRÉE' : 'SORTIE'}
                            </span>
                            {presence.type === 'entry' && (
                              <div className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${
                                presence.late ? 'text-rose-600' : 'text-emerald-600'
                              }`}>
                                {presence.late ? '⚠️ En retard' : '✅ À l\'heure'}
                              </div>
                            )}
                            <div className="text-xs text-slate-500 font-semibold font-mono mt-1">{presence.heure}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 2. RAPPORT COMPLEMENTAIRE & GUIDELINES PRODUCTION */}
                <div id="system-production-guidelines-card" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-md font-bold text-slate-950 pb-4 mb-4 border-b border-slate-100 flex items-center gap-2">
                      🛡️ Guide de Déploiement & Sécurité RH
                    </h3>
                    
                    <div className="space-y-4 font-sans">
                      <div className="p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl">
                        <h4 className="text-xs font-bold text-blue-900 mb-1">Configuration des Tablettes Kiosques</h4>
                        <p className="text-[11.5px] text-blue-800 leading-relaxed font-sans">
                          Pour mettre en place une borne physique de pointage (kiosque), utilisez une tablette installée à l’entrée de vos locaux, connectez-vous au portail et saisissez un code à 6 chiffres généré à partir de l'onglet "Stations de Pointage" ci-dessus.
                        </p>
                      </div>

                      <div className="space-y-3 pt-2">
                        <h4 className="text-xs font-bold text-slate-800 font-sans">Recommandations en Production :</h4>
                        <ul className="text-xs text-slate-600 space-y-2.5 leading-relaxed font-sans">
                          <li className="flex items-start gap-1.5">
                            <span className="text-blue-600 font-bold">•</span>
                            <span><strong>Géolocalisation optionnelle :</strong> Vous pouvez activer la restriction GPS sur les stations individuelles.</span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="text-blue-600 font-bold">•</span>
                            <span><strong>Sécurité des QR Codes :</strong> Les codes QR se rafraîchissent automatiquement toutes les 15 secondes pour interdire toute triche ou partage de captures d'écran.</span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="text-blue-600 font-bold">•</span>
                            <span><strong>Cloudinary :</strong> Toutes les photos d'employés et justificatifs d'absence importés sont stockés de façon durable et sécurisée.</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-slate-100 hidden md:block">
                    <h4 className="text-xs font-bold text-slate-700 mb-1.5 font-sans">📌 Informations Système :</h4>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Base de données : Firestore (Enterprise)<br />
                      Version API : v1 (Production)
                    </div>
                  </div>

                </div>

              </div>

            </div>
          )}

          {/* TAB 2: EMPLOYEES DIRECTORY MANAGEMENT */}
          {activeTab === 'employees' && (
            <div id="employees-tab-root" className="space-y-6 animate-fadeIn">
              
              <div id="dir-control-bar" className="flex flex-col sm:flex-row gap-4 justify-between items-center">
                
                {/* Search query input */}
                <div className="relative w-full sm:w-80">
                  <input
                    id="search-emp-input"
                    type="text"
                    placeholder="Rechercher par nom, matricule, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-white text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                </div>

                {/* Directory button triggers */}
                <div className="flex gap-2.5 w-full sm:w-auto">
                  <button
                    id="btn-trigger-import-modal"
                    onClick={() => { setShowImportModal(true); setErrorMsg(null); }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4" /> Import CSV
                  </button>
                  <button
                    id="btn-trigger-add-modal"
                    onClick={() => { setShowEmployeeModal(true); setEditingEmployee(null); setErrorMsg(null); }}
                    className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition cursor-pointer shadow-md shadow-blue-200"
                  >
                    <Plus className="w-4 h-4" /> Ajouter un Employé
                  </button>
                </div>

              </div>

              {/* Grid listings of employees cards */}
              <div id="employees-cards-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEmployees.length === 0 ? (
                  <div className="col-span-full py-16 text-center text-slate-400">
                    Aucun employé ne correspond à votre recherche.
                  </div>
                ) : (
                  filteredEmployees.map(emp => (
                    <div 
                      key={emp.id} 
                      id={`emp-card-${emp.id}`}
                      className="bg-white p-5 border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition flex flex-col justify-between"
                    >
                      <div className="flex items-start gap-4">
                        <img 
                          src={emp.photo_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop"} 
                          alt="Employee Headshot" 
                          className="w-14 h-14 rounded-xl object-cover ring-2 ring-slate-100 shadow"
                          referrerPolicy="no-referrer"
                        />
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 truncate">{emp.prenom} {emp.nom}</h4>
                          <p className="text-xs text-slate-500 font-semibold font-mono mt-0.5 bg-slate-100 inline-block px-1.5 py-0.5 rounded">
                            {emp.matricule}
                          </p>
                          <p className="text-xs text-slate-500 truncate mt-1.5">{emp.email}</p>
                          {emp.must_change_password && emp.temp_password_token && (
                            <div className="mt-3 text-[10px] bg-amber-55 text-amber-805 p-2 rounded-xl border border-amber-250 flex flex-col gap-1.5" style={{ backgroundColor: '#fffbeb', borderColor: '#fef3c7', color: '#92400e' }}>
                              <span className="font-bold flex items-center gap-1 text-[9.5px] uppercase tracking-wider text-amber-700">⚠️ Compte non activé</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const link = window.location.origin + "/?action=init_password&token=" + emp.temp_password_token;
                                  navigator.clipboard.writeText(link);
                                  setSuccessMsg(`Lien d'activation pour ${emp.prenom} ${emp.nom} copié !`);
                                }}
                                className="text-blue-600 hover:text-blue-800 font-bold text-left p-0 bg-transparent flex items-center gap-1 underline cursor-pointer"
                                title="Copier le lien unique d'initialisation"
                              >
                                <Copy className="w-3 h-3" /> Copier le lien d'initialisation
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between items-center">
                        <span className={`inline-block text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full ${
                          emp.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {emp.role === 'admin' ? 'ADMIN' : 'COLLABORATEUR'}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            id={`edit-emp-btn-${emp.id}`}
                            onClick={() => { setEditingEmployee(emp); setErrorMsg(null); }}
                            className="p-1.5 text-slate-400 hover:text-blue-500 rounded hover:bg-slate-50 transition"
                            title="Modifier les informations"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`delete-emp-btn-${emp.id}`}
                            onClick={() => setEmployeeToDelete(emp)}
                            className="p-1.5 text-slate-400 hover:text-red-500 rounded hover:bg-slate-50 transition cursor-pointer"
                            title="Supprimer cet employé"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

            </div>
          )}

          {/* TAB 3: STATIONS DETAILS & KIOSK GENERATORS */}
          {activeTab === 'stations' && (
            <div id="stations-tab-root" className="space-y-8 animate-fadeIn">
              
              <div id="station-creator-row" className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* STATION MANAGER LEFT FORM & PORTAL SERVICE SETTINGS */}
                <div className="space-y-6 self-start">
                  
                  <div id="station-form-card" className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                    <h3 className="text-md font-bold text-slate-900 pb-4 mb-4 border-b border-indigo-50">
                      ➕ Créer une Borne Station QR
                    </h3>
                    
                    <form onSubmit={handleCreateStation} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 mb-1.5">Nom de l'emplacement (Station)</label>
                        <input
                          type="text"
                          value={newStationName}
                          onChange={(e) => setNewStationName(e.target.value)}
                          placeholder="Ex: Accueil, Hall B, Cafétéria"
                          required
                          className="block w-full text-sm bg-white border border-slate-200 px-3.5 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <button 
                        type="submit" 
                        className="w-full flex items-center justify-center gap-1.5 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm rounded-lg transition"
                      >
                        <Plus className="w-4 h-4" /> Enregistrer Borne
                      </button>
                    </form>
                  </div>

                  {/* PORTAL SERVICE SETTINGS CARD */}
                  <div id="portal-settings-card" className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                    <h3 className="text-md font-bold text-slate-900 pb-4 mb-4 border-b border-indigo-50 flex items-center gap-1.5">
                      ⚙️ Jours & Heure de service
                    </h3>
                    
                    <form onSubmit={handleSaveSettings} className="space-y-5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-2">Jours de service actifs</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: 1, label: 'Lundi' },
                            { value: 2, label: 'Mardi' },
                            { value: 3, label: 'Mercredi' },
                            { value: 4, label: 'Jeudi' },
                            { value: 5, label: 'Vendredi' },
                            { value: 6, label: 'Samedi' },
                            { value: 0, label: 'Dimanche' }
                          ].map(day => {
                            const active = serviceDays.includes(day.value);
                            return (
                              <button
                                type="button"
                                key={day.value}
                                onClick={() => {
                                  if (active) {
                                    setServiceDays(prev => prev.filter(v => v !== day.value));
                                  } else {
                                    setServiceDays(prev => [...prev, day.value]);
                                  }
                                }}
                                className={`text-left px-2.5 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer flex items-center justify-between ${
                                  active 
                                    ? 'bg-indigo-50/70 border-indigo-200 text-indigo-700 font-bold' 
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                                }`}
                              >
                                <span>{day.label}</span>
                                {active ? (
                                  <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>
                                ) : (
                                  <span className="w-1.5 h-1.5 bg-transparent rounded-full"></span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed font-sans">La borne QR n'affichera aucun QR en dehors de ces jours.</p>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1.5">Heure limite de pointage</label>
                        <input
                          type="time"
                          value={heurePointage}
                          onChange={(e) => setHeurePointage(e.target.value)}
                          required
                          className="block w-full text-xs font-mono bg-white border border-slate-200 px-3.5 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <p className="text-[10px] text-slate-400 mt-1.5 leading-relaxed font-sans">Heure de référence pour qualifier l'arrivée (En retard vs À l'heure).</p>
                      </div>

                      <button
                        type="submit"
                        disabled={settingsLoading}
                        className="w-full flex items-center justify-center gap-1.5 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-lg transition disabled:opacity-50 cursor-pointer"
                      >
                        {settingsLoading ? 'Enregistrement...' : 'Sauvegarder les paramètres'}
                      </button>

                      {settingsSuccess && (
                        <div className="text-center text-[10px] font-bold text-emerald-600 bg-emerald-50 py-1.5 rounded-lg border border-emerald-100 animate-fadeIn font-sans">
                          ✓ Enregistré !
                        </div>
                      )}
                    </form>
                  </div>

                </div>

                {/* ACTIVE STATIONS LISTINGS */}
                <div id="station-listings-column" className="lg:col-span-2 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
                  <h3 className="text-md font-bold text-slate-950 pb-4 mb-4 border-b border-slate-100">
                    📷 Liste de vos Bornes de Pointage
                  </h3>

                  {stations.length === 0 ? (
                    <div className="py-12 text-center text-slate-400">Aucune station configurée pour le moment.</div>
                  ) : (
                    <div className="space-y-4">
                      {stations.map(st => (
                        <div 
                          key={st.id} 
                          id={`station-col-row-${st.id}`}
                          className="p-4 border border-slate-150 hover:border-slate-300 rounded-xl bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div>
                            <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                              {st.nom_station}
                              <span className="w-2 h-2 bg-emerald-500 rounded-full" title="Active"></span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-1 font-mono flex items-center flex-wrap gap-1">
                              <span>ID Borne: {st.id} • Token d'accès:</span>
                              <span className="bg-slate-200/60 pl-1.5 pr-1 py-0.5 rounded text-slate-700 inline-flex items-center gap-1">
                                {st.token_access}
                                <button
                                  type="button"
                                  onClick={() => handleCopyToClipboard(st.token_access, `token-${st.id}`)}
                                  className="p-0.5 hover:bg-slate-300 rounded text-slate-500 hover:text-slate-800 transition cursor-pointer"
                                  title="Copier le token d'accès"
                                >
                                  {copiedText[`token-${st.id}`] ? (
                                    <Check className="w-3 h-3 text-green-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </span>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2.5 justify-end">
                            {/* Access code generator result display inline */}
                            {accessCodes[st.id] ? (
                              <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 py-1 px-2.5 rounded-lg shadow-xs">
                                <KeyRound className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
                                <span className="font-mono font-bold text-sm text-amber-700 tracking-wider">
                                  {accessCodes[st.id].code}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyToClipboard(accessCodes[st.id].code, `code-${st.id}`)}
                                  className="py-1 px-2 hover:bg-amber-100 text-amber-700 rounded transition cursor-pointer flex items-center justify-center gap-1 border border-amber-250 text-[10px] font-bold"
                                  title="Copier le code à 6 chiffres"
                                >
                                  {copiedText[`code-${st.id}`] ? (
                                    <>
                                      <Check className="w-3 h-3 text-green-600" />
                                      <span>Copié</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="w-3 h-3" />
                                      <span>Copier Code</span>
                                    </>
                                  )}
                                </button>
                                <span className="text-[10px] text-amber-500 font-semibold">
                                  (Exp: 15m)
                                </span>
                              </div>
                            ) : (
                              <button
                                onClick={() => handleGenerateCode(st.id)}
                                className="flex items-center gap-1 py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg transition"
                                title="Générer un code à usage unique de 15 minutes pour activer un Kiosque sur tablette"
                              >
                                <KeyRound className="w-3.5 h-3.5" /> Code de Station
                              </button>
                            )}

                             {/* Live modal preview in-app */}
                            <button
                              id={`preview-qr-btn-${st.id}`}
                              onClick={() => setPreviewStation(st)}
                              className="inline-flex items-center gap-1.5 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                              title="Afficher le QR code en direct sur cet écran"
                            >
                              <QrCode className="w-3.5 h-3.5" /> Voir QR Live
                            </button>

                            {/* Direct launch route link - opened in same tab to keep Google AI Studio iframe proxy authentication and avoid 403 of new tabs */}
                            <a
                              href={`/station/${st.id}`}
                              className="inline-flex items-center gap-1 py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition"
                              title="Lancer la borne de pointage dans cet onglet sécurisé"
                            >
                              Ouvrir Kiosque <ArrowRight className="w-3 h-3" />
                            </a>

                            <button
                              onClick={() => handleDeleteStation(st.id)}
                              className="p-2 text-slate-400 hover:text-red-500 rounded bg-white border border-slate-200 transition"
                              title="Déconnecter et supprimer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

          {/* TAB 4: COMPLETE PASSAGE HISTORIQUE */}
          {activeTab === 'history' && (
            <div id="history-tab-root" className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6 animate-fadeIn">
              
              <div id="history-header" className="flex justify-between items-center border-b border-slate-100 pb-4">
                <h3 className="text-md font-bold text-slate-900">
                  📋 Registre d'Émargement Global
                </h3>
                <span className="text-xs text-slate-500 font-semibold bg-slate-100 px-2.5 py-1 rounded-full">
                  Total Passages : {presences.length}
                </span>
              </div>

              <div id="history-scroller" className="overflow-x-auto">
                {presences.length === 0 ? (
                  <div className="py-12 text-center text-slate-400">Aucun passage dans l'historique global pour l'instant.</div>
                ) : (
                  <table className="min-w-full divide-y divide-slate-200 text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[11px] tracking-wider text-left">
                        <th className="px-6 py-3.5">Employé</th>
                        <th className="px-6 py-3.5">Matricule</th>
                        <th className="px-6 py-3.5">Station de Pointage</th>
                        <th className="px-6 py-3.5">Action</th>
                        <th className="px-6 py-3.5">Date</th>
                        <th className="px-6 py-3.5">Heure</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-100">
                      {presences.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50 font-sans text-slate-700">
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <img 
                                src={p.user_photo_url} 
                                alt="..." 
                                className="w-8 h-8 rounded-full object-cover shadow"
                                referrerPolicy="no-referrer"
                              />
                              <span className="font-semibold text-slate-900">{p.user_prenom} {p.user_nom}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3.5 whitespace-nowrap font-mono">{p.user_matricule}</td>
                          <td className="px-6 py-3.5 whitespace-nowrap font-medium text-slate-600">{p.station_nom}</td>
                          <td className="px-6 py-3.5 whitespace-nowrap">
                            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              p.type === 'entry' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {p.type === 'entry' ? 'ENTRÉE' : 'SORTIE'}
                            </span>
                            {p.type === 'entry' && (
                              <span className={`ml-2 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                p.late ? 'bg-rose-100 text-rose-800' : 'bg-emerald-150 text-emerald-800'
                              }`}>
                                {p.late ? 'En retard' : 'À l\'heure'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3.5 whitespace-nowrap">{p.date}</td>
                          <td className="px-6 py-3.5 whitespace-nowrap font-mono text-slate-500 font-semibold">{p.heure}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

            </div>
          )}

        </div>
      </main>

      {/* FLOAT FLOATING IN-APP LIVE PREVIEW TOAST (REAL-TIME ALERT) */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            id="sse-live-toast-box"
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white rounded-2xl shadow-2xl p-4 max-w-sm border border-slate-800 flex items-start gap-3.5 font-sans"
          >
            <img 
              src={showToast.user_photo_url} 
              alt="Live Thumbnail" 
              className="w-12 h-12 rounded-xl object-cover ring-2 ring-white shadow-xl"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-rose-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping"></span> Live Pointage
                </span>
                <span className="text-[10px] text-slate-400 font-mono">{showToast.heure}</span>
              </div>
              <h5 className="font-bold text-sm text-white mt-1">
                {showToast.user_prenom} {showToast.user_nom}
              </h5>
              <p className="text-xs text-slate-300 mt-1 leading-normal">
                A pointé son <strong className="text-white">{showToast.type === 'entry' ? 'Entrée' : 'Sortie'}</strong> à la station <strong className="text-white">{showToast.station_nom}</strong>.
              </p>
            </div>
            <button 
              onClick={() => setShowToast(null)} 
              className="text-slate-400 hover:text-white shrink-0 self-start p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL: CONFIRM DELETE EMPLOYEE */}
      <AnimatePresence>
        {employeeToDelete && (
          <div id="modal-delete-employee-overlay" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn animate-duration-200">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-slate-100" 
              role="dialog" 
              aria-modal="true"
            >
              <div className="bg-red-650 px-6 py-4 flex justify-between items-center text-white" style={{ backgroundColor: '#dc2626' }}>
                <h3 className="font-bold text-sm tracking-wider uppercase flex items-center gap-2">
                  ⚠️ Action Irréversible
                </h3>
                <button onClick={() => setEmployeeToDelete(null)} className="text-white/80 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-6 space-y-4">
                <div className="flex items-start gap-4 bg-red-50 p-4 rounded-xl border border-red-100">
                  <div className="bg-red-100 p-2.5 rounded-lg text-red-600 shrink-0">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-950 leading-tight">Confirmation de la suppression</h4>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">Vous êtes sur le point de supprimer définitivement le compte et l'accès de ce collaborateur.</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-xs text-slate-700 leading-relaxed space-y-2">
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Prénom & Nom :</span>
                    <span className="font-bold text-slate-800">{employeeToDelete.prenom} {employeeToDelete.nom}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-2">
                    <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Adresse Email :</span>
                    <span className="font-mono font-bold text-slate-750">{employeeToDelete.email}</span>
                  </div>
                  {employeeToDelete.matricule && (
                    <div className="flex justify-between border-b border-slate-100 pb-2">
                      <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Matricule :</span>
                      <span className="font-bold text-slate-800">{employeeToDelete.matricule}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">Rôle :</span>
                    <span className="font-bold uppercase tracking-wider text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                      {employeeToDelete.role === 'admin' ? 'ADMIN' : 'COLLABORATEUR'}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-450 leading-tight text-center italic">
                  Cette action détruira définitivement son profil de connexion de l'application. Ses historiques passés seront conservés mais isolés.
                </p>

                <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEmployeeToDelete(null)}
                    className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer text-center"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteEmployee(employeeToDelete.id)}
                    className="flex-1 py-2.5 px-4 bg-red-650 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition cursor-pointer text-center"
                    style={{ backgroundColor: '#dc2626' }}
                  >
                    Confirmer la Suppression
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: ADD / EDIT EMPLOYEE */}
      {showEmployeeModal && (
        <div id="modal-employee-overlay" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden" role="dialog" aria-modal="true">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-md">Ajouter un Collaborateur</h3>
              <button onClick={() => setShowEmployeeModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleCreateEmployee} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Prénom</label>
                  <input
                    type="text"
                    required
                    value={newEmployee.prenom}
                    onChange={(e) => setNewEmployee({ ...newEmployee, prenom: e.target.value })}
                    className="block w-full text-xs bg-white border border-slate-200 px-3 py-2 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="Jean"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nom</label>
                  <input
                    type="text"
                    required
                    value={newEmployee.nom}
                    onChange={(e) => setNewEmployee({ ...newEmployee, nom: e.target.value })}
                    className="block w-full text-xs bg-white border border-slate-200 px-3 py-2 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                    placeholder="Dupont"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Matricule Unique</label>
                <input
                  type="text"
                  required
                  value={newEmployee.matricule}
                  onChange={(e) => setNewEmployee({ ...newEmployee, matricule: e.target.value })}
                  className="block w-full text-xs bg-white border border-slate-200 px-3 py-2 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="EMP-024"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Adresse Email</label>
                <input
                  type="email"
                  required
                  value={newEmployee.email}
                  onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                  className="block w-full text-xs bg-white border border-slate-200 px-3 py-2 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="jean.dupont@demo.com"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Rôle Système</label>
                <select
                  value={newEmployee.role}
                  onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                  className="block w-full text-xs bg-white border border-slate-200 px-3 py-2 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  <option value="employee">Collaborateur</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Lien de la photo de profil (Optionnel Unsplash)</label>
                <input
                  type="url"
                  value={newEmployee.photo_url}
                  onChange={(e) => setNewEmployee({ ...newEmployee, photo_url: e.target.value })}
                  className="block w-full text-xs bg-white border border-slate-200 px-3 py-2 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                  placeholder="https://images.unsplash.com/photo-..."
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEmployeeModal(false)}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-250 text-slate-600 text-xs font-bold rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
                >
                  Confirmer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}


      {createdCredentials && (
        <div id="modal-credentials-overlay" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden" role="dialog" aria-modal="true">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-md flex items-center gap-2"><KeyRound className="w-5 h-5 flex-shrink-0" /> Identifiants d'activation</h3>
              <button onClick={() => setCreatedCredentials(null)} className="text-white hover:opacity-80 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 leading-normal mb-2">
                Le compte de <strong>{createdCredentials.prenom} {createdCredentials.nom}</strong> a été créé ! 
                Voici ses identifiants temporaires et son lien unique pour initialiser son mot de passe :
              </p>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 space-y-3.5">
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Adresse Email</span>
                  <div className="text-sm font-semibold text-slate-850 font-mono select-all bg-white border border-slate-200 rounded-lg px-3 py-1.5">{createdCredentials.email}</div>
                </div>

                {createdCredentials.temp_password && (
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Mot passe temporaire</span>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1 text-sm font-semibold text-slate-850 font-mono select-all bg-white border border-slate-200 rounded-lg px-3 py-1.5">{createdCredentials.temp_password}</div>
                      <button 
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(createdCredentials.temp_password || "");
                          setCopiedPassword(true);
                          setTimeout(() => setCopiedPassword(false), 2000);
                        }}
                        className="p-2 bg-white hover:bg-slate-100 text-slate-600 rounded-lg transition border border-slate-200"
                        title="Copier le mot de passe"
                      >
                        {copiedPassword ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {createdCredentials.temp_password_token && (
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Lien d'activation direct</span>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="text"
                        readOnly
                        value={window.location.origin + "/?action=init_password&token=" + createdCredentials.temp_password_token}
                        className="flex-1 text-[11px] text-slate-750 font-mono select-all bg-white border border-slate-200 rounded-lg px-3 py-1.5"
                      />
                      <button 
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.origin + "/?action=init_password&token=" + createdCredentials.temp_password_token);
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2000);
                        }}
                        className="p-2 bg-white hover:bg-slate-100 text-slate-600 rounded-lg transition border border-slate-200"
                        title="Copier le lien d'activation"
                      >
                        {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-amber-55 text-[10.5px] text-amber-900 p-3.5 rounded-xl border border-amber-200 leading-relaxed" style={{ backgroundColor: '#fffbeb' }}>
                💡 <strong>Mode d'évaluation :</strong> Pour valider ce compte de test, copiez le lien d'activation direct ci-dessus et collez-le dans une <strong>fenêtre de navigation privée</strong> (ou déconnectez-vous d'abord de cette session d'administration) afin d'initialiser son mot de passe en tant que collaborateur.
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setCreatedCredentials(null)}
                  className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold tracking-wider uppercase rounded-xl transition cursor-pointer text-center"
                >
                  J'ai Copié les Identifiants
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT SPECIFIC EMPLOYEE */}
      {editingEmployee && (
        <div id="modal-edit-overlay" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl overflow-hidden" role="dialog" aria-modal="true">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-md">Modifier Collaborateur</h3>
              <button onClick={() => setEditingEmployee(null)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleUpdateEmployee} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Prénom</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.prenom}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, prenom: e.target.value })}
                    className="block w-full text-xs bg-white border border-slate-200 px-3 py-2 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nom</label>
                  <input
                    type="text"
                    required
                    value={editingEmployee.nom}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, nom: e.target.value })}
                    className="block w-full text-xs bg-white border border-slate-200 px-3 py-2 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Matricule</label>
                <input
                  type="text"
                  required
                  value={editingEmployee.matricule}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, matricule: e.target.value })}
                  className="block w-full text-xs bg-white border border-slate-200 px-3 py-2 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Adresse Email</label>
                <input
                  type="email"
                  required
                  value={editingEmployee.email}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                  className="block w-full text-xs bg-white border border-slate-200 px-3 py-2 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Rôle Système</label>
                <select
                  value={editingEmployee.role}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value as any })}
                  className="block w-full text-xs bg-white border border-slate-200 px-3 py-2 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                >
                  <option value="employee">Collaborateur</option>
                  <option value="admin">Administrateur</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Photo Profil URL</label>
                <input
                  type="url"
                  value={editingEmployee.photo_url}
                  onChange={(e) => setEditingEmployee({ ...editingEmployee, photo_url: e.target.value })}
                  className="block w-full text-xs bg-white border border-slate-200 px-3 py-2 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingEmployee(null)}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-250 text-slate-600 text-xs font-bold rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
                >
                  Enregistrer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: IMPORT EMPLOYEES VIA CSV */}
      {showImportModal && (
        <div id="modal-import-overlay" className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden" role="dialog" aria-modal="true">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-md flex items-center gap-2"><Upload className="w-4 h-4" /> Importer une liste CSV de collaborateurs</h3>
              <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Collez vos lignes d'employés ci-dessous pour les importer en masse dans l'annuaire de pointage. Utilisez le format de colonnes suivant séparé par des virgules :
              </p>
              
              <div className="bg-slate-100 font-mono text-[11px] p-3 rounded border border-slate-250 text-slate-700">
                nom,prénom,email,matricule
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Contenu CSV (Une ligne par employé, pas d'en-tête)</label>
                <textarea
                  value={csvRawText}
                  onChange={(e) => setCsvRawText(e.target.value)}
                  rows={6}
                  className="block w-full font-mono text-xs bg-white border border-slate-200 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Dupont,Jean,jean.dupont@test.com,EMP-100"
                ></textarea>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-250 text-slate-600 text-xs font-bold rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleImportCSV}
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
                >
                  Importer et Traiter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LIVE STATION QR CODE PREVIEW */}
      {previewStation && (
        <div id="modal-station-qr-preview-overlay" className="fixed inset-0 bg-slate-900/85 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-950 w-full max-w-sm rounded-3xl border border-slate-800 shadow-2xl p-6 relative flex flex-col items-center">
            
            <button 
              id="btn-close-qr-preview"
              onClick={() => { setPreviewStation(null); setPreviewQrToken(null); }}
              className="absolute top-4 right-4 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 p-2 rounded-xl transition cursor-pointer text-center flex items-center justify-center"
              title="Fermer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-6 self-start">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
                QR
              </div>
              <div className="text-left font-sans">
                <h4 className="text-white font-bold text-sm uppercase truncate max-w-[200px]">{previewStation.nom_station}</h4>
                <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Borne active en direct</p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl relative shadow-xl shadow-indigo-950/20 border border-slate-800 flex items-center justify-center mb-6">
              {previewQrToken ? (
                <div className="relative">
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(previewQrToken)}`}
                    alt="Live Station QR Code preview"
                    className="w-56 h-56 block object-contain"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-1.5 rounded-lg border border-slate-200 shadow text-center">
                    <span className="font-extrabold text-[10px] text-indigo-700 tracking-tighter col-span-full">PRÉSENCE</span>
                  </div>
                </div>
              ) : (
                <div className="w-56 h-56 bg-slate-900 flex flex-col items-center justify-center rounded-xl text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
                  <p className="text-[11px]">Génération du jeton...</p>
                </div>
              )}
            </div>

            {/* PROGRESS TIMER */}
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-1.5 rounded-full mb-4">
              <RefreshCw className="w-3 h-3 text-indigo-400 animate-spin" style={{ animationDuration: '3s' }} />
              <span className="text-slate-300 text-[11px] font-semibold font-sans">
                Nouveau QR dans : <strong className="font-mono text-indigo-400 font-bold">{previewCountdown}s</strong>
              </span>
            </div>

            <p className="text-[11px] text-slate-400 font-medium text-center leading-normal max-w-xs font-sans">
              Scannez ce code QR avec d'autres appareils ou l'appareil témoin pour tester le pointage direct. Il s'actualise automatiquement en temps réel pour des raisons de sécurité.
            </p>

            <button
              onClick={() => { setPreviewStation(null); setPreviewQrToken(null); }}
              className="mt-6 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-bold border border-slate-800 rounded-xl transition cursor-pointer font-sans"
            >
              Fermer l'aperçu
            </button>
            
          </div>
        </div>
      )}

      {/* MODAL: ADMIN PROFILE SETTINGS */}
      {showProfileModal && (
        <div id="modal-admin-profile-overlay" className="fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl overflow-hidden" role="dialog" aria-modal="true">
            <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
              <h3 className="font-bold text-md flex items-center gap-2">Modifier mon Profil Administrateur & Sécurité</h3>
              <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Nom & Prénom */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Prénom</label>
                  <input
                    type="text"
                    value={newPrenom}
                    onChange={(e) => { setNewPrenom(e.target.value); setProfileError(null); }}
                    className="block w-full text-xs bg-slate-50 border border-slate-250 px-3 py-2 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Nom</label>
                  <input
                    type="text"
                    value={newNom}
                    onChange={(e) => { setNewNom(e.target.value); setProfileError(null); }}
                    className="block w-full text-xs bg-slate-50 border border-slate-250 px-3 py-2 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {/* Mot de passe */}
              <div className="bg-blue-50/40 p-4 rounded-xl border border-blue-100 space-y-3">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Sécurité & Mot de Passe</span>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">Nouveau Mot de Passe</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setProfileError(null); }}
                      placeholder="Laisser vide pour ne pas modifier"
                      className="block w-full text-xs bg-white border border-slate-250 pl-3 pr-10 py-2.5 rounded focus:ring-1 focus:ring-blue-500 outline-none font-medium"
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

              {/* Foto URL Direct */}
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">URL de la photo de profil</label>
                <input
                  type="url"
                  value={newPhotoUrl}
                  onChange={(e) => { setNewPhotoUrl(e.target.value); setProfileError(null); }}
                  placeholder="https://images.unsplash.com/your-image.jpg"
                  className="block w-full text-xs bg-slate-50 border border-slate-250 px-3 py-2 rounded focus:ring-1 focus:ring-blue-500 outline-none"
                />
              </div>

              {/* Upload alternative */}
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1 flex items-center gap-1">
                  Téléverser un fichier local
                </label>
                <div className="relative group border border-dashed border-slate-200 hover:border-blue-500 rounded-lg transition bg-slate-50 hover:bg-slate-100 flex flex-col items-center justify-center p-3 text-center cursor-pointer">
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleProfileFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <span className="text-xs font-semibold text-slate-600">Sélectionner ou Glisser une photo</span>
                </div>
              </div>

              {/* Avatar Preview */}
              <div className="flex flex-col items-center justify-center bg-slate-100 p-3 rounded-xl border border-slate-200">
                <img 
                  src={newPhotoUrl || "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop"} 
                  alt="Aperçu du profil" 
                  className="w-16 h-16 rounded-xl object-cover ring-2 ring-blue-500 shadow animate-fadeIn"
                  referrerPolicy="no-referrer"
                />
              </div>

              {profileError && (
                <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-3 rounded text-xs font-medium">
                  ⚠️ {profileError}
                </div>
              )}

              <div className="pt-4 border-t border-slate-150 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-205 text-slate-600 text-xs font-bold rounded-lg transition"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition"
                  disabled={savingProfile}
                >
                  {savingProfile ? "Enregistrement..." : "Sauvegarder"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
