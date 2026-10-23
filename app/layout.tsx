import type { Metadata } from "next";
import { Toaster } from "react-hot-toast";
import "@fontsource-variable/inter";
import "./globals.css";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_STORE_NAME || "FoxEats",
  description: "Sistema operativo del restaurante",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: { background: '#161922', color: '#FFFFFF', borderRadius: '10px' },
            success: { iconTheme: { primary: '#25835A', secondary: '#FFFFFF' } },
            error:   { iconTheme: { primary: '#C2362B', secondary: '#FFFFFF' } },
          }}
        />
      </body>
    </html>
  );
}
