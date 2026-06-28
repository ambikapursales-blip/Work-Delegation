import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";

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

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
