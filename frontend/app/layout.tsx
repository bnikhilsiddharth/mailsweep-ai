import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from 'react-hot-toast';

export const metadata: Metadata = {
  title: 'MailSweep AI - Email Intelligence Platform',
  description: 'AI-powered Gmail storage management and inbox intelligence. Recover storage, protect important emails, and understand your inbox like never before.',
  keywords: 'gmail cleanup, email storage, inbox management, AI email, email intelligence',
  metadataBase: new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'),
  openGraph: {
    title: 'MailSweep AI',
    description: 'AI-powered email intelligence and storage management',
    type: 'website',
  },
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen" style={{ background: '#0A0A0F' }}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1A1A24',
              color: '#F4F4F5',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '10px',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#10B981', secondary: '#0A0A0F' },
            },
            error: {
              iconTheme: { primary: '#EF4444', secondary: '#0A0A0F' },
            },
          }}
        />
      </body>
    </html>
  );
}
