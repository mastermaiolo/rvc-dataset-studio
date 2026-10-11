# Guia técnico — gravar um dataset de voz para Applio/RVC

[English](GUIDE.md)

Este guia explica por que o estúdio grava o que grava, como conseguir takes limpos e quais parâmetros de conversão importam depois. O Applio e o RVC mudam rápido: quando o nome de um parâmetro aqui for diferente da sua versão, confie na dica da sua versão.

## 1. Como é um bom dataset

- **Uma só pessoa**, o mesmo microfone e a mesma posição do início ao fim.
- **10–15 minutos de voz ativa** (silêncio não conta). Menos de ~8 minutos costuma soar pobre; mais de ~30 minutos rende pouco a mais.
- **Sem perdas**: o estúdio exporta WAV PCM, 16 ou 24 bits, mono, na taxa da sua interface (normalmente 48 kHz).
- **Variedade**: vogais em toda a extensão confortável, glissandos, frases de verdade, fala natural com intenções diferentes, articulação rápida, dinâmicas suaves e fortes. O modelo só reproduz o que ouviu — incluindo notas, idiomas e estilos.
- **Seco e sem processamento**: sem reverb, auto-tune, compressão ou supressão de ruído. O modelo aprende todos os artefatos.

## 2. Técnica de gravação

- **Fones de ouvido fechados.** O tom de referência nunca pode chegar ao microfone.
- Desligue as “melhorias de microfone” do sistema operacional. O estúdio já pede ao navegador o áudio sem cancelamento de eco, supressão de ruído e ganho automático; se algum navegador forçar um deles, aparece um aviso no topo da página.
- **15–20 cm** do microfone, filtro anti-pop, mesma posição em todos os takes.
- **Ganho**: picos entre −12 e −6 dBFS. Nunca acender o CLIP.
- **Sala**: um lugar seco (guarda-roupa, cobertores, cortinas). Ruído de fundo abaixo de −60 dBFS é o ideal; meça em *Configurações → Ruído de fundo*.
- **A duração do take é só por conforto.** O pré-processamento do Applio corta cada arquivo em pedaços curtos de novo, então um take de 5 segundos e um de 9 são igualmente úteis. O que importa é cada take estar limpo.
- Descanse a voz a cada 15 takes, mais ou menos. Um take cansado ou forçado ensina tensão ao modelo.

## 3. Extensão, registros e a zona de passagem (passaggio)

- **Por que a voz mista e o falsete são vitais para o modelo:** Os extratores de embedding (como ContentVec) não conseguem extrapolar além dos timbres gravados. Se o seu dataset contiver apenas voz de peito (graves e médios), quando uma música pedir notas na transição vocal (passaggio, ex: D4–G4 para vozes masculinas), a IA tentará "gritar" em peito esticado, gerando um som esganiçado, anasalado ou quebras repentinas de oitava.
- **Mistura recomendada de registros no dataset:**
  - **Peito (25–35%):** corpo, potência e frequências fundamentais.
  - **Voz Mista / Passaggio (25–35%):** a ponte indispensável entre peito e cabeça. Ensina o modelo a navegar a transição suavemente em melodias de músicas reais.
  - **Falsete / Cabeça (15–25%):** vibração de borda das cordas vocais. Garante que notas suaves e agudos flutuantes não colapsem.
  - **Fala natural (10–20%):** referência de formantes e dicção conversacional.
- **Técnicas para executar notas agudas e passagem:**
  - *Semi-oclusão (SOVT):* use os exercícios de sirene no "ng" para equilibrar a pressão de ar antes de abrir vogais.
  - *Twang e narrowed vowels:* use sílabas como "Nay" ou "Gee" para aproximar as pregas vocais com brilho faríngeo sem empurrar peso do peito.
  - *Estreitamento de vogal:* nos agudos, modifique o "Ah" em direção a "Uh/Oh", e o "Eh" em direção a "Ih", evitando abrir excessivamente a boca na horizontal.
- **Brilho não é nasalidade:** tampe o nariz durante uma nota sustentada. Se o som mudar, há ar escapando pelas narinas — levante o palato mole (sensação de início de bocejo).
- Perto do topo da extensão, alivie em vez de empurrar. O estúdio inclui o arquivo `dataset_info.json` no ZIP exportado com todas as recomendações de hiperparâmetros para o Applio.

## 4. Treinar no Applio

1. **Pasta do dataset**: descompacte o export em `assets/datasets/NomeDaVoz`. Use só ASCII — sem espaços nem acentos em pastas ou arquivos.
2. **Preprocess**: escolha a taxa do **pré-treinado** que vai usar (32k, 40k ou 48k); o Applio reamostra os seus WAV. Mantenha o corte automático ligado.
3. **Extract**: extrator de pitch `rmvpe`, embedder `contentvec` (ou o que o seu pré-treinado espera). **O embedder da conversão tem de ser o mesmo usado aqui.**
4. **Train**: parta de um pré-treinado (o Applio escolhe um compatível com a taxa; também há pré-treinados da comunidade, alguns afinados para idiomas específicos). Salve um checkpoint a cada 10–50 épocas. No fim o índice é gerado (ou use *Train Index*).
5. **Escolha a época de ouvido.** Converta a mesma frase curta com vários checkpoints e fique com o que soa mais como você, com menos artefatos. Curvas de perda e números fixos de épocas são só pistas; o detector de overtraining ajuda a parar mais cedo.

## 5. Converter (inferência) — os parâmetros que importam

| Parâmetro | O que ele faz de verdade |
| --- | --- |
| **Pitch** (semitons) | Transpõe a entrada antes da conversão. Leve a melodia de referência para a *sua* extensão em vez de forçar um timbre mais escuro. |
| **Extrator de pitch** (f0 method) | **É daqui que vem a melodia.** `rmvpe` é o padrão robusto para fala e para a maior parte do canto. |
| **Index rate** | O quanto o índice puxa o timbre e a pronúncia para os dados de treino. **Não controla a melodia.** Baixe para idiomas ou estilos pouco presentes no dataset; suba quando o modelo soar pouco parecido com você. |
| **Protect** | Protege consoantes surdas e respirações de serem convertidas. **Quanto mais baixo, mais protege; 0,5 desliga a proteção.** Valores muito baixos também enfraquecem o índice. Para vozes com ar, experimente 0,20–0,30. |
| **Formantes** | Quefrency e Timbre partem de **1,0** (neutro). Mexa pouco (p. ex. Timbre 0,9–1,0) e confirme de ouvido. Mudanças grandes são para conversões entre vozes masculinas e femininas. |
| **Autotune** | Correção suave de afinação para canto; deixe desligado na fala. |

Limpe a entrada antes: converta uma voz isolada e seca (separada do instrumental e sem reverb) e mixe de novo depois.

## 6. Problemas comuns

| Sintoma | Causa provável | O que tentar |
| --- | --- | --- |
| Fino ou anasalado nos agudos | Poucos segundos de canto naquela parte da extensão | Grave mais exercícios ali (mapa de extensão) ou transponha a entrada para baixo |
| Respirações robóticas ou metálicas | Protect alto demais/desligado, entrada com ruído | Baixe o Protect, limpe a entrada |
| Sotaque errado ou palavras pastosas em outro idioma | Pouco desse idioma no dataset | Adicione o pacote do idioma ou as suas letras; baixe o Index rate |
| Consoantes pastosas em músicas rápidas | Dataset gravado devagar demais | Grave os exercícios de articulação rápida |
| Saída distorcida | Embedder diferente no treino e na conversão | Use o mesmo embedder |
| Resultado desafinado | Extração de pitch ruim, reverb na entrada | Use `rmvpe`, tire o reverb antes de converter |
