// Ce fichier ne devrait JAMAIS être importé par le code du renderer.
// Si vous voyez cette erreur dans votre console, cela signifie qu'un composant
// ou un service essaie d'accéder directement à la base de données.
// Veuillez corriger l'importation et utiliser `window.dbAPI` à la place.
throw new Error(
  'Accès direct à la base de données depuis le renderer interdit. Utilisez window.dbAPI.'
);
