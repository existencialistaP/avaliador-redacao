// Regras transcritas das fontes oficiais:
//  - ENEM 2026: "A Redação do Enem 2026 — Cartilha do Participante" (INEP)
//  - UFPR 2027: Edital nº 50/2026-NC/PROGRAP, item 6.11 (prova discursiva)
// Este arquivo é a única fonte de verdade do app; os textos entram direto no prompt do modelo.

export type Modalidade = "enem" | "ufpr" | "livre";

export type Criterio = {
  id: string;
  nome: string;
  descricao: string;
};

export type ModalidadeRegra = {
  id: Modalidade;
  nome: string;
  totalPontos: number;
  linhasMax: number;
  linhasMin: number;
  fonte: string;
  criterios: Criterio[];
  anulacao: string[];
  observacao: string;
};

export const MODALIDADES: Record<Modalidade, ModalidadeRegra> = {
  enem: {
    id: "enem",
    nome: "ENEM",
    totalPontos: 1000,
    linhasMax: 30,
    linhasMin: 8,
    fonte: "Cartilha do Participante — A Redação do Enem 2026 (INEP)",
    criterios: [
      {
        id: "c1",
        nome: "C1 — Domínio da escrita formal",
        descricao:
          "Demonstrar domínio da modalidade escrita formal da língua portuguesa: ortografia, pontuação, concordância, regência, colocação pronominal e sintaxe de períodos complexos. Períodos muito simples demais limitam a nota.",
      },
      {
        id: "c2",
        nome: "C2 — Tema, gênero e repertório",
        descricao:
          "Compreender a proposta, não fugir nem tangenciar o tema, e aplicar repertório sociocultural produtivo (pertinente, legitimado e articulado ao argumento) dentro dos limites do texto dissertativo-argumentativo em prosa. Tangenciamento limita a C2 a 40/200.",
      },
      {
        id: "c3",
        nome: "C3 — Projeto de texto e argumentação",
        descricao:
          "Selecionar, relacionar, organizar e interpretar informações, fatos, opiniões e argumentos em defesa de um ponto de vista, com autoria, progressão e sem contradições.",
      },
      {
        id: "c4",
        nome: "C4 — Coesão e mecanismos linguísticos",
        descricao:
          "Empregar mecanismos linguísticos de coesão: conectivos, pronomes, sinônimos, retomadas e progressão referencial, sem repetições vazias nem conectivo decorado.",
      },
      {
        id: "c5",
        nome: "C5 — Proposta de intervenção",
        descricao:
          "Elaborar proposta de intervenção completa (agente, ação, meio/modo, finalidade e detalhamento) para o problema abordado, respeitando os direitos humanos. Proposta que desrespeita direitos humanos zera a C5.",
      },
    ],
    anulacao: [
      "fuga total ao tema",
      "não obedecer ao tipo dissertativo-argumentativo",
      "folha em branco",
      "até 7 linhas manuscritas (texto insuficiente)",
      "impropérios, desenhos ou formas propositais de anulação",
      "parte deliberadamente desconectada do tema",
      "nome, assinatura, rubrica ou identificação fora do local próprio",
      "texto predominantemente ou integralmente em língua estrangeira",
      "texto ilegível",
    ],
    observacao:
      "Linhas copiadas dos textos motivadores são desconsideradas na contagem mínima. Cada competência vale 200 pontos, em níveis de 0 a 5 (múltiplos de 40).",
  },
  ufpr: {
    id: "ufpr",
    nome: "UFPR",
    totalPontos: 25,
    linhasMax: 15,
    linhasMin: 0,
    fonte: "Edital nº 50/2026-NC/PROGRAP — Vestibular UFPR 2027, item 6.11",
    criterios: [
      {
        id: "a",
        nome: "a) Fidelidade à proposta",
        descricao:
          "Fidelidade ao que a questão propõe, incluindo domínio de leitura e interpretação do(s) texto(s) de base e resposta exata ao comando.",
      },
      {
        id: "b",
        nome: "b) Gênero / tipo textual",
        descricao:
          "Domínio da estrutura textual e discursiva do gênero/tipo textual proposto no enunciado — não escrever dissertação quando se pede resumo, continuação ou comunicado.",
      },
      {
        id: "c",
        nome: "c) Organização, coesão e coerência",
        descricao: "Organização global do texto, progressão, articulação entre partes, coesão e coerência.",
      },
      {
        id: "d",
        nome: "d) Língua culta",
        descricao:
          "Domínio da língua culta contemporânea: concordância, regência, colocação pronominal e vocabulário adequado.",
      },
      {
        id: "e",
        nome: "e) Sintaxe e pontuação",
        descricao:
          "Domínio de estruturas sintáticas próprias da escrita e dos sinais de pontuação, visando clareza e precisão.",
      },
      {
        id: "f",
        nome: "f) Ortografia e legibilidade",
        descricao: "Legibilidade do texto e respeito à norma ortográfica em vigor.",
      },
    ],
    anulacao: [
      "questão em branco",
      "resposta transcrita a lápis",
      "resposta não redigida em língua portuguesa",
      "resposta transcrita em espaço destinado a outra questão",
      "marca ou texto que identifique o candidato (nome, endereço, telefone, “Eu, Maria…”)",
      "impropérios, desenhos ou formas propositais de anulação",
      "não atender ao tema e à tipologia textual propostos",
      "não atingir o mínimo de linhas estabelecido no enunciado",
    ],
    observacao:
      "A UFPR não publica pesos por critério: aqui os seis critérios do item 6.11.2 recebem peso igual. A questão longa vale 25 pontos e a curta vale 15 pontos.",
  },
  livre: {
    id: "livre",
    nome: "Livre",
    totalPontos: 100,
    linhasMax: 30,
    linhasMin: 0,
    fonte: "Rubrica genérica do avaliador (sem vínculo com banca)",
    criterios: [
      {
        id: "a",
        nome: "Aderência ao tema e ao comando",
        descricao: "Responde ao tema e ao comando propostos, sem tangenciar nem fugir.",
      },
      {
        id: "b",
        nome: "Gênero textual",
        descricao: "Cumpre a estrutura e as convenções do gênero pedido.",
      },
      {
        id: "c",
        nome: "Organização, coesão e coerência",
        descricao: "Progressão clara, paragrafação funcional, articulação e coesão.",
      },
      {
        id: "d",
        nome: "Norma culta e clareza",
        descricao: "Ortografia, pontuação, concordância, regência e clareza sintática.",
      },
      {
        id: "e",
        nome: "Profundidade e originalidade",
        descricao: "Densidade do conteúdo, pertinência das ideias e tratamento não genérico do tema.",
      },
    ],
    anulacao: [
      "texto vazio",
      "texto fora do gênero pedido",
      "texto incompreensível",
      "texto integralmente copiado do comando ou dos textos de apoio",
    ],
    observacao: "Escala de 0 a 100, com pesos iguais entre os cinco critérios.",
  },
};

export type Genero = {
  id: string;
  nome: string;
  modalidades: Modalidade[];
  linhasPadrao: number;
  estrutura: string[];
  checklist: string[];
  erros: string[];
};

export const GENEROS: Genero[] = [
  {
    id: "dissertativo-argumentativo",
    nome: "Dissertativo-argumentativo (ENEM)",
    modalidades: ["enem", "livre"],
    linhasPadrao: 30,
    estrutura: [
      "Introdução: contextualização + tese explícita (1 parágrafo)",
      "Desenvolvimento 1: argumento com repertório legitimado, pertinente e articulado",
      "Desenvolvimento 2: segundo argumento, em outra dimensão do problema",
      "Conclusão: proposta de intervenção com agente, ação, meio, finalidade e detalhamento",
    ],
    checklist: [
      "Tese reconhecível já no primeiro parágrafo",
      "Cada parágrafo desenvolve uma única ideia central",
      "Repertório com fonte e relação explícita com a tese",
      "Proposta de intervenção completa e viável, respeitando direitos humanos",
      "Nenhuma marca de identificação",
    ],
    erros: [
      "Repertório citado e abandonado (nome solto)",
      "Conclusão que apenas resume, sem intervir",
      "Marcas de oralidade ou segunda pessoa",
      "Fuga do recorte temático proposto",
    ],
  },
  {
    id: "texto-argumentativo",
    nome: "Texto argumentativo / expositivo-argumentativo (UFPR)",
    modalidades: ["ufpr", "livre"],
    linhasPadrao: 15,
    estrutura: [
      "Abertura curta que já apresenta a tese",
      "Argumentos encadeados a partir dos textos de apoio, sem cópia",
      "Fechamento coerente com a tese (proposta não é obrigatória)",
    ],
    checklist: [
      "Tese clara e sustentada até o fim",
      "Textos de apoio usados como base, com paráfrase",
      "Progressão argumentativa, não lista de tópicos",
      "Registro formal e impessoalidade quando o comando exigir",
    ],
    erros: [
      "Resumir os textos de apoio em vez de argumentar",
      "Argumento circular",
      "Conclusão que introduz tema novo",
    ],
  },
  {
    id: "texto-expositivo",
    nome: "Texto expositivo (UFPR)",
    modalidades: ["ufpr", "livre"],
    linhasPadrao: 15,
    estrutura: [
      "Apresentação objetiva do tema ou da ideia central",
      "Desdobramento explicativo das ideias do texto de base",
      "Síntese sem julgamento pessoal",
    ],
    checklist: [
      "Explicar, não defender ponto de vista",
      "Fidelidade às ideias do texto de apoio",
      "Terceira pessoa / impessoalidade",
      "Sem juízo de valor próprio",
    ],
    erros: [
      "Virar dissertação opinativa",
      "Copiar frases inteiras",
      "Inserir opinião própria com “eu acho”",
    ],
  },
  {
    id: "resumo",
    nome: "Resumo (UFPR)",
    modalidades: ["ufpr", "livre"],
    linhasPadrao: 15,
    estrutura: [
      "Frase inicial identificando o texto/tema resumido",
      "Ideias centrais na ordem do original, sem exemplos nem detalhes acessórios",
      "Fechamento com a conclusão do autor",
    ],
    checklist: [
      "Condensação: manter só o essencial",
      "Fidelidade ao original, sem acrescentar dados",
      "Paráfrase: nada de copiar segmentos",
      "Terceira pessoa",
    ],
    erros: [
      "Colar trechos do original",
      "Emitir opinião",
      "Virar fichamento de tópicos",
      "Ultrapassar o limite de linhas",
    ],
  },
  {
    id: "continuacao-de-texto",
    nome: "Continuação de texto (UFPR)",
    modalidades: ["ufpr", "livre"],
    linhasPadrao: 15,
    estrutura: [
      "Retomada exata do ponto em que o texto-base parou",
      "1 ou 2 parágrafos que desenvolvem a mesma linha",
      "Fechamento compatível com o tom e o propósito do original",
    ],
    checklist: [
      "Manter voz, pessoa, tempo verbal e registro do original",
      "Manter destinatário e situação comunicativa",
      "Introduzir informação nova coerente",
      "Não reescrever o trecho já dado",
    ],
    erros: [
      "Mudar de gênero no meio",
      "Recomeçar a história",
      "Ignorar destinatário/papel social",
      "Repetir o texto-base",
    ],
  },
  {
    id: "analise-de-dados",
    nome: "Análise de dados / gráfico (UFPR)",
    modalidades: ["ufpr", "livre"],
    linhasPadrao: 15,
    estrutura: [
      "Identificação do que os dados mostram (tendência central)",
      "Comparação entre categorias ou períodos relevantes",
      "Interpretação: o que a tendência significa, com base nos textos de apoio",
    ],
    checklist: [
      "Citar apenas os dados que sustentam a leitura",
      "Explicitar tendência, não listar números soltos",
      "Usar os dados como evidência de uma afirmação",
      "Fechar com síntese interpretativa",
    ],
    erros: [
      "Listar todos os números do gráfico",
      "Interpretação sem base nos dados",
      "Confundir correlação com causalidade",
    ],
  },
  {
    id: "comunicado-notificacao",
    nome: "Comunicado / notificação (UFPR)",
    modalidades: ["ufpr", "livre"],
    linhasPadrao: 12,
    estrutura: [
      "Identificação do remetente e do destinatário (sem dados pessoais reais)",
      "Assunto e informação objetiva com os dados essenciais (o quê, quando, onde, como)",
      "Fecho formal com encaminhamento ou solicitação",
    ],
    checklist: [
      "Objetividade e clareza acima de tudo",
      "Registro formal e tratamento adequado ao destinatário",
      "Dados completos e não contraditórios",
      "Sem opinião nem argumentação longa",
    ],
    erros: [
      "Linguagem coloquial",
      "Falta de dados essenciais",
      "Assinar com nome próprio (gera anulação na UFPR)",
    ],
  },
  {
    id: "carta-argumentativa",
    nome: "Carta argumentativa (UFPR)",
    modalidades: ["ufpr", "livre"],
    linhasPadrao: 15,
    estrutura: [
      "Vocativo / chamamento ao destinatário",
      "Exposição do problema + argumentos",
      "Pedido ou encaminhamento e fecho formal",
    ],
    checklist: [
      "Destinatário definido e coerente com o pedido",
      "Argumentos ligados ao pedido final",
      "Registro formal, sem identificação pessoal",
    ],
    erros: ["Virar dissertação sem carta", "Fecho abrupto", "Assinatura com nome próprio"],
  },
  {
    id: "resposta-curta",
    nome: "Resposta discursiva curta (UFPR — 5 linhas)",
    modalidades: ["ufpr", "livre"],
    linhasPadrao: 5,
    estrutura: [
      "Resposta direta ao comando, já na primeira linha",
      "Justificativa mínima em uma frase",
      "Sem introdução genérica",
    ],
    checklist: [
      "Responder exatamente ao que foi perguntado",
      "Caber no limite de 5 linhas",
      "Sem rodeios nem contextualização longa",
    ],
    erros: ["Introdução que consome as 5 linhas", "Responder só em parte", "Copiar o enunciado"],
  },
  {
    id: "cronica-narrativa",
    nome: "Crônica / narrativo (livre)",
    modalidades: ["livre"],
    linhasPadrao: 25,
    estrutura: [
      "Cena inicial concreta",
      "Desenvolvimento com tensão ou situação",
      "Desfecho com virada ou reflexão",
    ],
    checklist: ["Narrador e foco consistentes", "Tempo verbal coerente", "Detalhe concreto no lugar de abstração"],
    erros: ["Narrar sem conflito", "Misturar ensaio e narrativa", "Final moralizante explícito"],
  },
  {
    id: "descritivo",
    nome: "Descritivo (livre)",
    modalidades: ["livre"],
    linhasPadrao: 15,
    estrutura: ["Visão de conjunto", "Detalhamento sensorial organizado", "Fechamento com a impressão dominante"],
    checklist: ["Organização espacial clara", "Adjetivação precisa", "Sem enredo"],
    erros: ["Virar narrativa", "Lista de características sem hierarquia"],
  },
];

export function generosDe(modalidade: Modalidade): Genero[] {
  return GENEROS.filter((g) => g.modalidades.includes(modalidade));
}

export function buscarGenero(id: string): Genero | undefined {
  return GENEROS.find((g) => g.id === id);
}

/** A questão curta da UFPR vale 15 pontos; a longa, 25 (edital 6.11.1). */
export function totalDePontos(modalidade: Modalidade, linhasMax: number): number {
  if (modalidade === "ufpr") return linhasMax <= 5 ? 15 : 25;
  return MODALIDADES[modalidade].totalPontos;
}
