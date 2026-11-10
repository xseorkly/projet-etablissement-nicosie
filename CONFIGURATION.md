# Mise en route

1. **Nouveau projet Apps Script** (script.google.com), indépendant de tout autre. Coller le contenu de `Code.gs`.
2. Dans `Code.gs`, vérifier `PE_SHEET_ID` (Google Sheet) et `PE_FOLDER_ID` (dossier Drive).
3. *Paramètres du projet → Propriétés du script* : ajouter `ADMIN_CODE` = le code administrateur (il n'est pas dans le dépôt public).
4. Exécuter une fois `setupProjetEtablissement` et accepter les autorisations (crée les onglets Groupes, Rubriques, Contributions et les sous-dossiers Drive « Groupes » et « Exports »).
5. *Déployer → Nouveau déploiement → Application Web* : exécuter en tant que **Moi**, accès **Tout le monde**. Copier l'URL `/exec`.
6. Dans `projet.js`, coller cette URL dans `const ENDPOINT = '';`.
7. Dépôt GitHub → *Settings → Pages* → branche `main`, dossier racine.
8. Après toute modification de `Code.gs` : *Déployer → Gérer les déploiements → Modifier → Nouvelle version*.

## Notes
- Les codes de groupe sont visibles de l'administrateur (tableau « Les groupes »), qui peut supprimer un groupe en cas d'oubli.
- Les contributions peuvent être en français, grec ou anglais ; la consigne IA de l'export demande une synthèse en français.
