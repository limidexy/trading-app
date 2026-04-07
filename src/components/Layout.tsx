import React from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Brain,
  Calendar as CalendarIcon,
  ClipboardList,
  Lightbulb,
  LogOut,
  Settings,
  User as UserIcon,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDate } from '@/contexts/DateContext';
import { useUser } from '@/contexts/UserContext';

export default function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedDate, setSelectedDate } = useDate();
  const { profile, logout } = useUser();

  const navItems = [
    { path: '/operation', label: '今日操作', icon: Wallet },
    { path: '/reflection', label: '今日复盘', icon: Brain },
    { path: '/plan', label: '明日计划', icon: ClipboardList },
    { path: '/', label: '每日思考', icon: Lightbulb },
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface pb-24 md:pb-0 md:pl-20">
      <header className="sticky top-0 z-40 w-full border-b border-outline-variant/10 bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent p-0 text-lg font-bold tracking-tight outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
              title="退出登录"
            >
              <LogOut className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-surface-container"
              title="个人设置"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="ml-2 flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-outline-variant/20 bg-surface-container transition-all hover:ring-2 hover:ring-primary/40"
              title="个人资料"
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon className="h-5 w-5 text-on-surface-variant/40" />
              )}
            </button>
          </div>
        </div>
      </header>

      <nav className="fixed left-0 top-0 hidden h-full w-20 flex-col items-center gap-10 border-r border-outline-variant/10 bg-surface-container-lowest py-8 shadow-sm md:flex">
        <div className="text-2xl font-extrabold tracking-tighter text-primary">TA</div>
        <div className="flex flex-1 flex-col justify-center gap-8">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn('transition-colors', isActive ? 'text-primary' : 'text-on-surface-variant hover:text-primary')
              }
              title={item.label}
            >
              <item.icon className={cn('h-6 w-6', location.pathname === item.path && 'fill-current')} />
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 md:px-6 md:py-8">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 z-50 flex w-full items-center justify-around border-t border-outline-variant/10 bg-white/95 px-2 py-3 shadow-[0_-4px_12px_rgba(211,47,47,0.05)] backdrop-blur-xl md:hidden">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center px-2 transition-all',
                isActive ? 'scale-105 font-bold text-primary' : 'text-on-surface-variant opacity-70 hover:opacity-100',
              )
            }
          >
            <item.icon className={cn('h-5 w-5', location.pathname === item.path && 'fill-current')} />
            <span className="mt-1 text-[10px] font-medium uppercase tracking-wider">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
