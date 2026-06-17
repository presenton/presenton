"use client";

import React from "react";

interface SlideErrorBoundaryProps {
  children: React.ReactNode;
  label?: string;
  resetKey?: unknown;
}

interface SlideErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class SlideErrorBoundary extends React.Component<
  SlideErrorBoundaryProps,
  SlideErrorBoundaryState
> {
  constructor(props: SlideErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: unknown): SlideErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown) {
    // Optionally log to an error reporting service
    console.error("Slide render error:", error);
  }

  componentDidUpdate(prevProps: SlideErrorBoundaryProps) {
    if (
      this.state.hasError &&
      !Object.is(prevProps.resetKey, this.props.resetKey)
    ) {
      this.setState({ hasError: false, errorMessage: "" });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="aspect-video w-full h-full bg-red-50 text-red-700 flex flex-col items-start justify-start p-4 space-y-2 rounded-md border border-red-200">
          <div className="text-sm font-semibold">
            {this.props.label ? `${this.props.label} render error` : "Slide render error"}
          </div>
          <pre className="text-xs whitespace-pre-wrap break-words max-h-full overflow-auto bg-red-100 rounded-md p-2 border border-red-200">
            {this.state.errorMessage}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default SlideErrorBoundary;
