const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { PHOTOS, PHOTO_ALBUMS, PHOTOS_BY_ID, albumPhotos, photoUrl } = require("../src/photos");

const PUBLIC_DIR = path.join(__dirname, "..", "..", "..", "apps", "web", "public");

describe("photos du livret", () => {
    it("classe les 145 photos une seule fois chacune", () => {
        assert.equal(PHOTOS.length, 145);
        assert.equal(new Set(PHOTOS.map((photo) => photo.id)).size, 145);
        assert.equal(new Set(PHOTO_ALBUMS.map((album) => album.key)).size, PHOTO_ALBUMS.length);
    });

    it("pointe vers des fichiers publies par le site", () => {
        for (const photo of PHOTOS) {
            assert.ok(fs.existsSync(path.join(PUBLIC_DIR, photo.src)), photo.src);
            assert.ok(photo.width > 0 && photo.height > 0, photo.id);
        }
    });

    it("retrouve les photos par album et par identifiant", () => {
        assert.equal(albumPhotos("rentree-2024-dschang").length, 10);
        assert.equal(PHOTOS_BY_ID.p24_09.album, "rentree-2025-buisson-ardent");
        assert.equal(photoUrl("p02_01"), "/images/livret/p02_01.jpg");
    });
});
