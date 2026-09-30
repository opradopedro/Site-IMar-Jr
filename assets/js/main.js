/* =========================================================
   IMar Júnior — interações
   ========================================================= */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* ---------- relógio (horário de Santos) ---------- */
  const clock = $("#clock");
  const fmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const tickClock = () => { clock.textContent = fmt.format(new Date()); };
  tickClock();
  setInterval(tickClock, 1000);
  $("#year").textContent = new Date().getFullYear();

  /* ---------- navegação ---------- */
  const nav = $("#nav");
  const menu = $("#menu");
  const menuBtn = $("#menuBtn");
  const setMenu = (open) => {
    menu.classList.toggle("is-open", open);
    nav.classList.toggle("menu-open", open);
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
    document.body.style.overflow = open ? "hidden" : "";
  };
  menuBtn.addEventListener("click", () => setMenu(!menu.classList.contains("is-open")));
  $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));
  addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

  $("#surface").addEventListener("click", () => scrollTo({ top: 0, behavior: reduced ? "auto" : "smooth" }));

  /* ---------- profundidade: medidor + cor de fundo ---------- */
  const anchors = $$("[data-depth]");
  const depthEl = $("#depth");
  const depthFill = $("#depthFill");
  const zoneEl = $("#zone");
  const gauge = $(".gauge");
  const zones = [
    [200, "EPIPELÁGICA"],
    [1000, "MESOPELÁGICA"],
    [4000, "BATIPELÁGICA"],
    [Infinity, "ABISSAL"],
  ];
  const surfaceRGB = [6, 24, 48];
  const abyssRGB = [1, 4, 10];
  let depth = 0;

  const readDepth = () => {
    const probe = scrollY + innerHeight * 0.5;
    const pts = anchors.map((el) => [el.getBoundingClientRect().top + scrollY, +el.dataset.depth]);
    if (probe <= pts[0][0]) return pts[0][1];
    for (let i = 0; i < pts.length - 1; i++) {
      const [y0, d0] = pts[i], [y1, d1] = pts[i + 1];
      if (probe >= y0 && probe < y1) return lerp(d0, d1, (probe - y0) / (y1 - y0));
    }
    return pts[pts.length - 1][1];
  };

  const onScroll = () => {
    nav.classList.toggle("is-scrolled", scrollY > 30);
    depth = readDepth();
    const t = clamp(depth / 5000, 0, 1);
    depthEl.textContent = String(Math.round(depth)).padStart(4, "0");
    depthFill.style.width = t * 100 + "%";
    zoneEl.textContent = zones.find(([max]) => depth < max)[1];
    gauge.classList.toggle("is-visible", scrollY > innerHeight * 0.6);
    const k = Math.pow(t, 0.7);
    const c = surfaceRGB.map((v, i) => Math.round(lerp(v, abyssRGB[i], k)));
    document.documentElement.style.setProperty("--bg", `rgb(${c})`);
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  onScroll();

  /* ---------- canvas util ---------- */
  const fitCanvas = (cv) => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const r = cv.getBoundingClientRect();
    cv.width = Math.max(1, Math.round(r.width * dpr));
    cv.height = Math.max(1, Math.round(r.height * dpr));
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w: r.width, h: r.height };
  };
  const whenVisible = (el, cb) => {
    const io = new IntersectionObserver(([e]) => cb(e.isIntersecting), { rootMargin: "80px" });
    io.observe(el);
  };

  /* ---------- hero: superfície do oceano em malha de pontos ---------- */
  (() => {
    const cv = $("#ocean");
    let ctx, W, H, running = true, raf = 0;
    const mouse = { x: -9999, y: -9999, wx: 0, wz: -99, s: 0 };

    const resize = () => ({ ctx, w: W, h: H } = fitCanvas(cv));
    resize();
    addEventListener("resize", resize);

    cv.parentElement.addEventListener("pointermove", (e) => {
      const r = cv.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    });
    cv.parentElement.addEventListener("pointerleave", () => { mouse.x = mouse.y = -9999; });

    const draw = (time) => {
      const t = time * 0.001;
      ctx.clearRect(0, 0, W, H);

      const small = W < 700;
      const cols = small ? 40 : 96;
      const rows = small ? 30 : 40;
      const horizon = H * (small ? 0.4 : 0.34);
      const camH = 2.4;
      const zNear = 1.6, zFar = 22;
      const f = ((H - horizon) * zNear) / camH * 1.08; // linha mais próxima encosta na base
      const fov = W * (small ? 0.9 : 0.55);

      // posição do mouse projetada na superfície
      if (mouse.y > horizon + 4) {
        const z = (camH * f) / (mouse.y - horizon);
        mouse.wz = z;
        mouse.wx = ((mouse.x - W / 2) * z) / fov;
        mouse.s = Math.min(1, mouse.s + 0.05);
      } else {
        mouse.s = Math.max(0, mouse.s - 0.03);
      }

      for (let r = rows - 1; r >= 0; r--) {
        const z = lerp(zNear, zFar, Math.pow(r / (rows - 1), 1.6));
        const depthFade = 1 - (z - zNear) / (zFar - zNear);
        const xmax = ((W / 2) * z) / fov * 1.06; // cada linha cobre a largura da tela
        for (let c = 0; c < cols; c++) {
          const x = (c / (cols - 1) - 0.5) * 2 * xmax;
          let y =
            0.42 * Math.sin(x * 0.45 + t * 0.8) +
            0.3 * Math.sin(z * 0.6 - t * 1.05) +
            0.16 * Math.sin((x + z) * 1.2 + t * 1.6) +
            0.08 * Math.sin(x * 2.3 - z * 1.7 + t * 2.1);

          if (mouse.s > 0) {
            const dx = x - mouse.wx, dz = z - mouse.wz;
            const d = Math.sqrt(dx * dx + dz * dz);
            y += mouse.s * 0.9 * Math.exp(-d * d * 0.18) * Math.sin(d * 2.6 - t * 5);
          }

          const sx = W / 2 + (x / z) * fov;
          if (sx < -10 || sx > W + 10) continue;
          const sy = horizon + ((camH - y) / z) * f;
          if (sy > H + 10) continue;

          const size = Math.max(1.1, 4.4 / z);
          const a = clamp(0.18 + depthFade * 0.9, 0.18, 1);
          if (y > 0.62) ctx.fillStyle = `rgba(255,91,46,${a})`;
          else if (y > 0.2) ctx.fillStyle = `rgba(200,230,250,${a * 0.85})`;
          else ctx.fillStyle = `rgba(90,160,230,${a * 0.7})`;
          ctx.fillRect(sx - size / 2, sy - size / 2, size, size);
        }
      }

      // linha do horizonte
      ctx.fillStyle = "rgba(140,200,240,.18)";
      ctx.fillRect(0, horizon - 0.5, W, 1);

      if (running && !reduced) raf = requestAnimationFrame(draw);
    };

    whenVisible(cv, (v) => {
      running = v;
      cancelAnimationFrame(raf);
      if (v) raf = requestAnimationFrame(draw);
    });
    if (reduced) requestAnimationFrame(draw);
  })();

  /* ---------- neve marinha (fica mais densa com a profundidade) ---------- */
  (() => {
    const cv = $("#snow");
    if (reduced) { cv.remove(); return; }
    let ctx, W, H;
    const resize = () => ({ ctx, w: W, h: H } = fitCanvas(cv));
    resize();
    addEventListener("resize", resize);

    const N = innerWidth < 700 ? 40 : 90;
    const parts = Array.from({ length: N }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.4 + 0.3,
      v: Math.random() * 0.00025 + 0.00008,
      p: Math.random() * Math.PI * 2,
      glow: Math.random() < 0.12,
    }));

    let last = scrollY;
    const loop = (time) => {
      const t = time * 0.001;
      const k = clamp(depth / 5000, 0, 1);
      const dy = (scrollY - last) / H;
      last = scrollY;
      ctx.clearRect(0, 0, W, H);
      if (depth > 60) {
        for (const p of parts) {
          p.y += p.v - dy * 0.15;
          if (p.y > 1.02) p.y -= 1.04;
          if (p.y < -0.02) p.y += 1.04;
          const x = (p.x + Math.sin(t * 0.3 + p.p) * 0.004) * W;
          const y = p.y * H;
          if (p.glow) {
            const a = (0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 1.3 + p.p))) * k;
            ctx.fillStyle = `rgba(120,230,255,${a})`;
            ctx.shadowBlur = 8; ctx.shadowColor = "rgba(120,230,255,.8)";
          } else {
            ctx.fillStyle = `rgba(200,220,240,${0.12 + 0.3 * k})`;
            ctx.shadowBlur = 0;
          }
          ctx.beginPath();
          ctx.arc(x, y, p.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  })();

  /* ---------- efeito "decodificar" em rótulos mono ---------- */
  const glyphs = "▚▞▟▙░▒<>/\\|—=+*#01";
  const scramble = (el) => {
    if (reduced || el.dataset.done) return;
    el.dataset.done = "1";
    const final = el.textContent;
    const dur = 700;
    const start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const n = Math.floor(p * final.length);
      let out = final.slice(0, n);
      for (let i = n; i < final.length; i++) out += final[i] === " " ? " " : glyphs[(Math.random() * glyphs.length) | 0];
      el.textContent = out;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = final;
    };
    requestAnimationFrame(step);
  };

  /* ---------- contadores ---------- */
  const countUp = (el) => {
    const end = +el.dataset.count;
    const plain = "plain" in el.dataset;
    const suffix = el.dataset.suffix || "";
    const from = plain ? end - 40 : 0;
    if (reduced) { el.textContent = end + suffix; return; }
    const dur = 1400, start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - p, 4);
      el.textContent = Math.round(lerp(from, end, e)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  /* ---------- revelar ao rolar ---------- */
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      el.classList.add("is-in");
      $$("[data-scramble]", el).forEach(scramble);
      if (el.matches("[data-scramble]")) scramble(el);
      const n = el.querySelector("[data-count]");
      if (n) countUp(n);
      io.unobserve(el);
    }
  }, { threshold: 0.15, rootMargin: "0px 0px -8% 0px" });
  $$(".reveal, .sec-head, .hero .eyebrow").forEach((el, i) => {
    // pequeno escalonamento entre irmãos
    const sibs = el.parentElement ? $$(":scope > .reveal", el.parentElement) : [];
    const idx = sibs.indexOf(el);
    if (idx > 0) el.style.transitionDelay = `${Math.min(idx, 5) * 80}ms`;
    io.observe(el);
  });

  /* ---------- serviços ---------- */
  const services = [
    {
      viz: "ESG", for: "Empresas · Eventos", title: "Consultoria ESG",
      desc: "Diagnóstico completo para empresas e eventos, analisando processos e desenvolvendo estratégias alinhadas aos pilares Ambiental, Social e de Governança (ESG).",
      points: ["Diagnóstico de processos e práticas atuais", "Estratégias nos pilares Ambiental, Social e Governança", "Mais eficiência operacional e responsabilidade socioambiental", "Reputação fortalecida no mercado"],
    },
    {
      viz: "EDU", for: "Empresas · Escolas", title: "Educação Ambiental",
      desc: "Introduzir, ensinar e aprimorar conhecimentos ambientais e de sustentabilidade, com uma metodologia interativa, multidisciplinar e adaptável.",
      points: ["Palestras", "Aulas", "Dinâmicas de conscientização", "Conteúdo adaptado ao público"],
    },
    {
      viz: "PGRS", for: "Empresas · Eventos", title: "Plano de Gestão de Resíduos Sólidos",
      desc: "Elaboramos e implementamos o PGRS, estabelecendo as diretrizes corretas para o manejo, segregação, transporte e destinação final dos resíduos.",
      points: ["Manejo e segregação", "Transporte e destinação final", "Redução de impactos ambientais", "Conformidade total com a legislação vigente"],
    },
    {
      viz: "COFFEE", for: "Eventos", title: "Coffee Break Sustentável",
      desc: "Soluções para eventos focadas na redução de resíduos e no consumo consciente, do cardápio ao descarte.",
      points: ["Insumos locais e de baixo impacto ambiental", "Materiais reutilizáveis ou compostáveis", "Resíduos direcionados à reciclagem e compostagem"],
    },
    {
      viz: "LIC", for: "Empresas · Empreendimentos", title: "Licenciamento Ambiental",
      desc: "Apoio técnico no processo de licenciamento ambiental do seu empreendimento, com orientação nas exigências dos órgãos ambientais.",
      points: ["Levantamento de requisitos legais", "Organização da documentação técnica", "Acompanhamento das exigências"],
    },
    {
      viz: "ISO", for: "Empresas", title: "Consultoria em Normas ISO",
      desc: "Adequação de processos a normas ISO de gestão, preparando sua organização para trabalhar com padrões reconhecidos internacionalmente.",
      points: ["Diagnóstico de aderência à norma", "Plano de adequação de processos", "Apoio na documentação"],
    },
    {
      viz: "CUSTOM", for: "Qualquer organização", title: "Projetos Personalizados",
      desc: "Projetos em sustentabilidade desenvolvidos de acordo com os desafios e objetivos da sua organização. Conta pra gente o que você precisa.",
      points: ["Escopo construído junto com você", "Equipe interdisciplinar do Instituto do Mar", "Foco em impacto ambiental positivo"],
    },
  ];

  const svItems = $$(".sv__item");
  const svBody = $(".sv__body");
  const svEls = { viz: $("#svViz"), for: $("#svFor"), title: $("#svTitle"), desc: $("#svDesc"), points: $("#svPoints") };
  let svIndex = 0;

  const renderService = (i, animate = true) => {
    svIndex = i;
    const s = services[i];
    svItems.forEach((b, j) => {
      b.classList.toggle("is-active", j === i);
      b.setAttribute("aria-selected", String(j === i));
    });
    svEls.viz.textContent = `// ${s.viz}`;
    svEls.for.textContent = s.for;
    svEls.title.textContent = s.title;
    svEls.desc.textContent = s.desc;
    svEls.points.innerHTML = "";
    s.points.forEach((p) => { const li = document.createElement("li"); li.textContent = p; svEls.points.appendChild(li); });
    if (animate) { svBody.classList.remove("is-swap"); void svBody.offsetWidth; svBody.classList.add("is-swap"); }
    seedBlips(i);
  };

  svItems.forEach((b, i) => {
    b.addEventListener("click", () => {
      renderService(i);
      // no mobile o painel fica abaixo da lista: leva o usuário até ele
      if (matchMedia("(max-width: 900px)").matches) $("#sv-panel").scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
    });
    if (matchMedia("(hover: hover)").matches) b.addEventListener("mouseenter", () => { if (svIndex !== i) renderService(i); });
    b.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      const n = (i + (e.key === "ArrowDown" ? 1 : -1) + svItems.length) % svItems.length;
      svItems[n].focus();
      renderService(n);
    });
  });

  $("[data-sv-cta]").addEventListener("click", () => {
    const sel = $("#formService");
    sel.selectedIndex = svIndex;
  });

  /* ---------- sonar do painel de serviços ---------- */
  let blips = [];
  function seedBlips(i) {
    let s = (i + 1) * 9301;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    blips = Array.from({ length: 5 + i % 3 }, () => ({ a: Math.PI + rnd() * Math.PI, r: 0.25 + rnd() * 0.65, life: 0 }));
  }

  (() => {
    const cv = $("#sonar");
    let ctx, W, H, running = false, raf = 0, sweep = Math.PI;
    const resize = () => ({ ctx, w: W, h: H } = fitCanvas(cv));
    resize();
    addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2, cy = H - 6, R = Math.min(W / 2 - 10, H - 16);

      // anéis e raios
      ctx.strokeStyle = "rgba(140,190,255,.16)";
      ctx.lineWidth = 1;
      for (let k = 1; k <= 4; k++) {
        ctx.beginPath(); ctx.arc(cx, cy, (R * k) / 4, Math.PI, 0); ctx.stroke();
      }
      for (let k = 0; k <= 6; k++) {
        const a = Math.PI + (Math.PI * k) / 6;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
      }

      // feixe
      if (!reduced) sweep += 0.018;
      if (sweep > Math.PI * 2) sweep = Math.PI;
      const g = ctx.createConicGradient ? ctx.createConicGradient(sweep - 0.6, cx, cy) : null;
      if (g) {
        g.addColorStop(0, "rgba(140,200,240,0)");
        g.addColorStop(0.6 / (Math.PI * 2), "rgba(140,200,240,.28)");
        g.addColorStop(0.6 / (Math.PI * 2) + 0.0001, "rgba(140,200,240,0)");
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, Math.PI, 0); ctx.closePath(); ctx.fill();
      }
      ctx.strokeStyle = "rgba(200,235,255,.8)";
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R); ctx.stroke();

      // alvos
      for (const b of blips) {
        const diff = Math.abs(sweep - b.a);
        if (diff < 0.03) b.life = 1;
        b.life = reduced ? 1 : Math.max(0, b.life - 0.006);
        const x = cx + Math.cos(b.a) * b.r * R, y = cy + Math.sin(b.a) * b.r * R;
        ctx.fillStyle = `rgba(255,91,46,${0.15 + b.life * 0.85})`;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
        if (b.life > 0) {
          ctx.strokeStyle = `rgba(255,91,46,${b.life * 0.6})`;
          ctx.beginPath(); ctx.arc(x, y, 3 + (1 - b.life) * 16, 0, Math.PI * 2); ctx.stroke();
        }
      }

      if (running && !reduced) raf = requestAnimationFrame(draw);
    };

    whenVisible(cv, (v) => {
      running = v;
      cancelAnimationFrame(raf);
      if (v) raf = requestAnimationFrame(draw);
    });
    if (reduced) { seedBlips(0); requestAnimationFrame(draw); }
  })();

  renderService(0, false);

  /* ---------- formulário (abre o e-mail com a mensagem pronta) ---------- */
  const form = $("#form");
  const status = $("#formStatus");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    let ok = true;
    $$("[required]", form).forEach((f) => {
      const bad = !f.value.trim() || (f.type === "email" && !/^\S+@\S+\.\S+$/.test(f.value));
      f.closest(".field-in").classList.toggle("is-error", bad);
      if (bad) ok = false;
    });
    if (!ok) { status.textContent = "CAMPOS PENDENTES"; return; }

    const d = Object.fromEntries(new FormData(form));
    const subject = `[Site] ${d.servico} — ${d.nome}`;
    const body = `Nome: ${d.nome}\nE-mail: ${d.email}\nEmpresa: ${d.empresa || "-"}\nServiço: ${d.servico}\n\n${d.mensagem}`;
    status.textContent = "TRANSMITINDO…";
    location.href = `mailto:contato@imarjunior.com.br?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setTimeout(() => { status.textContent = "ENVIADO AO SEU E-MAIL"; }, 800);
  });
  form.addEventListener("input", (e) => e.target.closest(".field-in")?.classList.remove("is-error"));
})();
