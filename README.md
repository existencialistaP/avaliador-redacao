# Avaliador de Redação — ENEM / UFPR / Livre

Aplicação local: recebe a redação em texto ou foto, o limite de linhas, o gênero e o tema; envia para um modelo com visão; devolve nota, nota por critério, evidências textuais, plano de melhoria e reescrita de um trecho.

## Rodar

```bash
cp .env.example .env    # preencha GEMINI_API_KEY (ou OPENROUTER/GROQ)
bun run start           # http://localhost:8787
```

Sem dependências: `package.json` vazio de propósito, roda no Bun puro. O Bun carrega `.env` sozinho — não é preciso exportar nada na mão, e o app nunca imprime o valor da chave. Sem `.env`, a chave pode ser colada no formulário a cada avaliação.

## Deploy com front e API separados

O app já suporta os dois numa máquina só, ou separados:

| Peça | O que é | Onde hospedar |
|---|---|---|
| API | `bun run server.ts` com `SERVE_FRONT=false` | Render, Railway, Fly.io, VPS, Cloud Run |
| Front | `public/index.html` (arquivo estático, zero build) | Cloudflare Pages, Netlify, Vercel, GitHub Pages, S3+CloudFront |

A API precisa de runtime persistente (Node/Bun), então **não** serve Vercel/Netlify Functions como host padrão dela: a avaliação leva 10–60 s, acima do limite típico de função.

**Passo 1 — API.** Suba com `SERVE_FRONT=false` e `CORS_ORIGINS` com a URL exata do front (com `https://`, sem barra no fim; aceita vírgula para várias):

```bash
SERVE_FRONT=false CORS_ORIGINS=https://meu-avaliador.pages.dev GEMINI_API_KEY=... bun run server.ts
```

Com Docker: `docker build -t avaliador . && docker run -p 8080:8080 -e GEMINI_API_KEY=... -e CORS_ORIGINS=... avaliador` (o `Dockerfile` já vem com `SERVE_FRONT=false` e porta 8080).

**Passo 2 — Front no GitHub Pages.** O workflow `.github/workflows/pages.yml` já publica `public/` a cada push em `master`. Falta só uma coisa: apontar para a API.

1. Settings → Secrets and variables → Actions → **Variables** → New variable `API_BASE` = `https://sua-api.onrender.com` (sem barra no fim).
2. Actions → "Deploy front (GitHub Pages)" → Run workflow.

O workflow injeta a variável no `window.API_BASE` do `index.html`. Sem ela o site sobe, mas mostra o aviso de configurar. Também dá para sobrescrever na hora com `?api=https://sua-api.onrender.com`.

E na API, `CORS_ORIGINS` precisa conter `https://SEU-USUARIO.github.io` (a origem, sem o caminho do repo).

Sem `CORS_ORIGINS` a API recusa origem de navegador diferente da própria, devolvendo 403 — de propósito: sem isso qualquer site gastaria a sua chave. Chamada sem `Origin` (curl, server-to-server) continua livre.

### Onde hospedar cada peça

| Host | API | Front | Free tier real |
|---|---|---|---|
| **Render** (Docker/web service) | ✅ | ✅ estático | 750 h/mês por workspace, 512 MB, sem cartão; hiberna após 15 min sem tráfego e leva ~1 min para acordar |
| **Koyeb** | ✅ | — | 1 instância free (512 MB, 0.1 vCPU), sem cartão; escala para zero após 1 h sem tráfego |
| GitHub Pages | — | ✅ | grátis, sem build, publicado por workflow |
| Cloudflare Pages / Netlify / Vercel static | — | ✅ | estático grátis |
| Railway | ⚠️ | — | $1/mês de crédito após o 1º mês: não mantém serviço no ar |
| Fly.io | ❌ | — | sem free tier para contas novas desde 2024; cartão obrigatório |
| Vercel/Netlify Functions | ⚠️ | — | timeout de função curto demais para avaliação de 10–60 s |
| Cloudflare Workers | ❌ | — | 10 ms de CPU por invocação no free; não serve para esperar LLM |
| VPS + Caddy/nginx | ✅ | ✅ | uma máquina serve os dois; dispensa CORS |

**Recomendação:** API no Render (Docker, plano free, `render.yaml` já no repo) + front no GitHub Pages (workflow já no repo). Nenhum dos dois pede cartão. O primeiro acesso depois de 15 min parados espera ~1 min de cold start.

Se API e front ficarem no mesmo host (VPS), não precisa de CORS nem de `?api`: o caminho padrão de mesma origem já funciona.

## Bancas e escalas

| Banca | Total | Escala pedida ao modelo | Critérios |
|---|---|---|---|
| ENEM | 1000 | nível 0–5 por competência (× 40) | C1–C5 |
| UFPR | 25 (questão longa) / 15 (curta) | 0–100 por critério, peso igual | a) a f) do item 6.11.2 |
| Livre | 100 | 0–100 por critério | aderência, gênero, coesão, norma, profundidade |

Fontes transcritas em `src/regras.ts`:
- **ENEM**: [Cartilha do Participante — A Redação do Enem 2026 (INEP)](https://download.inep.gov.br/publicacoes/institucionais/avaliacoes_e_exames_da_educacao_basica/cartilha_enem_2026.pdf) — 5 competências, 200 pontos cada, nota zero até 7 linhas, fuga ao tema, fuga ao tipo, identificação, ilegibilidade etc.
- **UFPR**: [Edital 50/2026-NC/PROGRAP — Vestibular UFPR 2027, item 6.11](https://servicos.nc.ufpr.br/PortalNC/obterDocumento?pub=9363) — duas questões discursivas (15 e 5 linhas), 25 e 15 pontos, critérios a–f, motivos de anulação; a UFPR não publica pesos por critério.

Regras objetivas aplicadas no servidor, não delegadas ao modelo: anulação ENEM por ≤ 7 linhas, texto vazio, e contagem de linhas (estimada em ~78 caracteres por linha quando o texto é colado; contada pelo modelo quando vem de imagem).

## Providers gratuitos com visão (conferidos em 2026-10-28)

| Provider | Modelo padrão | Free tier | Pegadinha |
|---|---|---|---|
| Google Gemini | `gemini-3.8-flash` | entrada/saída "Free of charge" no free tier, sem cartão | conteúdo do free tier é usado para melhorar os produtos do Google — não mande dado sensível |
| OpenRouter | `nvidia/nemotron-3.5-super-vl:free` | sufixo `:free` custa $0 | 20 req/min e 50 req/dia sem crédito (1.000/dia após comprar 10 créditos); modelos `:free` rodam |
| Groq | `qwen/qwen3.8-27b` | Free plan: 30 req/min, 1.000/dia, 8k tokens/min | cada imagem custa 2.048 tokens (≈3 imagens/min) e no máximo 3 por requisição |

Os três falam o mesmo protocolo (OpenAI `chat/completions`), então `src/provedores.ts` cobre os três com um único cliente. Para manuscrito, Gemini costuma ler melhor; Groq é o mais rápido; OpenRouter tem o melhor modelo aberto de visão (`nemotron-3.5-super-vl`, contexto 1M).

### O que foi medido na prática (2026-10-29)

- **Gemini free é o único confiável para JSON estruturado**: respostas em 25–80 s, com 429/503 ocasionais que o fallback contorna.
- **Modelos `:free` do OpenRouter truncam a resposta** com frequência (o nemotron gasta o orçamento de tokens raciocinando e corta o JSON no meio). Em 6 tentativas, 5 caíram para o Gemini.
- **429 no free tier é por minuto, não por dia**: rajada de testes estoura o RPM/TPM e volta em ~1 min. O app traduz isso numa mensagem legível.
- Cadeia de fallback: modelo pedido → um modelo de cada outro provedor com chave → demais modelos. Orçamento total 240 s, 120 s por tentativa, 3 tentativas.

## Estrutura

```
server.ts            rotas /api/config e /api/avaliar, estáticos, validação de entrada
src/regras.ts        bancas, critérios, gêneros, motivos de anulação, fontes
src/prompt.ts        montagem do prompt (regras + gênero + tema + texto/imagem)
src/provedores.ts    catálogo de providers e cliente OpenAI-compatible
src/avaliacao.ts     parsing tolerante do JSON, escala por banca, anulação, contagem de linhas
public/index.html    UI única (sem build, sem framework)
```

Variáveis de ambiente (ver `.env.example`): `PORT`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `CORS_ORIGINS`, `SERVE_FRONT`, e `<PROVIDER>_BASE_URL` para apontar a um proxy/mock. O Bun carrega `.env` automaticamente.

## Limites conhecidos

- A nota é estimativa automática: não substitui banca humana, e o próprio resultado mostra o índice de confiança.
- A correção da UFPR varia os critérios conforme o enunciado de cada questão; aqui os seis critérios do edital recebem peso igual.
- Quando o texto é digitado, o app não sabe onde a linha da folha oficial terminaria; a contagem é estimada e sinaliza excesso de linhas.
- Erros do provider (chave inválida, limite de requisições) aparecem como mensagem na tela, com o status HTTP.
