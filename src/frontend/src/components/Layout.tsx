import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Header from './Header';
import NavSidebar from './NavSidebar';

import DashboardPage  from '../pages/DashboardPage';
import ReportsPage    from '../pages/ReportsPage';
import ForecastPage   from '../pages/ForecastPage';
import ChatPage       from '../pages/ChatPage';
import SettingsPage   from '../pages/SettingsPage';

const Layout: React.FC = () => (
  <div className="wf-app">
    <Header />
    <div className="wf-body">
      <NavSidebar />
      <main className="wf-main">
        <Routes>
          <Route path="/"         element={<DashboardPage />} />
          <Route path="/reports"  element={<ReportsPage />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/chat"     element={<ChatPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*"         element={<DashboardPage />} />
        </Routes>
      </main>
    </div>
  </div>
);

export default Layout;
