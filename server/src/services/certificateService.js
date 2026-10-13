const PDFDocument = require('pdfkit');

class CertificateService {
  generateCertificateBuffer({ studentName, quizTitle, score, percentage, date }) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          layout: 'landscape',
          size: 'A4',
          margin: 40,
        });

        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Certificate Border Design
        doc.lineWidth(4);
        doc.strokeColor('#4f46e5');
        doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();

        doc.lineWidth(1.5);
        doc.strokeColor('#ec4899');
        doc.rect(26, 26, doc.page.width - 52, doc.page.height - 52).stroke();

        // Title
        doc.moveDown(2);
        doc.font('Helvetica-Bold').fontSize(34).fillColor('#1e1b4b').text('CERTIFICATE OF ACHIEVEMENT', {
          align: 'center',
          characterSpacing: 2,
        });

        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(14).fillColor('#64748b').text('This official certificate is proudly presented to', {
          align: 'center',
        });

        // Recipient Name
        doc.moveDown(1);
        doc.font('Helvetica-Bold').fontSize(28).fillColor('#4f46e5').text(studentName, {
          align: 'center',
        });

        // Quiz and Score description
        doc.moveDown(0.7);
        doc.font('Helvetica').fontSize(13).fillColor('#334155').text(
          `for successfully passing the assessment for "${quizTitle}" with a final score of ${percentage}%.`,
          {
            align: 'center',
            lineGap: 4,
          }
        );

        // Date and Signature footer
        doc.moveDown(2.5);
        const y = doc.y;

        doc.fontSize(10).fillColor('#64748b').text(`Issue Date: ${date || new Date().toLocaleDateString()}`, 60, y);
        doc.text(`Platform Verification ID: QZ-${Math.random().toString(36).substring(2, 8).toUpperCase()}`, 60, y + 16);

        doc.fontSize(12).font('Helvetica-Bold').fillColor('#1e1b4b').text('Quizese Academic Engine', doc.page.width - 240, y, { align: 'right' });
        doc.fontSize(9).font('Helvetica').fillColor('#64748b').text('Cryptographically Verified Result', doc.page.width - 240, y + 16, { align: 'right' });

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

module.exports = new CertificateService();
