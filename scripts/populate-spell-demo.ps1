param([string]$DatabasePath='')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
if(-not $DatabasePath){$DatabasePath=Join-Path $root 'database\spells\work\spells-demo-building.accdb'}
$payload=Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $root 'database\spells\demo-records.json')|ConvertFrom-Json
$engine=$null;$database=$null;$workspace=$null;$inTransaction=$false
try{
    $engine=New-Object -ComObject DAO.DBEngine.120
    $workspace=$engine.Workspaces.Item(0)
    $database=$engine.OpenDatabase([IO.Path]::GetFullPath($DatabasePath))
    $count=$database.OpenRecordset('SELECT COUNT(*) FROM [Заклинания]',4)
    try{if([int]$count.Fields.Item(0).Value -ne 0){throw 'Наполнение рассчитано на пустой каталог; существующие записи не перезаписываются.'}}
    finally{$count.Close();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($count)}
    $workspace.BeginTrans();$inTransaction=$true
    foreach($row in $payload.rows){
        $columns=[System.Collections.Generic.List[string]]::new()
        $values=[System.Collections.Generic.List[string]]::new()
        foreach($property in $row.values.PSObject.Properties){
            if($null -eq $property.Value){continue}
            $columns.Add('['+$property.Name.Replace(']',']]')+']')
            if($property.Value -is [string]){$values.Add("'"+$property.Value.Replace("'","''")+"'")}
            elseif($property.Value -is [bool]){$values.Add($(if($property.Value){'True'}else{'False'}))}
            else{$values.Add([Convert]::ToString($property.Value,[Globalization.CultureInfo]::InvariantCulture))}
        }
        $sql='INSERT INTO ['+$row.table+'] ('+($columns -join ',')+') VALUES ('+($values -join ',')+')'
        try{$database.Execute($sql,128)}catch{throw "Ошибка строки $($row.table): $($_.Exception.Message)"}
    }
    $database.Execute("UPDATE [Заклинания] SET [ПровереноДата]=#2026-10-15# WHERE [Код] Like 'dndsu:5e2014:spell:*'",128)
    $database.Execute("UPDATE [ИнформацияОБазе] SET [Пояснение]='Добавлены четыре примера 2014 года и форма КаталогЗаклинаний. Нужна пользовательская проверка данных и карточки.' WHERE [Код]='version'",128)
    $database.Execute("UPDATE [ИнформацияОБазе] SET [Пояснение]='Откройте форму КаталогЗаклинаний и выберите название сверху. Это карточка для игрока; технические таблицы остаются доступны отдельно.' WHERE [Код]='start'",128)
    $database.Execute("UPDATE [ИнформацияОБазе] SET [Пояснение]='Огненный шар, Лечение ран, Опознание и Благословение. Связанные данные находятся в отдельных таблицах; описания кратко пересказаны. Источник: DnD.su 5e14.' WHERE [Код]='empty'",128)
    $workspace.CommitTrans();$inTransaction=$false
    @{Spells=4;InsertedRows=$payload.rows.Count;Database=$DatabasePath}|ConvertTo-Json
}finally{
    if($inTransaction){$workspace.Rollback()}
    if($null -ne $database){$database.Close();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($database)}
    if($null -ne $workspace){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($workspace)}
    if($null -ne $engine){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($engine)}
}
