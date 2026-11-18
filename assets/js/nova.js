(function (janela) {
  'use strict';

  const doc = janela.document;
  if (!doc) return;

  const FOCAVEIS = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function todos(raiz, seletor) {
    return Array.prototype.slice.call(raiz.querySelectorAll(seletor));
  }

  function elemento(tag, classe, texto) {
    const el = doc.createElement(tag);
    if (classe) el.className = classe;
    if (texto) el.textContent = texto;
    return el;
  }

  function movimentoReduzido() {
    try {
      return janela.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (_erro) {
      return true;
    }
  }

  function telaGrande() {
    try {
      return janela.matchMedia('(min-width: 64em)').matches;
    } catch (_erro) {
      return false;
    }
  }

  function rolagem() {
    const l = janela.ES_LENIS;
    return l && typeof l.stop === 'function' && typeof l.start === 'function' ? l : null;
  }

  function ligarTopo() {
    const topo = doc.querySelector('[data-nv-topo]');
    if (!topo) return;
    let quadro = 0;
    const medir = () => {
      quadro = 0;
      topo.classList.toggle('topo--rolado', janela.scrollY > 24);
    };
    janela.addEventListener('scroll', () => {
      if (!quadro) quadro = janela.requestAnimationFrame(medir);
    }, { passive: true });
    medir();

    const links = todos(topo, '.topo__link');
    if (!links.length || typeof janela.IntersectionObserver !== 'function') return;
    const pares = links.map((link) => {
      const url = new URL(link.href, janela.location.href);
      const secao = url.pathname === janela.location.pathname && url.hash ? doc.getElementById(decodeURIComponent(url.hash.slice(1))) : null;
      return { link, secao };
    }).filter((p) => p.secao);
    const observador = new janela.IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        pares.forEach((p) => {
          if (p.secao === entrada.target) p.link.setAttribute('aria-current', 'true');
          else p.link.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    pares.forEach((p) => observador.observe(p.secao));
    todos(doc, 'main > section').filter((s) => !pares.some((p) => p.secao === s)).forEach((s) => observador.observe(s));
  }

  function ligarMenu() {
    const topo = doc.querySelector('[data-nv-topo]');
    const botao = topo ? topo.querySelector('.topo__menu') : null;
    const menu = doc.querySelector('[data-nv-menu]');
    if (!botao || !menu) return;
    const rotulo = botao.querySelector('[data-nv-menu-rotulo]');
    menu.hidden = false;
    botao.hidden = false;
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-modal', 'true');
    menu.setAttribute('aria-label', 'Menu');
    let aberto = false;

    const definir = (abrir, devolverFoco) => {
      if (abrir === aberto) return;
      aberto = abrir;
      menu.classList.toggle('is-aberto', abrir);
      botao.setAttribute('aria-expanded', String(abrir));
      if (rotulo) rotulo.textContent = abrir ? 'Fechar' : 'Menu';
      doc.documentElement.classList.toggle('nv-menu-aberto', abrir);
      todos(doc, 'main, footer, .flutuante').forEach((el) => {
        if (abrir) el.setAttribute('inert', '');
        else el.removeAttribute('inert');
      });
      const l = rolagem();
      if (l) {
        if (abrir) l.stop();
        else l.start();
      }
      if (abrir) {
        const primeiro = menu.querySelector('.menu__item');
        if (primeiro) janela.requestAnimationFrame(() => primeiro.focus({ preventScroll: true }));
      } else if (devolverFoco) {
        botao.focus();
      }
    };

    botao.addEventListener('click', () => definir(!aberto, false));
    menu.addEventListener('click', (evento) => {
      const alvo = evento.target;
      if (!alvo || typeof alvo.closest !== 'function') return;
      if (!alvo.closest('.menu__painel')) {
        definir(false, true);
        return;
      }
      if (alvo.closest('a')) definir(false, false);
    });
    doc.addEventListener('keydown', (evento) => {
      if (!aberto) return;
      if (evento.key === 'Escape') {
        evento.preventDefault();
        definir(false, true);
        return;
      }
      if (evento.key !== 'Tab') return;
      const alvos = [botao].concat(todos(menu, FOCAVEIS));
      const i = alvos.indexOf(doc.activeElement);
      if (i === -1) {
        evento.preventDefault();
        alvos[0].focus();
      } else if (evento.shiftKey && i === 0) {
        evento.preventDefault();
        alvos[alvos.length - 1].focus();
      } else if (!evento.shiftKey && i === alvos.length - 1) {
        evento.preventDefault();
        alvos[0].focus();
      }
    });
    try {
      janela.matchMedia('(min-width: 64em)').addEventListener('change', (mudanca) => {
        if (mudanca.matches) definir(false, false);
      });
    } catch (_erro) {
      return;
    }
  }

  function ligarFlutuante() {
    const botao = doc.querySelector('.flutuante');
    const hero = doc.querySelector('.hero');
    if (!botao || !hero || typeof janela.IntersectionObserver !== 'function') return;
    const observador = new janela.IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => botao.classList.toggle('flutuante--recolhido', entrada.isIntersecting));
    }, { rootMargin: '0px 0px -35% 0px' });
    observador.observe(hero);
  }

  function ligarContadores() {
    const alvos = todos(doc, '[data-nv-conta]');
    if (!alvos.length || movimentoReduzido() || typeof janela.IntersectionObserver !== 'function') return;
    const observador = new janela.IntersectionObserver((entradas) => {
      entradas.forEach((entrada) => {
        if (!entrada.isIntersecting) return;
        observador.unobserve(entrada.target);
        const el = entrada.target;
        const total = Number(el.getAttribute('data-nv-conta')) || 0;
        const inicio = janela.performance.now();
        const passo = (agora) => {
          const t = Math.min(1, (agora - inicio) / 1400);
          el.textContent = String(Math.round(total * (1 - Math.pow(1 - t, 3))));
          if (t < 1) janela.requestAnimationFrame(passo);
        };
        el.textContent = '0';
        janela.requestAnimationFrame(passo);
      });
    }, { threshold: 0.6 });
    alvos.forEach((el) => observador.observe(el));
  }

  function ligarFaq() {
    const itens = todos(doc, '.faq__item');
    if (!itens.length) return;
    if (!itens.some((i) => i.open)) itens[0].open = true;
    if (movimentoReduzido()) return;
    itens.forEach((item) => {
      const pergunta = item.querySelector('summary');
      const resposta = item.querySelector('.faq__resposta');
      if (!pergunta || !resposta || typeof resposta.animate !== 'function') return;
      let animacao = null;
      pergunta.addEventListener('click', (evento) => {
        evento.preventDefault();
        if (animacao) animacao.cancel();
        if (!item.open) {
          item.open = true;
          const altura = resposta.scrollHeight;
          animacao = resposta.animate([{ height: '0px', opacity: 0 }, { height: `${altura}px`, opacity: 1 }], { duration: 320, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' });
          animacao.onfinish = () => { animacao = null; };
        } else {
          const altura = resposta.scrollHeight;
          item.classList.add('is-fechando');
          animacao = resposta.animate([{ height: `${altura}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 260, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' });
          animacao.onfinish = () => {
            item.open = false;
            item.classList.remove('is-fechando');
            animacao = null;
          };
          animacao.oncancel = () => item.classList.remove('is-fechando');
        }
      });
    });
  }

  function ligarBrilhoDosCards() {
    let fino = false;
    try {
      fino = janela.matchMedia('(hover: hover) and (pointer: fine)').matches;
    } catch (_erro) {
      fino = false;
    }
    if (!fino || movimentoReduzido()) return;
    todos(doc, '.es-catalogo-card').forEach((card) => {
      let quadro = 0;
      let ultimo = null;
      const escrever = () => {
        quadro = 0;
        if (!ultimo) return;
        card.style.setProperty('--nv-brilho', ultimo.brilho.toFixed(3));
        card.style.setProperty('--nv-angulo', `${ultimo.angulo.toFixed(1)}deg`);
      };
      card.addEventListener('pointermove', (evento) => {
        const r = card.getBoundingClientRect();
        const dx = evento.clientX - (r.left + r.width / 2);
        const dy = evento.clientY - (r.top + r.height / 2);
        const kx = dx === 0 ? Infinity : (r.width / 2) / Math.abs(dx);
        const ky = dy === 0 ? Infinity : (r.height / 2) / Math.abs(dy);
        const proximidade = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
        let angulo = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
        if (angulo < 0) angulo += 360;
        ultimo = { brilho: Math.max(0, (proximidade - 0.35) / 0.65), angulo };
        if (!quadro) quadro = janela.requestAnimationFrame(escrever);
      });
      card.addEventListener('pointerleave', () => {
        ultimo = null;
        card.style.setProperty('--nv-brilho', '0');
      });
    });
  }

  function ligarMapa() {
    const frame = doc.querySelector('[data-nv-mapa]');
    const endereco = doc.querySelector('.rodape__endereco');
    if (!frame || !endereco) return;
    const busca = endereco.textContent.replace(/\s+/g, ' ').trim();
    if (!busca) return;
    const carregar = () => {
      if (frame.getAttribute('src')) return;
      frame.addEventListener('load', () => frame.parentElement.classList.add('is-carregado'), { once: true });
      frame.src = `https://maps.google.com/maps?q=${encodeURIComponent(busca)}&t=m&z=17&output=embed&iwloc=near`;
    };
    if (typeof janela.IntersectionObserver !== 'function') {
      carregar();
      return;
    }
    const observador = new janela.IntersectionObserver((entradas) => {
      if (!entradas[0].isIntersecting) return;
      carregar();
      observador.disconnect();
    }, { rootMargin: '600px' });
    observador.observe(frame);
  }

  function ligarAncoras() {
    doc.addEventListener('click', (evento) => {
      const link = evento.target && evento.target.closest ? evento.target.closest('a[href]') : null;
      if (!link || evento.defaultPrevented || evento.button !== 0 || evento.metaKey || evento.ctrlKey) return;
      const url = new URL(link.href, janela.location.href);
      if (url.pathname !== janela.location.pathname || !url.hash) return;
      const alvo = doc.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!alvo) return;
      const lenis = janela.ES_LENIS;
      if (!lenis || typeof lenis.scrollTo !== 'function') return;
      evento.preventDefault();
      lenis.scrollTo(alvo, { duration: 1.1 });
      if (janela.history && typeof janela.history.replaceState === 'function') janela.history.replaceState(janela.history.state, '', url.hash);
      alvo.setAttribute('tabindex', '-1');
      alvo.focus({ preventScroll: true });
    });
  }

  /** Economia de dados ligada ou rede 2G: o vídeo não carrega sozinho (fica o pôster). */
  function economiaDeDados() {
    try {
      const conexao = janela.navigator && janela.navigator.connection;
      if (!conexao) return false;
      return Boolean(conexao.saveData) || /(^|-)2g$/.test(String(conexao.effectiveType || ''));
    } catch (_erro) {
      return false;
    }
  }

  /**
   * O vídeo da loja na hero. O pôster já está no HTML (é o LCP); o vídeo, com preload="none", só baixa
   * quando este código chama play(), depois do load da página. Com movimento reduzido ou economia de dados,
   * fica parado no pôster e o botão oferece tocar. Pausa fora da tela e com a aba escondida.
   */
  function ligarVideoDoHero() {
    const video = doc.querySelector('[data-nv-video]');
    const hero = video ? video.closest('.hero') : null;
    if (!video || !hero || typeof video.play !== 'function') return;
    const pausa = hero.querySelector('[data-nv-pausa]');
    const rotulo = hero.querySelector('[data-nv-pausa-rotulo]');
    let parado = movimentoReduzido() || economiaDeDados();
    let visivel = true;
    let liberado = false;

    const marcar = () => {
      if (!pausa) return;
      pausa.setAttribute('aria-pressed', String(parado));
      if (rotulo) rotulo.textContent = parado ? 'Tocar o vídeo' : 'Pausar o vídeo';
    };
    const tocar = () => {
      if (!liberado || parado || !visivel || doc.hidden || !video.paused) return;
      const promessa = video.play();
      // Navegador que recusa o autoplay (modo de economia do iPhone): fica o pôster.
      if (promessa && typeof promessa.catch === 'function') promessa.catch(() => {});
    };
    const pausar = () => {
      if (!video.paused) video.pause();
    };

    video.addEventListener('playing', () => hero.classList.add('is-video'), { once: true });
    if (pausa) {
      pausa.hidden = false;
      marcar();
      pausa.addEventListener('click', () => {
        parado = !parado;
        liberado = true;
        marcar();
        if (parado) pausar();
        else tocar();
      });
    }
    doc.addEventListener('visibilitychange', () => {
      if (doc.hidden) pausar();
      else tocar();
    });
    if (typeof janela.IntersectionObserver === 'function') {
      new janela.IntersectionObserver((entradas) => {
        visivel = entradas[0].isIntersecting;
        if (visivel) tocar();
        else pausar();
      }).observe(hero);
    }
    // Girou o aparelho: as fontes do vídeo são por orientação; recarrega na certa e segue de onde estava.
    try {
      janela.matchMedia('(orientation: portrait)').addEventListener('change', () => {
        if (video.networkState === 0) return;
        const tempo = video.currentTime;
        const tocava = !video.paused;
        video.load();
        video.addEventListener('loadedmetadata', () => {
          try {
            video.currentTime = tempo;
          } catch (_erro) {
            return;
          }
        }, { once: true });
        if (tocava) tocar();
      });
    } catch (_erro) {
      // Sem matchMedia com eventos: fica a fonte da orientação inicial.
    }
    const liberar = () => {
      liberado = true;
      tocar();
    };
    if (doc.readyState === 'complete') liberar();
    else janela.addEventListener('load', liberar, { once: true });
  }

  function ligarFiltro() {
    const vitrine = doc.querySelector('[data-es-catalogo]');
    const filtro = vitrine ? vitrine.querySelector('[data-es-filtro]') : null;
    if (!filtro) return;
    const cards = todos(vitrine, '[data-es-modelo]');
    todos(filtro, '[data-es-filtro-tipo]').forEach((botao) => {
      if (botao.querySelector('.nv-contagem')) return;
      const tipo = botao.getAttribute('data-es-filtro-tipo');
      const total = tipo === 'todos' ? cards.length : cards.filter((c) => c.getAttribute('data-tipo') === tipo).length;
      const contagem = elemento('span', 'nv-contagem', String(total));
      contagem.setAttribute('aria-hidden', 'true');
      botao.insertBefore(contagem, botao.firstChild);
    });
    if (typeof janela.IntersectionObserver !== 'function') return;
    const sentinela = elemento('div', 'nv-sentinela');
    sentinela.setAttribute('aria-hidden', 'true');
    filtro.parentNode.insertBefore(sentinela, filtro);
    const topo = doc.querySelector('[data-nv-topo]');
    const folga = (topo ? topo.offsetHeight : 64) + 9;
    new janela.IntersectionObserver((entradas) => {
      const e = entradas[0];
      filtro.classList.toggle('is-fixo', !e.isIntersecting && e.boundingClientRect.top < folga);
    }, { rootMargin: `-${folga}px 0px 0px 0px`, threshold: 0 }).observe(sentinela);
  }

  const SEM_CNH_E_PLACA = new Set(['a4', 'r13', 'wd6', 'wd4', 'j10', 'j20', 'z1', 'z2', 'q1', 's73', 'wsdu1', 'v8-mini', 'a7', 't2pro']);
  const TAMANHOS_DO_CARD = '(min-width: 64em) 380px, (min-width: 40em) 45vw, 92vw';
  const TAMANHOS_DA_GALERIA = '(min-width: 64em) 60vw, 100vw';

  function versaoLeve(img, tamanhos) {
    const atual = img.getAttribute('src') || '';
    const partes = atual.match(/^(assets\/img\/)fabricante\/(.+)\.(?:jpe?g|png)(?:\?.*)?$/i);
    if (!partes) return;
    const base = `${partes[1]}vitrine/${partes[2]}`;
    img.setAttribute('srcset', `${base}-800.webp 800w, ${base}-1600.webp 1600w`);
    img.setAttribute('sizes', tamanhos);
    img.setAttribute('src', `${base}-800.webp`);
  }

  function usarFotosLeves() {
    todos(doc, '.es-catalogo-card__foto').forEach((img) => versaoLeve(img, TAMANHOS_DO_CARD));
    todos(doc, 'template[data-es-modelo-detalhe]').forEach((molde) => {
      if (molde.content) todos(molde.content, '.es-catalogo-galeria__foto').forEach((img) => versaoLeve(img, TAMANHOS_DA_GALERIA));
    });
  }

  function selosDoModelo(id, tipo) {
    const selos = [];
    if (tipo) selos.push(tipo);
    if (SEM_CNH_E_PLACA.has(id)) selos.push('Sem CNH', 'Sem emplacamento');
    if (!selos.length) return null;
    const lista = elemento('ul', 'nv-selos');
    lista.setAttribute('aria-label', 'Características');
    selos.forEach((s) => lista.appendChild(elemento('li', 'nv-selo', s)));
    return lista;
  }

  const DESTAQUES = [
    { rotulo: 'Velocidade', teste: /^velocidade/i },
    { rotulo: 'Potência', teste: /^pot[êe]ncia/i },
    { rotulo: 'Autonomia', teste: /^autonomia/i },
  ];

  function itensDaFicha(dl) {
    return dl ? todos(dl, '.es-catalogo-especificacoes__item').map((item) => {
      const dt = item.querySelector('dt');
      const dd = item.querySelector('dd');
      return { item, rotulo: dt ? dt.textContent.trim() : '', valor: dd ? dd.textContent.trim() : '' };
    }) : [];
  }

  function numerosEmDestaque(itens, classe) {
    const escolhidos = DESTAQUES.map((d) => {
      const achado = itens.find((i) => d.teste.test(i.rotulo));
      return achado ? { rotulo: d.rotulo, valor: achado.valor, item: achado.item } : null;
    }).filter(Boolean);
    if (!escolhidos.length) return null;
    const dl = elemento('dl', `es-catalogo-especificacoes nv-numeros ${classe}`);
    escolhidos.forEach((e) => {
      const celula = elemento('div', 'es-catalogo-especificacoes__item');
      const dd = elemento('dd');
      const partes = e.valor.match(/^([\d.,]+)\s*(.*)$/);
      if (partes) {
        dd.appendChild(elemento('b', '', partes[1].replace(/^(\d{1,2})\.(\d{3})$/, '$1$2')));
        if (partes[2]) dd.appendChild(elemento('span', '', partes[2]));
      } else {
        dd.textContent = e.valor;
      }
      celula.appendChild(elemento('dt', '', e.rotulo));
      celula.appendChild(dd);
      dl.appendChild(celula);
    });
    return { dl, usados: escolhidos.map((e) => e.item) };
  }

  function ligarCards() {
    todos(doc, '.es-catalogo-card[data-es-modelo]').forEach((card) => {
      const id = card.getAttribute('data-es-modelo');
      const molde = doc.querySelector(`template[data-es-modelo-detalhe="${id}"]`);
      const ficha = molde && molde.content ? molde.content.querySelector('.es-catalogo-especificacoes') : null;
      const destaque = numerosEmDestaque(itensDaFicha(ficha), 'es-catalogo-especificacoes--card');
      if (!destaque) return;
      const atual = card.querySelector('.es-catalogo-especificacoes');
      const nome = card.querySelector('.es-catalogo-card__nome');
      if (atual) atual.replaceWith(destaque.dl);
      else if (nome) nome.after(destaque.dl);
      const selos = selosDoModelo(id, tipoDoModelo(id));
      if (selos) card.insertBefore(selos, card.firstChild);
      const comprar = card.querySelector('.es-catalogo-card__comprar');
      const detalhes = card.querySelector('.es-catalogo-card__detalhes');
      if (comprar && detalhes && detalhes.compareDocumentPosition(comprar) & 4) detalhes.before(comprar);
    });
  }

  function tipoDoModelo(id) {
    const card = id ? doc.querySelector(`[data-es-modelo="${id}"]`) : null;
    const tipo = card ? card.getAttribute('data-tipo') : null;
    if (!tipo) return null;
    const opcao = doc.querySelector(`[data-es-filtro-tipo="${tipo}"]`);
    const texto = opcao ? opcao.lastChild && opcao.lastChild.textContent : null;
    return texto ? texto.trim() : null;
  }

  function montarGaleria(lado) {
    const contador = elemento('p', 'nv-modal__contador');
    contador.setAttribute('aria-hidden', 'true');
    const anterior = elemento('button', 'nv-modal__seta nv-modal__seta--anterior');
    anterior.type = 'button';
    anterior.setAttribute('aria-label', 'Foto anterior');
    const proxima = elemento('button', 'nv-modal__seta nv-modal__seta--proxima');
    proxima.type = 'button';
    proxima.setAttribute('aria-label', 'Próxima foto');
    const miniaturas = elemento('div', 'nv-modal__miniaturas');
    miniaturas.setAttribute('role', 'group');
    miniaturas.setAttribute('aria-label', 'Fotos do modelo');
    lado.appendChild(contador);
    lado.appendChild(anterior);
    lado.appendChild(proxima);
    lado.appendChild(miniaturas);
    let comMouse = false;
    try {
      comMouse = janela.matchMedia('(hover: hover) and (pointer: fine)').matches;
    } catch (_erro) {
      comMouse = false;
    }
    if (!comMouse) {
      anterior.hidden = true;
      proxima.hidden = true;
    }

    const modal = lado.closest('[data-es-catalogo-modal]');
    const porCor = todos(lado, '[data-es-galeria]').filter((g) => g.getAttribute('data-es-galeria') !== '');
    const corMarcada = () => {
      const b = modal ? modal.querySelector('[data-es-cor][aria-pressed="true"]') : null;
      return b ? b.getAttribute('data-es-cor') : '';
    };
    const escolherCor = (nome) => {
      const b = modal ? todos(modal, '[data-es-cor]').find((x) => x.getAttribute('data-es-cor') === nome) : null;
      if (b) b.click();
    };
    const indiceDaCor = () => porCor.findIndex((g) => g.getAttribute('data-es-galeria') === corMarcada());

    const aviso = elemento('p', 'nv-modal__aviso-cor');
    aviso.hidden = true;
    lado.appendChild(aviso);
    const avisarCorSemFoto = () => {
      const cor = corMarcada();
      const semFoto = Boolean(cor) && porCor.length > 0 && !porCor.some((g) => g.getAttribute('data-es-galeria') === cor);
      aviso.textContent = semFoto ? `Sem foto da cor ${cor} ainda: a imagem mostra outra cor.` : '';
      aviso.hidden = !semFoto;
    };

    if (porCor.length) {
      const atualizarCor = () => {
        avisarCorSemFoto();
        const i = indiceDaCor();
        contador.textContent = i >= 0 ? `${i + 1} / ${porCor.length}` : '';
        contador.hidden = i < 0 || porCor.length < 2;
        miniaturas.hidden = porCor.length < 2;
        lado.classList.toggle('tem-varias', porCor.length > 1);
        anterior.disabled = i <= 0;
        proxima.disabled = i >= porCor.length - 1;
        todos(miniaturas, '.nv-modal__mini').forEach((m, j) => m.setAttribute('aria-current', j === i ? 'true' : 'false'));
      };
      porCor.forEach((g) => {
        const nome = g.getAttribute('data-es-galeria');
        const foto = g.querySelector('.es-catalogo-galeria__foto');
        if (!foto) return;
        const mini = elemento('button', 'nv-modal__mini');
        mini.type = 'button';
        mini.setAttribute('aria-label', `Ver a cor ${nome}`);
        const img = elemento('img');
        img.src = foto.getAttribute('src');
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        mini.appendChild(img);
        mini.addEventListener('click', () => escolherCor(nome));
        miniaturas.appendChild(mini);
      });
      anterior.addEventListener('click', () => {
        const i = indiceDaCor();
        if (i > 0) escolherCor(porCor[i - 1].getAttribute('data-es-galeria'));
      });
      proxima.addEventListener('click', () => {
        const i = indiceDaCor();
        const alvo = porCor[i < 0 ? 0 : i + 1];
        if (alvo) escolherCor(alvo.getAttribute('data-es-galeria'));
      });
      atualizarCor();
      return atualizarCor;
    }

    const visivel = () => lado.querySelector('[data-es-galeria]:not([hidden])') || lado.querySelector('[data-es-galeria]');
    const fotos = () => {
      const g = visivel();
      return g ? todos(g, '.es-catalogo-galeria__foto') : [];
    };
    const indice = () => {
      const g = visivel();
      return g && g.clientWidth ? Math.round(g.scrollLeft / g.clientWidth) : 0;
    };
    const ir = (i) => {
      const g = visivel();
      const lista = fotos();
      if (!g || !lista.length) return;
      const alvo = Math.max(0, Math.min(lista.length - 1, i));
      g.scrollTo({ left: alvo * g.clientWidth, behavior: movimentoReduzido() ? 'auto' : 'smooth' });
    };
    const atualizar = () => {
      const lista = fotos();
      const i = indice();
      contador.textContent = `${i + 1} / ${lista.length}`;
      contador.hidden = lista.length < 2;
      miniaturas.hidden = lista.length < 2;
      lado.classList.toggle('tem-varias', lista.length > 1);
      anterior.disabled = i <= 0;
      proxima.disabled = i >= lista.length - 1;
      todos(miniaturas, '.nv-modal__mini').forEach((m, j) => m.setAttribute('aria-current', j === i ? 'true' : 'false'));
    };
    const refazer = () => {
      miniaturas.textContent = '';
      fotos().forEach((foto, j) => {
        const mini = elemento('button', 'nv-modal__mini');
        mini.type = 'button';
        mini.setAttribute('aria-label', `Foto ${j + 1}`);
        const img = elemento('img');
        img.src = foto.getAttribute('src');
        img.alt = '';
        img.loading = 'lazy';
        img.decoding = 'async';
        mini.appendChild(img);
        mini.addEventListener('click', () => ir(j));
        miniaturas.appendChild(mini);
      });
      const g = visivel();
      if (g) g.scrollLeft = 0;
      atualizar();
    };
    anterior.addEventListener('click', () => ir(indice() - 1));
    proxima.addEventListener('click', () => ir(indice() + 1));
    todos(lado, '[data-es-galeria]').forEach((g) => {
      g.addEventListener('scroll', () => janela.requestAnimationFrame(atualizar), { passive: true });
    });
    refazer();
    return refazer;
  }

  function ligarModal() {
    const modal = doc.querySelector('[data-es-catalogo-modal]');
    const conteudo = modal ? modal.querySelector('[data-es-catalogo-conteudo]') : null;
    const caixa = modal ? modal.querySelector('[role="dialog"]') : null;
    if (!conteudo || !caixa) return;
    modal.classList.add('nv-modal');
    caixa.setAttribute('data-lenis-prevent', '');
    let refazerGaleria = null;
    let rotuloCor = null;

    const nomeDaCor = () => {
      const marcada = conteudo.querySelector('[data-es-cor][aria-pressed="true"]');
      return marcada ? marcada.getAttribute('data-es-cor') : '';
    };

    const montar = () => {
      if (!conteudo.firstElementChild || conteudo.querySelector('.nv-modal__painel')) return;
      const galerias = conteudo.querySelector('.es-catalogo-galerias');
      const titulo = conteudo.querySelector('.es-catalogo-modal__titulo');
      const cores = conteudo.querySelector('.es-catalogo-cores');
      const barra = conteudo.querySelector('.es-catalogo-modal__barra');
      const comprar = barra ? barra.querySelector('a[data-es-link][data-modelo]') : null;
      const id = comprar ? comprar.getAttribute('data-modelo') : null;

      let lado = null;
      if (galerias) {
        lado = elemento('div', 'nv-modal__galeria');
        conteudo.insertBefore(lado, galerias);
        lado.appendChild(galerias);
      }

      const painel = elemento('div', 'nv-modal__painel');
      const topo = elemento('div', 'nv-modal__topo');
      const corpo = elemento('div', 'nv-modal__corpo');
      const base = elemento('div', 'nv-modal__base');
      corpo.setAttribute('data-lenis-prevent', '');
      const tipo = tipoDoModelo(id);
      topo.appendChild(elemento('p', 'nv-modal__eyebrow', tipo ? `NOVA · ${tipo}` : 'NOVA · Mobilidade elétrica'));
      if (titulo) topo.appendChild(titulo);
      const selosDoModal = selosDoModelo(id, null);
      if (selosDoModal) {
        selosDoModal.classList.add('nv-selos--modal');
        topo.appendChild(selosDoModal);
      }

      const ficha = conteudo.querySelector('.es-catalogo-especificacoes');
      const destaque = numerosEmDestaque(itensDaFicha(ficha), 'nv-numeros--modal');
      if (destaque) {
        topo.appendChild(destaque.dl);
        destaque.usados.forEach((item) => item.remove());
      }
      if (ficha) {
        ficha.classList.add('nv-ficha');
        const titulo = ficha.previousElementSibling;
        if (!ficha.children.length) {
          if (titulo && titulo.classList.contains('es-catalogo-modal__subtitulo')) titulo.remove();
          ficha.remove();
        } else if (titulo && titulo.classList.contains('es-catalogo-modal__subtitulo')) {
          titulo.textContent = 'Ficha técnica';
        }
      }
      const itens = conteudo.querySelector('.es-catalogo-lista-tecnica');
      const tituloItens = itens ? itens.previousElementSibling : null;
      if (tituloItens && tituloItens.classList.contains('es-catalogo-modal__subtitulo')) tituloItens.textContent = 'Itens de série';

      Array.prototype.slice.call(conteudo.children).forEach((filho) => {
        if (filho === lado || filho === barra || filho === cores) return;
        corpo.appendChild(filho);
      });

      rotuloCor = null;
      if (cores) {
        const linha = elemento('div', 'nv-modal__cores');
        const rotulo = elemento('p', 'nv-modal__cor', 'Cor: ');
        rotuloCor = elemento('strong', '', nomeDaCor());
        rotulo.appendChild(rotuloCor);
        linha.appendChild(rotulo);
        linha.appendChild(cores);
        base.appendChild(linha);
      }
      if (barra) {
        base.appendChild(barra);
        const whatsapp = janela.ES_LEAD_WHATSAPP;
        const href = id && whatsapp && typeof whatsapp.linkDoPedido === 'function'
          ? whatsapp.linkDoPedido({ atributos: { 'data-wa-contexto': 'testride', 'data-origem': 'modal_testride', 'data-modelo': id, 'data-cor': '' } })
          : null;
        if (href) {
          const testride = elemento('a', 'nv-modal__testride', 'Test ride');
          testride.href = href;
          testride.setAttribute('data-es-link', 'lead-whatsapp');
          testride.setAttribute('data-wa-contexto', 'testride');
          testride.setAttribute('data-origem', 'modal_testride');
          testride.setAttribute('data-modelo', id);
          barra.appendChild(testride);
        }
      }
      base.appendChild(elemento('p', 'nv-modal__nota', 'Atendimento direto pelo WhatsApp da loja.'));

      painel.appendChild(topo);
      painel.appendChild(corpo);
      painel.appendChild(base);
      conteudo.appendChild(painel);
      refazerGaleria = lado ? montarGaleria(lado) : null;
      if (lado) montarNavegacao(lado, id);
    };

    const montarNavegacao = (lado, id) => {
      const ids = todos(doc, '.es-catalogo-card[data-es-modelo]').filter((c) => !c.hidden).map((c) => c.getAttribute('data-es-modelo'));
      const i = ids.indexOf(id);
      if (i < 0 || ids.length < 2) return;
      const nav = elemento('div', 'nv-modal__navegacao');
      const botao = (classe, rotulo, alvo) => {
        const b = elemento('button', `nv-modal__nav ${classe}`);
        b.type = 'button';
        b.setAttribute('aria-label', rotulo);
        b.addEventListener('click', () => {
          const abrir = doc.querySelector(`[data-es-abrir="${alvo}"]`);
          if (abrir) abrir.click();
        });
        return b;
      };
      const anterior = ids[(i - 1 + ids.length) % ids.length];
      const proximo = ids[(i + 1) % ids.length];
      nav.appendChild(botao('nv-modal__nav--anterior', 'Modelo anterior', anterior));
      nav.appendChild(elemento('span', 'nv-modal__nav-texto', `${i + 1} de ${ids.length}`));
      nav.appendChild(botao('nv-modal__nav--proximo', 'Próximo modelo', proximo));
      lado.appendChild(nav);
    };

    const lightbox = elemento('div', 'nv-lightbox');
    lightbox.hidden = true;
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Foto ampliada');
    const fotoGrande = elemento('img', 'nv-lightbox__foto');
    fotoGrande.alt = '';
    const fecharFoto = elemento('button', 'nv-lightbox__fechar');
    fecharFoto.type = 'button';
    fecharFoto.setAttribute('aria-label', 'Fechar a foto ampliada');
    fecharFoto.textContent = '×';
    lightbox.appendChild(fotoGrande);
    lightbox.appendChild(fecharFoto);
    caixa.appendChild(lightbox);
    let voltarPara = null;
    const fecharLightbox = () => {
      if (lightbox.hidden) return;
      lightbox.hidden = true;
      fotoGrande.removeAttribute('src');
      if (voltarPara) voltarPara.focus();
      voltarPara = null;
    };
    fecharFoto.addEventListener('click', fecharLightbox);
    lightbox.addEventListener('click', (evento) => {
      if (evento.target === lightbox) fecharLightbox();
    });
    janela.addEventListener('keydown', (evento) => {
      if (lightbox.hidden || evento.key !== 'Escape') return;
      evento.preventDefault();
      evento.stopPropagation();
      fecharLightbox();
    }, true);
    conteudo.addEventListener('click', (evento) => {
      const foto = evento.target && evento.target.closest ? evento.target.closest('.es-catalogo-galeria__foto') : null;
      if (!foto) return;
      voltarPara = foto.closest('.nv-modal__galeria');
      fotoGrande.src = foto.currentSrc || foto.getAttribute('src');
      fotoGrande.alt = foto.alt || '';
      lightbox.hidden = false;
      fecharFoto.focus();
    });

    if (typeof janela.MutationObserver === 'function') {
      new janela.MutationObserver(montar).observe(conteudo, { childList: true });
    }
    modal.addEventListener('click', (evento) => {
      const alvo = evento.target;
      if (!alvo || typeof alvo.closest !== 'function' || !alvo.closest('[data-es-cor]')) return;
      if (rotuloCor) rotuloCor.textContent = nomeDaCor();
      if (refazerGaleria) refazerGaleria();
    });
  }

  /**
   * O chevron da marca (o mesmo desenho do .hero__chevron, caixa 22–94 × 10–110 de 120) em % da hero,
   * com 6 pontos na ordem do retângulo cheio do CSS: canto de cima, ponta de cima, bico, ponta de baixo,
   * canto de baixo, dente. Proporção mantida: 58% da altura, centrado um pouco à direita.
   */
  function chevronDaHero(hero) {
    const largura = hero.clientWidth || 1;
    const altura = hero.clientHeight || 1;
    const alto = 58;
    const largo = Math.min(70, (alto / 100) * altura * 0.72 / largura * 100);
    const x0 = (telaGrande() ? 58 : 50) - largo / 2;
    const y0 = (100 - alto) / 2;
    const px = (v) => (x0 + ((v - 22) / 72) * largo).toFixed(2);
    const py = (v) => (y0 + ((v - 10) / 100) * alto).toFixed(2);
    return `polygon(${px(22)}% ${py(10)}%, ${px(50)}% ${py(10)}%, ${px(94)}% ${py(60)}%, ${px(50)}% ${py(110)}%, ${px(22)}% ${py(110)}%, ${px(66)}% ${py(60)}%)`;
  }

  function ligarHero(gsap) {
    const hero = doc.querySelector('.hero');
    const linhas = todos(doc, '.hero__linha > span');
    const neon = doc.querySelector('.hero__neon');
    const blocos = todos(doc, '[data-nv-hero]');
    const carga = doc.querySelector('[data-nv-carga]');
    const midia = doc.querySelector('[data-nv-midia]');
    const moldura = doc.querySelector('[data-nv-moldura]');
    const camada = doc.querySelector('[data-nv-camada]');
    const conteudo = doc.querySelector('.hero__conteudo');
    const prova = doc.querySelector('.hero__prova');
    const chevron = doc.querySelector('.hero__chevron');
    const linha = gsap.timeline({ defaults: { ease: 'expo.out' } });
    // Abertura: a loja aparece dentro do chevron da marca, que se abre até a tela inteira.
    if (midia && hero) {
      linha.fromTo(midia, { clipPath: chevronDaHero(hero), opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' }, 0);
      linha.to(midia, { clipPath: 'polygon(0% 0%, 100% 0%, 100% 50%, 100% 100%, 0% 100%, 0% 50%)', duration: 1.6, ease: 'expo.inOut' }, 0.35);
      if (camada) linha.fromTo(camada, { scale: 1.35 }, { scale: 1, duration: 2.4, ease: 'expo.out' }, 0.35);
    }
    if (linhas.length) linha.fromTo(linhas, { yPercent: 140 }, { yPercent: 0, duration: 1.1, stagger: 0.12 }, 1.05);
    if (neon) linha.fromTo(neon, { opacity: 0.35 }, { keyframes: { opacity: [0.35, 1, 0.55, 1] }, duration: 0.7, ease: 'none' }, 1.85);
    if (carga) linha.fromTo(carga, { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'power3.inOut' }, 1.5);
    if (blocos.length) linha.fromTo(blocos, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08 }, 1.55);
    if (chevron) linha.fromTo(chevron, { opacity: 0, xPercent: 10, y: 0, yPercent: -50 }, { opacity: 0.35, xPercent: 0, y: 0, yPercent: -50, duration: 1.6 }, 1.2);

    if (!janela.ScrollTrigger || !hero) return;
    // Ao rolar: o vídeo se aproxima e recolhe num card de cantos redondos; o texto sobe e sai.
    const rolar = { trigger: hero, start: 'top top', end: 'bottom top', scrub: true };
    const grande = telaGrande();
    if (moldura) gsap.fromTo(moldura, { clipPath: 'inset(0% 0% 0% 0% round 0rem)' }, { clipPath: grande ? 'inset(0% 4% 14% 4% round 2.5rem)' : 'inset(0% 3% 10% 3% round 1.5rem)', ease: 'none', scrollTrigger: rolar });
    if (camada) gsap.to(camada, { yPercent: 10, ease: 'none', scrollTrigger: rolar });
    if (conteudo) gsap.to(conteudo, { yPercent: grande ? -18 : -8, opacity: 0, ease: 'power1.in', scrollTrigger: rolar });
    if (prova && grande) gsap.to(prova, { yPercent: -30, ease: 'none', scrollTrigger: rolar });
    if (chevron && grande) gsap.to(chevron, { xPercent: -8, ease: 'none', scrollTrigger: rolar });
  }

  function ligarFaixa(gsap) {
    const passos = todos(doc, '[data-nv-passos] > li');
    if (passos.length && janela.ScrollTrigger) {
      gsap.fromTo(passos, { opacity: 0, y: 24 }, {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.12,
        ease: 'expo.out',
        scrollTrigger: { trigger: passos[0].parentElement, start: 'top 85%', once: true },
      });
    }
    const chevrons = doc.querySelector('.faixa-verde__chevrons');
    if (chevrons && telaGrande() && janela.ScrollTrigger) {
      gsap.fromTo(chevrons, { xPercent: 8 }, { xPercent: -8, ease: 'none', scrollTrigger: { trigger: chevrons.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    }
  }

  function iniciar() {
    ligarTopo();
    ligarMenu();
    ligarFlutuante();
    ligarMapa();
    ligarAncoras();
    usarFotosLeves();
    ligarFiltro();
    ligarCards();
    ligarBrilhoDosCards();
    ligarModal();
    ligarFaq();
    ligarContadores();
    ligarVideoDoHero();
    const gsap = janela.gsap;
    if (!gsap || typeof gsap.timeline !== 'function' || movimentoReduzido()) return;
    try {
      if (janela.ScrollTrigger) gsap.registerPlugin(janela.ScrollTrigger);
      ligarHero(gsap);
      ligarFaixa(gsap);
    } catch (_erro) {
      gsap.set('[data-nv-hero], [data-nv-passos] > li, .hero__linha > span, .hero__neon, [data-nv-carga], [data-nv-midia], [data-nv-moldura], [data-nv-camada], .hero__conteudo, .hero__prova, .hero__chevron', { clearProps: 'all' });
    }
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})(window);
