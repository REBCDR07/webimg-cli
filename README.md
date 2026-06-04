# @eltkof7/webimg-cli

CLI TypeScript pour optimiser, convertir et générer des images web prêtes pour la production.

[![npm](https://img.shields.io/npm/v/@eltkof7/webimg-cli.svg)](https://www.npmjs.com/package/@eltkof7/webimg-cli)
[![CI](https://github.com/REBCDR07/webimg-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/REBCDR07/webimg-cli/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Fonctionnalites

- Conversion vers `webp`, `avif`, `jpeg` et `png` avec [Sharp](https://sharp.pixelplumbing.com/).
- Scan des images `png`, `jpg`, `jpeg`, `tiff`, `webp` et `avif`.
- Conversion multi-formats en une commande: `--format webp,avif`.
- Redimensionnement simple avec `--resize` et plafond avec `--max-width`.
- Variantes responsive `@1x`, `@2x`, `@3x` avec `--responsive`.
- Dossier de sortie configurable avec conservation de l'arborescence depuis `--input`.
- Protection contre l'ecrasement du fichier source.
- Les sorties generees ne sont pas rescanees comme entrees.
- Metadata EXIF strippees par defaut, avec option `--keep-metadata`.
- Cache `.webimg-cache.json` invalide quand le fichier source ou les options changent.
- Mode `--watch` pour relancer la conversion pendant le developpement.
- Rapport console, JSON ou Markdown.
- API programmatique utilisable dans un script Node.js.

## Prerequis

- Node.js `>=18`
- npm `>=9` recommande

Verifier la version locale:

```bash
node -v
npm -v
```

## Installation

Installation globale:

```bash
npm install -g @eltkof7/webimg-cli
webimg --version
```

Utilisation sans installation globale:

```bash
npx @eltkof7/webimg-cli --version
npx @eltkof7/webimg-cli scan -r
```

Installation dans un projet:

```bash
npm install -D @eltkof7/webimg-cli
npx webimg scan -r
```

Exemple de scripts npm:

```json
{
  "scripts": {
    "img:scan": "webimg scan -i ./src/assets -r",
    "img:build": "webimg run -i ./src/assets -o ./public/img -f webp,avif -q 80 -r",
    "img:watch": "webimg run -i ./src/assets -o ./public/img -f webp --watch -r"
  }
}
```

## Demarrage rapide

Mode interactif:

```bash
webimg
```

Creer une configuration par defaut:

```bash
webimg init
```

Scanner le dossier courant:

```bash
webimg scan
webimg scan -r
```

Scanner un dossier precis:

```bash
webimg scan -i ./src/assets -r
```

Convertir en WebP dans le meme dossier:

```bash
webimg run -f webp -q 80 -r
```

Convertir vers WebP et AVIF dans un dossier public:

```bash
webimg run -i ./src/assets -o ./public/img -f webp,avif -q 80 -r
```

Generer des variantes responsive:

```bash
webimg run -i ./src/assets -o ./public/img -f webp,avif --resize 800 --responsive 1,2,3 -r
```

Tester sans ecrire de fichiers:

```bash
webimg run -i ./src/assets -f avif --dry-run --report report.md -r
```

Surveiller les changements:

```bash
webimg run -i ./src/assets -o ./public/img -f webp --watch -r
```

## Commandes

### `webimg`

Lance le mode interactif. Le CLI pose quelques questions, scanne les images, puis lance la conversion.

```bash
webimg
```

### `webimg init`

Cree `webimg.config.json` dans le dossier courant.

```bash
webimg init
```

### `webimg scan`

Scanne les images et affiche un resume par extension.

```bash
webimg scan -i ./src/assets -r
```

Options utiles:

```bash
webimg scan --include "images/**/*.{png,jpg}" --exclude "**/*.raw.png"
```

### `webimg run`

Execute la conversion sans question interactive. C'est la commande a utiliser en CI/CD ou dans les scripts npm.

```bash
webimg run -i ./src/assets -o ./public/img -f webp,avif -q 80 -r
```

## Options CLI

| Option | Description | Defaut |
|---|---|---|
| `-i, --input <dir>` | Dossier a scanner | `.` |
| `-f, --format <types>` | Formats de sortie separes par virgule: `webp,avif,jpeg,png` | `webp` |
| `-q, --quality <n>` | Qualite de sortie entre `1` et `100` | `80` |
| `-r, --recursive` | Inclut les sous-dossiers | `false` |
| `-o, --output <dir>` | Dossier de sortie | dossier source |
| `-s, --suffix <str>` | Suffixe ajoute au nom de fichier | vide |
| `--resize <w>` | Largeur cible en pixels pour la sortie 1x | aucun |
| `--max-width <px>` | Largeur maximale, sans agrandir les petites images | aucun |
| `--responsive <list>` | Densites a generer, par exemple `1,2,3` | aucune |
| `--keep-metadata` | Conserve les metadata EXIF/IPTC/XMP | `false` |
| `--replace` | Supprime le fichier source apres conversion reussie | `false` |
| `--dry-run` | Simule la conversion sans ecrire de fichiers | `false` |
| `--no-cache` | Desactive le cache `.webimg-cache.json` | cache actif |
| `--include <patterns>` | Patterns glob a inclure, separes par virgule | auto |
| `--exclude <patterns>` | Patterns glob a exclure, separes par virgule | vide |
| `--report <path>` | Ecrit un rapport `.json` ou `.md` | aucun |
| `--watch` | Surveille les changements et reconvertit | `false` |

## Exemples pratiques

### Optimiser un dossier d'assets

```bash
webimg run -i ./src/assets -o ./public/img -f webp,avif -q 78 -r
```

Si `src/assets/products/shoe.png` existe, les sorties seront:

```text
public/img/products/shoe.webp
public/img/products/shoe.avif
```

### Ajouter un suffixe

```bash
webimg run -i ./images -f webp -s .min -r
```

Sortie exemple:

```text
images/photo.min.webp
```

### Redimensionner sans agrandir

```bash
webimg run -i ./images -o ./public/img -f webp --resize 1200 -r
```

Les images plus petites que `1200px` ne sont pas agrandies.

### Generer `@1x`, `@2x`, `@3x`

```bash
webimg run -i ./images -o ./public/img -f webp --resize 640 --responsive 1,2,3 -r
```

Sorties exemple:

```text
public/img/photo@1x.webp  # 640px
public/img/photo@2x.webp  # 1280px
public/img/photo@3x.webp  # 1920px
```

### Limiter la largeur maximale

```bash
webimg run -i ./images -o ./public/img -f avif --resize 1600 --max-width 1200 -r
```

### Exporter un rapport

```bash
webimg run -i ./images -o ./public/img -f webp,avif --report report.json -r
webimg run -i ./images -o ./public/img -f webp,avif --report report.md -r
```

### Inclure ou exclure certains fichiers

```bash
webimg run --include "src/**/*.{png,jpg}" --exclude "**/*.icon.png,**/raw/**" -f webp
```

### Remplacer les originaux

```bash
webimg run -i ./images -f webp --replace -r
```

Utiliser `--replace` seulement si les sources peuvent etre supprimees. Le CLI refuse d'ecrire une sortie sur le meme chemin que le fichier source; utilisez `--output` ou `--suffix` si necessaire.

## Configuration

Creer le fichier:

```bash
webimg init
```

Exemple `webimg.config.json`:

```json
{
  "input": "./src/assets",
  "output": "./public/img",
  "recursive": true,
  "formats": ["webp", "avif"],
  "quality": 80,
  "resize": 1200,
  "maxWidth": null,
  "responsive": [1, 2],
  "suffix": "",
  "keepMetadata": false,
  "keepOriginal": true,
  "include": [],
  "exclude": ["**/node_modules/**", "**/dist/**"],
  "cache": true,
  "dryRun": false
}
```

Les options passees en ligne de commande surchargent la configuration du fichier.

Fichiers de configuration supportes:

```text
webimg.config.json
.webimgrc.json
.webimgrc
```

## Cache

Le cache est stocke dans `.webimg-cache.json`.

Une conversion est reutilisee seulement si:

- le fichier source n'a pas change;
- les sorties attendues existent;
- les options de conversion importantes sont identiques: formats, qualite, resize, max-width, responsive, suffixe et metadata.

Desactiver le cache:

```bash
webimg run -i ./images -f webp --no-cache -r
```

## Metadata et confidentialite

Par defaut, les metadata EXIF/IPTC/XMP sont retirees.

Conserver les metadata:

```bash
webimg run -i ./images -f webp --keep-metadata -r
```

## API programmatique

```ts
import { findImages, mergeConfig, runParallel, summarize } from '@eltkof7/webimg-cli';

const cwd = process.cwd();
const cfg = mergeConfig({
  input: './src/assets',
  output: './public/img',
  recursive: true,
  formats: ['webp', 'avif'],
  quality: 80,
  resize: 1200,
});

const files = await findImages(cwd, cfg);
const results = await runParallel(files, cfg, cwd);
const summary = summarize(results);

console.log(summary);
```

Exports disponibles:

```ts
export { convertFile, runParallel } from '@eltkof7/webimg-cli';
export { findImages, SUPPORTED_INPUT } from '@eltkof7/webimg-cli';
export { loadConfig, mergeConfig, DEFAULT_CONFIG } from '@eltkof7/webimg-cli';
export { summarize, printReport, writeJsonReport, writeMarkdownReport, formatBytes } from '@eltkof7/webimg-cli';
export { ConversionCache } from '@eltkof7/webimg-cli';
```

## Developpement local

Cloner le depot:

```bash
git clone https://github.com/REBCDR07/webimg-cli.git
cd webimg-cli
```

Installer les dependances:

```bash
npm install
```

Lancer les controles:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm audit
```

Tester le binaire local:

```bash
npm run build
node dist/index.js --version
node dist/index.js scan -r
```

Tester globalement avec `npm link`:

```bash
npm link
webimg --version
webimg scan -r
```

Verifier le contenu du package npm:

```bash
npm pack --dry-run
```

## Publication npm

Verifier l'authentification:

```bash
npm whoami
```

Publier une nouvelle version:

```bash
npm version patch
git push --follow-tags
npm publish --access public
```

Pour une premiere publication du package scope public:

```bash
npm publish --access public
```

Le hook `prepublishOnly` lance automatiquement:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## CI/CD

Le workflow GitHub Actions execute lint, typecheck, tests et build sur Node 18, 20 et 22.

La publication automatique peut etre faite depuis une release GitHub avec un secret `NPM_TOKEN` configure dans les settings du depot.

## Licence

MIT © eltkof7
