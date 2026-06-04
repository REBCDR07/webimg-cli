# Changelog

## 2.0.0
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

## 1.0.0
- Initial release: scan, run, interactive mode
