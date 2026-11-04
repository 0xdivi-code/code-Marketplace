import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { SiteHeader } from "./site-header";
import { SiteFooter } from "./site-footer";
import { SearchDialog } from "./search-dialog";
import { CartDrawer } from "./cart-drawer";
import { ScrollProgress } from "./scroll-progress";

export function SiteLayout() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <ScrollProgress />
      <SiteHeader />
      <motion.main
        key={pathname.split("/")[1] || "home"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.28 }}
        className="flex-1"
      >
        <Outlet />
      </motion.main>
      <SiteFooter />
      <SearchDialog />
      <CartDrawer />
    </div>
  );
}
