param([string]$DatabasePath='')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
if(-not $DatabasePath){$DatabasePath=Join-Path $root 'База заклинаний.accdb'}
$schema=Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $root 'database\spells\schema.json')|ConvertFrom-Json
$payload=Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $root 'database\spells\demo-records.json')|ConvertFrom-Json
$engine=$null;$db=$null;$checks=[Collections.Generic.List[object]]::new()
function Check([string]$Name,[bool]$Pass,$Detail=''){
    $checks.Add(@{name=$Name;passed=$Pass;detail=$Detail})
    if(-not $Pass){throw "Ошибка данных: $Name. $Detail"}
}
function Literal($Value){
    if($Value -is [string]){return "'"+$Value.Replace("'","''")+"'"}
    if($Value -is [bool]){return $(if($Value){'True'}else{'False'})}
    return [Convert]::ToString($Value,[Globalization.CultureInfo]::InvariantCulture)
}
function Scalar([string]$Sql){
    $rs=$db.OpenRecordset($Sql,4)
    try{return $rs.Fields.Item(0).Value}finally{$rs.Close();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($rs)}
}
try{
    $engine=New-Object -ComObject DAO.DBEngine.120
    $db=$engine.OpenDatabase([IO.Path]::GetFullPath($DatabasePath),$false,$true)
    foreach($table in $schema.tables){
        $newRows=@($payload.rows|Where-Object table -eq $table.name)
        $actual=[int](Scalar ('SELECT COUNT(*) FROM ['+$table.name+']'))
        Check ('Число записей: '+$table.name) ($actual -eq ($table.seeds.Count+$newRows.Count)) $actual
    }
    foreach($row in $payload.rows){
        $table=@($schema.tables|Where-Object name -eq $row.table)[0]
        $filters=[Collections.Generic.List[string]]::new()
        if($row.values.PSObject.Properties.Name -contains 'ID'){$filters.Add('[ID]='+[string]$row.values.ID)}
        else{
            foreach($property in $row.values.PSObject.Properties){
                $field=@($table.fields|Where-Object name -eq $property.Name)[0]
                if($field.type -ne 'memo'){$filters.Add('['+$property.Name+']='+(Literal $property.Value))}
            }
        }
        $rs=$db.OpenRecordset(('SELECT * FROM ['+$row.table+'] WHERE '+($filters -join ' AND ')),4)
        try{
            Check ('Найдена запись '+$row.table+' '+($filters -join ';')) (-not $rs.EOF)
            $differences=@()
            foreach($property in $row.values.PSObject.Properties){
                $actual=$rs.Fields.Item([string]$property.Name).Value
                $equal=if($property.Value -is [bool]){[bool]$actual -eq $property.Value}else{[string]$actual -ceq [string]$property.Value}
                if(-not $equal){$differences+=$property.Name}
            }
            Check ('Содержимое записи: '+$row.table) ($differences.Count -eq 0) ($differences -join ', ')
            $rs.MoveNext();Check ('Нет дубля записи: '+$row.table) $rs.EOF
        }finally{$rs.Close();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($rs)}
    }
    Check 'Цена товара не выдумана из стоимости компонента' ((Scalar 'SELECT COUNT(*) FROM [Предметы] WHERE [ЦенаММ] Is Not Null') -eq 0)
    Check '100 зм жемчужины сохранены как 10000 мм требования' ((Scalar 'SELECT [МинимумПредметаММ] FROM [МатериалыЗаклинаний] WHERE [ПредметID]=5003') -eq 10000)
    Check 'Все материальные требования имеют проверенный способ расхода' ((Scalar 'SELECT COUNT(*) FROM [МатериалыЗаклинаний] WHERE [СпособРасходаID]=1') -eq 0)
    $relations=@($db.Relations|Where-Object Name -like 'FK_*')
    Check '46 связей остаются включёнными' ($relations.Count -eq 46 -and @($relations|Where-Object {($_.Attributes -band 2) -ne 0}).Count -eq 0)
    foreach($query in $db.QueryDefs){
        if($query.Name -like '~*'){continue}
        $rs=$query.OpenRecordset(4)
        try{while(-not $rs.EOF){foreach($field in $rs.Fields){$null=$field.Value};$rs.MoveNext()}}
        finally{$rs.Close();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($rs)}
        Check ('Запрос и значения читаются: '+$query.Name) $true
    }
    Check 'Форма назначена стартовой' ($db.Properties.Item('StartupForm').Value -eq 'КаталогЗаклинаний')
}finally{
    if($null -ne $db){$db.Close();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($db)}
    if($null -ne $engine){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($engine)}
}
$report=@{passed=$true;checks=$checks;database=$DatabasePath;spells=4;verifiedAt=(Get-Date).ToString('o')}
$report|ConvertTo-Json -Depth 6|Set-Content -Encoding UTF8 -LiteralPath (Join-Path $root 'database\spells\demo-data-verification.json')
@{passed=$true;checks=$checks.Count;spells=4}|ConvertTo-Json
