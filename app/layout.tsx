import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { FirebaseClientProvider } from '../firebase/client-provider';

export const metadata: Metadata = {
  title: 'Sebastian.GauchoHearts.com',
  description: 'A personal portfolio and code playground for Sebastian.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${GeistSans.className} h-full font-body antialiased bg-background text-foreground`}>
        <FirebaseClientProvider>
          {children}
        </FirebaseClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
