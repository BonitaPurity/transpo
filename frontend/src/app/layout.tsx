import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import ClientOnly from "@/components/ClientOnly";
import MainLayout from "@/components/MainLayout";
import { AuthProvider } from "@/context/AuthContext";
import { SocketProvider } from "@/context/SocketContext";
import { Toaster } from "react-hot-toast";

const geist = Geist({
  subsets: ["latin"],
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#facc15",
};

export const metadata: Metadata = {
  title: "TRANSPO HUB | Uganda Modern Transit",
  description: "Modernizing regional bus transit in Uganda through strategic hubs.",
  authors: [{ name: "Evanz Henry" }],
  icons: {
    icon: [
      { url: '/favicon.ico' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geist.className} bg-white antialiased`} suppressHydrationWarning>
        <AuthProvider>
          <SocketProvider>
            <Toaster
              position="bottom-right"
              toastOptions={{
                className: 'bg-black text-white font-black text-sm border-2 border-yellow-400',
                duration: 4000,
              }}
            />
            <ClientOnly>
              <MainLayout>
                {children}
              </MainLayout>
            </ClientOnly>
          </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
