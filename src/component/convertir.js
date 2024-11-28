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

        let currentCertificat = null; // To hold the current Certificat

        // Store operation rows by their Identifiant value
        const operations = [];
        const totals = [];

        // Classify rows into operations (Identifiant = 1) and totals (Identifiant = 6)
        dataRows.forEach((currentRow) => {
          const typeIdentifiant = currentRow[titleRow.indexOf('TYPE_IDENTIFIANT')];
          
          // If it's an operation (Identifiant = 1), store it in operations array
          if (typeIdentifiant === '1') {
            operations.push(currentRow);
          }
          
          // If it's a total (Identifiant = 6), store it in totals array
          if (typeIdentifiant === '6') {
            totals.push(currentRow);
          }
        });

        // Create one Certificat per operation
        operations.forEach((operationRow) => {
          const certificat = ajouterCertificats.ele('Certificat');
          const beneficiaire = certificat.ele('Beneficiaire');

          // IdTaxpayer and MatriculeFiscal section
          const idTaxpayer = beneficiaire.ele('IdTaxpayer');
          const matriculeFiscal = idTaxpayer.ele('MatriculeFiscal');
          const typeIdentifiant = operationRow[titleRow.indexOf('TYPE_IDENTIFIANT')];
          matriculeFiscal.ele('TypeIdentifiant').txt(typeIdentifiant);
          matriculeFiscal.ele('Identifiant').txt(operationRow[titleRow.indexOf('IDENTIFIANT')]);

          // Add DATE_NAISSANCE only if valid
          const dateNaissanceIndex = titleRow.indexOf('DATE_NAISSANCE');
          const dateValue = operationRow[dateNaissanceIndex];
          if (dateValue && typeof dateValue === 'number') {
            const parsedDate = XLSX.SSF.parse_date_code(dateValue);
            const formattedDate = `${String(parsedDate.d).padStart(2, '0')}/${String(parsedDate.m).padStart(2, '0')}/${parsedDate.y}`;
            matriculeFiscal.ele('DATE_NAISSANCE').txt(formattedDate);
          } else if (dateValue && dateValue.trim() !== '') {
            matriculeFiscal.ele('DATE_NAISSANCE').txt(dateValue);
          }

          matriculeFiscal.ele('CategorieContribuable').txt(operationRow[titleRow.indexOf('CATEGORIE_CONTRIBUABLE')]);
          beneficiaire.ele('Resident').txt(operationRow[titleRow.indexOf('RESIDENT')]);
          beneficiaire.ele('NometprenonOuRaisonsociale').txt(operationRow[titleRow.indexOf('NOM_PRENOM')]);
          beneficiaire.ele('Adresse').txt(operationRow[titleRow.indexOf('ADRESSE')]);
          beneficiaire.ele('Activite').txt(operationRow[titleRow.indexOf('ACTIVITé')]);

          const infosContact = beneficiaire.ele('InfosContact');
          infosContact.ele('AdresseMail').txt(operationRow[titleRow.indexOf('ADRESSE_MAIL')]);
          infosContact.ele('NumTel').txt(operationRow[titleRow.indexOf('NUM_TEL')]);

          // Operation details
          const listeOperations = certificat.ele('ListeOperations');
          const operationIdType = operationRow[titleRow.indexOf('ID_NATURE_FK')];
          const operation = listeOperations.ele('Operation', { IdTypeOperation: operationIdType });
          const anneeFacturationIndex = titleRow.indexOf('ANNE_FACTURATION');
          const anneeFacturationValue = operationRow[anneeFacturationIndex];
          if (anneeFacturationValue && typeof anneeFacturationValue === 'number') {
            const parsedAnneeFacturation = XLSX.SSF.parse_date_code(anneeFacturationValue);
            const year = parsedAnneeFacturation.y;
            const month = String(parsedAnneeFacturation.m).padStart(2, '0');
            operation.ele('AnneeFacturation').txt(`${year}-${month}`);
          } else {
            operation.ele('AnneeFacturation').txt(anneeFacturationValue);
          }
          operation.ele('CNPC').txt('0');
          operation.ele('P_Charge').txt('0');
          operation.ele('MontantHT').txt(operationRow[titleRow.indexOf('MONTANT_HT')]);

          // Find the matching total for this operation
          const matchingTotal = totals.find((totalRow) => {
            return totalRow[titleRow.indexOf('IDENTIFIANT')] === operationRow[titleRow.indexOf('IDENTIFIANT')];
          });

          if (matchingTotal) {
            // Create a new operation element for the total within the same Certificat
            const totalOperation = listeOperations.ele('Operation', { IdTypeOperation: matchingTotal[titleRow.indexOf('ID_NATURE_FK')] });
            totalOperation.ele('AnneeFacturation').txt(matchingTotal[titleRow.indexOf('ANNE_FACTURATION')]);
            totalOperation.ele('CNPC').txt('0');
            totalOperation.ele('P_Charge').txt('0');
            totalOperation.ele('MontantHT').txt(matchingTotal[titleRow.indexOf('MONTANT_HT')]);
            totalOperation.ele('TotalMontantHT').txt(matchingTotal[titleRow.indexOf('TOTAL_MONTANT_HT')]);
            totalOperation.ele('TotalMontantTVA').txt(matchingTotal[titleRow.indexOf('TOTAL_MONTANT_TVA')]);
            totalOperation.ele('TotalMontantTTC').txt(matchingTotal[titleRow.indexOf('TOTAL_MONTANT_TTC')]);
            totalOperation.ele('TotalMontantRS').txt(matchingTotal[titleRow.indexOf('TOTAL_MONTANT_RS')]);
            totalOperation.ele('TotalMontantNetServi').txt(matchingTotal[titleRow.indexOf('TOTAL_MONTANT_NET_SERVI')]);
          }
        });

        const xmlString = xmlDoc.end({ prettyPrint: true });
        setXmlContent(xmlString);

        // Dynamically set file name using a unique identifier
        const timestamp = new Date().toISOString().replace(/[:-]/g, '').split('.')[0];
        setFileName(`DeclarationsRS_${timestamp}.xml`);
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
          <textarea
            readOnly
            rows={20}
            cols={80}
            value={xmlContent}
            style={{ width: '100%', height: '300px' }}
          />
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button onClick={downloadXML}>Download XML</button>
            <button onClick={() => setXmlContent('')}>Clear</button>
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

//         let currentCertificat = null; // To hold the current Certificat

//         // Store operation rows by their Identifiant value
//         const operations = [];
//         const totals = [];

//         // Classify rows into operations (Identifiant = 1) and totals (Identifiant = 6)
//         dataRows.forEach((currentRow) => {
//           const typeIdentifiant = currentRow[titleRow.indexOf('TYPE_IDENTIFIANT')];
          
//           // If it's an operation (Identifiant = 1), store it in operations array
//           if (typeIdentifiant === '1') {
//             operations.push(currentRow);
//           }
          
//           // If it's a total (Identifiant = 6), store it in totals array
//           if (typeIdentifiant === '6') {
//             totals.push(currentRow);
//           }
//         });

//         // Merge operations and totals within the same Certificat
//         operations.forEach((operationRow) => {
//           const certificat = ajouterCertificats.ele('Certificat');
//           const beneficiaire = certificat.ele('Beneficiaire');

//           // IdTaxpayer and MatriculeFiscal section
//           const idTaxpayer = beneficiaire.ele('IdTaxpayer');
//           const matriculeFiscal = idTaxpayer.ele('MatriculeFiscal');
//           const typeIdentifiant = operationRow[titleRow.indexOf('TYPE_IDENTIFIANT')];
//           matriculeFiscal.ele('TypeIdentifiant').txt(typeIdentifiant);
//           matriculeFiscal.ele('Identifiant').txt(operationRow[titleRow.indexOf('IDENTIFIANT')]);

//           // Add DATE_NAISSANCE only if valid
//           const dateNaissanceIndex = titleRow.indexOf('DATE_NAISSANCE');
//           const dateValue = operationRow[dateNaissanceIndex];
//           if (dateValue && typeof dateValue === 'number') {
//             const parsedDate = XLSX.SSF.parse_date_code(dateValue);
//             const formattedDate = `${String(parsedDate.d).padStart(2, '0')}/${String(parsedDate.m).padStart(2, '0')}/${parsedDate.y}`;
//             matriculeFiscal.ele('DATE_NAISSANCE').txt(formattedDate);
//           } else if (dateValue && dateValue.trim() !== '') {
//             matriculeFiscal.ele('DATE_NAISSANCE').txt(dateValue);
//           }

//           matriculeFiscal.ele('CategorieContribuable').txt(operationRow[titleRow.indexOf('CATEGORIE_CONTRIBUABLE')]);
//           beneficiaire.ele('Resident').txt(operationRow[titleRow.indexOf('RESIDENT')]);
//           beneficiaire.ele('NometprenonOuRaisonsociale').txt(operationRow[titleRow.indexOf('NOM_PRENOM')]);
//           beneficiaire.ele('Adresse').txt(operationRow[titleRow.indexOf('ADRESSE')]);
//           beneficiaire.ele('Activite').txt(operationRow[titleRow.indexOf('ACTIVITé')]);

//           const infosContact = beneficiaire.ele('InfosContact');
//           infosContact.ele('AdresseMail').txt(operationRow[titleRow.indexOf('ADRESSE_MAIL')]);
//           infosContact.ele('NumTel').txt(operationRow[titleRow.indexOf('NUM_TEL')]);

//           // Operation details
//           const listeOperations = certificat.ele('ListeOperations');
//           const operationIdType = operationRow[titleRow.indexOf('ID_NATURE_FK')];
//           const operation = listeOperations.ele('Operation', { IdTypeOperation: operationIdType });
//           const anneeFacturationIndex = titleRow.indexOf('ANNE_FACTURATION');
//           const anneeFacturationValue = operationRow[anneeFacturationIndex];
//           if (anneeFacturationValue && typeof anneeFacturationValue === 'number') {
//             const parsedAnneeFacturation = XLSX.SSF.parse_date_code(anneeFacturationValue);
//             const year = parsedAnneeFacturation.y;
//             const month = String(parsedAnneeFacturation.m).padStart(2, '0');
//             operation.ele('AnneeFacturation').txt(`${year}-${month}`);
//           } else {
//             operation.ele('AnneeFacturation').txt(anneeFacturationValue);
//           }
//           operation.ele('CNPC').txt('0');
//           operation.ele('P_Charge').txt('0');
//           operation.ele('MontantHT').txt(operationRow[titleRow.indexOf('MONTANT_HT')]);

//           // Find the matching total for this operation
//           const matchingTotal = totals.find((totalRow) => {
//             return totalRow[titleRow.indexOf('IDENTIFIANT')] === operationRow[titleRow.indexOf('IDENTIFIANT')];
//           });

//           if (matchingTotal) {
//             operation.ele('TotalMontantHT').txt(matchingTotal[titleRow.indexOf('TOTAL_MONTANT_HT')]);
//             operation.ele('TotalMontantTVA').txt(matchingTotal[titleRow.indexOf('TOTAL_MONTANT_TVA')]);
//             operation.ele('TotalMontantTTC').txt(matchingTotal[titleRow.indexOf('TOTAL_MONTANT_TTC')]);
//             operation.ele('TotalMontantRS').txt(matchingTotal[titleRow.indexOf('TOTAL_MONTANT_RS')]);
//             operation.ele('TotalMontantNetServi').txt(matchingTotal[titleRow.indexOf('TOTAL_MONTANT_NET_SERVI')]);
//           }
//         });

//         const xmlString = xmlDoc.end({ prettyPrint: true });
//         setXmlContent(xmlString);

//         // Dynamically set file name using a unique identifier
//         const timestamp = new Date().toISOString().replace(/[:-]/g, '').split('.')[0];
//         setFileName(`DeclarationsRS_${timestamp}.xml`);
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
//           <div style={{ display: 'flex', justifyContent: 'center' }}>
//             <button onClick={() => setXmlContent('')}>Clear</button>
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

//         // Generate Certificat elements for each row
//         dataRows.forEach((currentRow, index) => {
//           // Skip rows without valid data
//           if (currentRow.every((cell) => !cell)) return;

//           const certificat = ajouterCertificats.ele('Certificat');
//           const beneficiaire = certificat.ele('Beneficiaire');

//           // IdTaxpayer and MatriculeFiscal section
//           const idTaxpayer = beneficiaire.ele('IdTaxpayer');
//           const matriculeFiscal = idTaxpayer.ele('MatriculeFiscal');
//           const typeIdentifiant = currentRow[titleRow.indexOf('TYPE_IDENTIFIANT')];
//           matriculeFiscal.ele('TypeIdentifiant').txt(typeIdentifiant);
//           matriculeFiscal.ele('Identifiant').txt(currentRow[titleRow.indexOf('IDENTIFIANT')]);


//           // Add DATE_NAISSANCE only if valid
//           const dateNaissanceIndex = titleRow.indexOf('DATE_NAISSANCE');
//           const dateValue = currentRow[dateNaissanceIndex];
//           if (dateValue && typeof dateValue === 'number') {
//             const parsedDate = XLSX.SSF.parse_date_code(dateValue);
//             const formattedDate = `${String(parsedDate.d).padStart(2, '0')}/${String(parsedDate.m).padStart(2, '0')}/${parsedDate.y}`;
//             matriculeFiscal.ele('DATE_NAISSANCE').txt(formattedDate);
//           } else if (dateValue && dateValue.trim() !== '') {
//             matriculeFiscal.ele('DATE_NAISSANCE').txt(dateValue);
//           }

//           matriculeFiscal.ele('CategorieContribuable').txt(currentRow[titleRow.indexOf('CATEGORIE_CONTRIBUABLE')]);
//           beneficiaire.ele('Resident').txt(currentRow[titleRow.indexOf('RESIDENT')]);
//           beneficiaire.ele('NometprenonOuRaisonsociale').txt(currentRow[titleRow.indexOf('NOM_PRENOM')]);
//           beneficiaire.ele('Adresse').txt(currentRow[titleRow.indexOf('ADRESSE')]);
//           beneficiaire.ele('Activite').txt(currentRow[titleRow.indexOf('ACTIVITé')]);


//           const infosContact = beneficiaire.ele('InfosContact');
//           infosContact.ele('AdresseMail').txt(currentRow[titleRow.indexOf('ADRESSE_MAIL')]);
//           infosContact.ele('NumTel').txt(currentRow[titleRow.indexOf('NUM_TEL')]);


//           // Additional fields for Certificat
//           const datePayementIndex = titleRow.indexOf('DATE_PAIEMNT');
//           const datePayementValue = currentRow[datePayementIndex];
//           if (datePayementValue && typeof datePayementValue === 'number') {
//             const parsedDatePayement = XLSX.SSF.parse_date_code(datePayementValue);
//             const formattedDatePayement = `${String(parsedDatePayement.d).padStart(2, '0')}/${String(parsedDatePayement.m).padStart(2, '0')}/${parsedDatePayement.y}`;
//             certificat.ele('DatePayement').txt(formattedDatePayement);
//           } else {
//             certificat.ele('DatePayement').txt(datePayementValue);
//           }
//           certificat.ele('Ref_certif_chez_declarant').txt(currentRow[titleRow.indexOf('REF_CERTF_CHEZ_DECLARANT')]);


//           // ListeOperations section with dynamic IdTypeOperation attribute
//           const listeOperations = certificat.ele('ListeOperations');
//           const operationIdType = currentRow[titleRow.indexOf('ID_NATURE_FK')];
//           const operation = listeOperations.ele('Operation', { IdTypeOperation: operationIdType });
//           const anneeFacturationIndex = titleRow.indexOf('ANNE_FACTURATION');
//           const anneeFacturationValue = currentRow[anneeFacturationIndex];
//           if (anneeFacturationValue && typeof anneeFacturationValue === 'number') {
//             const parsedAnneeFacturation = XLSX.SSF.parse_date_code(anneeFacturationValue);
//             const year = parsedAnneeFacturation.y;
//             const month = String(parsedAnneeFacturation.m).padStart(2, '0');
//             operation.ele('AnneeFacturation').txt(`${year}-${month}`);
//           } else {
//             operation.ele('AnneeFacturation').txt(anneeFacturationValue);
//           }
//           operation.ele('CNPC').txt('0');
//           operation.ele('P_Charge').txt('0');
//           operation.ele('MontantHT').txt(currentRow[titleRow.indexOf('MONTANT_HT')]);


//           // Check for TYPE_IDENTIFIANT = 6 to add specific fields
//           if (typeIdentifiant === '6') {
//             operation.ele('TotalMontantHT').txt(currentRow[titleRow.indexOf('TOTAL_MONTANT_HT')]);
//             operation.ele('TotalMontantTVA').txt(currentRow[titleRow.indexOf('TOTAL_MONTANT_TVA')]);
//             operation.ele('TotalMontantTTC').txt(currentRow[titleRow.indexOf('TOTAL_MONTANT_TTC')]);
//             operation.ele('TotalMontantRS').txt(currentRow[titleRow.indexOf('TOTAL_MONTANT_RS')]);
//             operation.ele('TotalMontantNetServi').txt(currentRow[titleRow.indexOf('TOTAL_MONTANT_NET_SERVI')]);
//           }
//         });

//         const xmlString = xmlDoc.end({ prettyPrint: true });
//         setXmlContent(xmlString);

//         // Dynamically set file name using a unique identifier
//         const timestamp = new Date().toISOString().replace(/[:-]/g, '').split('.')[0];
//         setFileName(`DeclarationsRS_${timestamp}.xml`);
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

//         // Generate Certificat elements for each row
//         dataRows.forEach((currentRow, index) => {
//           // Skip rows without valid data
//           if (currentRow.every((cell) => !cell)) return;

//           const certificat = ajouterCertificats.ele('Certificat');
//           const beneficiaire = certificat.ele('Beneficiaire');

//           // IdTaxpayer and MatriculeFiscal section
//           const idTaxpayer = beneficiaire.ele('IdTaxpayer');
//           const matriculeFiscal = idTaxpayer.ele('MatriculeFiscal');
//           const typeIdentifiant = currentRow[titleRow.indexOf('TYPE_IDENTIFIANT')];
//           matriculeFiscal.ele('TypeIdentifiant').txt(typeIdentifiant);
//           matriculeFiscal.ele('Identifiant').txt(currentRow[titleRow.indexOf('IDENTIFIANT')]);

//           // Add DATE_NAISSANCE only if valid
//           const dateNaissanceIndex = titleRow.indexOf('DATE_NAISSANCE');
//           const dateValue = currentRow[dateNaissanceIndex];
//           if (dateValue && typeof dateValue === 'number') {
//             const parsedDate = XLSX.SSF.parse_date_code(dateValue);
//             const formattedDate = `${String(parsedDate.d).padStart(2, '0')}/${String(parsedDate.m).padStart(2, '0')}/${parsedDate.y}`;
//             matriculeFiscal.ele('DATE_NAISSANCE').txt(formattedDate);
//           } else if (dateValue && dateValue.trim() !== '') {
//             matriculeFiscal.ele('DATE_NAISSANCE').txt(dateValue);
//           }

//           matriculeFiscal.ele('CategorieContribuable').txt(currentRow[titleRow.indexOf('CATEGORIE_CONTRIBUABLE')]);
//           beneficiaire.ele('Resident').txt(currentRow[titleRow.indexOf('RESIDENT')]);
//           beneficiaire.ele('NometprenonOuRaisonsociale').txt(currentRow[titleRow.indexOf('NOM_PRENOM')]);
//           beneficiaire.ele('Adresse').txt(currentRow[titleRow.indexOf('ADRESSE')]);
//           beneficiaire.ele('Activite').txt(currentRow[titleRow.indexOf('ACTIVITé')]);

//           const infosContact = beneficiaire.ele('InfosContact');
//           infosContact.ele('AdresseMail').txt(currentRow[titleRow.indexOf('ADRESSE_MAIL')]);
//           infosContact.ele('NumTel').txt(currentRow[titleRow.indexOf('NUM_TEL')]);

//           // Additional fields for Certificat
//           const datePayementIndex = titleRow.indexOf('DATE_PAIEMNT');
//           const datePayementValue = currentRow[datePayementIndex];
//           if (datePayementValue && typeof datePayementValue === 'number') {
//             const parsedDatePayement = XLSX.SSF.parse_date_code(datePayementValue);
//             const formattedDatePayement = `${String(parsedDatePayement.d).padStart(2, '0')}/${String(parsedDatePayement.m).padStart(2, '0')}/${parsedDatePayement.y}`;
//             certificat.ele('DatePayement').txt(formattedDatePayement);
//           } else {
//             certificat.ele('DatePayement').txt(datePayementValue);
//           }
//           certificat.ele('Ref_certif_chez_declarant').txt(currentRow[titleRow.indexOf('REF_CERTF_CHEZ_DECLARANT')]);

//           // ListeOperations section with dynamic IdTypeOperation attribute
//           const listeOperations = certificat.ele('ListeOperations');
//           const operationIdType = currentRow[titleRow.indexOf('ID_NATURE_FK')];
//           const operation = listeOperations.ele('Operation', { IdTypeOperation: operationIdType });
//           const anneeFacturationIndex = titleRow.indexOf('ANNE_FACTURATION');
//           const anneeFacturationValue = currentRow[anneeFacturationIndex];
//           if (anneeFacturationValue && typeof anneeFacturationValue === 'number') {
//             const parsedAnneeFacturation = XLSX.SSF.parse_date_code(anneeFacturationValue);
//             const year = parsedAnneeFacturation.y;
//             const month = String(parsedAnneeFacturation.m).padStart(2, '0');
//             operation.ele('AnneeFacturation').txt(`${year}-${month}`);
//           } else {
//             operation.ele('AnneeFacturation').txt(anneeFacturationValue);
//           }
//           operation.ele('CNPC').txt('0');
//           operation.ele('P_Charge').txt('0');
//           operation.ele('MontantHT').txt(currentRow[titleRow.indexOf('MONTANT_HT')]);
//         });

//         const xmlString = xmlDoc.end({ prettyPrint: true });
//         setXmlContent(xmlString);

//         // Dynamically set file name using a unique identifier
//         const timestamp = new Date().toISOString().replace(/[:-]/g, '').split('.')[0];
//         setFileName(`DeclarationsRS_${timestamp}.xml`);
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

//         let previousRow = null; // Variable to store the previous row for comparison

//         // Generate Certificat elements for each row
//         dataRows.forEach((currentRow, i) => {
//           // Skip the title row
//           if (i === 0) {
//             previousRow = currentRow; // Set the first data row as the initial "previousRow"
//             return;
//           }

//           // Compare the current row with the previous row
//           const isDifferent = currentRow.some((cell, index) => cell !== previousRow[index]);

//           if (isDifferent) {
//             console.log(`Row ${i + 1} is different from the previous row.`);
//           } else {
//             console.log(`Row ${i + 1} is the same as the previous row.`);
//           }

//           const certificat = ajouterCertificats.ele('Certificat');
//           const beneficiaire = certificat.ele('Beneficiaire');

//           // IdTaxpayer and MatriculeFiscal section
//           const idTaxpayer = beneficiaire.ele('IdTaxpayer');
//           const matriculeFiscal = idTaxpayer.ele('MatriculeFiscal');
//           const typeIdentifiant = currentRow[titleRow.indexOf('TYPE_IDENTIFIANT')];
//           matriculeFiscal.ele('TypeIdentifiant').txt(typeIdentifiant);
//           matriculeFiscal.ele('Identifiant').txt(currentRow[titleRow.indexOf('IDENTIFIANT')]);

//           // Add DATE_NAISSANCE only if it's a valid date
//           const dateNaissanceIndex = titleRow.indexOf('DATE_NAISSANCE');
//           const dateValue = currentRow[dateNaissanceIndex];
//           if (typeof dateValue === 'number') {
//             const parsedDate = XLSX.SSF.parse_date_code(dateValue);
//             const formattedDate = `${String(parsedDate.d).padStart(2, '0')}/${String(parsedDate.m).padStart(2, '0')}/${parsedDate.y}`;
//             matriculeFiscal.ele('DATE_NAISSANCE').txt(formattedDate);
//           } else if (dateValue && dateValue.trim() !== '') {
//             matriculeFiscal.ele('DATE_NAISSANCE').txt(dateValue);
//           }

//           matriculeFiscal.ele('CategorieContribuable').txt(currentRow[titleRow.indexOf('CATEGORIE_CONTRIBUABLE')]);
//           beneficiaire.ele('Resident').txt(currentRow[titleRow.indexOf('RESIDENT')]);
//           beneficiaire.ele('NometprenonOuRaisonsociale').txt(currentRow[titleRow.indexOf('NOM_PRENOM')]);
//           beneficiaire.ele('Adresse').txt(currentRow[titleRow.indexOf('ADRESSE')]);
//           beneficiaire.ele('Activite').txt(currentRow[titleRow.indexOf('ACTIVITé')]);

//           const infosContact = beneficiaire.ele('InfosContact');
//           infosContact.ele('AdresseMail').txt(currentRow[titleRow.indexOf('ADRESSE_MAIL')]);
//           infosContact.ele('NumTel').txt(currentRow[titleRow.indexOf('NUM_TEL')]);

//           // Additional fields for Certificat
//           const datePayementIndex = titleRow.indexOf('DATE_PAIEMNT');
//           const datePayementValue = currentRow[datePayementIndex];
//           if (typeof datePayementValue === 'number') {
//             const parsedDatePayement = XLSX.SSF.parse_date_code(datePayementValue);
//             const formattedDatePayement = `${String(parsedDatePayement.d).padStart(2, '0')}/${String(parsedDatePayement.m).padStart(2, '0')}/${parsedDatePayement.y}`;
//             certificat.ele('DatePayement').txt(formattedDatePayement);
//           } else {
//             certificat.ele('DatePayement').txt(datePayementValue);
//           }
//           certificat.ele('Ref_certif_chez_declarant').txt(currentRow[titleRow.indexOf('REF_CERTF_CHEZ_DECLARANT')]);

//           // ListeOperations section with dynamic IdTypeOperation attribute
//           const listeOperations = certificat.ele('ListeOperations');
//           const operationIdType = currentRow[titleRow.indexOf('ID_NATURE_FK')];
//           const operation = listeOperations.ele('Operation', { IdTypeOperation: operationIdType });
//           const anneeFacturationIndex = titleRow.indexOf('ANNE_FACTURATION');
//           const anneeFacturationValue = currentRow[anneeFacturationIndex];
//           if (typeof anneeFacturationValue === 'number') {
//             const parsedAnneeFacturation = XLSX.SSF.parse_date_code(anneeFacturationValue);
//             const year = parsedAnneeFacturation.y;
//             const month = String(parsedAnneeFacturation.m).padStart(2, '0');
//             operation.ele('AnneeFacturation').txt(`${year}-${month}`);
//             setFileName(`0002766B-${year}-${month}.xml`);
//           } else {
//             operation.ele('AnneeFacturation').txt(anneeFacturationValue);
//           }
//           operation.ele('CNPC').txt('0');
//           operation.ele('P_Charge').txt('0');
//           operation.ele('MontantHT').txt(currentRow[titleRow.indexOf('MONTANT_HT')]);

//           // Update the previous row reference
//           previousRow = currentRow;
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











//  import React, { useState } from 'react';
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

//         // Generate Certificat elements for each row
//         dataRows.forEach((row) => {
//           const certificat = ajouterCertificats.ele('Certificat');
//           const beneficiaire = certificat.ele('Beneficiaire');

//           // IdTaxpayer and MatriculeFiscal section with condition for DATE_NAISSANCE
//           const idTaxpayer = beneficiaire.ele('IdTaxpayer');
//           const matriculeFiscal = idTaxpayer.ele('MatriculeFiscal');
//           const typeIdentifiant = row[titleRow.indexOf('TYPE_IDENTIFIANT')];
//           matriculeFiscal.ele('TypeIdentifiant').txt(typeIdentifiant);
//           matriculeFiscal.ele('Identifiant').txt(row[titleRow.indexOf('IDENTIFIANT')]);

//           // Add DATE_NAISSANCE only if it's a valid date
//           const dateNaissanceIndex = titleRow.indexOf('DATE_NAISSANCE');
//           const dateValue = row[dateNaissanceIndex];
//           if (typeof dateValue === 'number') {
//             const parsedDate = XLSX.SSF.parse_date_code(dateValue);
//             const formattedDate = `${String(parsedDate.d).padStart(2, '0')}/${String(parsedDate.m).padStart(2, '0')}/${parsedDate.y}`;
//             matriculeFiscal.ele('DATE_NAISSANCE').txt(formattedDate);
//           } else if (dateValue && dateValue.trim() !== '') {
//             matriculeFiscal.ele('DATE_NAISSANCE').txt(dateValue);
//           }

//           matriculeFiscal.ele('CategorieContribuable').txt(row[titleRow.indexOf('CATEGORIE_CONTRIBUABLE')]);
//           beneficiaire.ele('Resident').txt(row[titleRow.indexOf('RESIDENT')]);
//           beneficiaire.ele('NometprenonOuRaisonsociale').txt(row[titleRow.indexOf('NOM_PRENOM')]);
//           beneficiaire.ele('Adresse').txt(row[titleRow.indexOf('ADRESSE')]);
//           beneficiaire.ele('Activite').txt(row[titleRow.indexOf('ACTIVITé')]);

//           const infosContact = beneficiaire.ele('InfosContact');
//           infosContact.ele('AdresseMail').txt(row[titleRow.indexOf('ADRESSE_MAIL')]);
//           infosContact.ele('NumTel').txt(row[titleRow.indexOf('NUM_TEL')]);

//           // Additional fields for Certificat
//           const datePayementIndex = titleRow.indexOf('DATE_PAIEMNT');
//           const datePayementValue = row[datePayementIndex];
//           if (typeof datePayementValue === 'number') {
//             const parsedDatePayement = XLSX.SSF.parse_date_code(datePayementValue);
//             const formattedDatePayement = `${String(parsedDatePayement.d).padStart(2, '0')}/${String(parsedDatePayement.m).padStart(2, '0')}/${parsedDatePayement.y}`;
//             certificat.ele('DatePayement').txt(formattedDatePayement);
//           } else {
//             certificat.ele('DatePayement').txt(datePayementValue);
//           }
//           certificat.ele('Ref_certif_chez_declarant').txt(row[titleRow.indexOf('REF_CERTF_CHEZ_DECLARANT')]);

//           // ListeOperations section with dynamic IdTypeOperation attribute
//           const listeOperations = certificat.ele('ListeOperations');
//           const operationIdType = row[titleRow.indexOf('ID_NATURE_FK')];
//           const operation = listeOperations.ele('Operation', { IdTypeOperation: operationIdType });
//           const anneeFacturationIndex = titleRow.indexOf('ANNE_FACTURATION');
//           const anneeFacturationValue = row[anneeFacturationIndex];
//           if (typeof anneeFacturationValue === 'number') {
//             const parsedAnneeFacturation = XLSX.SSF.parse_date_code(anneeFacturationValue);
//             const year = parsedAnneeFacturation.y;
//             const month = String(parsedAnneeFacturation.m).padStart(2, '0');
//             operation.ele('AnneeFacturation').txt(`${year}-${month}`);
//             setFileName(`0002766B-${year}-${month}.xml`);
//           } else {
//             operation.ele('AnneeFacturation').txt(anneeFacturationValue);
//           }
//           operation.ele('CNPC').txt('0');
//           operation.ele('P_Charge').txt('0');
//           operation.ele('MontantHT').txt(row[titleRow.indexOf('MONTANT_HT')]);
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