import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { LanguageProvider } from '../context/LanguageContext';
import { useLanguage } from '../context/LanguageContext';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'RSH WhatsApp Chatbot Admin Dashboard',
  description: 'Admin dashboard for monitoring WhatsApp AI chatbot interactions',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={inter.className}>
        <LanguageProvider>
          <div className="min-h-screen flex flex-col">
            {children}
          </div>
        </LanguageProvider>
      </body>
    </html>
  );
}
