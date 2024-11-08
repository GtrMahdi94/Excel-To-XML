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
        const root = xmlDoc.ele('AllOperations');

        dataRows.forEach(row => {
          const operation = root.ele('Operation');
          operation.txt(row[1]);
          operation.ele(titleRow[2] || 'Column2').txt(row[2]);
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

      {/* Render "Choose File" button first if no file is uploaded */}
      {!xmlContent && (
        <label htmlFor="file-upload" className="custom-file-upload">
          Choose File
        </label>
      )}

      <input 
        type="file" 
        accept=".xlsx, .xls" 
        onChange={handleFileUpload} 
        id="file-upload"
        style={{ display: 'none' }} 
      />

      {/* Display text area and buttons in the desired order when file is uploaded */}
      {xmlContent && (
        <>
          <textarea rows="20" cols="80" readOnly value={xmlContent} />
          <br />
          <button onClick={downloadXML}>Download XML</button>
          <br />
          <label htmlFor="file-upload" className="custom-file-upload">
            Choose File
          </label>
        </>
      )}
    </div>
  );
}

export default App;