// Global error boundary — catches any unhandled render error and shows a
// friendly recovery screen instead of a blank white crash.
import { Component, ReactNode } from "react";

interface State { hasError: boolean; }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() { return { hasError: true }; }

  componentDidCatch(error: unknown) {
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-background">
        <div className="text-5xl mb-4">🍯🐝</div>
        <h1 className="text-2xl font-bold mb-2">
          <span style={{ color: "#3b8bf5" }}>HIGH</span>
          <span style={{ color: "#9b5cf6" }}>VAULT</span> hit a snag
        </h1>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          Something went wrong. Please refresh the app.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-gradient-button border border-primary/40 text-primary text-sm font-semibold rounded-xl px-5 py-2.5"
        >
          Refresh HighVault
        </button>
      </div>
    );
  }
}
