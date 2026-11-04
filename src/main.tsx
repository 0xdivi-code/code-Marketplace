import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "sonner";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          className:
            "!rounded-md !border !border-line !bg-surface !text-ink !shadow-pop !text-[0.8125rem]",
        }}
      />
    </BrowserRouter>
  </React.StrictMode>,
);
