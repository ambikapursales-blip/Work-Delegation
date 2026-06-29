"use client";

export default function Error({ error, reset }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-base)] p-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 text-6xl">500</div>
        <h2 className="mb-2 text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Something went wrong</h2>
        <p className="mb-8" style={{ color: "var(--text-secondary)" }}>
          {error.message || "An unexpected error occurred. Please try again."}
        </p>
        <button
          onClick={() => reset()}
          className="rounded-lg px-6 py-2.5 font-semibold text-white transition-colors"
          style={{ backgroundColor: "var(--primary)" }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "var(--primary-mid)"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "var(--primary)"}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
