export function LoadingSkeleton() {
  return (
    <main className="min-h-screen bg-[#FFF9F5] px-4 py-8 sm:px-6">
      <div className="max-w-2xl mx-auto">
        <div className="h-7 w-40 bg-[#E5D5CC] rounded-md animate-pulse mb-6" />
        <ul className="flex flex-col gap-6">
          {[0, 1, 2].map((i) => (
            <li key={i} className="bg-[#E5D5CC] rounded-2xl h-28 animate-pulse" />
          ))}
        </ul>
      </div>
    </main>
  );
}
