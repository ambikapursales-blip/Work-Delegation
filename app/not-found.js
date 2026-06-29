import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-base)] p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 text-8xl font-bold" style={{ color: "var(--primary)" }}>404</div>
        <h2 className="mb-2 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Page not found</h2>
        <p style={{ color: "var(--text-secondary)" }}>The page you are looking for does not exist.</p>
        <Link
          href="/dashboard"
          className="inline-block rounded-lg px-6 py-2.5 font-semibold text-white transition-all hover:opacity-90"
          style={{ backgroundColor: "var(--primary)" }}
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
