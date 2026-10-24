import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('UI error:', error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <div className="max-w-md bg-white rounded-3xl border border-red-200 p-8 text-center space-y-3 shadow-xl">
          <h2 className="text-lg font-bold text-red-700">Something went wrong on this page</h2>
          <p className="text-xs text-slate-600 font-mono break-words">{String(this.state.error?.message || this.state.error)}</p>
          <p className="text-xs text-slate-500">Your exam answers are saved on the server. Reload to continue.</p>
          <button onClick={() => window.location.reload()} className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm">
            Reload
          </button>
        </div>
      </div>
    );
  }
}
