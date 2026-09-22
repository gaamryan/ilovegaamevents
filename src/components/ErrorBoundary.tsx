import { Component, type ReactNode } from "react";

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Last-resort catch-all so an uncaught render error (most commonly a lazy
 * route chunk failing to load after a new deploy invalidates old hashed
 * filenames) shows a "please refresh" screen instead of a blank page.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Unhandled error rendering the app:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen gap-4 p-4 text-center">
          <p className="text-lg font-semibold">Something went wrong.</p>
          <p className="text-muted-foreground text-sm max-w-sm">
            Please refresh the page. If this keeps happening, try clearing your browser cache.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium"
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
