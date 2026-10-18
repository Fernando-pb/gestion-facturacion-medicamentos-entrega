// Primitivas SpreadsheetML 2003 compartidas por las salidas de Contabilidad.
export const escapar = (valor) => String(valor).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/gu, '\ufffd').replace(/[&<>"']/g,
  (caracter) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[caracter]);
export const texto = (valor) => `<Cell><Data ss:Type="String">${escapar(valor)}</Data></Cell>`;
export const importe = (valor) => `<Cell ss:StyleID="Moneda"><Data ss:Type="Number">${escapar(valor)}</Data></Cell>`;
export const fila = (celdas) => `<Row>${celdas.join('')}</Row>`;
export const libro = (hojas) => `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="Default"><Alignment ss:WrapText="1"/></Style><Style ss:ID="Moneda"><NumberFormat ss:Format="0.00"/></Style></Styles>
${hojas.map((h) => `<Worksheet ss:Name="${escapar(h.nombre)}"><Table>${h.filas.join('')}</Table></Worksheet>`).join('\n')}
</Workbook>`;
