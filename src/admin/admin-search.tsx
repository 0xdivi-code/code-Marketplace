import { useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import {
  LayoutDashboard,
  Package,
  FolderTree,
  ShoppingCart,
  Users,
  CreditCard,
  Ticket,
  Image as ImageIcon,
  Settings,
  Activity,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { products, orders, customers } from "@/data/catalog";

const pages = [
  { label: "Dashboard", to: "/admin", icon: LayoutDashboard },
  { label: "Products", to: "/admin/products", icon: Package },
  { label: "Categories", to: "/admin/categories", icon: FolderTree },
  { label: "Orders", to: "/admin/orders", icon: ShoppingCart },
  { label: "Customers", to: "/admin/customers", icon: Users },
  { label: "Payments", to: "/admin/payments", icon: CreditCard },
  { label: "Promotions", to: "/admin/promotions", icon: Ticket },
  { label: "Homepage & banners", to: "/admin/banners", icon: ImageIcon },
  { label: "Activity log", to: "/admin/activity", icon: Activity },
  { label: "Store settings", to: "/admin/settings", icon: Settings },
];

export function AdminSearch({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const navigate = useNavigate();
  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-[15%] max-w-xl translate-y-0 p-0" showClose={false}>
        <DialogTitle className="sr-only">Search admin</DialogTitle>
        <Command className="flex flex-col">
          <div className="border-b border-line px-4">
            <Command.Input
              autoFocus
              placeholder="Jump to a page, product, order or customer…"
              className="h-12 w-full bg-transparent text-[0.875rem] outline-none placeholder:text-ink-3"
            />
          </div>
          <Command.List className="max-h-80 overflow-y-auto p-1.5">
            <Command.Empty className="py-8 text-center text-[0.8125rem] text-ink-3">
              No matches.
            </Command.Empty>

            <Command.Group heading="Pages" className="px-1 py-1 [&_[cmdk-group-heading]]:label-mono [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[0.5rem] [&_[cmdk-group-heading]]:text-ink-3">
              {pages.map((p) => (
                <Command.Item
                  key={p.to}
                  value={p.label}
                  onSelect={() => go(p.to)}
                  className="flex cursor-pointer items-center gap-2.5 rounded-sm px-2 py-1.5 text-[0.8125rem] text-ink-2 data-[selected=true]:bg-surface-2 data-[selected=true]:text-ink"
                >
                  <p.icon className="size-3.5 text-ink-3" /> {p.label}
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Products" className="px-1 py-1 [&_[cmdk-group-heading]]:label-mono [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[0.5rem] [&_[cmdk-group-heading]]:text-ink-3">
              {products.slice(0, 6).map((p) => (
                <Command.Item
                  key={p.slug}
                  value={`product ${p.name}`}
                  onSelect={() => go(`/admin/products/${p.slug}`)}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-[0.8125rem] text-ink-2 data-[selected=true]:bg-surface-2 data-[selected=true]:text-ink"
                >
                  <span className="truncate">{p.name}</span>
                  <span className="font-mono text-[0.625rem] text-ink-3">${p.price / 100}</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Orders" className="px-1 py-1 [&_[cmdk-group-heading]]:label-mono [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[0.5rem] [&_[cmdk-group-heading]]:text-ink-3">
              {orders.slice(0, 4).map((o) => (
                <Command.Item
                  key={o.id}
                  value={`order ${o.id}`}
                  onSelect={() => go(`/admin/orders/${o.id}`)}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded-sm px-2 py-1.5 font-mono text-[0.75rem] text-ink-2 data-[selected=true]:bg-surface-2 data-[selected=true]:text-ink"
                >
                  {o.id}
                  <span className="text-[0.625rem] text-ink-3">${o.total / 100}</span>
                </Command.Item>
              ))}
            </Command.Group>

            <Command.Group heading="Customers" className="px-1 py-1 [&_[cmdk-group-heading]]:label-mono [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[0.5rem] [&_[cmdk-group-heading]]:text-ink-3">
              {customers.slice(0, 4).map((c) => (
                <Command.Item
                  key={c.id}
                  value={`customer ${c.name}`}
                  onSelect={() => go("/admin/customers")}
                  className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-[0.8125rem] text-ink-2 data-[selected=true]:bg-surface-2 data-[selected=true]:text-ink"
                >
                  {c.name}
                  <span className="truncate text-[0.625rem] text-ink-3">{c.email}</span>
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
