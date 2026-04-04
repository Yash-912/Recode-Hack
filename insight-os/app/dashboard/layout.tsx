import TopNav from '@/components/TopNav';
import PhaseTracker from '@/components/PhaseTracker';
import PageTransition from '@/components/dashboard/PageTransition';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-obsidian text-white font-sans">
      {/* Phase Tracker - hidden on mobile */}
      <div className="hidden lg:block">
        <PhaseTracker />
      </div>
      
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Ambient radial glow in content area */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-red-900/10 rounded-full blur-[120px] pointer-events-none" />
        
        <TopNav />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 relative z-10 scroll-smooth">
          <PageTransition>
            {children}
          </PageTransition>
        </main>
      </div>
    </div>
  );
}

