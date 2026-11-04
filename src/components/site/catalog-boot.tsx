import * as React from "react";
import { loadAdminData, loadCatalog, state as catalogState, useCatalog } from "@/lib/catalog-store";
import { useAuth } from "@/lib/use-auth";
import { saveCatalog } from "@/data/catalog";
import { refreshAuth } from "@/lib/api";

/**
 * Hydrates the catalogue from the database before the storefront paints.
 *
 * Showing the shell over a brief load keeps the design intact — no skeleton
 * screens, no empty grids — and a failed request falls back to the built-in
 * editorial content with a small, non-blocking notice.
 */
export function CatalogBoot({ children }: { children: React.ReactNode }) {
  const catalog = useCatalog();
  const auth = useAuth();
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    void loadCatalog(attempt > 0);
    // Session cookie check runs once for the whole app.
    void refreshAuth();
  }, [attempt]);

  // Admin-only collections load once a staff session is confirmed.
  React.useEffect(() => {
    if (auth.admin) void loadAdminData();
  }, [auth.admin, attempt]);

  // Keep the exported arrays in step with the store on every version bump.
  React.useEffect(() => {
    saveCatalog();
  }, [catalog]);

  const firstPaintBlocked = catalog.status === "loading" && catalog.loadedAt === null;

  return (
    <>
      {firstPaintBlocked && (
        <div
          aria-hidden
          className="fixed inset-0 z-[60] bg-paper transition-opacity duration-200"
        />
      )}

      {children}

      {catalog.status === "error" && catalog.loadedAt === null && (
        <div className="fixed bottom-4 left-1/2 z-[70] -translate-x-1/2">
          <div className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2 text-[0.8125rem] text-ink shadow-pop">
            <span>
              Couldn’t reach the catalogue.
              {catalogState.error ? <span className="text-muted"> {catalogState.error}</span> : null}
            </span>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="rounded-sm border border-line px-2 py-1 font-medium text-forest hover:bg-sage/40"
            >
              Retry
            </button>
          </div>
        </div>
      )}
    </>
  );
}
