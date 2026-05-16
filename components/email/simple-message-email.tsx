export function SimpleMessageEmail({ body }: { body: string }) {
  return (
    <div style={{ fontFamily: "Arial, sans-serif", lineHeight: "1.6", color: "#111827" }}>
      {body.split("\n").map((line, index) => (
        <p key={index} style={{ margin: "0 0 12px" }}>{line}</p>
      ))}
      <p style={{ marginTop: 24, fontSize: 12, color: "#6b7280" }}>
        This message was sent by the clinic using AXIEL Core.
      </p>
    </div>
  );
}
