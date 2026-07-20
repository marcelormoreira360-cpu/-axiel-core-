import { describe, it, expect } from "vitest";
import { detectMetaLanguage } from "../whatsapp-bot-defaults";
import { detectLanguage } from "../whatsapp-lang";

// Reproduz o que os handlers Meta (facebook/instagram) fazem por mensagem.
const inject = (t: string) => detectLanguage([], t);
function metaLang(
  history: Array<{ role: string; content: string }>,
  current: string,
) {
  return detectMetaLanguage(detectLanguage(history, current), history, current, inject);
}

describe("detectMetaLanguage (camada Meta PT/EN/ES)", () => {
  it("caso real Aaron: saudação com pontuação colada resolve para EN", () => {
    const history = [
      { role: "user", content: "Hello, I'd like more information..." },
      { role: "assistant", content: "Hello! Welcome to the Center..." },
    ];
    expect(metaLang(history, "Lower back pain")).toBe("en");
  });

  it("1ª msg ambígua (default PT) + mensagem atual claramente EN → acompanha EN", () => {
    const history = [
      { role: "user", content: "👋" },
      { role: "assistant", content: "Olá!" },
    ];
    expect(metaLang(history, "I have pain in my back for months")).toBe("en");
  });

  it("sem o detector injetado, mantém o comportamento antigo (só a 1ª msg)", () => {
    const history = [{ role: "user", content: "👋" }];
    // detectPtEn da 1ª msg = pt (default); sem detectPtEnFor não reavalia a atual
    expect(
      detectMetaLanguage(detectLanguage(history, "I have pain"), history, "I have pain"),
    ).toBe("pt");
  });

  it("espanhol na mensagem atual é detectado mesmo com 1ª msg ambígua", () => {
    const history = [{ role: "user", content: "hi" }];
    expect(metaLang(history, "Hola, necesito información sobre el dolor")).toBe("es");
  });

  it("conversa claramente PT permanece PT com mensagem curta ('sim')", () => {
    const history = [{ role: "user", content: "Olá, preciso de ajuda com tratamento" }];
    expect(metaLang(history, "sim")).toBe("pt");
  });

  it("conversa PT não vira EN por uma palavra ambígua na atual ('the')", () => {
    const history = [{ role: "user", content: "Bom dia, quero agendar uma sessão" }];
    expect(metaLang(history, "the")).toBe("pt");
  });

  it("conversa EN clara permanece EN", () => {
    const history = [{ role: "user", content: "Good morning! I need help please" }];
    expect(metaLang(history, "yes")).toBe("en");
  });
});
