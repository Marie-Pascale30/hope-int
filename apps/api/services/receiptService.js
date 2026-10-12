// Facade des recus : fonctions pures (receiptFormat) et generation PDF (receiptPdf).
const format = require("./receiptFormat");
const pdf = require("./receiptPdf");

module.exports = {
    formatAmount: format.formatAmount,
    formatDate: format.formatDate,
    receiptYear: format.receiptYear,
    yearBounds: format.yearBounds,
    monthKey: format.monthKey,
    receiptView: format.receiptView,
    RECEIPT_TIMEZONE: format.RECEIPT_TIMEZONE,
    generate: pdf.generate,
    generateAnnual: pdf.generateAnnual,
};
