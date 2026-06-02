import type { EmailT } from "./base-email";

export function SimpleMessageEmail({
  body,
  clinicName,
  t,
  locale = "pt-BR",
}: {
  body: string;
  clinicName?: string;
  t: EmailT;
  locale?: string;
}) {
  return (
    <html lang={locale}>
      <head><meta charSet="utf-8" /></head>
      <body style={{ margin: 0, padding: 0, backgroundColor: "#F8FAF9", fontFamily: "Arial, Helvetica, sans-serif" }}>
        <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: "#F8FAF9", padding: "32px 16px" }}>
          <tbody>
            <tr>
              <td align="center">
                <table width="100%" cellPadding={0} cellSpacing={0} style={{ maxWidth: 560 }}>
                  <tbody>
                    {clinicName && (
                      <tr>
                        <td style={{ backgroundColor: "#0B1F3A", borderRadius: "12px 12px 0 0", padding: "20px 32px", textAlign: "center" }}>
                          <span style={{ color: "#FFFFFF", fontSize: 16, fontWeight: 700 }}>{clinicName}</span>
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td style={{
                        backgroundColor: "#FFFFFF",
                        padding: "28px 32px",
                        borderLeft: "1px solid #E8E6E0",
                        borderRight: "1px solid #E8E6E0",
                        borderTop: "none",
                        borderRadius: clinicName ? 0 : "12px 12px 0 0",
                      }}>
                        {body.split("\n").map((line, i) => (
                          <p key={i} style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.7, color: "#374151" }}>
                            {line || " "}
                          </p>
                        ))}
                      </td>
                    </tr>
                    <tr>
                      <td style={{
                        backgroundColor: "#F4F3EF",
                        borderRadius: "0 0 12px 12px",
                        border: "1px solid #E8E6E0",
                        borderTop: "none",
                        padding: "16px 32px",
                        textAlign: "center",
                      }}>
                        <p style={{ margin: 0, fontSize: 11, color: "#A09E98" }}>
                          {clinicName ? t("simple.footerSentBy", { clinic: clinicName }) : t("simple.footerGeneric")}
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
