import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

// Note: no <StrictMode> wrapper — its dev-only double-mount trips react-chartjs-2's
// canvas reuse. StrictMode is a no-op in production, so this only affects dev noise.
ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
