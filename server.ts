import { existsSync } from "node:fs";
import { join } from "node:path";
import { normalizar } from "./src/avaliacao.ts";
import { baseUrlDe, buscarProvedor, chamarComFallback, PROVEDORES, type Provedor } from "./src/provedores.ts";
import { montarPrompt } from "./src/prompt.ts";
import { buscarGenero, generosDe, MODALIDADES, type Modalidade } from "./src/regras.ts";

const RAIZ = import.meta.dir;
const PORTA = Number(process.env.PORT ?? 8787);

/**
 * Origens liberadas para o front hospedado em outro domínio (deploy separado).
 * Sem CORS_ORIGINS o servidor só responde à própria origem — evita que qualquer site
 * do navegador gaste a chave que estiver no ambiente.
 */
const ORIGENS = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

function cabecalhosCors(req: Request): Record<string, string> {
  const origem = req.headers.get("origin");
  if (!origem) return {};
  const liberada = ORIGENS.includes("*") || ORIGENS.includes(origem);
  if (!liberada) return {};
  return {
    "access-control-allow-origin": ORIGENS.includes("*") ? "*" : origem,
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "origin",
  };
}

const json = (dados: unknown, status = 200, req?: Request) =>
  new Response(JSON.stringify(dados), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...(req ? cabecalhosCors(req) : {}) },
  });

const erro = (mensagem: string, status = 400, req?: Request) => json({ erro: mensagem }, status, req);

function lerCampo(origem: unknown, nome: string): unknown {
  return typeof origem === "object" && origem !== null && nome in origem ? origem[nome] : undefined;
}

function textoDe(origem: unknown, nome: string): string | undefined {
  const v = lerCampo(origem, nome);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function hostDaOrigem(origem: string): string | undefined {
  try {
    return new URL(origem).host;
  } catch {
    return undefined;
  }
}

/** Origem de navegador autorizada: própria origem (Host recebido) ou lista CORS_ORIGINS. */
function origemPermitida(req: Request): boolean {
  const origem = req.headers.get("origin");
  if (!origem) return true; // curl / server-to-server não manda Origin
  if (ORIGENS.includes("*") || ORIGENS.includes(origem)) return true;
  const host = req.headers.get("host");
  return Boolean(host) && hostDaOrigem(origem) === host;
}

/** Chave vinda do navegador (campo do formulário) ou do ambiente do servidor. */
function chaveDe(provedorId: string, informada: unknown): string | undefined {
  if (typeof informada === "string" && informada.trim()) return informada.trim();
  const meta = buscarProvedor(provedorId);
  const doAmbiente = meta ? process.env[meta.envKey]?.trim() : undefined;
  return doAmbiente || undefined;
}

async function avaliar(req: Request): Promise<Response> {
  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return erro("Corpo da requisição não é JSON válido.", 400, req);
  }

  const modalidade = textoDe(corpo, "modalidade") as Modalidade | undefined;
  if (!modalidade || !(modalidade in MODALIDADES)) return erro("modalidade deve ser enem, ufpr ou livre.", 400, req);

  const genero = buscarGenero(textoDe(corpo, "genero") ?? "");
  if (!genero) return erro("Gênero desconhecido. Recarregue a página e escolha um gênero da lista.", 400, req);
  if (!genero.modalidades.includes(modalidade)) {
    return erro(`O gênero "${genero.nome}" não pertence à banca ${modalidade.toUpperCase()}.`, 400, req);
  }

  const texto = textoDe(corpo, "texto");
  if (texto && texto.length < 20) return erro("Texto muito curto: cole a redação inteira.", 400, req);

  const candidataImagem = textoDe(corpo, "imagem");
  const imagem = candidataImagem && /^data:image\/(png|jpe?g|webp|heic|heif);base64,/.test(candidataImagem)
    ? candidataImagem
    : undefined;
  if (candidataImagem && !imagem) return erro("Formato de imagem não suportado. Use PNG, JPEG ou WEBP.", 400, req);
  if (!texto && !imagem) return erro("Envie a redação em texto (mínimo 20 caracteres) ou como imagem.", 400, req);
  if (texto && imagem) return erro("Envie texto ou imagem, não os dois.", 400, req);

  const regra = MODALIDADES[modalidade];
  const linhaInformada = Number(lerCampo(corpo, "limiteLinhas"));
  const linhasMax = Number.isFinite(linhaInformada)
    ? Math.max(1, Math.min(regra.linhasMax, Math.trunc(linhaInformada)))
    : genero.linhasPadrao;

  const provedorId = textoDe(corpo, "provedor") ?? PROVEDORES[0].id;
  const provedor = buscarProvedor(provedorId);
  if (!provedor) return erro("Provedor desconhecido.", 400, req);

  const modelo = textoDe(corpo, "modelo") ?? provedor.modeloPadrao;
  const metaModelo = provedor.modelos.find((m) => m.id === modelo);
  if (!metaModelo) return erro(`Modelo "${modelo}" não está na lista do provedor ${provedor.nome}.`, 400, req);
  if (imagem && !metaModelo.visao) return erro("Esse modelo não aceita imagem. Escolha um modelo com visão.", 400, req);

  const apiKey = chaveDe(provedorId, lerCampo(corpo, "apiKey"));
  if (!apiKey) {
    return erro(
      `Falta a chave de API do ${provedor.nome}: cole no campo "Chave de API" ou defina ${provedor.envKey} no ambiente.`,
      400,
      req,
    );
  }

  const { sistema, usuario } = montarPrompt({
    modalidade,
    genero,
    tema: textoDe(corpo, "tema") ?? "",
    limiteLinhas: linhasMax,
    texto,
  });
  const inicio = Date.now();

  let resultado: { texto: string; provedor: Provedor; modelo: string };
  try {
    resultado = await chamarComFallback({
      provedor,
      modelo,
      apiKey,
      sistema,
      usuario,
      imagem,
      baseUrlDe,
    });
  } catch (e) {
    const detalhe = e instanceof Error ? e.message : String(e);
    return erro(`Falha ao chamar ${provedor.nome}: ${detalhe}`, 502, req);
  }

  return json({
    avaliacao: normalizar({ modalidade, linhasMax, texto, respostaCrua: resultado.texto }),
    meta: {
      provedor: resultado.provedor.nome,
      modelo: resultado.modelo,
      ms: Date.now() - inicio,
      genero: genero.nome,
      entrada: texto ? "texto" : "imagem",
      fallback: resultado.provedor.id !== provedor.id || resultado.modelo !== modelo,
    },
  }, 200, req);
}

const rotas: Record<string, (req: Request) => Promise<Response>> = {
  "GET /api/config": async (req) =>
    json({
      modalidades: Object.values(MODALIDADES).map((m) => ({
        id: m.id,
        nome: m.nome,
        linhasMax: m.linhasMax,
        linhasMin: m.linhasMin,
        totalPontos: m.totalPontos,
        fonte: m.fonte,
        observacao: m.observacao,
        criterios: m.criterios,
        anulacao: m.anulacao,
        generos: generosDe(m.id).map((g) => ({ id: g.id, nome: g.nome, linhasPadrao: g.linhasPadrao })),
      })),
      provedores: PROVEDORES.map((p) => ({
        id: p.id,
        nome: p.nome,
        gratuidade: p.gratuidade,
        modeloPadrao: p.modeloPadrao,
        modelos: p.modelos,
        temChaveNoServidor: Boolean(process.env[p.envKey]?.trim()),
        envKey: p.envKey,
      })),
    }, 200, req),
  "POST /api/avaliar": avaliar,
};

const PUBLICO = join(RAIZ, "public");
const tipos: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

// SERVE_FRONT=false sobe só a API, para o front estático morar em outro host.
const SERVIR_FRONT = process.env.SERVE_FRONT !== "false";

Bun.serve({
  port: PORTA,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname.startsWith("/api/")) {
      // Origem de navegador não liberada: barra antes de gastar a chave do servidor.
      if (!origemPermitida(req)) {
        return new Response(JSON.stringify({ erro: `Origem ${req.headers.get("origin")} não autorizada. Ajuste CORS_ORIGINS.` }), {
          status: 403,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      if (req.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: cabecalhosCors(req) });
      }
    }

    const rota = rotas[`${req.method} ${url.pathname}`];
    if (rota) return rota(req);
    if (url.pathname.startsWith("/api/")) return erro("Rota não encontrada.", 404, req);

    if (!SERVIR_FRONT) return new Response("Front servido em outro host.", { status: 404 });

    const alvo = join(PUBLICO, url.pathname === "/" ? "index.html" : url.pathname);
    if (!alvo.startsWith(PUBLICO) || !existsSync(alvo)) return new Response("Não encontrado", { status: 404 });

    return new Response(Bun.file(alvo), {
      headers: { "content-type": tipos[alvo.slice(alvo.lastIndexOf("."))] ?? "application/octet-stream" },
    });
  },
});

console.log(`Avaliador de redação em http://localhost:${PORTA}`);
if (ORIGENS.length) console.log(`CORS liberado para: ${ORIGENS.join(", ")}`);
if (!SERVIR_FRONT) console.log("Modo API-only (SERVE_FRONT=false).");
