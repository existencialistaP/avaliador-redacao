import { extrairJson } from "./avaliacao.ts";

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
  /** Orçamento de tempo desta chamada. Modelos :free podem demorar; a cadeia inteira precisa caber. */
  timeoutMs?: number;
};

/** Erro de provedor com o status HTTP, para separar falha passageira de erro de configuração. */
export class ErroProvedor extends Error {
  readonly status: number;

  constructor(mensagem: string, status: number) {
    super(mensagem);
    this.name = "ErroProvedor";
    this.status = status;
  }

  /** 429/5xx: vale tentar outro modelo. 400/401/403/404: repetir não adianta. */
  get transitorio(): boolean {
    return this.status === 429 || this.status >= 500;
  }
}

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
      signal: AbortSignal.timeout(p.timeoutMs ?? 120_000),
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
    throw new ErroProvedor(`HTTP ${resp.status}: ${bruto.slice(0, 400)}`, resp.status);
  }

  const texto = extrairConteudo(JSON.parse(bruto));
  if (!texto) {
    throw new ErroProvedor(`Resposta sem conteúdo: ${bruto.slice(0, 300)}`, 502);
  }
  return texto;
}

/** Chave do ambiente para um provedor, se existir. */
export function chaveDoAmbiente(p: Provedor): string | undefined {
  return process.env[p.envKey]?.trim() || undefined;
}

export type ResultadoChamada = { texto: string; provedor: Provedor; modelo: string };

/**
 * Um modelo grátis às vezes devolve JSON sem os critérios pedidos. Isso não é nota legítima:
 * conta como falha e a cadeia tenta o próximo, em vez de entregar 0 ao usuário.
 */
function avaliacaoUtil(resposta: string): boolean {
  try {
    const dados = extrairJson(resposta);
    if (typeof dados !== "object" || dados === null || !("criterios" in dados)) return false;
    const criterios = dados.criterios;
    if (!Array.isArray(criterios) || criterios.length === 0) return false;
    return criterios.some((c) => {
      if (typeof c !== "object" || c === null || !("valor" in c)) return false;
      const valor = c.valor;
      return typeof valor === "number" && Number.isFinite(valor);
    });
  } catch {
    return false;
  }
}

/**
 * Tenta o modelo pedido e, se o provedor falhar (429/5xx ou resposta inutilizável),
 * cai para os outros modelos do mesmo provedor e depois para outros provedores
 * que tenham chave no servidor. Erro de configuração (400/401/403) no modelo pedido para na hora.
 *
 * `orcamentoMs` limita a cadeia inteira: sem isso, 5 modelos :free lentos passam de 10 min
 * e o navegador do usuário desiste antes da resposta.
 */
export async function chamarComFallback(opcoes: {
  provedor: Provedor;
  modelo: string;
  apiKey: string;
  sistema: string;
  usuario: string;
  imagem?: string;
  baseUrlDe: (p: Provedor) => string;
  orcamentoMs?: number;
  maxTentativas?: number;
}): Promise<ResultadoChamada> {
  const orcamentoMs = opcoes.orcamentoMs ?? 150_000;
  const limite = Date.now() + orcamentoMs;
  const precisaVisao = Boolean(opcoes.imagem);

  // Ordem importa: o modelo pedido, depois um modelo de cada outro provedor com chave
  // (provedor diferente tem chance real de estar no ar), e só então os demais modelos.
  const doMesmoProvedor = opcoes.provedor.modelos.filter(
    (m) => m.id !== opcoes.modelo && (!precisaVisao || m.visao),
  );
  const deOutrosProvedores = PROVEDORES.filter((p) => p.id !== opcoes.provedor.id)
    .map((p) => ({ provedor: p, chave: chaveDoAmbiente(p) }))
    .filter((x): x is { provedor: Provedor; chave: string } => Boolean(x.chave))
    .flatMap((p) =>
      p.provedor.modelos
        .filter((m) => !precisaVisao || m.visao)
        .map((m) => ({ provedor: p.provedor, modelo: m.id, apiKey: p.chave })),
    );

  const tentativas: { provedor: Provedor; modelo: string; apiKey: string }[] = [
    { provedor: opcoes.provedor, modelo: opcoes.modelo, apiKey: opcoes.apiKey },
    ...deOutrosProvedores,
    ...doMesmoProvedor.map((m) => ({ provedor: opcoes.provedor, modelo: m.id, apiKey: opcoes.apiKey })),
  ];

  const maxTentativas = opcoes.maxTentativas ?? 4;
  const falhas: string[] = [];

  for (const [indice, t] of tentativas.slice(0, maxTentativas).entries()) {
    const restante = limite - Date.now();
    if (restante < 5_000) {
      falhas.push("orçamento de tempo esgotado antes da próxima tentativa");
      break;
    }
    try {
      const texto = await chamarModelo({
        baseUrl: opcoes.baseUrlDe(t.provedor),
        modelo: t.modelo,
        apiKey: t.apiKey,
        sistema: opcoes.sistema,
        usuario: opcoes.usuario,
        imagem: opcoes.imagem,
        timeoutMs: Math.min(120_000, restante),
      });
      if (!avaliacaoUtil(texto)) {
        falhas.push(`${t.provedor.nome}/${t.modelo}: resposta sem critérios válidos — ${texto.slice(0, 160)}`);
        continue;
      }
      return { texto, provedor: t.provedor, modelo: t.modelo };
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      falhas.push(`${t.provedor.nome}/${t.modelo}: ${mensagem}`);
      // Erro de configuração no que o usuário pediu: reporta já, sem gastar os outros.
      // Nos demais, só falha de configuração não impede tentar outro provedor (chave diferente).
      const transitorio = e instanceof ErroProvedor ? e.transitorio : false;
      if (indice === 0 && !transitorio) throw e;
    }
  }

  throw new ErroProvedor(`Nenhum modelo gratuito respondeu a tempo. Tentativas: ${falhas.join(" | ")}`, 503);
}
