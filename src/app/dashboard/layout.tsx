import Sidebar from "@/components/dashboard/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#FAF8F3]">
      <Sidebar />
      <main className="max-w-[1100px] mx-auto px-4 sm:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
