/**
 * Geração de imagem via OpenAI (gpt-image-1). Usado pelo worker de mídia quando
 * o job não traz uma imagem pronta (política: usa a fornecida; se não houver, a
 * IA gera). Retorna PNG em Buffer, pronto para subir no Storage.
 */

import OpenAI from "openai";

export async function generateImagePng(
  prompt: string,
  size: "1024x1024" | "1024x1536" | "1536x1024" = "1024x1024"
): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada — não é possível gerar a imagem.");
  }
  const client = new OpenAI({ apiKey });
  const res = await client.images.generate({
    model: "gpt-image-1",
    prompt,
    size,
    n: 1,
  });
  const b64 = res.data?.[0]?.b64_json;
  if (!b64) {
    throw new Error("Geração de imagem não retornou dados.");
  }
  return Buffer.from(b64, "base64");
}
