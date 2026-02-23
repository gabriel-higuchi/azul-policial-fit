import { ReactNode } from "react";
import BottomNav from "./BottomNav";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto relative">
      <main className="pb-24 px-4 pt-4">
        {children}
      </main>
      <BottomNav />
    </div>
  );
};

export default AppLayout;
