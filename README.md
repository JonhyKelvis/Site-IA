# MotionLab — Motion Control 9:16 e 16:9

Site para **transferir o movimento de um vídeo de referência para uma imagem de referência** (motion
control). Você envia um vídeo (o movimento), uma imagem (o personagem) e escolhe a proporção final —
**9:16**, **16:9**, 1:1, 4:5 ou a proporção original do vídeo.

O site é um app **React + Vite** com **funções serverless na Vercel**, usando os modelos da
[fal.ai](https://fal.ai):

| Modelo | Tempo máximo de referência | Preço (fal.ai) |
| --- | --- | --- |
| **Kling 3.0 Pro** — `fal-ai/kling-video/v3/pro/motion-control` | 30 s (10 s se "seguir imagem") | US$ 0,168/s |
| **Kling 3.0 Standard** — `fal-ai/kling-video/v3/standard/motion-control` | 30 s (10 s se "seguir imagem") | US$ 0,126/s |
| **Wan 2.2 Animate** — `fal-ai/wan/v2.2-14b/animate/move` | até 120 s | US$ 0,154/s |

## O que já está pronto

- Upload de **vídeo até 200 MB** e **imagem até 15 MB** — o arquivo vai **direto do navegador para o
  CDN da fal.ai** com URL assinada pelo servidor, então não esbarra no limite de ~4,5 MB das funções
  serverless.
- Leitura do vídeo no navegador: duração, resolução, fps estimado e poster (primeiro quadro).
- Prévia do enquadramento final (9:16 / 16:9 / …) com a imagem e um recorte animado do vídeo.
- **Ajuste automático do vídeo de referência**: se ele for maior que o limite do modelo, é cortado;
  se a proporção for diferente da escolhida, é reenquadrado (recorte central); se você pedir "sem
  áudio", a trilha é removida — tudo feito no navegador, antes do envio.
- Fila com progresso em tempo real (posição na fila + logs do modelo).
- Resultado com player e **botão de download** (o download passa por uma função do próprio site, para
  não esbarrar em CORS).
- Histórico da sessão no `localStorage` + retomada do progresso se você recarregar a página.
- Código de acesso opcional (`SITE_ACCESS_CODE`) para proteger seus créditos.
- A **chave da API nunca chega ao navegador**: só as funções em `/api` falam com a fal.ai.

---

## Passo a passo para publicar (GitHub + Vercel)

### 0. O que você precisa ter

- Uma conta no **GitHub** (a sua já tem o repositório `JonhyKelvis/Site-IA`).
- Uma conta na **fal.ai** com crédito — crie em <https://fal.ai> → *Add funds* (US$ 5 já geram
  bastante vídeo, veja a tabela de custos abaixo).
- Uma conta na **Vercel** (grátis) — é ela que transforma o código em um link público
  `https://algo.vercel.app`. **GitHub Pages não funciona aqui**, porque o site precisa de um servidor
  (as funções `/api`) para guardar a chave da API. Na Vercel todo o processo é feito clicando, sem
  instalar nada.

### 1. Crie a sua chave da fal.ai

1. Entre em <https://fal.ai/dashboard/keys>.
2. Clique em **Add key** (+), dê um nome (ex.: `motionlab`) e confirme.
3. **Copie a chave** — ela começa com algo como `xxxxxxxx-xxxx-...:yyyy...` (você só vê uma vez).
   Guarde em um lugar seguro; ela é o que permite gerar vídeos.

### 2. Publique o site na Vercel (só cliques)

1. Acesse <https://vercel.com/new> e faça login **com a conta do GitHub**.
2. Em *Import Git Repository*, escolha **`JonhyKelvis/Site-IA`** (se não aparecer, clique em
   *Adjust GitHub App Permissions* e autorize o repositório).
3. Na tela de configuração:
   - **Framework Preset**: `Vite` (a Vercel já detecta sozinha).
   - **Root Directory**: deixe vazio (o projeto está na raiz).
   - **Build Command**: `npm run build` · **Output Directory**: `dist` (preenchido automaticamente).
4. Abra **Environment Variables** e adicione:

   | Name | Value | Obrigatória |
   | --- | --- | --- |
   | `FAL_KEY` | a chave que você copiou no passo 1 | **Sim** |
   | `SITE_ACCESS_CODE` | um código seu, ex.: `estudio2026` | Não (recomendada) |

5. Clique em **Deploy** e espere ~1 minuto.
6. A Vercel mostra o link do site, algo como **`https://site-ia.vercel.app`**. É esse link que você
   abre no celular e no computador. (Em *Settings → Domains* você pode apontar um domínio próprio.)

> Toda vez que você der `git push` na branch principal, a Vercel publica a nova versão
> automaticamente. Para trocar a chave da API depois: *Settings → Environment Variables* → edite
> `FAL_KEY` → *Deployments* → *Redeploy*.

### 3. Use o site

1. Abra o link (se você configurou `SITE_ACCESS_CODE`, digite o código).
2. **Passo 1 — vídeo de referência**: envie o vídeo com o movimento (MP4/MOV, até 200 MB). O site
   mostra duração, resolução e fps.
3. **Passo 2 — imagem de referência**: envie a foto/personagem (JPG/PNG/WEBP, até 15 MB).
4. **Passo 3 — formato e modelo**: escolha **9:16** ou **16:9**, o modelo, a orientação e o áudio.
5. Clique em **Gerar vídeo de motion control** e acompanhe a fila. Quando terminar, use **Baixar
   vídeo**.

---

## Dicas para um bom resultado

- **Uma pessoa por cena**: o modelo aplica o movimento na maior pessoa do quadro.
- **Corpo inteiro ou meio corpo** no vídeo e na imagem, com o rosto visível e sem objetos na frente.
- **Boa luz** e imagem nítida nos dois arquivos.
- Se o resultado **cortar a cabeça**, troque a orientação para *"Seguir imagem"* (limite de 10 s) ou
  use a imagem na mesma proporção do vídeo.
- O **áudio** só vem no resultado do Kling (opção "manter áudio"). O Wan 2.2 Animate devolve o vídeo
  sem som.
- Vídeos de referência de **5 a 10 segundos** costumam ser o melhor custo/benefício.

## Custos aproximados (pagos direto à fal.ai, por segundo gerado)

| Duração da referência | Kling Standard | Kling Pro | Wan 2.2 (720p) |
| --- | --- | --- | --- |
| 5 s | US$ 0,63 | US$ 0,84 | US$ 0,77 |
| 10 s | US$ 1,26 | US$ 1,68 | US$ 1,54 |
| 30 s | US$ 3,78 | US$ 5,04 | US$ 4,62 |

O site mostra uma **estimativa de custo** antes de você clicar em gerar.

---

## Códigos de erro mais comuns da fal.ai

| Mensagem | O que fazer |
| --- | --- |
| `Duration limit depends on character_orientation` | Vídeo com mais de 30 s (ou mais de 10 s com "seguir imagem"). O site já corta automaticamente — se aparecer, envie um vídeo menor. |
| `image_url` / `video_url` inválidos | O upload não terminou. Gere de novo e aguarde a barra de progresso chegar a 100%. |
| `file too large` | Acima de 200 MB. Comprima o vídeo (o limite dos modelos é 200 MB; recomendado ≤ 720p). |
| `No person detected` / rosto não encontrado | Use uma imagem com uma pessoa de corpo inteiro ou meio corpo, rosto visível e sem oclusão. |
| `IN_QUEUE` por muitos minutos | Fila do modelo cheia em horário de pico. O progresso fica salvo em `?job=...`; pode fechar a página e voltar. |

## Rodar no seu computador (opcional)

```bash
git clone https://github.com/JonhyKelvis/Site-IA.git
cd Site-IA
npm install
cp .env.example .env      # e coloque sua FAL_KEY dentro do .env
npm run dev               # http://localhost:5173
```

O dev server já expõe as mesmas rotas `/api/*` da Vercel (`server/api.ts`), então o comportamento é
idêntico ao de produção.

## Estrutura

```
api/                  funções serverless da Vercel (uma por rota)
  session.ts          diz se o site pede código e lista os modelos
  login.ts            valida o código de acesso e devolve um token assinado
  upload-init.ts      assina o upload direto para o CDN da fal.ai
  run.ts              dispara a geração na fila da fal.ai
  status.ts           consulta a fila e devolve a URL do vídeo
  download.ts         baixa o vídeo (evita CORS no botão de download)
server/
  api.ts              núcleo das rotas (usado pela Vercel e pelo dev server)
  vercel-adapter.ts   adapta req/res do Node para Request/Response
src/
  App.tsx             fluxo completo da interface
  components/         dropzones, seletor de proporção, painel de fila, resultado…
  lib/api.ts          cliente das rotas /api
  lib/media.ts        análise do vídeo, reenquadramento e remoção de áudio no navegador
  lib/upload.ts       upload com progresso real (XHR) para o CDN
```

## Privacidade e segurança

- `FAL_KEY` e `SITE_ACCESS_CODE` ficam **somente** nas variáveis de ambiente do servidor.
- O navegador recebe apenas **URLs de upload assinadas** e tokens temporários (HMAC, 1 h).
- Nada é gravado em banco de dados: o histórico vive no seu próprio navegador.
- Os arquivos enviados ficam no CDN da fal.ai (públicos por URL, como em qualquer upload da
  plataforma) e podem ser removidos por lá.

## Problemas comuns

| Sintoma | Causa provável | Solução |
| --- | --- | --- |
| "Não foi possível falar com o servidor" / erro 404 nas rotas `/api` | O site foi publicado como estático (GitHub Pages) ou a pasta `api/` não subiu | Publique na Vercel com a pasta `api/` na raiz |
| "FAL_KEY não configurada no servidor" | Variável ausente | *Settings → Environment Variables* → `FAL_KEY` → *Redeploy* |
| Erro 401 da fal.ai | Chave inválida ou sem crédito | Gere outra chave / adicione crédito na fal.ai |
| "Formato não suportado" | Vídeo em HEVC/MKV etc. | Converta para MP4 (H.264) |
| Vídeo enviado fica "Na fila" por muito tempo | Fila do modelo cheia | Aguarde; o progresso fica salvo na URL (`?job=...`) |
