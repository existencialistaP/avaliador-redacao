import { MODALIDADES, totalDePontos, type Modalidade } from "./regras.ts";

export type CriterioAvaliado = {
  id: string;
  nome: string;
  valor: number;
  pontos: number;
  maximo: number;
  justificativa: string;
  evidencias: string[];
  comoMelhorar: string;
};

export type Avaliacao = {
  modalidade: Modalidade;
  transcricao: string;
  temaIdentificado: string;
  linhasContadas: number;
  limiteLinhas: number;
  excessoLinhas: number;
  anulada: boolean;
  motivosAnulacao: string[];
  total: number;
  totalMaximo: number;
  percentual: number;
  criterios: CriterioAvaliado[];
  diagnosticoGeral: string;
  pontosFortes: string[];
  pontosFracos: string[];
  planoDeMelhoria: string[];
  reescritaTrecho: { original: string; sugestao: string } | null;
  confianca: number;
};

export type EntradaAvaliacao = {
  modalidade: Modalidade;
  linhasMax: number;
  texto?: string;
  respostaCrua: string;
};

/** Lê um campo de um objeto desconhecido sem inventar tipo. */
function campo(origem: unknown, nome: string): unknown {
  return typeof origem === "object" && origem !== null && nome in origem ? origem[nome] : undefined;
}

function texto(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function lista(v: unknown): string[] {
  return Array.isArray(v) ? v.map(texto).filter(Boolean) : [];
}

function numero(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

/** Aceita JSON puro ou JSON cercado por ```json ... ``` ou por texto solto. */
export function extrairJson(resposta: string): unknown {
  const limpo = resposta.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(limpo);
  } catch {
    const inicio = limpo.indexOf("{");
    const fim = limpo.lastIndexOf("}");
    if (inicio >= 0 && fim > inicio) return JSON.parse(limpo.slice(inicio, fim + 1));
    throw new Error(`O modelo não devolveu JSON válido. Início da resposta: ${resposta.slice(0, 300)}`);
  }
}

/**
 * Normaliza a resposta do modelo e aplica a escala de cada banca.
 * Critério ausente vira 0 com aviso, em vez de derrubar a requisição.
 */
export function normalizar(entrada: EntradaAvaliacao): Avaliacao {
  const regra = MODALIDADES[entrada.modalidade];
  const raiz = extrairJson(entrada.respostaCrua);
  const escalaEnem = entrada.modalidade === "enem";
  const totalMaximo = totalDePontos(entrada.modalidade, entrada.linhasMax);
  const pesoPorCriterio = 1 / regra.criterios.length;

  const cruCriterios = campo(raiz, "criterios");
  const porId = new Map<string, unknown>();
  if (Array.isArray(cruCriterios)) {
    for (const item of cruCriterios) {
      const id = texto(campo(item, "id")).toLowerCase();
      if (id) porId.set(id, item);
    }
  }

  const criterios: CriterioAvaliado[] = regra.criterios.map((c) => {
    const item = porId.get(c.id.toLowerCase());
    const valorCru = numero(campo(item, "valor"));
    const valor = Math.max(0, Math.min(escalaEnem ? 5 : 100, valorCru ?? 0));
    const fracao = escalaEnem ? valor / 5 : valor / 100;

    return {
      id: c.id,
      nome: c.nome,
      valor,
      pontos: Number((fracao * pesoPorCriterio * totalMaximo).toFixed(3)),
      maximo: Number((pesoPorCriterio * totalMaximo).toFixed(3)),
      justificativa: texto(campo(item, "justificativa")),
      evidencias: lista(campo(item, "evidencias")),
      comoMelhorar: texto(campo(item, "comoMelhorar")),
    };
  });

  // Texto colado: estima linhas por parágrafo (linha manuscrita ~78 caracteres), porque
  // quebras de linha da colagem não refletem a folha oficial. Com imagem, vale a contagem do modelo.
  const paragrafos = entrada.texto?.split(/\r?\n/).map((l) => l.trim()).filter(Boolean) ?? [];
  const linhasEstimadas = paragrafos.reduce((soma, p) => soma + Math.max(1, Math.ceil(p.length / 78)), 0);
  const linhasContadas = Math.max(
    0,
    Math.round(entrada.texto !== undefined ? linhasEstimadas : (numero(campo(raiz, "linhasContadas")) ?? 0)),
  );
  const excessoLinhas = Math.max(0, linhasContadas - entrada.linhasMax);

  // Regras objetivas não delegadas ao modelo.
  const motivos = lista(campo(campo(raiz, "anulacao"), "motivos"));
  const textoInsuficiente = entrada.modalidade === "enem" && linhasContadas > 0 && linhasContadas <= 7;
  if (textoInsuficiente) motivos.push("Texto insuficiente: até 7 linhas manuscritas (Cartilha ENEM 2026).");
  if (linhasContadas === 0) motivos.push("Nenhuma linha de texto identificada.");

  const pedeAnulacao = campo(campo(raiz, "anulacao"), "aplicavel") === true;
  const anulada = linhasContadas === 0 || textoInsuficiente || (pedeAnulacao && motivos.length > 0);

  // Redação anulada não pontua em nenhum critério: zerar aqui mantém nota e soma coerentes na tela.
  const criteriosFinal = anulada ? criterios.map((c) => ({ ...c, pontos: 0 })) : criterios;
  const total = anulada ? 0 : Number(criterios.reduce((s, c) => s + c.pontos, 0).toFixed(3));
  const reescrita = campo(raiz, "reescritaTrecho");
  const original = texto(campo(reescrita, "original"));
  const sugestao = texto(campo(reescrita, "sugestao"));

  return {
    modalidade: entrada.modalidade,
    transcricao: texto(campo(raiz, "transcricao")),
    temaIdentificado: texto(campo(raiz, "temaIdentificado")),
    linhasContadas,
    limiteLinhas: entrada.linhasMax,
    excessoLinhas,
    anulada,
    motivosAnulacao: [...new Set(motivos)],
    total,
    totalMaximo,
    percentual: Number(((total / totalMaximo) * 100).toFixed(1)),
    criterios: criteriosFinal,
    diagnosticoGeral: texto(campo(raiz, "diagnosticoGeral")),
    pontosFortes: lista(campo(raiz, "pontosFortes")),
    pontosFracos: lista(campo(raiz, "pontosFracos")),
    planoDeMelhoria: lista(campo(raiz, "planoDeMelhoria")),
    reescritaTrecho: original || sugestao ? { original, sugestao } : null,
    confianca: Math.max(0, Math.min(1, numero(campo(raiz, "estimativaConfianca")) ?? 0.5)),
  };
}
