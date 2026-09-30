# Site IMar Júnior

Site institucional da **IMar Júnior — Consultoria e Projetos**, Empresa Júnior do Instituto do Mar da Unifesp (Baixada Santista).

Site estático (HTML + CSS + JS puro), sem etapa de build.

## Rodar localmente

```bash
python3 -m http.server 8000
# abra http://localhost:8000
```

## Estrutura

```
index.html            # todas as seções da página
assets/css/style.css  # estilos (tokens de cor no topo, em :root)
assets/js/main.js     # animações e interações
assets/img/           # logo e fotos (extraídas do portfólio 2026)
```

## Elementos do mar

- **Hero**: superfície do oceano em malha de pontos (canvas), reage ao mouse.
- **Medidor de profundidade** no header: a página é um mergulho de 0 a 5.000 m, passando pelas zonas pelágicas; o fundo escurece conforme você desce.
- **Neve marinha** e partículas bioluminescentes que aumentam com a profundidade.
- **Sonar** no painel de serviços.

## Publicar

Funciona direto no GitHub Pages (Settings → Pages → branch `main`, pasta `/`).
