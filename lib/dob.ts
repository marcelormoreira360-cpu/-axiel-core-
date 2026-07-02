// date_of_birth é DATE puro ("YYYY-MM-DD"). new Date("YYYY-MM-DD") interpreta
// como MEIA-NOITE UTC — em fuso negativo (Brasil/EUA) exibe um dia a MENOS e a
// idade erra no dia do aniversário. Âncora no meio-dia elimina o off-by-one.
export function parseDob(dob: string): Date {
  return new Date(`${dob.slice(0, 10)}T12:00:00`);
}
