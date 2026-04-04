import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import '../styles/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', style: ['italic', 'normal'] });

export const metadata: Metadata = {
  title: 'Insight-OS | AI-Powered Analytics',
  description:
    'Every analytics tool tells you what happened. Insight-OS tells you what it means. Privacy-first, AI-powered web analytics.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${playfair.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
