param(
    [string]$SchemaPath = '',
    [string]$OutputPath = ''
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
if (-not $SchemaPath) { $SchemaPath = Join-Path $projectRoot 'database\spells\schema.json' }
if (-not $OutputPath) { $OutputPath = Join-Path $projectRoot 'База заклинаний.accdb' }
$OutputPath = [IO.Path]::GetFullPath($OutputPath)
if (Test-Path -LiteralPath $OutputPath) { throw "Файл уже существует; перезапись запрещена: $OutputPath" }
$schema = Get-Content -Raw -Encoding UTF8 -LiteralPath $SchemaPath | ConvertFrom-Json
$temporaryPath = [IO.Path]::ChangeExtension($OutputPath, '.building.accdb')
if (Test-Path -LiteralPath $temporaryPath) { throw "Незавершённый файл уже существует: $temporaryPath" }
$typeMap = @{counter=4; long=4; text=10; memo=12; double=7; currency=5; boolean=1; datetime=8}
$engine = $null
$database = $null

function Set-DaoProperty($Object, [string]$Name, [int]$Type, $Value) {
    try { $Object.Properties.Item($Name).Value = $Value }
    catch { $Object.Properties.Append($Object.CreateProperty($Name,$Type,$Value)) }
}
function Insert-Row($Database, [string]$TableName, $Values) {
    $columns=[System.Collections.Generic.List[string]]::new()
    $literals=[System.Collections.Generic.List[string]]::new()
    foreach ($property in $Values.PSObject.Properties) {
        $value=$property.Value
        if ($null -eq $value -or ($value -is [string] -and $value.Length -eq 0)) { continue }
        $columns.Add('['+$property.Name.Replace(']',']]')+']')
        if ($value -is [bool]) { $literals.Add($(if ($value) {'True'} else {'False'})) }
        elseif ($value -is [string]) { $literals.Add("'"+$value.Replace("'","''")+"'") }
        elseif ($value -is [ValueType]) { $literals.Add([Convert]::ToString($value,[Globalization.CultureInfo]::InvariantCulture)) }
        else { throw "Неподдержанный тип начального значения: $TableName.$($property.Name)" }
    }
    $sql='INSERT INTO ['+$TableName.Replace(']',']]')+'] ('+($columns -join ',')+') VALUES ('+($literals -join ',')+')'
    try { $Database.Execute($sql,128) }
    catch { throw "Ошибка справочника $TableName : $($_.Exception.Message)" }
}

try {
    $engine = New-Object -ComObject DAO.DBEngine.120
    # dbVersion120=128 produces an .accdb; all names/data use Unicode.
    $database = $engine.CreateDatabase($temporaryPath,';LANGID=0x0419;CP=1251;COUNTRY=0',128)
    foreach ($definition in $schema.tables) {
        $table = $database.CreateTableDef([string]$definition.name)
        foreach ($definitionField in $definition.fields) {
            $field = if ($definitionField.type -eq 'text') {
                $table.CreateField([string]$definitionField.name,10,[int]$definitionField.size)
            } else { $table.CreateField([string]$definitionField.name,[int]$typeMap[$definitionField.type]) }
            if ($definitionField.type -eq 'counter') { $field.Attributes = 16 }
            else { $field.Required = [bool]$definitionField.required }
            if ($definitionField.type -eq 'text' -or $definitionField.type -eq 'memo') { $field.AllowZeroLength = $false }
            if ($null -ne $definitionField.default) { $field.DefaultValue = [string]$definitionField.default }
            if ($definitionField.rule) {
                $field.ValidationRule = [string]$definitionField.rule
                $field.ValidationText = 'Значение не соответствует правилу поля. См. описание таблицы и словарь полей.'
            }
            $table.Fields.Append($field)
        }
        $pk=$table.CreateIndex('PK')
        $pk.Primary=$true
        $pk.Unique=$true
        $pk.Fields.Append($pk.CreateField('ID'))
        $table.Indexes.Append($pk)
        $indexNumber=0
        foreach ($columns in $definition.unique) {
            $indexNumber++
            $idx=$table.CreateIndex(('UQ_{0:d2}' -f $indexNumber))
            $idx.Unique=$true
            foreach ($column in $columns) { $idx.Fields.Append($idx.CreateField([string]$column)) }
            $table.Indexes.Append($idx)
        }
        $database.TableDefs.Append($table)
        $stored=$database.TableDefs.Item([string]$definition.name)
        Set-DaoProperty $stored 'Description' 10 ([string]$definition.description)
        Set-DaoProperty $stored 'SubdatasheetName' 10 '[None]'
        if ($definition.rule) {
            $stored.ValidationRule=[string]$definition.rule
            $stored.ValidationText='Поля записи противоречат друг другу. Проверьте вариант, ссылки и обязательные значения.'
        }
        foreach ($definitionField in $definition.fields) {
            $storedField=$stored.Fields.Item([string]$definitionField.name)
            $description=[string]$definitionField.description
            if ($definitionField.references) { $description+=' Связь: '+$definitionField.references+'.' }
            $description+=' Техническое имя: '+$definitionField.technical+'.'
            Set-DaoProperty $storedField 'Description' 10 $description
            Set-DaoProperty $storedField 'Caption' 10 ([string]$definitionField.name)
        }
    }
    $relationNumber=0
    foreach ($definition in $schema.tables) {
        foreach ($definitionField in $definition.fields) {
            if (-not $definitionField.references) { continue }
            $relationNumber++
            $relation=$database.CreateRelation(('FK_{0:d3}' -f $relationNumber),[string]$definitionField.references,[string]$definition.name,0)
            $relationField=$relation.CreateField('ID')
            $relationField.ForeignName=[string]$definitionField.name
            $relation.Fields.Append($relationField)
            $database.Relations.Append($relation)
            $parent=@($schema.tables | Where-Object name -eq $definitionField.references)[0]
            $displayField=if ($parent.lookupName) { [string]$parent.lookupName } else { 'ID' }
            $storedField=$database.TableDefs.Item([string]$definition.name).Fields.Item([string]$definitionField.name)
            Set-DaoProperty $storedField 'DisplayControl' 3 111
            Set-DaoProperty $storedField 'RowSourceType' 10 'Table/Query'
            $rowSource='SELECT [ID], ['+$displayField+'] FROM ['+$parent.name+'] ORDER BY ['+$displayField+'],[ID];'
            Set-DaoProperty $storedField 'RowSource' 10 $rowSource
            Set-DaoProperty $storedField 'BoundColumn' 3 1
            Set-DaoProperty $storedField 'ColumnCount' 3 2
            Set-DaoProperty $storedField 'ColumnWidths' 10 '0cm;7cm'
            Set-DaoProperty $storedField 'LimitToList' 1 $true
        }
    }
    foreach ($definition in $schema.tables) {
        foreach ($seed in $definition.seeds) { Insert-Row $database ([string]$definition.name) $seed }
    }
    foreach ($query in $schema.queries) {
        $qd=$database.CreateQueryDef([string]$query.name,[string]$query.sql)
        $rs=$qd.OpenRecordset(4)
        $rs.Close()
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($rs)
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($qd)
    }
    Set-DaoProperty $database 'AppTitle' 10 'Заклинания D&D 5e 2014 — структура на проверку'
    $database.Close()
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($database)
    $database=$null
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($engine)
    $engine=$null
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
    Move-Item -LiteralPath $temporaryPath -Destination $OutputPath
    @{Path=$OutputPath; Tables=$schema.tables.Count; Relations=$relationNumber; Queries=$schema.queries.Count; Spells=0} | ConvertTo-Json
} finally {
    if ($null -ne $database) {
        try { $database.Close() } catch {}
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($database)
    }
    if ($null -ne $engine) { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($engine) }
}
