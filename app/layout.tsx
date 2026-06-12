import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Val Archives",
  description: "A Prompt Operating System for stories, RPGs, and worldbuilding.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=JSON.parse(localStorage.getItem('valArchivesTheme')||'{}');var b=typeof t.brightness==='number'?t.brightness:0;var a=t.accentColor||'#3b82f6';function L(a,b,t){return Math.round(a+(b-a)*t);}function H(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}function I(h1,h2,t){var c1=H(h1),c2=H(h2);return'rgb('+L(c1[0],c2[0],t)+','+L(c1[1],c2[1],t)+','+L(c1[2],c2[2],t)+')';}var f=b/100,r=document.documentElement;r.style.setProperty('--va-bg',I('#080808','#e5e7eb',f));r.style.setProperty('--va-surface',I('#111827','#f3f4f6',f));r.style.setProperty('--va-border',I('#1f2937','#d1d5db',f));r.style.setProperty('--va-text',I('#f9fafb','#111827',f));r.style.setProperty('--va-text-muted',I('#6b7280','#4b5563',f));r.style.setProperty('--va-accent',a);}catch(e){}})();`,
          }}
        />
      </head>
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  );
}