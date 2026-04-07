import React from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Toaster } from 'sonner';
import { DateProvider } from './contexts/DateContext';
import { UserProvider, useUser } from './contexts/UserContext';
import Layout from './components/Layout';
import PwaInstallPrompt from './components/PwaInstallPrompt';
import DailyThinking from './pages/DailyThinking';
import TomorrowPlan from './pages/TomorrowPlan';
import TodayReflection from './pages/TodayReflection';
import TodayOperation from './pages/TodayOperation';
import Profile from './pages/Profile';
import Login from './pages/Login';
import Register from './pages/Register';

function ProtectedRoute() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <UserProvider>
      <DateProvider>
        <BrowserRouter>
          <Toaster position="top-center" richColors />
          <PwaInstallPrompt />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Layout />}>
                <Route index element={<DailyThinking />} />
                <Route path="plan" element={<TomorrowPlan />} />
                <Route path="reflection" element={<TodayReflection />} />
                <Route path="operation" element={<TodayOperation />} />
                <Route path="profile" element={<Profile />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </DateProvider>
    </UserProvider>
  );
}
