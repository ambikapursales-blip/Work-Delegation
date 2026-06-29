import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B1220] p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 text-8xl font-bold text-[#00FF88]">404</div>
        <h2 className="mb-2 text-2xl font-bold text-white">Page not found</h2>
        <p className="mb-8 text-gray-400">The page you are looking for does not exist.</p>
        <Link
          href="/dashboard"
          className="inline-block rounded-lg bg-[#00FF88] px-6 py-2.5 font-semibold text-black transition-colors hover:bg-[#00CC6A]"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
