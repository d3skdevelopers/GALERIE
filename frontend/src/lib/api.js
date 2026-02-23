import { supabase } from './supabase';

export const API_URL = import.meta.env.VITE_API_URL || 'https://galerie-backend-theta.vercel.app';

// FIX: Central auth token getter — always fresh from Supabase session
export async function getAuthToken() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

// FIX: Consistent API fetch with auto auth
export async function apiFetch(endpoint, options = {}) {
  const url = `${API_URL}${endpoint}`;
  const token = await getAuthToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers
  };

  try {
    const response = await fetch(url, { ...options, headers });

    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try {
        const errData = await response.json();
        errMsg = errData.error || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error.message);
    throw error;
  }
}

// FIX: File upload with auto auth — no Content-Type header (browser sets it with boundary)
export async function apiUpload(endpoint, formData) {
  const url = `${API_URL}${endpoint}`;
  const token = await getAuthToken();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    });

    if (!response.ok) {
      let errMsg = `HTTP ${response.status}`;
      try {
        const errData = await response.json();
        errMsg = errData.error || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    return await response.json();
  } catch (error) {
    console.error(`Upload Error [${endpoint}]:`, error.message);
    throw error;
  }
}
