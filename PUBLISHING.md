# Publier sur npm

## Première publication

1. **Crée un compte** sur https://www.npmjs.com/ (avec l'username `eltkof7` si possible).
2. **Vérifie le nom** : le scope `@eltkof7` n'a pas besoin d'être unique au monde, juste à toi. Si l'username diffère, change le scope dans `package.json`.
3. **Connecte-toi en local** :
   ```bash
   pnpm login
   ```
4. **Build + tests** :
   ```bash
   pnpm install --frozen-lockfile
   pnpm run build
   pnpm test
   ```
5. **Test local** sur un autre projet :
   ```bash
   pnpm link --global
   cd /chemin/vers/autre-projet
   pnpm link --global @eltkof7/webimg-cli
   webimg scan
   ```
6. **Publier** :
   ```bash
   pnpm publish --access public
   ```
   > Le `--access public` est obligatoire pour les packages scopés gratuits.
   > Le hook `prepublishOnly` lance lint + typecheck + tests + build automatiquement.

## Mises à jour

```bash
npm version patch   # 2.0.0 → 2.0.1
npm version minor   # 2.0.0 → 2.1.0
npm version major   # 2.0.0 → 3.0.0
git push --follow-tags
pnpm publish
```

## Publication automatique (GitHub Actions)

Le workflow `.github/workflows/publish.yml` publie automatiquement à chaque **release GitHub**.

1. Sur npm : **Access Tokens** → "Generate New Token" (type **Automation**).
2. Sur GitHub repo : **Settings → Secrets → Actions** → ajouter `NPM_TOKEN` avec la valeur.
3. Créer une release : `gh release create v2.0.0 --generate-notes`.

## Test rapide après publication

```bash
npx @eltkof7/webimg-cli scan
```
