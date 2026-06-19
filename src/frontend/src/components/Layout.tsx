import React, { useState, useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import Header from './Header';
import NavSidebar from './NavSidebar';

import DashboardPage  from '../pages/DashboardPage';
import ReportsPage    from '../pages/ReportsPage';
import ForecastPage   from '../pages/ForecastPage';
import ChatPage       from '../pages/ChatPage';
import SettingsPage   from '../pages/SettingsPage';
import ProfilePage    from '../pages/ProfilePage';

const Layout: React.FC = () => {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setNavOpen(false); }, [location.pathname]);

  return (
    <div className="wf-app">
      <Header onHamburger={() => setNavOpen(p => !p)} />
      <div className="wf-body">
        <NavSidebar isOpen={navOpen} onClose={() => setNavOpen(false)} />
        {navOpen && <div className="wf-nav-backdrop" onClick={() => setNavOpen(false)} />}
        <main className="wf-main">
          <Routes>
            <Route path="/"         element={<DashboardPage />} />
            <Route path="/reports"  element={<ReportsPage />} />
            <Route path="/forecast" element={<ForecastPage />} />
            <Route path="/chat"     element={<ChatPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/profile"  element={<ProfilePage />} />
            <Route path="*"         element={<DashboardPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default Layout;
