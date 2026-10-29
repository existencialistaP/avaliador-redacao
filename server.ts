import { existsSync } from "node:fs";
import { join } from "node:path";
import { normalizar } from "./src/avaliacao.ts";
import { baseUrlDe, buscarProvedor, chamarModelo, PROVEDORES } from "./src/provedores.ts";
import { montarPrompt } from "./src/prompt.ts";
import { buscarGenero, generosDe, MODALIDADES, type Modalidade } from "./src/regras.ts";

const RAIZ = import.meta.dir;
const PORTA = Number(process.env.PORT ?? 8787);

const json = (dados: unknown, status = 200) =>
  new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json; charset=utf-8" } });

const erro = (mensagem: string, status = 400) => json({ erro: mensagem }, status);

function lerCampo(origem: unknown, nome: string): unknown {
  return typeof origem === "object" && origem !== null && nome in origem ? origem[nome] : undefined;
}

function textoDe(origem: unknown, nome: string): string | undefined {
  const v = lerCampo(origem, nome);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
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
    return erro("Corpo da requisição não é JSON válido.");
  }

  const modalidade = textoDe(corpo, "modalidade") as Modalidade | undefined;
  if (!modalidade || !(modalidade in MODALIDADES)) return erro("modalidade deve ser enem, ufpr ou livre.");

  const genero = buscarGenero(textoDe(corpo, "genero") ?? "");
  if (!genero) return erro("Gênero desconhecido. Recarregue a página e escolha um gênero da lista.");
  if (!genero.modalidades.includes(modalidade)) {
    return erro(`O gênero "${genero.nome}" não pertence à banca ${modalidade.toUpperCase()}.`);
  }

  const texto = textoDe(corpo, "texto");
  if (texto && texto.length < 20) return erro("Texto muito curto: cole a redação inteira.");

  const candidataImagem = textoDe(corpo, "imagem");
  const imagem = candidataImagem && /^data:image\/(png|jpe?g|webp|heic|heif);base64,/.test(candidataImagem)
    ? candidataImagem
    : undefined;
  if (candidataImagem && !imagem) return erro("Formato de imagem não suportado. Use PNG, JPEG ou WEBP.");
  if (!texto && !imagem) return erro("Envie a redação em texto (mínimo 20 caracteres) ou como imagem.");
  if (texto && imagem) return erro("Envie texto ou imagem, não os dois.");

  const regra = MODALIDADES[modalidade];
  const linhaInformada = Number(lerCampo(corpo, "limiteLinhas"));
  const linhasMax = Number.isFinite(linhaInformada)
    ? Math.max(1, Math.min(regra.linhasMax, Math.trunc(linhaInformada)))
    : genero.linhasPadrao;

  const provedorId = textoDe(corpo, "provedor") ?? PROVEDORES[0].id;
  const provedor = buscarProvedor(provedorId);
  if (!provedor) return erro("Provedor desconhecido.");

  const modelo = textoDe(corpo, "modelo") ?? provedor.modeloPadrao;
  const metaModelo = provedor.modelos.find((m) => m.id === modelo);
  if (!metaModelo) return erro(`Modelo "${modelo}" não está na lista do provedor ${provedor.nome}.`);
  if (imagem && !metaModelo.visao) return erro("Esse modelo não aceita imagem. Escolha um modelo com visão.");

  const apiKey = chaveDe(provedorId, lerCampo(corpo, "apiKey"));
  if (!apiKey) {
    return erro(
      `Falta a chave de API do ${provedor.nome}: cole no campo "Chave de API" ou defina ${provedor.envKey} no ambiente.`,
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

  let respostaCrua: string;
  try {
    respostaCrua = await chamarModelo({
      baseUrl: baseUrlDe(provedor),
      modelo,
      apiKey,
      sistema,
      usuario,
      imagem,
    });
  } catch (e) {
    const detalhe = e instanceof Error ? e.message : String(e);
    return erro(`Falha ao chamar ${provedor.nome}: ${detalhe}`, 502);
  }

  return json({
    avaliacao: normalizar({ modalidade, linhasMax, texto, respostaCrua }),
    meta: {
      provedor: provedor.nome,
      modelo,
      ms: Date.now() - inicio,
      genero: genero.nome,
      entrada: texto ? "texto" : "imagem",
    },
  });
}

const rotas: Record<string, (req: Request) => Promise<Response>> = {
  "GET /api/config": async () =>
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
    }),
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

Bun.serve({
  port: PORTA,
  async fetch(req) {
    const url = new URL(req.url);
    const rota = rotas[`${req.method} ${url.pathname}`];
    if (rota) return rota(req);
    if (url.pathname.startsWith("/api/")) return erro("Rota não encontrada.", 404);

    const alvo = join(PUBLICO, url.pathname === "/" ? "index.html" : url.pathname);
    if (!alvo.startsWith(PUBLICO) || !existsSync(alvo)) return new Response("Não encontrado", { status: 404 });

    return new Response(Bun.file(alvo), {
      headers: { "content-type": tipos[alvo.slice(alvo.lastIndexOf("."))] ?? "application/octet-stream" },
    });
  },
});

console.log(`Avaliador de redação em http://localhost:${PORTA}`);
