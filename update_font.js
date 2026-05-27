const fs = require('fs');

const path1 = 'd:/projects/restauraq/client/src/pages/POS.jsx';
let content = fs.readFileSync(path1, 'utf8');

if (!content.includes("localStorage.getItem('pos_print_font_size')")) {
  content = content.replace("const { orderType,", "const fsFontSize = parseInt(localStorage.getItem('pos_print_font_size')) || 16;\n  const { orderType,");
  
  const parts = content.split('className="print-only receipt-content"');
  if (parts.length === 2) {
    let receipt = parts[1];
    receipt = receipt.replace(/fontSize: '16px'/g, "fontSize: `${fsFontSize}px`");
    receipt = receipt.replace(/fontSize: '20px'/g, "fontSize: `${fsFontSize * 1.25}px`");
    receipt = receipt.replace(/fontSize: '15px'/g, "fontSize: `${Math.round(fsFontSize * 0.9375)}px`");
    receipt = receipt.replace(/fontSize: '18px'/g, "fontSize: `${Math.round(fsFontSize * 1.125)}px`");
    receipt = receipt.replace(/fontSize: '14px'/g, "fontSize: `${Math.round(fsFontSize * 0.875)}px`");
    
    content = parts[0] + 'className="print-only receipt-content"' + receipt;
    fs.writeFileSync(path1, content, 'utf8');
    console.log('POS.jsx updated');
  } else {
    console.log('POS.jsx could not be split');
  }
} else {
  console.log('POS.jsx already has fsFontSize');
}

const path2 = 'd:/projects/restauraq/client/src/pages/SalesSummary.jsx';
let content2 = fs.readFileSync(path2, 'utf8');
if (!content2.includes("localStorage.getItem('pos_print_font_size')")) {
  content2 = content2.replace("const [period, setPeriod] =", "const fsSize = parseInt(localStorage.getItem('pos_print_font_size')) || 16;\n  const [period, setPeriod] =");
  
  const parts2 = content2.split('className="print-only receipt-content"');
  if (parts2.length === 2) {
    let receipt2 = parts2[1];
    receipt2 = receipt2.replace(/fontSize: '16px'/g, "fontSize: `${fsSize}px`");
    receipt2 = receipt2.replace(/fontSize: '14px'/g, "fontSize: `${Math.round(fsSize * 0.875)}px`");
    receipt2 = receipt2.replace(/fontSize: '12px'/g, "fontSize: `${Math.round(fsSize * 0.75)}px`");
    
    content2 = parts2[0] + 'className="print-only receipt-content"' + receipt2;
    fs.writeFileSync(path2, content2, 'utf8');
    console.log('SalesSummary.jsx updated');
  } else {
    console.log('SalesSummary.jsx could not be split');
  }
} else {
  console.log('SalesSummary.jsx already has fsSize');
}
