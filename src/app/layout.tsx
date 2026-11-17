import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Antigravity Agent Status',
  description: 'Live Minimalist Status & Widget Hub for Antigravity Agent',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#000000', color: '#FFFFFF', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
