param([string]$DatabasePath='', [string]$OutputPath='')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
if(-not $DatabasePath){$DatabasePath=Join-Path $root 'База заклинаний.accdb'}
if(-not $OutputPath){$OutputPath=Join-Path $root 'database\spells\access-export.json'}
$schema=Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $root 'database\spells\schema.json')|ConvertFrom-Json
$engine=$null;$database=$null
$tables=[ordered]@{}
try{
    $engine=New-Object -ComObject DAO.DBEngine.120
    $database=$engine.OpenDatabase([IO.Path]::GetFullPath($DatabasePath),$false,$true)
    foreach($table in $schema.tables){
        $rows=[Collections.Generic.List[object]]::new()
        $recordset=$database.OpenRecordset(('SELECT * FROM ['+$table.name+'] ORDER BY [ID]'),4)
        try{
            $existing=@($recordset.Fields|ForEach-Object {$_.Name})
            foreach($field in $table.fields){
                if($existing -notcontains $field.name -and $field.technical -ne 'icon_url'){throw "Missing field: $($table.name).$($field.name)"}
            }
            while(-not $recordset.EOF){
                $row=[ordered]@{}
                foreach($field in $table.fields){
                    $value=if($existing -contains $field.name){$recordset.Fields.Item([string]$field.name).Value}else{$null}
                    if($null -eq $value -or $value -is [DBNull]){$value=$null}
                    elseif($value -is [datetime]){$value=$value.ToString('yyyy-MM-ddTHH:mm:ss',[Globalization.CultureInfo]::InvariantCulture)}
                    $row[$field.technical]=$value
                }
                $rows.Add($row)
                $recordset.MoveNext()
            }
        }finally{$recordset.Close();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($recordset)}
        $tables[$table.technical]=@($rows.ToArray())
    }
}finally{
    if($database){$database.Close();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($database)}
    if($engine){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($engine)}
}
$result=[ordered]@{schemaVersion=$schema.version;sourceFile=[IO.Path]::GetFileName($DatabasePath);tables=$tables}
$result|ConvertTo-Json -Depth 12|Set-Content -Encoding utf8 -LiteralPath $OutputPath
@{tables=$tables.Count;spells=$tables['spells'].Count;output=$OutputPath}|ConvertTo-Json
