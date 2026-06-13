export interface User {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  matricule: string;
  role: 'admin' | 'employee';
  photo_url: string;
  created_at: string;
  must_change_password?: boolean;
  temp_password_token?: string;
}

export interface Presence {
  id: string;
  user_id: string;
  user_nom: string;
  user_prenom: string;
  user_matricule: string;
  user_photo_url: string;
  station_id: string;
  station_nom: string;
  type: 'entry' | 'exit';
  date: string; // YYYY-MM-DD
  heure: string; // HH:MM:SS
  created_at: string;
}

export interface Station {
  id: string;
  nom_station: string;
  token_access: string;
  active: boolean;
  created_at: string;
}

export interface QrToken {
  id: string;
  station_id: string;
  token: string;
  created_at: string;
  expire_at: string;
  is_active: boolean;
}

export interface AccessCode {
  id: string;
  code: string;
  station_id: string;
  expires_at: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}
