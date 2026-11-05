import * as React from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Users,
  CreditCard,
  Image as ImageIcon,
  Ticket,
  Boxes,
  FileText,
  Settings,
  Activity,
  Search,
  Bell,
  Moon,
  Sun,
  ChevronLeft,
  Menu,
  X,
  ArrowUpRight,
  Plus,
  Command,
  Loader2,
  Star,
  Webhook,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/lib/store";
import { useAuth } from "@/lib/use-auth";
import { AdminLogin } from "./admin-login";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { KilnMark } from "@/components/site/logo";
import { AdminSearch } from "./admin-search";

type NavItem = {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  end?: boolean;
  /** A key into the live overview counters, not a frozen number. */
  badge?: string;
};

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true }],
  },
  {
    label: "Catalogue",
    items: [
      { to: "/admin/products", label: "Products", icon: Package, badge: "products" },
      { to: "/admin/categories", label: "Categories", icon: FolderTree, badge: "categories" },
    ],
  },
  {
    label: "Commerce",
    items: [
      { to: "/admin/orders", label: "Orders", icon: ShoppingCart, badge: "orders" },
      { to: "/admin/customers", label: "Customers", icon: Users },
      { to: "/admin/payments", label: "Payments", icon: CreditCard },
      { to: "/admin/webhooks", label: "Webhooks", icon: Webhook },
      { to: "/admin/promotions", label: "Promotions", icon: Ticket, badge: "coupons" },
      { to: "/admin/bundles", label: "Bundles", icon: Boxes },
      { to: "/admin/reviews", label: "Reviews", icon: Star, badge: "pendingReviews" },
    ],
  },
  {
    label: "Content",
    items: [
      { to: "/admin/banners", label: "Homepage & banners", icon: ImageIcon },
      { to: "/admin/content", label: "Content", icon: FileText },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/admin/activity", label: "Activity log", icon: Activity },
      { to: "/admin/settings", label: "Store settings", icon: Settings },
    ],
  },
];

/**
 * Gate: the console never renders for anyone without an admin session.
 *
 * The cookie is httpOnly and admin-scoped, so a customer session cannot satisfy
 * this check even if a script were injected into the marketing site.
 */
export function AdminLayout() {
  const auth = useAuth();
  const [counts, setCounts] = React.useState<Record<string, number>>({});

  // Sidebar counters come from the same overview endpoint the dashboard uses.
  React.useEffect(() => {
    if (!auth.admin) return;
    let alive = true;
    fetch("/api/admin/overview", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data) return;
        setCounts({
          products: data.catalogue,
          categories: data.categories,
          orders: data.orders,
          coupons: data.activeCoupons,
          pendingReviews: data.pendingReviews,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [auth.admin]);

  if (auth.loading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-paper">
        <div className="flex items-center gap-2 text-sm text-ink-3">
          <Loader2 className="size-4 animate-spin" /> Checking your session…
        </div>
      </div>
    );
  }

  if (!auth.admin) {
    return <AdminLogin />;
  }

  return <AdminShell counts={counts} />;
}

type Notice = { id: string; actor: string; action: string; target: string | null; at: string };

/** "3m ago" — good enough for a notification list, no dependency needed. */
function relativeTime(iso: string): string {
  const secs = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function AdminShell({ counts }: { counts: Record<string, number> }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<Notice[]>([]);
  const { theme, toggle } = useTheme();
  const location = useLocation();

  React.useEffect(() => setMobileOpen(false), [location.pathname]);

  // The bell shows the real activity log, not decoration.
  React.useEffect(() => {
    let alive = true;
    fetch("/api/admin/activity", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!alive || !data?.activity) return;
        setNotifications(
          (data.activity as { id: string; actor: string; action: string; target: string | null; createdAt: string }[])
            .slice(0, 5)
            .map((a) => ({
              id: a.id,
              actor: a.actor,
              action: a.action,
              target: a.target,
              at: a.createdAt,
            })),
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [location.pathname]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const current = groups.flatMap((g) => g.items).find((i) => i.to === location.pathname);

  return (
    <div className="min-h-dvh bg-paper">
      {/* -------------------------------------------------- sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex",
          collapsed ? "w-[68px]" : "w-60",
        )}
      >
        <div className={cn("flex h-14 items-center border-b border-line px-3", collapsed ? "justify-center" : "justify-between")}>
          {collapsed ? (
            <span className="grid size-8 place-items-center rounded-[9px] bg-brand text-brand-ink">
              <KilnMark className="size-4.5" />
            </span>
          ) : (
            <Link to="/admin" className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-[9px] bg-brand text-brand-ink">
                <KilnMark className="size-4.5" />
              </span>
              <span className="flex flex-col leading-none">
                <span className="font-display text-[0.9375rem] tracking-[-0.02em]">Kiln</span>
                <span className="label-mono mt-0.5 text-[0.4375rem] text-ink-3">admin console</span>
              </span>
            </Link>
          )}
          {!collapsed && (
            <button
              onClick={() => setCollapsed(true)}
              className="grid size-7 place-items-center rounded text-ink-3 transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label="Collapse sidebar"
            >
              <ChevronLeft className="size-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {collapsed && (
            <button
              onClick={() => setCollapsed(false)}
              className="mx-auto mb-2 grid size-8 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink"
              aria-label="Expand sidebar"
            >
              <ChevronLeft className="size-4 rotate-180" />
            </button>
          )}
          {groups.map((g) => (
            <div key={g.label} className="mb-3">
              {!collapsed && (
                <p className="label-mono px-2 pb-1.5 pt-1 text-[0.5rem] text-ink-3">{g.label}</p>
              )}
              <ul className="space-y-0.5">
                {g.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      title={collapsed ? item.label : undefined}
                      className={({ isActive }) =>
                        cn(
                          "group flex items-center gap-2.5 rounded-sm px-2 py-[7px] text-[0.8125rem] transition-colors",
                          isActive
                            ? "bg-brand-soft font-medium text-ink dark:bg-brand-soft"
                            : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                          collapsed && "justify-center px-0",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon
                            className={cn(
                              "size-4 shrink-0",
                              isActive ? "text-accent" : "text-ink-3 group-hover:text-ink-2",
                            )}
                          />
                          {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                          {!collapsed && item.badge && counts[item.badge] != null && (
                            <span className="font-mono text-[0.5625rem] text-ink-3">{counts[item.badge]}</span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-line p-2">
          <Link
            to="/"
            className={cn(
              "flex items-center gap-2 rounded-sm px-2 py-2 text-[0.75rem] text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink",
              collapsed && "justify-center",
            )}
          >
            <ArrowUpRight className="size-3.5 shrink-0" />
            {!collapsed && "View storefront"}
          </Link>
        </div>
      </aside>

      {/* -------------------------------------------------- mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            />
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 360, damping: 34 }}
              className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-surface lg:hidden"
            >
              <div className="flex h-14 items-center justify-between border-b border-line px-4">
                <span className="flex items-center gap-2">
                  <span className="grid size-8 place-items-center rounded-[9px] bg-brand text-brand-ink">
                    <KilnMark className="size-4.5" />
                  </span>
                  <span className="font-display text-[0.9375rem]">Kiln admin</span>
                </span>
                <button onClick={() => setMobileOpen(false)} className="text-ink-3">
                  <X className="size-4" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto p-2">
                {groups.map((g) => (
                  <div key={g.label} className="mb-3">
                    <p className="label-mono px-2 pb-1 text-[0.5rem] text-ink-3">{g.label}</p>
                    {g.items.map((i) => (
                      <NavLink
                        key={i.to}
                        to={i.to}
                        end={i.end}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2.5 rounded-sm px-2 py-2 text-[0.8125rem]",
                            isActive ? "bg-brand-soft font-medium" : "text-ink-2",
                          )
                        }
                      >
                        <i.icon className="size-4 text-ink-3" /> {i.label}
                      </NavLink>
                    ))}
                  </div>
                ))}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* -------------------------------------------------- main */}
      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[68px]" : "lg:pl-60")}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-paper/90 px-4 backdrop-blur-xl sm:px-6">
          <button
            onClick={() => setMobileOpen(true)}
            className="grid size-8 place-items-center rounded text-ink-2 hover:bg-surface-2 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="size-4" />
          </button>

          <div className="hidden items-center gap-1.5 text-[0.75rem] text-ink-3 sm:flex">
            <span>Admin</span>
            <span>/</span>
            <span className="font-medium text-ink">{current?.label ?? "Dashboard"}</span>
          </div>

          <button
            onClick={() => setSearchOpen(true)}
            className="ml-auto flex h-8 items-center gap-2 rounded-sm border border-line bg-surface pl-2.5 pr-2 text-[0.75rem] text-ink-3 transition-colors hover:border-line-strong hover:text-ink md:w-56"
          >
            <Search className="size-3.5" />
            <span className="hidden flex-1 text-left md:block">Search admin…</span>
            <kbd className="hidden rounded border border-line px-1 font-mono text-[0.5rem] md:block">⌘K</kbd>
          </button>

          <button
            onClick={toggle}
            className="grid size-8 place-items-center rounded text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label="Toggle theme"
          >
            {theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />}
          </button>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="relative grid size-8 place-items-center rounded text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label="Notifications">
                <Bell className="size-4" />
                {notifications.length > 0 && (
                  <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-accent" />
                )}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={8}
                className="z-50 w-80 rounded-md border border-line bg-surface p-2 shadow-pop"
              >
                <p className="px-2 py-1.5 text-[0.75rem] font-medium">Recent activity</p>
                {notifications.length === 0 ? (
                  <p className="px-2 py-3 text-[0.6875rem] text-ink-3">Nothing has happened yet.</p>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="rounded-sm px-2 py-1.5 hover:bg-surface-2">
                      <p className="text-[0.75rem] text-ink">
                        <span className="text-ink-3">{n.actor}</span> {n.action}
                      </p>
                      <p className="text-[0.625rem] text-ink-3">
                        {n.target ? `${n.target} · ` : ""}
                        {relativeTime(n.at)}
                      </p>
                    </div>
                  ))
                )}
                <Link
                  to="/admin/activity"
                  className="mt-1 block rounded-sm px-2 py-1.5 text-[0.6875rem] text-ink-2 hover:bg-surface-2 hover:text-ink"
                >
                  Full activity log →
                </Link>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>

          <div className="ml-1 flex items-center gap-2 border-l border-line pl-3">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-2">
                  <Avatar initials="KA" size="sm" />
                  <span className="hidden leading-none sm:block">
                    <span className="block text-[0.75rem] font-medium">Kiln Admin</span>
                    <span className="block text-[0.5625rem] text-ink-3">Owner</span>
                  </span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={8}
                  className="z-50 w-52 rounded-md border border-line bg-surface p-1.5 shadow-pop"
                >
                  {[
                    { l: "Store settings", to: "/admin/settings" },
                    { l: "View storefront", to: "/" },
                    { l: "Account", to: "/account" },
                  ].map((i) => (
                    <DropdownMenu.Item key={i.l} asChild>
                      <Link
                        to={i.to}
                        className="block rounded-sm px-2 py-1.5 text-[0.8125rem] text-ink-2 outline-none hover:bg-surface-2 hover:text-ink"
                      >
                        {i.l}
                      </Link>
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6 sm:py-6">
          <Outlet />
        </main>
      </div>

      <AdminSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.5rem] leading-tight tracking-[-0.02em]">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[0.8125rem] text-ink-2">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
