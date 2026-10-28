// Mise en page des recus PDF (A4, polices PDF standard) ; les donnees viennent de receiptFormat.
const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const {
    RECEIPT_TIMEZONE, DONATION_NATURE, formatAmount, formatDate, equivalent, receiptView, methodLabel, frequencyLabel,
    natureLabel,
} = require("./receiptFormat");

const ORG = {
    name: process.env.ORG_NAME || "HOPE International Project",
    address: process.env.ORG_ADDRESS || "Bonadibong, Akwa, Douala, Cameroun",
    // Ville du "Fait a" (l'adresse commence par le quartier).
    city: process.env.ORG_CITY ?? "Douala",
    registration: process.env.ORG_REGISTRATION || "",
    signatory: process.env.ORG_SIGNATORY || "La Présidente",
    email: process.env.ORG_CONTACT_EMAIL || "hopeinternationalproject@gmail.com",
    phone: process.env.ORG_CONTACT_PHONE || "+237 694 63 25 60",
    fiscalMention:
        process.env.RECEIPT_FISCAL_MENTION ||
        "Ce reçu atteste de la réception de votre don. Sa valeur fiscale dépend du statut de l'organisme bénéficiaire et de la législation applicable dans votre pays de résidence.",
};

// ---------- Mise en page (A4, polices PDF standard) ----------
// Les polices standard ne couvrent que le jeu WinAnsi : pas de caracteres comme "≈" ou "→".

const COLORS = {
    brand: "#642b17",
    brandSoft: "#f9efea",
    accent: "#f0ba2a",
    accentSolid: "#c47f0a",
    accentSoft: "#fdf4dc",
    accentInk: "#8a5a00",
    accentLight: "#f0ba2a",
    cream: "#fbf7f0",
    surface: "#f6eee3",
    line: "#eadfd0",
    ink: "#2a1d17",
    ink2: "#574740",
    ink3: "#6b5a51",
    onBrand: "#ffffff",
    onBrandSoft: "#f1ddd2",
};

const PAGE = { margin: 48, headerHeight: 132, footerHeight: 86 };

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
// Limite basse du contenu : le pied de page fixe occupe le bas de chaque page.
const contentBottom = (doc) => doc.page.height - PAGE.footerHeight - 12;

// Embleme officiel (soleil du logo HOPE International Project, fond transparent), copie de
// apps/web/public/images/brand/soleil-hope-detoure.png. size : cote du carre. Sans le fichier,
// le document reste valide (pas d'embleme).
const LOGO_PATH = path.join(__dirname, "..", "assets", "soleil-hope.png");
let logoImage;
function logoMark(doc, x, y, size) {
    if (logoImage === undefined) logoImage = fs.existsSync(LOGO_PATH) ? fs.readFileSync(LOGO_PATH) : null;
    if (logoImage) doc.image(logoImage, x, y, { fit: [size, size], align: "center", valign: "center" });
}

// Petit titre en capitales espacees.
function eyebrow(doc, text, x, y, { color = COLORS.ink3, width, align = "left", size = 7.5 } = {}) {
    doc.font("Helvetica-Bold").fontSize(size).fillColor(color)
        .text(text.toUpperCase(), x, y, { width, align, characterSpacing: 1.1, lineBreak: false });
}

// Bandeau d'en-tete : identite de l'association a gauche, nature et reference du document a droite.
function header(doc, { kicker, title, subtitle }) {
    const { width } = doc.page;
    const left = PAGE.margin;
    doc.rect(0, 0, width, PAGE.headerHeight).fill(COLORS.brand);
    // Motif discret : deux cercles qui debordent du bandeau.
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

    const rightWidth = 200;
    const rightX = width - PAGE.margin - rightWidth;
    eyebrow(doc, kicker, rightX, 40, { color: COLORS.accentLight, width: rightWidth, align: "right" });
    doc.font("Helvetica-Bold").fontSize(16).fillColor(COLORS.onBrand)
        .text(title, rightX, 54, { width: rightWidth, align: "right", lineBreak: false });
    doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.onBrandSoft)
        .text(subtitle, rightX, 76, { width: rightWidth, align: "right", lineBreak: false });

    doc.x = left;
    doc.y = PAGE.headerHeight + 30;
}

// Bandeau reduit des pages suivantes d'un document long.
function continuationHeader(doc, title) {
    doc.rect(0, 0, doc.page.width, 6).fill(COLORS.brand);
    logoMark(doc, PAGE.margin, 22, 20);
    doc.font("Helvetica-Bold").fontSize(9.5).fillColor(COLORS.ink).text(ORG.name, PAGE.margin + 28, 28, { lineBreak: false });
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.ink3)
        .text(title, PAGE.margin, 28, { width: contentWidth(doc), align: "right", lineBreak: false });
    doc.x = PAGE.margin;
    doc.y = 64;
}

// Titre de section avec filet. Renvoie l'ordonnee du contenu.
function sectionTitle(doc, text, x, y, width) {
    eyebrow(doc, text, x, y, { color: COLORS.brand, width });
    doc.moveTo(x, y + 13).lineTo(x + width, y + 13).lineWidth(0.6).stroke(COLORS.line);
    return y + 22;
}

// Liste libelle (petit, au-dessus) / valeur. Renvoie l'ordonnee de fin.
function fieldList(doc, fields, x, y, width) {
    let cursor = y;
    fields.forEach(({ label, value, strong }) => {
        doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.ink3).text(label, x, cursor, { width });
        cursor = doc.y + 1.5;
        doc.font(strong ? "Helvetica-Bold" : "Helvetica").fontSize(strong ? 11 : 10).fillColor(COLORS.ink)
            .text(String(value || "—"), x, cursor, { width });
        cursor = doc.y + 9;
    });
    return cursor;
}

// Encadre colore (remarque, remboursement...). Renvoie l'ordonnee de fin.
function callout(doc, { title, text, background, color, x, y, width }) {
    const pad = 12;
    const inner = width - pad * 2;
    doc.font("Helvetica-Bold").fontSize(9);
    const titleHeight = title ? doc.heightOfString(title, { width: inner }) + 3 : 0;
    doc.font("Helvetica").fontSize(9);
    const height = titleHeight + doc.heightOfString(text, { width: inner }) + pad * 2;
    doc.save().roundedRect(x, y, width, height, 6).clip();
    doc.rect(x, y, width, height).fill(background);
    doc.rect(x, y, 3, height).fill(color);
    doc.restore();
    if (title) doc.font("Helvetica-Bold").fontSize(9).fillColor(color).text(title, x + pad, y + pad, { width: inner });
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.ink2).text(text, x + pad, y + pad + titleHeight, { width: inner });
    return y + height;
}

// Bloc de remerciements : textes et hauteur, mesures avant dessin pour placer le bloc.
const THANKS = { width: 290, pad: 16 };
function measureClosing(doc, donorName) {
    const inner = THANKS.width - THANKS.pad * 2;
    const title = donorName ? `Merci, ${donorName} !` : "Merci pour votre générosité !";
    const text = `Votre soutien permet à ${ORG.name} de scolariser et d'accompagner des enfants défavorisés et de soutenir les personnes les plus vulnérables. Toute l'équipe vous remercie chaleureusement de votre confiance.`;
    doc.font("Helvetica-Bold").fontSize(12);
    const titleHeight = doc.heightOfString(title, { width: inner });
    doc.font("Helvetica").fontSize(9);
    const height = Math.max(titleHeight + doc.heightOfString(text, { width: inner }) + THANKS.pad * 2 + 4, 80);
    return { title, text, titleHeight, height, inner };
}

// Remerciements et signature. Renvoie l'ordonnee de fin.
function closing(doc, { donorName, issuedAt, y }) {
    const left = PAGE.margin;
    const width = contentWidth(doc);
    const { width: thanksWidth, pad } = THANKS;
    const { title: thanksTitle, text: thanksText, titleHeight, height: boxHeight, inner } = measureClosing(doc, donorName);

    doc.roundedRect(left, y, thanksWidth, boxHeight, 8).fill(COLORS.brandSoft);
    doc.font("Helvetica-Bold").fontSize(12).fillColor(COLORS.brand).text(thanksTitle, left + pad, y + pad, { width: inner });
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.ink2).text(thanksText, left + pad, y + pad + titleHeight + 4, { width: inner });

    // Signature : lieu et date, ligne, signataire.
    const signX = left + thanksWidth + 30;
    const signWidth = width - thanksWidth - 30;
    const place = ORG.city
        ? `Fait à ${ORG.city}, le ${formatDate(issuedAt)}`
        : `Émis le ${formatDate(issuedAt)}`;
    doc.font("Helvetica").fontSize(9).fillColor(COLORS.ink3).text(place, signX, y + 6, { width: signWidth, align: "right" });
    doc.text(`Pour ${ORG.name},`, signX, y + 22, { width: signWidth, align: "right" });
    const lineY = y + boxHeight - 22;
    doc.moveTo(signX + 20, lineY).lineTo(signX + signWidth, lineY).lineWidth(0.6).stroke(COLORS.ink3);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(COLORS.ink)
        .text(ORG.signatory, signX, lineY + 6, { width: signWidth, align: "right", lineBreak: false });
    return y + boxHeight;
}

// Pied de page fixe sur chaque page : mention fiscale, coordonnees, reference et pagination.
function footers(doc, { reference }) {
    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
        doc.switchToPage(index);
        const bottomMargin = doc.page.margins.bottom;
        // Ecriture dans la marge basse sans declencher de nouvelle page.
        doc.page.margins.bottom = 0;
        const left = PAGE.margin;
        const width = contentWidth(doc);
        const top = doc.page.height - PAGE.footerHeight;

        doc.moveTo(left, top).lineTo(left + width, top).lineWidth(0.6).stroke(COLORS.line);
        doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.ink3).text(ORG.fiscalMention, left, top + 10, { width, lineGap: 1 });

        // Coordonnees sur toute la largeur, puis reference et pagination alignees a droite.
        const contact = [ORG.name, ORG.registration, ORG.email, ORG.phone].filter(Boolean).join("  ·  ");
        doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.ink3)
            .text(contact, left, doc.page.height - 44, { width, lineBreak: false, ellipsis: true });
        const pageLabel = range.count > 1 ? `${reference}  ·  page ${index - range.start + 1}/${range.count}` : reference;
        doc.font("Helvetica-Bold").fontSize(7.5).fillColor(COLORS.ink2)
            .text(pageLabel, left, doc.page.height - 30, { width, align: "right", lineBreak: false });
        doc.page.margins.bottom = bottomMargin;
    }
}

exports.generate = (payment) => {
    const view = receiptView(payment);
    const { doc, done } = createDoc(`Reçu de don ${view.receiptNumber}`);
    const left = PAGE.margin;
    const width = contentWidth(doc);

    header(doc, { kicker: "Reçu de don", title: `N° ${view.receiptNumber}`, subtitle: `Émis le ${formatDate(view.issuedAt)}` });

    // Montant (net des remboursements partiels) mis en avant dans un encadre.
    const net = view.amount - view.refundedAmount;
    const cardY = doc.y;
    const cardHeight = 104;
    doc.save().roundedRect(left, cardY, width, cardHeight, 10).clip();
    doc.rect(left, cardY, width, cardHeight).fill(COLORS.surface);
    doc.rect(left, cardY, 6, cardHeight).fill(COLORS.accentSolid);
    doc.restore();

    eyebrow(doc, view.refundedAmount ? "Montant net du don" : "Montant du don", left + 26, cardY + 20);
    doc.font("Helvetica-Bold").fontSize(30).fillColor(COLORS.ink)
        .text(formatAmount(net, view.currency), left + 26, cardY + 34, { lineBreak: false });
    doc.font("Helvetica").fontSize(8.5).fillColor(COLORS.ink3).text(
        `Soit environ ${equivalent(net, view.currency)} (parité fixe : 1 € = 655,957 FCFA)`,
        left + 26,
        cardY + 74,
        { width: 300, lineBreak: false }
    );

    // Tampon "Don recu" : confirme visuellement l'encaissement.
    const stampWidth = 138;
    const stampX = left + width - stampWidth - 22;
    const stampY = cardY + 22;
    doc.save().rotate(-6, { origin: [stampX + stampWidth / 2, stampY + 30] });
    doc.roundedRect(stampX, stampY, stampWidth, 60, 8).lineWidth(1.6).stroke(COLORS.brand);
    doc.roundedRect(stampX + 4, stampY + 4, stampWidth - 8, 52, 6).lineWidth(0.6).stroke(COLORS.brand);
    eyebrow(doc, "Don reçu", stampX, stampY + 13, { color: COLORS.brand, width: stampWidth, align: "center", size: 10 });
    doc.font("Helvetica").fontSize(8).fillColor(COLORS.brand)
        .text(formatDate(view.paidAt), stampX, stampY + 30, { width: stampWidth, align: "center", lineBreak: false });
    doc.fontSize(7)
        .text(view.frequency === "monthly" ? "Échéance mensuelle" : "Don ponctuel", stampX, stampY + 42, { width: stampWidth, align: "center", lineBreak: false });
    doc.restore();

    // Deux colonnes : donateur / details du don.
    const columnsY = cardY + cardHeight + 30;
    const gap = 32;
    const leftWidth = 190;
    const rightX = left + leftWidth + gap;
    const rightWidth = width - leftWidth - gap;

    const donorStart = sectionTitle(doc, "Donateur", left, columnsY, leftWidth);
    const leftEnd = fieldList(doc, [
        { label: "Nom", value: view.donorName, strong: true },
        { label: "Email", value: view.donorEmail },
    ], left, donorStart, leftWidth);

    const detailsY = sectionTitle(doc, "Détails du don", rightX, columnsY, rightWidth);
    const halfWidth = (rightWidth - 20) / 2;
    const firstColumn = fieldList(doc, [
        { label: "Date du don", value: formatDate(view.paidAt) },
        { label: "Nature du don", value: natureLabel(view.method) },
    ], rightX, detailsY, halfWidth);
    const secondColumn = fieldList(doc, [
        { label: "Moyen de paiement", value: methodLabel(view.method) },
        { label: "Type", value: frequencyLabel(view.frequency) },
    ], rightX + halfWidth + 20, detailsY, halfWidth);
    const rightEnd = fieldList(doc, [
        { label: "Affectation", value: view.designation, strong: true },
        { label: "Référence de transaction", value: view.transactionId },
    ], rightX, Math.max(firstColumn, secondColumn), rightWidth);

    let y = Math.max(leftEnd, rightEnd) + 8;
    if (view.refundedAmount) {
        y = callout(doc, {
            title: "Remboursement partiel",
            text: `Montant initial : ${formatAmount(view.amount, view.currency)}. Montant remboursé : ${formatAmount(view.refundedAmount, view.currency)}. Ce reçu porte sur le montant net retenu, soit ${formatAmount(net, view.currency)}.`,
            background: COLORS.accentSoft,
            color: COLORS.accentInk,
            x: left,
            y,
            width,
        }) + 12;
    }
    if (view.tribute) {
        y = callout(doc, { title: "Don en hommage", text: view.tribute, background: COLORS.surface, color: COLORS.brand, x: left, y, width }) + 12;
    }
    if (view.note) {
        y = callout(doc, { title: "Remarque", text: view.note, background: COLORS.brandSoft, color: COLORS.brand, x: left, y, width }) + 12;
    }

    // Signature ancree en bas de page (juste au-dessus du pied de page), comme sur un recu papier.
    const closingHeight = measureClosing(doc, view.donorName).height;
    if (y + 14 + closingHeight > contentBottom(doc)) {
        doc.addPage();
        continuationHeader(doc, `Reçu de don ${view.receiptNumber}`);
        y = doc.y - 14;
    }
    closing(doc, { donorName: view.donorName, issuedAt: view.issuedAt, y: Math.max(y + 14, contentBottom(doc) - closingHeight) });
    footers(doc, { reference: `Reçu n° ${view.receiptNumber}` });
    doc.end();
    return done;
};

// Recapitulatif annuel des dons d'un donateur (reference les recus individuels, sans nouveau numero).
exports.generateAnnual = ({ year, donorName, donorEmail, payments }) => {
    const title = `Récapitulatif des dons ${year}`;
    const { doc, done } = createDoc(title);
    const views = payments.map(receiptView);
    const left = PAGE.margin;
    const width = contentWidth(doc);

    header(doc, { kicker: "Récapitulatif annuel", title: `Dons ${year}`, subtitle: `Établi le ${formatDate(new Date())}` });

    // Donateur et chiffres cles.
    const totals = {};
    views.forEach((view) => {
        totals[view.currency] = (totals[view.currency] || 0) + (view.amount - view.refundedAmount);
    });
    // Chiffres cles sur toute la largeur : un total par devise, puis le nombre de dons.
    const topY = doc.y;
    const cards = [
        ...Object.entries(totals).map(([currency, total]) => ({
            label: currency === "xaf" ? "Total en francs CFA" : "Total en euros",
            value: formatAmount(total, currency),
        })),
        { label: "Dons confirmés", value: String(views.length), highlight: true },
    ];
    const cardGap = 12;
    const cardHeight = 52;
    const cardWidth = (width - cardGap * (cards.length - 1)) / cards.length;
    cards.forEach((card, index) => {
        const x = left + index * (cardWidth + cardGap);
        doc.save().roundedRect(x, topY, cardWidth, cardHeight, 8).clip();
        doc.rect(x, topY, cardWidth, cardHeight).fill(card.highlight ? COLORS.brandSoft : COLORS.surface);
        doc.rect(x, topY, 4, cardHeight).fill(card.highlight ? COLORS.brand : COLORS.accentSolid);
        doc.restore();
        eyebrow(doc, card.label, x + 16, topY + 11, { width: cardWidth - 28, size: 6.5 });
        doc.font("Helvetica-Bold").fontSize(17).fillColor(COLORS.ink)
            .text(card.value, x + 16, topY + 25, { width: cardWidth - 28, lineBreak: false });
    });

    // Donateur sur une ligne de trois colonnes.
    const infoY = topY + cardHeight + 16;
    const infoWidth = (width - 2 * 20) / 3;
    const donorEnd = Math.max(
        fieldList(doc, [{ label: "Donateur", value: donorName, strong: true }], left, infoY, infoWidth),
        fieldList(doc, [{ label: "Email", value: donorEmail }], left + infoWidth + 20, infoY, infoWidth),
        fieldList(doc, [{
            label: "Nature des dons",
            value: views.some((view) => view.method === "in_kind") ? `${DONATION_NATURE} et en nature` : DONATION_NATURE,
        }], left + (infoWidth + 20) * 2, infoY, infoWidth)
    );

    // Tableau des dons, en-tete repete sur chaque page.
    const amountWidth = 84;
    const columns = [
        { label: "Date", width: 60 },
        { label: "Reçu n°", width: 96 },
        { label: "Type · moyen", width: 112 },
        { label: "Affectation", width: width - 60 - 96 - 112 - amountWidth },
        { label: "Montant net", width: amountWidth, align: "right" },
    ];
    const padX = 8;
    const padY = 5;
    const tableHeader = (top) => {
        doc.roundedRect(left, top, width, 24, 5).fill(COLORS.brand);
        let x = left;
        columns.forEach((column) => {
            eyebrow(doc, column.label, x + padX, top + 9, {
                color: COLORS.onBrand, width: column.width - padX * 2, align: column.align || "left", size: 6.5,
            });
            x += column.width;
        });
        return top + 24;
    };

    let y = tableHeader(donorEnd + 6);
    const rows = views.length
        ? views.map((view) => [
            formatDate(view.paidAt),
            view.receiptNumber || "—",
            `${view.frequency === "monthly" ? "Mensuel" : "Ponctuel"} · ${methodLabel(view.method)}`,
            view.designation,
            formatAmount(view.amount - view.refundedAmount, view.currency),
        ])
        : [["—", "Aucun don confirmé sur l'année", "", "", ""]];

    rows.forEach((cells, rowIndex) => {
        doc.font("Helvetica").fontSize(8.5);
        const height = Math.max(...cells.map((cell, index) => (
            doc.heightOfString(String(cell), { width: columns[index].width - padX * 2 })
        ))) + padY * 2;
        if (y + height > contentBottom(doc)) {
            doc.addPage();
            continuationHeader(doc, title);
            y = tableHeader(doc.y);
        }
        if (rowIndex % 2 === 1) doc.rect(left, y, width, height).fill(COLORS.cream);
        let x = left;
        cells.forEach((cell, index) => {
            const column = columns[index];
            doc.font(index === 4 ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).fillColor(index === 1 ? COLORS.ink2 : COLORS.ink)
                .text(String(cell), x + padX, y + padY, { width: column.width - padX * 2, align: column.align || "left" });
            x += column.width;
        });
        y += height;
        doc.moveTo(left, y).lineTo(left + width, y).lineWidth(0.4).stroke(COLORS.line);
    });

    // Totaux par devise, alignes sous la colonne des montants (gardes avec la note sur une meme page).
    if (y + 10 + Object.keys(totals).length * 18 + 24 > contentBottom(doc)) {
        doc.addPage();
        continuationHeader(doc, title);
        y = doc.y;
    }
    y += 10;
    Object.entries(totals).forEach(([currency, total]) => {
        doc.font("Helvetica").fontSize(9).fillColor(COLORS.ink3)
            .text(`Total ${currency === "xaf" ? "FCFA" : "EUR"}`, left, y, { width: width - amountWidth - 12, align: "right", lineBreak: false });
        doc.font("Helvetica-Bold").fontSize(11).fillColor(COLORS.ink)
            .text(formatAmount(total, currency), left + width - amountWidth, y - 1.5, { width: amountWidth - padX, align: "right", lineBreak: false });
        y += 18;
    });
    doc.font("Helvetica").fontSize(7.5).fillColor(COLORS.ink3).text(
        `Dates exprimées dans le fuseau ${RECEIPT_TIMEZONE}. Chaque don figure aussi sur son reçu individuel, dont le numéro est rappelé ci-dessus.`,
        left,
        y + 4,
        { width }
    );

    y = doc.y + 14;
    if (y + measureClosing(doc, donorName).height > contentBottom(doc)) {
        doc.addPage();
        continuationHeader(doc, title);
        y = doc.y;
    }
    closing(doc, { donorName, issuedAt: new Date(), y });
    footers(doc, { reference: title });
    doc.end();
    return done;
};
