const PDFDocument = require("pdfkit");

const ORG = {
    name: process.env.ORG_NAME || "HOPE International",
    address: process.env.ORG_ADDRESS || "",
    registration: process.env.ORG_REGISTRATION || "",
    signatory: process.env.ORG_SIGNATORY || "La Direction générale",
    fiscalMention:
        process.env.RECEIPT_FISCAL_MENTION ||
        "Ce reçu atteste de la réception de votre don. Sa valeur fiscale dépend du statut de l'organisme bénéficiaire et de la législation applicable dans votre pays de résidence.",
};

const METHOD_LABELS = { card: "Carte bancaire", mobile_money: "Mobile Money" };

// Formatage manuel : les polices PDF standard ne gerent pas les espaces fines d'Intl.
function formatAmount(amount, currency) {
    const decimals = currency === "xaf" ? 0 : 2;
    const [integer, fraction] = Number(amount).toFixed(decimals).split(".");
    const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    const value = fraction ? `${grouped},${fraction}` : grouped;
    return currency === "xaf" ? `${value} FCFA` : `${value} €`;
}

function formatDate(value) {
    const date = new Date(value);
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

exports.formatAmount = formatAmount;

exports.generate = (payment) =>
    new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: "A4", margin: 56, info: { Title: `Reçu ${payment.receipt_number}` } });
        const chunks = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.on("end", () => resolve(Buffer.concat(chunks)));
        doc.on("error", reject);

        const green = "#1f5f4a";
        const muted = "#5b6b66";

        doc.rect(0, 0, doc.page.width, 8).fill(green);
        doc.moveDown(0.5);
        doc.fillColor(green).font("Helvetica-Bold").fontSize(20).text(ORG.name);
        doc.fillColor(muted).font("Helvetica").fontSize(9);
        if (ORG.address) doc.text(ORG.address);
        if (ORG.registration) doc.text(ORG.registration);

        doc.moveDown(2);
        doc.fillColor("#1b2622").font("Helvetica-Bold").fontSize(16).text("Reçu de don", { align: "left" });
        doc.font("Helvetica").fontSize(10).fillColor(muted)
            .text(`N° ${payment.receipt_number}  ·  émis le ${formatDate(payment.paid_at || payment.created_at)}`);

        doc.moveDown(1.5);
        const rows = [
            ["Donateur", payment.donor_name || "—"],
            ["Email", payment.donor_email || "—"],
            ["Montant", formatAmount(payment.amount, payment.currency)],
            ["Date du don", formatDate(payment.paid_at || payment.created_at)],
            ["Moyen de paiement", METHOD_LABELS[payment.method] || payment.method],
            ["Type", payment.frequency === "monthly" ? "Don mensuel (échéance)" : "Don ponctuel"],
            ["Affectation", payment.project_title || "Fonds général de l'association"],
            ["Référence de transaction", payment.transaction_id || "—"],
        ];

        const labelX = doc.page.margins.left;
        const valueX = labelX + 170;
        rows.forEach(([label, value]) => {
            const y = doc.y;
            doc.font("Helvetica").fontSize(10).fillColor(muted).text(label, labelX, y, { width: 160 });
            doc.font(label === "Montant" ? "Helvetica-Bold" : "Helvetica").fontSize(label === "Montant" ? 13 : 10)
                .fillColor("#1b2622").text(String(value), valueX, y, { width: 320 });
            doc.moveDown(0.6);
        });

        doc.moveDown(1.5);
        doc.x = labelX;
        doc.font("Helvetica").fontSize(10).fillColor("#1b2622")
            .text(`${ORG.name} remercie chaleureusement ${payment.donor_name || "le donateur"} pour son soutien.`, { width: 480 });
        doc.moveDown(1);
        doc.fontSize(8.5).fillColor(muted).text(ORG.fiscalMention, { width: 480 });

        doc.moveDown(3);
        doc.fontSize(10).fillColor("#1b2622").text(ORG.signatory, { align: "right" });

        doc.end();
    });
