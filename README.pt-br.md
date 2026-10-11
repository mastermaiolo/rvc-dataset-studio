<div align="center">

# RVC DATASET STUDIO

**Estúdio no Navegador para Medição de Perfil Vocal e Gravação de Datasets para Applio / RVC**

[![Release](https://img.shields.io/badge/release-v0.1.0-AD283B?style=flat-square&labelColor=13161A)](https://github.com/mastermaiolo/rvc-dataset-studio)
[![Licença](https://img.shields.io/badge/licen%C3%A7a-MIT%20%7C%20CC0-E9E5DC?style=flat-square&labelColor=13161A)](LICENSE)
[![Produção](https://img.shields.io/badge/produ%C3%A7%C3%A3o-rvc--dataset--studio.vercel.app-C86D51?style=flat-square&labelColor=13161A)](https://rvc-dataset-studio.vercel.app)
[![Motor de Áudio](https://img.shields.io/badge/motor-%C3%81udioWorklet%20%2B%20YIN-38BDF8?style=flat-square&labelColor=13161A)](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
[![Privacidade](https://img.shields.io/badge/privacidade-100%25%20Local%20(Sem%20Uploads)-10B981?style=flat-square&labelColor=13161A)](docs/GUIA.pt-BR.md#privacidade)
[![Destino](https://img.shields.io/badge/destino-Applio%20%2F%20RVC%20v2-818CF8?style=flat-square&labelColor=13161A)](https://github.com/IAHispano/Applio)

<br/>

[English (UK)](README.md) · **Português (Brasil)** · [Português (Portugal)](README.pt-pt.md) · [Español](README.es-es.md) · [简体中文](README.zh-cn.md)

<br/>

<img src="assets/readme/hero.svg" alt="RVC Dataset Studio Hero Canvas" width="100%"/>

</div>

<br/>

> **Estúdio de gravação e estação de trabalho vocal direto no navegador**: descubra seu perfil vocal, calibre tessituras, equilibre registros vocais e grave datasets limpos e descomprimidos, sob medida para treinar modelos de voz no [**Applio**](https://github.com/IAHispano/Applio) e **RVC**.
>
> 🔒 **Privacidade 100% no Cliente:** Nenhum áudio sai do seu navegador. Sem servidores de backend, sem contas, sem cookies e sem telemetria. Funciona offline como Progressive Web App (PWA).
>
> 🔗 **Deploy em Produção:** [rvc-dataset-studio.vercel.app](https://rvc-dataset-studio.vercel.app)

> [!IMPORTANT]
> **Termo de Ética e Uso Responsável de IA:**
> Grave e clone apenas **a sua própria voz**, ou uma voz para a qual você possua autorização expressa e verificável. Este é um projeto de código aberto independente, sem qualquer afiliação com Applio, RVC, Suno ou serviços comerciais de geração musical.

---

## 01 / Índice de Navegação

- [02 / Visão Geral](#02--visão-geral)
- [03 / Capacidades e Engenharia](#03--capacidades-e-engenharia)
- [04 / Espaços de Trabalho e Demonstração](#04--espaços-de-trabalho-e-demonstração)
- [05 / Superfície de Controle e Ergonomia de Teclado](#05--superfície-de-controle-e-ergonomia-de-teclado)
- [06 / Treinamento Neural e Pipeline no Applio](#06--treinamento-neural-e-pipeline-no-applio)
- [07 / Privacidade e Arquitetura de Armazenamento Local](#07--privacidade-e-arquitetura-de-armazenamento-local)
- [08 / Instalação e Desenvolvimento](#08--instalação-e-desenvolvimento)
- [09 / Arquitetura e Estrutura do Código](#09--arquitetura-e-estrutura-do-código)
- [10 / Resolução de Problemas e Casos Extremos](#10--resolução-de-problemas-e-casos-extremos)
- [11 / Linhagem e Proveniência](#11--linhagem-e-proveniência)

---

## 02 / Visão Geral

Treinar um modelo de voz de alta fidelidade em RVC ou Applio exige áudios consistentes, secos e equilibrados em termos de tessitura e registro vocal. Gravações caseiras improvisadas frequentemente sofrem com reverberação de sala, distorção por clipping digital ou quebras de afinação provocadas por esforço fora da extensão confortável.

O RVC Dataset Studio une a pedagogia vocal à engenharia de machine learning: calibra cada exercício à tessitura medida do cantor, assegura a transição equilibrada na zona de passagem (*passaggio*), realiza controle de qualidade automatizado a cada take e exporta pacotes prontos para treinamento direto no disco.

<br/>

<div align="center">
  <img src="assets/readme/at-a-glance.svg" alt="RVC Dataset Studio Visão Geral" width="100%"/>
</div>

<br/>

### Pilares Arquiteturais Principais

| Pilar Arquitetural | Implementação Técnica | Vantagem Prática no Estúdio |
|---|---|---|
| **Privacidade Total Sem Servidor** | Web Audio API e armazenamento local IndexedDB no navegador | Nenhum áudio trafega pela rede; zero servidores, zero cookies, zero rastreadores |
| **Calibração de Perfil Vocal** | Teste guiado de 30s (extensão, nota confortável, fala e LTAS) | Transpõe automaticamente todos os exercícios para a sua voz (do Baixo ao Soprano) |
| **Equilíbrio de Passaggio e Registros** | Mix alvo: Peito (25–35%), Mista (25–35%), Cabeça (15–25%), Fala (10–20%) | Impede que o modelo de IA esgane, quebre oitavas ou puxe peso de peito nos agudos |
| **Afinador YIN em Tempo Real** | Algoritmo YIN para $f_0$ fundamental com mostrador de $\pm\text{cents}$ | Feedback visual instantâneo de entonação diretamente no prompter durante a gravação |
| **Controle de Qualidade Automático** | Cálculo de voz ativa, proteção contra clipping ($> -1\text{ dBFS}$) e ruído | Rejeita takes defeituosos antes que corrompam o dataset neural |
| **Exportação Pronta para o Applio** | Pacote ZIP com WAVs em 16/24 bits, README e `dataset_info.json` | Hiperparâmetros recomendados (RMVPE, ContentVec, taxa alvo e épocas) |

---

## 03 / Capacidades e Engenharia

<br/>

<div align="center">
  <img src="assets/readme/capabilities.svg" alt="RVC Dataset Studio Capacidades" width="100%"/>
</div>

<br/>

### 1. Registros Vocais, Passaggio e Prevenção de Artefatos Neurais
Modelos neurais de embedding acústico (como o ContentVec) falham ao tentar extrapolar fora dos domínios tímbricos gravados. Se um dataset é composto exclusivamente por voz de peito pesada, sempre que uma música de inferência alcançar a região de transição (*passaggio*, ex.: D4–G4 para vozes masculinas), o modelo RVC forçará o peso de peito para cima. O resultado são artefatos estridentes, anasalamento forçado ou quebras de oitava.

O RVC Dataset Studio equilibra ativamente a distribuição de registros:
- **Voz de Peito (25–35%):** Potência fundamental, calor acústico e corpo da voz.
- **Voz Mista / Passaggio (25–35%):** A ponte essencial sobre a quebra vocal. Crucial para melodias cantadas naturais.
- **Falsete / Voz de Cabeça (15–25%):** Vibração pura das bordas das pregas vocais. Evita que agudos suaves entrem em colapso.
- **Fala Natural (10–20%):** Âncoras de formantes de conversação e articulação fonética clara.

Técnicas vocais incorporadas aos exercícios:
- *Exercícios de Trato Vocal Semi-Ocluído (SOVT):* Sirenes com "ng" e vibrações labiais para equalizar a pressão subglótica.
- *Twang Faríngeo:* Práticas com "Nay" e "Gee" estimulando o fechamento firme das pregas sem sobrecarregar a musculatura.
- *Modificação/Estreitamento Vocálico:* Ajustar vogais abertas para formatos mais arredondados (ex.: "Ah" $\rightarrow$ "Uh/Oh") na aproximação dos agudos.

### 2. Rastreamento de Pitch YIN e Karaokê no Prompter
O estúdio conta com um motor de afinação de alta precisão baseado no **algoritmo YIN**, calculando a frequência fundamental ($f_0$) e a aperiodicidade em tempo real.
- **Indicador de Cents ao Vivo:** Um badge de entonação exibe o desvio em $\pm\text{cents}$ logo acima da letra.
- **Sintetizador de Tom de Referência:** Toca a nota alvo nos fones fechados, permitindo que o cantor encontre a afinação antes do take.
- **Contornos Melódicos Dinâmicos:** Gera guias de afinação para sirenes, glissandos e línguas tonais (como os quatro tons do mandarim).

### 3. Controle de Qualidade por Take e Calibração de Headroom
Antes de iniciar as gravações, um teste de 5 segundos avalia o headroom e o ruído da sala:
- **Detecção de Clipping Digital:** Identifica e alerta sobre picos que ultrapassam $-1\text{ dBFS}$.
- **Piso de Ruído Ambiente:** Exige ambiente silencioso com ruído inferior a $-24\text{ dBFS}$ (idealmente $<-60\text{ dBFS}$).
- **Duração de Voz Ativa:** Valida se o take contém áudio fonado de verdade (e não apenas silêncio).
- **Revisão Instantânea via Teclado:** Pressione **Enter** para aceitar ou **R** para regravar imediatamente.

---

## 04 / Espaços de Trabalho e Demonstração

<br/>

<div align="center">
  <img src="assets/readme/showcase.svg" alt="RVC Dataset Studio Espaços de Trabalho" width="100%"/>
</div>

<br/>

### As 4 Etapas Principais do Fluxo de Gravação

| Painel / Espaço de Trabalho | Função Principal | Recursos Operacionais |
|---|---|---|
| **01 / Teste de Perfil Vocal** | Extensão e consentimento | Teste guiado de 30s (sirene, fala, nota confortável); classificação vocal; seleção de idiomas |
| **02 / Teleprompter do Estúdio** | HUD de gravação sem as mãos | Prompter de karaokê sílaba a sílaba, contagem regressiva ("Prepare-se · Respire"), tom guia e afinador |
| **03 / Revisão e QC do Take** | Cartão de validação de áudio | Reprodução de forma de onda, tempo de voz ativa, nível de pico em dBFS, ruído de fundo, atalhos [Enter] e [R] |
| **04 / Mapa de Extensão do Dataset** | Cobertura e exportação | Distribuição semitom a semitom, proporção de registros, gerador "Minhas letras", exportação ZIP e WAV contínuo |

<br/>

<details>
<summary><strong>Explorar Conteúdo e Pacotes de Idioma (Clique para Expandir)</strong></summary>
<br/>

1. **Banco de Exercícios (`content/`):**
   Ficheiros JSON validados por schemas rigorosos (`schema/`). Contemplam vogais sustentadas, glissandos, saltos intervalares, dicção rápida e transição de registros.
2. **Pacotes de Fonemas e Fala:**
   Inclui pacotes para **Inglês**, **Português (Brasil)**, **Espanhol** e **中文 (Mandarim)** com pinyin e contornos tonais.
3. **Gerador "Minhas Letras":**
   Permite colar trechos de músicas próprias. O app divide as sílabas e cria 4 variações de exercício: fala natural, melodia cantada, articulação rápida e frase sustentada lenta. Tudo fica gravado exclusivamente no `localStorage`.
4. **Manifesto para Applio (`dataset_info.json`):**
   Exportado junto aos WAVs, recomendando taxa de amostragem (40k/48k), extrator RMVPE, alinhamento ContentVec e épocas recomendadas.

</details>

---

## 05 / Superfície de Controle e Ergonomia de Teclado

<br/>

<div align="center">
  <img src="assets/readme/control-surface.svg" alt="RVC Dataset Studio Superfície de Controle" width="100%"/>
</div>

<br/>

### Atalhos de Teclado

Projetados para permitir gravação rápida em pé diante do microfone, sem tocar no mouse:

| Tecla | Ação | Contexto |
|---|---|---|
| <kbd>Espaço</kbd> | **Gravar / Parar Take** | Inicia a contagem ("Prepare-se · Respire") ou encerra a gravação |
| <kbd>Enter</kbd> | **Aceitar Take** | Salva no IndexedDB e avança automaticamente para o próximo exercício |
| <kbd>R</kbd> | **Regravar Take** | Descarta a gravação atual e reinicia o take imediatamente |
| <kbd>T</kbd> | **Tocar Tom de Referência** | Reproduz a nota guia sintetizada nos fones |
| <kbd>M</kbd> | **Silenciar Guia de Áudio** | Liga ou desliga os tons de auxílio sonoro |
| <kbd>←</kbd> / <kbd>→</kbd> | **Exercício Anterior / Seguinte** | Navega livremente pelo banco de exercícios |

### Calibração de Headroom e Ganho

1. Utilize **fones de ouvido fechados** (fones abertos vazam som para o microfone e contaminam o modelo).
2. Posicione-se a **15–20 cm** da cápsula com pop filter.
3. Ajuste o ganho da interface para que os picos mais fortes fiquem entre **$-12\text{ dBFS}$ e $-6\text{ dBFS}$**. Jamais atinja $0\text{ dBFS}$ (clipping).
4. Assegure que o piso de ruído da sala esteja abaixo de **$-60\text{ dBFS}$** (utilize guarda-roupas, cobertores ou cortinas pesadas).

---

## 06 / Treinamento Neural e Pipeline no Applio

Com o dataset exportado, o treinamento no **Applio** ou **RVC** segue este fluxo:

### 1. Organização dos Ficheiros
Descompacte o ZIP diretamente no diretório de datasets do Applio:
```
Applio/
└── assets/
    └── datasets/
        └── NomeDaSuaVoz/      # Utilize apenas caracteres ASCII (sem espaços ou acentos)
            ├── take_001.wav
            ├── take_002.wav
            ├── dataset_info.json
            └── README.md
```

### 2. Preprocess (Pré-processamento)
- Escolha a taxa de amostragem idêntica à do modelo pré-treinado (**40 kHz** ou **48 kHz**).
- Mantenha o **corte automático ativado**. O Applio refatia os áudios em blocos curtos, logo a duração de cada take foi calculada apenas para o seu conforto respiratório.

### 3. Extract (Extração de Características)
- **Extrator de Pitch ($f_0$):** Selecione `rmvpe`. É dele que provém a fidelidade melódica.
- **Embedder:** Selecione `contentvec`. O mesmo embedder utilizado no treino deve ser obrigatoriamente utilizado na inferência.

### 4. Train (Treinamento)
- Salve um checkpoint a cada **10–50 épocas**.
- **Avalie os Checkpoints de Ouvido:** Não confie cegamente em curvas de loss ou contagens fixas de épocas. Converta uma mesma frase de teste em vários checkpoints e selecione aquele com timbre mais natural e menor quantidade de artefatos.
- Construa o índice (Index) após o término.

### 5. Parâmetros Essenciais de Conversão (Inferência)

| Parâmetro | Função &amp; Configuração Recomendada |
|---|---|
| **Pitch Shift** | Transpõe o áudio de entrada para a *sua* extensão vocal natural. |
| **Pitch Extractor** | Mantenha `rmvpe` para estabilidade vocal tanto em fala quanto em canto. |
| **Index Rate** | Controla a força com que o índice puxa o timbre para a sua voz ($0,60–0,85$). Não altera a melodia. |
| **Protect** | Protege consoantes surdas e respirações ($0,20–0,33$). Quanto menor o valor, maior a proteção; $0,50$ desliga a proteção. |
| **Formant Shift** | Quefrency e Timbre começam em **1,0**. Ajuste sutilmente ($0,95–1,05$) apenas se necessário. |

---

## 07 / Privacidade e Arquitetura de Armazenamento Local

O RVC Dataset Studio segue princípios rigorosos de retenção zero:

- **Buffers de Áudio:** Processados na memória RAM via `AudioWorklet`. Armazenados localmente no `IndexedDB` do navegador em formato WAV puro.
- **Zero Tráfego para Servidores:** Nenhum áudio, metadado ou letra é transmitido para a nuvem.
- **Preferências Locais:** Ajustes de extensão e letras personalizadas ficam no `localStorage`.
- **Progressive Web App (PWA) Offline:** Após a primeira visita, todos os recursos estáticos são cacheados pelo Service Worker, permitindo gravação em cabines isoladas e sem internet.
- **Conformidade Legal:** Desenvolvido em conformidade estrita com o **RGPD Art. 6(1)(a)** e a **LGPD**.

---

## 08 / Instalação e Desenvolvimento

### Pré-requisitos

- **Node.js:** $\ge 20.0$
- **Gerenciador de Pacotes:** `npm` (padrão)
- **Navegador Moderno:** Chrome, Edge, Firefox ou Safari (Desktop e iOS). O acesso ao microfone exige HTTPS ou `localhost`.

### Instalação Local

```bash
# Clonar o repositório
git clone https://github.com/mastermaiolo/rvc-dataset-studio.git
cd rvc-dataset-studio

# Instalar dependências
npm install

# Iniciar servidor local de desenvolvimento (http://localhost:5173)
npm run dev

# Executar validação completa (lint + tipos + schemas + testes + build)
npm run check
```

### Scripts Disponíveis

| Script | Finalidade |
|---|---|
| `npm run dev` | Inicia o servidor Vite com hot reload |
| `npm run typecheck` | Validação estática de tipos com TypeScript |
| `npm run lint` | Verificação de código com ESLint |
| `npm test` | Executa testes do Vitest com sinais de áudio sintéticos |
| `npm run validate:content` | Valida arquivos JSON de exercícios contra schemas |
| `npm run build` | Compila o build estático otimizado em `dist/` |

### Deploy em Produção

O estúdio está publicado como aplicação web totalmente estática na Vercel em [**rvc-dataset-studio.vercel.app**](https://rvc-dataset-studio.vercel.app).

- **Hospedagem &amp; Build:** CI/CD automatizado na [Vercel](https://vercel.com) (`build: npm run build`, saída em `dist`).
- **Segurança &amp; Cabeçalhos (`vercel.json`):** Aplica Content-Security-Policy (CSP) estrita, `Permissions-Policy: microphone=(self)`, HSTS e desativa cache no service worker.

---

## 09 / Arquitetura e Estrutura do Código

<br/>

<div align="center">
  <img src="assets/readme/architecture.svg" alt="RVC Dataset Studio Arquitetura" width="100%"/>
</div>

<br/>

### Estrutura de Pastas

```
rvc-dataset-studio/
├── content/                   # Banco de exercícios e idiomas (CC0 1.0)
│   ├── en/                    # Exercícios em inglês
│   ├── pt-BR/                 # Exercícios em português brasileiro
│   ├── es/                    # Exercícios em espanhol
│   └── zh/                    # Exercícios em mandarim (com pinyin e contornos)
├── schema/                    # Schemas JSON para validação de conteúdo
├── docs/                      # Documentação técnica e guias de suporte
│   ├── GUIDE.md               # Guia técnico em inglês
│   ├── GUIA.pt-BR.md          # Guia técnico em português
│   ├── BROWSER_TESTING.md     # Notas de compatibilidade de AudioWorklet
│   └── LANGUAGE_PACKS.md      # Instruções para adicionar novos idiomas
├── src/
│   ├── audio/                 # AudioContext, AudioWorklet e sintetizador guia
│   ├── analysis/              # Detector YIN, VAD, LTAS/FFT, QC de takes e mapa de extensão
│   ├── bank/                  # Tipos de exercícios e posicionamento na extensão
│   ├── lyrics/                # "Minhas letras": silabação e gerador de exercícios
│   ├── storage/               # IndexedDB (áudios) e localStorage (configurações)
│   ├── export/                # Exportador ZIP no cliente (fflate) e WAV contínuo
│   ├── i18n/                  # Textos da interface (en = referência, pt-BR)
│   └── ui/                    # Componentes reativos Preact e Signals
├── scripts/                   # Scripts de validação de schemas e build
├── tests/                     # Testes Vitest (pitch sintético, VAD, WAV, ZIP)
├── public/                    # Ícones e manifesto PWA
├── vercel.json                # Cabeçalhos de segurança (CSP, Permissions-Policy)
└── assets/
    └── readme/                # Recursos gráficos vetoriais modulares SVG
```

---

## 10 / Resolução de Problemas e Casos Extremos

<br/>

<div align="center">
  <img src="assets/readme/failure-modes.svg" alt="RVC Dataset Studio Resolução de Problemas" width="100%"/>
</div>

<br/>

### Casos Extremos e Ações de Contenção

<details>
<summary><strong>1. Degradação por Clipping Digital (&gt; -1 dBFS)</strong></summary>
<br/>

Picos que ultrapassam $-1\text{ dBFS}$ achatam a forma de onda. Extratores neurais como o ContentVec incorporam essa distorção harmônica ao modelo de voz. Realize o teste de 5 segundos de headroom e mantenha os picos mais fortes entre $-12$ e $-6\text{ dBFS}$.

</details>

<details>
<summary><strong>2. Armadilha de DSP e "Aprimoramentos de Microfone" do Sistema</strong></summary>
<br/>

Recursos de "clareamento de voz" de sistemas operacionais e navegadores (cancelamento de eco, supressão de ruído e ganho automático) mutilam formantes vocais, atenuam consoantes e provocam cancelamento de fase robótico. O estúdio solicita áudio puro via restrições do `getUserMedia`. Se o navegador forçar DSP, um alerta é exibido. Desative todos os aprimoramentos de áudio no seu sistema operacional.

</details>

<details>
<summary><strong>3. Vazamento de Fones Abertos Contaminando o Dataset</strong></summary>
<br/>

Se o tom de referência vazar de fones de ouvido semi-abertos para o microfone, o modelo aprenderá a reproduzir um tom senoidal de fundo ao cantar aquelas notas. Utilize sempre fones de ouvido fechados e mantenha o volume de monitoramento moderado.

</details>

<details>
<summary><strong>4. Esforço Vocal no Passaggio e Quebras de Oitava</strong></summary>
<br/>

Puxar a voz de peito para além do ponto natural de transição provoca quebras e timbre estridente no modelo treinado. Utilize os exercícios com SOVT (sons em "ng") e estreitamento vocálico (modificar "Ah" para "Uh/Oh") para transitar de forma suave para a voz mista.

</details>

---

## 11 / Linhagem e Proveniência

<br/>

<div align="center">
  <img src="assets/readme/provenance.svg" alt="RVC Dataset Studio Proveniência" width="100%"/>
</div>

<br/>

### Origem e Ecosistema

- **Engenharia Acústica e Neural:** Master Maiolo · MAIOLO / SYSTEMS LAB.
- **Deploy em Produção:** [rvc-dataset-studio.vercel.app](https://rvc-dataset-studio.vercel.app).
- **Compatibilidade:** Compatível com Applio, RVC v2, SoftVC e ferramentas abertas de clonagem de voz.
- **Projeto Independente:** Sem vínculo comercial com Applio, RVC, Suno ou terceiros.

### Licenciamento

- **Código-Fonte do Aplicativo:** [Licença MIT](LICENSE).
- **Conteúdo dos Exercícios e Schemas (`content/`, `schema/`):** [CC0 1.0 Universal (Domínio Público)](content/LICENSE).
- **Fontes Incluídas:** SIL Open Font License 1.1.

---

<div align="center">
<sub>MAIOLO / SYSTEMS LAB · RVC DATASET STUDIO · ESTAÇÃO VOCAL NO NAVEGADOR</sub>
</div>
