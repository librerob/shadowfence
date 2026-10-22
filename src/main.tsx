import { createRoot } from "react-dom/client";
import { Component, type ReactNode } from "react";
import { App } from "./ui/App";
import "./ui/styles.css";
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="fatal">
        <h1>ShadowFence could not open.</h1>
        <p>
          Reload this tab to lock the current session and try again. Your stored
          vault has not been deleted.
        </p>
        <button onClick={() => location.reload()}>Reload</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
