import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Download,
  Receipt,
  Heart,
  Settings,
  LogOut,
  ArrowUpRight,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSession, useWishlist } from "@/lib/store";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/account", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/account/library", label: "Download library", icon: Download },
  { to: "/account/orders", label: "Orders & invoices", icon: Receipt },
  { to: "/account/wishlist", label: "Wishlist", icon: Heart },
  { to: "/account/settings", label: "Settings", icon: Settings },
];

export default function AccountLayout() {
  const { user, signOut } = useSession();
  const wishlist = useWishlist();
  const location = useLocation();

  if (!user) {
    return (
      <div className="container-x flex flex-col items-center py-24 text-center">
        <h1 className="text-[1.9rem]">Sign in to see your library</h1>
        <p className="mt-2 max-w-sm text-sm text-ink-2">
          Your purchases, licenses and invoices live behind a quick sign-in.
        </p>
        <Button asChild className="mt-6">
          <Link to="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container-x py-8 lg:py-10">
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="label-mono text-[0.5625rem] text-ink-3">Your account</p>
          <h1 className="mt-1 text-[1.9rem] leading-tight sm:text-[2.2rem]">
            Hello, {user.name.split(" ")[0]}.
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/browse">
              Browse items <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
          {user.role === "admin" && (
            <Button asChild size="sm">
              <Link to="/admin">Admin console</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[248px_1fr] xl:grid-cols-[264px_1fr]">
        <aside>
          <div className="rounded-lg border border-line bg-surface p-4">
            <div className="flex items-center gap-3">
              <Avatar initials={user.initials} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-[0.8125rem] font-medium">{user.name}</p>
                <p className="truncate text-[0.6875rem] text-ink-3">{user.email}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <Badge variant="sage" size="sm">
                Verified buyer
              </Badge>
              {wishlist.slugs.length > 0 && (
                <Badge variant="neutral" size="sm">
                  {wishlist.slugs.length} saved
                </Badge>
              )}
            </div>
          </div>

          <nav className="mt-3 space-y-0.5">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-2.5 rounded-sm px-3 py-2.5 text-[0.8125rem] transition-colors",
                    isActive
                      ? "bg-surface font-medium text-ink shadow-[inset_2px_0_0_var(--accent)]"
                      : "text-ink-2 hover:bg-surface-2/70 hover:text-ink",
                  )
                }
              >
                <n.icon className="size-4" />
                {n.label}
              </NavLink>
            ))}
            <button
              onClick={signOut}
              className="flex w-full items-center gap-2.5 rounded-sm px-3 py-2.5 text-[0.8125rem] text-ink-2 transition-colors hover:bg-surface-2/70 hover:text-ink"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </nav>

          <div className="mt-4 rounded-md border border-line bg-surface-2/50 p-3.5">
            <p className="text-[0.75rem] font-medium">Need a hand?</p>
            <p className="mt-1 text-[0.6875rem] leading-relaxed text-ink-2">
              License transfers, lost files, invoices — we answer within a day.
            </p>
            <Link
              to="/contact"
              className="mt-2 inline-flex items-center gap-1 text-[0.6875rem] font-medium text-accent-ink hover:underline dark:text-accent"
            >
              Contact support <ArrowUpRight className="size-3" />
            </Link>
          </div>
        </aside>

        <div key={location.pathname} className="min-w-0 animate-[fadeIn_.3s_ease]">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
