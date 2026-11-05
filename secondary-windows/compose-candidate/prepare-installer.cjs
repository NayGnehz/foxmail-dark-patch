'use strict';
const fs=require('fs'),path=require('path');
const paths=require('../../foxmail-paths.cjs'),output=paths.output('compose-candidate');
let text=fs.readFileSync(path.join(__dirname,'../print-candidate/install.ps1'),'utf8');
text=text.replaceAll('temp\\print-candidate','temp\\compose-candidate').replaceAll('1.3.1-print-candidate','1.3.2-compose-candidate').replaceAll('Restored exact 1.3 executable, helper, reading template and build metadata.','Restored exact 1.3.1 executable, helper, compose template and build metadata.').replaceAll('Installed 1.3.1 print candidate; exact 1.3 backup retained at ','Installed 1.3.2 compose candidate; exact 1.3.1 backup retained at ');
fs.writeFileSync(path.join(output,'install.ps1'),text);
