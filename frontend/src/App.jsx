import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import './App.css';

// Pages
import Foyer from './pages/Foyer';
import Room from './pages/Room';
import Focus from './pages/Focus';
import ArtistProfile from './pages/ArtistProfile';
import SearchDesk from './pages/SearchDesk';
import Voting from './pages/Voting';
import CreateExhibition from './pages/CreateExhibition';
import KinshipMap from './pages/KinshipMap';
import Navigation from './components/Navigation';

function App() {
  const [session, setSession] = useState(null);
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <div className={darkMode ? 'dark' : 'light'}>
        <Navigation session={session} setDarkMode={setDarkMode} darkMode={darkMode} />
        <main>
          <Routes>
            <Route path="/" element={<Foyer session={session} />} />
            <Route path="/room/:id" element={<Room />} />
            <Route path="/artwork/:id" element={<Focus />} />
            <Route path="/artist/:username" element={<ArtistProfile />} />
            <Route path="/search" element={<SearchDesk />} />
            <Route path="/voting" element={<Voting session={session} />} />
            <Route path="/create-exhibition" element={<CreateExhibition session={session} />} />
            <Route path="/kinship/:artworkId" element={<KinshipMap />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;