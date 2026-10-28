const { db, request, app, resetDatabase, createUser, loginAs, multipart, PNG_BYTES } = require("./fixtures");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { UPLOADS_DIR } = require("../utils/uploads");
const { parseGalleryInput, readGallery, isGallerySrc } = require("../utils/gallery");

const png = () => ({ buffer: PNG_BYTES, filename: "photo.png", contentType: "image/png" });
const fileOf = (url) => path.join(UPLOADS_DIR, path.basename(url));

const LIVRET = [
    { src: "/images/livret/p06_01.jpg", width: 616, height: 570 },
    { src: "/images/livret/p05_01.jpg", width: 539, height: 831, kind: "affiche" },
];

describe("galeries photos des projets et actualites", () => {
    let adminHttp, orgaHttp;
    const created = [];

    before(async () => {
        await resetDatabase();
        const admin = await createUser({ roles: ["admin"] });
        const orga = await createUser({ roles: ["organisatrice"] });
        [adminHttp, orgaHttp] = await Promise.all([admin, orga].map(loginAs));
    });

    after(async () => {
        for (const url of created) await fs.promises.unlink(fileOf(url)).catch(() => {});
        await db.end();
    });

    describe("controles unitaires", () => {
        it("n'accepte que des chemins /images ou /uploads sans remontee", () => {
            assert.ok(isGallerySrc("/images/livret/p06_01.jpg"));
            assert.ok(isGallerySrc("/uploads/1700000000000-12.png"));
            assert.equal(isGallerySrc("/images/../server.js"), false);
            assert.equal(isGallerySrc("/uploads//a.png"), false);
            assert.equal(isGallerySrc("https://exemple.org/a.jpg"), false);
            assert.equal(isGallerySrc("javascript:alert(1)"), false);
            assert.equal(isGallerySrc("/autre/a.jpg"), false);
            assert.equal(isGallerySrc("/images/a b.jpg"), false);
        });

        it("normalise la galerie envoyee (chaine JSON, dimensions en texte, champs inconnus)", () => {
            assert.equal(parseGalleryInput(""), null);
            assert.equal(parseGalleryInput("[]"), null);
            assert.equal(parseGalleryInput(null), null);
            assert.deepEqual(
                parseGalleryInput(JSON.stringify([{ src: "/uploads/a.png", width: "800", height: 600, kind: "", extra: "x" }])),
                [{ src: "/uploads/a.png", width: 800, height: 600 }]
            );
            assert.throws(() => parseGalleryInput("{"), /JSON invalide/);
            assert.throws(() => parseGalleryInput({ src: "/uploads/a.png" }), /liste/);
            assert.throws(() => parseGalleryInput([{ src: "/uploads/a.png", width: 0 }]), /largeur/);
            assert.throws(() => parseGalleryInput([{ src: "/uploads/a.png", height: 1.5 }]), /hauteur/);
            assert.throws(() => parseGalleryInput([{ src: "/uploads/a.png", kind: "video" }]), /type/);
            assert.throws(() => parseGalleryInput(Array.from({ length: 201 }, () => ({ src: "/uploads/a.png" }))), /200/);
        });

        it("relit la colonne JSON en tableau, quel que soit son format", () => {
            assert.equal(readGallery(null), null);
            assert.equal(readGallery("pas du json"), null);
            assert.equal(readGallery({ src: "/uploads/a.png" }), null);
            assert.deepEqual(readGallery(JSON.stringify(LIVRET)), LIVRET);
            assert.deepEqual(readGallery(Buffer.from(JSON.stringify(LIVRET))), LIVRET);
            assert.deepEqual(readGallery([null, { src: "" }, LIVRET[0]]), [LIVRET[0]]);
            assert.equal(readGallery([]), null);
        });
    });

    it("cree un projet avec une galerie (JSON) et la renvoie en tableau, cote admin et public", async () => {
        const res = await adminHttp.post("/api/admin/content/projects", {
            title: "Projet illustre", description: "Avec galerie", gallery: LIVRET,
        });
        assert.equal(res.status, 201);
        assert.deepEqual(res.body.gallery, LIVRET);

        const list = await adminHttp.get("/api/admin/content/projects");
        assert.deepEqual(list.body.find((item) => item.id === res.body.id).gallery, LIVRET);

        const pub = await request(app).get(`/api/content/projects/${res.body.id}`);
        assert.equal(pub.status, 200);
        assert.deepEqual(pub.body.gallery, LIVRET);
    });

    it("accepte la galerie en chaine JSON (formulaire multipart), la reordonne puis la vide", async () => {
        const res = await multipart(adminHttp, "post", "/api/admin/content/news", {
            title: "Actualite illustree", content: "Texte", gallery: JSON.stringify(LIVRET),
        });
        assert.equal(res.status, 201);
        assert.deepEqual(res.body.gallery, LIVRET);

        const reordered = await multipart(adminHttp, "patch", `/api/admin/content/news/${res.body.id}`, {
            gallery: JSON.stringify([LIVRET[1], LIVRET[0]]),
        });
        assert.equal(reordered.status, 200);
        assert.deepEqual(reordered.body.gallery, [LIVRET[1], LIVRET[0]]);

        // Modification sans champ gallery : la galerie est conservee.
        const untouched = await multipart(adminHttp, "patch", `/api/admin/content/news/${res.body.id}`, { title: "Nouveau titre" });
        assert.deepEqual(untouched.body.gallery, [LIVRET[1], LIVRET[0]]);

        const cleared = await multipart(adminHttp, "patch", `/api/admin/content/news/${res.body.id}`, { gallery: "" });
        assert.equal(cleared.status, 200);
        assert.equal(cleared.body.gallery, null);
    });

    it("refuse une galerie invalide (422) sans rien enregistrer", async () => {
        const project = await adminHttp.post("/api/admin/content/projects", { title: "Projet", description: "Texte", gallery: LIVRET });
        const cases = [
            [{ src: "https://exemple.org/a.jpg" }],
            [{ src: "/uploads/../app.js" }],
            [{ src: "/images/livret/p06_01.jpg", width: -3 }],
            [{ src: "/images/livret/p06_01.jpg", kind: "video" }],
            "pas du json",
            { src: "/images/livret/p06_01.jpg" },
            Array.from({ length: 201 }, () => LIVRET[0]),
        ];
        for (const gallery of cases) {
            const res = await adminHttp.patch(`/api/admin/content/projects/${project.body.id}`, { gallery });
            assert.equal(res.status, 422, JSON.stringify(gallery).slice(0, 80));
        }
        const res = await adminHttp.post("/api/admin/content/news", { title: "Refus", content: "Texte", gallery: [{ src: "/etc/passwd" }] });
        assert.equal(res.status, 422);
        const stored = await adminHttp.get("/api/admin/content/projects");
        assert.deepEqual(stored.body.find((item) => item.id === project.body.id).gallery, LIVRET);
    });

    it("ignore la galerie d'un temoignage (champ non gere)", async () => {
        const res = await adminHttp.post("/api/admin/content/testimonials", { author: "Awa", content: "Merci", gallery: LIVRET });
        assert.equal(res.status, 201);
        assert.equal("gallery" in res.body, false);
    });

    it("soumet a validation une galerie modifiee par une personne non habilitee", async () => {
        const project = await adminHttp.post("/api/admin/content/projects", { title: "Publie", description: "Texte", published: "1" });
        assert.equal(project.body.review_status, "published");
        const res = await orgaHttp.patch(`/api/admin/content/projects/${project.body.id}`, { gallery: LIVRET });
        assert.equal(res.status, 200);
        assert.equal(res.body.review_status, "submitted");
        assert.equal(res.body.published, false);
        assert.deepEqual(res.body.gallery, LIVRET);
        assert.equal((await request(app).get(`/api/content/projects/${project.body.id}`)).status, 404);
    });

    describe("images envoyees pour les galeries", () => {
        it("enregistre une image seule et renvoie son adresse", async () => {
            const res = await multipart(adminHttp, "post", "/api/admin/uploads/images", {}, png());
            assert.equal(res.status, 201);
            assert.match(res.body.url, /^\/uploads\/.+\.png$/);
            created.push(res.body.url);
            assert.ok(fs.existsSync(fileOf(res.body.url)));
        });

        it("refuse une requete sans image ou un faux fichier", async () => {
            assert.equal((await multipart(adminHttp, "post", "/api/admin/uploads/images", {})).status, 400);
            const fake = await multipart(adminHttp, "post", "/api/admin/uploads/images", {}, {
                buffer: Buffer.from("<svg onload=alert(1)>"), filename: "a.png", contentType: "image/png",
            });
            assert.equal(fake.status, 400);
        });

        it("reserve l'envoi aux gestionnaires de contenus", async () => {
            const member = await loginAs(await createUser({ roles: ["membre"] }));
            assert.equal((await multipart(member, "post", "/api/admin/uploads/images", {}, png())).status, 403);
            assert.equal((await multipart({ agent: request.agent(app) }, "post", "/api/admin/uploads/images", {}, png())).status, 401);
        });

        it("supprime les images envoyees retirees de la galerie, puis a la suppression du contenu", async () => {
            const urls = [];
            for (let i = 0; i < 3; i += 1) {
                const res = await multipart(adminHttp, "post", "/api/admin/uploads/images", {}, png());
                urls.push(res.body.url);
                created.push(res.body.url);
            }
            const gallery = urls.map((src) => ({ src, width: 1, height: 1 }));
            const news = await adminHttp.post("/api/admin/content/news", { title: "Photos", content: "Texte", gallery: [...gallery, LIVRET[0]] });
            assert.equal(news.status, 201);

            const updated = await adminHttp.patch(`/api/admin/content/news/${news.body.id}`, { gallery: [gallery[1], gallery[2], LIVRET[0]] });
            assert.equal(updated.status, 200);
            assert.equal(fs.existsSync(fileOf(urls[0])), false, "image retiree supprimee");
            assert.ok(fs.existsSync(fileOf(urls[1])));
            assert.ok(fs.existsSync(fileOf(urls[2])));
            assert.ok(fs.existsSync(path.join(UPLOADS_DIR, "..", "package.json")));

            assert.equal((await adminHttp.delete(`/api/admin/content/news/${news.body.id}`)).status, 200);
            assert.equal(fs.existsSync(fileOf(urls[1])), false);
            assert.equal(fs.existsSync(fileOf(urls[2])), false);
        });
    });
});
