import * as React from "react";
import QRCode from "qrcode";

/**
 * A QR code as inline SVG.
 *
 * SVG rather than a canvas or data URL so the code stays crisp at any size and
 * print, and so a wallet app reading it from a screenshot gets clean edges.
 * `qrcode` is already a dependency (it renders the admin's share links), so this
 * adds nothing to the bundle that was not there.
 */
export function QrCode({
  value,
  className,
  size = 200,
  label,
}: {
  value: string;
  className?: string;
  size?: number;
  label?: string;
}) {
  const [svg, setSvg] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    setFailed(false);
    QRCode.toString(value, {
      type: "svg",
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#1e2a24", light: "#ffffff" },
    })
      .then((out) => alive && setSvg(out))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [value]);

  if (failed) {
    return (
      <div
        className={`grid place-items-center rounded border border-dashed border-line bg-surface-2 text-center text-[0.625rem] text-ink-3 ${className ?? ""}`}
      >
        Could not render a QR code — copy the address instead.
      </div>
    );
  }

  if (!svg) {
    return <div className={`animate-pulse rounded bg-surface-2 ${className ?? ""}`} style={{ width: size, height: size }} />;
  }

  return (
    <div
      className={`overflow-hidden rounded bg-white p-1 ${className ?? ""}`}
      // The SVG string is generated locally from the address, never from input
      // the customer can influence in a way that could carry markup.
      dangerouslySetInnerHTML={{ __html: svg }}
      role="img"
      aria-label={label ?? "Payment QR code"}
    />
  );
}
