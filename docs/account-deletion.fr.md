# Suppression de compte et webhooks des projets

[English](account-deletion.md)

## Fonctionnement actuel

Le menu utilisateur propose la suppression complète via le point d’entrée natif
Better Auth `/api/auth/delete-user`. Une session récente de cinq minutes ou un
mot de passe est nécessaire. Les administrateurs de plateforme, propriétaires
d’organisation et sessions usurpées ne peuvent pas supprimer leur compte ;
transférer d’abord les rôles. La suppression sélective par projet n’est pas disponible.

Avant la suppression, Auth conserve durablement les projets connectés. Better
Auth supprime l’utilisateur, ses identifiants et sessions ; Auth supprime aussi ses
clés API utilisateur et vérifications associées. Les organisations et clients OAuth
sont conservés avec une référence de créateur nulle. Le traitement durable vérifie
la disparition de l’utilisateur avant de publier `user.deletion_requested` pour
chaque projet. Les échecs d’envoi sont réessayés sans restaurer l’identité centrale.

## Configuration des projets

Configurer **URL du webhook** avec le point d’entrée HTTPS `/api/webhooks/auth`.
Copier le **Secret de signature** dans `KRAKSTACK_AUTH_WEBHOOK_SECRET`, uniquement
côté serveur du récepteur. Utiliser `AuthMiddleware.layer({ onDeleteUser })` avec
le même pool SQL que le nettoyage. Seul `onDeleteUser` est obligatoire ;
`onWebhook` est facultatif pour les futurs événements. Le point d’entrée accepte
les types Auth publiés pour le projet, mais seul l’événement de suppression est
actuellement publié par ce parcours, pas tous les événements d’audit internes.

Voir le [contrat SDK](../packages/sdk/README.md#auth-webhooks-development).
Kokobi Learning est le premier récepteur. Les destinations `AuthAccountDeletionV1`
sont reconnues et deviennent `AuthProjectWebhooksV1` à l’enregistrement, sans
modifier le secret.

## Tests locaux des webhooks

Lorsque Auth fonctionne avec `bun run dev` en mode Vite `development`, enregistrer
`http://localhost:3000/api/webhooks/auth` en adaptant le port au récepteur. Le
sender de développement autorise explicitement les envois locaux, sans tunnel,
exception Vite ni modification des origines d’authentification. Copier le secret
de signature côté récepteur et le redémarrer. L’exception se limite à `localhost`,
`127.0.0.1` et `[::1]`, pas au réseau privé ni aux adresses de métadonnées.
Les builds de production désactivent l’exception, même pour une destination locale
déjà enregistrée. Utiliser un compte de test jetable, jamais un compte réel.

## Exécuteurs et déploiement

- Par défaut, `AUTH_WORKFLOW_RUNNER=single` : un seul exécuteur Auth par base.
- Pour plusieurs instances, définir `AUTH_WORKFLOW_RUNNER=http` partout, avec un
  `AUTH_WORKFLOW_HOST` privé unique et joignable, ou `POD_IP`.
- `AUTH_WORKFLOW_PORT` vaut `34431` par défaut. Autoriser les échanges privés entre
  exécuteurs. L’écoute utilise `0.0.0.0` ; ne pas exposer ce port publiquement.
- Les deux modes persistent les messages et workflows en SQL. Arrêter et drainer
  tous les anciens exécuteurs avant de changer de topologie. Ne jamais mélanger
  single et HTTP sur le même stockage, même lors d’un retour arrière. Redémarrer
  toutes les instances dans le mode choisi ; le travail durable reprend depuis SQL.
- Appliquer les migrations avant de servir et enregistrer les workflows avant
  d’accepter les requêtes. L’arrêt draine HTTP et libère le runtime partagé.

Voir les [exécuteurs HTTP KrakStack](https://krakstack.net/en/docs/workflow-layer#http-recommended).
Les dépendances locales utilisent des archives ignorées par Git, à publier puis
remplacer avant CI/déploiement. Rien n’a été publié ou déployé ici.

## Limites

Ce parcours ne garantit ni conformité juridique ni effacement complet. Les anciens
événements, invitations par courriel, exports, prestataires, télémétrie,
sauvegardes et copies externes nécessitent des politiques distinctes. Chaque
récepteur doit inventorier ses données personnelles et empêcher les écritures en
cours de les recréer. Planifier explicitement le nettoyage des reçus après 30
jours et conserver des gestionnaires idempotents après expiration.
