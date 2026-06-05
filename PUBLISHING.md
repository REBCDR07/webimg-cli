# Publier sur npm

## Première publication

1. **Crée un compte** sur https://www.npmjs.com/ (avec l'username `eltkof7` si possible).
2. **Vérifie le nom** : le scope `@eltkof7` n'a pas besoin d'être unique au monde, juste à toi. Si l'username diffère, change le scope dans `package.json`.
3. **Connecte-toi en local** :
   ```bash
   npm login
   ```
4. **Build + tests** :
   ```bash
   npm install
   npm run build
   npm test
   ```
5. **Test local** sur un autre projet :
   ```bash
   npm link
   cd /chemin/vers/autre-projet
   npm link @eltkof7/webimg-cli
   webimg scan
   ```
6. **Publier** :
   ```bash
   npm publish --access public
   ```
   > Le `--access public` est obligatoire pour les packages scopés gratuits.
   > Le hook `prepublishOnly` lance lint + typecheck + tests + build automatiquement.

## Mises à jour

```bash
npm version patch   # 0.0.1 → 0.0.2
npm version minor   # 0.0.1 → 0.1.0
npm version major   # 0.0.1 → 1.0.0
git push --follow-tags
npm publish
```

## Publication automatique (GitHub Actions)

Le workflow `.github/workflows/publish.yml` publie automatiquement à chaque **release GitHub**.

1. Sur npm : **Access Tokens** → "Generate New Token" (type **Automation**).
2. Sur GitHub repo : **Settings → Secrets → Actions** → ajouter `NPM_TOKEN` avec la valeur.
3. Créer une release : `gh release create v2.0.1 --generate-notes`.

## Test rapide après publication

```bash
npx @eltkof7/webimg-cli scan
```
