/*
 * WhatsApp por contexto: links https://wa.me/<número>?text=<mensagem>, montados do bloco
 * `whatsapp` do project.config.json e do contexto do botão (data-wa-contexto).
 *
 * O mesmo arquivo roda no build e no navegador. No build, num contexto vazio (sem DOM, sem
 * rede, sem módulos do Node), os ganchos regras, render, dados-publicos e links usam as
 * funções puras daqui. No navegador, linkDoPedido usa as MESMAS funções sobre os dados
 * públicos do es-dados.js (window.ES_DADOS), lidos na hora da chamada. O arquivo não mexe
 * no DOM: roda em qualquer página e em qualquer ordem de scripts, e o href do build continua
 * valendo sem JS.
 *
 * Mensagem: texto com os marcadores {modelo}, {cor} e {loja}, e trechos [ … ] que somem
 * quando um marcador dentro deles fica sem valor. Não existe outro marcador. O valor entra
 * depois da leitura da mensagem, então um valor com "{cor}" ou "]" fica como texto. O link
 * leva a mensagem por encodeURIComponent e o número só com dígitos.
 */
(function (raiz) {
  'use strict';

  const MODULO = 'lead-whatsapp';
  const ARQUIVO_CATALOGO = 'catalogo/modelos.json';
  const MARCADORES = Object.freeze(['lead-whatsapp-formulario', 'lead-whatsapp-privacidade']);
  const MARCADORES_DA_MENSAGEM = Object.freeze(['modelo', 'cor', 'loja']);
  const NUMERO = /^55\d{10,11}$/;
  const ORIGEM = /^[a-z0-9_]{1,40}$/;
  const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  // O que o link pode ser: o esquema e o host fixos, o número só com dígitos e o texto como
  // o encodeURIComponent o deixa (letras, dígitos, - _ . ! ~ * ' ( ) e %XX).
  const LINK = /^https:\/\/wa\.me\/55\d{10,11}\?text=[A-Za-z0-9_.!~*'()%-]+$/;
  const PREFIXO = 'https://wa.me/';
  const PUBLICAVEL = Object.freeze(['confirmado', 'duvida']);
  // O WhatsApp não documenta limite para o text. Nada é cortado; acima disto o regras alerta.
  const TAMANHO_PARA_ALERTA = 2000;

  /** conversao: conta como conversão com o form desligado; numero: qual número do config. */
  const CONTEXTOS = mapaFixo({
    modelo: { conversao: true, numero: 'vendas' },
    preco: { conversao: true, numero: 'vendas' },
    testride: { conversao: true, numero: 'vendas' },
    geral: { conversao: true, numero: 'vendas' },
    assistencia: { conversao: false, numero: 'assistencia' },
  });

  // Textos neutros, para nenhum link nascer quebrado. O texto final é da copy do projeto.
  const MENSAGENS_PADRAO = Object.freeze({
    modelo: 'Olá! Tenho interesse no {modelo}[ na cor {cor}]. Pode me passar mais informações?',
    preco: 'Olá! Quero comprar o {modelo}[ na cor {cor}]. Pode me passar o preço e as condições de pagamento?',
    testride: 'Olá! Quero agendar um test ride[ do {modelo}].',
    geral: 'Olá! Vim pelo site[ da {loja}] e quero mais informações.',
    assistencia: 'Olá! Vim pelo site[ da {loja}] e preciso de assistência técnica.',
  });

  // Rótulo padrão dos botões de venda com modelo (contextos modelo e preco).
  const ROTULOS_PADRAO = Object.freeze({ comprar: 'Comprar' });

  // ------------------------------------------------------------ utilidades

  const eObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const lista = (v) => (Array.isArray(v) ? v : []);
  const textoValido = (v) => typeof v === 'string' && v.trim() !== '';

  /** Valor próprio do objeto (nada do protótipo: "constructor" não é chave). */
  function proprio(obj, chave) {
    return eObjeto(obj) && Object.prototype.hasOwnProperty.call(obj, chave) ? obj[chave] : undefined;
  }

  /** Mapa congelado sem protótipo: só as chaves declaradas existem nele. */
  function mapaFixo(entradas) {
    const saida = Object.create(null);
    for (const chave of Object.keys(entradas)) saida[chave] = Object.freeze(Object.assign({}, entradas[chave]));
    return Object.freeze(saida);
  }

  /** Um valor curto para mensagem de erro. */
  function citar(v) {
    const t = typeof v === 'string' ? v : String(v);
    return JSON.stringify(t.length > 60 ? `${t.slice(0, 60)}…` : t);
  }

  function contextoValido(contexto) {
    return typeof contexto === 'string' && Object.prototype.hasOwnProperty.call(CONTEXTOS, contexto);
  }

  function blocoWhatsapp(config) {
    const w = proprio(config, 'whatsapp');
    return eObjeto(w) ? w : {};
  }

  // ------------------------------------------------------------ mensagem

  /**
   * Lê a mensagem em pedaços: {texto}, {marcador} e {trecho: [pedaços]}. Lança erro com
   * marcador desconhecido, chave ou colchete solto e trecho dentro de trecho.
   */
  function lerMensagem(texto) {
    if (!textoValido(texto)) throw new Error('mensagem vazia');
    const pedacos = [];
    let atual = pedacos;
    let dentro = false;
    let i = 0;
    while (i < texto.length) {
      const c = texto[i];
      if (c === '{') {
        const fim = texto.indexOf('}', i);
        const nome = fim === -1 ? null : texto.slice(i + 1, fim);
        if (nome === null || !MARCADORES_DA_MENSAGEM.includes(nome)) {
          throw new Error(`marcador desconhecido ${citar(texto.slice(i, fim === -1 ? i + 20 : fim + 1))}: a mensagem só aceita {modelo}, {cor} e {loja}`);
        }
        atual.push({ marcador: nome });
        i = fim + 1;
      } else if (c === '}') {
        throw new Error('"}" sem o "{" de um marcador');
      } else if (c === '[') {
        if (dentro) throw new Error('trecho [ ] dentro de outro trecho');
        const trecho = [];
        pedacos.push({ trecho });
        atual = trecho;
        dentro = true;
        i += 1;
      } else if (c === ']') {
        if (!dentro) throw new Error('"]" sem o "[" que abre o trecho');
        atual = pedacos;
        dentro = false;
        i += 1;
      } else {
        let fim = i;
        while (fim < texto.length && !'{}[]'.includes(texto[fim])) fim += 1;
        atual.push({ texto: texto.slice(i, fim) });
        i = fim;
      }
    }
    if (dentro) throw new Error('trecho "[" sem o "]" que fecha');
    return pedacos;
  }

  function valorDoMarcador(valores, nome) {
    const v = proprio(valores, nome);
    return textoValido(v) ? v.trim() : null;
  }

  /**
   * Troca os marcadores pelos valores. Um trecho [ ] some inteiro quando um marcador dele fica
   * sem valor; um marcador fora de trecho sem valor é erro (a mensagem sairia pela metade).
   */
  function preencherMensagem(texto, valores, contexto) {
    let saida = '';
    for (const p of lerMensagem(texto)) {
      if (p.texto !== undefined) {
        saida += p.texto;
      } else if (p.marcador !== undefined) {
        const v = valorDoMarcador(valores, p.marcador);
        if (v === null) throw new Error(`a mensagem do contexto ${contexto} usa {${p.marcador}} fora de um trecho [ ], e ele ficou sem valor`);
        saida += v;
      } else {
        let parte = '';
        let completo = true;
        for (const q of p.trecho) {
          if (q.texto !== undefined) {
            parte += q.texto;
            continue;
          }
          const v = valorDoMarcador(valores, q.marcador);
          if (v === null) {
            completo = false;
            break;
          }
          parte += v;
        }
        if (completo) saida += parte;
      }
    }
    if (saida.trim() === '') throw new Error(`a mensagem do contexto ${contexto} ficou vazia`);
    return saida;
  }

  /** A mensagem do config para o contexto; sem ela (ausente, null ou vazia), a padrão do módulo. */
  function mensagemDoContexto(config, contexto) {
    if (!contextoValido(contexto)) throw new Error(`contexto desconhecido ${citar(contexto)}`);
    const v = proprio(proprio(blocoWhatsapp(config), 'mensagens'), contexto);
    return textoValido(v) ? v : MENSAGENS_PADRAO[contexto];
  }

  /** O número do contexto: vendas para venda, assistência só para a assistência. */
  function numeroDoContexto(config, contexto) {
    const qual = CONTEXTOS[contexto].numero;
    const v = proprio(proprio(blocoWhatsapp(config), 'numeros'), qual);
    if (v === undefined || v === null || v === '') {
      throw new Error(qual === 'vendas'
        ? 'sem o número de vendas (whatsapp.numeros.vendas): nenhum link de venda sai sem ele'
        : 'sem o número de assistência (whatsapp.numeros.assistencia): o link de assistência não existe sem ele, e o de vendas não o substitui');
    }
    if (typeof v !== 'string' || !NUMERO.test(v)) throw new Error(`whatsapp.numeros.${qual} inválido ${citar(v)}: só dígitos, com o 55 e o DDD (^55\\d{10,11}$)`);
    return v;
  }

  /**
   * O link do contexto. `dados` = {modelo, cor} já como texto (o nome do modelo e o da cor);
   * `config` = o project.config.json ou os dados públicos deste módulo (a mesma forma: loja e
   * whatsapp). Lança erro com contexto desconhecido, número ausente ou inválido e mensagem que
   * não pode ser montada: nenhum link quebrado.
   */
  function montarLink(contexto, dados, config) {
    if (!contextoValido(contexto)) throw new Error(`contexto desconhecido ${citar(contexto)} (${Object.keys(CONTEXTOS).join(', ')})`);
    const numero = numeroDoContexto(config, contexto);
    const valores = { modelo: proprio(dados, 'modelo'), cor: proprio(dados, 'cor'), loja: proprio(config, 'loja') };
    const texto = preencherMensagem(mensagemDoContexto(config, contexto), valores, contexto);
    let codificado;
    try {
      codificado = encodeURIComponent(texto);
    } catch (_erro) {
      throw new Error(`a mensagem do contexto ${contexto} tem um caractere que não vai num link (metade de um par UTF-16)`);
    }
    const href = `${PREFIXO}${numero}?text=${codificado}`;
    if (!LINK.test(href)) throw new Error('o link saiu fora do formato https://wa.me/<número>?text=<mensagem>');
    return href;
  }

  // ------------------------------------------------------------ dados públicos e pedidos

  /** Campo {valor, fonte, status} que vai ao ar: confirmado ou dúvida, com texto e fonte. */
  function textoPublicado(campo) {
    if (!eObjeto(campo) || !PUBLICAVEL.includes(campo.status) || !textoValido(campo.fonte)) return null;
    return textoValido(campo.valor) ? campo.valor : null;
  }

  /** {id, nome} dos modelos que vão à vitrine (visíveis, id válido, nome publicado), sem id repetido. */
  function modelosPublicados(catalogo) {
    const vistos = new Set();
    const saida = [];
    for (const m of lista(proprio(catalogo, 'modelos'))) {
      if (!eObjeto(m) || typeof m.id !== 'string' || !ID.test(m.id) || m.visivel === false || vistos.has(m.id)) continue;
      const nome = textoPublicado(m.nome);
      if (nome === null) continue;
      vistos.add(m.id);
      saida.push({ id: m.id, nome });
    }
    return saida;
  }

  function numeroPublico(v) {
    return typeof v === 'string' && v !== '' ? v : null;
  }

  /**
   * O que vai para ES_DADOS["lead-whatsapp"]: a loja, os números e as mensagens já resolvidas
   * (a do config ou a padrão), na forma do config, e os nomes dos modelos publicados.
   */
  function dadosPublicosDoConfig(config, catalogo) {
    const numeros = proprio(blocoWhatsapp(config), 'numeros');
    const mensagens = {};
    for (const c of Object.keys(CONTEXTOS)) mensagens[c] = mensagemDoContexto(config, c);
    const loja = proprio(config, 'loja');
    return {
      loja: textoValido(loja) ? loja : null,
      whatsapp: {
        numeros: { vendas: numeroPublico(proprio(numeros, 'vendas')), assistencia: numeroPublico(proprio(numeros, 'assistencia')) },
        mensagens,
      },
      modelos: modelosPublicados(catalogo),
    };
  }

  function nomeDoModelo(publico, id) {
    const m = lista(proprio(publico, 'modelos')).find((x) => eObjeto(x) && x.id === id);
    return m && textoValido(m.nome) ? m.nome : null;
  }

  /**
   * O link de um botão a partir dos data-* dele (`pedido.atributos`), sobre os dados públicos:
   * data-wa-contexto obrigatório; data-origem no formato quando existe; data-modelo (id) vira
   * o nome publicado; data-cor "" = sem cor. Usada pelo gancho links e pelo navegador.
   */
  function montarLinkDoPedido(publico, pedido) {
    const at = proprio(pedido, 'atributos');
    const contexto = proprio(at, 'data-wa-contexto');
    if (!contextoValido(contexto)) {
      throw new Error(`data-wa-contexto ${contexto === undefined || contexto === null ? 'ausente' : citar(contexto)}: use ${Object.keys(CONTEXTOS).join(', ')}`);
    }
    const origem = proprio(at, 'data-origem');
    if (origem !== undefined && origem !== null && !(typeof origem === 'string' && ORIGEM.test(origem))) {
      throw new Error(`data-origem ${citar(origem)} fora do formato ^[a-z0-9_]{1,40}$`);
    }
    const id = proprio(at, 'data-modelo');
    let modelo = null;
    if (typeof id === 'string' && id !== '') {
      modelo = nomeDoModelo(publico, id);
      if (modelo === null) throw new Error(`data-modelo ${citar(id)} não é um modelo publicado no catálogo`);
    }
    const cor = proprio(at, 'data-cor');
    return montarLink(contexto, { modelo, cor: typeof cor === 'string' ? cor : null }, publico);
  }

  /** Os contextos (todos, ou os da lista) cuja mensagem é a padrão do módulo: ausente, vazia ou igual a ela. */
  function contextosComTextoPadrao(config, contextos) {
    const alvo = contextos === undefined ? Object.keys(CONTEXTOS) : lista(contextos).filter(contextoValido);
    const mensagens = proprio(blocoWhatsapp(config), 'mensagens');
    return alvo.filter((c, i) => alvo.indexOf(c) === i).filter((c) => {
      const v = proprio(mensagens, c);
      return !textoValido(v) || v.trim() === MENSAGENS_PADRAO[c];
    });
  }

  /** Algum texto padrão do módulo em uso? (o verificador alerta na prévia e trava na produção) */
  function usaTextoPadrao(config, contextos) {
    return contextosComTextoPadrao(config, contextos).length > 0;
  }

  // ------------------------------------------------------------ ganchos do build

  function configDaEntrada(entrada) {
    const c = proprio(entrada, 'config');
    return eObjeto(c) ? c : {};
  }

  function catalogoDaEntrada(entrada) {
    const d = proprio(proprio(entrada, 'dados'), ARQUIVO_CATALOGO);
    return eObjeto(d) ? d : null;
  }

  function formDaEntrada(entrada) {
    return proprio(proprio(entrada, 'modos'), 'form');
  }

  const FORM_LIGADO = 'form ligado (modos.form diferente de "desligado"): esta versão do lead-whatsapp só tem os links por contexto, e os marcadores do form não recebem nada; o form chega numa versão nova do módulo, junto do lead-api. Volte lead.form.ativo para false';

  /**
   * Regras do build. Trava: sem o número de vendas; form ligado. Alerta: link de um contexto
   * acima de TAMANHO_PARA_ALERTA caracteres (nada é cortado).
   */
  function regras(entrada) {
    const travas = [];
    const alertas = [];
    const config = configDaEntrada(entrada);
    const vendas = proprio(proprio(blocoWhatsapp(config), 'numeros'), 'vendas');
    if (!textoValido(vendas)) {
      travas.push('whatsapp.numeros.vendas vazio: sem o número de vendas, nenhum botão de venda (modelo, preco, testride, geral) tem link. O número vem do briefing (es intake promover) e a pendência vai para o CLIENTE_VALIDAR.md. O número de assistência nunca é usado no lugar sem a loja confirmar');
    }
    if (formDaEntrada(entrada) !== 'desligado') travas.push(FORM_LIGADO);
    for (const c of Object.keys(CONTEXTOS)) {
      let tamanho;
      try {
        tamanho = PREFIXO.length + 13 + '?text='.length + encodeURIComponent(mensagemDoContexto(config, c)).length;
      } catch (_erro) {
        travas.push(`whatsapp.mensagens.${c} tem um caractere que não vai num link (metade de um par UTF-16)`);
        continue;
      }
      if (tamanho > TAMANHO_PARA_ALERTA) {
        alertas.push(`whatsapp.mensagens.${c}: o link passa de ${TAMANHO_PARA_ALERTA} caracteres (cerca de ${tamanho}); o WhatsApp não documenta limite, mas link longo pode ser cortado por algum navegador ou app. Encurte a mensagem`);
      }
    }
    return { travas, alertas };
  }

  /** Os marcadores do form: vazios com o form desligado. Com o form ligado, erro (esta versão não tem o form). */
  function render(entrada) {
    if (formDaEntrada(entrada) !== 'desligado') throw new Error(FORM_LIGADO);
    const pedidos = Array.isArray(proprio(entrada, 'marcadores')) ? entrada.marcadores : MARCADORES;
    const saida = {};
    for (const nome of pedidos) if (MARCADORES.includes(nome)) saida[nome] = '';
    return saida;
  }

  function dadosPublicos(entrada) {
    return dadosPublicosDoConfig(configDaEntrada(entrada), catalogoDaEntrada(entrada));
  }

  function resumoDoPedido(pedido) {
    const at = proprio(pedido, 'atributos');
    return ['data-wa-contexto', 'data-origem', 'data-modelo', 'data-cor']
      .filter((n) => proprio(at, n) !== undefined)
      .map((n) => `${n}=${citar(proprio(at, n))}`)
      .join(' ');
  }

  /** Um href por pedido (cada <a data-es-link="lead-whatsapp"> da página), pela mesma função do navegador. */
  function links(entrada) {
    const publico = dadosPublicos(entrada);
    const pagina = typeof proprio(entrada, 'pagina') === 'string' ? entrada.pagina : 'página';
    return lista(proprio(entrada, 'pedidos')).map((pedido, i) => {
      try {
        return montarLinkDoPedido(publico, pedido);
      } catch (erro) {
        throw new Error(`${pagina}: link ${i + 1} (${resumoDoPedido(pedido) || 'sem data-*'}): ${erro && erro.message ? erro.message : 'erro'}`);
      }
    });
  }

  // ------------------------------------------------------------ navegador

  /** ES_DADOS["lead-whatsapp"] da página, lido agora (null se ainda não existe). */
  function dadosDaPagina() {
    let dados;
    try {
      dados = raiz.ES_DADOS;
    } catch (_erro) {
      return null;
    }
    const publico = proprio(dados, MODULO);
    return eObjeto(publico) ? publico : null;
  }

  /**
   * O href de um botão no navegador (o modal do catálogo chama ao trocar a cor), com os dados
   * públicos lidos na hora. Sem ES_DADOS, ou com um pedido que não monta, null: o botão fica
   * com o href do build.
   */
  function linkDoPedido(pedido) {
    const publico = dadosDaPagina();
    if (!publico) return null;
    try {
      return montarLinkDoPedido(publico, pedido);
    } catch (_erro) {
      return null;
    }
  }

  const api = {
    marcadores: MARCADORES.slice(),
    MODULO, MARCADORES, MARCADORES_DA_MENSAGEM, CONTEXTOS, MENSAGENS_PADRAO, ROTULOS_PADRAO, TAMANHO_PARA_ALERTA,
    regras, render, dadosPublicos, links,
    montarLink, montarLinkDoPedido, linkDoPedido, lerMensagem, preencherMensagem, mensagemDoContexto,
    dadosPublicosDoConfig, modelosPublicados, contextoValido, usaTextoPadrao, contextosComTextoPadrao,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.ES_LEAD_WHATSAPP = api;
  // eslint-disable-next-line no-undef
})(typeof window !== 'undefined' ? window : globalThis);
