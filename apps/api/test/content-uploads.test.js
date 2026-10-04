const { db, resetDatabase, createUser, loginAs, multipart, insertEvent, hoursFromNow, PNG_BYTES, JPEG_BYTES } = require("./fixtures");
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { UPLOADS_DIR, detectImageType, resolveUploadPath } = require("../utils/uploads");

const png = (contentType = "image/png") => ({ buffer: PNG_BYTES, filename: "photo.png", contentType });
const fileOf = (url) => path.join(UPLOADS_DIR, path.basename(url));
const listUploads = () => new Set(fs.readdirSync(UPLOADS_DIR));

describe("images envoyees (uploads)", () => {
    let http;
    const created = [];

    before(async () => {
        await resetDatabase();
        const admin = await createUser({ roles: ["admin"] });
        http = await loginAs(admin);
    });

    after(async () => {
        for (const url of created) await fs.promises.unlink(fileOf(url)).catch(() => {});
        await db.end();
    });

    describe("controles unitaires", () => {
        it("reconnait les images par leur signature binaire", () => {
            assert.equal(detectImageType(PNG_BYTES).ext, ".png");
            assert.equal(detectImageType(JPEG_BYTES).ext, ".jpg");
            assert.equal(detectImageType(Buffer.from("GIF89a....")).ext, ".gif");
            assert.equal(detectImageType(Buffer.from("RIFF0000WEBPVP8 ")).ext, ".webp");
            assert.equal(detectImageType(Buffer.from("<svg onload=alert(1)>")), null);
            assert.equal(detectImageType(Buffer.from("%PDF-1.7")), null);
        });

        it("ne resout jamais un chemin hors du dossier uploads", () => {
            assert.equal(resolveUploadPath("/uploads/../server.js"), null);
            assert.equal(resolveUploadPath("/uploads/..%2Fserver.js"), null);
            assert.equal(resolveUploadPath("/uploads/sub/dir.png"), null);
            assert.equal(resolveUploadPath("/etc/passwd"), null);
            assert.equal(resolveUploadPath("https://exemple.org/uploads/a.png"), null);
            assert.equal(resolveUploadPath("/uploads/.env"), null);
            assert.equal(resolveUploadPath("/uploads/a.png"), path.join(UPLOADS_DIR, "a.png"));
        });
    });

    it("accepte une vraie image meme si le type declare est faux", async () => {
        const res = await multipart(http, "post", "/api/admin/content/projects", { title: "Avec image", description: "Projet illustre" }, png("application/octet-stream"));
        assert.equal(res.status, 201);
        assert.match(res.body.image_url, /^\/uploads\/.+\.png$/);
        created.push(res.body.image_url);
        assert.ok(fs.existsSync(fileOf(res.body.image_url)));
    });

    it("refuse un faux fichier image et n'ecrit rien sur le disque", async () => {
        const before = listUploads();
        const res = await multipart(http, "post", "/api/admin/content/projects", { title: "Faux", description: "Projet piege" }, {
            buffer: Buffer.from("<?php echo 'x'; ?>"), filename: "photo.png", contentType: "image/png",
        });
        assert.equal(res.status, 400);
        assert.deepEqual(listUploads(), before);
    });

    it("supprime le fichier envoye quand la validation echoue", async () => {
        const before = listUploads();
        const res = await multipart(http, "post", "/api/admin/content/projects", { description: "Titre manquant" }, png());
        assert.equal(res.status, 422);
        // Nettoyage declenche a la fin de la reponse.
        await new Promise((resolve) => setTimeout(resolve, 50));
        assert.deepEqual(listUploads(), before);
    });

    it("supprime l'ancienne image lors d'un remplacement, d'un retrait puis de la suppression", async () => {
        const first = await multipart(http, "post", "/api/admin/content/news", { title: "Actualite", content: "Texte" }, png());
        assert.equal(first.status, 201);
        const firstFile = fileOf(first.body.image_url);

        const replaced = await multipart(http, "patch", `/api/admin/content/news/${first.body.id}`, {}, png());
        assert.equal(replaced.status, 200);
        assert.notEqual(replaced.body.image_url, first.body.image_url);
        assert.equal(fs.existsSync(firstFile), false, "ancienne image supprimee");
        const secondFile = fileOf(replaced.body.image_url);
        assert.ok(fs.existsSync(secondFile));

        const removed = await multipart(http, "patch", `/api/admin/content/news/${first.body.id}`, { remove_image: "1" });
        assert.equal(removed.body.image_url, null);
        assert.equal(fs.existsSync(secondFile), false);

        const third = await multipart(http, "patch", `/api/admin/content/news/${first.body.id}`, {}, png());
        const thirdFile = fileOf(third.body.image_url);
        assert.equal((await http.delete(`/api/admin/content/news/${first.body.id}`)).status, 200);
        assert.equal(fs.existsSync(thirdFile), false);
    });

    it("ignore une URL d'image fournie par le client", async () => {
        const res = await http.post("/api/admin/content/testimonials", { author: "Test", content: "Merci", image_url: "/uploads/../app.js" });
        assert.equal(res.status, 201);
        assert.equal(res.body.image_url, null);
    });

    it("supprime l'image d'un evenement supprime", async () => {
        const res = await multipart(http, "post", "/api/admin/events", {
            title: "Atelier photo", description: "Atelier avec image de couverture", location: "Douala", start_at: hoursFromNow(48).toISOString(),
        }, png());
        assert.equal(res.status, 201);
        const file = fileOf(res.body.image_url);
        assert.ok(fs.existsSync(file));
        assert.equal((await http.delete(`/api/admin/events/${res.body.id}`)).status, 200);
        assert.equal(fs.existsSync(file), false);
    });

    it("ne supprime aucun fichier hors du dossier uploads", async () => {
        const outside = path.join(UPLOADS_DIR, "..", "package.json");
        const id = await insertEvent({ startAt: hoursFromNow(24), imageUrl: "/uploads/../package.json" });
        assert.equal((await http.delete(`/api/admin/events/${id}`)).status, 200);
        assert.ok(fs.existsSync(outside));
    });
});
