import { cn } from "@/lib/utils";

export const ActionableMainContent: React.FC<{ className?: string; children: React.ReactNode }> = ({ className, children }) => {
  return (
    <div className={cn("flex-1 pt-10 flex flex-col", className)}>
      {children}
    </div>
  );
};