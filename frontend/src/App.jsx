import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import './App.css';

import Foyer from './pages/Foyer';
import Room from './pages/Room';
import Focus from './pages/Focus';
import ArtistProfile from './pages/ArtistProfile';
import SearchDesk from './pages/SearchDesk';
import Voting from './pages/Voting';
import CreateExhibition from './pages/CreateExhibition';
import KinshipMap from './pages/KinshipMap';
import Login from './pages/Login';
import Signup from './pages/Signup';
import AuthCallback from './pages/AuthCallback';
import Upload from './pages/Upload';
import EditProfile from './pages/EditProfile';
import Library from './pages/Library';
import ReadArticle from './pages/ReadArticle';
import WriteArticle from './pages/WriteArticle';
import MySubmissions from './pages/MySubmissions';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import NotFound from './pages/NotFound';
import Navigation from './components/Navigation';

// FIX: Guard component for auth-required pages
function RequireAuth({ session, children }) {
  if (!session) return <Navigate to="/login" replace />;
  return children;
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => {
    // FIX: Persist dark mode preference
    return localStorage.getItem('galerie-theme') !== 'light';
  });

  useEffect(() => {
    // FIX: Proper initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const toggleDarkMode = (val) => {
    const next = typeof val === 'boolean' ? val : !darkMode;
    setDarkMode(next);
    localStorage.setItem('galerie-theme', next ? 'dark' : 'light');
  };

  if (loading) {
    return (
      <div className={darkMode ? 'dark' : 'light'} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'var(--accent)', fontSize: '2rem' }}>✦</span>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className={darkMode ? 'dark' : 'light'}>
        <Navigation session={session} setDarkMode={toggleDarkMode} darkMode={darkMode} />
        <main>
          <Routes>
            <Route path="/" element={<Foyer session={session} />} />
            <Route path="/room/:id" element={<Room />} />
            <Route path="/artwork/:id" element={<Focus session={session} />} />
            <Route path="/artist/:username" element={<ArtistProfile session={session} />} />
            <Route path="/search" element={<SearchDesk />} />
            <Route path="/library" element={<Library />} />
            <Route path="/article/:id" element={<ReadArticle session={session} />} />
            <Route path="/kinship/:artworkId" element={<KinshipMap />} />
            <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login />} />
            <Route path="/signup" element={session ? <Navigate to="/" replace /> : <Signup />} />
            <Route path="/forgot-password" element={session ? <Navigate to="/" replace /> : <ForgotPassword />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/voting" element={<Voting session={session} />} />
            <Route path="/write" element={
              <RequireAuth session={session}><WriteArticle session={session} /></RequireAuth>
            } />
            <Route path="/upload" element={
              <RequireAuth session={session}><Upload session={session} /></RequireAuth>
            } />
            <Route path="/edit-profile" element={
              <RequireAuth session={session}><EditProfile session={session} /></RequireAuth>
            } />
            <Route path="/create-exhibition" element={
              <RequireAuth session={session}><CreateExhibition session={session} /></RequireAuth>
            } />
            <Route path="/my-submissions" element={
              <RequireAuth session={session}><MySubmissions session={session} /></RequireAuth>
            } />
            {/* 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
