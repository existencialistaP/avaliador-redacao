export type Provedor = {
  id: string;
  nome: string;
  baseUrl: string;
  envKey: string;
  gratuidade: string;
  modelos: { id: string; visao: boolean; nota: string }[];
  modeloPadrao: string;
};

// Todos os três falam o mesmo protocolo (OpenAI chat/completions), com visão por image_url.
// Limites e disponibilidade conferidos em 2026-10-28 nas páginas oficiais dos provedores.
export const PROVEDORES: Provedor[] = [
  {
    id: "gemini",
    nome: "Google Gemini (free tier)",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    envKey: "GEMINI_API_KEY",
    gratuidade:
      "Free tier sem cartão: entrada/saída 'Free of charge' no Gemini 3.8 Flash. Conteúdo do free tier é usado para melhorar os produtos do Google.",
    modelos: [
      { id: "gemini-3.8-flash", visao: true, nota: "Melhor custo/qualidade do free tier; leitura de manuscrito boa" },
      { id: "gemini-3.6-flash", visao: true, nota: "Geração anterior, também gratuita" },
      { id: "gemini-2.5-flash", visao: true, nota: "Estável, free tier com limites mais baixos" },
    ],
    modeloPadrao: "gemini-3.8-flash",
  },
  {
    id: "openrouter",
    nome: "OpenRouter (:free)",
    baseUrl: "https://openrouter.ai/api/v1",
    envKey: "OPENROUTER_API_KEY",
    gratuidade:
      "Variantes :free custam $0. Limite de 20 req/min e 50 req/dia sem crédito comprado (1.000/dia após comprar 10 créditos).",
    modelos: [
      { id: "nvidia/nemotron-3.5-super-vl:free", visao: true, nota: "Vision-language, contexto 1M — melhor opção :free" },
      { id: "google/gemma-4-31b-it:free", visao: true, nota: "Gemma 4 31B, texto + imagem" },
      { id: "google/gemma-4-26b-a4b-it:free", visao: true, nota: "Menor e mais rápido" },
      { id: "thinkingmachines/inkling:free", visao: true, nota: "Contexto 1M" },
      { id: "dots-studio/dots-3-note-preview:free", visao: true, nota: "Preview, 512k de contexto" },
    ],
    modeloPadrao: "nvidia/nemotron-3.5-super-vl:free",
  },
  {
    id: "groq",
    nome: "Groq (free plan)",
    baseUrl: "https://api.groq.com/openai/v1",
    envKey: "GROQ_API_KEY",
    gratuidade:
      "Free plan sem cartão: 30 req/min, 1.000/dia, 8.000 tokens/min. Cada imagem conta 2.048 tokens e o máximo é 3 imagens por requisição.",
    modelos: [
      { id: "qwen/qwen3.8-27b", visao: true, nota: "Único modelo de visão no free plan; muito rápido" },
    ],
    modeloPadrao: "qwen/qwen3.8-27b",
  },
];

export function buscarProvedor(id: string): Provedor | undefined {
  return PROVEDORES.find((p) => p.id === id);
}

/** Permite apontar um provedor para outro endpoint (mock, proxy corporativo). Ex.: GEMINI_BASE_URL. */
export function baseUrlDe(p: Provedor): string {
  const override = process.env[`${p.id.toUpperCase()}_BASE_URL`];
  return override?.trim() || p.baseUrl;
}

export type PedidoModelo = {
  baseUrl: string;
  modelo: string;
  apiKey: string;
  sistema: string;
  usuario: string;
  imagem?: string;
  maxTokens?: number;
};

/** Lê choices[0].message.content de uma resposta OpenAI-compatible sem confiar no formato. */
function extrairConteudo(dados: unknown): string | undefined {
  if (typeof dados !== "object" || dados === null || !("choices" in dados)) return undefined;
  const escolhas = dados.choices;
  if (!Array.isArray(escolhas) || escolhas.length === 0) return undefined;
  const primeira: unknown = escolhas[0];
  if (typeof primeira !== "object" || primeira === null || !("message" in primeira)) return undefined;
  const mensagem: unknown = primeira.message;
  if (typeof mensagem !== "object" || mensagem === null || !("content" in mensagem)) return undefined;
  const conteudo: unknown = mensagem.content;
  if (typeof conteudo === "string") return conteudo.trim() || undefined;
  // Alguns modelos devolvem content como lista de partes.
  if (Array.isArray(conteudo)) {
    const partes = conteudo
      .map((p) => (typeof p === "object" && p !== null && "text" in p ? p.text : undefined))
      .filter((t): t is string => typeof t === "string");
    const texto = partes.join("").trim();
    return texto || undefined;
  }
  return undefined;
}

/** Chama um endpoint OpenAI-compatible; devolve o texto da resposta. */
export async function chamarModelo(p: PedidoModelo): Promise<string> {
  const conteudo: unknown[] = [{ type: "text", text: p.usuario }];
  if (p.imagem) conteudo.push({ type: "image_url", image_url: { url: p.imagem } });

  const corpo = {
    model: p.modelo,
    temperature: 0.2,
    max_tokens: p.maxTokens ?? 4000,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: p.sistema },
      { role: "user", content: conteudo },
    ],
  };

  const url = `${p.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const enviar = (body: unknown) =>
    fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${p.apiKey}`,
        "HTTP-Referer": "http://localhost",
        "X-Title": "Avaliador de Redacao",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(180_000),
    });

  let resp = await enviar(corpo);
  let bruto = await resp.text();

  // Alguns modelos gratuitos recusam response_format; repete sem ele.
  if (!resp.ok && bruto.includes("response_format")) {
    const { response_format: _ignorado, ...semFormato } = corpo;
    resp = await enviar(semFormato);
    bruto = await resp.text();
  }

  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} do provedor: ${bruto.slice(0, 600)}`);
  }

  const texto = extrairConteudo(JSON.parse(bruto));
  if (!texto) {
    throw new Error(`Resposta sem conteúdo: ${bruto.slice(0, 300)}`);
  }
  return texto;
}
