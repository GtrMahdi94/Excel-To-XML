import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { create } from 'xmlbuilder2';
import './App.css';

function App() {
  const [xmlContent, setXmlContent] = useState('');

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

        const xmlDoc = create({ version: '1.0', encoding: 'UTF-8' });
        const root = xmlDoc.ele('DeclarationsRS', { VersionSchema: '1.0' });

        // Fixed Declarant section
        const declarant = root.ele('Declarant');
        declarant.ele('TypeIdentifiant').txt('1');
        declarant.ele('Identifiant').txt('0002766B');
        declarant.ele('CategorieContribuable').txt('PM');

        // Fixed ReferenceDeclaration section
        const referenceDeclaration = root.ele('ReferenceDeclaration');
        referenceDeclaration.ele('ActeDepot').txt('0');
        referenceDeclaration.ele('AnneeDepot').txt('2024');
        referenceDeclaration.ele('MoisDepot').txt('10');

        // AjouterCertificats section
        const ajouterCertificats = root.ele('AjouterCertificats');

        // Generate Certificat elements for each row
        dataRows.forEach(row => {
          const certificat = ajouterCertificats.ele('Certificat');
          const beneficiaire = certificat.ele('Beneficiaire');

          // IdTaxpayer and MatriculeFiscal section with condition for DATE_NAISSANCE
          const idTaxpayer = beneficiaire.ele('IdTaxpayer');
          const matriculeFiscal = idTaxpayer.ele('MatriculeFiscal');
          const typeIdentifiant = row[titleRow.indexOf('TYPE_IDENTIFIANT')];
          
          matriculeFiscal.ele('TypeIdentifiant').txt(typeIdentifiant);
          matriculeFiscal.ele('Identifiant').txt(row[titleRow.indexOf('IDENTIFIANT')]);
          matriculeFiscal.ele('CategorieContribuable').txt(row[titleRow.indexOf('CATEGORIE_CONTRIBUABLE')]);

          // Add DATE_NAISSANCE only if TypeIdentifiant is not 1
          if (typeIdentifiant !== '1') {
            let dateNaissance = row[titleRow.indexOf('DATE_NAISSANCE')]; // Get value from Excel
          
            // Convert dateNaissance to string (if it's not already) and check if it's valid
            if (dateNaissance && String(dateNaissance).trim() !== '') {
              matriculeFiscal.ele('DATE_NAISSANCE').txt(dateNaissance); // Use the value from Excel
            }
          }

          beneficiaire.ele('Resident').txt(row[titleRow.indexOf('Resident')]);
          beneficiaire.ele('NometprenonOuRaisonsociale').txt(row[titleRow.indexOf('NOM_PRENOM')]);
          beneficiaire.ele('Adresse').txt(row[titleRow.indexOf('ADRESSE')]);
          beneficiaire.ele('Activite').txt(row[titleRow.indexOf('ACTIVITé')]);

          // InfosContact section
          const infosContact = beneficiaire.ele('InfosContact');
          infosContact.ele('AdresseMail').txt(row[titleRow.indexOf('ADRESSE_MAIL')]);
          infosContact.ele('NumTel').txt(row[titleRow.indexOf('NUM_TEL')]);

          // Additional fields for Certificat
          certificat.ele('DatePayement').txt(row[titleRow.indexOf('DATE_PAIEMNT')]);
          certificat.ele('Ref_certif_chez_declarant').txt(row[titleRow.indexOf('REF_CERTF_CHEZ_DECLARANT')]);

          // ListeOperations section with dynamic IdTypeOperation attribute
          const listeOperations = certificat.ele('ListeOperations');
          const operationIdType = row[titleRow.indexOf('ID_NATURE_FK')];
          const operation = listeOperations.ele('Operation', { IdTypeOperation: operationIdType });
          operation.ele('AnneeFacturation').txt(row[titleRow.indexOf('ANNE_FACTURATION')]);
          operation.ele('CNPC').txt('0');
          operation.ele('P_Charge').txt('0');
          operation.ele('MontantHT').txt(row[titleRow.indexOf('MONTANT_HT')]);
          operation.ele('TauxRS').txt(row[titleRow.indexOf('TAUX_RS')]);
          operation.ele('TauxTVA').txt('0');
          operation.ele('MontantTVA').txt('0');
          operation.ele('MontantTTC').txt(row[titleRow.indexOf('MONTANT_TTC')]);
          operation.ele('MontantRS').txt(row[titleRow.indexOf('MONTANT_RS')]);
          operation.ele('MontantNetServi').txt(row[titleRow.indexOf('MONTANT_NET_SERVI')]);

          // TotalPayement section
          const totalPayement = certificat.ele('TotalPayement');
          totalPayement.ele('TotalMontantHT').txt(row[titleRow.indexOf('MONTANT_HT')]);
          totalPayement.ele('TotalMontantTVA').txt('0');
          totalPayement.ele('TotalMontantTTC').txt(row[titleRow.indexOf('MONTANT_TTC')]);
          totalPayement.ele('TotalMontantRS').txt(row[titleRow.indexOf('MONTANT_RS')]);
          totalPayement.ele('TotalMontantNetServi').txt(row[titleRow.indexOf('MONTANT_NET_SERVI')]);
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
    link.download = 'output.xml';
    link.click();
  };

  return (

    <div className="converter-container">
    <h1>Excel to XML Converter</h1>
  
    {/* Show file upload only if XML content is not generated */}
    {!xmlContent && (
      <label htmlFor="file-upload" className="custom-file-upload">
        Choose File
      </label>
    )}
  
    {/* Only render the file input when there's no xmlContent */}
    {!xmlContent && (
      <input 
        type="file" 
        id="file-upload" 
        accept=".xlsx, .xls" 
        onChange={handleFileUpload} 
        style={{ display: 'none' }} // Hide the raw file input
      />
    )}
  
    {/* Show XML content and download option if XML content is generated */}
    {xmlContent && (
      <div>
        <h2>Generated XML</h2>
        <textarea 
          rows="20" 
          cols="80" 
          value={xmlContent} 
          readOnly
        ></textarea>
        <button onClick={downloadXML}>Download XML</button>
  
        {/* Show option to upload another file under the download button */}
        <div style={{ marginTop: '20px' }}>
          <label htmlFor="file-upload" className="custom-file-upload">
            Upload another file
          </label>
          <input 
            type="file" 
            id="file-upload" 
            accept=".xlsx, .xls" 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} // Hide the raw file input
          />
        </div>
      </div>
    )}
  </div>
  
  

//     <div className="converter-container">
//       <h1>Excel to XML Converter</h1>




// {!xmlContent && (
//   <label htmlFor="file-upload" className="custom-file-upload">
//     Choose File
//   </label>
// )}

// <input 
//   type="file" 
//   id="file-upload" 
//   accept=".xlsx, .xls" 
//   onChange={handleFileUpload} 
// />


//       {xmlContent && (
//         <div>
//           <h2>Generated XML</h2>
//           <textarea 
//             rows="20" 
//             cols="80" 
//             value={xmlContent} 
//             readOnly
//           ></textarea>
//           <button onClick={downloadXML}>Download XML</button>
//         </div>
//       )}
//     </div>
  );
}

export default App;











