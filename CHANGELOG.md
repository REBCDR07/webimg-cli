# Changelog

## Unreleased
- Backup explicite et sûr avant suppression des sources (`--backup`, `--backup-dir`).
- Nettoyage des sorties orphelines avec `--clean`.
- Limite de concurrence configurable avec `--concurrency` et dans la configuration.
- Tests d'intégration CLI exécutant le binaire réel.

## 2.0.1
- Publication npm de la version stabilisée avec backup, nettoyage des sorties orphelines et concurrence configurable.

## 2.0.2
- Correction des métadonnées npm pour assurer l'affichage du README sur npmjs.com.

## 2.0.3
- Publication corrective du package avec README et métadonnées npm vérifiés.

## 2.0.0
- Ajout de `--supp-ref` pour supprimer les images sources après conversion réussie.
- Validation stricte de la configuration et des options CLI.
- Gestion plus sûre du cache, des conversions parallèles et du mode watch.
- Mise à jour de Sharp vers une version corrigée.

## 0.0.1
- Full TypeScript rewrite + tsup build
- Resize (`--resize`, `--max-width`)
- Multi-format simultaneous conversion (`--format webp,avif`)
- Responsive variants (`--responsive 1,2,3`)
- Output directory + suffix
- EXIF metadata stripped by default (`--keep-metadata` to keep)
- Dry run mode
- JSON / Markdown report export
- Config file (`webimg.config.json`)
- Watch mode (`--watch`)
- Hash-based cache to skip already-processed files
- Progress bar, parallel workers per CPU
- Public programmatic API

## 0.0.1
- Initial release: scan, run, interactive mode
