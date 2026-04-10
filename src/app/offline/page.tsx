export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#FFF9F5] px-4 text-center">
      <span aria-hidden="true" className="text-[64px] mb-6">📶</span>
      <h1 className="text-3xl font-semibold text-[#171717] mb-3">Du är offline</h1>
      <p className="text-base text-[#171717]">
        Kontrollera din internetanslutning och försök igen.
      </p>
    </div>
  );
}
