import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State { hasError: boolean; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() { return { hasError: true }; }

  componentDidCatch(error: unknown) {
    console.error("[ErrorBoundary]", error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center bg-background">
        <div className="text-5xl mb-4">🐝</div>
        <h1 className="text-2xl font-bold mb-2">
          <span style={{ color: "#3b8bf5" }}>HIGH</span>
          <span style={{ color: "#9b5cf6" }}>VAULT</span> hit a snag
        </h1>
        <p className="text-sm text-muted-foreground max-w-sm mb-6">
          Something went wrong. Please refresh the app.
        </p>
        <button
          onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
          className="bg-gradient-button border border-primary/40 text-primary text-sm font-semibold rounded-xl px-5 py-2.5"
        >
          Refresh HighVault
        </button>
      </div>
    );
  }
}
