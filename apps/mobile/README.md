# Application mobile Hope International

Coque native (Capacitor 8) autour du site web `apps/web`, publiee sur le Play Store et l'App Store.
L'application charge le site en ligne : les contenus, les trois langues et les comptes sont ceux du site,
sans second code a maintenir.

## Ce que l'application ajoute au site

Branche cote site dans `apps/web/src/components/native/NativeBridge.jsx` (sans effet dans un navigateur) :

- icone, ecran de demarrage et barre d'etat aux couleurs de Hope, qui suivent le theme clair / sombre ;
- bouton retour Android : page precedente, sinon accueil, puis sortie de l'application ;
- feuille de partage native (`shareContent` dans `apps/web/src/utils/native.js`) ;
- liens vers d'autres sites ouverts dans le navigateur integre ;
- page locale « hors connexion » si le site ne se charge pas au lancement.

### Dons sur iPhone (regle Apple)

Apple n'autorise le don dans une application qu'aux organismes a but non lucratif qu'il a approuves.
Tant que ce n'est pas le cas, la page de don s'ouvre dans Safari depuis l'application iOS.
Une fois l'approbation obtenue : `NEXT_PUBLIC_IOS_INAPP_DONATIONS=1` dans l'environnement du site.
Android n'est pas concerne.

## Commandes (depuis `apps/mobile`)

| Commande | Usage |
|---|---|
| `npm run android:dev` | Lance l'app sur l'emulateur ou un telephone branche, avec le site local (ports 3001 et 5000, via `adb reverse`). Le site et l'API doivent tourner (`npm run dev` a la racine). |
| `npm run android:build` | APK de test pour le site en production : `android/app/build/outputs/apk/debug/app-debug.apk` |
| `npm run android:build -- --release` | AAB pour le Play Store (a signer, voir plus bas) |
| `npm run sync` | Recopie la configuration dans les projets natifs apres un changement de `capacitor.config.js` ou de plugin |
| `npm run assets` | Regenere icones et ecrans de demarrage depuis `assets/` |
| `npm run android` / `npm run ios` | Ouvre le projet dans Android Studio / Xcode |

L'adresse du site est lue dans `HOPE_APP_URL` (defaut dans `capacitor.config.js`, a remplacer par le domaine reel).

## Avant la publication

- **Identifiant de l'application** : `org.hopeinternational.app` (`capacitor.config.js`). Il ne peut plus changer
  apres la premiere publication : a valider avant.
- **Domaine de production** en HTTPS dans `capacitor.config.js`.
- **Android** : compte Google Play Console ; cle de signature de l'organisation (keystore), a garder hors du depot.
- **iOS** : compte Apple Developer ; compilation sur un Mac avec Xcode (ou un service de build en ligne).
  Le projet utilise Swift Package Manager (pas de CocoaPods).
- **Notifications push** : etape suivante (projet Firebase pour Android, cle APNs pour iOS, stockage des
  appareils cote API).

## Notes techniques

- Gradle 9.3.1 (au lieu du 8.14.3 livre par Capacitor) : le Java fourni par Android Studio (25) n'est pas
  supporte par Gradle 8.
- Les scripts trouvent seuls le Java d'Android Studio et le SDK Android si `JAVA_HOME` / `ANDROID_HOME`
  ne sont pas definis (`scripts/env.js`).
