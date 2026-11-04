import * as React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  ShoppingBag,
  Heart,
  User,
  Menu,
  X,
  Sun,
  Moon,
  ChevronRight,
  LayoutDashboard,
  Download,
  LogOut,
  Package,
  Receipt,
  Settings,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/utils";
import { useCartTotals, useSession, useTheme, useUi, useWishlist } from "@/lib/store";
import { categories } from "@/data/catalog";
import { KilnLogo } from "./logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";

const primary = [
  { label: "Browse", to: "/browse" },
  { label: "Collections", to: "/collections" },
  { label: "Free code", to: "/free" },
  { label: "Journal", to: "/blog" },
];

export function SiteHeader() {
  const [scrolled, setScrolled] = React.useState(false);
  const [megaOpen, setMegaOpen] = React.useState(false);
  const { count } = useCartTotals();
  const { setSearch, setCart, mobileNavOpen, setMobileNav } = useUi();
  const { theme, toggle } = useTheme();
  const { user, signOut } = useSession();
  const wishlist = useWishlist();
  const location = useLocation();
  const closeTimer = React.useRef<number | undefined>(undefined);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  React.useEffect(() => {
    setMegaOpen(false);
    setMobileNav(false);
  }, [location.pathname, setMobileNav]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearch(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSearch]);

  const openMega = () => {
    window.clearTimeout(closeTimer.current);
    setMegaOpen(true);
  };
  const closeMega = () => {
    closeTimer.current = window.setTimeout(() => setMegaOpen(false), 160);
  };

  return (
    <>
      <div className="relative z-40 border-b border-line/70 bg-brand text-brand-ink">
        <div className="container-x flex h-9 items-center justify-between gap-4 text-[0.6875rem]">
          <p className="flex items-center gap-2 truncate">
            <span className="hidden size-1.5 shrink-0 rounded-full bg-[#8fbf9a] sm:block" />
            <span className="truncate">
              New drop: <strong className="font-semibold">Ledger — Billing Engine v1.1</strong> — usage
              metering, invoices and dunning.
            </span>
          </p>
          <div className="hidden shrink-0 items-center gap-4 text-brand-ink/75 sm:flex">
            <Link to="/page/support" className="hover:text-brand-ink">
              Support
            </Link>
            <Link to="/page/licensing" className="hover:text-brand-ink">
              Licensing
            </Link>
            <Link to="/changelog" className="hover:text-brand-ink">
              Changelog
            </Link>
          </div>
        </div>
      </div>

      <header
        className={cn(
          "sticky top-0 z-40 border-b transition-[background,box-shadow,border-color] duration-300",
          scrolled
            ? "border-line bg-paper/85 shadow-[0_1px_20px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl"
            : "border-transparent bg-paper",
        )}
      >
        <div className="container-x flex h-16 items-center gap-3 lg:h-[68px]">
          <Link to="/" aria-label="Kiln home" className="shrink-0">
            <KilnLogo />
          </Link>

          <nav className="ml-4 hidden items-center gap-0.5 lg:flex" aria-label="Main">
            <div onMouseEnter={openMega} onMouseLeave={closeMega} className="relative">
              <button
                onClick={() => setMegaOpen((v) => !v)}
                className={cn(
                  "flex items-center gap-1 rounded-full px-3 py-2 text-[0.8125rem] font-medium text-ink-2 transition-colors hover:text-ink",
                  megaOpen && "text-ink",
                )}
                aria-expanded={megaOpen}
              >
                Categories
                <ChevronRight
                  className={cn("size-3.5 transition-transform", megaOpen && "rotate-90")}
                />
              </button>
            </div>
            {primary.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                className={({ isActive }) =>
                  cn(
                    "rounded-full px-3 py-2 text-[0.8125rem] font-medium transition-colors hover:text-ink",
                    isActive ? "text-ink" : "text-ink-2",
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setSearch(true)}
              className="group hidden h-9 items-center gap-2 rounded-full border border-line bg-surface pl-3 pr-2 text-[0.8125rem] text-ink-3 transition-colors hover:border-line-strong hover:text-ink md:flex md:w-56 xl:w-64"
            >
              <Search className="size-3.5" />
              <span className="flex-1 text-left">Search code…</span>
              <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[0.5625rem]">
                ⌘K
              </kbd>
            </button>
            <button
              onClick={() => setSearch(true)}
              className="grid size-9 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink md:hidden"
              aria-label="Search"
            >
              <Search className="size-[1.05rem]" />
            </button>

            <button
              onClick={toggle}
              className="grid size-9 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={{ rotate: -70, opacity: 0, scale: 0.7 }}
                  animate={{ rotate: 0, opacity: 1, scale: 1 }}
                  exit={{ rotate: 70, opacity: 0, scale: 0.7 }}
                  transition={{ duration: 0.18 }}
                  className="grid place-items-center"
                >
                  {theme === "light" ? <Moon className="size-[1.05rem]" /> : <Sun className="size-[1.05rem]" />}
                </motion.span>
              </AnimatePresence>
            </button>

            <Link
              to="/account/wishlist"
              className="relative hidden size-9 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink sm:grid"
              aria-label="Wishlist"
            >
              <Heart className="size-[1.05rem]" />
              {wishlist.slugs.length > 0 && (
                <span className="absolute right-1 top-1 size-1.5 rounded-full bg-accent" />
              )}
            </Link>

            <button
              onClick={() => setCart(true)}
              className="relative grid size-9 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink"
              aria-label={`Cart${count ? `, ${count} items` : ""}`}
            >
              <ShoppingBag className="size-[1.05rem]" />
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-accent font-mono text-[0.5625rem] font-semibold text-white"
                >
                  {count}
                </motion.span>
              )}
            </button>

            {user ? (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="ml-1 rounded-full ring-offset-2 ring-offset-paper transition-shadow hover:ring-2 hover:ring-line">
                    <Avatar initials={user.initials} size="md" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={10}
                    className="z-50 w-60 rounded-md border border-line bg-surface p-1.5 shadow-pop data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
                  >
                    <div className="px-2.5 py-2">
                      <p className="truncate text-[0.8125rem] font-medium">{user.name}</p>
                      <p className="truncate text-[0.6875rem] text-ink-3">{user.email}</p>
                    </div>
                    <MenuSepp />
                    <MenuItem to="/account" icon={LayoutDashboard}>
                      Dashboard
                    </MenuItem>
                    <MenuItem to="/account/library" icon={Download}>
                      Download library
                    </MenuItem>
                    <MenuItem to="/account/orders" icon={Receipt}>
                      Order history
                    </MenuItem>
                    <MenuItem to="/account/wishlist" icon={Heart}>
                      Wishlist
                    </MenuItem>
                    {user.role === "admin" && (
                      <>
                        <MenuSepp />
                        <MenuItem to="/admin" icon={Settings}>
                          Admin console
                        </MenuItem>
                      </>
                    )}
                    <MenuSepp />
                    <DropdownMenu.Item
                      onSelect={() => signOut()}
                      className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-[0.8125rem] text-ink-2 outline-none transition-colors hover:bg-surface-2 hover:text-ink"
                    >
                      <LogOut className="size-4" /> Sign out
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            ) : (
              <Button asChild size="sm" variant="primary" className="ml-1 hidden sm:inline-flex">
                <Link to="/login">Sign in</Link>
              </Button>
            )}

            <button
              onClick={() => setMobileNav(true)}
              className="grid size-9 place-items-center rounded-full text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-[1.15rem]" />
            </button>
          </div>
        </div>

        {/* mega menu */}
        <AnimatePresence>
          {megaOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.16 }}
              onMouseEnter={openMega}
              onMouseLeave={closeMega}
              className="absolute inset-x-0 top-full hidden border-b border-line bg-paper/95 shadow-pop backdrop-blur-xl lg:block"
            >
              <div className="container-x grid grid-cols-12 gap-8 py-7">
                <div className="col-span-8 grid grid-cols-2 gap-x-6 gap-y-1">
                  {categories.map((c) => (
                    <Link
                      key={c.slug}
                      to={`/category/${c.slug}`}
                      onClick={() => setMegaOpen(false)}
                      className="group flex items-start gap-3 rounded-md px-2 py-2.5 transition-colors hover:bg-surface-2"
                    >
                      <span
                        className="mt-0.5 size-8 shrink-0 rounded-[7px]"
                        style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
                      />
                      <span>
                        <span className="block text-[0.8125rem] font-medium text-ink group-hover:text-ink">
                          {c.name}
                        </span>
                        <span className="block text-[0.6875rem] text-ink-3">{c.blurb}</span>
                      </span>
                    </Link>
                  ))}
                </div>
                <div className="col-span-4 rounded-md border border-line bg-surface p-4">
                  <p className="label-mono text-[0.5625rem] text-ink-3">Featured collection</p>
                  <p className="mt-2 font-display text-xl leading-tight">The Launch Stack</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-2">
                    Five items that take a SaaS from empty repo to first invoice.
                  </p>
                  <div className="mt-3 flex -space-x-2">
                    {categories.slice(0, 5).map((c) => (
                      <span
                        key={c.slug}
                        className="size-7 rounded-full border-2 border-surface"
                        style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
                      />
                    ))}
                  </div>
                  <Link
                    to="/collection/the-launch-stack"
                    onClick={() => setMegaOpen(false)}
                    className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-accent-ink hover:underline dark:text-accent"
                  >
                    View collection <ChevronRight className="size-3" />
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      <MobileNav open={mobileNavOpen} onClose={() => setMobileNav(false)} />
    </>
  );
}

function MenuSepp() {
  return <DropdownMenu.Separator className="my-1 h-px bg-line" />;
}

function MenuItem({
  to,
  icon: Icon,
  children,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu.Item asChild>
      <Link
        to={to}
        className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 text-[0.8125rem] text-ink-2 outline-none transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <Icon className="size-4" /> {children}
      </Link>
    </DropdownMenu.Item>
  );
}

function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useSession();
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-[#141210]/45 backdrop-blur-[2px] lg:hidden"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 34 }}
            className="fixed inset-y-0 right-0 z-50 flex w-[86%] max-w-sm flex-col bg-paper lg:hidden"
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <KilnLogo />
              <button
                onClick={onClose}
                className="grid size-9 place-items-center rounded-full text-ink-2 hover:bg-surface-2"
                aria-label="Close menu"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <nav className="space-y-0.5">
                {[...primary, { label: "About", to: "/about" }, { label: "Support", to: "/page/support" }].map(
                  (l) => (
                    <Link
                      key={l.to}
                      to={l.to}
                      onClick={onClose}
                      className="flex items-center justify-between rounded-sm px-2 py-3 text-[0.9375rem] font-medium text-ink hover:bg-surface-2"
                    >
                      {l.label}
                      <ChevronRight className="size-4 text-ink-3" />
                    </Link>
                  ),
                )}
              </nav>
              <div className="mt-5">
                <p className="label-mono mb-2 px-2 text-[0.5625rem] text-ink-3">Categories</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {categories.map((c) => (
                    <Link
                      key={c.slug}
                      to={`/category/${c.slug}`}
                      onClick={onClose}
                      className="flex items-center gap-2 rounded-sm border border-line p-2 text-[0.75rem] hover:bg-surface-2"
                    >
                      <span
                        className="size-6 shrink-0 rounded"
                        style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
                      />
                      <span className="truncate">{c.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
              <div className="mt-5 rounded-md border border-line bg-surface p-4">
                {user ? (
                  <>
                    <div className="flex items-center gap-2.5">
                      <Avatar initials={user.initials} />
                      <div className="min-w-0">
                        <p className="truncate text-[0.8125rem] font-medium">{user.name}</p>
                        <p className="truncate text-[0.6875rem] text-ink-3">{user.email}</p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/account" onClick={onClose}>
                          Dashboard
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="soft">
                        <Link to="/admin" onClick={onClose}>
                          Admin
                        </Link>
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[0.8125rem] font-medium">Sign in to your library</p>
                    <p className="mt-0.5 text-xs text-ink-2">Downloads, licenses and invoices in one place.</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button asChild size="sm">
                        <Link to="/login" onClick={onClose}>
                          Sign in
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link to="/register" onClick={onClose}>
                          Create account
                        </Link>
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="border-t border-line px-5 py-3">
              <div className="flex items-center justify-between text-[0.6875rem] text-ink-3">
                <span>© {new Date().getFullYear()} Kiln Studio</span>
                <div className="flex items-center gap-3">
                  <Link to="/page/terms" onClick={onClose} className="hover:text-ink">
                    Terms
                  </Link>
                  <Link to="/page/privacy" onClick={onClose} className="hover:text-ink">
                    Privacy
                  </Link>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

export { Badge };
