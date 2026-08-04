import { describe, it, expect } from "vitest";
import { isOptOutRequest, isUnsubscribeRequest } from "@/lib/whatsapp-optout";

describe("whatsapp-optout (falar com atendente)", () => {
  it("detecta pedidos claros em português", () => {
    expect(isOptOutRequest("quero falar com um atendente")).toBe(true);
    expect(isOptOutRequest("Posso falar com uma pessoa?")).toBe(true);
    expect(isOptOutRequest("prefiro atendimento humano")).toBe(true);
    expect(isOptOutRequest("me passa pra recepção? quero falar com a recepcao")).toBe(true);
  });

  it("ignora acentos e caixa alta", () => {
    expect(isOptOutRequest("QUERO FALAR COM ATENDENTE")).toBe(true);
    expect(isOptOutRequest("Falar com alguém da clínica")).toBe(true);
  });

  it("detecta pedidos em inglês", () => {
    expect(isOptOutRequest("I want to talk to a human")).toBe(true);
    expect(isOptOutRequest("Can I speak to someone?")).toBe(true);
    expect(isOptOutRequest("give me a real person please")).toBe(true);
  });

  it("não dispara em conversa clínica normal", () => {
    expect(isOptOutRequest("quero parar de sentir dor")).toBe(false);
    expect(isOptOutRequest("qual o valor da avaliação?")).toBe(false);
    expect(isOptOutRequest("tenho dores no ombro há 3 meses")).toBe(false);
    expect(isOptOutRequest("how much does it cost?")).toBe(false);
  });
});

describe("isUnsubscribeRequest (descadastro / pare de me mandar)", () => {
  it("detecta frases fortes de descadastro em inglês (casos reais do Messenger)", () => {
    expect(isUnsubscribeRequest("Don't text me unsolicited, fir starters")).toBe(true);
    expect(isUnsubscribeRequest("please unsubscribe me")).toBe(true);
    expect(isUnsubscribeRequest("stop texting me")).toBe(true);
    expect(isUnsubscribeRequest("remove me from your list")).toBe(true);
    expect(isUnsubscribeRequest("leave me alone")).toBe(true);
    expect(isUnsubscribeRequest("not interested")).toBe(true);
  });

  it("detecta palavra isolada quando é a mensagem inteira", () => {
    expect(isUnsubscribeRequest("Stop .")).toBe(true);
    expect(isUnsubscribeRequest("STOP")).toBe(true);
    expect(isUnsubscribeRequest("stop please")).toBe(true);
    expect(isUnsubscribeRequest("Unsubscribe")).toBe(true);
    expect(isUnsubscribeRequest("pare")).toBe(true);
    expect(isUnsubscribeRequest("Parar!")).toBe(true);
  });

  it("detecta descadastro em português", () => {
    expect(isUnsubscribeRequest("pare de me mandar mensagem")).toBe(true);
    expect(isUnsubscribeRequest("não quero mais receber mensagens")).toBe(true);
    expect(isUnsubscribeRequest("me tira da lista por favor")).toBe(true);
  });

  it("NÃO dispara em conversa clínica que contém 'parar'/'stop'/'cancelar' no meio", () => {
    expect(isUnsubscribeRequest("quero parar de sentir dor")).toBe(false);
    expect(isUnsubscribeRequest("preciso cancelar meu horário de amanhã")).toBe(false);
    expect(isUnsubscribeRequest("como faço para parar a ansiedade?")).toBe(false);
    expect(isUnsubscribeRequest("I want to stop feeling this pain")).toBe(false);
    expect(isUnsubscribeRequest("Just scrolling")).toBe(false);
    expect(isUnsubscribeRequest("Hello, I'd like more information")).toBe(false);
  });
});
