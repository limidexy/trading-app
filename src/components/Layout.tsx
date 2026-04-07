import React, { useRef } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Brain,
  CalendarDays,
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
  const dateInputRef = useRef<HTMLInputElement | null>(null);

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

  const openDatePicker = () => {
    if (!dateInputRef.current) return;
    if (typeof dateInputRef.current.showPicker === 'function') {
      dateInputRef.current.showPicker();
    } else {
      dateInputRef.current.focus();
      dateInputRef.current.click();
    }
  };

  return (
    <div className="min-h-screen bg-surface pb-28 md:pb-0 md:pl-24">
      <header className="sticky top-0 z-40 border-b border-outline-variant/10 bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-20 max-w-5xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={openDatePicker}
              className="flex h-12 min-w-12 items-center justify-center rounded-2xl bg-surface-container-lowest text-primary shadow-sm transition-all hover:bg-surface-container"
            >
              <CalendarDays className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={openDatePicker}
              className="rounded-2xl bg-surface-container-lowest px-4 py-3 text-left shadow-sm transition-all hover:bg-surface-container"
            >
              <div className="text-2xl font-bold tracking-tight text-on-surface">{selectedDate.replace(/-/g, '/')}</div>
              <div className="text-xs text-on-surface-variant">点击切换日期</div>
            </button>

            <input
              ref={dateInputRef}
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              className="sr-only"
              aria-label="选择日期"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLogout}
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-on-surface-variant transition-colors hover:bg-surface-container hover:text-primary"
              title="退出登录"
            >
              <LogOut className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="flex h-11 w-11 items-center justify-center rounded-2xl text-on-surface-variant transition-colors hover:bg-surface-container"
              title="个人设置"
            >
              <Settings className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate('/profile')}
              className="ml-1 flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-outline-variant/20 bg-surface-container transition-all hover:ring-2 hover:ring-primary/40"
              title="个人设置"
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="头像" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <UserIcon className="h-5 w-5 text-on-surface-variant/40" />
              )}
            </button>
          </div>
        </div>
      </header>

      <nav className="fixed left-0 top-0 hidden h-full w-24 flex-col items-center gap-10 border-r border-outline-variant/10 bg-surface-container-lowest py-8 shadow-sm md:flex">
        <div className="text-2xl font-extrabold tracking-tighter text-primary">TA</div>
        <div className="flex flex-1 flex-col justify-center gap-6">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex min-h-16 w-16 flex-col items-center justify-center rounded-2xl text-xs font-bold transition-all',
                  isActive ? 'bg-primary text-on-primary shadow-lg' : 'text-on-surface-variant hover:bg-surface-container hover:text-primary',
                )
              }
              title={item.label}
            >
              <item.icon className={cn('mb-1 h-5 w-5', location.pathname === item.path && 'fill-current')} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      <main className="mx-auto w-full max-w-5xl px-4 py-6 md:px-6 md:py-8">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-outline-variant/10 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 shadow-[0_-4px_12px_rgba(211,47,47,0.05)] backdrop-blur-xl md:hidden">
        <div className="grid grid-cols-4 gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn(
                  'flex min-h-16 flex-col items-center justify-center rounded-2xl px-2 py-2 transition-all',
                  isActive ? 'bg-primary/8 font-bold text-primary' : 'text-on-surface-variant hover:bg-surface-container',
                )
              }
            >
              <item.icon className={cn('h-5 w-5', location.pathname === item.path && 'fill-current')} />
              <span className="mt-1 text-[11px] font-medium">{item.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
