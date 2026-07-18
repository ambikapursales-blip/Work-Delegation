import "./globals.css";

import "@/src/utils/cronInit.js";

import { AuthProvider } from "@/lib/auth-context";

import { ThemeProvider } from "@/lib/theme-context";

import { Inter } from "next/font/google";



const inter = Inter({

  subsets: ["latin"],

  display: "swap",

});



export const metadata = {

  title: "Task Delegation:Deepsikha",

  description: "Team delegation and task management for deepsikha enterprises",

  keywords: "task delegation, deepsikha, enterprises, team management",

  author: "Deepsikha Enterprises",

  creator: "Deepsikha Enterprises",

  icons: {

    icon: "/favicon.png",

  },

};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};



export default function RootLayout({ children }) {

  return (

    <html lang="en" className={inter.className}>

      <body>

        <AuthProvider>

          <ThemeProvider>{children}</ThemeProvider>

        </AuthProvider>

      </body>

    </html>

  );

}

