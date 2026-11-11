/*
 * Catálogo: vitrine, filtro, modal, dados públicos e JSON-LD, gerados de catalogo/modelos.json.
 *
 * O mesmo arquivo roda no navegador e no build. No build, num contexto vazio (sem DOM,
 * sem rede, sem módulos do Node), as funções puras geram o HTML; no navegador, a fiação
 * (ligar) só mexe em atributos e clona os <template> já gerados: nenhum dado vira HTML
 * no navegador. Todo texto de dado passa por esc() antes de virar HTML.
 *
 * Campo de dado = {valor, fonte, status, nota}. Só "confirmado" e "duvida" com fonte são
 * publicados; "pendente" nunca aparece, nem no HTML, nem nos dados públicos.
 */
(function (raiz) {
  'use strict';

  const TIPOS = Object.freeze(['scooter', 'e-bike', 'triciclo']);
  const CLASSES = Object.freeze(['autopropelido', 'bicicleta_eletrica', 'ciclomotor', 'motoneta', 'motocicleta', 'triciclo']);
  const PUBLICAVEL = Object.freeze(['confirmado', 'duvida']);
  const ESPECIFICACOES = Object.freeze(['potencia', 'velocidade', 'autonomia', 'bateria', 'recarga', 'carga_maxima', 'peso']);
  const NO_CARD = Object.freeze(['velocidade', 'autonomia']);
  const CAMPOS_DO_PRECO = Object.freeze(['a_vista', 'parcelas_numero', 'parcelas_valor', 'juros_ao_mes', 'total_a_prazo']);
  const MARCADORES = Object.freeze(['catalogo-modal', 'catalogo-vitrine']);
  const ARQUIVO_DADOS = 'catalogo/modelos.json';
  const DONO_DOS_LINKS = 'lead-whatsapp';
  const EVENTO_FILTRO = 'es:filtrar_categoria';
  const CLASSE_PAGINA_COM_MODAL = 'es-catalogo-modal-aberto';
  const CLASSE_MODAL_ABERTO = 'es-catalogo-modal--aberto';
  const CLASSE_BARRA = 'es-catalogo-modal__barra';
  const REF_PRECO = 'catalogo:preco-incompleto';
  const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const ORIGEM = /^[a-z0-9_]{1,40}$/;
  const HEX = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
  const ARQUIVO_FOTO = /^assets\/(?:[A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\.(?:avif|jpe?g|png|webp)$/;
  // O apóstrofo vale no href: o encodeURIComponent não o codifica, e o href é escapado ao ser escrito.
  const HREF = /^https:\/\/[^\s"<>\\]+$/;
  const DATA = /^(\d{4})-(\d{2})-(\d{2})$/;
  const MAX_CENTAVOS = 1000000000;
  const MAX_MEDIDA = 1000000;
  const MAX_PARCELAS = 120;
  const FOCAVEIS = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
  // Símbolo da moeda montado por pedaços: este arquivo publicado não contém o símbolo
  // literal, então uma busca por ele no site/ só acha preço de verdade.
  const MOEDA = 'R' + '$';
  const ENTIDADES = Object.freeze({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' });

  const ROTULOS_PADRAO = Object.freeze({
    comprar: 'Comprar',
    detalhes: 'Ver detalhes',
    fechar: 'Fechar',
    todos: 'Todos',
    filtro: 'Filtrar por tipo',
    cores: 'Cores',
    especificacoes: 'Especificações',
    lista_tecnica: 'Itens',
    a_vista: 'à vista',
    parcelas: '{n}x de {valor}',
    juros: '{taxa}% de juros ao mês',
    sem_juros: 'sem juros',
    total_a_prazo: 'total a prazo: {valor}',
    resultado_um: '1 modelo',
    resultado_varios: '{n} modelos',
    tipos: Object.freeze({ scooter: 'Scooter', 'e-bike': 'E-bike', triciclo: 'Triciclo' }),
    classes: Object.freeze({
      autopropelido: 'Autopropelido',
      bicicleta_eletrica: 'Bicicleta elétrica',
      ciclomotor: 'Ciclomotor',
      motoneta: 'Motoneta',
      motocicleta: 'Motocicleta',
      triciclo: 'Triciclo',
    }),
    especificacao: Object.freeze({
      potencia: 'Potência',
      velocidade: 'Velocidade máxima',
      autonomia: 'Autonomia',
      bateria: 'Bateria',
      recarga: 'Tempo de recarga',
      carga_maxima: 'Carga máxima',
      peso: 'Peso',
    }),
  });
  const ORIGENS_PADRAO = Object.freeze({ card: 'vitrine', modal: 'modal' });
  // O dado da regra dos rótulos que pedem consulta de preço,
  // em palavras soltas e já normalizadas (sem acento e sem caixa): o arquivo publicado não contém
  // nenhuma frase inteira. A regra lê o texto como sequência de palavras inteiras (rotuloProibido):
  // 1. um verbo de `consulta`, até `max_ligacoes` palavras de `ligacao` e um `objeto`;
  // 2. na ordem inversa: um `objeto`, um "a" opcional e um verbo de `inversa`;
  // 3. um verbo de `ver`, até `max_ligacoes` palavras de `ligacao` e um `objeto_ver` (o "valor"
  //    fica fora: "saiba o valor do emplacamento" é frase de FAQ);
  // 4. uma frase solta de `frases`.
  // A `ligacao` é o que pode ficar entre o verbo e o objeto: artigos, possessivos e preposições, os advérbios
  // de tempo e de lugar ("ja", "agora", "hoje"…) e os pronomes oblíquos ("nos", "me", "lhe", "conosco"). Ela só
  // enche o meio: o verbo e o objeto continuam obrigatórios.
  // O "peca" de `consulta` não conta depois de uma palavra de `determinantes`: ali ele é a peça, substantivo
  // ("ao trocar a peça, o valor..."), e não o imperativo de pedir. O "consulta" não ganha a exceção.
  // `janela`: o maior número de palavras que um achado ocupa, o verbo, `max_ligacoes` ligações e o objeto
  // (quem procura em pedaços de um texto longo usa pedaços maiores que ela).
  const ROTULOS_PROIBIDOS = Object.freeze({
    consulta: Object.freeze(['consultar', 'consulte', 'consulta', 'perguntar', 'pergunte', 'solicitar', 'solicite', 'pedir', 'peca']),
    objeto: Object.freeze(['preco', 'precos', 'valor', 'valores']),
    inversa: Object.freeze(['consultar', 'consulte', 'combinar']),
    ver: Object.freeze(['ver', 'veja', 'saber', 'saiba']),
    objeto_ver: Object.freeze(['preco', 'precos']),
    frases: Object.freeze([Object.freeze(['sob', 'consulta'])]),
    ligacao: Object.freeze([
      'o', 'a', 'os', 'as', 'um', 'uma', 'seu', 'sua', 'seus', 'suas', 'nosso', 'nossa', 'nossos', 'nossas', 'de', 'do', 'da', 'dos', 'das',
      'ja', 'agora', 'hoje', 'aqui', 'logo', 'entao', 'tambem', 'ainda', 'so',
      'nos', 'me', 'lhe', 'conosco',
    ]),
    max_ligacoes: 3,
    determinantes: Object.freeze(['a', 'as', 'uma', 'umas', 'da', 'das', 'na', 'nas', 'pela', 'pelas', 'de', 'sua', 'suas', 'nossa', 'nossas', 'essa', 'essas', 'esta', 'estas', 'cada', 'outra', 'nova', 'mesma', 'toda']),
    janela: 5,
  });

  // ------------------------------------------------------------ utilidades

  const eObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const textoValido = (v) => typeof v === 'string' && v.trim() !== '';
  const lista = (v) => (Array.isArray(v) ? v : []);

  function esc(valor) {
    return String(valor).replace(/[&<>"']/g, (c) => ENTIDADES[c]);
  }

  /** ` nome="valor"` de cada par; `true` = atributo sem valor; null, undefined e false saem. */
  function atributos(pares) {
    let saida = '';
    for (const [nome, valor] of pares) {
      if (valor === null || valor === undefined || valor === false) continue;
      saida += valor === true ? ` ${nome}` : ` ${nome}="${esc(valor)}"`;
    }
    return saida;
  }

  /** Troca `{chave}` por valores já formatados (cada marcador aparece uma vez, como valor). */
  function trocar(texto, valores) {
    let saida = texto;
    for (const [chave, valor] of Object.entries(valores)) saida = saida.split(`{${chave}}`).join(valor);
    return saida;
  }

  function dataValida(texto) {
    const m = typeof texto === 'string' ? DATA.exec(texto) : null;
    if (!m) return false;
    const ano = Number(m[1]);
    const mes = Number(m[2]);
    const dia = Number(m[3]);
    const bissexto = (ano % 4 === 0 && ano % 100 !== 0) || ano % 400 === 0;
    const dias = [31, bissexto ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return mes >= 1 && mes <= 12 && dia >= 1 && dia <= dias[mes - 1];
  }

  function agrupar(inteiro) {
    return inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  /** Centavos inteiros → texto em reais (pt-BR), sem depender do Intl da máquina. */
  function formatarCentavos(centavos) {
    if (!Number.isInteger(centavos) || centavos < 0) throw new Error('valor em centavos inválido');
    const reais = Math.floor(centavos / 100);
    const resto = centavos % 100;
    return `${MOEDA}\u00a0${agrupar(String(reais))},${String(resto).padStart(2, '0')}`;
  }

  /** Centavos → preço decimal com ponto, para dado estruturado (reais, ponto e os dois dígitos dos centavos). */
  function precoDecimal(centavos) {
    return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`;
  }

  /** Número → texto pt-BR (milhar com ponto, decimal com vírgula, até 2 casas). */
  function formatarNumero(n) {
    if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error('número inválido');
    const [inteiro, fracao] = (Math.round(n * 100) / 100).toFixed(2).split('.');
    const casas = fracao.replace(/0+$/, '');
    return casas ? `${agrupar(inteiro)},${casas}` : agrupar(inteiro);
  }

  // ------------------------------------------------------------ o que é publicado

  /** confirmado ou duvida, com valor e com fonte. */
  function campoPublicado(campo) {
    return eObjeto(campo) && PUBLICAVEL.includes(campo.status) && campo.valor !== null && campo.valor !== undefined && textoValido(campo.fonte);
  }

  function valorPublicado(campo) {
    return campoPublicado(campo) ? campo.valor : undefined;
  }

  function textoPublicado(campo) {
    const v = valorPublicado(campo);
    return typeof v === 'string' && v.trim() !== '' ? v : null;
  }

  function centavosPublicados(campo) {
    const v = valorPublicado(campo);
    return Number.isSafeInteger(v) && v > 0 && v <= MAX_CENTAVOS ? v : null;
  }

  function modoValido(modo) {
    if (modo !== 'visivel' && modo !== 'oculto') throw new Error('modoPreco precisa ser "visivel" ou "oculto"');
    return modo;
  }

  /**
   * Preço que aparece: null com o preço oculto ou sem à vista publicado. O parcelamento só
   * entra completo (número e valor das parcelas, juros e total a prazo).
   */
  function precoDoModelo(modelo, modoPreco) {
    if (modoValido(modoPreco) === 'oculto' || !eObjeto(modelo) || !eObjeto(modelo.preco)) return null;
    const p = modelo.preco;
    const aVista = centavosPublicados(p.a_vista);
    if (aVista === null) return null;
    const saida = { a_vista: aVista };
    const numero = valorPublicado(p.parcelas_numero);
    const parcela = centavosPublicados(p.parcelas_valor);
    const juros = valorPublicado(p.juros_ao_mes);
    const total = centavosPublicados(p.total_a_prazo);
    if (Number.isInteger(numero) && numero >= 1 && numero <= MAX_PARCELAS && parcela !== null && typeof juros === 'number' && Number.isFinite(juros) && juros >= 0 && juros <= 100 && total !== null) {
      saida.parcelas_numero = numero;
      saida.parcelas_valor = parcela;
      saida.juros_ao_mes = juros;
      saida.total_a_prazo = total;
    }
    return saida;
  }

  function precoPublicado(modelo, modoPreco) {
    return precoDoModelo(modelo, modoPreco) !== null;
  }

  /** Campos do preço que não aparecem (vazio = preço completo). */
  function faltaNoPreco(modelo) {
    const preco = precoDoModelo(modelo, 'visivel');
    if (!preco) return CAMPOS_DO_PRECO.slice();
    return CAMPOS_DO_PRECO.filter((c) => preco[c] === undefined);
  }

  /** `modelo` com preço publicado; `preco` quando o preço não aparece (oculto ou sem fonte). */
  function contextoDoBotao(modelo, modoPreco) {
    return precoPublicado(modelo, modoPreco) ? 'modelo' : 'preco';
  }

  function tipoPublicado(modelo) {
    const v = eObjeto(modelo) ? valorPublicado(modelo.tipo) : undefined;
    return TIPOS.includes(v) ? v : null;
  }

  /** Documento por escrito de verdade: descrição, fonte e data válida (não basta um objeto). */
  function documentoValido(doc) {
    return eObjeto(doc) && textoValido(doc.descricao) && textoValido(doc.fonte) && dataValida(doc.data);
  }

  /** O selo só com documento e com a classe documentada igual a ele. */
  function seloDoModelo(modelo) {
    const cl = eObjeto(modelo) && eObjeto(modelo.classe_legal) ? modelo.classe_legal : null;
    if (!cl || !CLASSES.includes(cl.selo) || !documentoValido(cl.documento) || cl.documentada !== cl.selo) return null;
    return cl.selo;
  }

  function fotosPublicas(fotos) {
    return lista(fotos)
      .filter((f) => eObjeto(f) && typeof f.arquivo === 'string' && ARQUIVO_FOTO.test(f.arquivo) && textoValido(f.fonte) && dataValida(f.data))
      .map((f) => {
        const saida = { arquivo: f.arquivo };
        if (Number.isInteger(f.largura) && f.largura > 0) saida.largura = f.largura;
        if (Number.isInteger(f.altura) && f.altura > 0) saida.altura = f.altura;
        return saida;
      });
  }

  /** Cores que aparecem (sem pendente), sem nome repetido; amostra só em hex. */
  function coresPublicas(modelo) {
    const vistas = new Set();
    const saida = [];
    for (const c of lista(eObjeto(modelo) ? modelo.cores : null)) {
      if (!eObjeto(c) || !PUBLICAVEL.includes(c.status) || !textoValido(c.nome) || !textoValido(c.fonte)) continue;
      const nome = c.nome.trim();
      if (vistas.has(nome.toLowerCase())) continue;
      vistas.add(nome.toLowerCase());
      saida.push({ nome, amostra: typeof c.amostra === 'string' && HEX.test(c.amostra) ? c.amostra : null, fotos: fotosPublicas(c.fotos) });
    }
    return saida;
  }

  function medidaValida(v) {
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= MAX_MEDIDA;
  }

  function especificacoesPublicas(modelo) {
    const esp = eObjeto(modelo) && eObjeto(modelo.especificacoes) ? modelo.especificacoes : {};
    const saida = {};
    for (const k of ESPECIFICACOES) {
      const c = esp[k];
      if (campoPublicado(c) && medidaValida(c.valor) && textoValido(c.unidade)) saida[k] = { valor: c.valor, unidade: c.unidade };
    }
    return saida;
  }

  function listaTecnica(modelo) {
    const v = eObjeto(modelo) ? valorPublicado(modelo.lista_tecnica) : undefined;
    return lista(v).filter(textoValido);
  }

  function ordemDe(modelo, indice) {
    return Number.isInteger(modelo.ordem) && modelo.ordem >= 0 ? [modelo.ordem, indice] : [Number.MAX_SAFE_INTEGER, indice];
  }

  /** Visível, com id válido e nome publicado. */
  function vaiParaAVitrine(m) {
    return eObjeto(m) && typeof m.id === 'string' && ID.test(m.id) && m.visivel !== false && textoPublicado(m.nome) !== null;
  }

  /**
   * Modelos da vitrine: visíveis, com id válido e nome publicado, sem id repetido, na
   * ordem do campo `ordem` (depois a do arquivo). Nunca pelo preço.
   */
  function modelosDaVitrine(catalogo) {
    const vistos = new Set();
    const candidatos = [];
    lista(eObjeto(catalogo) ? catalogo.modelos : null).forEach((m, i) => {
      if (!vaiParaAVitrine(m) || vistos.has(m.id)) return;
      vistos.add(m.id);
      candidatos.push({ m, chave: ordemDe(m, i) });
    });
    candidatos.sort((a, b) => a.chave[0] - b.chave[0] || a.chave[1] - b.chave[1]);
    return candidatos.map((c) => c.m);
  }

  // ------------------------------------------------------------ opções

  /** Rótulo aceito: texto curto que não pede consulta de preço (senão, vale o padrão). */
  function textoDeRotulo(v) {
    return typeof v === 'string' && v.trim() !== '' && v.length <= 120 && !rotuloProibido(v) ? v.trim() : null;
  }

  function mesclarRotulos(entrada) {
    const saida = {};
    for (const [chave, padrao] of Object.entries(ROTULOS_PADRAO)) {
      const dado = eObjeto(entrada) ? entrada[chave] : undefined;
      if (eObjeto(padrao)) {
        saida[chave] = {};
        for (const [sub, p] of Object.entries(padrao)) saida[chave][sub] = (eObjeto(dado) && textoDeRotulo(dado[sub])) || p;
      } else {
        saida[chave] = textoDeRotulo(dado) || padrao;
      }
    }
    return saida;
  }

  function normalizarOrigens(entrada) {
    const saida = {};
    for (const [chave, padrao] of Object.entries(ORIGENS_PADRAO)) {
      const v = eObjeto(entrada) ? entrada[chave] : undefined;
      if (v === undefined) saida[chave] = padrao;
      else if (typeof v === 'string' && ORIGEM.test(v)) saida[chave] = v;
      else throw new Error(`origem inválida em origens.${chave}: use ^[a-z0-9_]{1,40}$`);
    }
    return saida;
  }

  /** {modoPreco (obrigatório), rotulos?, links?, origens?}. */
  function opcoesDoRender(opcoes) {
    const o = eObjeto(opcoes) ? opcoes : {};
    return {
      modoPreco: modoValido(o.modoPreco),
      rotulos: mesclarRotulos(o.rotulos),
      links: typeof o.links === 'function' ? o.links : null,
      origens: normalizarOrigens(o.origens),
    };
  }

  // ------------------------------------------------------------ links

  function pedidoDoBotao({ contexto, origem, modelo, cor }) {
    return { atributos: { 'data-wa-contexto': contexto, 'data-origem': origem, 'data-modelo': modelo, 'data-cor': typeof cor === 'string' ? cor : '' } };
  }

  /** O href que a função de links devolve, só se for https:// (senão, null). */
  function hrefDoPedido(pedido, links) {
    if (typeof links !== 'function') return null;
    let href;
    try {
      href = links(pedido);
    } catch (_erro) {
      return null;
    }
    return typeof href === 'string' && HREF.test(href) ? href : null;
  }

  function botaoComprar(modelo, o, { origem, cor, classe, descrito }) {
    const contexto = contextoDoBotao(modelo, o.modoPreco);
    const href = hrefDoPedido(pedidoDoBotao({ contexto, origem, modelo: modelo.id, cor }), o.links) || '#';
    return `<a${atributos([
      ['class', classe],
      ['data-es-link', DONO_DOS_LINKS],
      ['data-wa-contexto', contexto],
      ['data-origem', origem],
      ['data-modelo', modelo.id],
      ['data-cor', cor],
      ['href', href],
      ['aria-describedby', descrito],
    ])}>${esc(o.rotulos.comprar)}</a>`;
  }

  // ------------------------------------------------------------ HTML

  function htmlFoto(foto, alt, classe, carregarDepois) {
    return `<img${atributos([
      ['class', classe],
      ['src', foto.arquivo],
      ['alt', alt],
      ['width', foto.largura],
      ['height', foto.altura],
      ['loading', carregarDepois ? 'lazy' : null],
      ['decoding', 'async'],
    ])}>`;
  }

  function htmlPreco(preco, r) {
    if (!preco) return '';
    let h = `<div class="es-catalogo-preco"><p class="es-catalogo-preco__a-vista"><span class="es-catalogo-preco__valor">${esc(formatarCentavos(preco.a_vista))}</span> <span class="es-catalogo-preco__condicao">${esc(r.a_vista)}</span></p>`;
    if (preco.parcelas_numero !== undefined) {
      const parcelas = trocar(r.parcelas, { n: String(preco.parcelas_numero), valor: formatarCentavos(preco.parcelas_valor) });
      const juros = preco.juros_ao_mes === 0 ? r.sem_juros : trocar(r.juros, { taxa: formatarNumero(preco.juros_ao_mes) });
      const total = trocar(r.total_a_prazo, { valor: formatarCentavos(preco.total_a_prazo) });
      h += `<p class="es-catalogo-preco__parcelas">${esc(parcelas)} ${esc(juros)}</p><p class="es-catalogo-preco__total">${esc(total)}</p>`;
    }
    return `${h}</div>`;
  }

  function htmlEspecificacoes(esp, chaves, r, classe) {
    const itens = chaves.filter((k) => esp[k]);
    if (!itens.length) return '';
    return `<dl class="${classe}">${itens.map((k) => `<div class="es-catalogo-especificacoes__item"><dt>${esc(r.especificacao[k])}</dt><dd>${esc(`${formatarNumero(esp[k].valor)} ${esp[k].unidade}`)}</dd></div>`).join('')}</dl>`;
  }

  function htmlSelo(selo, r) {
    return selo ? `<p class="es-catalogo-selo">${esc(r.classes[selo])}</p>` : '';
  }

  function card(modelo, o) {
    const r = o.rotulos;
    const nome = textoPublicado(modelo.nome);
    const idNome = `es-catalogo-nome-${modelo.id}`;
    const fotos = fotosPublicas(modelo.fotos);
    return [
      `<li${atributos([
        ['class', modelo.destaque === true ? 'es-catalogo-card es-catalogo-card--destaque' : 'es-catalogo-card'],
        ['data-es-modelo', modelo.id],
        ['data-tipo', tipoPublicado(modelo)],
      ])}>`,
      fotos.length ? htmlFoto(fotos[0], nome, 'es-catalogo-card__foto', true) : '',
      `<h3 class="es-catalogo-card__nome" id="${esc(idNome)}">${esc(nome)}</h3>`,
      htmlSelo(seloDoModelo(modelo), r),
      htmlEspecificacoes(especificacoesPublicas(modelo), NO_CARD, r, 'es-catalogo-especificacoes es-catalogo-especificacoes--card'),
      htmlPreco(precoDoModelo(modelo, o.modoPreco), r),
      `<button${atributos([
        ['type', 'button'],
        ['class', 'es-catalogo-card__detalhes'],
        ['data-es-abrir', modelo.id],
        ['aria-haspopup', 'dialog'],
        ['aria-describedby', idNome],
        ['hidden', true],
      ])}>${esc(r.detalhes)}</button>`,
      botaoComprar(modelo, o, { origem: o.origens.card, cor: '', classe: 'es-catalogo-card__comprar', descrito: idNome }),
      '</li>',
    ].join('');
  }

  /** O card de um modelo (o botão Comprar sem cor: a pessoa ainda não escolheu). "" se ele não vai para a vitrine. */
  function htmlCard(modelo, opcoes) {
    const o = opcoesDoRender(opcoes);
    return vaiParaAVitrine(modelo) ? card(modelo, o) : '';
  }

  /** A galeria que aparece para a cor: a da própria cor, se ela tem foto; senão, a do modelo (""). */
  function galeriaDaCor(comFoto, cor) {
    return typeof cor === 'string' && cor !== '' && lista(comFoto).includes(cor) ? cor : '';
  }

  function htmlGaleria(fotos, nome, cor, oculta) {
    return `<div${atributos([['class', 'es-catalogo-galeria'], ['data-es-galeria', cor], ['hidden', oculta]])}>${fotos.map((f, i) => htmlFoto(f, nome, 'es-catalogo-galeria__foto', i > 0)).join('')}</div>`;
  }

  function detalhe(modelo, o) {
    const r = o.rotulos;
    const nome = textoPublicado(modelo.nome);
    const cores = coresPublicas(modelo);
    const primeira = cores.length ? cores[0].nome : '';
    const comFoto = cores.filter((c) => c.fotos.length).map((c) => c.nome);
    const visivel = galeriaDaCor(comFoto, primeira);
    const partes = [
      `<h2 class="es-catalogo-modal__titulo" id="es-catalogo-modal-titulo">${esc(nome)}</h2>`,
      '<div class="es-catalogo-galerias">',
      htmlGaleria(fotosPublicas(modelo.fotos), nome, '', visivel !== ''),
    ];
    for (const c of cores) if (c.fotos.length) partes.push(htmlGaleria(c.fotos, nome, c.nome, visivel !== c.nome));
    partes.push('</div>');
    if (cores.length) {
      partes.push(`<div class="es-catalogo-cores" role="group" aria-label="${esc(r.cores)}">`);
      cores.forEach((c, i) => {
        const amostra = c.amostra ? `<span class="es-catalogo-cor__amostra" data-es-amostra="${esc(c.amostra)}" aria-hidden="true"></span>` : '';
        partes.push(`<button${atributos([['type', 'button'], ['class', 'es-catalogo-cor'], ['data-es-cor', c.nome], ['aria-pressed', i === 0 ? 'true' : 'false']])}>${amostra}<span class="es-catalogo-cor__nome">${esc(c.nome)}</span></button>`);
      });
      partes.push('</div>');
    }
    partes.push(htmlSelo(seloDoModelo(modelo), r));
    const esp = especificacoesPublicas(modelo);
    if (Object.keys(esp).length) partes.push(`<h3 class="es-catalogo-modal__subtitulo">${esc(r.especificacoes)}</h3>${htmlEspecificacoes(esp, ESPECIFICACOES, r, 'es-catalogo-especificacoes')}`);
    const itens = listaTecnica(modelo);
    if (itens.length) partes.push(`<h3 class="es-catalogo-modal__subtitulo">${esc(r.lista_tecnica)}</h3><ul class="es-catalogo-lista-tecnica">${itens.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`);
    // A barra de compra fecha o detalhe (é o último filho): o bloco de preço, quando ele aparece, e o único
    // "Comprar" do modal. O preço sai só aqui, uma vez; sem preço, a barra fica só com o botão.
    const comprar = botaoComprar(modelo, o, { origem: o.origens.modal, cor: primeira, classe: 'es-catalogo-modal__comprar', descrito: null });
    partes.push(`<div class="${CLASSE_BARRA}">${htmlPreco(precoDoModelo(modelo, o.modoPreco), r)}${comprar}</div>`);
    return partes.join('');
  }

  /** O conteúdo do modal de um modelo (o que vai dentro do <template> dele). "" se ele não vai para a vitrine. */
  function htmlDetalhe(modelo, opcoes) {
    const o = opcoesDoRender(opcoes);
    return vaiParaAVitrine(modelo) ? detalhe(modelo, o) : '';
  }

  function itensDoFiltro(modelos) {
    return modelos.map((m) => ({ id: m.id, tipo: tipoPublicado(m) }));
  }

  /** ['todos', …tipos presentes] quando o filtro muda alguma coisa; senão, []. */
  function opcoesDeFiltro(itens) {
    const presentes = TIPOS.filter((t) => lista(itens).some((i) => i.tipo === t));
    const grupos = presentes.length + (lista(itens).some((i) => !TIPOS.includes(i.tipo)) ? 1 : 0);
    return grupos >= 2 ? ['todos'].concat(presentes) : [];
  }

  /** Quem aparece com o filtro: modelo sem tipo só em "todos". A ordem é a da vitrine. */
  function filtrar(itens, tipo) {
    const escolhido = TIPOS.includes(tipo) ? tipo : 'todos';
    const visiveis = [];
    const ocultos = [];
    for (const i of lista(itens)) {
      if (escolhido === 'todos' || i.tipo === escolhido) visiveis.push(i.id);
      else ocultos.push(i.id);
    }
    return { tipo: escolhido, visiveis, ocultos };
  }

  function textoDoResultado(quantidade, rotulos) {
    return quantidade === 1 ? rotulos.um : trocar(rotulos.varios, { n: String(quantidade) });
  }

  function eventoDoFiltro(resultado) {
    return { nome: EVENTO_FILTRO, detalhe: { categoria: resultado.tipo, quantidade: resultado.visiveis.length } };
  }

  function htmlFiltro(opcoes, r) {
    if (!opcoes.length) return '';
    const botoes = opcoes.map((t, i) => `<button${atributos([
      ['type', 'button'],
      ['class', 'es-catalogo-filtro__opcao'],
      ['data-es-filtro-tipo', t],
      ['aria-pressed', i === 0 ? 'true' : 'false'],
    ])}>${esc(t === 'todos' ? r.todos : r.tipos[t])}</button>`).join('');
    const status = `<p${atributos([
      ['class', 'es-catalogo-status'],
      ['role', 'status'],
      ['aria-live', 'polite'],
      ['data-es-status', true],
      ['data-es-rotulo-um', r.resultado_um],
      ['data-es-rotulo-varios', r.resultado_varios],
    ])}></p>`;
    return `<div class="es-catalogo-filtro" role="group" aria-label="${esc(r.filtro)}" data-es-filtro hidden>${botoes}</div>${status}`;
  }

  /** Filtro + lista de cards (o filtro e o "Ver detalhes" só aparecem com o JS ligado). */
  function htmlVitrine(catalogo, opcoes) {
    const o = opcoesDoRender(opcoes);
    const modelos = modelosDaVitrine(catalogo);
    const filtro = htmlFiltro(opcoesDeFiltro(itensDoFiltro(modelos)), o.rotulos);
    return `<div class="es-catalogo" data-es-catalogo>${filtro}<ul class="es-catalogo-lista" data-es-lista>${modelos.map((m) => card(m, o)).join('')}</ul></div>`;
  }

  /**
   * O modal, um por página: [data-es-catalogo-modal] com o fundo, a caixa do diálogo e, DENTRO
   * dele, um <template> com o detalhe de cada modelo (inerte até a fiação clonar).
   */
  function htmlModal(catalogo, opcoes) {
    const o = opcoesDoRender(opcoes);
    const caixa = `<div class="es-catalogo-modal" data-es-catalogo-modal hidden><div class="es-catalogo-modal__fundo" data-es-fechar></div><div class="es-catalogo-modal__caixa" role="dialog" aria-modal="true" aria-labelledby="es-catalogo-modal-titulo" tabindex="-1"><button type="button" class="es-catalogo-modal__fechar" data-es-fechar aria-label="${esc(o.rotulos.fechar)}"><span aria-hidden="true">\u00d7</span></button><div class="es-catalogo-modal__conteudo" data-es-catalogo-conteudo></div></div>`;
    const detalhes = modelosDaVitrine(catalogo).map((m) => `<template data-es-modelo-detalhe="${esc(m.id)}">${detalhe(m, o)}</template>`).join('');
    return `${caixa}${detalhes}</div>`;
  }

  // ------------------------------------------------------------ dados públicos e JSON-LD

  /** O modelo como vai para o navegador: sem fonte, status, nota, pendente, foto sem origem nem preço oculto. */
  function projecaoDoModelo(modelo, modoPreco) {
    const p = { id: modelo.id, nome: textoPublicado(modelo.nome) };
    const tipo = tipoPublicado(modelo);
    if (tipo) p.tipo = tipo;
    const selo = seloDoModelo(modelo);
    if (selo) p.selo = selo;
    const esp = especificacoesPublicas(modelo);
    if (Object.keys(esp).length) p.especificacoes = esp;
    const preco = precoDoModelo(modelo, modoPreco);
    if (preco) p.preco = preco;
    const itens = listaTecnica(modelo);
    if (itens.length) p.lista_tecnica = itens;
    p.cores = coresPublicas(modelo).map((c) => {
      const cor = { nome: c.nome };
      if (c.amostra) cor.amostra = c.amostra;
      if (c.fotos.length) cor.fotos = c.fotos;
      return cor;
    });
    p.fotos = fotosPublicas(modelo.fotos);
    p.destaque = modelo.destaque === true;
    return p;
  }

  function dadosPublicosDoCatalogo(catalogo, opcoes) {
    const modo = modoValido(eObjeto(opcoes) ? opcoes.modoPreco : undefined);
    return { modelos: modelosDaVitrine(catalogo).map((m) => projecaoDoModelo(m, modo)) };
  }

  /**
   * `Product` do schema.org só com preço publicado: null com o preço oculto, sem preço ou
   * com o preço sem fonte. Preço em BRL, convertido dos centavos; nunca avaliação da loja.
   * Quem escreve o objeto num <script type="application/ld+json"> troca "<" por "\u003c".
   */
  function jsonLdProduto(modelo, opcoes) {
    const modo = modoValido(eObjeto(opcoes) ? opcoes.modoPreco : undefined);
    if (!eObjeto(modelo) || modelo.visivel === false) return null;
    const nome = textoPublicado(modelo.nome);
    const preco = precoDoModelo(modelo, modo);
    if (nome === null || preco === null) return null;
    return {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: nome,
      offers: { '@type': 'Offer', price: precoDecimal(preco.a_vista), priceCurrency: 'BRL' },
    };
  }

  // ------------------------------------------------------------ ganchos do build

  function catalogoDaEntrada(entrada) {
    return eObjeto(entrada) && eObjeto(entrada.dados) && Object.prototype.hasOwnProperty.call(entrada.dados, ARQUIVO_DADOS) ? entrada.dados[ARQUIVO_DADOS] : null;
  }

  /** O modo de preço do build; qualquer coisa que não seja "visivel" vale como oculto. */
  function modoDaEntrada(entrada) {
    return eObjeto(entrada) && eObjeto(entrada.modos) && entrada.modos.preco === 'visivel' ? 'visivel' : 'oculto';
  }

  function rotulosDaEntrada(entrada) {
    const w = eObjeto(entrada) && eObjeto(entrada.config) && eObjeto(entrada.config.whatsapp) ? entrada.config.whatsapp : null;
    return { comprar: w && eObjeto(w.rotulos) ? w.rotulos.comprar : undefined };
  }

  function render(entrada) {
    const o = { modoPreco: modoDaEntrada(entrada), rotulos: rotulosDaEntrada(entrada) };
    const catalogo = catalogoDaEntrada(entrada);
    const pedidos = eObjeto(entrada) && Array.isArray(entrada.marcadores) ? entrada.marcadores : MARCADORES;
    const saida = {};
    for (const nome of pedidos) {
      if (nome === 'catalogo-vitrine') saida[nome] = htmlVitrine(catalogo, o);
      else if (nome === 'catalogo-modal') saida[nome] = htmlModal(catalogo, o);
    }
    return saida;
  }

  function dadosPublicos(entrada) {
    return dadosPublicosDoCatalogo(catalogoDaEntrada(entrada), { modoPreco: modoDaEntrada(entrada) });
  }

  function jsonld(entrada) {
    const modo = modoDaEntrada(entrada);
    return modelosDaVitrine(catalogoDaEntrada(entrada)).map((m) => jsonLdProduto(m, { modoPreco: modo })).filter((p) => p !== null);
  }

  /** Campos ({valor?, status}) do modelo, com o caminho, em qualquer nível. */
  function camposDe(valor, caminho, saida) {
    if (Array.isArray(valor)) valor.forEach((v, i) => camposDe(v, `${caminho}/${i}`, saida));
    else if (eObjeto(valor)) {
      if (Object.prototype.hasOwnProperty.call(valor, 'status')) saida.push({ caminho: caminho.slice(1), campo: valor });
      for (const [k, v] of Object.entries(valor)) if (k !== 'documento') camposDe(v, `${caminho}/${k}`, saida);
    }
    return saida;
  }

  /** Depois de `i`, até `max_ligacoes` palavras de ligação e uma de `objetos`? */
  function seguidoDoObjeto(palavras, i, objetos) {
    const R = ROTULOS_PROIBIDOS;
    let j = i + 1;
    for (let k = 0; k < R.max_ligacoes && j < palavras.length && R.ligacao.includes(palavras[j]) && !objetos.includes(palavras[j]); k += 1) j += 1;
    return j < palavras.length && objetos.includes(palavras[j]);
  }

  /**
   * O rótulo pede consulta de preço? A regra de ROTULOS_PROIBIDOS, por palavra inteira, sobre o texto
   * sem acento, sem caixa e com todo caractere fora de a-z0-9 virando separação.
   */
  function rotuloProibido(texto) {
    if (typeof texto !== 'string') return false;
    const R = ROTULOS_PROIBIDOS;
    const w = texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ');
    for (let i = 0; i < w.length; i += 1) {
      const pecaSubstantivo = w[i] === 'peca' && i > 0 && R.determinantes.includes(w[i - 1]);
      if (R.consulta.includes(w[i]) && !pecaSubstantivo && seguidoDoObjeto(w, i, R.objeto)) return true;
      if (R.ver.includes(w[i]) && seguidoDoObjeto(w, i, R.objeto_ver)) return true;
      if (R.objeto.includes(w[i])) {
        const j = w[i + 1] === 'a' ? i + 2 : i + 1;
        if (j < w.length && R.inversa.includes(w[j])) return true;
      }
      if (R.frases.some((f) => f.every((p, k) => w[i + k] === p))) return true;
    }
    return false;
  }

  /** Teto de um número do catálogo pelo caminho do campo (null = sem teto próprio). */
  function tetoDoCampo(caminho) {
    if (/^preco\/(a_vista|parcelas_valor|total_a_prazo)$/.test(caminho)) return MAX_CENTAVOS;
    if (caminho === 'preco/parcelas_numero') return MAX_PARCELAS;
    if (caminho === 'preco/juros_ao_mes') return 100;
    if (/^especificacoes\/[a-z_]+$/.test(caminho)) return MAX_MEDIDA;
    return null;
  }

  function excecaoDoPreco(decisoes, id) {
    return lista(decisoes).some((d) => eObjeto(d) && (d.ref === REF_PRECO || d.ref === `${REF_PRECO}:${id}`) && dataValida(d.at) && textoValido(d.risk));
  }

  /**
   * Regras do build. Trava: rótulo do botão que pede consulta de preço, arquivo ausente, id
   * inválido ou repetido, número sem fonte ou acima do teto, selo sem documento, foto sem
   * fonte ou sem data, cor repetida. Alerta: campo em dúvida, preço incompleto (sem decisão
   * datada com o risco escrito; nunca com o preço oculto), nome pendente e vitrine vazia.
   */
  function regras(entrada) {
    const travas = [];
    const alertas = [];
    if (rotuloProibido(rotulosDaEntrada(entrada).comprar)) {
      travas.push('config.whatsapp.rotulos.comprar pede consulta de preço: o botão do modelo é da família "Comprar", também com o preço oculto (troque o rótulo no config)');
    }
    const catalogo = catalogoDaEntrada(entrada);
    if (catalogo === null || catalogo === undefined) {
      travas.push(`${ARQUIVO_DADOS} não existe: rode es intake promover <slug> (ou escreva o arquivo no formato de esquemas/modelos.schema.json do módulo catalogo)`);
      return { travas, alertas };
    }
    if (!eObjeto(catalogo) || !Array.isArray(catalogo.modelos)) {
      travas.push(`${ARQUIVO_DADOS} precisa ser {"modelos": [ … ]}`);
      return { travas, alertas };
    }
    const oculto = modoDaEntrada(entrada) === 'oculto';
    const decisoes = eObjeto(entrada) ? entrada.decisoes : null;
    const ids = new Map();
    catalogo.modelos.forEach((m, i) => {
      const idOk = eObjeto(m) && typeof m.id === 'string' && ID.test(m.id);
      const onde = `modelos/${i}${idOk ? ` (${m.id})` : ''}`;
      if (!eObjeto(m)) {
        travas.push(`${onde}: não é um objeto`);
        return;
      }
      if (!idOk) travas.push(`${onde}: id fora do formato kebab-case`);
      else if (ids.has(m.id)) travas.push(`${onde}: id repetido (o mesmo de modelos/${ids.get(m.id)})`);
      else ids.set(m.id, i);

      const campos = camposDe(m, '', []);
      for (const c of campos) {
        if (typeof c.campo.valor !== 'number') continue;
        if (!textoValido(c.campo.fonte)) travas.push(`${onde}: ${c.caminho} tem número sem fonte (nenhum número sem fonte)`);
        const teto = tetoDoCampo(c.caminho);
        if (teto !== null && !(Number.isFinite(c.campo.valor) && c.campo.valor >= 0 && c.campo.valor <= teto)) travas.push(`${onde}: ${c.caminho} fora da faixa (de 0 a ${teto})`);
      }
      const cl = eObjeto(m.classe_legal) ? m.classe_legal : {};
      if (cl.selo !== null && cl.selo !== undefined && seloDoModelo(m) === null) {
        travas.push(`${onde}: selo legal sem documento (classe_legal.selo só com classe_legal.documento e com classe_legal.documentada igual ao selo)`);
      }
      const fotos = lista(m.fotos).map((f, j) => ({ f, onde: `fotos/${j}` }));
      lista(m.cores).forEach((c, j) => {
        if (eObjeto(c)) lista(c.fotos).forEach((f, k) => fotos.push({ f, onde: `cores/${j}/fotos/${k}` }));
      });
      for (const { f, onde: ondeFoto } of fotos) {
        if (!eObjeto(f) || !textoValido(f.fonte) || !dataValida(f.data)) travas.push(`${onde}: ${ondeFoto}: foto sem fonte ou sem data (anote a origem; com fonte e data a foto passa, mesmo com o tipo de origem pendente)`);
      }
      const nomes = new Map();
      lista(m.cores).forEach((c, j) => {
        if (!eObjeto(c) || typeof c.nome !== 'string') return;
        const chave = c.nome.trim().toLowerCase();
        if (nomes.has(chave)) travas.push(`${onde}: cores/${j} repete o nome de cores/${nomes.get(chave)} (o nome identifica a cor no botão)`);
        else nomes.set(chave, j);
      });

      if (m.visivel === false) return;
      if (textoPublicado(m.nome) === null) alertas.push(`${onde}: nome pendente: o modelo fica fora da vitrine`);
      const duvidas = campos.filter((c) => c.campo.status === 'duvida').map((c) => c.caminho);
      if (duvidas.length) alertas.push(`${onde}: em dúvida (publica marcado na prévia e trava o go-live): ${duvidas.join(', ')}`);
      if (!oculto) {
        const falta = faltaNoPreco(m);
        if (falta.length && !excecaoDoPreco(decisoes, m.id)) {
          alertas.push(`${onde}: preço incompleto: falta ${falta.join(', ')}. Se a loja pediu assim, registre a decisão em decisions[] com data, risco e ref "${REF_PRECO}:${m.id}"`);
        }
      }
    });
    if (modelosDaVitrine(catalogo).length === 0) alertas.push('nenhum modelo publicável: a vitrine sai vazia');
    return { travas, alertas };
  }

  // ------------------------------------------------------------ comportamento (puro)

  function estadoInicialDoModal() {
    return { aberto: false, modelo: null, cor: null, cores: [] };
  }

  /** Abrir começa sempre da 1ª cor do modelo aberto (nada da escolha do modelo anterior). */
  function abrirModal(_estado, { modelo, cores }) {
    const nomes = lista(cores).filter(textoValido);
    return { aberto: true, modelo, cor: nomes.length ? nomes[0] : '', cores: nomes };
  }

  function trocarCor(estado, cor) {
    return estado.aberto && estado.cores.includes(cor) ? { aberto: true, modelo: estado.modelo, cor, cores: estado.cores } : estado;
  }

  function fecharModal(_estado) {
    return estadoInicialDoModal();
  }

  function acaoDaTecla(tecla, comShift) {
    if (tecla === 'Escape' || tecla === 'Esc') return { acao: 'fechar' };
    if (tecla === 'Tab') return { acao: 'foco', voltar: comShift === true };
    return { acao: null };
  }

  /** Índice do próximo elemento focável, preso no modal (`atual` = -1 fora da lista). */
  function proximoFoco(atual, total, voltar) {
    if (!Number.isInteger(total) || total <= 0) return -1;
    if (!Number.isInteger(atual) || atual < 0 || atual >= total) return voltar ? total - 1 : 0;
    if (voltar) return atual === 0 ? total - 1 : atual - 1;
    return atual === total - 1 ? 0 : atual + 1;
  }

  function pararRolagem(janela) {
    const l = janela ? janela.ES_LENIS : null;
    if (l && typeof l.stop === 'function') {
      l.stop();
      return true;
    }
    return false;
  }

  function voltarRolagem(janela) {
    const l = janela ? janela.ES_LENIS : null;
    if (l && typeof l.start === 'function') {
      l.start();
      return true;
    }
    return false;
  }

  function atualizarGatilhos(janela) {
    const s = janela ? janela.ScrollTrigger : null;
    if (s && typeof s.refresh === 'function') {
      s.refresh();
      return true;
    }
    return false;
  }

  function prefereMenosMovimento(janela) {
    try {
      return Boolean(janela && typeof janela.matchMedia === 'function' && janela.matchMedia('(prefers-reduced-motion: reduce)').matches);
    } catch (_erro) {
      return false;
    }
  }

  /** Com movimento reduzido, o modal fecha na hora; senão, espera a transição (com limite). */
  function planoDaTransicao(reduzido) {
    return reduzido ? { esperar: false, limiteMs: 0 } : { esperar: true, limiteMs: 400 };
  }

  /** O estado da entrada que o modal põe no histórico ao abrir (a URL não muda): a marca do módulo e o id do modelo. */
  function estadoDoHistorico(id) {
    return { es: 'catalogo', modelo: id };
  }

  /**
   * O history da janela, com pushState e back, quando a janela também ouve eventos (a popstate); senão, null,
   * e o modal funciona sem histórico, como sempre.
   */
  function historicoDaJanela(janela) {
    try {
      if (!janela || typeof janela.addEventListener !== 'function') return null;
      const h = janela.history;
      return h && typeof h.pushState === 'function' && typeof h.back === 'function' ? h : null;
    } catch (_erro) {
      return null;
    }
  }

  // ------------------------------------------------------------ fiação no navegador

  const todos = (raizDom, seletor) => Array.prototype.slice.call(raizDom.querySelectorAll(seletor));

  /** Na página e à vista: conectado, com focus() e sem ancestral (nem ele) [hidden]. */
  function visivelNaPagina(el) {
    return Boolean(el) && typeof el.focus === 'function' && el.isConnected !== false && !(typeof el.closest === 'function' && el.closest('[hidden]'));
  }

  /**
   * Para onde o foco vai ao fechar o modal: o botão que abriu; se ele está escondido (o filtro
   * escondeu o card dele) ou fora da página, o filtro marcado, que foi o que o escondeu; senão,
   * outro botão do filtro ou o primeiro "Ver detalhes" à vista. Nunca um elemento escondido,
   * onde o foco se perderia.
   */
  function destinoDoFoco(doc, origem) {
    if (visivelNaPagina(origem)) return origem;
    const candidatos = todos(doc, '[data-es-filtro-tipo][aria-pressed="true"]').concat(todos(doc, '[data-es-filtro-tipo]'), todos(doc, '[data-es-abrir]'));
    return candidatos.find(visivelNaPagina) || null;
  }

  function linksDoNavegador(janela) {
    return (pedido) => {
      const w = janela.ES_LEAD_WHATSAPP;
      return w && typeof w.linkDoPedido === 'function' ? w.linkDoPedido(pedido) : null;
    };
  }

  function ligarFiltro(janela, vitrine) {
    const filtro = vitrine.querySelector('[data-es-filtro]');
    if (!filtro) return;
    const cards = todos(vitrine, '[data-es-modelo]');
    const itens = cards.map((c) => ({ id: c.getAttribute('data-es-modelo'), tipo: c.getAttribute('data-tipo') }));
    const botoes = todos(filtro, '[data-es-filtro-tipo]');
    const status = vitrine.querySelector('[data-es-status]');
    filtro.hidden = false;
    for (const botao of botoes) {
      botao.addEventListener('click', () => {
        const r = filtrar(itens, botao.getAttribute('data-es-filtro-tipo'));
        cards.forEach((c, i) => {
          c.hidden = !r.visiveis.includes(itens[i].id);
        });
        for (const b of botoes) b.setAttribute('aria-pressed', b.getAttribute('data-es-filtro-tipo') === r.tipo ? 'true' : 'false');
        if (status) {
          status.textContent = textoDoResultado(r.visiveis.length, {
            um: status.getAttribute('data-es-rotulo-um') || ROTULOS_PADRAO.resultado_um,
            varios: status.getAttribute('data-es-rotulo-varios') || ROTULOS_PADRAO.resultado_varios,
          });
        }
        atualizarGatilhos(janela);
        const ev = eventoDoFiltro(r);
        if (typeof janela.CustomEvent === 'function') vitrine.dispatchEvent(new janela.CustomEvent(ev.nome, { bubbles: true, detail: ev.detalhe }));
      });
    }
  }

  function ligarModal(janela, doc, modal, links) {
    const caixa = modal.querySelector('[role="dialog"]');
    const conteudo = modal.querySelector('[data-es-catalogo-conteudo]');
    if (!caixa || !conteudo) return;
    const detalhes = todos(modal, 'template[data-es-modelo-detalhe]');
    const reduzido = prefereMenosMovimento(janela);
    const historico = historicoDaJanela(janela);
    let estado = estadoInicialDoModal();
    let origem = null;
    let concluirFechamento = null;
    // O "voltar" do aparelho fecha o modal: abrir põe UMA entrada no histórico (a URL não muda), e a popstate
    // fecha pelo fechar() de sempre. Fechar pelo ×, pelo fundo ou pelo Esc consome a entrada com um back()
    // silencioso, para o histórico ficar como antes de abrir.
    let naEntrada = false; // a entrada que esta abertura pôs é a atual
    let voltaPendente = false; // o back() silencioso ainda não chegou na popstate
    let empurrarNaVolta = false; // abriu de novo antes dessa popstate: a entrada nova entra quando ela chegar

    const esvaziar = () => {
      while (conteudo.firstChild) conteudo.removeChild(conteudo.firstChild);
    };
    const focaveis = () => todos(caixa, FOCAVEIS).filter((el) => !el.closest('[hidden]'));

    function aplicarCor() {
      const galerias = todos(conteudo, '[data-es-galeria]');
      const visivel = galeriaDaCor(galerias.map((g) => g.getAttribute('data-es-galeria')), estado.cor);
      for (const g of galerias) g.hidden = g.getAttribute('data-es-galeria') !== visivel;
      for (const b of todos(conteudo, '[data-es-cor]')) b.setAttribute('aria-pressed', b.getAttribute('data-es-cor') === estado.cor ? 'true' : 'false');
      const botao = conteudo.querySelector('a[data-es-link][data-modelo]');
      if (!botao || botao.getAttribute('data-cor') === estado.cor) return;
      const pedido = pedidoDoBotao({
        contexto: botao.getAttribute('data-wa-contexto'),
        origem: botao.getAttribute('data-origem'),
        modelo: botao.getAttribute('data-modelo'),
        cor: estado.cor,
      });
      // data-cor e href mudam juntos: sem um href novo, o botão fica coerente com a mensagem que ele abre.
      const href = hrefDoPedido(pedido, links);
      if (!href) return;
      botao.setAttribute('data-cor', estado.cor);
      botao.setAttribute('href', href);
    }

    /** Põe a entrada do modal aberto no histórico; sem history, ou se ele lança, o modal segue sem ela. */
    function empurrarEntrada() {
      if (!historico) return;
      if (voltaPendente) {
        empurrarNaVolta = true;
        return;
      }
      try {
        historico.pushState(estadoDoHistorico(estado.modelo), '');
        naEntrada = true;
      } catch (_erro) {
        naEntrada = false;
      }
    }

    /** Tira a entrada do modal com um back() silencioso (a popstate dele não fecha nada). */
    function consumirEntrada() {
      if (!naEntrada) return;
      naEntrada = false;
      voltaPendente = true;
      try {
        historico.back();
      } catch (_erro) {
        voltaPendente = false;
      }
    }

    function abrir(id, gatilho) {
      const t = detalhes.find((x) => x.getAttribute('data-es-modelo-detalhe') === id);
      if (!t || !t.content) return;
      const jaAberto = estado.aberto;
      if (concluirFechamento) concluirFechamento();
      esvaziar();
      conteudo.appendChild(t.content.cloneNode(true));
      for (const a of todos(conteudo, '[data-es-amostra]')) {
        const cor = a.getAttribute('data-es-amostra');
        if (HEX.test(cor)) a.style.backgroundColor = cor;
      }
      estado = abrirModal(estado, { modelo: id, cores: todos(conteudo, '[data-es-cor]').map((b) => b.getAttribute('data-es-cor')) });
      aplicarCor();
      origem = gatilho || null;
      modal.hidden = false;
      // A folha abre no topo a cada abertura: o navegador guarda a rolagem de um elemento escondido, e o modelo
      // seguinte abriria rolado, sem o título. Depois de mostrar (escondida, a atribuição pode não pegar) e antes do foco.
      caixa.scrollTop = 0;
      doc.documentElement.classList.add(CLASSE_PAGINA_COM_MODAL);
      pararRolagem(janela);
      const marcar = () => modal.classList.add(CLASSE_MODAL_ABERTO);
      if (reduzido || typeof janela.requestAnimationFrame !== 'function') marcar();
      else janela.requestAnimationFrame(marcar);
      caixa.focus();
      if (!jaAberto) empurrarEntrada();
    }

    function fechar() {
      if (!estado.aberto) return;
      estado = fecharModal(estado);
      modal.classList.remove(CLASSE_MODAL_ABERTO);
      let feito = false;
      const concluir = (ev) => {
        if (feito || (ev && ev.target && ev.target !== modal)) return;
        feito = true;
        concluirFechamento = null;
        modal.removeEventListener('transitionend', concluir);
        modal.hidden = true;
        esvaziar();
      };
      const plano = planoDaTransicao(reduzido);
      if (plano.esperar && typeof janela.setTimeout === 'function') {
        concluirFechamento = () => concluir();
        modal.addEventListener('transitionend', concluir);
        janela.setTimeout(() => concluir(), plano.limiteMs);
      } else {
        concluir();
      }
      doc.documentElement.classList.remove(CLASSE_PAGINA_COM_MODAL);
      voltarRolagem(janela);
      const destino = destinoDoFoco(doc, origem);
      if (destino) destino.focus();
      origem = null;
    }

    /** Fechar pelo ×, pelo fundo ou pelo Esc: o fechamento de sempre, e a entrada do histórico consumida. */
    function fecharPeloModal() {
      if (!estado.aberto) return;
      fechar();
      consumirEntrada();
    }

    /**
     * A popstate: a do back() silencioso só é consumida (e põe a entrada de uma reabertura que esperava por
     * ela); com o modal aberto, qualquer outra fecha o modal (o "voltar"); com ele fechado, nada (o "avançar"
     * para uma entrada antiga do modal, ou a página recarregada sobre ela, não reabre nada).
     */
    function aoVoltar() {
      if (voltaPendente) {
        voltaPendente = false;
        // A reabertura que esperava só conta se o modal ainda está aberto (abrir e fechar antes da popstate não deixa entrada).
        const reabriu = empurrarNaVolta && estado.aberto;
        empurrarNaVolta = false;
        if (reabriu) empurrarEntrada();
        return;
      }
      if (!estado.aberto) return;
      // A entrada atual já não é a do modal. Defensivo: um back() dado de outra entrada sairia da página.
      naEntrada = false;
      fechar();
    }

    // Só aparece o "Ver detalhes" cujo modelo tem detalhe neste modal: nenhum botão que não abre nada.
    for (const b of todos(doc, '[data-es-abrir]')) {
      const id = b.getAttribute('data-es-abrir');
      if (!detalhes.some((t) => t.getAttribute('data-es-modelo-detalhe') === id)) continue;
      b.hidden = false;
      b.addEventListener('click', () => abrir(id, b));
    }
    modal.addEventListener('click', (ev) => {
      const alvo = ev.target;
      if (!alvo || typeof alvo.closest !== 'function') return;
      if (alvo.closest('[data-es-fechar]')) {
        fecharPeloModal();
        return;
      }
      const cor = alvo.closest('[data-es-cor]');
      if (cor) {
        estado = trocarCor(estado, cor.getAttribute('data-es-cor'));
        aplicarCor();
      }
    });
    doc.addEventListener('keydown', (ev) => {
      if (!estado.aberto) return;
      const a = acaoDaTecla(ev.key, ev.shiftKey);
      if (a.acao === 'fechar') {
        ev.preventDefault();
        fecharPeloModal();
      } else if (a.acao === 'foco') {
        ev.preventDefault();
        const alvos = focaveis();
        if (!alvos.length) {
          caixa.focus();
          return;
        }
        alvos[proximoFoco(alvos.indexOf(doc.activeElement), alvos.length, a.voltar)].focus();
      }
    });
    if (historico) janela.addEventListener('popstate', aoVoltar);
  }

  /**
   * Liga filtro e modal na página. `opcoes.links(pedido)` devolve o href do botão Comprar
   * quando a cor muda; sem ela, usa ES_LEAD_WHATSAPP.linkDoPedido, se existir.
   */
  function ligar(janela, opcoes) {
    const doc = janela ? janela.document : null;
    if (!doc || typeof doc.querySelectorAll !== 'function') return false;
    const links = eObjeto(opcoes) && typeof opcoes.links === 'function' ? opcoes.links : linksDoNavegador(janela);
    for (const vitrine of todos(doc, '[data-es-catalogo]')) ligarFiltro(janela, vitrine);
    const modal = doc.querySelector('[data-es-catalogo-modal]');
    if (modal) ligarModal(janela, doc, modal, links);
    return true;
  }

  const api = {
    marcadores: MARCADORES.slice(),
    TIPOS, CLASSES, MARCADORES, ARQUIVO_DADOS, DONO_DOS_LINKS, EVENTO_FILTRO, REF_PRECO, ROTULOS_PADRAO, ORIGENS_PADRAO,
    ESPECIFICACOES, CAMPOS_DO_PRECO, ROTULOS_PROIBIDOS,
    MAX_CENTAVOS, MAX_MEDIDA, MAX_PARCELAS,
    regras, render, dadosPublicos, jsonld, rotuloProibido, documentoValido,
    esc, formatarCentavos, formatarNumero, precoDecimal, dataValida,
    campoPublicado, precoDoModelo, precoPublicado, faltaNoPreco, contextoDoBotao, tipoPublicado, seloDoModelo,
    fotosPublicas, coresPublicas, especificacoesPublicas, modelosDaVitrine, mesclarRotulos,
    pedidoDoBotao, hrefDoPedido, htmlCard, htmlDetalhe, htmlVitrine, htmlModal,
    itensDoFiltro, opcoesDeFiltro, filtrar, textoDoResultado, eventoDoFiltro, galeriaDaCor,
    dadosPublicosDoCatalogo, jsonLdProduto,
    estadoInicialDoModal, abrirModal, trocarCor, fecharModal, acaoDaTecla, proximoFoco,
    pararRolagem, voltarRolagem, atualizarGatilhos, prefereMenosMovimento, planoDaTransicao, destinoDoFoco,
    estadoDoHistorico, historicoDaJanela, ligar,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    raiz.ES_CATALOGO = api;
    const doc = raiz.document;
    if (doc && typeof doc.addEventListener === 'function') {
      if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => ligar(raiz));
      else ligar(raiz);
    }
  }
  // eslint-disable-next-line no-undef
})(typeof window !== 'undefined' ? window : globalThis);
