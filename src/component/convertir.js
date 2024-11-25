import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { create } from 'xmlbuilder2';
import '../css/convertir.css'; // Import the CSS file

function Convertir() {
  const [xmlContent, setXmlContent] = useState('');
  const [fileName, setFileName] = useState('output.xml');

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const [titleRow, ...dataRows] = jsonData;

        const xmlDoc = create({ version: '1.0', encoding: 'UTF-8', standalone: true });
        const root = xmlDoc.ele('DeclarationsRS', { VersionSchema: '1.0' });

        // Declarant section
        const declarant = root.ele('Declarant');
        declarant.ele('TypeIdentifiant').txt('1');
        declarant.ele('Identifiant').txt('0002766B');
        declarant.ele('CategorieContribuable').txt('PM');

        // ReferenceDeclaration section
        const referenceDeclaration = root.ele('ReferenceDeclaration');
        referenceDeclaration.ele('ActeDepot').txt('0');
        referenceDeclaration.ele('AnneeDepot').txt('2024');
        referenceDeclaration.ele('MoisDepot').txt('10');

        // AjouterCertificats section
        const ajouterCertificats = root.ele('AjouterCertificats');

        // Generate Certificat elements for each row
        dataRows.forEach((row) => {
          const certificat = ajouterCertificats.ele('Certificat');
          const beneficiaire = certificat.ele('Beneficiaire');

          // IdTaxpayer and MatriculeFiscal section with condition for DATE_NAISSANCE
          const idTaxpayer = beneficiaire.ele('IdTaxpayer');
          const matriculeFiscal = idTaxpayer.ele('MatriculeFiscal');
          const typeIdentifiant = row[titleRow.indexOf('TYPE_IDENTIFIANT')];
          matriculeFiscal.ele('TypeIdentifiant').txt(typeIdentifiant);
          matriculeFiscal.ele('Identifiant').txt(row[titleRow.indexOf('IDENTIFIANT')]);

          // Add DATE_NAISSANCE only if it's a valid date
          const dateNaissanceIndex = titleRow.indexOf('DATE_NAISSANCE');
          const dateValue = row[dateNaissanceIndex];
          if (typeof dateValue === 'number') {
            const parsedDate = XLSX.SSF.parse_date_code(dateValue);
            const formattedDate = `${String(parsedDate.d).padStart(2, '0')}/${String(parsedDate.m).padStart(2, '0')}/${parsedDate.y}`;
            matriculeFiscal.ele('DATE_NAISSANCE').txt(formattedDate);
          } else if (dateValue && dateValue.trim() !== '') {
            matriculeFiscal.ele('DATE_NAISSANCE').txt(dateValue);
          }

          matriculeFiscal.ele('CategorieContribuable').txt(row[titleRow.indexOf('CATEGORIE_CONTRIBUABLE')]);
          beneficiaire.ele('Resident').txt(row[titleRow.indexOf('RESIDENT')]);
          beneficiaire.ele('NometprenonOuRaisonsociale').txt(row[titleRow.indexOf('NOM_PRENOM')]);
          beneficiaire.ele('Adresse').txt(row[titleRow.indexOf('ADRESSE')]);
          beneficiaire.ele('Activite').txt(row[titleRow.indexOf('ACTIVITé')]);

          const infosContact = beneficiaire.ele('InfosContact');
          infosContact.ele('AdresseMail').txt(row[titleRow.indexOf('ADRESSE_MAIL')]);
          infosContact.ele('NumTel').txt(row[titleRow.indexOf('NUM_TEL')]);

          // Additional fields for Certificat
          const datePayementIndex = titleRow.indexOf('DATE_PAIEMNT');
          const datePayementValue = row[datePayementIndex];
          if (typeof datePayementValue === 'number') {
            const parsedDatePayement = XLSX.SSF.parse_date_code(datePayementValue);
            const formattedDatePayement = `${String(parsedDatePayement.d).padStart(2, '0')}/${String(parsedDatePayement.m).padStart(2, '0')}/${parsedDatePayement.y}`;
            certificat.ele('DatePayement').txt(formattedDatePayement);
          } else {
            certificat.ele('DatePayement').txt(datePayementValue);
          }
          certificat.ele('Ref_certif_chez_declarant').txt(row[titleRow.indexOf('REF_CERTF_CHEZ_DECLARANT')]);

          // ListeOperations section with dynamic IdTypeOperation attribute
          const listeOperations = certificat.ele('ListeOperations');
          const operationIdType = row[titleRow.indexOf('ID_NATURE_FK')];
          const operation = listeOperations.ele('Operation', { IdTypeOperation: operationIdType });
          const anneeFacturationIndex = titleRow.indexOf('ANNE_FACTURATION');
          const anneeFacturationValue = row[anneeFacturationIndex];
          if (typeof anneeFacturationValue === 'number') {
            const parsedAnneeFacturation = XLSX.SSF.parse_date_code(anneeFacturationValue);
            const year = parsedAnneeFacturation.y;
            const month = String(parsedAnneeFacturation.m).padStart(2, '0');
            operation.ele('AnneeFacturation').txt(`${year}-${month}`);
            setFileName(`0002766B-${year}-${month}.xml`);
          } else {
            operation.ele('AnneeFacturation').txt(anneeFacturationValue);
          }
          operation.ele('CNPC').txt('0');
          operation.ele('P_Charge').txt('0');
          operation.ele('MontantHT').txt(row[titleRow.indexOf('MONTANT_HT')]);
        });

        const xmlString = xmlDoc.end({ prettyPrint: true });
        setXmlContent(xmlString);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const downloadXML = () => {
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
  };

  return (
    <div className="converter-container">
      <h1>Excel to XML Converter</h1>
      {!xmlContent && (
        <>
          <label htmlFor="file-upload" className="custom-file-upload">
            Choose File
          </label>
          <input
            type="file"
            id="file-upload"
            accept=".xlsx, .xls"
            onChange={handleFileUpload}
            style={{ display: 'none' }}
          />
        </>
      )}
      {xmlContent && (
        <>
          <h2>Generated XML</h2>
          <textarea rows="20" cols="80" value={xmlContent} readOnly />
          <button onClick={downloadXML}>Download XML</button>
          <div style={{ marginTop: '20px' }}>
            <label htmlFor="file-upload" className="custom-file-upload">
              Upload another file
            </label>
            <input
              type="file"
              id="file-upload"
              accept=".xlsx, .xls"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default Convertir;

















// import React, { useState } from 'react';
// import * as XLSX from 'xlsx';
// import { create } from 'xmlbuilder2';
// import '../css/convertir.css'; // Import the CSS file

// function Convertir() {
//   const [xmlContent, setXmlContent] = useState('');
//   const [fileName, setFileName] = useState('output.xml');

//   const handleFileUpload = (event) => {
//     const file = event.target.files[0];
//     if (file) {
//       const reader = new FileReader();
//       reader.onload = (e) => {
//         const data = new Uint8Array(e.target.result);
//         const workbook = XLSX.read(data, { type: 'array' });
//         const worksheet = workbook.Sheets[workbook.SheetNames[0]];
//         const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

//         const [titleRow, ...dataRows] = jsonData;

//         const xmlDoc = create({ version: '1.0', encoding: 'UTF-8', standalone: true });
//         const root = xmlDoc.ele('DeclarationsRS', { VersionSchema: '1.0' });

//         // Declarant section
//         const declarant = root.ele('Declarant');
//         declarant.ele('TypeIdentifiant').txt('1');
//         declarant.ele('Identifiant').txt('0002766B');
//         declarant.ele('CategorieContribuable').txt('PM');

//         // ReferenceDeclaration section
//         const referenceDeclaration = root.ele('ReferenceDeclaration');
//         referenceDeclaration.ele('ActeDepot').txt('0');
//         referenceDeclaration.ele('AnneeDepot').txt('2024');
//         referenceDeclaration.ele('MoisDepot').txt('10');

//         // AjouterCertificats section
//         const ajouterCertificats = root.ele('AjouterCertificats');

//         // Create one Certificat
//         const certificat = ajouterCertificats.ele('Certificat');
//         const beneficiaire = certificat.ele('Beneficiaire');
//         const idTaxpayer = beneficiaire.ele('IdTaxpayer');
//         const matriculeFiscal = idTaxpayer.ele('MatriculeFiscal');
//         matriculeFiscal.ele('TypeIdentifiant').txt('1');
//         matriculeFiscal.ele('Identifiant').txt('1216416ZAP');

//         // Add other Beneficiaire fields
//         beneficiaire.ele('Resident').txt('0');
//         beneficiaire.ele('NometprenonOuRaisonsociale').txt('NEFZI FETEN KINESYTHERAPEUTE');
//         beneficiaire.ele('Adresse').txt('Rue Mohamed Ali Abid - Borjlouzir');
//         beneficiaire.ele('Activite').txt('KINESYTHERAPEUTE');

//         const infosContact = beneficiaire.ele('InfosContact');
//         infosContact.ele('AdresseMail').txt('');
//         infosContact.ele('NumTel').txt('');

//         // Create ListeOperations under the same Certificat
//         const listeOperations = certificat.ele('ListeOperations');
//         let totalMontantHT = 0;
//         let totalMontantTTC = 0;
//         let yearFromRow = 'default_year'; // Default if no valid date found

//         // Processing rows and adding operations
//         dataRows.forEach((row) => {
//           const idNature = row[titleRow.indexOf('ID_NATURE_FK')];
//           let anneeFacturation = row[titleRow.indexOf('ANNE_FACTURATION')];

//           // If AnneeFacturation is in Excel serial date format, convert it to a proper year
//           if (anneeFacturation) {
//             if (typeof anneeFacturation === 'number') {
//               const excelDate = new Date((anneeFacturation - 25569) * 86400 * 1000);
//               anneeFacturation = excelDate.getFullYear();
//             }
//           }

//           if (!idNature || !anneeFacturation || idNature === '0' || anneeFacturation === '01/01/1900') {
//             return; // Skip this row if the essential fields are missing or invalid
//           }

//           // Update the year from the first valid row
//           if (yearFromRow === 'default_year') {
//             yearFromRow = anneeFacturation;
//           }

//           // Add an Operation to ListeOperations
//           const operation = listeOperations.ele('Operation', {
//             IdTypeOperation: idNature,
//           })
//             .ele('AnneeFacturation').txt(anneeFacturation).up() // Close the AnneeFacturation element properly
//             .ele('MontantHT').txt(row[titleRow.indexOf('MONTANT_HT')]).up() // Close the MontantHT element properly
//             .ele('TauxRS').txt(row[titleRow.indexOf('TAUX_RS')]).up() // Close the TauxRS element properly
//             .ele('MontantTTC').txt(row[titleRow.indexOf('MONTANT_TTC')]); // Add MontantTTC as a sibling element

//           // Update totals
//           totalMontantHT += parseFloat(row[titleRow.indexOf('MONTANT_HT')] || 0);
//           totalMontantTTC += parseFloat(row[titleRow.indexOf('MONTANT_TTC')] || 0);
//         });

//         // Add the total under the Certificat
//         const total = certificat.ele('Total');
//         total.ele('TOTAL_MONTANT_HT').txt(totalMontantHT);
//         total.ele('TOTAL_MONTANT_TTC').txt(totalMontantTTC);

//         // Set the file name based on the first valid AnneeFacturation
//         setFileName(`0002766B-${yearFromRow}.xml`);

//         const xmlString = xmlDoc.end({ prettyPrint: true });
//         setXmlContent(xmlString);
//       };
//       reader.readAsArrayBuffer(file);
//     }
//   };

//   const downloadXML = () => {
//     const blob = new Blob([xmlContent], { type: 'application/xml' });
//     const link = document.createElement('a');
//     link.href = URL.createObjectURL(blob);
//     link.download = fileName;
//     link.click();
//   };

//   return (
//     <div className="converter-container">
//       <h1>Excel to XML Converter</h1>
//       {!xmlContent && (
//         <>
//           <label htmlFor="file-upload" className="custom-file-upload">
//             Choose File
//           </label>
//           <input
//             type="file"
//             id="file-upload"
//             accept=".xlsx, .xls"
//             onChange={handleFileUpload}
//             style={{ display: 'none' }}
//           />
//         </>
//       )}
//       {xmlContent && (
//         <>
//           <h2>Generated XML</h2>
//           <textarea rows="20" cols="80" value={xmlContent} readOnly />
//           <button onClick={downloadXML}>Download XML</button>
//           <div style={{ marginTop: '20px' }}>
//             <label htmlFor="file-upload" className="custom-file-upload">
//               Upload another file
//             </label>
//             <input
//               type="file"
//               id="file-upload"
//               accept=".xlsx, .xls"
//               onChange={handleFileUpload}
//               style={{ display: 'none' }}
//             />
//           </div>
//         </>
//       )}
//     </div>
//   );
// }

// export default Convertir;






























// import React, { useState } from 'react';
// import * as XLSX from 'xlsx';
// import { create } from 'xmlbuilder2';
// import '../css/convertir.css'; // Import the CSS file

// function Convertir() {
//   const [xmlContent, setXmlContent] = useState('');
//   const [fileName, setFileName] = useState('output.xml');

//   const handleFileUpload = (event) => {
//     const file = event.target.files[0];
//     if (file) {
//       const reader = new FileReader();
//       reader.onload = (e) => {
//         const data = new Uint8Array(e.target.result);
//         const workbook = XLSX.read(data, { type: 'array' });
//         const worksheet = workbook.Sheets[workbook.SheetNames[0]];
//         const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

//         const [titleRow, ...dataRows] = jsonData;

//         const xmlDoc = create({ version: '1.0', encoding: 'UTF-8', standalone: true });
//         const root = xmlDoc.ele('DeclarationsRS', { VersionSchema: '1.0' });

//         // Declarant section - get values from the Excel file
//         const declarant = root.ele('Declarant');
//         declarant.ele('TypeIdentifiant').txt(dataRows[0][titleRow.indexOf('TypeIdentifiant')] || '1'); // Default value '1'
//         declarant.ele('Identifiant').txt(dataRows[0][titleRow.indexOf('Identifiant')] || '0002766B'); // Default value '0002766B'
//         declarant.ele('CategorieContribuable').txt(dataRows[0][titleRow.indexOf('CategorieContribuable')] || 'PM'); // Default value 'PM'

//         // ReferenceDeclaration section - get values from the Excel file
//         const referenceDeclaration = root.ele('ReferenceDeclaration');
//         referenceDeclaration.ele('ActeDepot').txt(dataRows[0][titleRow.indexOf('ActeDepot')] || '0'); // Default value '0'
//         referenceDeclaration.ele('AnneeDepot').txt(dataRows[0][titleRow.indexOf('AnneeDepot')] || '2024'); // Default value '2024'
//         referenceDeclaration.ele('MoisDepot').txt(dataRows[0][titleRow.indexOf('MoisDepot')] || '10'); // Default value '10'

//         // AjouterCertificats section
//         const ajouterCertificats = root.ele('AjouterCertificats');

//         // Create one Certificat
//         const certificat = ajouterCertificats.ele('Certificat');
//         const beneficiaire = certificat.ele('Beneficiaire');
//         const idTaxpayer = beneficiaire.ele('IdTaxpayer');
//         const matriculeFiscal = idTaxpayer.ele('MatriculeFiscal');
//         matriculeFiscal.ele('TypeIdentifiant').txt('1');
//         matriculeFiscal.ele('Identifiant').txt('1216416ZAP');

//         // Add other Beneficiaire fields
//         beneficiaire.ele('Resident').txt('0');
//         beneficiaire.ele('NometprenonOuRaisonsociale').txt('NEFZI FETEN KINESYTHERAPEUTE');
//         beneficiaire.ele('Adresse').txt('Rue Mohamed Ali Abid - Borjlouzir');
//         beneficiaire.ele('Activite').txt('KINESYTHERAPEUTE');

//         const infosContact = beneficiaire.ele('InfosContact');
//         infosContact.ele('AdresseMail').txt('');
//         infosContact.ele('NumTel').txt('');

//         // Create ListeOperations under the same Certificat
//         const listeOperations = certificat.ele('ListeOperations');
//         let totalMontantHT = 0;
//         let totalMontantTTC = 0;
//         let yearFromRow = 'default_year'; // Default if no valid date found

//         // Processing rows and adding operations
//         dataRows.forEach((row) => {
//           const idNature = row[titleRow.indexOf('ID_NATURE_FK')];
//           let anneeFacturation = row[titleRow.indexOf('ANNE_FACTURATION')];

//           // If AnneeFacturation is in Excel serial date format, convert it to a proper year
//           if (anneeFacturation) {
//             if (typeof anneeFacturation === 'number') {
//               const excelDate = new Date((anneeFacturation - 25569) * 86400 * 1000);
//               anneeFacturation = excelDate.getFullYear();
//             }
//           }

//           if (!idNature || !anneeFacturation || idNature === '0' || anneeFacturation === '01/01/1900') {
//             return; // Skip this row if the essential fields are missing or invalid
//           }

//           // Update the year from the first valid row
//           if (yearFromRow === 'default_year') {
//             yearFromRow = anneeFacturation;
//           }

//           // Add an Operation to ListeOperations
//           const operation = listeOperations.ele('Operation', {
//             IdTypeOperation: idNature,
//           })
//           .ele('AnneeFacturation').txt(anneeFacturation) // Use the correct year
//           .ele('MontantHT').txt(row[titleRow.indexOf('MONTANT_HT')])
//           .ele('TauxRS').txt(row[titleRow.indexOf('TAUX_RS')])
//           .ele('MontantTTC').txt(row[titleRow.indexOf('MONTANT_TTC')]);

//           // Update totals
//           totalMontantHT += parseFloat(row[titleRow.indexOf('MONTANT_HT')] || 0);
//           totalMontantTTC += parseFloat(row[titleRow.indexOf('MONTANT_TTC')] || 0);
//         });

//         // Add the total under the Certificat
//         const total = certificat.ele('Total');
//         total.ele('TOTAL_MONTANT_HT').txt(totalMontantHT);
//         total.ele('TOTAL_MONTANT_TTC').txt(totalMontantTTC);

//         // Set the file name based on the first valid AnneeFacturation
//         setFileName(`0002766B-${yearFromRow}.xml`);

//         const xmlString = xmlDoc.end({ prettyPrint: true });
//         setXmlContent(xmlString);
//       };
//       reader.readAsArrayBuffer(file);
//     }
//   };

//   const downloadXML = () => {
//     const blob = new Blob([xmlContent], { type: 'application/xml' });
//     const link = document.createElement('a');
//     link.href = URL.createObjectURL(blob);
//     link.download = fileName;
//     link.click();
//   };

//   return (
//     <div className="converter-container">
//       <h1>Excel to XML Converter</h1>
//       {!xmlContent && (
//         <>
//           <label htmlFor="file-upload" className="custom-file-upload">
//             Choose File
//           </label>
//           <input
//             type="file"
//             id="file-upload"
//             accept=".xlsx, .xls"
//             onChange={handleFileUpload}
//             style={{ display: 'none' }}
//           />
//         </>
//       )}
//       {xmlContent && (
//         <>
//           <h2>Generated XML</h2>
//           <textarea rows="20" cols="80" value={xmlContent} readOnly />
//           <button onClick={downloadXML}>Download XML</button>
//           <div style={{ marginTop: '20px' }}>
//             <label htmlFor="file-upload" className="custom-file-upload">
//               Upload another file
//             </label>
//             <input
//               type="file"
//               id="file-upload"
//               accept=".xlsx, .xls"
//               onChange={handleFileUpload}
//               style={{ display: 'none' }}
//             />
//           </div>
//         </>
//       )}
//     </div>
//   );
// }

// export default Convertir;















// import React, { useState } from 'react';
// import * as XLSX from 'xlsx';
// import { create } from 'xmlbuilder2';
// import '../css/convertir.css'; // Import the CSS file

// function Convertir() {
//   const [xmlContent, setXmlContent] = useState('');
//   const [fileName, setFileName] = useState('output.xml');

//   const handleFileUpload = (event) => {
//     const file = event.target.files[0];
//     if (file) {
//       const reader = new FileReader();
//       reader.onload = (e) => {
//         const data = new Uint8Array(e.target.result);
//         const workbook = XLSX.read(data, { type: 'array' });
//         const worksheet = workbook.Sheets[workbook.SheetNames[0]];
//         const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

//         const [titleRow, ...dataRows] = jsonData;

//         const xmlDoc = create({ version: '1.0', encoding: 'UTF-8', standalone: true });
//         const root = xmlDoc.ele('DeclarationsRS', { VersionSchema: '1.0' });

//         // Declarant section
//         const declarant = root.ele('Declarant');
//         declarant.ele('TypeIdentifiant').txt('1');
//         declarant.ele('Identifiant').txt('0002766B');
//         declarant.ele('CategorieContribuable').txt('PM');

//         // ReferenceDeclaration section
//         const referenceDeclaration = root.ele('ReferenceDeclaration');
//         referenceDeclaration.ele('ActeDepot').txt('0');
//         referenceDeclaration.ele('AnneeDepot').txt('2024');
//         referenceDeclaration.ele('MoisDepot').txt('10');

//         // AjouterCertificats section
//         const ajouterCertificats = root.ele('AjouterCertificats');

//         // Create one Certificat
//         const certificat = ajouterCertificats.ele('Certificat');
//         const beneficiaire = certificat.ele('Beneficiaire');
//         const idTaxpayer = beneficiaire.ele('IdTaxpayer');
//         const matriculeFiscal = idTaxpayer.ele('MatriculeFiscal');
//         matriculeFiscal.ele('TypeIdentifiant').txt('1');
//         matriculeFiscal.ele('Identifiant').txt('1216416ZAP');

//         // Add other Beneficiaire fields
//         beneficiaire.ele('Resident').txt('0');
//         beneficiaire.ele('NometprenonOuRaisonsociale').txt('NEFZI FETEN KINESYTHERAPEUTE');
//         beneficiaire.ele('Adresse').txt('Rue Mohamed Ali Abid - Borjlouzir');
//         beneficiaire.ele('Activite').txt('KINESYTHERAPEUTE');

//         const infosContact = beneficiaire.ele('InfosContact');
//         infosContact.ele('AdresseMail').txt('');
//         infosContact.ele('NumTel').txt('');

//         // Create ListeOperations under the same Certificat
//         const listeOperations = certificat.ele('ListeOperations');
//         let totalMontantHT = 0;
//         let totalMontantTTC = 0;

//         // Processing rows and adding operations
//         dataRows.forEach((row) => {
//           const idNature = row[titleRow.indexOf('ID_NATURE_FK')];
//           const anneeFacturation = row[titleRow.indexOf('ANNE_FACTURATION')];

//           if (!idNature || !anneeFacturation || idNature === '0' || anneeFacturation === '01/01/1900') {
//             return; // Skip this row if the essential fields are missing or invalid
//           }

//           // Add an Operation to ListeOperations
//           const operation = listeOperations.ele('Operation', {
//             IdTypeOperation: idNature,
//           })
//           .ele('AnneeFacturation').txt(anneeFacturation) // Use the correct year
//           .ele('MontantHT').txt(row[titleRow.indexOf('MONTANT_HT')])
//           .ele('TauxRS').txt(row[titleRow.indexOf('TAUX_RS')])
//           .ele('MontantTTC').txt(row[titleRow.indexOf('MONTANT_TTC')]);


//           // Update totals
//           totalMontantHT += parseFloat(row[titleRow.indexOf('MONTANT_HT')] || 0);
//           totalMontantTTC += parseFloat(row[titleRow.indexOf('MONTANT_TTC')] || 0);
//         });

//         // Add the total under the Certificat
//         const total = certificat.ele('Total');
//         total.ele('TOTAL_MONTANT_HT').txt(totalMontantHT);
//         total.ele('TOTAL_MONTANT_TTC').txt(totalMontantTTC);

//         // Set the file name based on AnneeFacturation (first row as example)
//         const yearFromRow = dataRows[0][titleRow.indexOf('ANNE_FACTURATION')] || 'default_year';
//         setFileName(`0002766B-${yearFromRow}.xml`);

//         const xmlString = xmlDoc.end({ prettyPrint: true });
//         setXmlContent(xmlString);
//       };
//       reader.readAsArrayBuffer(file);
//     }
//   };

//   const downloadXML = () => {
//     const blob = new Blob([xmlContent], { type: 'application/xml' });
//     const link = document.createElement('a');
//     link.href = URL.createObjectURL(blob);
//     link.download = fileName;
//     link.click();
//   };

//   return (
//     <div className="converter-container">
//       <h1>Excel to XML Converter</h1>
//       {!xmlContent && (
//         <>
//           <label htmlFor="file-upload" className="custom-file-upload">
//             Choose File
//           </label>
//           <input
//             type="file"
//             id="file-upload"
//             accept=".xlsx, .xls"
//             onChange={handleFileUpload}
//             style={{ display: 'none' }}
//           />
//         </>
//       )}
//       {xmlContent && (
//         <>
//           <h2>Generated XML</h2>
//           <textarea rows="20" cols="80" value={xmlContent} readOnly />
//           <button onClick={downloadXML}>Download XML</button>
//           <div style={{ marginTop: '20px' }}>
//             <label htmlFor="file-upload" className="custom-file-upload">
//               Upload another file
//             </label>
//             <input
//               type="file"
//               id="file-upload"
//               accept=".xlsx, .xls"
//               onChange={handleFileUpload}
//               style={{ display: 'none' }}
//             />
//           </div>
//         </>
//       )}
//     </div>
//   );
// }

// export default Convertir;












// import React, { useState } from 'react';
// import * as XLSX from 'xlsx';
// import { create } from 'xmlbuilder2';
// import '../css/convertir.css'; // Import the CSS file

// function Convertir() {
//   const [xmlContent, setXmlContent] = useState('');
//   const [fileName, setFileName] = useState('output.xml');

//   const handleFileUpload = (event) => {
//     const file = event.target.files[0];
//     if (file) {
//       const reader = new FileReader();
//       reader.onload = (e) => {
//         const data = new Uint8Array(e.target.result);
//         const workbook = XLSX.read(data, { type: 'array' });
//         const worksheet = workbook.Sheets[workbook.SheetNames[0]];
//         const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

//         const [titleRow, ...dataRows] = jsonData;

//         const xmlDoc = create({ version: '1.0', encoding: 'UTF-8', standalone: true });
//         const root = xmlDoc.ele('DeclarationsRS', { VersionSchema: '1.0' });

//         // Declarant section
//         const declarant = root.ele('Declarant');
//         declarant.ele('TypeIdentifiant').txt('1');
//         declarant.ele('Identifiant').txt('0002766B');
//         declarant.ele('CategorieContribuable').txt('PM');

//         // ReferenceDeclaration section
//         const referenceDeclaration = root.ele('ReferenceDeclaration');
//         referenceDeclaration.ele('ActeDepot').txt('0');
//         referenceDeclaration.ele('AnneeDepot').txt('2024');
//         referenceDeclaration.ele('MoisDepot').txt('10');

//         // AjouterCertificats section
//         const ajouterCertificats = root.ele('AjouterCertificats');

//         // Create one Certificat
//         const certificat = ajouterCertificats.ele('Certificat');
//         const beneficiaire = certificat.ele('Beneficiaire');
//         const idTaxpayer = beneficiaire.ele('IdTaxpayer');
//         const matriculeFiscal = idTaxpayer.ele('MatriculeFiscal');
//         matriculeFiscal.ele('TypeIdentifiant').txt('1');
//         matriculeFiscal.ele('Identifiant').txt('1216416ZAP');

//         // Add other Beneficiaire fields
//         beneficiaire.ele('Resident').txt('0');
//         beneficiaire.ele('NometprenonOuRaisonsociale').txt('NEFZI FETEN KINESYTHERAPEUTE');
//         beneficiaire.ele('Adresse').txt('Rue Mohamed Ali Abid - Borjlouzir');
//         beneficiaire.ele('Activite').txt('KINESYTHERAPEUTE');

//         const infosContact = beneficiaire.ele('InfosContact');
//         infosContact.ele('AdresseMail').txt('');
//         infosContact.ele('NumTel').txt('');

//         // Create ListeOperations under the same Certificat
//         const listeOperations = certificat.ele('ListeOperations');
//         let totalMontantHT = 0;
//         let totalMontantTTC = 0;

//         // Processing rows and adding operations
//         dataRows.forEach((row) => {
//           const idNature = row[titleRow.indexOf('ID_NATURE_FK')];
//           const anneeFacturation = row[titleRow.indexOf('ANNE_FACTURATION')];

//           if (!idNature || !anneeFacturation) {
//             return; // Skip this row if essential fields are missing
//           }

//           // Add an Operation to ListeOperations
//           const operation = listeOperations.ele('Operation', {
//             IdTypeOperation: idNature,
//           })
//           .ele('AnneeFacturation').txt(anneeFacturation) // Use the correct year
//           .ele('MontantHT').txt(row[titleRow.indexOf('MONTANT_HT')])
//           .ele('TauxRS').txt(row[titleRow.indexOf('TAUX_RS')])
//           .ele('MontantTTC').txt(row[titleRow.indexOf('MONTANT_TTC')]);


//           // Update totals
//           totalMontantHT += parseFloat(row[titleRow.indexOf('MONTANT_HT')] || 0);
//           totalMontantTTC += parseFloat(row[titleRow.indexOf('MONTANT_TTC')] || 0);
//         });

//         // Add the total under the Certificat
//         const total = certificat.ele('Total');
//         total.ele('TOTAL_MONTANT_HT').txt(totalMontantHT);
//         total.ele('TOTAL_MONTANT_TTC').txt(totalMontantTTC);

//         // Set the file name based on AnneeFacturation (first row as example)
//         const yearFromRow = dataRows[0][titleRow.indexOf('ANNE_FACTURATION')] || 'default_year';
//         setFileName(`0002766B-${yearFromRow}.xml`);

//         const xmlString = xmlDoc.end({ prettyPrint: true });
//         setXmlContent(xmlString);
//       };
//       reader.readAsArrayBuffer(file);
//     }
//   };

//   const downloadXML = () => {
//     const blob = new Blob([xmlContent], { type: 'application/xml' });
//     const link = document.createElement('a');
//     link.href = URL.createObjectURL(blob);
//     link.download = fileName;
//     link.click();
//   };

//   return (
//     <div className="converter-container">
//       <h1>Excel to XML Converter</h1>
//       {!xmlContent && (
//         <>
//           <label htmlFor="file-upload" className="custom-file-upload">
//             Choose File
//           </label>
//           <input
//             type="file"
//             id="file-upload"
//             accept=".xlsx, .xls"
//             onChange={handleFileUpload}
//             style={{ display: 'none' }}
//           />
//         </>
//       )}
//       {xmlContent && (
//         <>
//           <h2>Generated XML</h2>
//           <textarea rows="20" cols="80" value={xmlContent} readOnly />
//           <button onClick={downloadXML}>Download XML</button>
//           <div style={{ marginTop: '20px' }}>
//             <label htmlFor="file-upload" className="custom-file-upload">
//               Upload another file
//             </label>
//             <input
//               type="file"
//               id="file-upload"
//               accept=".xlsx, .xls"
//               onChange={handleFileUpload}
//               style={{ display: 'none' }}
//             />
//           </div>
//         </>
//       )}
//     </div>
//   );
// }

// export default Convertir;










// import React, { useState } from 'react';
// import * as XLSX from 'xlsx';
// import { create } from 'xmlbuilder2';
// import '../css/convertir.css'; // Import the CSS file

// function Convertir() {
//   const [xmlContent, setXmlContent] = useState('');
//   const [fileName, setFileName] = useState('output.xml');

//   const handleFileUpload = (event) => {
//     const file = event.target.files[0];
//     if (file) {
//       const reader = new FileReader();
//       reader.onload = (e) => {
//         const data = new Uint8Array(e.target.result);
//         const workbook = XLSX.read(data, { type: 'array' });
//         const worksheet = workbook.Sheets[workbook.SheetNames[0]];
//         const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

//         const [titleRow, ...dataRows] = jsonData;

//         const xmlDoc = create({ version: '1.0', encoding: 'UTF-8', standalone: true });
//         const root = xmlDoc.ele('DeclarationsRS', { VersionSchema: '1.0' });

//         // Declarant section
//         const declarant = root.ele('Declarant');
//         declarant.ele('TypeIdentifiant').txt('1');
//         declarant.ele('Identifiant').txt('0002766B');
//         declarant.ele('CategorieContribuable').txt('PM');

//         // ReferenceDeclaration section
//         const referenceDeclaration = root.ele('ReferenceDeclaration');
//         referenceDeclaration.ele('ActeDepot').txt('0');
//         referenceDeclaration.ele('AnneeDepot').txt('2024');
//         referenceDeclaration.ele('MoisDepot').txt('10');

//         // AjouterCertificats section
//         const ajouterCertificats = root.ele('AjouterCertificats');

//         // Create one Certificat
//         const certificat = ajouterCertificats.ele('Certificat');
//         const beneficiaire = certificat.ele('Beneficiaire');
//         const idTaxpayer = beneficiaire.ele('IdTaxpayer');
//         const matriculeFiscal = idTaxpayer.ele('MatriculeFiscal');
//         matriculeFiscal.ele('TypeIdentifiant').txt('1');
//         matriculeFiscal.ele('Identifiant').txt('1216416ZAP');

//         // Add other Beneficiaire fields
//         beneficiaire.ele('Resident').txt('0');
//         beneficiaire.ele('NometprenonOuRaisonsociale').txt('NEFZI FETEN KINESYTHERAPEUTE');
//         beneficiaire.ele('Adresse').txt('Rue Mohamed Ali Abid - Borjlouzir');
//         beneficiaire.ele('Activite').txt('KINESYTHERAPEUTE');

//         const infosContact = beneficiaire.ele('InfosContact');
//         infosContact.ele('AdresseMail').txt('');
//         infosContact.ele('NumTel').txt('');

//         // Create ListeOperations under the same Certificat
//         const listeOperations = certificat.ele('ListeOperations');
//         let totalMontantHT = 0;
//         let totalMontantTTC = 0;

//         // Processing rows and adding operations
//         dataRows.forEach((row) => {
//           const idNature = row[titleRow.indexOf('ID_NATURE_FK')];
//           const anneeFacturation = row[titleRow.indexOf('ANNE_FACTURATION')];

//           if (!idNature || !anneeFacturation) {
//             return; // Skip this row if essential fields are missing
//           }

//           // Add an Operation to ListeOperations
//           const operation = listeOperations.ele('Operation', {
//             IdTypeOperation: idNature,
//           })
//           .ele('AnneeFacturation').txt(anneeFacturation) // Use the correct year
//           .ele('MontantHT').txt(row[titleRow.indexOf('MONTANT_HT')])
//           .ele('TauxRS').txt(row[titleRow.indexOf('TAUX_RS')])
//           .ele('MontantTTC').txt(row[titleRow.indexOf('MONTANT_TTC')]);

//           // Update totals
//           totalMontantHT += parseFloat(row[titleRow.indexOf('MONTANT_HT')] || 0);
//           totalMontantTTC += parseFloat(row[titleRow.indexOf('MONTANT_TTC')] || 0);
//         });

//         // Add the total under the Certificat
//         const total = certificat.ele('Total');
//         total.ele('TOTAL_MONTANT_HT').txt(totalMontantHT);
//         total.ele('TOTAL_MONTANT_TTC').txt(totalMontantTTC);

//         const xmlString = xmlDoc.end({ prettyPrint: true });
//         setXmlContent(xmlString);
//       };
//       reader.readAsArrayBuffer(file);
//     }
//   };

//   const downloadXML = () => {
//     const blob = new Blob([xmlContent], { type: 'application/xml' });
//     const link = document.createElement('a');
//     link.href = URL.createObjectURL(blob);
//     link.download = fileName;
//     link.click();
//   };

//   return (
//     <div className="converter-container">
//       <h1>Excel to XML Converter</h1>
//       {!xmlContent && (
//         <>
//           <label htmlFor="file-upload" className="custom-file-upload">
//             Choose File
//           </label>
//           <input
//             type="file"
//             id="file-upload"
//             accept=".xlsx, .xls"
//             onChange={handleFileUpload}
//             style={{ display: 'none' }}
//           />
//         </>
//       )}
//       {xmlContent && (
//         <>
//           <h2>Generated XML</h2>
//           <textarea rows="20" cols="80" value={xmlContent} readOnly />
//           <button onClick={downloadXML}>Download XML</button>
//           <div style={{ marginTop: '20px' }}>
//             <label htmlFor="file-upload" className="custom-file-upload">
//               Upload another file
//             </label>
//             <input
//               type="file"
//               id="file-upload"
//               accept=".xlsx, .xls"
//               onChange={handleFileUpload}
//               style={{ display: 'none' }}
//             />
//           </div>
//         </>
//       )}
//     </div>
//   );
// }

// export default Convertir;










// import React, { useState } from 'react';
// import * as XLSX from 'xlsx';
// import { create } from 'xmlbuilder2';
// import '../css/convertir.css'; // Import the CSS file

// function Convertir() {
//   const [xmlContent, setXmlContent] = useState('');
//   const [fileName, setFileName] = useState('output.xml');

//   const handleFileUpload = (event) => {
//     const file = event.target.files[0];
//     if (file) {
//       const reader = new FileReader();
//       reader.onload = (e) => {
//         const data = new Uint8Array(e.target.result);
//         const workbook = XLSX.read(data, { type: 'array' });
//         const worksheet = workbook.Sheets[workbook.SheetNames[0]];
//         const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

//         const [titleRow, ...dataRows] = jsonData;

//         const xmlDoc = create({ version: '1.0', encoding: 'UTF-8', standalone: true });
//         const root = xmlDoc.ele('DeclarationsRS', { VersionSchema: '1.0' });

//         // Declarant section
//         const declarant = root.ele('Declarant');
//         declarant.ele('TypeIdentifiant').txt('1');
//         declarant.ele('Identifiant').txt('0002766B');
//         declarant.ele('CategorieContribuable').txt('PM');

//         // ReferenceDeclaration section
//         const referenceDeclaration = root.ele('ReferenceDeclaration');
//         referenceDeclaration.ele('ActeDepot').txt('0');
//         referenceDeclaration.ele('AnneeDepot').txt('2024');
//         referenceDeclaration.ele('MoisDepot').txt('10');

//         // AjouterCertificats section
//         const ajouterCertificats = root.ele('AjouterCertificats');

//         // Create one Certificat
//         const certificat = ajouterCertificats.ele('Certificat');
//         const beneficiaire = certificat.ele('Beneficiaire');
//         const idTaxpayer = beneficiaire.ele('IdTaxpayer');
//         const matriculeFiscal = idTaxpayer.ele('MatriculeFiscal');
//         matriculeFiscal.ele('TypeIdentifiant').txt('1');
//         matriculeFiscal.ele('Identifiant').txt('1216416ZAP');

//         // Add other Beneficiaire fields
//         beneficiaire.ele('Resident').txt('0');
//         beneficiaire.ele('NometprenonOuRaisonsociale').txt('NEFZI FETEN KINESYTHERAPEUTE');
//         beneficiaire.ele('Adresse').txt('Rue Mohamed Ali Abid - Borjlouzir');
//         beneficiaire.ele('Activite').txt('KINESYTHERAPEUTE');

//         const infosContact = beneficiaire.ele('InfosContact');
//         infosContact.ele('AdresseMail').txt('');
//         infosContact.ele('NumTel').txt('');

//         // Create ListeOperations under the same Certificat
//         const listeOperations = certificat.ele('ListeOperations');
//         let totalMontant = 0;

//         // Processing rows and adding operations
//         dataRows.forEach((row) => {
//           const idNature = row[titleRow.indexOf('ID_NATURE_FK')];
//           if (!idNature || !row[titleRow.indexOf('ANNE_FACTURATION')]) {
//             return; // Skip this row if essential fields are missing
//           }

//           // Add an Operation to ListeOperations
//           const operation = listeOperations.ele('Operation', {
//             IdTypeOperation: idNature,
//           })
//           .ele('AnneeFacturation').txt(row[titleRow.indexOf('ANNE_FACTURATION')])
//           .ele('MontantHT').txt(row[titleRow.indexOf('MONTANT_HT')])
//           .ele('TauxRS').txt(row[titleRow.indexOf('TAUX_RS')])
//           .ele('MontantTTC').txt(row[titleRow.indexOf('MONTANT_TTC')]);

//           // Update total for the current Certificat
//           totalMontant += parseFloat(row[titleRow.indexOf('MONTANT_TTC')] || 0);
//         });

//         // Add the total under the Certificat
//         certificat.ele('Total').ele('MontantTotal').txt(totalMontant);

//         const xmlString = xmlDoc.end({ prettyPrint: true });
//         setXmlContent(xmlString);
//       };
//       reader.readAsArrayBuffer(file);
//     }
//   };

//   const downloadXML = () => {
//     const blob = new Blob([xmlContent], { type: 'application/xml' });
//     const link = document.createElement('a');
//     link.href = URL.createObjectURL(blob);
//     link.download = fileName;
//     link.click();
//   };

//   return (
//     <div className="converter-container">
//       <h1>Excel to XML Converter</h1>
//       {!xmlContent && (
//         <>
//           <label htmlFor="file-upload" className="custom-file-upload">
//             Choose File
//           </label>
//           <input
//             type="file"
//             id="file-upload"
//             accept=".xlsx, .xls"
//             onChange={handleFileUpload}
//             style={{ display: 'none' }}
//           />
//         </>
//       )}
//       {xmlContent && (
//         <>
//           <h2>Generated XML</h2>
//           <textarea rows="20" cols="80" value={xmlContent} readOnly />
//           <button onClick={downloadXML}>Download XML</button>
//           <div style={{ marginTop: '20px' }}>
//             <label htmlFor="file-upload" className="custom-file-upload">
//               Upload another file
//             </label>
//             <input
//               type="file"
//               id="file-upload"
//               accept=".xlsx, .xls"
//               onChange={handleFileUpload}
//               style={{ display: 'none' }}
//             />
//           </div>
//         </>
//       )}
//     </div>
//   );
// }

// export default Convertir;















// import React, { useState } from 'react';
// import * as XLSX from 'xlsx';
// import { create } from 'xmlbuilder2';
// import '../css/convertir.css'; // Import the CSS file

// function Convertir() {
//   const [xmlContent, setXmlContent] = useState('');
//   const [fileName, setFileName] = useState('output.xml');

//   const handleFileUpload = (event) => {
//     const file = event.target.files[0];
//     if (file) {
//       const reader = new FileReader();
//       reader.onload = (e) => {
//         const data = new Uint8Array(e.target.result);
//         const workbook = XLSX.read(data, { type: 'array' });
//         const worksheet = workbook.Sheets[workbook.SheetNames[0]];
//         const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

//         const [titleRow, ...dataRows] = jsonData;

//         const xmlDoc = create({ version: '1.0', encoding: 'UTF-8', standalone: true });
//         const root = xmlDoc.ele('DeclarationsRS', { VersionSchema: '1.0' });

//         // Declarant section
//         const declarant = root.ele('Declarant');
//         declarant.ele('TypeIdentifiant').txt('1');
//         declarant.ele('Identifiant').txt('0002766B');
//         declarant.ele('CategorieContribuable').txt('PM');

//         // ReferenceDeclaration section
//         const referenceDeclaration = root.ele('ReferenceDeclaration');
//         referenceDeclaration.ele('ActeDepot').txt('0');
//         referenceDeclaration.ele('AnneeDepot').txt('2024');
//         referenceDeclaration.ele('MoisDepot').txt('10');

//         // AjouterCertificats section
//         const ajouterCertificats = root.ele('AjouterCertificats');

//         // Processing rows
//         dataRows.forEach((row) => {
//           const certificat = ajouterCertificats.ele('Certificat');
//           const beneficiaire = certificat.ele('Beneficiaire');

//           // IdTaxpayer and MatriculeFiscal section
//           const idTaxpayer = beneficiaire.ele('IdTaxpayer');
//           const matriculeFiscal = idTaxpayer.ele('MatriculeFiscal');
//           const typeIdentifiant = row[titleRow.indexOf('TYPE_IDENTIFIANT')];

//           matriculeFiscal.ele('TypeIdentifiant').txt(typeIdentifiant);
//           matriculeFiscal.ele('Identifiant').txt(row[titleRow.indexOf('IDENTIFIANT')]);

//           // Add DATE_NAISSANCE conditionally
//           const dateNaissanceIndex = titleRow.indexOf('DATE_NAISSANCE');
//           const dateValue = row[dateNaissanceIndex];
//           if (typeIdentifiant !== '1' && dateValue) {
//             matriculeFiscal.ele('DATE_NAISSANCE').txt(dateValue);
//           }

//           matriculeFiscal.ele('CategorieContribuable').txt(row[titleRow.indexOf('CATEGORIE_CONTRIBUABLE')]);

//           beneficiaire.ele('Resident').txt(row[titleRow.indexOf('RESIDENT')]);
//           beneficiaire.ele('NometprenonOuRaisonsociale').txt(row[titleRow.indexOf('NOM_PRENOM')]);
//           beneficiaire.ele('Adresse').txt(row[titleRow.indexOf('ADRESSE')]);
//           beneficiaire.ele('Activite').txt(row[titleRow.indexOf('ACTIVITé')]);

//           // InfosContact section
//           const infosContact = beneficiaire.ele('InfosContact');
//           infosContact.ele('AdresseMail').txt(row[titleRow.indexOf('ADRESSE_MAIL')]);
//           infosContact.ele('NumTel').txt(row[titleRow.indexOf('NUM_TEL')]);

//           // Additional fields for Certificat
//           const listeOperations = certificat.ele('ListeOperations');
//           const operation = listeOperations.ele('Operation', {
//             IdTypeOperation: row[titleRow.indexOf('ID_NATURE_FK')],
//           });

//           operation.ele('AnneeFacturation').txt(row[titleRow.indexOf('ANNE_FACTURATION')]);
//           operation.ele('MontantHT').txt(row[titleRow.indexOf('MONTANT_HT')]);
//           operation.ele('TauxRS').txt(row[titleRow.indexOf('TAUX_RS')]);
//           operation.ele('MontantTTC').txt(row[titleRow.indexOf('MONTANT_TTC')]);

//           // Set file name dynamically
//           setFileName(`0002766B-${row[titleRow.indexOf('ANNE_FACTURATION')]}.xml`);
//         });

//         const xmlString = xmlDoc.end({ prettyPrint: true });
//         setXmlContent(xmlString);
//       };
//       reader.readAsArrayBuffer(file);
//     }
//   };

//   const downloadXML = () => {
//     const blob = new Blob([xmlContent], { type: 'application/xml' });
//     const link = document.createElement('a');
//     link.href = URL.createObjectURL(blob);
//     link.download = fileName;
//     link.click();
//   };

//   return (
//     <div className="converter-container">
//       <h1>Excel to XML Converter</h1>
//       {!xmlContent && (
//         <>
//           <label htmlFor="file-upload" className="custom-file-upload">
//             Choose File
//           </label>
//           <input
//             type="file"
//             id="file-upload"
//             accept=".xlsx, .xls"
//             onChange={handleFileUpload}
//             style={{ display: 'none' }}
//           />
//         </>
//       )}
//       {xmlContent && (
//         <>
//           <h2>Generated XML</h2>
//           <textarea rows="20" cols="80" value={xmlContent} readOnly />
//           <button onClick={downloadXML}>Download XML</button>
//           <div style={{ marginTop: '20px' }}>
//             <label htmlFor="file-upload" className="custom-file-upload">
//               Upload another file
//             </label>
//             <input
//               type="file"
//               id="file-upload"
//               accept=".xlsx, .xls"
//               onChange={handleFileUpload}
//               style={{ display: 'none' }}
//             />
//           </div>
//         </>
//       )}
//     </div>
//   );
// }

// export default Convertir;