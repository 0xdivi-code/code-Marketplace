import * as React from "react";
import { Link } from "react-router-dom";
import { BadgeCheck, Download, Printer, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, ApiError } from "@/lib/api";
import { toast } from "sonner";

interface Certificate {
  number: string;
  orderNumber: string;
  holder: string;
  product: string;
  productSlug: string;
  tier: string;
  tierName: string;
  seats: string;
  issuedAt: string;
  text: string;
}

/**
 * Licence certificates.
 *
 * Every paid order yields one certificate per product, so a customer can hand a
 * client proof of licence without screenshotting a receipt. Printing is the
 * export path: the browser's print-to-PDF is universally available and produces
 * a document that looks like a certificate, which is what people actually want.
 */
export default function CertificatesPage() {
  const [items, setItems] = React.useState<Certificate[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    api
      .get<{ certificates: Certificate[] }>("/account/certificates")
      .then((r) => alive && setItems(r.certificates))
      .catch((err) => alive && setError(err instanceof ApiError ? err.message : "Could not load certificates."));
    return () => {
      alive = false;
    };
  }, []);

  const downloadText = (cert: Certificate) => {
    const blob = new Blob([cert.text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${cert.number}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Certificate saved");
  };

  if (error) {
    return (
      <div className="surface-card rounded-lg p-8 text-center">
        <p className="text-[0.8125rem] text-ink-2">{error}</p>
      </div>
    );
  }

  if (!items) {
    return (
      <div className="grid place-items-center py-20 text-ink-3">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl leading-tight">Licence certificates</h2>
        <p className="mt-1 text-[0.8125rem] text-ink-2">
          Proof of purchase for each licence you hold. Show them to a client, attach them to an audit, or
          print to PDF.
        </p>
      </div>

      {items.length === 0 ? (
        <div className="surface-card rounded-lg p-10 text-center">
          <ShieldCheck className="mx-auto size-6 text-ink-3" />
          <p className="mt-3 font-display text-lg">No certificates yet</p>
          <p className="mt-1 text-[0.8125rem] text-ink-2">
            Each paid order issues one per product, the moment payment confirms.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link to="/browse">Browse the catalogue</Link>
          </Button>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((cert) => (
            <li key={cert.number} className="surface-card overflow-hidden rounded-lg">
              <div className="flex items-start justify-between gap-3 border-b border-line bg-surface-2/50 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="label-mono text-[0.5rem] text-ink-3">Certificate</p>
                  <p className="mt-0.5 truncate font-mono text-[0.75rem]">{cert.number}</p>
                </div>
                <Badge variant="brand" size="md" className="shrink-0 gap-1">
                  <BadgeCheck className="size-3" /> {cert.tierName}
                </Badge>
              </div>
              <div className="space-y-2 px-5 py-4">
                <p className="truncate text-[0.8125rem] font-medium">{cert.product}</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[0.6875rem]">
                  <dt className="text-ink-3">Licensed to</dt>
                  <dd className="truncate text-right">{cert.holder}</dd>
                  <dt className="text-ink-3">Seats</dt>
                  <dd className="text-right">{cert.seats || "—"}</dd>
                  <dt className="text-ink-3">Order</dt>
                  <dd className="text-right font-mono">{cert.orderNumber}</dd>
                  <dt className="text-ink-3">Issued</dt>
                  <dd className="text-right">
                    {new Date(cert.issuedAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}
                  </dd>
                </dl>
                <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                  <Button size="sm" variant="outline" onClick={() => downloadText(cert)}>
                    <Download className="size-3.5" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => window.print()}>
                    <Printer className="size-3.5" /> Print
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/item/${cert.productSlug}`}>View product</Link>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
