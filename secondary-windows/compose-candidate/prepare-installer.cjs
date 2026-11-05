'use strict';
const fs=require('fs'),path=require('path');
let text=fs.readFileSync(path.join(__dirname,'../print-candidate/install.ps1'),'utf8');
text=text.replaceAll('1.3.1-print-candidate','1.3.2-compose-candidate').replaceAll('Restored exact 1.3 executable, helper, reading template and build metadata.','Restored exact 1.3.1 executable, helper, compose template and build metadata.').replaceAll('Installed 1.3.1 print candidate; exact 1.3 backup retained at ','Installed 1.3.2 compose candidate; exact 1.3.1 backup retained at ');
fs.writeFileSync(path.join(__dirname,'install.ps1'),text);
