import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  collection as firestoreCollection, 
  doc as firestoreDoc, 
  getDoc as firestoreGetDoc, 
  getDocs as firestoreGetDocs, 
  setDoc as firestoreSetDoc, 
  updateDoc as firestoreUpdateDoc, 
  deleteDoc as firestoreDeleteDoc, 
  query as firestoreQuery, 
  where as firestoreWhere,
  limit as firestoreLimit
} from 'firebase/firestore';

// Load Firebase Config dynamically from process env or local file
const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
let firebaseConfig: any = {};

if (process.env.FIREBASE_PROJECT_ID || process.env.projectId) {
  firebaseConfig = {
    projectId: process.env.FIREBASE_PROJECT_ID || process.env.projectId,
    appId: process.env.FIREBASE_APP_ID || process.env.appId,
    apiKey: process.env.FIREBASE_API_KEY || process.env.apiKey,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || process.env.authDomain,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.storageBucket,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || process.env.messagingSenderId,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID || process.env.measurementId,
    firestoreDatabaseId: process.env.FIREBASE_FIRESTORE_DATABASE_ID || process.env.firestoreDatabaseId || "(default)"
  };
} else if (fs.existsSync(configPath)) {
  try {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  } catch (err) {
    console.error("Failed to parse firebase-applet-config.json:", err);
  }
}

// Initialize Firebase standard JS SDK
let firestoreDb: any = null;
try {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  firestoreDb = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== "(default)"
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);
  console.log("[Firebase Service] Initialized Firebase standard SDK successfully on server.");
} catch (e) {
  console.error("[Firebase Service] Failed to initialize Firebase standard SDK:", e);
}

const db = "(admin-db-context)";
const auth = { currentUser: null as any };

// Local JSON Fallback Configuration
let useLocalDb = false;
interface LocalDbStore {
  users: any[];
  presences: any[];
  stations: any[];
  qr_tokens: any[];
  access_codes: any[];
  [key: string]: any[];
}

let localDb: LocalDbStore = {
  users: [],
  presences: [],
  stations: [],
  qr_tokens: [],
  access_codes: []
};

const localDbPath = path.join(process.cwd(), 'database.json');

function loadLocalDb() {
  if (fs.existsSync(localDbPath)) {
    try {
      const data = fs.readFileSync(localDbPath, 'utf-8');
      localDb = JSON.parse(data);
      if (!localDb.users) localDb.users = [];
      if (!localDb.presences) localDb.presences = [];
      if (!localDb.stations) localDb.stations = [];
      if (!localDb.qr_tokens) localDb.qr_tokens = [];
      if (!localDb.access_codes) localDb.access_codes = [];
    } catch (e) {
      console.error("[Database Fallback] Local DB parsing error, using default:", e);
    }
  }
}

function saveLocalDb() {
  try {
    fs.writeFileSync(localDbPath, JSON.stringify(localDb, null, 2), 'utf-8');
  } catch (e) {
    console.error("[Database Fallback] Failed to save local DB:", e);
  }
}

async function testFirebaseConnection() {
  try {
    if (!firestoreDb) {
      throw new Error("Firestore DB has not been successfully initialized.");
    }
    console.log("[Database Service] Testing Google Cloud Firestore connectivity...");
    const q = firestoreQuery(firestoreCollection(firestoreDb, 'users'), firestoreLimit(1));
    await firestoreGetDocs(q);
    console.log("[Database Service] Google Cloud Firestore connected successfully! Bypassing local DB fallback.");
    useLocalDb = false;
  } catch (err) {
    console.warn("[Database Service] Google Cloud Firestore connection failed or permissions denied. Falling back to robust Local JSON Database (database.json).", err);
    useLocalDb = true;
    loadLocalDb();
  }
}

// Compatibility wrappers with the Client web API used throughout Express routes
function collection(db_ctx: any, path: string) {
  if (useLocalDb) {
    return { type: 'collection', path };
  }
  return firestoreCollection(firestoreDb, path);
}

function doc(db_ctx: any, path: string, id?: string) {
  if (useLocalDb) {
    return { type: 'document', path, id: id || '' };
  }
  if (id) {
    return firestoreDoc(firestoreDb, path, id);
  }
  return firestoreDoc(firestoreDb, path);
}

async function getDoc(docRef: any) {
  if (useLocalDb) {
    const colPath = docRef.path;
    const docId = docRef.id;
    const list = localDb[colPath] || [];
    const found = list.find((item: any) => item.id === docId);
    const exists = !!found;
    return {
      exists: () => exists,
      data: () => (exists ? JSON.parse(JSON.stringify(found)) : null),
      ref: docRef
    };
  }
  const snap = await firestoreGetDoc(docRef);
  return snap;
}

async function getDocs(queryOrCol: any) {
  if (useLocalDb) {
    const colPath = queryOrCol.path;
    let list = [...(localDb[colPath] || [])];
    
    // Apply filters if it's a query
    if (queryOrCol.type === 'query' && queryOrCol.constraints) {
      for (const filter of queryOrCol.constraints) {
        list = filter(list);
      }
    }
    
    const docs = list.map((item: any) => ({
      id: item.id || '',
      data: () => JSON.parse(JSON.stringify(item)),
      ref: { type: 'document', path: colPath, id: item.id }
    }));
    
    return {
      empty: docs.length === 0,
      docs: docs,
      forEach: (callback: any) => docs.forEach(callback)
    };
  }
  const snap = await firestoreGetDocs(queryOrCol);
  return snap;
}

async function setDoc(docRef: any, data: any) {
  if (useLocalDb) {
    const colPath = docRef.path;
    const docId = docRef.id;
    if (!localDb[colPath]) {
      localDb[colPath] = [];
    }
    const idx = localDb[colPath].findIndex((item: any) => item.id === docId);
    if (idx !== -1) {
      localDb[colPath][idx] = { ...data, id: docId };
    } else {
      localDb[colPath].push({ ...data, id: docId });
    }
    saveLocalDb();
  } else {
    await firestoreSetDoc(docRef, data);
  }
}

async function updateDoc(docRef: any, data: any) {
  if (useLocalDb) {
    const colPath = docRef.path;
    const docId = docRef.id;
    const list = localDb[colPath] || [];
    const idx = list.findIndex((item: any) => item.id === docId);
    if (idx !== -1) {
      localDb[colPath][idx] = { ...localDb[colPath][idx], ...data };
      saveLocalDb();
    } else {
      throw new Error(`Document with ID ${docId} not found in ${colPath}`);
    }
  } else {
    await firestoreUpdateDoc(docRef, data);
  }
}

async function deleteDoc(docRef: any) {
  if (useLocalDb) {
    const colPath = docRef.path;
    const docId = docRef.id;
    const list = localDb[colPath] || [];
    localDb[colPath] = list.filter((item: any) => item.id !== docId);
    saveLocalDb();
  } else {
    await firestoreDeleteDoc(docRef);
  }
}

function query(colRef: any, ...constraints: any[]) {
  if (useLocalDb) {
    const cList = colRef.constraints ? [...colRef.constraints] : [];
    for (const constraint of constraints) {
      if (typeof constraint === 'function') {
        cList.push(constraint);
      }
    }
    return {
      type: 'query',
      path: colRef.path,
      constraints: cList
    };
  }
  return firestoreQuery(colRef, ...constraints);
}

function where(field: string, op: any, value: any) {
  if (useLocalDb) {
    return (items: any[]) => {
      return items.filter((item: any) => {
        const itemVal = item[field];
        if (op === '==') {
          if (typeof value === 'string' && typeof itemVal === 'string') {
            return itemVal.toLowerCase().trim() === value.toLowerCase().trim();
          }
          return itemVal === value;
        }
        return false;
      });
    };
  }
  return firestoreWhere(field, op, value);
}

import { v2 as cloudinary } from 'cloudinary';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// TypeScript interfaces
interface DbUser {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  matricule: string;
  role: 'admin' | 'employee';
  photo_url: string;
  password_hash: string;
  created_at: string;
  must_change_password?: boolean;
  temp_password_token?: string;
}

interface DbPresence {
  id: string;
  user_id: string;
  user_nom: string;
  user_prenom: string;
  user_matricule: string;
  user_photo_url: string;
  station_id: string;
  station_nom: string;
  type: 'entry' | 'exit';
  date: string;
  heure: string;
  created_at: string;
}

interface DbStation {
  id: string;
  nom_station: string;
  token_access: string;
  active: boolean;
  created_at: string;
}

interface DbQrToken {
  id: string;
  station_id: string;
  token: string;
  created_at: string;
  expire_at: string;
}

interface DbAccessCode {
  id: string;
  code: string;
  station_id: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

// Seeding standard default data if Firestore is empty
async function seedFirestoreIfNeeded() {
  try {
    const usersCol = collection(db, 'users');
    let usersSnap;
    try {
      usersSnap = await getDocs(usersCol);
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'users');
      return;
    }

    if (usersSnap.empty) {
      console.log("Firestore 'users' is empty. Seeding Production Admin account for Cyr Kahiba...");
      const defaultUsers: DbUser[] = [
        {
          id: 'usr_admin_1',
          nom: 'Cyr',
          prenom: 'Kahiba',
          email: 'kahibacyr@gmail.com',
          matricule: 'ADM-001',
          role: 'admin',
          photo_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop',
          password_hash: 'presence123',
          created_at: new Date().toISOString()
        }
      ];

      for (const u of defaultUsers) {
        try {
          await setDoc(doc(db, 'users', u.id), u);
        } catch (e) {
          handleFirestoreError(e, OperationType.CREATE, `users/${u.id}`);
        }
      }
      console.log("Firestore production seeding done.");
    }
  } catch (err) {
    console.error("Error checking/seeding Firestore:", err);
  }
}

// Standard Firestore user helpers
async function findUserByEmail(email: string): Promise<DbUser | null> {
  try {
    const q = query(collection(db, 'users'), where('email', '==', email.toLowerCase().trim()));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data() as DbUser;
  } catch (e) {
    handleFirestoreError(e, OperationType.LIST, 'users');
    return null;
  }
}

async function findUserById(userId: string): Promise<DbUser | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return null;
    return userDoc.data() as DbUser;
  } catch (e) {
    handleFirestoreError(e, OperationType.GET, `users/${userId}`);
    return null;
  }
}

// Helper to simulate a confirmation email (logs destination credentials to developer console)
async function simulateConfirmationEmail(user: DbUser, tempToken: string, appHost: string, tempPass: string) {
  try {
    const emailId = 'mail_' + Math.random().toString(36).substr(2, 9);
    const activationLink = `${appHost}?action=init_password&token=${tempToken}`;
    
    const emailDoc = {
      id: emailId,
      to: user.email.toLowerCase().trim(),
      subject: `🔑 Initialisation de votre compte Presence - ${user.prenom} ${user.nom}`,
      prenom: user.prenom,
      nom: user.nom,
      activation_link: activationLink,
      temp_password: tempPass,
      created_at: new Date().toISOString(),
      status: 'unread',
      body: `Bonjour ${user.prenom},\n\nVotre compte de pointage "Presence" a été créé par l'administrateur.\nPour vous connecter, veuillez cliquer sur le lien ci-dessous pour initialiser votre mot de passe et valider votre profil :\n\n👉Lien d'activation : ${activationLink}\n\nIdentifiants temporaires :\nEmail : ${user.email}\nMot de passe temporaire : ${tempPass}\n\nÀ bientot sur Presence !`
    };
    
    console.log(`[Email Simulator] Sent confirmation email to ${user.email}. Link: ${activationLink}`);
    notifySseClients('email_received', emailDoc);
  } catch (err) {
    console.error("Error writing simulated email:", err);
  }
}

// SSE Real-time client manager
type SseClient = {
  id: string;
  res: any;
};
let sseClients: SseClient[] = [];

function notifySseClients(type: string, payload: any) {
  const dataString = JSON.stringify({ type, payload });
  sseClients.forEach(client => {
    try {
      client.res.write(`data: ${dataString}\n\n`);
    } catch (e) {
      // client stale
    }
  });
}

// API ROUTE: Real-time update stream (SSE)
app.get('/api/realtime', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  
  const clientId = 'cl_' + Math.random().toString(36).substr(2, 9);
  const newClient = { id: clientId, res };
  sseClients.push(newClient);
  
  res.write(`data: ${JSON.stringify({ type: 'ping', payload: 'connected' })}\n\n`);
  
  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// Session Token store in memory
const sessionStore = new Map<string, string>(); // token -> userId

// Authentication Middleware
async function authenticate(req: any, res: any, next: any) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Auth token missing' });
  }
  const token = authHeader.split(' ')[1];
  const userId = sessionStore.get(token);
  if (!userId) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  const user = await findUserById(userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }
  req.user = user;
  next();
}

// API ROUTE: Cloudinary Upload Gateway (With robust warning-fallback)
app.post('/api/cloudinary/upload', async (req, res) => {
  const { image } = req.body;
  if (!image) {
    return res.status(400).json({ error: "Aucune photo/document fourni." });
  }

  let cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  let apiKey = process.env.CLOUDINARY_API_KEY;
  let apiSecret = process.env.CLOUDINARY_API_SECRET;

  const url = process.env.CLOUDINARY_URL;
  if (url) {
    try {
      const match = url.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)/);
      if (match) {
        apiKey = match[1];
        apiSecret = match[2];
        cloudName = match[3];
      }
    } catch (e) {
      console.error("Failed to parse CLOUDINARY_URL:", e);
    }
  }

  if (cloudName) cloudName = cloudName.replace(/[<>]/g, '').trim();
  if (apiKey) apiKey = apiKey.replace(/[<>]/g, '').trim();
  if (apiSecret) apiSecret = apiSecret.replace(/[<>]/g, '').trim();

  if (!cloudName || !apiKey || !apiSecret) {
    console.warn("Cloudinary credentials not detected. Transparently falling back to standard encoding.");
    return res.json({ 
      url: image, 
      warning: "Note de production : Identifiants Cloudinary manquants dans le panneau Secrets de l'application." 
    });
  }

  try {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true
    });

    const result = await cloudinary.uploader.upload(image, {
      folder: 'attendance_system',
      resource_type: 'auto'
    });

    res.json({ url: result.secure_url });
  } catch (err: any) {
    console.error("Cloudinary upload failed:", err);
    res.status(500).json({ 
      error: "Échec du stockage sur Cloudinary.", 
      details: err.message || String(err) 
    });
  }
});

// API ROUTE: Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }
  
  const user = await findUserByEmail(email);
  if (!user || user.password_hash !== password) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
  
  const token = 'tok_' + Math.random().toString(36).substr(2, 12).toUpperCase();
  sessionStore.set(token, user.id);
  
  const { password_hash, ...safeUser } = user;
  res.json({ token, user: safeUser, must_change_password: !!user.must_change_password });
});

// API ROUTE: Get logged-in user details
app.get('/api/auth/me', authenticate, (req: any, res) => {
  const { password_hash, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

// API ROUTE: Update own profile
app.put('/api/auth/profile', authenticate, async (req: any, res) => {
  const { nom, prenom, photo_url, password } = req.body;

  try {
    const userRef = doc(db, 'users', req.user.id);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return res.status(404).json({ error: 'Utilisateur introuvable.' });
    }

    const userData = userSnap.data() as DbUser;

    if (nom !== undefined && nom.trim() !== '') {
      userData.nom = nom.trim();
    }
    if (prenom !== undefined && prenom.trim() !== '') {
      userData.prenom = prenom.trim();
    }
    if (photo_url !== undefined && photo_url.trim() !== '') {
      userData.photo_url = photo_url.trim();
    }
    if (password !== undefined && password.trim() !== '') {
      userData.password_hash = password.trim();
      userData.must_change_password = false;
    }

    await setDoc(userRef, userData);

    const { password_hash, ...safeUser } = userData;
    res.json({ message: 'Profil mis à jour avec succès !', user: safeUser });
  } catch (err: any) {
    console.error("Profile update error:", err);
    res.status(500).json({ error: 'Échec de la mise à jour.' });
  }
});

// API ROUTE: Initialisation du mot de passe via Token Email
app.post('/api/auth/init-password', async (req, res) => {
  const { token, password } = req.body;
  if (!token || !password) {
    return res.status(400).json({ error: 'Token et nouveau mot de passe requis' });
  }
  if (password.trim().length < 4) {
    return res.status(400).json({ error: 'Le mot de passe doit faire au moins 4 caractères' });
  }

  try {
    const q = query(collection(db, 'users'), where('temp_password_token', '==', token));
    const snap = await getDocs(q);
    if (snap.empty) {
      return res.status(400).json({ error: 'Lien d’activation invalide, déjà utilisé ou expiré.' });
    }

    const userDoc = snap.docs[0];
    const userData = userDoc.data() as DbUser;

    userData.password_hash = password.trim();
    userData.must_change_password = false;
    delete userData.temp_password_token;

    await setDoc(doc(db, 'users', userData.id), userData);

    console.log(`[Init Password] User ${userData.email} initialized their password successfully.`);
    res.json({ success: true, message: 'Votre mot de passe a été configuré avec succès ! Connectez-vous dès maintenant.' });
  } catch (err) {
    console.error("Password init error:", err);
    res.status(500).json({ error: "Échec de la configuration du mot de passe." });
  }
});

// API ROUTE: Get all simulated emails (for developer UI console/inbox simulator)
app.get('/api/simulated-emails', async (req, res) => {
  res.json([]);
});

// API ROUTE: Delete a simulated email
app.delete('/api/simulated-emails/:id', async (req, res) => {
  res.json({ success: true });
});

// API ROUTE: Get all employees (Admin Only)
app.get('/api/employees', authenticate, async (req: any, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès administrateur requis' });
  }
  try {
    const snap = await getDocs(collection(db, 'users'));
    const employees: any[] = [];
    snap.forEach(d => {
      const userData = d.data() as DbUser;
      const { password_hash, ...u } = userData;
      employees.push(u);
    });
    res.json(employees);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Impossible de charger la liste' });
  }
});

// API ROUTE: Add new employee
app.post('/api/employees', authenticate, async (req: any, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès administrateur requis' });
  }
  const { nom, prenom, email, matricule, role, photo_url, password } = req.body;
  if (!nom || !prenom || !email || !matricule) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }
  
  try {
    const emailExists = await findUserByEmail(email);
    const matriculeQuery = query(collection(db, 'users'), where('matricule', '==', matricule.trim()));
    const matriculeSnap = await getDocs(matriculeQuery);

    if (emailExists || !matriculeSnap.empty) {
      return res.status(400).json({ error: 'Un utilisateur avec cet email ou matricule existe déjà' });
    }
    
    const tempPass = password || Math.random().toString(36).substr(2, 8).toUpperCase();
    const tempToken = 'pwd_' + Math.random().toString(36).substr(2, 12);
    
    const newEmployee: DbUser = {
      id: 'usr_' + Math.random().toString(36).substr(2, 9),
      nom,
      prenom,
      email: email.trim(),
      matricule: matricule.trim(),
      role: role || 'employee',
      photo_url: photo_url || `https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop`,
      password_hash: tempPass,
      must_change_password: true,
      temp_password_token: tempToken,
      created_at: new Date().toISOString()
    };
    
    await setDoc(doc(db, 'users', newEmployee.id), newEmployee);
    
    const appHost = req.get('origin') || req.get('referer') || 'http://localhost:3000';
    await simulateConfirmationEmail(newEmployee, tempToken, appHost, tempPass);
    
    const { password_hash, ...safeEmployee } = newEmployee;
    notifySseClients('employee_added', safeEmployee);
    res.status(201).json({ ...safeEmployee, temp_password: tempPass });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Échec de l'ajout" });
  }
});

// API ROUTE: Import employees via CSV mock
app.post('/api/employees/import', authenticate, async (req: any, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès administrateur requis' });
  }
  const { list } = req.body;
  if (!list || !Array.isArray(list)) {
    return res.status(400).json({ error: 'Données incorrectes' });
  }
  
  try {
    const added: DbUser[] = [];
    const appHost = req.get('origin') || req.get('referer') || 'http://localhost:3000';
    
    for (const item of list) {
      if (!item.nom || !item.prenom || !item.email || !item.matricule) continue;
      
      const emailExists = await findUserByEmail(item.email);
      const matriculeQuery = query(collection(db, 'users'), where('matricule', '==', item.matricule.trim()));
      const matriculeSnap = await getDocs(matriculeQuery);
      
      if (emailExists || !matriculeSnap.empty) continue;
      
      const randomPics = [
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop',
        'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop'
      ];
      const itemPic = randomPics[Math.floor(Math.random() * randomPics.length)];
      
      const tempPass = 'IMP_' + Math.random().toString(36).substr(2, 5).toUpperCase();
      const tempToken = 'pwd_' + Math.random().toString(36).substr(2, 12);
      
      const u: DbUser = {
        id: 'usr_' + Math.random().toString(36).substr(2, 9),
        nom: item.nom,
        prenom: item.prenom,
        email: item.email.trim(),
        matricule: item.matricule.trim(),
        role: 'employee',
        photo_url: itemPic,
        password_hash: tempPass,
        must_change_password: true,
        temp_password_token: tempToken,
        created_at: new Date().toISOString()
      };
      
      await setDoc(doc(db, 'users', u.id), u);
      await simulateConfirmationEmail(u, tempToken, appHost, tempPass);
      
      const { password_hash, ...safeEmployee } = u;
      notifySseClients('employee_added', safeEmployee);
      added.push(u);
    }
    
    res.json({ message: `${added.length} employés importés avec succès et emails de validation envoyés.`, count: added.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Échec de l'importation" });
  }
});

// API ROUTE: Edit employee details
app.put('/api/employees/:id', authenticate, async (req: any, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès administrateur requis' });
  }
  const { nom, prenom, email, matricule, photo_url, role } = req.body;
  
  try {
    const userRef = doc(db, 'users', req.params.id);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    
    // Check email uniqueness
    if (email) {
      const emailUser = await findUserByEmail(email);
      if (emailUser && emailUser.id !== req.params.id) {
        return res.status(400).json({ error: 'Cet email est déjà utilisé par un autre employé' });
      }
    }
    
    // Check matricule uniqueness
    if (matricule) {
      const matQuery = query(collection(db, 'users'), where('matricule', '==', matricule.trim()));
      const matSnap = await getDocs(matQuery);
      const isDuplicate = matSnap.docs.some(d => d.id !== req.params.id);
      if (isDuplicate) {
        return res.status(400).json({ error: 'Ce matricule est déjà utilisé par un autre employé' });
      }
    }
    
    const currentData = userSnap.data() as DbUser;
    const updatedUser: DbUser = {
      ...currentData,
      nom: nom !== undefined ? nom : currentData.nom,
      prenom: prenom !== undefined ? prenom : currentData.prenom,
      email: email !== undefined ? email.trim() : currentData.email,
      matricule: matricule !== undefined ? matricule.trim() : currentData.matricule,
      role: role !== undefined ? role : currentData.role,
      photo_url: photo_url !== undefined ? photo_url : currentData.photo_url
    };
    
    await setDoc(userRef, updatedUser);
    const { password_hash, ...safeEmployee } = updatedUser;
    res.json(safeEmployee);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la modification' });
  }
});

// API ROUTE: Delete employee
app.delete('/api/employees/:id', authenticate, async (req: any, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès administrateur requis' });
  }
  
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte administrateur' });
  }
  
  try {
    const userRef = doc(db, 'users', req.params.id);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      return res.status(404).json({ error: 'Utilisateur introuvable' });
    }
    
    await deleteDoc(userRef);
    res.json({ success: true, message: 'Employé supprimé avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur de suppression' });
  }
});

// API ROUTE: Stations list
app.get('/api/stations', authenticate, async (req: any, res) => {
  try {
    const snap = await getDocs(collection(db, 'stations'));
    const stations: DbStation[] = [];
    snap.forEach(d => {
      stations.push(d.data() as DbStation);
    });
    res.json(stations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Impossible de charger les stations' });
  }
});

// API ROUTE: Stable public station detail lookup (No sensitive token exposure)
app.get('/api/stations/public/:id', async (req, res) => {
  try {
    const stationDoc = await getDoc(doc(db, 'stations', req.params.id));
    if (!stationDoc.exists()) {
      return res.status(404).json({ error: 'Station introuvable' });
    }
    const station = stationDoc.data() as DbStation;
    res.json({
      id: station.id,
      nom_station: station.nom_station,
      active: station.active
    });
  } catch (err) {
    res.status(500).json({ error: 'Erreur public station lookup' });
  }
});

// API ROUTE: Create station
app.post('/api/stations', authenticate, async (req: any, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès administrateur requis' });
  }
  const { nom_station } = req.body;
  if (!nom_station) {
    return res.status(400).json({ error: 'Nom de la station requis' });
  }
  
  const newStation: DbStation = {
    id: 'st_' + Math.random().toString(36).substr(2, 9),
    nom_station,
    token_access: 'tok_' + Math.random().toString(36).substr(2, 12),
    active: true,
    created_at: new Date().toISOString()
  };
  
  try {
    await setDoc(doc(db, 'stations', newStation.id), newStation);
    res.status(201).json(newStation);
  } catch (err) {
    res.status(500).json({ error: 'Impossible de créer la station' });
  }
});

// API ROUTE: Delete station
app.delete('/api/stations/:id', authenticate, async (req: any, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès administrateur requis' });
  }
  
  try {
    await deleteDoc(doc(db, 'stations', req.params.id));
    
    // Cleanup linked access codes
    const codesQuery = query(collection(db, 'access_codes'), where('station_id', '==', req.params.id));
    const codesSnap = await getDocs(codesQuery);
    for (const d of codesSnap.docs) {
      await deleteDoc(d.ref);
    }

    // Cleanup QR tokens
    const qrQuery = query(collection(db, 'qr_tokens'), where('station_id', '==', req.params.id));
    const qrSnap = await getDocs(qrQuery);
    for (const d of qrSnap.docs) {
      await deleteDoc(d.ref);
    }
    
    res.json({ success: true, message: 'Station supprimée avec succès' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur lors de la suppression' });
  }
});

// API ROUTE: Generate Station Access Code (Admin)
app.post('/api/stations/generate-code', authenticate, async (req: any, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Accès administrateur requis' });
  }
  const { station_id } = req.body;
  if (!station_id) {
    return res.status(400).json({ error: 'Station ID requis' });
  }
  
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  
  const newCode: DbAccessCode = {
    id: 'ac_' + Math.random().toString(36).substr(2, 9),
    code,
    station_id,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    is_active: true,
    created_at: new Date().toISOString()
  };
  
  try {
    // Deactivate previous codes matching this station
    const q = query(collection(db, 'access_codes'), where('station_id', '==', station_id));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data() as DbAccessCode;
      if (data.is_active) {
        await updateDoc(d.ref, { is_active: false });
      }
    }
    
    await setDoc(doc(db, 'access_codes', newCode.id), newCode);
    res.json(newCode);
  } catch (e) {
    res.status(500).json({ error: 'Erreur de génération du code' });
  }
});

// API ROUTE: Verify access code for station kiosks
app.post('/api/stations/verify-code', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ error: 'Code requis' });
  }
  
  try {
    const q = query(collection(db, 'access_codes'), where('code', '==', code), where('is_active', '==', true));
    const snap = await getDocs(q);
    
    const activeCodeDoc = snap.docs.find(d => {
      const data = d.data() as DbAccessCode;
      return new Date(data.expires_at) > new Date();
    });
    
    if (!activeCodeDoc) {
      return res.status(400).json({ error: "Code d'accès incorrect, expiré ou déjà utilisé" });
    }
    
    const activeCode = activeCodeDoc.data() as DbAccessCode;
    const stationDoc = await getDoc(doc(db, 'stations', activeCode.station_id));
    if (!stationDoc.exists()) {
      return res.status(400).json({ error: 'La station liée est inactive ou supprimée' });
    }
    
    const station = stationDoc.data() as DbStation;
    if (!station.active) {
      return res.status(400).json({ error: 'La station liée est inactive ou supprimée' });
    }
    
    // Deactivate the code as it is now used
    await updateDoc(activeCodeDoc.ref, { is_active: false });
    
    res.json({
      success: true,
      station,
      token_access: station.token_access
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur de vérification' });
  }
});

// API ROUTE: Fetch/Generate Dynamic QR Code Token for Kiosk Station
app.get('/api/stations/:id/qr-token', async (req, res) => {
  const { id } = req.params;
  
  try {
    const stationDoc = await getDoc(doc(db, 'stations', id));
    if (!stationDoc.exists()) {
      return res.status(404).json({ error: 'Station introuvable' });
    }
    
    const station = stationDoc.data() as DbStation;
    if (!station.active) {
      return res.status(404).json({ error: 'Station inactive' });
    }
    
    const currentTime = new Date();
    // Fetch qr tokens matching station
    const q = query(collection(db, 'qr_tokens'), where('station_id', '==', id));
    const snap = await getDocs(q);
    let activeToken: DbQrToken | undefined = undefined;
    
    snap.forEach(d => {
      const data = d.data() as DbQrToken;
      if (new Date(data.expire_at) > currentTime) {
        activeToken = data;
      }
    });
    
    if (!activeToken) {
      // Generate standard transient token
      const tokenStr = 'TK_' + Math.random().toString(36).substr(2, 10).toUpperCase();
      activeToken = {
        id: 'qr_' + Math.random().toString(36).substr(2, 9),
        station_id: id,
        token: tokenStr,
        created_at: currentTime.toISOString(),
        expire_at: new Date(Date.now() + 20 * 1000).toISOString()
      };
      
      await setDoc(doc(db, 'qr_tokens', activeToken.id), activeToken);
    }
    
    res.json({
      station_id: id,
      station_name: station.nom_station,
      token: activeToken.token,
      expire_at: activeToken.expire_at,
      timestamp: Date.now()
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur QR Token generation' });
  }
});

// API ROUTE: Fetch all attendances
app.get('/api/presences', authenticate, async (req: any, res) => {
  try {
    const snap = await getDocs(collection(db, 'presences'));
    const presences: DbPresence[] = [];
    snap.forEach(d => {
      presences.push(d.data() as DbPresence);
    });
    
    // Sort reverse chronological
    presences.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (req.user.role === 'admin') {
      res.json(presences);
    } else {
      const myPresences = presences.filter(p => p.user_id === req.user.id);
      res.json(myPresences);
    }
  } catch (e) {
    res.status(500).json({ error: 'Erreur au chargement des pointages' });
  }
});

// API ROUTE: Employee scan registration
app.post('/api/presences/scan', authenticate, async (req: any, res) => {
  const { station_id, token, target_user_id } = req.body;
  if (!station_id || !token) {
    return res.status(400).json({ error: 'Données de scan incomplètes (Station ID et Token requis)' });
  }
  
  try {
    const stationDoc = await getDoc(doc(db, 'stations', station_id));
    if (!stationDoc.exists()) {
      return res.status(400).json({ error: 'Station d\'enregistrement invalide ou désactivée' });
    }
    
    const station = stationDoc.data() as DbStation;
    if (!station.active) {
      return res.status(400).json({ error: 'Station d\'enregistrement invalide ou désactivée' });
    }
    
    // Validate token sequence matches
    const tokenQuery = query(collection(db, 'qr_tokens'), where('station_id', '==', station_id), where('token', '==', token));
    const tokenSnap = await getDocs(tokenQuery);
    if (tokenSnap.empty) {
      return res.status(400).json({ error: 'Date du QR Code invalide ou expirée (Actualisez le QR)' });
    }
    
    const dbToken = tokenSnap.docs[0].data() as DbQrToken;
    const expiration = new Date(dbToken.expire_at);
    const driftBuffer = 10 * 1000;
    if (Date.now() > expiration.getTime() + driftBuffer) {
      return res.status(400).json({ error: 'Ce QR Code a expiré. Veuillez scanner un code plus récent.' });
    }
    
    let scanUserId = req.user.id;
    if (req.user.role === 'admin' && target_user_id) {
      scanUserId = target_user_id;
    }
    
    const employee = await findUserById(scanUserId);
    if (!employee) {
      return res.status(400).json({ error: 'Employé introuvable' });
    }
    
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Fetch today's scans for that employee to determine Entry vs Exit sequence
    const presenceQuery = query(collection(db, 'presences'), where('user_id', '==', scanUserId), where('date', '==', todayStr));
    const presenceSnap = await getDocs(presenceQuery);
    const todayScans: DbPresence[] = [];
    presenceSnap.forEach(d => {
      todayScans.push(d.data() as DbPresence);
    });
    todayScans.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    
    let scanType: 'entry' | 'exit' = 'entry';
    if (todayScans.length > 0) {
      const lastScan = todayScans[todayScans.length - 1];
      scanType = lastScan.type === 'entry' ? 'exit' : 'entry';
    }
    
    const formatterTime = new Date();
    const timeStr = formatterTime.toTimeString().split(' ')[0];
    
    const newPresence: DbPresence = {
      id: 'pr_' + Math.random().toString(36).substr(2, 9),
      user_id: scanUserId,
      user_nom: employee.nom,
      user_prenom: employee.prenom,
      user_matricule: employee.matricule,
      user_photo_url: employee.photo_url,
      station_id: station.id,
      station_nom: station.nom_station,
      type: scanType,
      date: todayStr,
      heure: timeStr,
      created_at: formatterTime.toISOString()
    };
    
    await setDoc(doc(db, 'presences', newPresence.id), newPresence);
    notifySseClients('presence_added', newPresence);
    
    res.json({
      success: true,
      message: `${scanType === 'entry' ? 'Entrée' : 'Sortie'} enregistrée à ${timeStr} pour ${employee.prenom} ${employee.nom}`,
      presence: newPresence
    });
  } catch (e) {
    res.status(500).json({ error: 'Erreur lors du pointage' });
  }
});

async function startServer() {
  await testFirebaseConnection();
  await seedFirestoreIfNeeded();

  if (process.env.NODE_ENV !== 'production') {
    console.log("Configuring Vite Development Server Middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log("Serving build outputs in static mode...");
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QR Attendance Server successfully running on http://localhost:${PORT}`);
  });
}

startServer();
