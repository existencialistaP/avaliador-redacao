# Avaliador de Redação — ENEM / UFPR / Livre

Aplicação local: recebe a redação em texto ou foto, o limite de linhas, o gênero e o tema; envia para um modelo com visão; devolve nota, nota por critério, evidências textuais, plano de melhoria e reescrita de um trecho.

## Rodar

```bash
bun install   # sem dependências externas, só confirma o runtime
export GEMINI_API_KEY=sua_chave   # grátis em https://aistudio.google.com/apikey
bun run start                     # http://localhost:8787
```

Não há dependências: `package.json` vazio de propósito, roda no Bun puro.
A chave pode vir do ambiente (preferível) ou ser colada no formulário a cada avaliação.

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

## Estrutura

```
server.ts            rotas /api/config e /api/avaliar, estáticos, validação de entrada
src/regras.ts        bancas, critérios, gêneros, motivos de anulação, fontes
src/prompt.ts        montagem do prompt (regras + gênero + tema + texto/imagem)
src/provedores.ts    catálogo de providers e cliente OpenAI-compatible
src/avaliacao.ts     parsing tolerante do JSON, escala por banca, anulação, contagem de linhas
public/index.html    UI única (sem build, sem framework)
```

Variáveis de ambiente: `PORT`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, e `<PROVIDER>_BASE_URL` para apontar a um proxy/mock.

## Limites conhecidos

- A nota é estimativa automática: não substitui banca humana, e o próprio resultado mostra o índice de confiança.
- A correção da UFPR varia os critérios conforme o enunciado de cada questão; aqui os seis critérios do edital recebem peso igual.
- Quando o texto é digitado, o app não sabe onde a linha da folha oficial terminaria; a contagem é estimada e sinaliza excesso de linhas.
- Erros do provider (chave inválida, limite de requisições) aparecem como mensagem na tela, com o status HTTP.
