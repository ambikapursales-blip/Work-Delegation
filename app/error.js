"use client";

export default function Error({ error, reset }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0B1220] p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 text-6xl">500</div>
        <h2 className="mb-2 text-2xl font-bold text-white">Something went wrong</h2>
        <p className="mb-8 text-gray-400">
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <button
          onClick={() => reset()}
          className="rounded-lg bg-[#00FF88] px-6 py-2.5 font-semibold text-black transition-colors hover:bg-[#00CC6A]"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
