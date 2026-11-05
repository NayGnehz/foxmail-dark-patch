'use strict';
const fs=require('fs');
const s=fs.readFileSync('verify-initial-erase.cs','utf8');
const mark=' static void Main(string[] args)';
if(s.split(mark).length!==2)throw Error('Verification source drift');
let body=fs.readFileSync('verify-erase-diagnostic-body.cs','utf8');
body=body.replace(' static void Main(string[] args)', ' static void Main(string[] args){try{Execute(args);}catch(Exception ex){Console.Error.WriteLine(ex.GetType().Name+": "+ex.Message);Environment.ExitCode=1;}}\n static void Execute(string[] args)');
fs.writeFileSync('verify-erase-diagnostic.cs',s.slice(0,s.indexOf(mark)).replace('class InitialEraseCheck','class EraseDiagnosticCheck')+body);
