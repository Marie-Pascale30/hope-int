// Contenu reel de HOPE International Project : projets, actualites et temoignages.
// Partage par le seed de developpement (seed.js) et par l'import de production (import-content.js) :
// aucune donnee de demonstration ici (ni compte, ni don, ni evenement fictif).
const { PHOTOS, photoUrl } = require("@hope/shared/photos");

// Galerie (colonne JSON) a partir d'albums ou de photos du livret : gallery("noel-2022-yaounde", "p15_03").
function gallery(...keys) {
    const photos = PHOTOS.filter((photo) => keys.includes(photo.album) || keys.includes(photo.id));
    return JSON.stringify(photos.map(({ src, width, height, kind }) => ({ src, width, height, kind })));
}

// Actions reelles de HOPE International Project (livret partenaires 2021-2025, guide de bienvenue).
// Les beneficiaires ne reprennent que les chiffres attestes par le livret ; les objectifs de collecte
// (EUR) sont indicatifs et se reglent dans l'administration. Les trois premiers projets recoivent
// les dons de demonstration (seedPayments).
const PROJECTS = [
    {
        title: "Parrainage éducatif des enfants",
        summary: "Accompagner chaque enfant parrainé de la rentrée jusqu'à son autonomie : frais de scolarité, fournitures et suivi.",
        description: "Depuis la rentrée 2023, HOPE International Project prend en charge la scolarité d'enfants orphelins ou issus de familles vulnérables, avec l'engagement de les accompagner jusqu'à leur insertion professionnelle.\n\nDieu Merci, notre premier filleul, accueilli à l'orphelinat Petit Dan & Sarah (Yaoundé), entame en 2025-2026 sa troisième année avec nous. Divine FOLIFACK, à Dschang, a rejoint le programme en 2024 en partenariat avec sa famille, et MASSOH NDAH Abigail, de l'orphelinat du Buisson Ardent (Yaoundé), en 2025.\n\nVotre don finance les frais de scolarité, les fournitures, l'uniforme et le suivi de chaque enfant. « C'est ici que l'espoir commence : un enfant, un avenir, un acte d'amour à la fois. »",
        image_url: photoUrl("p11_07"),
        gallery: gallery("rentree-2023-yaounde", "rentree-2024-yaounde", "rentree-2024-dschang", "rentree-2025-buisson-ardent", "rentree-2025-yaounde", "rentree-2025-dschang"),
        status: "en_cours", region: "Centre", start_date: "2023-09-01", end_date: null,
        budget: null, goal_amount: 1500, beneficiaries: 3, trainees: 0, credits_granted: 0,
    },
    {
        title: "Rentrée scolaire « Un sourire pour tous »",
        summary: "Chaque été, des fournitures scolaires pour les enfants défavorisés, jusque dans les villages les plus reculés.",
        description: "Chaque année, du 1er août au 1er septembre, HOPE International Project collecte et distribue des fournitures scolaires, des sacs et du matériel éducatif aux enfants qui en ont le plus besoin.\n\nNotre première rentrée solidaire a eu lieu en 2021-2022 au village de Balessing, dans l'Ouest du Cameroun. La campagne s'est depuis étendue aux orphelinats de Yaoundé et aux familles de Dschang.\n\n« Votre générosité porte l'espoir au cœur de chaque village et donne à chaque enfant la chance de rêver à nouveau. »",
        image_url: photoUrl("p06_05"),
        gallery: gallery("rentree-2021-balessing", "enseignants-2022-douala", "p15_04", "p22_01"),
        status: "en_cours", region: "Ouest", start_date: "2021-09-01", end_date: null,
        budget: null, goal_amount: 2000, beneficiaries: 0, trainees: 0, credits_granted: 0,
    },
    {
        title: "Noël de l'espoir pour les orphelins",
        summary: "La magie du cœur : vêtements, repas, friandises et jouets pour les orphelins de Douala et de Yaoundé.",
        description: "Chaque mois de décembre, nos membres partagent la joie de Noël avec les enfants des orphelinats et les familles vulnérables : vêtements, repas, friandises, jouets et moments de fête.\n\nNous avons rendu visite aux orphelinats Petit Dan & Sarah et Le Bon Berger (Nkoabang) à Yaoundé, à l'orphelinat Mère Teresa la Vénérable (ASENDEF) à Douala, ainsi qu'à une famille de Bonabéri Mabanda.\n\n« Une lumière d'amour pour les orphelins, parce que chaque enfant mérite un Noël. »",
        image_url: photoUrl("p12_12"),
        gallery: gallery("noel-2022-yaounde", "noel-2022-douala", "noel-2023-mere-teresa", "noel-2023-bonaberi", "noel-2023-bon-berger", "p15_03"),
        status: "en_cours", region: "Littoral", start_date: "2022-12-01", end_date: null,
        budget: null, goal_amount: 1500, beneficiaries: 0, trainees: 0, credits_granted: 0,
    },
    {
        title: "Autonomisation des femmes",
        summary: "Soutenir les mères seules et les femmes vulnérables dans leur activité, à l'occasion du 8 mars.",
        description: "À l'occasion de la Journée internationale des droits des femmes, HOPE International Project remet des chèques de soutien à des femmes qui font vivre leur famille avec courage et dignité.\n\nEn 2024, nous avons soutenu deux femmes à Yaoundé (snacks à base de soja, huile de palme) et, à Douala, Irène KAMENI (huile de palme) et Armelle Rofanie BOGNING NAMBOU (beignets et restauration), avec 50 000 FCFA chacune. En 2025, nous avons accompagné Sophie BESONG, femme en situation de handicap, dans son commerce à Yaoundé (75 000 FCFA).\n\nNous voulons aller plus loin : formations pratiques (couture, coiffure, agriculture…), insertion économique et, demain, microcrédit solidaire.",
        image_url: photoUrl("p17_01"),
        gallery: gallery("femmes-2024-yaounde", "femmes-2024-douala-irene", "femmes-2024-douala-armelle", "femmes-2025-yaounde", "p10_03", "p15_02", "p22_03"),
        status: "en_cours", region: "Littoral", start_date: "2024-03-08", end_date: null,
        budget: null, goal_amount: 1000, beneficiaries: 5, trainees: 0, credits_granted: 5,
    },
    {
        title: "Sensibilisation santé : VIH et drépanocytose",
        summary: "Informer le grand public sur la transmission et la prévention, et encourager le dépistage.",
        description: "HOPE International Project participe aux journées internationales de santé : Journée mondiale de lutte contre la drépanocytose le 19 juin (campagne de sensibilisation et tests d'électrophorèse en partenariat avec GEDREPACAM, 2023) et Journée mondiale de lutte contre le sida le 1er décembre (2024, 2025).\n\nNos prochaines campagnes porteront aussi sur les hépatites, les cancers et la nutrition, avec la distribution de kits d'hygiène.",
        image_url: photoUrl("p22_02"),
        gallery: gallery("p10_02", "p15_00", "p22_02", "sida-2025"),
        status: "en_cours", region: "Littoral", start_date: "2023-06-19", end_date: null,
        budget: null, goal_amount: null, beneficiaries: 0, trainees: 0, credits_granted: 0,
    },
    {
        title: "Un vêtement = Un sourire",
        summary: "Collectes de vêtements pour les camps de réfugiés, les prisons et les orphelinats.",
        description: "Deux grandes collectes de vêtements de tout genre ont été menées, du 20 novembre au 20 décembre 2022 puis du 15 novembre au 15 décembre 2023, pour habiller ceux qui ont froid : camps de réfugiés, prisons, orphelinats.",
        image_url: photoUrl("p10_01"),
        gallery: gallery("vetements-2022", "p10_01"),
        status: "termine", region: "Littoral", start_date: "2022-11-20", end_date: "2023-12-15",
        budget: null, goal_amount: null, beneficiaries: 0, trainees: 0, credits_granted: 0,
    },
    {
        title: "Académie HOPE",
        summary: "Une école avec bibliothèque, espace de loisirs, cantine et infirmerie pour les enfants défavorisés.",
        description: "Notre grand projet de développement communautaire : créer l'Académie HOPE, un lieu d'éducation complet comprenant une école, une bibliothèque, un espace de loisirs, une cantine et une infirmerie. Le projet comprend aussi la formation de bénévoles et de leaders locaux.",
        image_url: photoUrl("p20_09"),
        gallery: gallery("p20_09", "p20_05", "p25_05"),
        status: "planifie", region: "Littoral", start_date: null, end_date: null,
        budget: null, goal_amount: null, beneficiaries: 0, trainees: 0, credits_granted: 0,
    },
    {
        title: "Accès à l'eau potable dans les villages isolés",
        summary: "Construire des puits et des forages et sensibiliser à l'hygiène communautaire.",
        description: "HOPE International Project souhaite assister les communautés qui n'ont pas accès à l'eau potable : construction de puits et de forages, gestion par des comités d'habitants et sensibilisation à l'hygiène.",
        image_url: photoUrl("p21_02"),
        gallery: gallery("p21_02", "p06_07"),
        status: "planifie", region: "Ouest", start_date: null, end_date: null,
        budget: null, goal_amount: null, beneficiaries: 0, trainees: 0, credits_granted: 0,
    },
    {
        title: "Microcrédit et entrepreneuriat solidaire",
        summary: "Piste de développement : des microcrédits à taux solidaire pour les mères et les jeunes porteurs de projet.",
        description: "Dans le prolongement des chèques de soutien du 8 mars, nous étudions la création d'un programme de microcrédit solidaire : petits prêts accompagnés d'une formation en gestion et d'un suivi régulier, remboursements réinvestis dans de nouvelles activités (commerce de proximité, transformation agricole, couture, élevage).\n\nCe projet est à l'étude ; il sera lancé lorsque les partenariats et les ressources nécessaires seront réunis.",
        image_url: photoUrl("p23_05"),
        gallery: gallery("p16_06", "p16_08", "p23_04", "p23_05"),
        status: "planifie", region: "Littoral", start_date: null, end_date: null,
        budget: null, goal_amount: null, beneficiaries: 0, trainees: 0, credits_granted: 0,
    },
    {
        title: "Formations pratiques pour les jeunes filles mères",
        summary: "Couture, coiffure, agriculture… pour permettre aux jeunes mères de subvenir dignement aux besoins de leurs enfants.",
        description: "Accompagnement social et psychologique, formations pratiques (couture, coiffure, agriculture, mécanique, bâtiment) et aide à l'insertion économique des jeunes filles mères. Le programme pourra s'appuyer sur des groupes d'entraide et sur le futur microcrédit solidaire.",
        image_url: photoUrl("p16_03"),
        gallery: gallery("p16_03", "p18_04"),
        status: "planifie", region: "Centre", start_date: null, end_date: null,
        budget: null, goal_amount: null, beneficiaries: 0, trainees: 0, credits_granted: 0,
    },
];

// Actualites reelles, redigees a partir du livret partenaires (frise, legendes d'albums, affiches de campagne).
// Seuls les faits attestes par le livret y figurent (aucun chiffre de beneficiaires invente) ; le reste du
// texte est une meditation sur l'action, appuyee sur des versets (Bible Louis Segond 1910, domaine public).
// project = index dans PROJECTS : 0 Parrainage, 1 Rentree, 2 Noel, 3 Femmes, 4 Sante, 5 Vetements.
const paragraphs = (...items) => items.join("\n\n");

const NEWS = [
    {
        title: "Rentrée 2021 : notre première grande action à Balessing",
        summary: "Pour la rentrée 2021-2022, HOPE International Project a remis des fournitures scolaires aux enfants du village de Balessing, dans l'Ouest du Cameroun. Une première grande action, et le début d'une longue route.",
        content: paragraphs(
            "Tout a commencé dans un village. Pour la rentrée scolaire 2021-2022, les membres de HOPE International Project se sont rendus à Balessing, dans la région de l'Ouest du Cameroun, pour distribuer des fournitures scolaires aux enfants du village. C'était notre première grande action sur le terrain.",
            "Dans beaucoup de familles, la rentrée est un moment d'inquiétude plus que de joie. Cahiers, stylos, sacs : chaque article pèse sur un budget déjà serré, et certains enfants commencent l'année sans le matériel dont ils ont besoin. Nous avons voulu que, cette année-là, les enfants de Balessing franchissent la porte de l'école avec ce qu'il leur faut pour apprendre.",
            "Notre conviction vient de l'Écriture : « Instruis l'enfant selon la voie qu'il doit suivre ; Et quand il sera vieux, il ne s'en détournera pas. » (Proverbes 22:6). L'éducation n'est pas un luxe : c'est une semence que l'on dépose dans une vie et qui porte du fruit pendant des années.",
            "Jésus lui-même accueillait les enfants avec tendresse : « Laissez venir à moi les petits enfants, et ne les en empêchez pas ; car le royaume de Dieu est pour ceux qui leur ressemblent. » (Marc 10:14). Prendre soin d'eux, c'est prendre au sérieux la valeur que Dieu leur accorde.",
            "Ce premier pas pouvait sembler modeste. Mais la Bible nous rappelle de ne pas mépriser « le jour des faibles commencements » (Zacharie 4:10). Balessing a posé les bases de tout ce qui a suivi : parrainages, visites dans les orphelinats, soutien aux femmes et campagnes de santé.",
            "Nous croyons que Dieu a pour chaque enfant « des projets de paix et non de malheur, afin de vous donner un avenir et de l'espérance » (Jérémie 29:11). Un cahier neuf et un stylo ne changent pas tout, mais ils disent à un enfant que son avenir compte.",
            "Depuis, la rentrée scolaire est devenue un rendez-vous de chaque année pour l'association, de Balessing à Yaoundé et à Dschang. « Ne nous lassons pas de faire le bien ; car nous moissonnerons au temps convenable, si nous ne nous relâchons pas. » (Galates 6:9). Merci à tous ceux qui ont rendu ce premier pas possible."
        ),
        image: "p06_01", imageAlt: "Remise de fournitures scolaires aux enfants de Balessing",
        gallery: ["rentree-2021-balessing"], project: 1, date: "2021-09-20",
    },
    {
        title: "Journée mondiale des enseignants à Douala",
        summary: "Le 5 octobre 2022, HOPE International Project est allée à la rencontre d'enseignantes de Douala pour leur remettre des présents et saluer leur vocation auprès des enfants.",
        content: paragraphs(
            "À l'occasion de la Journée mondiale des enseignants, le 5 octobre 2022, nos membres sont allés à la rencontre d'enseignantes de Douala pour leur remettre des présents et saluer leur vocation.",
            "Derrière chaque enfant qui apprend à lire, à compter et à rêver, il y a un enseignant qui a donné de son temps, de sa patience et souvent de ses propres moyens. Ce travail se fait dans la discrétion, jour après jour, et il est trop rarement remercié.",
            "La Bible honore ceux qui transmettent : « Ceux qui auront été intelligents brilleront comme la splendeur du ciel, et ceux qui auront enseigné la justice à la multitude brilleront comme les étoiles, à toujours et à perpétuité. » (Daniel 12:3). Enseigner, c'est allumer des lumières qui continuent de briller longtemps après la fin de la classe.",
            "L'apôtre Paul encourage chacun à servir selon le don qu'il a reçu : « que celui qui enseigne s'attache à son enseignement » (Romains 12:7). Nous avons voulu dire aux enseignantes de Douala que leur fidélité est vue et qu'elle compte.",
            "Car l'instruction est un trésor à garder : « Retiens l'instruction, ne t'en dessaisis pas ; Garde-la, car elle est ta vie. » (Proverbes 4:13). Soutenir les enseignants dans l'exercice de leur métier, c'est soutenir tous les enfants qui leur sont confiés.",
            "Cette journée fait partie de notre engagement pour l'éducation, aux côtés des rentrées scolaires et du parrainage. « Exhortez-vous réciproquement, et édifiez-vous les uns les autres » (1 Thessaloniciens 5:11) : un simple merci peut redonner des forces pour toute une année.",
            "À tous les enseignants qui croient en leurs élèves : merci pour votre vocation."
        ),
        image: "p07_05", imageAlt: "Enseignants réunis à Douala pour la Journée mondiale des enseignants",
        gallery: ["enseignants-2022-douala"], project: null, date: "2022-10-05",
    },
    {
        title: "Un vêtement = Un sourire : notre première collecte de vêtements",
        summary: "Du 20 novembre au 20 décembre 2022, nous avons collecté à Douala des vêtements de tout genre pour les orphelinats, les camps de réfugiés et les prisons.",
        content: paragraphs(
            "Du 20 novembre au 20 décembre 2022, HOPE International Project a lancé à Douala sa première collecte « Un vêtement = Un sourire ».",
            "L'idée est simple : un vêtement que l'on ne porte plus peut réchauffer et redonner le sourire à quelqu'un qui en manque. Nous avons recueilli des vêtements de tout genre, destinés aux orphelinats, aux camps de réfugiés et aux prisons.",
            "Ces trois lieux ne sont pas choisis au hasard. Jésus les nomme lui-même lorsqu'il parle de ceux qu'il nous appelle à servir : « Car j'ai eu faim, et vous m'avez donné à manger ; j'ai eu soif, et vous m'avez donné à boire ; j'étais étranger, et vous m'avez recueilli ; j'étais nu, et vous m'avez vêtu ; j'étais malade, et vous m'avez visité ; j'étais en prison, et vous êtes venus vers moi. » (Matthieu 25:35-36).",
            "Et il ajoute ces mots qui changent notre regard sur chaque don : « Je vous le dis en vérité, toutes les fois que vous avez fait ces choses à l'un de ces plus petits de mes frères, c'est à moi que vous les avez faites. » (Matthieu 25:40).",
            "Jean-Baptiste répondait déjà à la foule qui lui demandait que faire : « Que celui qui a deux tuniques partage avec celui qui n'en a point, et que celui qui a de quoi manger agisse de même. » (Luc 3:11). Le partage commence souvent dans nos armoires.",
            "Le prophète Ésaïe décrit le jeûne qui plaît à Dieu : « Partage ton pain avec celui qui a faim, Et fais entrer dans ta maison les malheureux sans asile ; Si tu vois un homme nu, couvre-le, Et ne te détourne pas de ton semblable. » (Ésaïe 58:7).",
            "Merci à toutes celles et à tous ceux qui ont ouvert leurs armoires pour ce geste. « Que chacun donne comme il l'a résolu en son cœur, sans tristesse ni contrainte ; car Dieu aime celui qui donne avec joie. » (2 Corinthiens 9:7)."
        ),
        image: "p05_01", imageAlt: "Affiche de la collecte « Un vêtement = Un sourire » 2022",
        gallery: ["vetements-2022"], project: 5, date: "2022-11-20",
    },
    {
        title: "Noël 2022 dans les orphelinats de Yaoundé et de Douala",
        summary: "Cadeaux, friandises et moments de partage avec les enfants de l'orphelinat Petit Dan & Sarah, à Yaoundé, et d'un orphelinat de Douala, sous la bannière « Un sourire pour tous ».",
        content: paragraphs(
            "En décembre 2022, HOPE International Project a voulu que Noël soit aussi une fête pour les enfants qui grandissent loin de leur famille.",
            "À Yaoundé, nos membres ont passé un moment de partage avec les enfants de l'orphelinat Petit Dan & Sarah : cadeaux, friandises et beaucoup de joie. À Douala, des jouets et des cadeaux ont été remis aux enfants d'un orphelinat, sous la bannière « Un sourire pour tous ».",
            "Noël est l'annonce d'une bonne nouvelle pour tous, sans exception : « Ne craignez point ; car je vous annonce une bonne nouvelle, qui sera pour tout le peuple le sujet d'une grande joie : c'est qu'aujourd'hui, dans la ville de David, il vous est né un Sauveur, qui est le Christ, le Seigneur. » (Luc 2:10-11). Cette joie appartient aussi aux enfants des orphelinats.",
            "« Car Dieu a tant aimé le monde qu'il a donné son Fils unique » (Jean 3:16). À Noël, Dieu s'est donné lui-même. Offrir un cadeau à un enfant qui n'en attendait pas, c'est refléter, à notre petite mesure, ce don immense.",
            "L'Écriture place les orphelins au cœur de la foi vivante : « La religion pure et sans tache, devant Dieu notre Père, consiste à visiter les orphelins et les veuves dans leurs afflictions » (Jacques 1:27). Visiter, c'est d'abord être présent : s'asseoir, jouer, écouter, rire ensemble.",
            "Ces enfants ne sont pas oubliés de Dieu : « Le père des orphelins, le défenseur des veuves, C'est Dieu dans sa demeure sainte. » (Psaume 68:6). Et Jésus nous dit : « quiconque reçoit en mon nom un petit enfant comme celui-ci, me reçoit moi-même. » (Matthieu 18:5).",
            "Ces visites ont marqué le début d'une tradition : chaque année depuis, l'association célèbre Noël aux côtés des orphelins. Merci à chaque donateur qui a permis à ces enfants de recevoir un sourire, et de savoir qu'on pense à eux."
        ),
        image: "p08_04", imageAlt: "Distribution de cadeaux de Noël à l'orphelinat Petit Dan & Sarah, à Yaoundé",
        gallery: ["noel-2022-yaounde", "noel-2022-douala"], project: 2, date: "2022-12-23",
    },
    {
        title: "8 mars 2023 : accompagner les femmes vers leur indépendance",
        summary: "Pour la Journée internationale des droits des femmes, HOPE International Project a mis à l'honneur l'autonomisation des femmes, dans l'agriculture, le commerce, l'artisanat, la couture et bien d'autres domaines.",
        content: paragraphs(
            "Le 8 mars 2023, à l'occasion de la Journée internationale des droits des femmes, HOPE International Project a consacré sa journée à l'autonomisation des femmes.",
            "Notre message : « Investir en faveur des femmes, il faut accélérer le rythme. » L'association accompagne les femmes dans leur marche vers l'indépendance, dans des domaines aussi variés que l'agriculture, le commerce, l'artisanat, la couture, l'e-commerce, l'événementiel, le secrétariat ou la restauration.",
            "La Bible dresse le portrait d'une femme forte, entreprenante et généreuse : « Elle pense à un champ, et elle l'acquiert ; Du fruit de son travail elle plante une vigne. » (Proverbes 31:16). Elle travaille, elle gère, elle fait vivre sa maison, et elle n'oublie pas les autres : « Elle tend la main au malheureux, Elle tend la main à l'indigent. » (Proverbes 31:20).",
            "Ce portrait se termine par un appel à reconnaître son travail : « Récompensez-la du fruit de son travail, Et qu'aux portes ses œuvres la louent. » (Proverbes 31:31). C'est exactement ce que nous voulons faire : reconnaître et soutenir le travail des femmes.",
            "Beaucoup de femmes que nous rencontrons ont du courage, des idées et du savoir-faire, mais pas les moyens de démarrer ou de développer leur activité. Nous croyons qu'avec un coup de pouce, elles peuvent tout changer pour elles-mêmes et pour leurs enfants. « Je puis tout par celui qui me fortifie. » (Philippiens 4:13).",
            "Aux yeux de Dieu, la dignité de chaque personne est la même : « il n'y a plus ni homme ni femme ; car tous vous êtes un en Jésus-Christ. » (Galates 3:28). Défendre les droits des femmes, c'est défendre cette dignité.",
            "Cette journée a ouvert la voie aux soutiens directs que nous apportons depuis, chaque 8 mars, à des femmes entrepreneures. « Recommande à l'Éternel tes œuvres, Et tes projets réussiront. » (Proverbes 16:3)."
        ),
        image: "p10_03", imageAlt: "Affiche HOPE International pour le 8 mars",
        gallery: ["p10_03"], project: 3, date: "2023-03-08",
    },
    {
        title: "Drépanocytose : une campagne de dépistage avec le GEDREPACAM",
        summary: "Le 19 juin 2023, Journée mondiale de lutte contre la drépanocytose, nous avons invité le public de Yaoundé et de Douala à faire le test d'électrophorèse de l'hémoglobine, en partenariat avec le GEDREPACAM.",
        content: paragraphs(
            "Le 19 juin 2023, pour la Journée mondiale de lutte contre la drépanocytose, HOPE International Project a mené une grande campagne de sensibilisation à Yaoundé et à Douala, en partenariat avec le GEDREPACAM.",
            "La drépanocytose est une maladie génétique du sang. Connaître son statut grâce au test d'électrophorèse de l'hémoglobine permet de mieux se protéger et de faire des choix éclairés, notamment au moment de fonder une famille. C'est pourquoi la campagne invitait chacun à se faire tester.",
            "Le prophète Osée avertissait : « Mon peuple est détruit, parce qu'il lui manque la connaissance. » (Osée 4:6). En matière de santé aussi, l'information protège. Un simple test peut éviter bien des souffrances.",
            "Prendre soin de son corps n'est pas contraire à la foi, c'est une manière d'honorer Dieu qui nous a créés : « Je te loue de ce que je suis une créature si merveilleuse. Tes œuvres sont admirables, Et mon âme le reconnaît bien. » (Psaume 139:14).",
            "Pour celles et ceux qui vivent avec la maladie, nous voulons porter un message d'espérance : « Mais je te guérirai, je panserai tes plaies, Dit l'Éternel. » (Jérémie 30:17). Nous désirons pour chacun ce que l'apôtre Jean souhaitait à son ami : « je souhaite que tu prospères à tous égards et sois en bonne santé, comme prospère l'état de ton âme. » (3 Jean 1:2).",
            "Comme le rappelait notre affiche : « Pour sauver une vie, il n'est pas nécessaire d'être médecin. » Parler de la maladie, encourager un proche à se faire dépister, soutenir une famille touchée : chacun peut agir. « Portez les fardeaux les uns des autres, et vous accomplirez ainsi la loi de Christ. » (Galates 6:2).",
            "Merci au GEDREPACAM pour ce partenariat, et à tous ceux qui ont pris le temps de s'informer et de se faire tester."
        ),
        image: "p10_02", imageAlt: "Affiche de la Journée mondiale de lutte contre la drépanocytose, 19 juin",
        gallery: ["p10_02"], project: 4, date: "2023-06-19",
    },
    {
        title: "Rentrée 2023 : Dieu Merci devient notre premier filleul",
        summary: "À l'orphelinat Petit Dan & Sarah, à Yaoundé, HOPE International Project prend en charge la scolarité de Dieu Merci : le lancement de notre programme de parrainage éducatif.",
        content: paragraphs(
            "La rentrée 2023-2024 marque une étape importante pour HOPE International Project : le lancement de notre programme de parrainage éducatif.",
            "À l'orphelinat Petit Dan & Sarah, à Yaoundé, nous prenons désormais en charge la scolarité de Dieu Merci, notre premier filleul. Lors de notre visite, des vivres et des fournitures ont aussi été remis aux enfants de l'orphelinat.",
            "Son prénom est à lui seul une prière de reconnaissance. Il nous rappelle que chaque enfant est un don : « Voici, des fils sont un héritage de l'Éternel » (Psaume 127:3). Pour un enfant qui grandit sans ses parents, savoir que quelqu'un s'engage pour son avenir change beaucoup de choses.",
            "Dieu se présente lui-même comme le protecteur de ces enfants : « Le père des orphelins, le défenseur des veuves, C'est Dieu dans sa demeure sainte. » (Psaume 68:6). Par le parrainage, nous voulons être ses mains, concrètement, année après année.",
            "Parrainer un enfant, c'est s'engager dans la durée. Ce n'est pas un don ponctuel, mais une promesse : être là à chaque rentrée, suivre ses progrès, l'encourager. « Instruis l'enfant selon la voie qu'il doit suivre ; Et quand il sera vieux, il ne s'en détournera pas. » (Proverbes 22:6).",
            "Jésus nous dit : « quiconque reçoit en mon nom un petit enfant comme celui-ci, me reçoit moi-même. » (Matthieu 18:5). Accueillir Dieu Merci dans notre programme, c'est accueillir le Christ lui-même.",
            "Ce parrainage est renouvelé à chaque rentrée depuis. Et nous gardons confiance pour la suite : « celui qui a commencé en vous cette bonne œuvre la rendra parfaite pour le jour de Jésus-Christ. » (Philippiens 1:6)."
        ),
        image: "p11_00", imageAlt: "Rentrée scolaire 2023 à Yaoundé avec Dieu Merci, premier filleul de HOPE",
        gallery: ["rentree-2023-yaounde"], project: 0, date: "2023-09-10",
    },
    {
        title: "Un vêtement = Un sourire, deuxième édition",
        summary: "Du 15 novembre au 15 décembre 2023, nous avons de nouveau collecté des vêtements pour habiller ceux qui ont froid, redistribués aux familles et aux enfants dans le besoin.",
        content: paragraphs(
            "Après la première collecte de 2022, « Un vêtement = Un sourire » est revenue du 15 novembre au 15 décembre 2023.",
            "« Nous collectons des vêtements pour habiller ceux qui ont froid » : tel était le message de cette deuxième édition. Les vêtements recueillis ont été redistribués aux familles et aux enfants dans le besoin.",
            "L'apôtre Jacques pose une question qui ne laisse pas de place aux beaux discours : « Si un frère ou une sœur sont nus et manquent de la nourriture de chaque jour, et que l'un d'entre vous leur dise : Allez en paix, chauffez-vous et vous rassasiez ! et que vous ne leur donniez pas ce qui est nécessaire au corps, à quoi cela sert-il ? » (Jacques 2:15-16).",
            "Et il conclut : « Il en est ainsi de la foi : si elle n'a pas les œuvres, elle est morte en elle-même. » (Jacques 2:17). C'est l'un des versets qui fondent notre association : notre foi veut se traduire en actes concrets.",
            "La Loi de Moïse le disait déjà : « Il y aura toujours des indigents dans le pays ; c'est pourquoi je te donne ce commandement : Tu ouvriras ta main à ton frère, au pauvre et à l'indigent dans ton pays. » (Deutéronome 15:11).",
            "Un vêtement chaud, une tenue propre pour aller à l'école ou au travail : ce sont de petites choses qui rendent de la dignité. « Si tu vois un homme nu, couvre-le, Et ne te détourne pas de ton semblable. » (Ésaïe 58:7).",
            "Merci à chaque donateur pour ce geste simple, à la portée de tous, qui change le quotidien de ceux qui le reçoivent. « N'oubliez pas la bienfaisance et la libéralité, car c'est à de tels sacrifices que Dieu prend plaisir. » (Hébreux 13:16)."
        ),
        image: "p10_01", imageAlt: "Affiche de la collecte « Un vêtement = Un sourire » 2023",
        gallery: ["p10_01"], project: 5, date: "2023-11-15",
    },
    {
        title: "Une lumière d'amour pour les orphelins de Douala",
        summary: "Noël 2023 à l'orphelinat Mère Teresa la Vénérable (ASENDEF), auprès d'une famille de Bonabéri Mabanda et à l'orphelinat Le Bon Berger, à Nkoabang.",
        content: paragraphs(
            "Pour Noël 2023, nos membres ont partagé la magie du cœur avec les enfants de l'orphelinat Mère Teresa la Vénérable (ASENDEF) à Douala : vêtements, vivres, friandises et un après-midi de fête. Nous avons aussi rendu visite à une famille de Bonabéri Mabanda, avec des colis et beaucoup de sourires.",
            "À Yaoundé, les enfants de l'orphelinat Le Bon Berger, à Nkoabang, ont reçu la même visite : bonnets de Noël, cadeaux et vêtements.",
            "Noël, c'est la lumière qui entre dans l'obscurité : « La lumière luit dans les ténèbres, et les ténèbres ne l'ont point reçue. » (Jean 1:5). Pour un enfant seul, un après-midi de fête peut être cette lumière, un souvenir qui réchauffe longtemps.",
            "Le nom de l'orphelinat de Nkoabang nous a fait penser aux paroles de Jésus : « Je suis le bon berger. Le bon berger donne sa vie pour ses brebis. » (Jean 10:11). Et au psaume que tant d'enfants apprennent par cœur : « L'Éternel est mon berger : je ne manquerai de rien. » (Psaume 23:1).",
            "Visiter les orphelins n'est pas une option dans la vie chrétienne : « La religion pure et sans tache, devant Dieu notre Père, consiste à visiter les orphelins et les veuves dans leurs afflictions » (Jacques 1:27). Cette année encore, nous avons voulu être présents, simplement.",
            "Chaque colis remis, chaque vêtement offert a été fait pour lui : « toutes les fois que vous avez fait ces choses à l'un de ces plus petits de mes frères, c'est à moi que vous les avez faites. » (Matthieu 25:40).",
            "« Je vous annonce une bonne nouvelle, qui sera pour tout le peuple le sujet d'une grande joie » (Luc 2:10). Parce que chaque enfant mérite un Noël, merci à tous ceux qui ont rendu ces visites possibles."
        ),
        image: "p12_12", imageAlt: "Moment de partage à l'orphelinat Mère Teresa la Vénérable, à Douala",
        gallery: ["noel-2023-mere-teresa", "noel-2023-bonaberi", "noel-2023-bon-berger"], project: 2, date: "2023-12-22",
    },
    {
        title: "8 mars 2024 : quatre femmes entrepreneures soutenues",
        summary: "Quatre femmes ont chacune reçu un chèque de 50 000 FCFA pour développer leur activité : deux à Yaoundé, et à Douala Irène Kameni et Armelle Rofanie Bogning Nambou.",
        content: paragraphs(
            "Pour la Journée internationale des droits des femmes 2024, HOPE International Project est passée des mots aux actes.",
            "Quatre femmes ont chacune reçu un chèque de 50 000 FCFA pour développer leur activité. À Yaoundé, deux entrepreneures ont été soutenues : l'une fabrique des snacks au soja, l'autre produit de l'huile de palme. À Douala, Irène Kameni a reçu ce soutien pour son commerce, et Armelle Rofanie Bogning Nambou pour son activité.",
            "Ces femmes ont déjà ce que l'argent ne peut pas acheter : le courage, le savoir-faire et la volonté de faire vivre leur famille. La Bible les décrirait ainsi : « Elle ceint de force ses reins, Et elle affermit ses bras. » (Proverbes 31:17). Notre rôle est simplement de leur donner un coup de pouce.",
            "Nous croyons à la force de l'entraide : « Deux valent mieux qu'un, parce qu'ils retirent un bon salaire de leur travail. Car, s'ils tombent, l'un relève son compagnon » (Ecclésiaste 4:9-10). Aucune de ces femmes ne doit se sentir seule face aux difficultés.",
            "Aider une femme à faire grandir son activité, c'est aussi soutenir ses enfants, leur scolarité, leur santé, et souvent toute une famille élargie. Le bien semé ainsi se multiplie : « Donnez, et il vous sera donné : on versera dans votre sein une bonne mesure, serrée, secouée et qui déborde » (Luc 6:38).",
            "Nous confions leurs projets au Seigneur : « Recommande à l'Éternel tes œuvres, Et tes projets réussiront. » (Proverbes 16:3). Et nous voulons honorer leur travail, comme le demande l'Écriture : « Récompensez-la du fruit de son travail, Et qu'aux portes ses œuvres la louent. » (Proverbes 31:31).",
            "Merci à nos donateurs : grâce à vous, quatre femmes regardent l'avenir avec plus de confiance."
        ),
        image: "p17_01", imageAlt: "Remise d'un chèque de soutien à une femme entrepreneure à Douala",
        gallery: ["femmes-2024-yaounde", "femmes-2024-douala-irene", "femmes-2024-douala-armelle"], project: 3, date: "2024-03-08",
    },
    {
        title: "Soutien à Noël Clinton, au service des personnes de la rue",
        summary: "Un ancien sans-abri devenu aidant reçoit 100 000 FCFA pour poursuivre son engagement auprès des personnes qui vivent dans la rue à Douala.",
        content: paragraphs(
            "Le 19 juin 2024, HOPE International Project a apporté un soutien de 100 000 FCFA à Noël Clinton, un homme de bonne volonté qui a lui-même vécu dans la rue.",
            "Après avoir reçu son appel, Noël Clinton prend aujourd'hui soin des personnes sans abri à Douala. Il connaît leur réalité de l'intérieur : le froid, la faim, le regard des passants, la solitude. C'est précisément ce qui rend son engagement si précieux.",
            "Son parcours illustre une promesse de l'Écriture : Dieu « nous console dans toutes nos afflictions, afin que, par la consolation dont nous sommes l'objet de la part de Dieu, nous puissions consoler ceux qui se trouvent dans quelque affliction ! » (2 Corinthiens 1:4). Celui qui a été relevé devient à son tour celui qui relève.",
            "Dans la parabole du bon Samaritain, Jésus montre que l'amour du prochain commence par un regard : « Mais un Samaritain, qui voyageait, étant venu là, fut ému de compassion lorsqu'il le vit. » (Luc 10:33). Noël Clinton s'arrête là où tant d'autres passent leur chemin.",
            "Le prophète Ésaïe promet une lumière à ceux qui prennent soin des plus pauvres : « Si tu donnes ta propre subsistance à celui qui a faim, Si tu rassasies l'âme indigente, Ta lumière se lèvera sur l'obscurité, Et tes ténèbres seront comme le midi. » (Ésaïe 58:10).",
            "« Heureux celui qui s'intéresse au pauvre ! Au jour du malheur l'Éternel le délivre » (Psaume 41:2). En soutenant Noël Clinton, nous avons voulu fortifier quelqu'un qui est déjà sur le terrain, au plus près de ceux que personne ne voit.",
            "HOPE International Project reste engagée auprès de ceux qui sont dans le besoin. Et nous disons à Noël Clinton, comme à tous ceux qui servent dans l'ombre : « Ne nous lassons pas de faire le bien ; car nous moissonnerons au temps convenable, si nous ne nous relâchons pas. » (Galates 6:9)."
        ),
        image: "p19_03", imageAlt: "Remise du soutien à Noël Clinton, à Douala",
        gallery: ["solidarite-rue-2024"], project: null, date: "2024-06-19",
    },
    {
        title: "Back to school 2024 : deux enfants parrainés",
        summary: "Deuxième année de parrainage pour Dieu Merci à Yaoundé, première année pour Divine Folifack à Dschang, après notre campagne « Back to school » du 1er au 30 août 2024.",
        content: paragraphs(
            "Du 1er au 30 août 2024, notre campagne « Back to school » a appelé chacun à faire un geste pour scolariser les plus démunis. Son message : « Votre don peut changer leur histoire. »",
            "L'affiche de la campagne reprenait une promesse des Proverbes : « Celui qui a pitié du pauvre prête à l'Éternel, Qui lui rendra selon son œuvre. » (Proverbes 19:17). Donner pour la scolarité d'un enfant, c'est faire un prêt à Dieu lui-même.",
            "Grâce à vous, la rentrée 2024 a compté deux enfants parrainés. À Yaoundé, nous sommes retournés à l'orphelinat Petit Dan & Sarah pour la deuxième année de parrainage de Dieu Merci, avec des fournitures pour les enfants.",
            "À Dschang, Divine Folifack a commencé sa première année de parrainage : sac, uniforme et fournitures lui ont été remis en présence de sa famille. Ce parrainage est né d'un partenariat avec sa famille, qui reste au cœur de son parcours.",
            "Revenir une deuxième année auprès de Dieu Merci compte autant que d'accueillir Divine. Le parrainage est une fidélité : « Ne nous lassons pas de faire le bien ; car nous moissonnerons au temps convenable, si nous ne nous relâchons pas. » (Galates 6:9).",
            "Nous prions pour ces enfants avec les mots du prophète : « Tous tes fils seront disciples de l'Éternel, Et grande sera la postérité de tes fils. » (Ésaïe 54:13). Que leur scolarité leur ouvre toutes les portes que Dieu a préparées pour eux.",
            "« Instruis l'enfant selon la voie qu'il doit suivre ; Et quand il sera vieux, il ne s'en détournera pas. » (Proverbes 22:6). Merci à chaque donateur de la campagne : votre don a vraiment changé leur histoire."
        ),
        image: "p21_01", imageAlt: "Rentrée scolaire 2024 à Dschang avec Divine Folifack",
        gallery: ["rentree-2024-dschang", "rentree-2024-yaounde", "p15_04"], project: 0, date: "2024-08-30",
    },
    {
        title: "1er décembre 2024 : suivons le chemin des droits",
        summary: "Pour la Journée mondiale de lutte contre le sida, HOPE International Project a mené une campagne de sensibilisation au VIH autour du thème « Suivons le chemin des droits ».",
        content: paragraphs(
            "Le 1er décembre 2024, Journée mondiale de lutte contre le sida, HOPE International Project s'est mobilisée autour du thème « Suivons le chemin des droits ».",
            "Comme le rappelait notre affiche, le Cameroun comptait en 2022 plus de 500 000 personnes vivant avec le VIH. Notre campagne invitait chacun à leur apporter son soutien, « parce que c'est eux, mais ça aurait pu être nous ».",
            "Trop souvent, les personnes vivant avec le VIH souffrent autant du rejet que de la maladie. Jésus, lui, n'a jamais tenu les malades à distance. Face à un lépreux que tout le monde fuyait, « Jésus, ému de compassion, étendit la main, le toucha » (Marc 1:41). Toucher, accueillir, ne pas juger : voilà le chemin qu'il nous montre.",
            "À ceux qui voulaient condamner, il a répondu : « Que celui de vous qui est sans péché jette le premier la pierre » (Jean 8:7). La stigmatisation n'a pas sa place dans une communauté qui se réclame de l'amour du Christ.",
            "L'Écriture nous demande de prendre la défense de ceux qu'on n'écoute pas : « Ouvre ta bouche pour le muet, Pour la cause de tous les délaissés. Ouvre ta bouche, juge avec justice, Et défends le malheureux et l'indigent. » (Proverbes 31:8-9). Défendre les droits des personnes vivant avec le VIH, c'est obéir à cet appel.",
            "« On t'a fait connaître, ô homme, ce qui est bien ; Et ce que l'Éternel demande de toi, C'est que tu pratiques la justice, Que tu aimes la miséricorde, Et que tu marches humblement avec ton Dieu. » (Michée 6:8).",
            "Sensibiliser, lutter contre la stigmatisation et encourager la prévention font partie de notre engagement pour la santé. « Pleurez avec ceux qui pleurent » (Romains 12:15) : être présent aux côtés de ceux qui souffrent, c'est déjà les soutenir."
        ),
        image: "p15_00", imageAlt: "Affiche de la Journée internationale de lutte contre le VIH, 1er décembre",
        gallery: ["p15_00"], project: 4, date: "2024-12-01",
    },
    {
        title: "La magie de Noël pour les orphelins",
        summary: "Vêtements, repas, friandises, jouets et manège : en décembre 2024, HOPE International Project a organisé « La magie de Noël pour les orphelins ». Un geste, une joie.",
        content: paragraphs(
            "En décembre 2024, HOPE International Project a organisé « La magie de Noël pour les orphelins ».",
            "Au programme pour les enfants : vêtements, repas, friandises, jouets et même un manège. Notre devise pour l'occasion : « Un geste, une joie. »",
            "L'affiche de la campagne reprenait la promesse des Proverbes : « Celui qui a pitié du pauvre prête à l'Éternel, Qui lui rendra selon son œuvre. » (Proverbes 19:17). Ce que nous donnons aux plus petits, Dieu le reçoit comme fait à lui-même.",
            "Jésus nous a laissé cette parole, rapportée par l'apôtre Paul : « Il y a plus de bonheur à donner qu'à recevoir. » (Actes 20:35). Tous ceux qui ont déjà vu le visage d'un enfant découvrir un cadeau le savent : la joie de donner dépasse celle de recevoir.",
            "Noël nous rappelle que Dieu est venu dans le monde comme un enfant : « Car un enfant nous est né, un fils nous est donné, Et la domination reposera sur son épaule ; On l'appellera Admirable, Conseiller, Dieu puissant, Père éternel, Prince de la paix. » (Ésaïe 9:5). Comment ne pas voir dans chaque enfant un reflet de cet enfant-là ?",
            "Jésus voulait que les enfants aient une place près de lui : « Laissez les petits enfants, et ne les empêchez pas de venir à moi ; car le royaume des cieux est pour ceux qui leur ressemblent. » (Matthieu 19:14). Un manège, un repas de fête, un jouet : autant de façons de dire à un orphelin qu'il a sa place, lui aussi.",
            "Merci à chaque donateur qui a permis à ces enfants de vivre un vrai Noël. Que Dieu, « le père des orphelins » (Psaume 68:6), vous rende au centuple la joie que vous avez semée."
        ),
        image: "p15_03", imageAlt: "Affiche « La magie de Noël pour les orphelins »",
        gallery: ["p15_03"], project: 2, date: "2024-12-20",
    },
    {
        title: "8 mars 2025 : soutien à Sophie BESONG",
        summary: "Pour la Journée internationale des droits des femmes, nous avons soutenu avec 75 000 FCFA le commerce de Sophie Besong, femme vivant avec un handicap, à Yaoundé.",
        content: paragraphs(
            "En cette Journée internationale des droits des femmes 2025, HOPE International Project célèbre la remarquable résilience de Sophie BESONG, femme vivant avec un handicap, que nous avons eu l'honneur de soutenir avec un chèque de 75 000 FCFA et du matériel pour son commerce, à Yaoundé.",
            "Son parcours reflète la force et l'espoir au cœur de notre mission. Malgré les obstacles, Sophie tient son commerce et fait vivre son activité avec dignité.",
            "L'apôtre Paul a connu la faiblesse, et Dieu lui a répondu : « Ma grâce te suffit, car ma puissance s'accomplit dans la faiblesse. » (2 Corinthiens 12:9). Le handicap ne diminue en rien la valeur d'une personne ni la grandeur de ce qu'elle peut accomplir.",
            "Sophie nous rappelle que chaque être humain est une œuvre de Dieu : « Je te loue de ce que je suis une créature si merveilleuse. Tes œuvres sont admirables, Et mon âme le reconnaît bien. » (Psaume 139:14).",
            "Le portrait de la femme forte des Proverbes lui va bien : « Elle est revêtue de force et de gloire, Et elle se rit de l'avenir. » (Proverbes 31:25). Nous avons voulu marcher à ses côtés pour que son avenir soit plus serein.",
            "Nous lui confions cette promesse : « ceux qui se confient en l'Éternel renouvellent leur force. Ils prennent le vol comme les aigles ; Ils courent, et ne se lassent point, Ils marchent, et ne se fatiguent point. » (Ésaïe 40:31).",
            "Grâce à votre générosité, nous pouvons continuer à aider des femmes comme Sophie à briller avec confiance et dignité. « Que votre lumière luise ainsi devant les hommes, afin qu'ils voient vos bonnes œuvres, et qu'ils glorifient votre Père qui est dans les cieux. » (Matthieu 5:16)."
        ),
        image: "p23_02", imageAlt: "Sophie Besong reçoit le soutien de HOPE à Yaoundé",
        gallery: ["femmes-2025-yaounde"], project: 3, date: "2025-03-15",
    },
    {
        title: "Rentrée 2025-2026 : Abigail devient notre troisième filleule",
        summary: "À l'orphelinat du Buisson Ardent, à Yaoundé, nous nous engageons auprès d'Abigail pour toute sa scolarité. Dieu Merci entame sa troisième année de parrainage, Divine sa deuxième.",
        content: paragraphs(
            "Pour la rentrée 2025-2026, placée sous le signe de notre campagne « Un sourire pour tous », HOPE International Project accueille dans son programme de parrainage MASSOH NDAH Abigail, de l'orphelinat du Buisson Ardent (ASEEODRCAM) à Yaoundé.",
            "Nous nous engageons à l'accompagner tout au long de son parcours scolaire, avec amour et dévouement. Lors de notre visite, des fournitures et des sacs ont aussi été remis aux enfants de l'orphelinat.",
            "Le nom de cet orphelinat évoque la rencontre de Moïse avec Dieu : « Moïse regarda ; et voici, le buisson était tout en feu, et le buisson ne se consumait point. » (Exode 3:2). Un feu qui ne s'éteint pas : c'est l'image de l'amour de Dieu pour ces enfants, et de l'engagement que nous voulons tenir envers Abigail.",
            "La même rentrée marque la troisième année de parrainage de Dieu Merci, à l'orphelinat Petit Dan & Sarah, et la deuxième de Divine FOLIFACK à Dschang : fournitures, sacs, uniformes et frais de scolarité leur ont été remis.",
            "Trois enfants, trois histoires, une même fidélité. « Les bontés de l'Éternel ne sont pas épuisées, Ses compassions ne sont pas à leur terme ; Elles se renouvellent chaque matin. Oh ! que ta fidélité est grande ! » (Lamentations 3:22-23). Revenir chaque année auprès de chaque enfant, c'est notre manière de refléter cette fidélité.",
            "Pour Abigail, comme pour Dieu Merci et Divine, nous gardons cette promesse : « Car je connais les projets que j'ai formés sur vous, dit l'Éternel, projets de paix et non de malheur, afin de vous donner un avenir et de l'espérance. » (Jérémie 29:11).",
            "Merci à tous nos donateurs et parrains. « Laissez venir à moi les petits enfants, et ne les en empêchez pas » (Marc 10:14) : grâce à vous, trois enfants avancent sur le chemin de l'école."
        ),
        image: "p24_09", imageAlt: "Rentrée 2025 à l'orphelinat du Buisson Ardent, à Yaoundé",
        gallery: ["rentree-2025-buisson-ardent", "rentree-2025-yaounde", "rentree-2025-dschang"], project: 0, date: "2025-09-15",
    },
    {
        title: "Journée mondiale de lutte contre le sida 2025",
        summary: "Le 1er décembre 2025, nous avons sensibilisé le grand public aux modes de transmission et aux moyens de prévention du VIH.",
        content: paragraphs(
            "Le 1er décembre 2025, HOPE International Project s'est de nouveau mobilisée pour la Journée mondiale de lutte contre le sida.",
            "L'objectif de la campagne : sensibiliser le grand public aux modes de transmission et aux moyens de prévention du VIH. Elle s'inscrivait dans le thème international de l'année, « Surmonter les perturbations, transformer la riposte au sida ».",
            "L'information reste la première des protections. « Mon peuple est détruit, parce qu'il lui manque la connaissance. » (Osée 4:6). Savoir comment le virus se transmet, et comment s'en protéger, peut sauver des vies.",
            "Jésus est venu pour que chacun ait la vie en plénitude : « moi, je suis venu afin que les brebis aient la vie, et qu'elles soient dans l'abondance. » (Jean 10:10). Prévenir la maladie, encourager le dépistage et soutenir ceux qui vivent avec le VIH, c'est servir cette vie.",
            "Nous voulons aussi redire notre amour à toutes les personnes touchées par le VIH : « Je vous donne un commandement nouveau : Aimez-vous les uns les autres ; comme je vous ai aimés, vous aussi, aimez-vous les uns les autres. » (Jean 13:34). Personne ne doit affronter la maladie dans la honte ou la solitude.",
            "À ceux qui ont peur, Dieu adresse cette promesse : « Ne crains rien, car je suis avec toi ; Ne promène pas des regards inquiets, car je suis ton Dieu ; Je te fortifie, je viens à ton secours, Je te soutiens de ma droite triomphante. » (Ésaïe 41:10).",
            "Nous souhaitons à chacun ce que l'apôtre Jean souhaitait à son ami : « je souhaite que tu prospères à tous égards et sois en bonne santé » (3 Jean 1:2). Continuons à en parler autour de nous : c'est ainsi que la riposte au sida se transforme."
        ),
        image: "p27_01", imageAlt: "Affiche de la Journée mondiale de lutte contre le sida, 1er décembre 2025",
        gallery: ["sida-2025"], project: 4, date: "2025-12-01",
    },
];

// Citations des documents officiels, en attendant les temoignages recueillis aupres des beneficiaires.
// project = index dans PROJECTS (comme pour NEWS).
const TESTIMONIALS = [
    { author: "HOPE International Project", roleLabel: "Guide de bienvenue", content: "Nous croyons que l'amour de Dieu, manifesté par des actes concrets, transforme des vies.", project: null },
    { author: "HOPE International Project", roleLabel: "Guide de bienvenue", content: "Nous investissons dans les rêves, la santé et la dignité des personnes les plus démunies, avec bienveillance, expertise et engagement durable.", project: 0 },
    { author: "HOPE International Project", roleLabel: "Livret partenaires", content: "Votre générosité porte l'espoir au cœur de chaque village et donne à chaque enfant la chance de rêver à nouveau.", project: 1 },
];

const projectId = (projectIds, index) => (index === null ? null : projectIds[index] ?? null);

// Projets absents ajoutes (reperes par leur titre). Renvoie leurs ids dans l'ordre de PROJECTS.
async function importProjects(db) {
    const ids = [];
    let created = 0;
    for (const project of PROJECTS) {
        const [[row]] = await db.query("SELECT id FROM projects WHERE title = ? ORDER BY id LIMIT 1", [project.title]);
        if (row) {
            ids.push(row.id);
            continue;
        }
        const [result] = await db.query("INSERT INTO projects SET ?", [project]);
        ids.push(result.insertId);
        created += 1;
    }
    return { ids, created };
}

// Actualites absentes ajoutees (reperees par leur titre). update : remet aussi a jour le texte des
// actualites existantes (developpement ; en production, les modifications faites dans l'administration
// sont conservees par defaut).
async function importNews(db, projectIds, { update = false } = {}) {
    const [rows] = await db.query("SELECT title FROM news");
    const existing = new Set(rows.map((row) => row.title));
    let updated = 0;
    if (update) {
        for (const item of NEWS.filter((news) => existing.has(news.title))) {
            await db.query("UPDATE news SET summary = ?, content = ?, image_alt = ? WHERE title = ?", [item.summary, item.content, item.imageAlt, item.title]);
            updated += 1;
        }
    }
    const missing = NEWS.filter((item) => !existing.has(item.title));
    if (missing.length) {
        await db.query(
            "INSERT INTO news (title, summary, content, image_url, image_alt, gallery, project_id, created_at) VALUES ?",
            [missing.map((item) => [
                item.title, item.summary, item.content, photoUrl(item.image), item.imageAlt, gallery(...item.gallery),
                projectId(projectIds, item.project), new Date(`${item.date}T10:00:00Z`),
            ])]
        );
    }
    return { created: missing.length, updated };
}

// Temoignages : seulement dans une table vide (ils se completent ensuite dans l'administration).
async function importTestimonials(db, projectIds) {
    const [[{ total }]] = await db.query("SELECT COUNT(*) AS total FROM testimonials");
    if (Number(total) > 0) return { created: 0 };
    await db.query(
        "INSERT INTO testimonials (author, role_label, content, project_id) VALUES ?",
        [TESTIMONIALS.map((item) => [item.author, item.roleLabel, item.content, projectId(projectIds, item.project)])]
    );
    return { created: TESTIMONIALS.length };
}

module.exports = { PROJECTS, NEWS, TESTIMONIALS, gallery, importProjects, importNews, importTestimonials };
