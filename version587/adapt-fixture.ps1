# Relocate only decoded CIL ldc.i4 address constants in our existing numeric
# fixture. No recompilation, guessed byte searches or Foxmail binary changes.
function Convert-FoxmailFixture([string]$Source,[string]$Destination,[hashtable]$Map,[hashtable]$StringMap=@{}){
 $ErrorActionPreference='Stop'
 $bytes=[IO.File]::ReadAllBytes($Source)
 $stream=[IO.MemoryStream]::new($bytes,$false)
 $pe=[System.Reflection.PortableExecutable.PEReader]::new($stream)
 try{
  $md=[System.Reflection.Metadata.PEReaderExtensions]::GetMetadataReader($pe)
  $ops=@{};foreach($field in [Reflection.Emit.OpCodes].GetFields([Reflection.BindingFlags]'Public,Static')){$op=$field.GetValue($null);$ops[[int]$op.Value-band 0xffff]=$op}
  $changes=@();$stringOffsets=@{}
  foreach($handle in $md.MethodDefinitions){
   $method=$md.GetMethodDefinition($handle);$rva=$method.RelativeVirtualAddress;if(!$rva){continue}
   $section=$pe.PEHeaders.SectionHeaders|Where-Object {$rva -ge $_.VirtualAddress -and $rva -lt $_.VirtualAddress+$_.SizeOfRawData}|Select-Object -First 1
   if(!$section){throw 'Method section missing'}
   $raw=$section.PointerToRawData+$rva-$section.VirtualAddress
   $header=if(($bytes[$raw]-band 3)-eq 2){1}elseif(($bytes[$raw]-band 3)-eq 3){([BitConverter]::ToUInt16($bytes,$raw)-shr 12)*4}else{throw 'Invalid CIL header'}
   $il=[System.Reflection.Metadata.PEReaderExtensions]::GetMethodBody($pe,$rva).GetILBytes()
   for($i=0;$i -lt $il.Length;){
    $code=[int]$il[$i++];if($code -eq 0xfe){$code=0xfe00-bor $il[$i++]}
    $op=$ops[$code];if(!$op){throw 'Unknown CIL opcode'}
    $operand=$i
    $size=switch($op.OperandType.ToString()){
     'InlineNone'{0}
     {$_ -in @('ShortInlineBrTarget','ShortInlineI','ShortInlineVar')}{1}
     'InlineVar'{2}
     {$_ -in @('InlineI8','InlineR')}{8}
     'InlineSwitch'{4+4*[BitConverter]::ToInt32($il,$i)}
     default{4}
    }
    if($op.Name -eq 'ldc.i4'){
     $value=[BitConverter]::ToInt32($il,$operand)
     if($Map.ContainsKey($value)){
      $new=[int]$Map[$value];[BitConverter]::GetBytes($new).CopyTo($bytes,$raw+$header+$operand)
      $changes+=@{method=$md.GetString($method.Name);old=$value;new=$new;offset=$raw+$header+$operand}
     }
    }
    if($op.Name -eq 'ldstr' -and $StringMap.Count){
     $token=[BitConverter]::ToInt32($il,$operand)
     $heapOffset=$token-band 0xffffff
     $handle=[System.Reflection.Metadata.Ecma335.MetadataTokens]::UserStringHandle($heapOffset)
     $value=$md.GetUserString($handle)
     if($StringMap.ContainsKey($value)){
      $heap=[System.Reflection.Metadata.Ecma335.MetadataReaderExtensions]::GetHeapMetadataOffset($md,[System.Reflection.Metadata.Ecma335.HeapIndex]::UserString)
      $rawString=$pe.PEHeaders.MetadataStartOffset+$heap+$heapOffset
      $prefix=if(($bytes[$rawString]-band 0x80)-eq 0){1}elseif(($bytes[$rawString]-band 0xc0)-eq 0x80){2}else{4}
      $oldBytes=[Text.Encoding]::Unicode.GetBytes($value);$newBytes=[Text.Encoding]::Unicode.GetBytes([string]$StringMap[$value])
      if($oldBytes.Length -ne $newBytes.Length){throw 'Fixture user-string length must be preserved'}
      if(!$stringOffsets.ContainsKey($rawString)){
       for($j=0;$j -lt $oldBytes.Length;$j++){if($bytes[$rawString+$prefix+$j] -ne $oldBytes[$j]){throw 'Fixture user-string byte guard'}}
       $newBytes.CopyTo($bytes,$rawString+$prefix);$stringOffsets[$rawString]=$true
       $changes+=@{method=$md.GetString($method.Name);kind='guarded fixture user-string';offset=$rawString+$prefix;bytes=$oldBytes.Length}
      }
     }
    }
    $i+=$size;if($i -gt $il.Length){throw 'CIL operand beyond method'}
   }
  }
  foreach($key in $Map.Keys){if(!($changes|Where-Object old -eq $key)){throw ('Address constant not found in decoded fixture IL: '+$key)}}
  [IO.File]::WriteAllBytes($Destination,$bytes)
  [IO.File]::WriteAllText($Destination+'.relocations.json',($changes|ConvertTo-Json -Depth 5),[Text.UTF8Encoding]::new($false))
  Write-Output ('Adapted '+$changes.Count+' decoded fixture address operands')
 }finally{$pe.Dispose();$stream.Dispose()}
}
