'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { 
  LayoutDashboard, Inbox, Trash2, HardDrive, BarChart3, 
  Settings, Shield, Mail, LogOut, Brain, RefreshCw,
  ChevronRight, Bell, Menu, X, Zap
} from 'lucide-react';
import { useAuth } from '@/lib/hooks/useAuth';
import { cn } from '@/lib/utils';
import toast from 'react-hot-toast';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/inbox', label: 'Inbox Intelligence', icon: Inbox },
  { href: '/cleanup', label: 'AI Cleanup Studio', icon: Trash2 },
  { href: '/storage', label: 'Storage Forecast', icon: HardDrive },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/security', label: 'Security & Privacy', icon: Shield },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0A0A0F' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center animate-pulse"
               style={{ background: 'linear-gradient(135deg, #6366f1, #22d3ee)' }}>
            <Mail className="w-5 h-5 text-white" />
          </div>
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce"
                   style={{ background: '#6366f1', animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const handleLogout = async () => {
    await logout();
    toast.success('Signed out successfully');
  };

  const Sidebar = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-4 flex items-center gap-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
             style={{ background: 'linear-gradient(135deg, #6366f1, #22d3ee)' }}>
          <Mail className="w-4 h-4 text-white" />
        </div>
        <div>
          <span className="text-white font-semibold text-sm">MailSweep</span>
          <span className="gradient-text font-semibold text-sm"> AI</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={cn('nav-item', isActive && 'active')}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              <span>{item.label}</span>
              {isActive && <ChevronRight className="w-3 h-3 ml-auto opacity-60" />}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1"
             style={{ background: 'rgba(255,255,255,0.03)' }}>
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full" />
          ) : (
            <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium"
                 style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
              {user.name[0]}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">{user.name}</p>
            <p className="text-xs truncate" style={{ color: '#52525B' }}>{user.email}</p>
          </div>
        </div>

        <button onClick={handleLogout}
                className="nav-item w-full text-left"
                style={{ color: '#52525B' }}>
          <LogOut className="w-4 h-4" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#0A0A0F' }}>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-56 flex-shrink-0"
             style={{ background: '#0D0D14', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
        <Sidebar />
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -240 }} animate={{ x: 0 }} exit={{ x: -240 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="lg:hidden fixed left-0 top-0 bottom-0 z-50 w-56 flex flex-col"
              style={{ background: '#0D0D14', borderRight: '1px solid rgba(255,255,255,0.06)' }}
            >
              <button onClick={() => setSidebarOpen(false)}
                      className="absolute top-4 right-4 p-1.5 rounded-lg"
                      style={{ color: '#52525B' }}>
                <X className="w-4 h-4" />
              </button>
              <Sidebar />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-4 px-5 py-3 flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(10,10,15,0.8)', backdropFilter: 'blur(12px)' }}>
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 rounded-lg" style={{ color: '#A1A1AA' }}>
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1">
            <h1 className="text-sm font-medium text-white">
              {NAV_ITEMS.find(item => pathname.startsWith(item.href))?.label || 'MailSweep AI'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-7 h-7 rounded-full" />
            ) : (
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs"
                   style={{ background: 'rgba(99,102,241,0.2)', color: '#a5b4fc' }}>
                {user.name[0]}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="h-full"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
