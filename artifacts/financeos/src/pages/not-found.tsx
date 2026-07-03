import Link from "@/lib/next-compat";

export default function NotFound() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#F4F5F7] py-20">
      <div className="text-center">
        <h1 className="text-[20px] font-bold text-gray-900">Page not found</h1>
        <p className="mt-1 text-[12px] text-gray-500">
          The page you're looking for doesn't exist.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-[12px] font-medium text-white hover:bg-brand-dark transition-colors"
        >
          Back to Portfolio
        </Link>
      </div>
    </div>
  );
}
