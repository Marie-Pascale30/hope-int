// Photos du livret partenaires 2021-2025 de HOPE International Project (145 images, toutes publiees
// sur le site), classees par action. Fichiers : apps/web/public/images/livret/<id>.jpg, redresses et
// optimises (1600 px max). Chaque photo : [id, largeur, hauteur, type?] ; type absent = photo de terrain,
// "affiche" = visuel de campagne, "document" = cheque cadeau ou justificatif, "logo" = logo officiel.
// Les titres et legendes des albums sont traduits cote site (messages site.gallery.albums.<key>).

const PHOTO_BASE = "/images/livret";

const PHOTO_ALBUMS = [
    {
        key: "equipe",
        year: 2025,
        date: null,
        place: "Douala",
        photos: [
            ["p01_00", 1360, 517, "logo"],
            ["p02_01", 925, 1024],
            ["p03_12", 1397, 1130],
            ["p04_02", 1371, 1065],
            ["p05_03", 1080, 720],
        ],
    },
    {
        key: "vetements-2022",
        year: 2022,
        date: "2022-11",
        place: "Douala",
        photos: [
            ["p05_01", 539, 831, "affiche"],
        ],
    },
    {
        key: "rentree-2021-balessing",
        year: 2021,
        date: "2021-09",
        place: "Balessing (Ouest)",
        photos: [
            ["p06_01", 616, 570],
            ["p06_02", 606, 530],
            ["p06_03", 720, 540],
            ["p06_04", 579, 720],
            ["p06_05", 720, 522],
            ["p06_06", 606, 570],
            ["p06_07", 720, 1280],
        ],
    },
    {
        key: "enseignants-2022-douala",
        year: 2022,
        date: "2022-10",
        place: "Douala",
        photos: [
            ["p07_01", 511, 499],
            ["p07_02", 437, 503],
            ["p07_03", 474, 503],
            ["p07_04", 474, 507],
            ["p07_05", 762, 625],
            ["p07_06", 612, 625],
            ["p07_07", 762, 479],
            ["p07_08", 492, 515],
            ["p07_09", 523, 476],
        ],
    },
    {
        key: "noel-2022-yaounde",
        year: 2022,
        date: "2022-12",
        place: "Yaoundé",
        photos: [
            ["p08_04", 591, 412],
            ["p08_05", 465, 498],
            ["p08_06", 488, 498],
            ["p08_07", 508, 496],
            ["p08_08", 627, 774],
            ["p08_09", 805, 640],
            ["p08_10", 647, 555],
            ["p08_11", 647, 550],
            ["p08_12", 576, 496],
        ],
    },
    {
        key: "noel-2022-douala",
        year: 2022,
        date: "2022-12",
        place: "Douala",
        photos: [
            ["p09_04", 731, 723],
            ["p09_05", 1040, 527],
            ["p09_06", 940, 506],
            ["p09_07", 937, 535],
            ["p09_08", 1040, 576],
            ["p09_09", 731, 651],
        ],
    },
    {
        key: "campagnes-2023",
        year: 2023,
        date: null,
        place: "Douala, Yaoundé",
        photos: [
            ["p10_01", 932, 932, "affiche"],
            ["p10_02", 1080, 602, "affiche"],
            ["p10_03", 1080, 1080, "affiche"],
        ],
    },
    {
        key: "rentree-2023-yaounde",
        year: 2023,
        date: "2023-09",
        place: "Yaoundé",
        photos: [
            ["p11_00", 1080, 459],
            ["p11_02", 767, 497],
            ["p11_03", 1080, 720],
            ["p11_04", 659, 475],
            ["p11_05", 667, 481],
            ["p11_07", 1080, 720],
        ],
    },
    {
        key: "noel-2023-mere-teresa",
        year: 2023,
        date: "2023-12",
        place: "Douala",
        photos: [
            ["p12_04", 595, 476],
            ["p12_06", 645, 618],
            ["p12_07", 688, 613],
            ["p12_08", 424, 492],
            ["p12_09", 388, 483],
            ["p12_10", 558, 483],
            ["p12_11", 603, 476],
            ["p12_12", 672, 616],
        ],
    },
    {
        key: "noel-2023-bonaberi",
        year: 2023,
        date: "2023-12",
        place: "Bonabéri, Douala",
        photos: [
            ["p13_04", 548, 504],
            ["p13_05", 424, 504],
            ["p13_06", 442, 504],
            ["p13_07", 484, 504],
            ["p13_08", 603, 476],
            ["p13_09", 689, 616],
            ["p13_10", 574, 669],
            ["p13_11", 567, 478],
            ["p13_12", 649, 500],
        ],
    },
    {
        key: "noel-2023-bon-berger",
        year: 2023,
        date: "2023-12",
        place: "Nkoabang, Yaoundé",
        photos: [
            ["p14_04", 523, 504],
            ["p14_05", 508, 506],
            ["p14_06", 617, 488],
            ["p14_08", 538, 623],
            ["p14_09", 538, 504],
            ["p14_10", 768, 623],
            ["p14_11", 593, 486],
            ["p14_12", 557, 508],
        ],
    },
    {
        key: "campagnes-2024",
        year: 2024,
        date: null,
        place: "Douala, Yaoundé",
        photos: [
            ["p15_00", 770, 690, "affiche"],
            ["p15_02", 894, 769, "affiche"],
            ["p15_03", 709, 709, "affiche"],
            ["p15_04", 535, 538, "affiche"],
        ],
    },
    {
        key: "femmes-2024-yaounde",
        year: 2024,
        date: "2024-03",
        place: "Yaoundé",
        photos: [
            ["p16_02", 674, 479, "document"],
            ["p16_03", 464, 615],
            ["p16_04", 597, 665],
            ["p16_05", 597, 665],
            ["p16_06", 607, 667],
            ["p16_07", 791, 586],
            ["p16_08", 607, 667],
        ],
    },
    {
        key: "femmes-2024-douala-irene",
        year: 2024,
        date: "2024-03",
        place: "Douala",
        photos: [
            ["p17_01", 960, 876],
            ["p17_02", 781, 562, "document"],
            ["p17_03", 720, 717],
            ["p17_04", 688, 859],
        ],
    },
    {
        key: "femmes-2024-douala-armelle",
        year: 2024,
        date: "2024-03",
        place: "Douala",
        photos: [
            ["p18_02", 720, 693],
            ["p18_03", 1280, 659],
            ["p18_04", 853, 823],
            ["p18_05", 433, 628],
            ["p18_06", 410, 628],
            ["p18_07", 674, 479, "document"],
        ],
    },
    {
        key: "solidarite-rue-2024",
        year: 2024,
        date: "2024-06",
        place: "Douala",
        photos: [
            ["p19_02", 674, 447, "document"],
            ["p19_03", 720, 639],
            ["p19_04", 720, 724],
            ["p19_05", 720, 641],
            ["p19_06", 486, 596],
            ["p19_07", 720, 634],
        ],
    },
    {
        key: "rentree-2024-yaounde",
        year: 2024,
        date: "2024-09",
        place: "Yaoundé",
        photos: [
            ["p20_01", 604, 617],
            ["p20_03", 607, 507],
            ["p20_04", 359, 507],
            ["p20_05", 586, 480],
            ["p20_06", 640, 507],
            ["p20_07", 612, 479],
            ["p20_08", 613, 500],
            ["p20_09", 738, 768],
        ],
    },
    {
        key: "rentree-2024-dschang",
        year: 2024,
        date: "2024-09",
        place: "Dschang",
        photos: [
            ["p21_01", 377, 514],
            ["p21_02", 541, 461],
            ["p21_03", 424, 507],
            ["p21_04", 402, 507],
            ["p21_06", 400, 500],
            ["p21_07", 424, 496],
            ["p21_08", 600, 566],
            ["p21_09", 521, 460],
            ["p21_10", 456, 580],
            ["p21_11", 446, 580],
        ],
    },
    {
        key: "campagnes-2025",
        year: 2025,
        date: null,
        place: "Douala, Yaoundé",
        photos: [
            ["p22_01", 1080, 733, "affiche"],
            ["p22_02", 1125, 1061, "affiche"],
            ["p22_03", 1080, 1072, "affiche"],
        ],
    },
    {
        key: "femmes-2025-yaounde",
        year: 2025,
        date: "2025-03",
        place: "Yaoundé",
        photos: [
            ["p23_02", 750, 1000],
            ["p23_03", 646, 750, "document"],
            ["p23_04", 523, 698],
            ["p23_05", 473, 564],
            ["p23_06", 712, 720],
        ],
    },
    {
        key: "rentree-2025-buisson-ardent",
        year: 2025,
        date: "2025-09",
        place: "Yaoundé",
        photos: [
            ["p24_01", 507, 384],
            ["p24_04", 409, 499],
            ["p24_05", 619, 475],
            ["p24_06", 639, 476],
            ["p24_07", 402, 499],
            ["p24_09", 750, 616],
            ["p24_10", 568, 305],
        ],
    },
    {
        key: "rentree-2025-yaounde",
        year: 2025,
        date: "2025-09",
        place: "Yaoundé",
        photos: [
            ["p25_01", 555, 499],
            ["p25_02", 684, 623],
            ["p25_04", 600, 471],
            ["p25_05", 625, 522],
            ["p25_09", 437, 514],
            ["p25_10", 625, 604],
        ],
    },
    {
        key: "rentree-2025-dschang",
        year: 2025,
        date: "2025-09",
        place: "Dschang",
        photos: [
            ["p26_01", 600, 566],
            ["p26_02", 810, 600],
            ["p26_04", 410, 513],
            ["p26_05", 416, 522, "document"],
            ["p26_06", 416, 453],
            ["p26_07", 513, 522, "document"],
            ["p26_08", 510, 523],
        ],
    },
    {
        key: "sida-2025",
        year: 2025,
        date: "2025-12",
        place: "Douala",
        photos: [
            ["p27_01", 1125, 1061, "affiche"],
        ],
    },
];

const toPhoto = (album) => ([id, width, height, kind = "photo"]) => ({
    id,
    src: `${PHOTO_BASE}/${id}.jpg`,
    width,
    height,
    kind,
    album: album.key,
    year: album.year,
});

const PHOTOS = PHOTO_ALBUMS.flatMap((album) => album.photos.map(toPhoto(album)));
const PHOTOS_BY_ID = Object.fromEntries(PHOTOS.map((photo) => [photo.id, photo]));

// Photos d'un ou plusieurs albums, dans l'ordre du livret.
function albumPhotos(...keys) {
    return PHOTOS.filter((photo) => keys.includes(photo.album));
}

function photoUrl(id) {
    return `${PHOTO_BASE}/${id}.jpg`;
}

module.exports = { PHOTO_BASE, PHOTO_ALBUMS, PHOTOS, PHOTOS_BY_ID, albumPhotos, photoUrl };
