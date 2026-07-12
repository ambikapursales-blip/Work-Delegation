"use client";

export default function AttendancePage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div
        className="mb-6 flex h-20 w-20 items-center justify-center rounded-full"
        style={{ background: "color-mix(in srgb, var(--color-warning) 12%, transparent)" }}
      >
        <svg
          className="h-10 w-10"
          style={{ color: "var(--color-warning)" }}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
      </div>
      <h1
        className="text-2xl font-bold tracking-tight mb-2"
        style={{ color: "var(--text-primary)" }}
      >
        This feature is currently unavailable
      </h1>
      <p
        className="text-sm max-w-md"
        style={{ color: "var(--text-secondary)" }}
      >
        The attendance module is under maintenance. Please check back later.
      </p>
    </div>
  );
}
