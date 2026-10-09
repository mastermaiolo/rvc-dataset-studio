<div align="center">

# RVC DATASET STUDIO

**Estudio en el Navegador para Medición de Perfil Vocal y Grabación de Datasets para Applio / RVC**

[![Release](https://img.shields.io/badge/release-v0.1.0-AD283B?style=flat-square&labelColor=13161A)](https://github.com/mastermaiolo/rvc-dataset-studio)
[![Licencia](https://img.shields.io/badge/licencia-MIT%20%7C%20CC0-E9E5DC?style=flat-square&labelColor=13161A)](LICENSE)
[![Producción](https://img.shields.io/badge/producci%C3%B3n-rvc--dataset--studio.vercel.app-C86D51?style=flat-square&labelColor=13161A)](https://rvc-dataset-studio.vercel.app)
[![Motor de Audio](https://img.shields.io/badge/motor-AudioWorklet%20%2B%20YIN-38BDF8?style=flat-square&labelColor=13161A)](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
[![Privacidad](https://img.shields.io/badge/privacidad-100%25%20En%20el%20Cliente%20(Sin%20Subidas)-10B981?style=flat-square&labelColor=13161A)](docs/GUIDE.md#privacy)
[![Destino](https://img.shields.io/badge/destino-Applio%20%2F%20RVC%20v2-818CF8?style=flat-square&labelColor=13161A)](https://github.com/IAHispano/Applio)

<br/>

[English (UK)](README.md) · [Português (Brasil)](README.pt-br.md) · [Português (Portugal)](README.pt-pt.md) · **Español** · [简体中文](README.zh-cn.md)

<br/>

<img src="assets/readme/hero.svg" alt="RVC Dataset Studio Hero Canvas" width="100%"/>

</div>

<br/>

> **Estudio de grabación y estación de análisis vocal directamente en el navegador**: mide tu perfil vocal, calibra la tesitura, equilibra los registros vocales y graba datasets limpios y sin compresión, optimizados para el entrenamiento de modelos de voz en [**Applio**](https://github.com/IAHispano/Applio) y **RVC**.
>
> 🔒 **Privacidad 100% en el Cliente:** Ningún archivo de audio sale de tu navegador. Sin servidores backend, sin cuentas de usuario, sin cookies y sin telemetría. Funciona sin conexión como Progressive Web App (PWA).
>
> 🔗 **Despliegue en Producción:** [rvc-dataset-studio.vercel.app](https://rvc-dataset-studio.vercel.app)

> [!IMPORTANT]
> **Compromiso Ético y Uso Responsable de IA Vocal:**
> Graba y clona únicamente **tu propia voz**, o una voz sobre la que dispongas de consentimiento explícito y verificable. Este es un proyecto de código abierto independiente y no guarda afiliación comercial con Applio, RVC, Suno ni servicios comerciales de música generativa.

---

## 01 / Índice de Navegación

- [02 / Visión General](#02--visión-general)
- [03 / Capacidades e Ingeniería](#03--capacidades-e-ingeniería)
- [04 / Espacios de Trabajo y Demostración](#04--espacios-de-trabajo-y-demostración)
- [05 / Superficie de Control y Ergonomía de Teclado](#05--superficie-de-control-y-ergonomía-de-teclado)
- [06 / Entrenamiento Neural y Pipeline en Applio](#06--entrenamiento-neural-y-pipeline-en-applio)
- [07 / Privacidad y Almacenamiento Local](#07--privacidad-y-almacenamiento-local)
- [08 / Instalación y Desarrollo](#08--instalación-y-desarrollo)
- [09 / Arquitectura y Organización del Código](#09--arquitectura-y-organización-del-código)
- [10 / Resolución de Problemas y Casos Extremos](#10--resolución-de-problemas-y-casos-extremos)
- [11 / Linaje y Procedencia](#11--linaje-y-procedencia)

---

## 02 / Visión General

Entrenar un modelo neuronal de clonación de voz de alta fidelidad en RVC o Applio requiere audios homogéneos, secos y equilibrados en registros y tesituras. Las grabaciones caseras sin calibración suelen acusar reverberación de sala, saturación digital (*clipping*) o quiebres de afinación derivados de forzar la voz fuera de la extensión cómoda.

RVC Dataset Studio une la pedagogía vocal con el aprendizaje automático: calibra cada ejercicio a la tesitura real del cantante, garantiza transiciones suaves en la zona de paso (*passaggio*), realiza un control de calidad automático en cada toma y exporta paquetes listos para el entrenamiento directamente a disco.

<br/>

<div align="center">
  <img src="assets/readme/at-a-glance.svg" alt="RVC Dataset Studio Visión General" width="100%"/>
</div>

<br/>

### Pilares Arquitectónicos Fundamentales

| Pilar Arquitectónico | Implementación Técnica | Ventaja Práctica en el Estudio |
|---|---|---|
| **Privacidad Total Sin Servidores** | Web Audio API y almacenamiento local IndexedDB en el navegador | Ningún audio sale de tu equipo; cero servidores, cero telemetría |
| **Calibración de Perfil Vocal** | Test guiado de 30s (extensión, nota cómoda, habla y espectro LTAS) | Transpone automáticamente todos los ejercicios a tu tesitura (del Bajo al Soprano) |
| **Equilibrio de Passaggio y Registros** | Mix objetivo: Pecho (25–35%), Mixta (25–35%), Cabeza (15–25%), Habla (10–20%) | Evita que el modelo de IA chille, quiebre octavas o arrastre peso de pecho en agudos |
| **Afinador YIN en Tiempo Real** | Algoritmo YIN para $f_0$ fundamental con indicador de $\pm\text{cents}$ | Feedback visual de entonación al instante en el prompter durante la toma |
| **Control de Calidad Automático** | Medición de voz activa, control de picos ($> -1\text{ dBFS}$) y ruido de fondo | Descarta tomas defectuosas antes de que contaminen el dataset neuronal |
| **Exportación Integrada para Applio** | Archivo ZIP con WAVs a 16/24 bits, README y `dataset_info.json` | Hiperparámetros óptimos recomendados (RMVPE, ContentVec, frecuencia y épocas) |

---

## 03 / Capacidades e Ingeniería

<br/>

<div align="center">
  <img src="assets/readme/capabilities.svg" alt="RVC Dataset Studio Capacidades" width="100%"/>
</div>

<br/>

### 1. Registros Vocales, Passaggio y Prevención de Artefactos
Los modelos neuronales de extracción tímbrica (como ContentVec) fallan al extrapolar fuera de las zonas tonales grabadas. Si un dataset consta exclusivamente de voz de pecho pesada, cada vez que una canción de inferencia ascienda a la zona de transición (*passaggio*, ej.: D4–G4 en voces masculinas), el modelo RVC forzará el peso de pecho hacia arriba, generando un timbre estridente, excesiva nasalidad o quiebres de afinación.

RVC Dataset Studio equilibra activamente la distribución de registros:
- **Voz de Pecho (25–35%):** Potencia acústica, calidez y cuerpo fundamental.
- **Voz Mixta / Passaggio (25–35%):** El puente indispensable sobre la rotura vocal. Esencial para melodías cantadas fluidas.
- **Falsete / Voz de Cabeza (15–25%):** Vibración pura del borde de las cuerdas vocales. Evita que los agudos suaves colapsen.
- **Habla Natural (10–20%):** Anclajes de formantes conversacionales y dicción articulada.

Técnicas vocales integradas en el repertorio:
- *Ejercicios de Tracto Vocal Semiocluido (SOVPE):* Sirenas en "ng" y vibraciones labiales para regular la presión subglótica.
- *Twang Faríngeo:* Prácticas con "Nay" y "Gee" que promueven el cierre firme de cuerdas sin sobrecargar la musculatura.
- *Modificación/Estrechamiento Vocálico:* Redondear vocales abiertas (ej.: "Ah" $\rightarrow$ "Uh/Oh") al aproximarse a los agudos.

### 2. Detección de Tono YIN y Karaoke en el Prompter
El estudio incorpora un motor de afinación de alta precisión basado en el **algoritmo YIN**, capaz de determinar la frecuencia fundamental ($f_0$) y el nivel de aperiodicidad en tiempo real.
- **Indicador de Cents en Vivo:** Muestra la desviación de tono en $\pm\text{cents}$ sobre el texto de la toma.
- **Sintetizador de Tono Guía:** Emite la nota objetivo en los auriculares cerrados, permitiendo anclar la afinación antes de cantar.
- **Contornos Melódicos Dinámicos:** Genera guías para sirenas, glissandos e idiomas tonales (como los cuatro tonos del mandarín).

### 3. Control de Calidad de la Toma y Calibración de Headroom
Antes de iniciar la sesión, una prueba de 5 segundos evalúa la acústica y el margen dinámico:
- **Detección de Saturación Digital:** Alerta de forma inmediata ante picos que superen $-1\text{ dBFS}$.
- **Suelo de Ruido Ambiental:** Exige un entorno silencioso por debajo de $-24\text{ dBFS}$ (preferentemente $<-60\text{ dBFS}$).
- **Comprobación de Fonación Activa:** Verifica que la toma contenga voz efectiva y no silencio ambiente.
- **Revisión Instantánea con Teclado:** Pulsa **Enter** para aceptar la toma o **R** para repetirla al instante.

---

## 04 / Espacios de Trabajo y Demostración

<br/>

<div align="center">
  <img src="assets/readme/showcase.svg" alt="RVC Dataset Studio Espacios de Trabajo" width="100%"/>
</div>

<br/>

### Las 4 Fases Principales del Flujo de Grabación

| Panel / Espacio de Trabajo | Función Principal | Funcionalidades Clave |
|---|---|---|
| **01 / Test de Perfil Vocal** | Extensión y consentimiento | Test guiado de 30s (sirena, habla, nota cómoda); clasificación vocal; selección de idiomas |
| **02 / Teleprompter del Estudio** | Interfaz de grabación manos libres | Prompter con karaoke sílaba a sílaba, cuenta atrás ("Prepárate · Respira"), tono guía y afinador |
| **03 / Revisión y QC de Toma** | Tarjeta de verificación de audio | Forma de onda, tiempo de voz activa, nivel de pico en dBFS, ruido de fondo, atajos [Enter] y [R] |
| **04 / Mapa de Extensión** | Cobertura y exportación | Gráfico semitono a semitono, balance de registros, generador "Mis letras", exportación en ZIP o WAV continuo |

<br/>

<details>
<summary><strong>Explorar Contenido y Paquetes de Idioma (Haz clic para desplegar)</strong></summary>
<br/>

1. **Banco de Ejercicios (`content/`):**
   Archivos JSON validados mediante esquemas formales (`schema/`). Contienen vocales sostenidas, glissandos, saltos melódicos, dicción rápida y equilibrio de registros.
2. **Paquetes de Fonemas y Habla:**
   Incluye paquetes para **Inglés**, **Português (Brasil)**, **Español** y **中文 (Mandarín)** con transcripción pinyin y contornos tonales.
3. **Generador "Mis Letras":**
   Permite pegar fragmentos de canciones propias. La aplicación divide las sílabas y produce 4 variantes de ejercicio: habla natural, melodía cantada, articulación veloz y frase sostenida lenta. Todo se guarda estrictamente en `localStorage`.
4. **Manifiesto para Applio (`dataset_info.json`):**
   Se exporta junto a los audios, sugiriendo frecuencias de muestreo (40k/48k), algoritmo RMVPE, alineación con ContentVec y número óptimo de épocas.

</details>

---

## 05 / Superficie de Control y Ergonomía de Teclado

<br/>

<div align="center">
  <img src="assets/readme/control-surface.svg" alt="RVC Dataset Studio Superficie de Control" width="100%"/>
</div>

<br/>

### Atajos de Teclado

Diseñados para grabar de pie cómodamente frente al micrófono sin necesidad de usar el ratón:

| Tecla | Acción | Contexto |
|---|---|---|
| <kbd>Espacio</kbd> | **Grabar / Detener Toma** | Inicia la cuenta ("Prepárate · Respira") o finaliza la grabación |
| <kbd>Enter</kbd> | **Aceptar Toma** | Guarda en IndexedDB y avanza al siguiente ejercicio |
| <kbd>R</kbd> | **Repetir Toma** | Descarta la grabación actual y reinicia la toma de inmediato |
| <kbd>T</kbd> | **Tocar Tono de Referencia** | Emite la nota guía sintetizada en los auriculares |
| <kbd>M</kbd> | **Silenciar Guía de Audio** | Activa o desactiva los tonos de ayuda sonora |
| <kbd>←</kbd> / <kbd>→</kbd> | **Ejercicio Anterior / Siguiente** | Navega libremente por el catálogo de ejercicios |

### Calibración de Headroom y Ganancia

1. Utiliza **auriculares cerrados** (los auriculares abiertos filtran sonido al micrófono, viciando el modelo).
2. Colócate a **15–20 cm** del micrófono con filtro antipop.
3. Ajusta la ganancia para que los picos más fuertes se sitúen entre **$-12\text{ dBFS}$ y $-6\text{ dBFS}$**. Evita llegar a $0\text{ dBFS}$ (saturación digital).
4. Asegúrate de que el suelo de ruido de la habitación esté por debajo de **$-60\text{ dBFS}$** (usa armarios, mantas o cortinas gruesas).

---

## 06 / Entrenamiento Neural y Pipeline en Applio

Con el dataset descargado, el proceso de entrenamiento en **Applio** o **RVC** se realiza así:

### 1. Preparación de Archivos
Descomprime el archivo ZIP directamente en la carpeta de datasets de Applio:
```
Applio/
└── assets/
    └── datasets/
        └── NombreDeTuVoz/     # Emplea únicamente caracteres ASCII (sin espacios ni tildes)
            ├── take_001.wav
            ├── take_002.wav
            ├── dataset_info.json
            └── README.md
```

### 2. Preprocess (Preprocesamiento)
- Selecciona la tasa de muestreo adecuada para el modelo base (**40 kHz** o **48 kHz**).
- Deja activado el **corte automático**. Applio vuelve a segmentar los archivos en fragmentos breves; la duración de cada toma se diseñó solo para tu confort respiratorio.

### 3. Extract (Extracción de Características)
- **Extractor de Tono ($f_0$):** Selecciona `rmvpe`. De este algoritmo depende la precisión de la melodía.
- **Embedder:** Selecciona `contentvec`. El mismo modelo de incrustación usado en el entrenamiento debe elegirse en la inferencia.

### 4. Train (Entrenamiento)
- Guarda un punto de control (checkpoint) cada **10–50 épocas**.
- **Compara los Checkpoints de Oído:** No te fíes ciegamente de las curvas de pérdida ni de un número fijo de épocas. Convierte una misma frase con varios puntos de control y quédate con el que suene más natural y sin artefactos.
- Entrena el índice (Index) tras finalizar.

### 5. Parámetros Clave en la Conversión (Inferencia)

| Parámetro | Función y Ajuste Recomendado |
|---|---|
| **Pitch Shift** | Transpone el audio original a *tu* tesitura vocal natural. |
| **Pitch Extractor** | Mantén `rmvpe` para máxima estabilidad en voz hablada y cantada. |
| **Index Rate** | Regula la fidelidad tímbrica hacia tu modelo ($0,60–0,85$). No controla la melodía. |
| **Protect** | Protege consonantes sordas y respiraciones ($0,20–0,33$). Valores más bajos protegen más; $0,50$ desactiva la protección. |
| **Formant Shift** | Quefrency y Timbre parten de **1,0**. Modifícalos con suavidad ($0,95–1,05$) si hace falta ajustar el tracto vocal. |

---

## 07 / Privacidad y Almacenamiento Local

RVC Dataset Studio opera bajo una estricta directriz de retención cero:

- **Búferes de Audio:** Procesados en memoria RAM mediante `AudioWorklet`. Se almacenan localmente en el `IndexedDB` del navegador en formato WAV puro.
- **Sin Comunicaciones Externas:** Ningún audio, metadato o letra se envía a servidores.
- **Preferencias Locales:** La tesitura y las letras personalizadas se guardan en `localStorage`.
- **Progressive Web App (PWA) Offline:** Tras el primer acceso, el Service Worker almacena en caché todos los archivos estáticos, permitiendo grabar sin conexión.
- **Cumplimiento Normativo:** Cumple de forma rigurosa con el **RGPD Artículo 6(1)(a)**.

---

## 08 / Instalación y Desarrollo

### Requisitos Previos

- **Node.js:** $\ge 20.0$
- **Gestor de Paquetes:** `npm` (por defecto)
- **Navegador Moderno:** Chrome, Edge, Firefox o Safari (Escritorio e iOS). El micrófono requiere HTTPS o `localhost`.

### Puesta en Marcha Local

```bash
# Clonar el repositorio
git clone https://github.com/mastermaiolo/rvc-dataset-studio.git
cd rvc-dataset-studio

# Instalar dependencias
npm install

# Iniciar servidor local de desarrollo (http://localhost:5173)
npm run dev

# Ejecutar validación completa (lint + tipos + esquemas + tests + compilación)
npm run check
```

### Scripts Disponibles

| Script | Propósito |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo Vite con recarga rápida |
| `npm run typecheck` | Validación de tipado con TypeScript |
| `npm run lint` | Comprobación de reglas con ESLint |
| `npm test` | Ejecución de pruebas en Vitest con señales sintéticas |
| `npm run validate:content` | Validación de archivos JSON frente a los esquemas |
| `npm run build` | Compila el paquete estático final en `dist/` |

### Despliegue en Producción (Vercel)

El estudio está publicado como una aplicación web totalmente estática en Vercel en [**rvc-dataset-studio.vercel.app**](https://rvc-dataset-studio.vercel.app).

- **Alojamiento y Compilación:** CI/CD automatizado en [Vercel](https://vercel.com) (`build: npm run build`, carpeta de salida `dist`).
- **Seguridad y Cabeceras (`vercel.json`):** Aplica Content-Security-Policy (CSP) estricta, `Permissions-Policy: microphone=(self)`, HSTS y desactiva la caché en el service worker.

---

## 09 / Arquitectura y Organización del Código

<br/>

<div align="center">
  <img src="assets/readme/architecture.svg" alt="RVC Dataset Studio Arquitectura" width="100%"/>
</div>

<br/>

### Estructura de Directorios

```
rvc-dataset-studio/
├── content/                   # Banco de ejercicios e idiomas (CC0 1.0)
│   ├── en/                    # Ejercicios en inglés
│   ├── pt-BR/                 # Ejercicios en portugués de Brasil
│   ├── es/                    # Ejercicios en español
│   └── zh/                    # Ejercicios en mandarín (con pinyin y tonos)
├── schema/                    # Esquemas JSON para validación de contenido
├── docs/                      # Documentación técnica y pruebas de navegadores
│   ├── GUIDE.md               # Guía técnica en inglés
│   ├── GUIA.pt-BR.md          # Guía técnica en portugués
│   ├── BROWSER_TESTING.md     # Notas de compatibilidad de AudioWorklet
│   └── LANGUAGE_PACKS.md      # Instrucciones para crear nuevos paquetes
├── src/
│   ├── audio/                 # AudioContext, captura en AudioWorklet y sintetizador
│   ├── analysis/              # Detección YIN, VAD, LTAS/FFT, control QC y mapa de rango
│   ├── bank/                  # Tipos de ejercicio y transposición de tesituras
│   ├── lyrics/                # "Mis letras": división silábica y ejercicios
│   ├── storage/               # IndexedDB (audios) y localStorage (ajustes)
│   ├── export/                # Exportación ZIP local (fflate) y WAV continuo
│   ├── i18n/                  # Textos multilingües (en = referencia, pt-BR)
│   └── ui/                    # Componentes reactivos en Preact y Signals
├── scripts/                   # Scripts de validación y compilación
├── tests/                     # Batería de pruebas en Vitest (pitch, VAD, WAV, ZIP)
├── public/                    # Archivos estáticos y manifiesto PWA
├── vercel.json                # Cabeceras de seguridad (CSP, Permissions-Policy)
└── assets/
    └── readme/                # Recursos gráficos vectoriales SVG modulares
```

---

## 10 / Resolución de Problemas y Casos Extremos

<br/>

<div align="center">
  <img src="assets/readme/failure-modes.svg" alt="RVC Dataset Studio Resolución de Problemas" width="100%"/>
</div>

<br/>

### Casos Extremos y Soluciones

<details>
<summary><strong>1. Pérdida de Calidad por Saturación Digital (&gt; -1 dBFS)</strong></summary>
<br/>

Los picos que superan $-1\text{ dBFS}$ truncan la forma de onda. Los algoritmos neuronales asumen esa distorsión metálica como una cualidad natural de tu voz. Pasa siempre el test de 5 segundos y mantén los picos de canto entre $-12$ y $-6\text{ dBFS}$.

</details>

<details>
<summary><strong>2. Trampa de DSP y "Mejoras de Audio" del Sistema</strong></summary>
<br/>

Los algoritmos de "claridad de voz" del sistema operativo o navegador (cancelación de eco, reducción de ruido y ganancia automática) alteran formantes y crean cancelaciones de fase robóticas. El estudio solicita audio puro sin procesar. Si el navegador fuerza el DSP, aparecerá una advertencia. Desactiva todas las mejoras de micrófono en el sistema operativo.

</details>

<details>
<summary><strong>3. Filtración de Sonido desde Auriculares Abiertos</strong></summary>
<br/>

Si el tono de referencia se escapa de unos auriculares abiertos hacia el micrófono, el modelo aprenderá a generar un pitido senoidal de fondo al cantar en esas notas. Utiliza exclusivamente auriculares cerrados y mantén un volumen moderado.

</details>

<details>
<summary><strong>4. Esfuerzo Excesivo en el Passaggio y Rotura de Voz</strong></summary>
<br/>

Tirar de la voz de pecho por encima de la zona natural de transición provoca quiebres y timbre estridente en el modelo final. Recurre a los ejercicios con SOVPE (sirenas en "ng") y estrecha las vocales abiertas (variando "Ah" hacia "Uh/Oh") para pasar de forma gradual a la voz mixta.

</details>

---

## 11 / Linaje y Procedencia

<br/>

<div align="center">
  <img src="assets/readme/provenance.svg" alt="RVC Dataset Studio Procedencia" width="100%"/>
</div>

<br/>

### Origen y Comunidad

- **Ingeniería de Audio Neural:** Master Maiolo · MAIOLO / SYSTEMS LAB.
- **Despliegue en Producción:** [rvc-dataset-studio.vercel.app](https://rvc-dataset-studio.vercel.app).
- **Compatibilidad:** Diseñado para Applio, RVC v2, SoftVC y flujos abiertos de clonación vocal.
- **Proyecto Independiente:** Sin vínculos comerciales con Applio, RVC, Suno ni terceros.

### Licencias

- **Código Fuente de la Aplicación:** [Licencia MIT](LICENSE).
- **Contenido de Ejercicios y Esquemas (`content/`, `schema/`):** [CC0 1.0 Universal (Dominio Público)](content/LICENSE).
- **Tipografías Incluidas:** SIL Open Font License 1.1.

---

<div align="center">
<sub>MAIOLO / SYSTEMS LAB · RVC DATASET STUDIO · ESTACIÓN VOCAL EN EL NAVEGADOR</sub>
</div>
