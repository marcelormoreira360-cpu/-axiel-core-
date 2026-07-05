import { describe, it, expect } from "vitest";
import {
  parseTwilioParams,
  twimlMessage,
  conversationChannel,
  smsConversationKey,
  buildSmsChannelRule,
  SMS_PHONE_PREFIX,
} from "@/lib/twilio-webhook-utils";

describe("twilio-webhook-utils", () => {
  describe("parseTwilioParams", () => {
    it("decodifica o corpo x-www-form-urlencoded do Twilio", () => {
      const raw = "From=%2B14075551234&To=%2B14079998888&Body=Ol%C3%A1%2C+quero+agendar&MessageSid=SM123abc";
      const params = parseTwilioParams(raw);
      expect(params["From"]).toBe("+14075551234");
      expect(params["To"]).toBe("+14079998888");
      expect(params["Body"]).toBe("Olá, quero agendar");
      expect(params["MessageSid"]).toBe("SM123abc");
    });

    it("corpo vazio vira objeto vazio", () => {
      expect(parseTwilioParams("")).toEqual({});
    });
  });

  describe("twimlMessage", () => {
    it("monta <Response><Message> com o texto", () => {
      expect(twimlMessage("Oi!")).toBe(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Message>Oi!</Message></Response>`,
      );
    });

    it("escapa & < > para XML", () => {
      const xml = twimlMessage(`a & b <c> "d"`);
      expect(xml).toContain("a &amp; b &lt;c&gt;");
      expect(xml).not.toContain("<c>");
    });
  });

  describe("conversationChannel", () => {
    it("mapeia o canal pelo prefixo do campo phone", () => {
      expect(conversationChannel("+14075551234")).toBe("whatsapp");
      expect(conversationChannel("5544999887766")).toBe("whatsapp");
      expect(conversationChannel("fb_1234567890")).toBe("messenger");
      expect(conversationChannel("ig_1234567890")).toBe("instagram");
      expect(conversationChannel("sms_+14075551234")).toBe("sms");
    });
  });

  describe("smsConversationKey", () => {
    it("prefixa o telefone com sms_ (evita colisão com o WhatsApp do mesmo número)", () => {
      expect(smsConversationKey("+14075551234")).toBe("sms_+14075551234");
      expect(smsConversationKey("+14075551234").startsWith(SMS_PHONE_PREFIX)).toBe(true);
    });
  });

  describe("buildSmsChannelRule", () => {
    it("instrui limite de ~300 caracteres, sem emoji, e inclui o link de agendamento", () => {
      const rule = buildSmsChannelRule("https://app.example.com/book/ifwc");
      expect(rule).toContain("300 caracteres");
      expect(rule.toLowerCase()).toContain("emoji");
      expect(rule).toContain("https://app.example.com/book/ifwc");
      expect(rule).toContain("SMS");
    });
  });
});
