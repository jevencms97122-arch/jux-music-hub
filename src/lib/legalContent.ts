/**
 * Contenu légal (mentions légales, CGU, politique de confidentialité) — source
 * unique réutilisée par LegalDocumentSheet, quel que soit le point d'entrée
 * (écran de connexion, Informations de l'application...).
 *
 * ⚠️ Rédigé automatiquement à partir des informations fournies par l'éditeur.
 * Ce n'est pas un avis juridique — à faire relire par un professionnel avant
 * une mise en production à plus grande échelle.
 */

export type LegalDocId = 'mentions' | 'cgu' | 'confidentialite';

export interface LegalSection {
  heading?: string;
  body: string[];
}

export interface LegalDoc {
  id: LegalDocId;
  title: string;
  updated: string;
  sections: LegalSection[];
}

const EDITOR_NAME = 'Jules EVEN';
const EDITOR_EMAIL = 'julo.even97122@gmail.com';
const EDITOR_PHONE = '+590 692 24 43 28';
const LAST_UPDATED = '21 août 2026';

export const mentionsLegales: LegalDoc = {
  id: 'mentions',
  title: 'Mentions légales',
  updated: LAST_UPDATED,
  sections: [
    {
      heading: 'Éditeur',
      body: [
        `Nexora Music est édité par ${EDITOR_NAME}, personne physique agissant à titre non professionnel (particulier), et non par une société.`,
        `Contact : ${EDITOR_EMAIL} — ${EDITOR_PHONE}`,
        "Conformément à la loi, l'adresse postale de l'éditeur n'est pas publiée ici mais peut être communiquée aux autorités compétentes sur réquisition légale.",
      ],
    },
    {
      heading: 'Directeur de la publication',
      body: [`${EDITOR_NAME}, en sa qualité d'éditeur du service.`],
    },
    {
      heading: 'Hébergement',
      body: [
        "L'application (backend et version web) est auto-hébergée par l'éditeur depuis une infrastructure personnelle — il n'y a pas d'hébergeur tiers professionnel.",
        `En cas de besoin, l'hébergeur peut être contacté aux mêmes coordonnées que l'éditeur : ${EDITOR_EMAIL}.`,
      ],
    },
    {
      heading: 'Nature du service',
      body: [
        'Nexora Music est une application communautaire, gratuite et développée bénévolement, permettant d\'écouter et de partager de la musique entre utilisateurs. Elle ne poursuit pas de but commercial.',
      ],
    },
    {
      heading: 'Propriété intellectuelle',
      body: [
        "Le nom \"Nexora Music\", l'interface, le code et les éléments graphiques de l'application sont la propriété de l'éditeur, sauf mention contraire.",
        "Les musiques et contenus publiés par les utilisateurs restent la propriété de leurs auteurs/ayants droit respectifs. Chaque utilisateur qui publie un contenu est seul responsable d'en détenir les droits (voir Conditions Générales d'Utilisation).",
      ],
    },
  ],
};

export const cgu: LegalDoc = {
  id: 'cgu',
  title: "Conditions Générales d'Utilisation",
  updated: LAST_UPDATED,
  sections: [
    {
      heading: '1. Objet',
      body: [
        "Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et l'utilisation de l'application Nexora Music. En créant un compte ou en utilisant l'application, tu acceptes sans réserve les présentes CGU.",
      ],
    },
    {
      heading: '2. Âge minimum',
      body: [
        "L'utilisation de Nexora Music est réservée aux personnes âgées d'au moins 16 ans. En dessous de cet âge, l'inscription n'est autorisée qu'avec le consentement d'un titulaire de l'autorité parentale, conformément au règlement européen sur la protection des données (RGPD).",
      ],
    },
    {
      heading: '3. Compte utilisateur',
      body: [
        "Tu es responsable de la confidentialité de tes identifiants et de toute activité effectuée depuis ton compte.",
        "Les informations fournies lors de l'inscription (email, pseudo, etc.) doivent être exactes. Un compte peut être suspendu ou supprimé en cas de non-respect des présentes CGU.",
      ],
    },
    {
      heading: '4. Contenu publié par les utilisateurs',
      body: [
        "Certains comptes disposent d'un rôle leur permettant de publier des musiques (\"PDG\" ou \"Publicateur\", attribué manuellement par l'éditeur et révocable à tout moment). En publiant un contenu, l'utilisateur garantit qu'il détient les droits nécessaires (droit d'auteur, droits voisins) ou l'autorisation de le diffuser.",
        "En publiant un contenu (musique, image de couverture, avatar, message, commentaire...), tu accordes à l'éditeur une licence non exclusive, gratuite et limitée à la durée de disponibilité du contenu sur l'application, l'autorisant à héberger, reproduire, adapter techniquement (formats, compression) et diffuser ce contenu aux autres utilisateurs, dans la seule mesure nécessaire au fonctionnement du service. Cette licence prend fin lorsque tu supprimes le contenu ou ton compte.",
        "L'éditeur n'exerce pas de contrôle systématique a priori sur les contenus publiés. Tout contenu portant atteinte à des droits de tiers (propriété intellectuelle, vie privée, etc.) doit être signalé à l'adresse " + EDITOR_EMAIL + " avec une description du contenu concerné et du motif, et sera retiré dans les meilleurs délais après vérification.",
        "L'éditeur se réserve le droit de retirer tout contenu ou de suspendre un compte ne respectant pas ces règles, sans préavis.",
      ],
    },
    {
      heading: '5. Contenus interdits',
      body: [
        "Il est interdit de publier ou de diffuser via Nexora Music : tout contenu illégal (piraté, protégé par des droits que tu ne détiens pas, diffamatoire, illicite au regard du droit français) ; tout contenu à caractère haineux, discriminatoire, violent, pornographique ou choquant ; tout contenu harcelant, menaçant ou portant atteinte à la vie privée d'autrui ; toute usurpation d'identité ; tout spam ou contenu publicitaire non sollicité ; et plus généralement tout contenu contraire à l'ordre public.",
        "Le non-respect de cette règle peut entraîner, selon la gravité, le retrait du contenu, la suspension temporaire ou la suppression définitive du compte (bannissement), à la seule appréciation de l'éditeur.",
      ],
    },
    {
      heading: '6. Fonctionnalités sociales',
      body: [
        "L'application propose des fonctionnalités sociales : abonnements, messagerie, sessions d'écoute partagées (\"session permanente\"), commentaires. Un comportement respectueux envers les autres utilisateurs est exigé. Le harcèlement, les propos haineux ou tout comportement abusif peuvent entraîner un bannissement.",
      ],
    },
    {
      heading: '7. Dons',
      body: [
        "L'application propose une option de don libre par virement bancaire (IBAN affiché dans l'app), destiné à soutenir le développement bénévole du projet. Ces dons sont volontaires, non remboursables et ne donnent droit à aucune contrepartie ni fonctionnalité supplémentaire.",
      ],
    },
    {
      heading: '8. Disponibilité et évolution du service',
      body: [
        "Le service étant hébergé par l'éditeur sur une infrastructure personnelle et développé bénévolement, aucune garantie de disponibilité continue n'est fournie. Des interruptions, ralentissements ou pertes de données peuvent survenir.",
        "L'éditeur se réserve le droit, à tout moment et sans préavis, de faire évoluer, suspendre temporairement ou définitivement arrêter tout ou partie du service, sans que cela ouvre droit à une quelconque indemnisation.",
      ],
    },
    {
      heading: '9. Résiliation',
      body: [
        "Tu peux demander la suppression de ton compte et de tes données à tout moment en écrivant à " + EDITOR_EMAIL + ".",
        "L'éditeur peut suspendre ou supprimer un compte en cas de violation des présentes CGU.",
      ],
    },
    {
      heading: '10. Responsabilité',
      body: [
        "Le service est fourni \"en l'état\", à titre gratuit et bénévole. L'éditeur ne peut être tenu responsable des dommages indirects résultant de l'utilisation ou de l'indisponibilité de l'application.",
      ],
    },
    {
      heading: '11. Droit applicable',
      body: [
        "Les présentes CGU sont soumises au droit français. Tout litige relève, à défaut d'accord amiable, des juridictions françaises compétentes.",
      ],
    },
    {
      heading: '12. Modification des CGU',
      body: [
        "Les présentes CGU peuvent être modifiées à tout moment. La poursuite de l'utilisation de l'application après modification vaut acceptation des nouvelles CGU.",
      ],
    },
  ],
};

export const confidentialite: LegalDoc = {
  id: 'confidentialite',
  title: 'Politique de confidentialité',
  updated: LAST_UPDATED,
  sections: [
    {
      heading: 'Responsable du traitement',
      body: [
        `${EDITOR_NAME}, éditeur de Nexora Music, à titre de particulier. Contact : ${EDITOR_EMAIL}.`,
        "L'éditeur n'a pas désigné de délégué à la protection des données (DPO), cette désignation n'étant pas obligatoire pour ce type d'activité. Toute question relative à tes données peut être adressée directement à l'adresse ci-dessus.",
      ],
    },
    {
      heading: 'Données collectées',
      body: [
        "Compte : adresse email, mot de passe (stocké de façon chiffrée par le serveur, jamais en clair).",
        "Profil : pseudo, prénom/nom, photo de profil, biographie, badge/rôle.",
        "Contenu et activité : musiques publiées, titres likés, republiés, playlists, messages, commentaires, historique d'écoute, sessions d'écoute partagées, abonnements/abonnés, notifications.",
        "Présence : statut \"en ligne\" / musique en cours d'écoute, visible par tes abonnés si tu actives la session permanente.",
        "Certaines préférences (thème, session permanente, réglages du lecteur) et le cache hors-ligne (musiques téléchargées) restent uniquement stockés sur ton appareil et ne sont jamais envoyés au serveur.",
        "L'email et le mot de passe sont indispensables à la création d'un compte : sans eux, il n'est pas possible d'utiliser Nexora Music (le service nécessite un compte pour fonctionner). Les autres informations de profil (prénom/nom, bio, avatar...) sont facultatives.",
      ],
    },
    {
      heading: 'Finalités',
      body: [
        "Ces données sont utilisées pour : créer et gérer ton compte, faire fonctionner les fonctionnalités sociales et d'écoute, assurer la sécurité et la modération du service (ex. bannissement en cas d'abus), et t'informer des mises à jour de l'application.",
      ],
    },
    {
      heading: 'Base légale',
      body: [
        "Le traitement repose sur l'exécution du contrat (fourniture du service auquel tu as souscrit en créant un compte) et, pour la sécurité/modération, sur l'intérêt légitime de l'éditeur à maintenir un service sain.",
      ],
    },
    {
      heading: 'Décision automatisée',
      body: [
        "Aucune décision produisant des effets juridiques ou t'affectant de manière significative n'est prise de façon automatisée ou par profilage. Le classement des morceaux (tendances, recommandations) se base uniquement sur des statistiques d'écoute agrégées, pas sur un profilage individuel.",
      ],
    },
    {
      heading: 'Partage avec des tiers',
      body: [
        "Aucune donnée n'est vendue ni partagée avec des régies publicitaires ou des outils d'analyse — l'application n'intègre aucun tracker publicitaire ni service d'analytics tiers.",
        "Si tu actives l'intégration Discord (\"Discord Rich Presence\"), le titre en cours d'écoute est transmis à ton propre client Discord, sous ton propre compte Discord — cette transmission est gérée par Discord selon sa propre politique de confidentialité, indépendante de la nôtre.",
        "Aucun prestataire de paiement n'est utilisé : les dons se font par virement bancaire manuel.",
      ],
    },
    {
      heading: 'Hébergement et sécurité',
      body: [
        "Les données sont hébergées sur un serveur auto-hébergé par l'éditeur, situé en France (Guadeloupe, territoire de l'Union européenne), en dehors de tout cloud commercial. Aucune donnée n'est transférée en dehors de l'Union européenne.",
        "⚠️ À la date de rédaction, les échanges entre l'application et le serveur ne sont pas chiffrés (connexion HTTP, pas encore HTTPS). Une mise à niveau vers une connexion chiffrée est prévue. En attendant, évite d'utiliser un mot de passe que tu utilises ailleurs.",
      ],
    },
    {
      heading: 'Durée de conservation',
      body: [
        "Tes données sont conservées tant que ton compte est actif. En cas de suppression de compte (sur simple demande à " + EDITOR_EMAIL + "), tes données personnelles sont supprimées dans un délai raisonnable, sous réserve des données nécessaires au respect d'obligations légales.",
      ],
    },
    {
      heading: 'Tes droits',
      body: [
        "Conformément au RGPD, tu disposes d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité sur tes données. Tu peux exercer ces droits à tout moment en écrivant à " + EDITOR_EMAIL + ".",
        "Tu disposes également du droit d'introduire une réclamation auprès de la CNIL (www.cnil.fr) si tu estimes que tes droits ne sont pas respectés.",
      ],
    },
    {
      heading: 'Mineurs',
      body: [
        "Le service est destiné aux personnes de 16 ans et plus. En dessous, l'inscription nécessite le consentement d'un titulaire de l'autorité parentale.",
      ],
    },
    {
      heading: 'Stockage local et « cookies »',
      body: [
        "Nexora Music n'utilise aucun cookie publicitaire ni traceur tiers. L'application utilise uniquement du stockage local technique (localStorage / IndexedDB, ou équivalent natif sur PC et Android), strictement nécessaire à son fonctionnement : ton jeton de connexion, tes préférences, et le cache des musiques téléchargées hors-ligne.",
        "Ce stockage strictement nécessaire est exempté de consentement préalable par la réglementation applicable (RGPD / directive ePrivacy) — il n'y a donc pas de bannière de consentement, mais tu peux à tout moment l'effacer en te déconnectant ou en vidant les données de l'application depuis ton appareil.",
      ],
    },
  ],
};

export const legalDocs: Record<LegalDocId, LegalDoc> = {
  mentions: mentionsLegales,
  cgu,
  confidentialite,
};
