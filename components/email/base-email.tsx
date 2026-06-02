// Translator escopado ao namespace "emails", repassado pelos serviços que
// renderizam os e-mails (fora do request scope). Tipo estrutural para evitar
// acoplamento ao generic do createTranslator.
export type EmailT = {
  (key: string, values?: Record<string, string | number | boolean | Date>): string;
  rich: (
    key: string,
    values?: Record<string, React.ReactNode | ((chunks: React.ReactNode) => React.ReactNode)>,
  ) => React.ReactNode;
  markup: (
    key: string,
    values?: Record<string, string | number | boolean | ((chunks: string) => string)>,
  ) => string;
};

/**
 * Base layout shared by all transactional emails.
 * Uses only inline styles — required for broad email client support.
 */
export function BaseEmail({
  clinicName,
  previewText,
  t,
  locale = "pt-BR",
  children,
}: {
  clinicName: string;
  previewText?: string;
  t: EmailT;
  locale?: string;
  children: React.ReactNode;
}) {
  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{clinicName}</title>
      </head>
      <body style={{ margin: 0, padding: 0, backgroundColor: "#F8FAF9", fontFamily: "Arial, Helvetica, sans-serif" }}>

        {/* Preview text (hidden, shows in inbox) */}
        {previewText && (
          <div style={{ display: "none", maxHeight: 0, overflow: "hidden", color: "#F8FAF9", fontSize: 1 }}>
            {previewText}
          </div>
        )}

        {/* Outer wrapper */}
        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: "#F8FAF9", padding: "32px 16px" }}>
          <tbody>
            <tr>
              <td align="center">
                <table width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: 560 }}>
                  <tbody>

                    {/* Header */}
                    <tr>
                      <td style={{
                        backgroundColor: "#0B1F3A",
                        borderRadius: "12px 12px 0 0",
                        padding: "24px 32px",
                        textAlign: "center",
                      }}>
                        <span style={{ color: "#FFFFFF", fontSize: 18, fontWeight: 700, letterSpacing: "-0.5px" }}>
                          {clinicName}
                        </span>
                      </td>
                    </tr>

                    {/* Body */}
                    <tr>
                      <td style={{
                        backgroundColor: "#FFFFFF",
                        padding: "32px",
                        borderLeft: "1px solid #E8E6E0",
                        borderRight: "1px solid #E8E6E0",
                      }}>
                        {children}
                      </td>
                    </tr>

                    {/* Footer */}
                    <tr>
                      <td style={{
                        backgroundColor: "#F4F3EF",
                        borderRadius: "0 0 12px 12px",
                        border: "1px solid #E8E6E0",
                        borderTop: "none",
                        padding: "20px 32px",
                        textAlign: "center",
                      }}>
                        <p style={{ margin: 0, fontSize: 11, color: "#A09E98", lineHeight: 1.6 }}>
                          {t.rich("base.footerSentBy", { clinic: clinicName, b: (c: React.ReactNode) => <strong>{c}</strong> })}<br />
                          {t("base.footerIgnore")}
                        </p>
                      </td>
                    </tr>

                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  );
}

/** Reusable heading inside email body */
export function EmailHeading({ children }: { children: React.ReactNode }) {
  return (
    <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 700, color: "#0F1A2E", letterSpacing: "-0.5px" }}>
      {children}
    </h1>
  );
}

/** Reusable body paragraph */
export function EmailText({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.7, color: muted ? "#A09E98" : "#374151" }}>
      {children}
    </p>
  );
}

/** Highlighted info box */
export function EmailInfoBox({ children }: { children: React.ReactNode }) {
  return (
    <table width="100%" cellPadding={0} cellSpacing={0} style={{ margin: "20px 0" }}>
      <tbody>
        <tr>
          <td style={{
            backgroundColor: "#F0FAF5",
            border: "1px solid #9FE1CB",
            borderRadius: 10,
            padding: "16px 20px",
          }}>
            {children}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** Info row inside EmailInfoBox */
export function EmailInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <table width="100%" cellPadding={0} cellSpacing={0} style={{ marginBottom: 6 }}>
      <tbody>
        <tr>
          <td style={{ fontSize: 12, color: "#0F6E56", fontWeight: 700, width: 100, verticalAlign: "top" }}>
            {label}
          </td>
          <td style={{ fontSize: 13, color: "#0F1A2E", fontWeight: 600, verticalAlign: "top" }}>
            {value}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** CTA Button */
export function EmailButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <table cellPadding={0} cellSpacing={0} style={{ margin: "24px 0 8px" }}>
      <tbody>
        <tr>
          <td style={{
            backgroundColor: "#0F6E56",
            borderRadius: 8,
            padding: "12px 28px",
          }}>
            <a href={href} style={{ color: "#FFFFFF", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>
              {children}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/** Divider line */
export function EmailDivider() {
  return <hr style={{ border: "none", borderTop: "1px solid #F0EFEB", margin: "24px 0" }} />;
}
