<div align="center">

# RVC DATASET STUDIO

**Estúdio no Navegador para Medição de Perfil Vocal e Gravação de Datasets para Applio / RVC**

[![Release](https://img.shields.io/badge/release-v0.1.0-AD283B?style=flat-square&labelColor=13161A)](https://github.com/mastermaiolo/rvc-dataset-studio)
[![Licença](https://img.shields.io/badge/licen%C3%A7a-MIT%20%7C%20CC0-E9E5DC?style=flat-square&labelColor=13161A)](LICENSE)
[![Produção](https://img.shields.io/badge/produ%C3%A7%C3%A3o-rvc--dataset--studio.vercel.app-C86D51?style=flat-square&labelColor=13161A)](https://rvc-dataset-studio.vercel.app)
[![Motor de Áudio](https://img.shields.io/badge/motor-%C3%81udioWorklet%20%2B%20YIN-38BDF8?style=flat-square&labelColor=13161A)](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
[![Privacidade](https://img.shields.io/badge/privacidade-100%25%20Local%20(Sem%20Uploads)-10B981?style=flat-square&labelColor=13161A)](docs/GUIDE.md#privacy)
[![Destino](https://img.shields.io/badge/destino-Applio%20%2F%20RVC%20v2-818CF8?style=flat-square&labelColor=13161A)](https://github.com/IAHispano/Applio)

<br/>

[English (UK)](README.md) · [Português (Brasil)](README.pt-br.md) · **Português (Portugal)** · [Español](README.es-es.md) · [简体中文](README.zh-cn.md)

<br/>

<img src="assets/readme/hero.svg" alt="RVC Dataset Studio Hero Canvas" width="100%"/>

</div>

<br/>

> **Estúdio de gravação e estação de análise vocal integralmente no navegador**: meça o seu perfil vocal, calibre tessituras, equilibre registos vocais e grave datasets limpos e sem compressão, desenhados para o treino de modelos de voz no [**Applio**](https://github.com/IAHispano/Applio) e **RVC**.
>
> 🔒 **Privacidade 100% no Cliente:** Nenhum ficheiro de áudio sai do seu navegador. Sem servidores remotos, sem contas, sem cookies e sem telemetria. Funciona offline como Progressive Web App (PWA).
>
> 🔗 **Deploy em Produção:** [rvc-dataset-studio.vercel.app](https://rvc-dataset-studio.vercel.app)

> [!IMPORTANT]
> **Carta de Ética e Uso Responsável de IA:**
> Grave e clone apenas **a sua própria voz**, ou uma voz para a qual disponha de autorização expressa e comprovável. Este é um projeto de código aberto independente, sem ligação comercial ao Applio, RVC, Suno ou outras plataformas de síntese musical.

---

## 01 / Índice de Navegação

- [02 / Visão Geral](#02--visão-geral)
- [03 / Capacidades e Engenharia](#03--capacidades-e-engenharia)
- [04 / Espaços de Trabalho e Demonstração](#04--espaços-de-trabalho-e-demonstração)
- [05 / Superfície de Controlo e Ergonomia de Teclado](#05--superfície-de-controlo-e-ergonomia-de-teclado)
- [06 / Treino Neural e Pipeline no Applio](#06--treino-neural-e-pipeline-no-applio)
- [07 / Privacidade e Arquitetura de Armazenamento Local](#07--privacidade-e-arquitetura-de-armazenamento-local)
- [08 / Instalação e Desenvolvimento](#08--instalação-e-desenvolvimento)
- [09 / Arquitetura e Estrutura do Código](#09--arquitetura-e-estrutura-do-código)
- [10 / Resolução de Problemas e Casos Extremos](#10--resolução-de-problemas-e-casos-extremos)
- [11 / Linhagem e Proveniência](#11--linhagem-e-proveniência)

---

## 02 / Visão Geral

Treinar um modelo neural de conversão de voz em RVC ou Applio exige áudios consistentes, secos e equilibrados em termos de tessitura e registo vocal. Gravações domésticas improvisadas sofrem com frequência de reverberação de sala, distorção por saturação digital (*clipping*) ou quebras de afinação provocadas por esforço fora da extensão confortável.

O RVC Dataset Studio combina a pedagogia vocal com a engenharia de machine learning: calibra cada exercício à tessitura medida do cantor, assegura a transição equilibrada na zona de passagem (*passaggio*), realiza controlo de qualidade automático a cada take e exporta pacotes prontos para treino diretamente para o disco.

<br/>

<div align="center">
  <img src="assets/readme/at-a-glance.svg" alt="RVC Dataset Studio Visão Geral" width="100%"/>
</div>

<br/>

### Pilares Arquiteturais Principais

| Pilar Arquitetural | Implementação Técnica | Vantagem Prática no Estúdio |
|---|---|---|
| **Privacidade Total no Cliente** | Web Audio API e armazenamento local IndexedDB no navegador | Nenhum ficheiro de áudio sai da máquina; zero servidores, zero telemetria |
| **Calibração de Perfil Vocal** | Teste guiado de 30s (extensão, nota confortável, fala e LTAS) | Transpõe automaticamente todos os exercícios para a sua voz (do Baixo ao Soprano) |
| **Equilíbrio de Passaggio e Registos** | Proporção ideal: Peito (25–35%), Mista (25–35%), Cabeça (15–25%), Fala (10–20%) | Impede que o modelo de IA quebre oitavas ou arraste peso de peito nos agudos |
| **Afinador YIN em Tempo Real** | Algoritmo YIN para $f_0$ fundamental com mostrador de $\pm\text{cents}$ | Feedback visual instantâneo de entoação diretamente no prompter durante o take |
| **Controlo de Qualidade Automático** | Deteção de voz ativa, proteção contra saturação ($> -1\text{ dBFS}$) e ruído | Rejeita takes defeituosos antes que corrompam o modelo neural |
| **Exportação Pronta para o Applio** | Pacote ZIP com WAVs em 16/24 bits, README e `dataset_info.json` | Hiperparâmetros recomendados (RMVPE, ContentVec, taxa alvo e épocas) |

---

## 03 / Capacidades e Engenharia

<br/>

<div align="center">
  <img src="assets/readme/capabilities.svg" alt="RVC Dataset Studio Capacidades" width="100%"/>
</div>

<br/>

### 1. Registos Vocais, Passaggio e Prevenção de Artefactos
Modelos neurais de embedding acústico (como o ContentVec) falham quando forçados a extrapolar fora dos domínios tímbricos gravados. Se um dataset for constituído unicamente por voz de peito pesada, sempre que uma melodia de inferência subir para a região de transição (*passaggio*, ex.: D4–G4 para vozes masculinas), o modelo RVC puxará o peso de peito para cima, originando artefactos estridentes, anasalamento artificial ou quebras de oitava.

O RVC Dataset Studio equilibra a distribuição de registos:
- **Voz de Peito (25–35%):** Potência acústica, calor tímbrico e corpo fundamental da voz.
- **Voz Mista / Passaggio (25–35%):** A ponte essencial sobre a quebra vocal. Crucial para melodias cantadas naturais.
- **Falsete / Voz de Cabeça (15–25%):** Vibração pura das arestas das cordas vocais. Evita o colapso de notas agudas suaves.
- **Fala Natural (10–20%):** Âncoras de formantes de conversação e articulação fonética nítida.

Técnicas vocais incorporadas nos exercícios:
- *Exercícios de Trato Vocal Semi-Ocluído (SOVT):* Sirenes com "ng" e vibrações labiais para equilibrar a pressão subglótica.
- *Twang Faríngeo:* Práticas com "Nay" e "Gee" estimulando o fecho nítido das cordas vocais sem arrastar massa muscular excessiva.
- *Modificação/Estreitamento Vocálico:* Arredondamento de vogais abertas (ex.: "Ah" $\rightarrow$ "Uh/Oh") na aproximação dos agudos.

### 2. Deteção de Pitch YIN e Karaokê no Prompter
O estúdio dispõe de um motor de afinação de alta precisão baseado no **algoritmo YIN**, calculando a frequência fundamental ($f_0$) e a aperiodicidade em tempo real.
- **Indicador de Cents em Tempo Real:** Um mostrador de entoação apresenta o desvio em $\pm\text{cents}$ sobre a letra.
- **Sintetizador de Tom de Referência:** Emite a nota alvo nos auscultadores fechados, permitindo afinar a voz antes do take.
- **Contornos Melódicos Dinâmicos:** Gera guias para sirenes, glissandos e línguas tonais (como os quatro tons do mandarim).

### 3. Controlo de Qualidade por Take e Calibração de Margem (*Headroom*)
Antes de iniciar as gravações, um teste de 5 segundos avalia o ruído e a margem de entrada:
- **Deteção de Saturação Digital:** Identifica picos que ultrapassam $-1\text{ dBFS}$.
- **Piso de Ruído Ambiente:** Exige ambiente silencioso com ruído inferior a $-24\text{ dBFS}$ (preferencialmente $<-60\text{ dBFS}$).
- **Duração de Voz Ativa:** Confirma que o take possui áudio cantado ou falado real.
- **Revisão Instantânea via Teclado:** Pressione **Enter** para aceitar ou **R** para regravar de imediato.

---

## 04 / Espaços de Trabalho e Demonstração

<br/>

<div align="center">
  <img src="assets/readme/showcase.svg" alt="RVC Dataset Studio Espaços de Trabalho" width="100%"/>
</div>

<br/>

### As 4 Fases Principais do Fluxo de Gravação

| Painel / Espaço de Trabalho | Função Principal | Recursos Operacionais |
|---|---|---|
| **01 / Teste de Perfil Vocal** | Extensão e consentimento | Teste guiado de 30s (sirene, fala, nota confortável); classificação vocal; seleção de línguas |
| **02 / Teleprompter do Estúdio** | HUD de gravação mãos-livres | Prompter com karaokê sílaba a sílaba, contagem decrescente ("Prepare-se · Respire"), tom guia e afinador |
| **03 / Revisão e QC do Take** | Validação de áudio | Forma de onda, tempo de voz ativa, nível de pico em dBFS, ruído de fundo, atalhos [Enter] e [R] |
| **04 / Mapa de Extensão do Dataset** | Cobertura e exportação | Distribuição semitom a semitom, proporção de registos, gerador "Minhas letras", exportação ZIP e WAV contínuo |

<br/>

<details>
<summary><strong>Explorar Conteúdo e Pacotes de Idioma (Carregar para Expandir)</strong></summary>
<br/>

1. **Banco de Exercícios (`content/`):**
   Ficheiros JSON validados por schemas rigorosos (`schema/`). Abrangem vogais sustentadas, glissandos, intervalos melódicos, dicção rápida e transição de registos.
2. **Pacotes de Fonemas e Fala:**
   Inclui pacotes para **Inglês**, **Português (Brasil)**, **Espanhol** e **中文 (Mandarim)** com pinyin e contornos tonais.
3. **Gerador "Minhas Letras":**
   Permite colar estrofes de músicas próprias. O sistema divide as sílabas e cria 4 variações de exercício: fala natural, melodia cantada, articulação rápida e frase sustentada lenta. Tudo fica gravado exclusivamente no `localStorage`.
4. **Manifesto para o Applio (`dataset_info.json`):**
   Exportado juntamente com os WAVs, recomendando taxa de amostragem (40k/48k), extrator RMVPE, alinhamento ContentVec e épocas recomendadas.

</details>

---

## 05 / Superfície de Controlo e Ergonomia de Teclado

<br/>

<div align="center">
  <img src="assets/readme/control-surface.svg" alt="RVC Dataset Studio Superfície de Controlo" width="100%"/>
</div>

<br/>

### Atalhos de Teclado

Desenhados para gravação em pé à frente do microfone, sem necessidade de tocar no rato:

| Tecla | Ação | Contexto |
|---|---|---|
| <kbd>Espaço</kbd> | **Gravar / Parar Take** | Inicia a contagem ("Prepare-se · Respire") ou encerra a gravação |
| <kbd>Enter</kbd> | **Aceitar Take** | Guarda no IndexedDB e avança automaticamente para o exercício seguinte |
| <kbd>R</kbd> | **Regravar Take** | Elimina a gravação atual e reinicia o take de imediato |
| <kbd>T</kbd> | **Tocar Tom de Referência** | Reproduz a nota guia sintetizada nos auscultadores |
| <kbd>M</kbd> | **Silenciar Guia de Áudio** | Liga ou desliga os tons auxiliares |
| <kbd>←</kbd> / <kbd>→</kbd> | **Exercício Anterior / Seguinte** | Navega livremente pelo banco de exercícios |

### Calibração de Margem de Entrada (*Headroom*)

1. Utilize **auscultadores fechados** (auscultadores abertos vazam áudio para o microfone, corrompendo o treino).
2. Posicione-se a **15–20 cm** do microfone com filtro antipop.
3. Ajuste o ganho da interface para que os picos mais fortes fiquem entre **$-12\text{ dBFS}$ e $-6\text{ dBFS}$**. Evite a todo o custo os $0\text{ dBFS}$ (saturação digital).
4. Assegure que o piso de ruído da sala permanece abaixo de **$-60\text{ dBFS}$** (utilize cortinados pesados, cobertores ou roupeiros).

---

## 06 / Treino Neural e Pipeline no Applio

Com o dataset exportado, o treino no **Applio** ou **RVC** segue esta estrutura:

### 1. Organização dos Ficheiros
Descomprima o ZIP diretamente na pasta de datasets do Applio:
```
Applio/
└── assets/
    └── datasets/
        └── NomeDaSuaVoz/      # Utilize apenas carateres ASCII (sem espaços ou acentos)
            ├── take_001.wav
            ├── take_002.wav
            ├── dataset_info.json
            └── README.md
```

### 2. Preprocess (Pré-processamento)
- Escolha a taxa de amostragem do modelo pré-treinado (**40 kHz** ou **48 kHz**).
- Mantenha o **corte automático ativado**. O Applio fatia novamente os ficheiros em fragmentos curtos; a duração de cada take foi desenhada apenas para o seu conforto respiratório.

### 3. Extract (Extração de Características)
- **Extrator de Pitch ($f_0$):** Selecione `rmvpe`. É deste algoritmo que deriva a precisão melódica.
- **Embedder:** Selecione `contentvec`. O mesmo embedder utilizado no treino tem de ser obrigatoriamente utilizado na inferência.

### 4. Train (Treino do Modelo)
- Guarde um checkpoint a cada **10–50 épocas**.
- **Avalie os Checkpoints de Ouvido:** Não confie unicamente em curvas de loss ou contagens teóricas de épocas. Converta uma frase de teste em vários checkpoints e escolha o que demonstrar timbre mais autêntico com menos artefactos.
- Crie o ficheiro de índice (Index) após a conclusão.

### 5. Parâmetros Essenciais de Conversão (Inferência)

| Parâmetro | Função &amp; Configuração Recomendada |
|---|---|
| **Pitch Shift** | Transpõe o áudio original para a *sua* tessitura vocal natural. |
| **Pitch Extractor** | Mantenha `rmvpe` para estabilidade melódica tanto em fala como em canto. |
| **Index Rate** | Determina a força com que o índice puxa o timbre para a sua voz ($0,60–0,85$). Não controla a melodia. |
| **Protect** | Protege consoantes surdas e respirações ($0,20–0,33$). Quanto mais baixo o valor, maior a proteção; $0,50$ desliga a proteção. |
| **Formant Shift** | Quefrency e Timbre começam em **1,0**. Ajuste suavemente ($0,95–1,05$) se a escala do trato vocal necessitar de afinação. |

---

## 07 / Privacidade e Arquitetura de Armazenamento Local

O RVC Dataset Studio assenta numa política estrita de retenção zero:

- **Buffers de Áudio:** Processados na memória RAM via `AudioWorklet`. Gravados localmente no `IndexedDB` do navegador em formato WAV puro.
- **Zero Comunicação com Servidores:** Nenhum áudio, metadado ou letra é enviado para a nuvem.
- **Definições Locais:** Opções de extensão e letras personalizadas residem no `localStorage`.
- **Progressive Web App (PWA) Offline:** Após o primeiro acesso, todos os recursos estáticos ficam em cache via Service Worker, permitindo gravação em cabines sem ligação à Internet.
- **Conformidade:** Cumpre escrupulosamente os requisitos do **RGPD Artigo 6(1)(a)**.

---

## 08 / Instalação e Desenvolvimento

### Requisitos Prévios

- **Node.js:** $\ge 20.0$
- **Gestor de Pacotes:** `npm` (predefinido)
- **Navegador Moderno:** Chrome, Edge, Firefox ou Safari (Desktop e iOS). O acesso ao microfone requer HTTPS ou `localhost`.

### Instalação Local

```bash
# Clonar o repositório
git clone https://github.com/mastermaiolo/rvc-dataset-studio.git
cd rvc-dataset-studio

# Instalar dependências
npm install

# Iniciar servidor local de desenvolvimento (http://localhost:5173)
npm run dev

# Executar validação integral (lint + tipos + schemas + testes + compilação)
npm run check
```

### Comandos Disponíveis

| Comando | Finalidade |
|---|---|
| `npm run dev` | Inicia o servidor Vite com recarregamento em tempo real |
| `npm run typecheck` | Validação de tipos através do TypeScript |
| `npm run lint` | Verificação de código com ESLint |
| `npm test` | Execução de testes do Vitest com sinais sintéticos de áudio |
| `npm run validate:content` | Valida ficheiros JSON de exercícios contra os schemas |
| `npm run build` | Compila o pacote estático de produção para a pasta `dist/` |

### Implementação em Produção (Vercel)

O estúdio está publicado como aplicação web totalmente estática na Vercel em [**rvc-dataset-studio.vercel.app**](https://rvc-dataset-studio.vercel.app).

- **Alojamento &amp; Compilação:** CI/CD automatizado na [Vercel](https://vercel.com) (`build: npm run build`, pasta de saída `dist`).
- **Segurança &amp; Cabeçalhos (`vercel.json`):** Aplica Content-Security-Policy (CSP) rigorosa, `Permissions-Policy: microphone=(self)`, HSTS e desativa cache no service worker.

---

## 09 / Arquitetura e Estrutura do Código

<br/>

<div align="center">
  <img src="assets/readme/architecture.svg" alt="RVC Dataset Studio Arquitetura" width="100%"/>
</div>

<br/>

### Estrutura de Ficheiros

```
rvc-dataset-studio/
├── content/                   # Banco de exercícios e idiomas (CC0 1.0)
│   ├── en/                    # Exercícios em inglês
│   ├── pt-BR/                 # Exercícios em português brasileiro
│   ├── es/                    # Exercícios em espanhol
│   └── zh/                    # Exercícios em mandarim (com pinyin e contornos)
├── schema/                    # Schemas JSON para validação de conteúdo
├── docs/                      # Documentação técnica e notas de suporte
│   ├── GUIDE.md               # Guia técnico em inglês
│   ├── GUIA.pt-BR.md          # Guia técnico em português
│   ├── BROWSER_TESTING.md     # Notas de compatibilidade do AudioWorklet
│   └── LANGUAGE_PACKS.md      # Instruções para criação de novos pacotes
├── src/
│   ├── audio/                 # AudioContext, AudioWorklet e sintetizador de guia
│   ├── analysis/              # Deteção YIN, VAD, LTAS/FFT, QC de takes e mapa de extensão
│   ├── bank/                  # Tipos de exercícios e posicionamento na extensão
│   ├── lyrics/                # "Minhas letras": silabação e gerador de exercícios
│   ├── storage/               # IndexedDB (áudios) e localStorage (definições)
│   ├── export/                # Exportação ZIP no cliente (fflate) e WAV contínuo
│   ├── i18n/                  # Textos da interface (en = referência, pt-BR)
│   └── ui/                    # Componentes reativos Preact e Signals
├── scripts/                   # Scripts de validação e compilação
├── tests/                     # Testes Vitest (pitch sintético, VAD, WAV, ZIP)
├── public/                    # Ficheiros estáticos e manifesto PWA
├── vercel.json                # Cabeçalhos de segurança (CSP, Permissions-Policy)
└── assets/
    └── readme/                # Ativos visuais modulares em formato vetorial SVG
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
<summary><strong>1. Degradação por Saturação Digital (&gt; -1 dBFS)</strong></summary>
<br/>

Picos acima de $-1\text{ dBFS}$ cortam o topo da onda de áudio. Os modelos neurais absorvem essa distorção agressiva como parte integrante do timbre da voz. Execute o teste de 5 segundos e mantenha os picos entre $-12$ e $-6\text{ dBFS}$.

</details>

<details>
<summary><strong>2. Efeitos e Processamento Automático de Áudio do Sistema</strong></summary>
<br/>

Mecanismos de "melhoria de voz" do sistema operativo ou navegador (cancelamento de eco, redução de ruído e controlo automático de ganho) distorcem formantes e criam desfasamentos artificiais. O estúdio solicita áudio sem qualquer pós-processamento. Se o navegador ativar DSP, um aviso será exibido. Desative todos os melhoramentos de microfone nas definições do sistema operativo.

</details>

<details>
<summary><strong>3. Som dos Auscultadores a Vazar para o Microfone</strong></summary>
<br/>

Se o tom de referência vazar de auscultadores abertos para a cápsula do microfone, o modelo aprenderá a reproduzir um tom senoidal de fundo ao cantar essas notas. Utilize exclusivamente auscultadores fechados e mantenha o volume em níveis moderados.

</details>

<details>
<summary><strong>4. Esforço Excessivo no Passaggio e Quebras de Voz</strong></summary>
<br/>

Forçar a voz de peito para lá da zona de transição gera quebras e sons metálicos estridentes no modelo. Utilize os exercícios SOVT (sons em "ng") e estreite as vogais abertas (modificando "Ah" para "Uh/Oh") para fazer a transição suave para a voz mista.

</details>

---

## 11 / Linhagem e Proveniência

<br/>

<div align="center">
  <img src="assets/readme/provenance.svg" alt="RVC Dataset Studio Proveniência" width="100%"/>
</div>

<br/>

### Origem e Comunidade Open Source

- **Engenharia de Áudio Neural:** Master Maiolo · MAIOLO / SYSTEMS LAB.
- **Implementação em Produção:** [rvc-dataset-studio.vercel.app](https://rvc-dataset-studio.vercel.app).
- **Compatibilidade:** Compatível com Applio, RVC v2, SoftVC e fluxos abertos de machine learning vocal.
- **Projeto Independente:** Sem vínculo comercial ao Applio, RVC, Suno ou terceiros.

### Licenciamento

- **Código-Fonte da Aplicação:** [Licença MIT](LICENSE).
- **Conteúdo de Exercícios e Schemas (`content/`, `schema/`):** [CC0 1.0 Universal (Domínio Público)](content/LICENSE).
- **Tipografias Incluídas:** SIL Open Font License 1.1.

---

<div align="center">
<sub>MAIOLO / SYSTEMS LAB · RVC DATASET STUDIO · ESTAÇÃO VOCAL NO NAVEGADOR</sub>
</div>
