/*
 * Movimento da página: revelar ao rolar (GSAP + ScrollTrigger) e rolagem suave (Lenis).
 *
 * - Sem GSAP, sem ScrollTrigger ou com prefers-reduced-motion: reduce, nada é escondido e o
 *   Lenis não liga. O estado inicial do revelar é aplicado aqui, pelo JS: sem JS o conteúdo
 *   continua visível.
 * - O Lenis anda no ticker do GSAP e avisa o ScrollTrigger a cada rolagem. A instância fica em
 *   window.ES_LENIS (o modal da vitrine chama stop() ao abrir e start() ao fechar); o filtro da
 *   vitrine chama window.ScrollTrigger.refresh().
 * - Com o Lenis parado (modal aberto), a roda do mouse dentro de [data-es-catalogo-modal] fica
 *   com o navegador, para o conteúdo do modal rolar.
 * - A preferência de movimento é lida ao vivo (gsap.matchMedia): ao mudar para reduce, tudo
 *   volta ao estado sem movimento.
 */
(function (raiz) {
  'use strict';

  const SELETOR_REVELAR = '[data-es-revelar]';
  const ATRIBUTO_MODAL = 'data-es-catalogo-modal';
  const SEM_PREFERENCIA = '(prefers-reduced-motion: no-preference)';
  const REDUZIDO = '(prefers-reduced-motion: reduce)';
  const DURACAO_PADRAO = 450;
  const DISTANCIA_PADRAO = 16;

  function prefereMenosMovimento(janela) {
    try {
      return Boolean(janela && typeof janela.matchMedia === 'function' && janela.matchMedia(REDUZIDO).matches);
    } catch (_erro) {
      return false;
    }
  }

  /** Lê um token de tempo ("450ms" ou "0.45s") ou de distância ("16px") do :root; senão, o padrão. */
  function lerToken(janela, nome, padrao, unidades) {
    try {
      const doc = janela.document;
      if (!doc || !doc.documentElement || typeof janela.getComputedStyle !== 'function') return padrao;
      const bruto = String(janela.getComputedStyle(doc.documentElement).getPropertyValue(nome) || '').trim();
      const m = /^(\d+(?:\.\d+)?)(ms|s|px)$/.exec(bruto);
      if (!m || !Object.prototype.hasOwnProperty.call(unidades, m[2])) return padrao;
      const valor = parseFloat(m[1]) * unidades[m[2]];
      return Number.isFinite(valor) && valor >= 0 ? valor : padrao;
    } catch (_erro) {
      return padrao;
    }
  }

  /** O Lenis não trata a rolagem que nasce dentro do modal da vitrine. */
  function dentroDoModal(no) {
    return Boolean(no && typeof no.hasAttribute === 'function' && no.hasAttribute(ATRIBUTO_MODAL));
  }

  /** Liga o Lenis no ticker do GSAP; devolve a função que desliga, ou null sem Lenis. */
  function ligarRolagem(janela) {
    const Lenis = janela.Lenis;
    const gsap = janela.gsap;
    const gatilhos = janela.ScrollTrigger;
    if (typeof Lenis !== 'function') return null;
    const lenis = new Lenis({ autoRaf: false, prevent: dentroDoModal });
    if (gatilhos && typeof gatilhos.update === 'function') lenis.on('scroll', gatilhos.update);
    const passo = (tempo) => {
      lenis.raf(tempo * 1000);
    };
    gsap.ticker.add(passo);
    gsap.ticker.lagSmoothing(0);
    janela.ES_LENIS = lenis;
    return function desligar() {
      gsap.ticker.remove(passo);
      gsap.ticker.lagSmoothing(500, 33);
      lenis.destroy();
      if (janela.ES_LENIS === lenis) delete janela.ES_LENIS;
    };
  }

  /** Cada [data-es-revelar] entra com opacidade e deslocamento curtos, uma vez, ao chegar à tela. */
  function ligarRevelar(janela, doc) {
    const gsap = janela.gsap;
    const duracao = lerToken(janela, '--es-revelar-duracao', DURACAO_PADRAO, { ms: 1, s: 1000 }) / 1000;
    const distancia = lerToken(janela, '--es-revelar-distancia', DISTANCIA_PADRAO, { px: 1 });
    const alvos = Array.prototype.slice.call(doc.querySelectorAll(SELETOR_REVELAR));
    const animacoes = alvos.map((alvo) => gsap.fromTo(alvo, { opacity: 0, y: distancia }, {
      opacity: 1,
      y: 0,
      duration: duracao,
      ease: 'power2.out',
      scrollTrigger: { trigger: alvo, start: 'top bottom', once: true },
    }));
    // O foco do teclado num bloco que ainda não apareceu termina a animação dele na hora.
    const aoFocar = (evento) => {
      const alvo = evento && evento.target;
      if (!alvo || typeof alvo.closest !== 'function') return;
      const i = alvos.indexOf(alvo.closest(SELETOR_REVELAR));
      if (i !== -1 && animacoes[i] && typeof animacoes[i].progress === 'function') animacoes[i].progress(1);
    };
    doc.addEventListener('focusin', aoFocar);
    return function desligar() {
      doc.removeEventListener('focusin', aoFocar);
    };
  }

  /**
   * Liga o movimento na página. Devolve false (e não esconde nada) sem documento, sem GSAP ou sem
   * ScrollTrigger; senão, o objeto do gsap.matchMedia (revert() desfaz tudo).
   */
  function ligar(janela) {
    const doc = janela ? janela.document : null;
    const gsap = janela ? janela.gsap : null;
    const gatilhos = janela ? janela.ScrollTrigger : null;
    if (!doc || typeof doc.querySelectorAll !== 'function') return false;
    if (!gsap || typeof gsap.matchMedia !== 'function' || typeof gsap.fromTo !== 'function' || !gatilhos) return false;
    gsap.registerPlugin(gatilhos);
    const mm = gsap.matchMedia();
    try {
      mm.add(SEM_PREFERENCIA, () => {
        let desligarRolagem = null;
        let desligarRevelar = null;
        const desligarTudo = () => {
          if (desligarRevelar) desligarRevelar();
          if (desligarRolagem) desligarRolagem();
          desligarRevelar = null;
          desligarRolagem = null;
        };
        try {
          desligarRolagem = ligarRolagem(janela);
          desligarRevelar = ligarRevelar(janela, doc);
        } catch (erro) {
          desligarTudo();
          throw erro;
        }
        return desligarTudo;
      });
    } catch (_erro) {
      // Uma falha no meio não deixa conteúdo escondido nem rolagem presa.
      mm.revert();
      if (janela.ES_LENIS) delete janela.ES_LENIS;
      return false;
    }
    return mm;
  }

  const api = {
    SELETOR_REVELAR,
    ATRIBUTO_MODAL,
    prefereMenosMovimento,
    lerToken,
    dentroDoModal,
    ligarRolagem,
    ligarRevelar,
    ligar,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    raiz.ES_MOVIMENTO = api;
    const doc = raiz.document;
    if (doc && typeof doc.addEventListener === 'function') {
      if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', () => ligar(raiz));
      else ligar(raiz);
    }
  }
  // eslint-disable-next-line no-undef
})(typeof window !== 'undefined' ? window : globalThis);
