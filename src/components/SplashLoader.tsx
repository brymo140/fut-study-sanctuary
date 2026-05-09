export const SplashLoader = ({ label = "Loading..." }: { label?: string }) => {
  return (
    <div className="flex flex-col items-center justify-center py-10">
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/25 blur-xl animate-pulse" />
        <img
          // Use relative path as requested; fallback to a placeholder if missing.
          src="./highvault-icon.png"
          alt="HighVault"
          className="relative h-16 w-16 object-contain animate-heartbeat"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).src = "/favicon.png";
          }}
        />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{label}</p>
    </div>
  );
};
