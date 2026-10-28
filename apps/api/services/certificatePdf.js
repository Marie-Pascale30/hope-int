// Mise en page des attestations de benevolat (A4, polices PDF standard), dans le style des recus
// de don (services/receiptPdf.js, non modifie) : bandeau, encadres, signature et pied de page.
// Les polices standard ne couvrent que le jeu WinAnsi : pas de caracteres comme "≈" ou "→".
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { formatDate } = require("../utils/timezone");

const ORG = {
    name: process.env.ORG_NAME || "HOPE International Project",
    address: process.env.ORG_ADDRESS || "Bonadibong, Akwa, Douala, Cameroun",
    // Ville du "Fait a" (l'adresse commence par le quartier).
    city: process.env.ORG_CITY ?? "Douala",
    registration: process.env.ORG_REGISTRATION || "",
    signatory: process.env.ORG_SIGNATORY || "La Présidente",
    email: process.env.ORG_CONTACT_EMAIL || "hopeinternationalproject@gmail.com",
    phone: process.env.ORG_CONTACT_PHONE || "+237 694 63 25 60",
};

const FRONTEND_URL = () => (process.env.FRONTEND_URL || "http://localhost:3001").replace(/\/$/, "");

const COLORS = {
    brand: "#642b17",
    brandSoft: "#f9efea",
    accent: "#f0ba2a",
    accentSolid: "#c47f0a",
    accentLight: "#f0ba2a",
    surface: "#f6eee3",
    line: "#eadfd0",
    ink: "#2a1d17",
    ink2: "#574740",
    ink3: "#6b5a51",
    onBrand: "#ffffff",
    onBrandSoft: "#f1ddd2",
    cream: "#fbf7f0",
};

const PAGE = { margin: 48, headerHeight: 132, footerHeight: 70 };

// Libelles des badges imprimes (cles : @hope/shared/volunteering BADGES).
const BADGE_LABELS = {
    first_step: "Premier engagement",
    hours_10: "10 heures de bénévolat",
    hours_50: "50 heures de bénévolat",
    hours_100: "100 heures de bénévolat",
    events_5: "5 événements",
    one_year: "1 an d'engagement",
};

const formatHours = (value) =>
    `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(Number(value) || 0).replace(/\s/g, " ")} h`;

// Jour "AAAA-MM-JJ" -> "JJ/MM/AAAA".
const formatDay = (day) => {
    const text = typeof day === "string" ? day : new Date(day).toISOString().slice(0, 10);
    const [year, month, date] = text.split("-");
    return `${date}/${month}/${year}`;
};

function createDoc(title) {
    const doc = new PDFDocument({
        size: "A4",
        margins: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin },
        bufferPages: true,
        info: { Title: title, Author: ORG.name, Subject: title },
    });
    const chunks = [];
    const done = new Promise((resolve, reject) => {
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);
    });
    return { doc, done };
}

const contentWidth = (doc) => doc.page.width - PAGE.margin * 2;

// Embleme officiel (soleil du logo HOPE International Project, fond transparent), copie de
// apps/web/public/images/brand/soleil-hope-detoure.png. size : cote du carre. Sans le fichier,
// le document reste valide (pas d'embleme).
const LOGO_PATH = path.join(__dirname, "..", "assets", "soleil-hope.png");
let logoImage;
function logoMark(doc, x, y, size) {
    if (logoImage === undefined) logoImage = fs.existsSync(LOGO_PATH) ? fs.readFileSync(LOGO_PATH) : null;
    if (logoImage) doc.image(logoImage, x, y, { fit: [size, size], align: "center", valign: "center" });
}

function eyebrow(doc, text, x, y, { color = COLORS.ink3, width, align = "left", size = 7.5 } = {}) {
    doc.font("Helvetica-Bold").fontSize(size).fillColor(color)
        .text(text.toUpperCase(), x, y, { width, align, characterSpacing: 1.1, lineBreak: false });
}

function header(doc, { kicker, title, subtitle }) {
    const { width } = doc.page;
    const left = PAGE.margin;
    doc.rect(0, 0, width, PAGE.headerHeight).fill(COLORS.brand);
    doc.save().fillOpacity(0.07);
    doc.circle(width - 70, 30, 120).fill(COLORS.onBrand);
    doc.circle(width - 70, 30, 72).fill(COLORS.onBrand);
    doc.restore();
    doc.rect(0, PAGE.headerHeight, width, 4).fill(COLORS.accent);

    logoMark(doc, left, 36, 52);
    doc.font("Helvetica-Bold").fontSize(16).fillColor(COLORS.onBrand).text(ORG.name, left + 62, 46, { width: 230, lineBreak: false, ellipsis: true });
    const identity = [ORG.address, ORG.registration].filter(Boolean).join("  ·  ");
    if (identity) {
        doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.onBrandSoft).text(identity, left + 62, 69, { width: 260, lineBreak: false });
    }
    const rightWidth = 210;
    const rightX = width - PAGE.margin - rightWidth;
    eyebrow(doc, kicker, rightX, 40, { color: COLORS.accentLight, width: rightWidth, align: "right" });
    doc.font("Helvetica-Bold").fontSize(15).fillColor(COLORS.onBrand)
        .text(title, rightX, 54, { width: rightWidth, align: "right", lineBreak: false });
    doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.onBrandSoft)
        .text(subtitle, rightX, 76, { width: rightWidth, align: "right", lineBreak: false });
    doc.x = left;
    doc.y = PAGE.headerHeight + 34;
}

function sectionTitle(doc, text, x, y, width) {
    eyebrow(doc, text, x, y, { color: COLORS.brand, width });
    doc.moveTo(x, y + 13).lineTo(x + width, y + 13).lineWidth(0.6).stroke(COLORS.line);
    return y + 22;
}

// Chiffre cle dans un encadre : libelle au-dessus, valeur en grand.
function figure(doc, { label, value, x, y, width, height = 64, strong }) {
    doc.save().roundedRect(x, y, width, height, 8).clip();
    doc.rect(x, y, width, height).fill(strong ? COLORS.surface : COLORS.cream);
    if (strong) doc.rect(x, y, 5, height).fill(COLORS.accentSolid);
    doc.restore();
    eyebrow(doc, label, x + 16, y + 14, { width: width - 24 });
    doc.font("Helvetica-Bold").fontSize(strong ? 22 : 18).fillColor(COLORS.ink)
        .text(value, x + 16, y + 28, { width: width - 24, lineBreak: false });
}

function footer(doc, reference) {
    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
        doc.switchToPage(index);
        const bottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0;
        const left = PAGE.margin;
        const width = contentWidth(doc);
        const top = doc.page.height - PAGE.footerHeight;
        doc.moveTo(left, top).lineTo(left + width, top).lineWidth(0.6).stroke(COLORS.line);
        const contact = [ORG.name, ORG.registration, ORG.email, ORG.phone].filter(Boolean).join("  ·  ");
        doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.ink3)
            .text(contact, left, top + 14, { width, lineBreak: false, ellipsis: true });
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor(COLORS.ink2)
            .text(reference, left, top + 30, { width, align: "right", lineBreak: false });
        doc.page.margins.bottom = bottomMargin;
    }
}

// certificate : ligne de volunteer_certificates (voir certificateRepository).
exports.generate = (certificate) => {
    const title = `Attestation de bénévolat ${certificate.code}`;
    const { doc, done } = createDoc(title);
    const left = PAGE.margin;
    const width = contentWidth(doc);
    const verifyUrl = `${FRONTEND_URL()}/attestation/${certificate.code}`;

    header(doc, {
        kicker: "Attestation de bénévolat",
        title: certificate.code,
        subtitle: `Émise le ${formatDate(certificate.issued_at)}`,
    });

    // Texte d'attestation.
    doc.font("Helvetica-Bold").fontSize(20).fillColor(COLORS.ink).text("Attestation de bénévolat", left, doc.y, { width });
    doc.moveDown(0.6);
    const period = `du ${formatDay(certificate.period_start)} au ${formatDay(certificate.period_end)}`;
    doc.font("Helvetica").fontSize(11).fillColor(COLORS.ink2).text(
        `${ORG.name} atteste que `, left, doc.y, { width, continued: true, lineGap: 3 }
    );
    doc.font("Helvetica-Bold").fillColor(COLORS.ink).text(certificate.holder_name, { continued: true });
    doc.font("Helvetica").fillColor(COLORS.ink2).text(
        ` a contribué bénévolement aux actions de l'association ${period}, pour un total de `,
        { continued: true }
    );
    doc.font("Helvetica-Bold").fillColor(COLORS.ink).text(formatHours(certificate.total_hours), { continued: true });
    doc.font("Helvetica").fillColor(COLORS.ink2).text(" de bénévolat.");
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(10).fillColor(COLORS.ink3).text(
        "Ces heures correspondent aux présences enregistrées lors des événements de l'association et aux missions validées par l'équipe.",
        left, doc.y, { width, lineGap: 2 }
    );

    // Chiffres cles.
    const figuresY = doc.y + 22;
    const gap = 14;
    const third = (width - gap * 2) / 3;
    figure(doc, { label: "Heures de bénévolat", value: formatHours(certificate.total_hours), x: left, y: figuresY, width: third, strong: true });
    figure(doc, {
        label: "Événements",
        value: `${certificate.events_count}  ·  ${formatHours(certificate.event_hours)}`,
        x: left + third + gap,
        y: figuresY,
        width: third,
    });
    figure(doc, {
        label: "Missions",
        value: `${certificate.missions_count}  ·  ${formatHours(certificate.other_hours)}`,
        x: left + (third + gap) * 2,
        y: figuresY,
        width: third,
    });

    let y = figuresY + 64 + 28;

    // Badges obtenus a la fin de la periode.
    const badges = (certificate.badges || []).map((key) => BADGE_LABELS[key]).filter(Boolean);
    if (badges.length) {
        y = sectionTitle(doc, "Distinctions", left, y, width);
        let x = left;
        doc.font("Helvetica-Bold").fontSize(9);
        for (const label of badges) {
            const pillWidth = doc.widthOfString(label) + 24;
            if (x + pillWidth > left + width) {
                x = left;
                y += 28;
            }
            doc.roundedRect(x, y, pillWidth, 20, 10).fill(COLORS.brandSoft);
            doc.font("Helvetica-Bold").fontSize(9).fillColor(COLORS.brand).text(label, x + 12, y + 6, { lineBreak: false });
            x += pillWidth + 8;
        }
        y += 44;
    }

    // Verification de l'authenticite.
    y = sectionTitle(doc, "Vérifier cette attestation", left, y, width);
    const boxHeight = 62;
    doc.save().roundedRect(left, y, width, boxHeight, 8).clip();
    doc.rect(left, y, width, boxHeight).fill(COLORS.surface);
    doc.rect(left, y, 3, boxHeight).fill(COLORS.brand);
    doc.restore();
    doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.ink3).text("Code de vérification", left + 16, y + 12, { lineBreak: false });
    doc.font("Courier-Bold").fontSize(15).fillColor(COLORS.ink).text(certificate.code, left + 16, y + 26, { lineBreak: false });
    doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.ink2)
        .text("Authenticité vérifiable en ligne :", left + 230, y + 14, { width: width - 246 });
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(COLORS.brand)
        .text(verifyUrl, left + 230, y + 28, { width: width - 246, link: verifyUrl, underline: false });
    y += boxHeight + 34;

    // Signature.
    const signWidth = 230;
    const signX = left + width - signWidth;
    const place = ORG.city
        ? `Fait à ${ORG.city}, le ${formatDate(certificate.issued_at)}`
        : `Émise le ${formatDate(certificate.issued_at)}`;
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.ink3).text(place, signX, y, { width: signWidth, align: "right" });
    doc.text(`Pour ${ORG.name},`, signX, y + 16, { width: signWidth, align: "right" });
    const lineY = y + 70;
    doc.moveTo(signX + 30, lineY).lineTo(signX + signWidth, lineY).lineWidth(0.6).stroke(COLORS.ink3);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink)
        .text(ORG.signatory, signX, lineY + 6, { width: signWidth, align: "right", lineBreak: false });

    footer(doc, `Attestation ${certificate.code}`);
    doc.end();
    return done;
};

exports.BADGE_LABELS = BADGE_LABELS;
