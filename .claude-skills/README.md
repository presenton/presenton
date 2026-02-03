# Claude Code Skills pour Presenton

Ce dossier contient les skills Claude Code pour faciliter le développement sur Presenton.

## Installation

Pour utiliser ces skills dans Claude Code, vous devez les copier dans votre dossier de configuration personnel.

### Option 1: Symlink (Recommandé)

Cela créera un lien symbolique, donc les skills seront automatiquement mis à jour quand le repo est mis à jour.

```bash
# Depuis la racine du repo
ln -s "$(pwd)/.claude-skills/create-actionable-slide.md" ~/.claude/skills/create-actionable-slide.md
```

### Option 2: Copie manuelle

```bash
# Depuis la racine du repo
cp .claude-skills/create-actionable-slide.md ~/.claude/skills/
```

Note: Avec cette méthode, vous devrez recopier le fichier manuellement si il est mis à jour.

## Skills Disponibles

### `/create-actionable-slide`

Crée un nouveau template de slide pour Actionable Intelligence en suivant toutes les conventions établies:
- Style visuel (pas de border-radius, couleurs de marque, etc.)
- Contraintes de hauteur
- Schéma Zod avec métadonnées
- Mock data pertinente pour Actionable
- Configuration charts pour export PDF/PPTX

**Utilisation:**
```
/create-actionable-slide
```

Puis suivez les instructions de Claude pour créer votre nouveau template.

## Documentation Complète

Pour la documentation détaillée avec exemples de code, patterns, et références:
👉 **`servers/nextjs/presentation-templates/actionable/README.md`**

## Vérification

Pour vérifier que le skill est bien installé:

```bash
ls -la ~/.claude/skills/ | grep create-actionable-slide
```

Vous devriez voir le fichier `create-actionable-slide.md`.

## Support

Si vous avez des questions sur la création de slides Actionable, consultez:
1. Le skill `/create-actionable-slide` pour un guide interactif
2. Le README dans `servers/nextjs/presentation-templates/actionable/`
3. Les templates existants comme exemples
4. L'équipe de développement
