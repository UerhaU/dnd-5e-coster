param([string]$DatabasePath='', [string]$ExpectedOriginalHash='')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
if(-not $DatabasePath){$DatabasePath=Join-Path $root 'База заклинаний.accdb'}
$schema=Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $root 'database\spells\schema.json') | ConvertFrom-Json
$reportPath=Join-Path $root 'database\spells\verification.json'
@{status='running';allPassed=$false;startedAt=(Get-Date).ToString('o');database=$DatabasePath} | ConvertTo-Json | Set-Content -Encoding UTF8 -LiteralPath $reportPath
$testDirectory=Join-Path $root 'database\spells\validation'
New-Item -ItemType Directory -Path $testDirectory -Force | Out-Null
$testPath=Join-Path $testDirectory ('spells-'+[guid]::NewGuid().ToString('N')+'.accdb')
Copy-Item -LiteralPath $DatabasePath -Destination $testPath
$engine=$null; $db=$null; $workspace=$null
$checks=[System.Collections.Generic.List[object]]::new()

function Check([string]$Name,[bool]$Passed,$Detail='') {
    $checks.Add(@{name=$Name;passed=$Passed;detail=$Detail})
    if(-not $Passed){throw "Проверка не пройдена: $Name. $Detail"}
}
function Scalar([string]$Sql) {
    $rs=$db.OpenRecordset($Sql,4)
    try {return $rs.Fields.Item(0).Value}
    finally {$rs.Close();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($rs)}
}
function Exec([string]$Sql){$db.Execute($Sql,128)}
function Reject([string]$Name,[string]$Sql){
    $workspace.BeginTrans()
    $rejected=$false
    try {try {Exec $Sql} catch {$rejected=$true}}
    finally {$workspace.Rollback()}
    Check $Name $rejected
}
function Add-Spell([int]$Id,[string]$Name,[int]$Level,[int]$School,[int]$Range,[int]$Duration=1){
    Exec ("INSERT INTO [Заклинания] ([ID],[Код],[Ревизия],[Название],[Уровень],[ШколаID],[РедакцияID],[ВидДистанцииID],[ВидДлительностиID]) VALUES ($Id,'fixture:$Id',1,'"+$Name.Replace("'","''")+"',$Level,$School,1,$Range,$Duration)")
}
function Add-Item([int]$Id,[string]$Name){
    Exec ("INSERT INTO [Предметы] ([ID],[Код],[Название]) VALUES ($Id,'fixture:$Id','"+$Name.Replace("'","''")+"')")
}
function Formula([int]$Id,[string]$Name,[int]$Die,[int]$Count){
    Exec "INSERT INTO [ФормулыБросков] ([ID],[Код],[Название]) VALUES ($Id,'fixture:$Id','$Name')"
    Exec "INSERT INTO [СлагаемыеБросков] ([ФормулаID],[Порядок],[Вид],[КубикID],[КоличествоКубиков]) VALUES ($Id,1,'кубики',$Die,$Count)"
}
function Effect([int]$Id,[string]$Name,[int]$Kind,$Formula=$null,$Damage=$null){
    $formulaValue=if($null -eq $Formula){'NULL'}else{[string]$Formula}
    $damageValue=if($null -eq $Damage){'NULL'}else{[string]$Damage}
    Exec "INSERT INTO [Эффекты] ([ID],[Код],[Название],[ВидЭффектаID],[ФормулаID],[ТипУронаID]) VALUES ($Id,'fixture:$Id','$Name',$Kind,$formulaValue,$damageValue)"
}
function Link-Effect([int]$Id,[int]$Spell,[int]$Effect,[string]$Resolution,[int]$Ordinal=1){
    Exec "INSERT INTO [ЭффектыЗаклинаний] ([ID],[ЗаклинаниеID],[ЭффектID],[Порядок],[Воздействие]) VALUES ($Id,$Spell,$Effect,$Ordinal,'$Resolution')"
}

try {
    $engine=New-Object -ComObject DAO.DBEngine.120
    $workspace=$engine.Workspaces.Item(0)
    $db=$engine.OpenDatabase($testPath)
    $actualTables=@($db.TableDefs | Where-Object {$_.Name -notlike 'MSys*' -and $_.Name -notlike '~*'})
    Check 'Все таблицы созданы' ($actualTables.Count -eq $schema.tables.Count) $actualTables.Count
    $actualRelations=@($db.Relations | Where-Object {$_.Name -like 'FK_*'})
    $expectedRelations=@($schema.tables | ForEach-Object {$_.fields | Where-Object {$_.references}}).Count
    Check 'Все внешние ключи созданы' ($actualRelations.Count -eq $expectedRelations) $actualRelations.Count
    Check 'Целостность ссылок включена' (@($actualRelations | Where-Object {($_.Attributes -band 2) -ne 0}).Count -eq 0)
    foreach($table in $schema.tables){
        $count=[int](Scalar ('SELECT COUNT(*) FROM ['+$table.name+']'))
        Check ('Начальные записи: '+$table.name) ($count -eq $table.seeds.Count) $count
        $td=$db.TableDefs.Item([string]$table.name)
        Check ('Первичный ключ: '+$table.name) ($td.Indexes.Item('PK').Primary -and $td.Fields.Item('ID').Type -eq 4 -and ($td.Fields.Item('ID').Attributes -band 16) -ne 0)
    }
    foreach($query in $schema.queries){
        $rs=$db.QueryDefs.Item([string]$query.name).OpenRecordset(4)
        $rs.Close();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($rs)
        Check ('Запрос выполняется: '+$query.name) $true
    }
    $baseSpell="INSERT INTO [Заклинания] ([Код],[Название],[Уровень],[ШколаID],[РедакцияID],[ВидДистанцииID],[ВидДлительностиID]) VALUES "
    Reject 'Уровень 10 запрещён' ($baseSpell+"('bad:level','Неверный уровень',10,5,1,3,1)")
    Reject 'Несуществующая школа запрещена' ($baseSpell+"('bad:fk','Неверная школа',1,999999,1,3,1)")
    Reject 'Отсутствие имени запрещено' "INSERT INTO [Заклинания] ([Код],[Уровень],[ШколаID],[РедакцияID],[ВидДистанцииID],[ВидДлительностиID]) VALUES ('bad:name',1,5,1,3,1)"
    Reject 'Пустое имя запрещено' ($baseSpell+"('bad:empty','',1,5,1,3,1)")
    Reject 'Отрицательная цена запрещена' "INSERT INTO [Предметы] ([Код],[Название],[ЦенаММ]) VALUES ('bad:price','Проверка',-1)"
    Reject 'Дробная медная монета запрещена' "INSERT INTO [Предметы] ([Код],[Название],[ЦенаММ]) VALUES ('bad:pricefraction','Проверка',0.5)"

    # Fixtures exist only in this disposable database, never in the review artifact.
    Add-Spell 1001 'Огненный шар' 3 5 3
    Add-Spell 1002 'Опознание' 1 3 2
    Add-Spell 1003 'Возрождение' 3 7 2
    Add-Spell 1004 'Огненный снаряд' 0 5 3
    Add-Spell 1005 'Цветной шарик' 1 5 3
    Add-Spell 1006 'Огненный щит' 4 5 1 2
    Add-Spell 1007 'Лечение ран' 1 5 2
    Add-Spell 1008 'Благословение' 1 4 3 2
    Add-Spell 1009 'Щит' 1 1 1 2
    Exec 'UPDATE [Заклинания] SET [ДистанцияФуты]=150 WHERE [ID]=1001'
    Exec 'UPDATE [Заклинания] SET [Ритуал]=True WHERE [ID]=1002'
    Exec 'UPDATE [Заклинания] SET [ДлительностьЧисло]=10,[ЕдиницаДлительностиID]=3 WHERE [ID]=1006'
    Exec 'UPDATE [Заклинания] SET [Концентрация]=True,[ДлительностьЧисло]=1,[ЕдиницаДлительностиID]=3 WHERE [ID]=1008'
    Exec "UPDATE [Заклинания] SET [ДлительностьЧисло]=1,[ЕдиницаДлительностиID]=1,[ДлительностьТекст]='Завершение привязано к началу следующего хода владельца' WHERE [ID]=1009"
    Exec 'INSERT INTO [КлассыЗаклинаний] ([ЗаклинаниеID],[КлассID],[ИсточникПравилаID]) VALUES (1001,4,1)'
    Exec 'INSERT INTO [КлассыЗаклинаний] ([ЗаклинаниеID],[КлассID],[ИсточникПравилаID]) VALUES (1001,13,1)'
    Check 'Несколько классов без списков в одной ячейке' ((Scalar 'SELECT COUNT(*) FROM [КлассыЗаклинаний] WHERE [ЗаклинаниеID]=1001') -eq 2)
    Reject 'Дублирование класса/источника запрещено' 'INSERT INTO [КлассыЗаклинаний] ([ЗаклинаниеID],[КлассID],[ИсточникПравилаID]) VALUES (1001,4,1)'
    Reject 'Удаление используемого заклинания запрещено' 'DELETE FROM [Заклинания] WHERE [ID]=1001'
    Reject 'Повтор той же ревизии запрещён' ($baseSpell+"('fixture:1001','Повтор',3,5,1,3,1)")

    Formula 2001 '8к6' 2 8
    Formula 2002 '1к6' 2 1
    Formula 2003 '1к10' 4 1
    Formula 2004 '2к10' 4 2
    Formula 2005 '3к8' 3 3
    Formula 2006 '1к8 с модификатором' 3 1
    Exec "INSERT INTO [СлагаемыеБросков] ([ФормулаID],[Порядок],[Вид],[МодификаторЗаклинателя]) VALUES (2006,2,'модификатор',True)"
    Formula 2007 '1к4' 1 1
    Reject 'Нулевое число кубиков запрещено' "INSERT INTO [СлагаемыеБросков] ([ФормулаID],[Порядок],[Вид],[КубикID],[КоличествоКубиков]) VALUES (2001,2,'кубики',2,0)"
    Reject 'У кубиков обязателен тип' "INSERT INTO [СлагаемыеБросков] ([ФормулаID],[Порядок],[Вид],[КоличествоКубиков]) VALUES (2001,2,'кубики',1)"
    Check 'Лечение с контекстным модификатором' ((Scalar 'SELECT COUNT(*) FROM [СлагаемыеБросков] WHERE [ФормулаID]=2006') -eq 2)

    Effect 3001 'Огненный урон области' 1 2001 4
    Link-Effect 4001 1001 3001 'спасбросок'
    Exec "UPDATE [ЭффектыЗаклинаний] SET [ХарактеристикаСпасброскаID]=2,[ПриУспехе]='Половина урона' WHERE [ID]=4001"
    Exec 'INSERT INTO [ОбластиЗаклинаний] ([ЗаклинаниеID],[Порядок],[ФормаID],[РадиусФуты]) VALUES (1001,1,1,20)'
    Exec "INSERT INTO [УсиленияЗаклинаний] ([ЭффектЗаклинанияID],[Порядок],[ОтЧегоЗависит],[Порог],[Шаг],[Операция],[ФормулаID]) VALUES (4001,1,'уровень ячейки',4,1,'добавить формулу',2002)"
    Check 'Дистанция, область, спасбросок и усиление разделены' ((Scalar 'SELECT COUNT(*) FROM [ОбластиЗаклинаний] WHERE [ЗаклинаниеID]=1001') -eq 1 -and (Scalar 'SELECT COUNT(*) FROM [УсиленияЗаклинаний] WHERE [ЭффектЗаклинанияID]=4001') -eq 1)
    Effect 3002 'Огненный урон заговором' 1 2003 4
    Link-Effect 4002 1004 3002 'дальнобойная атака'
    Exec "INSERT INTO [УсиленияЗаклинаний] ([ЭффектЗаклинанияID],[Порядок],[ОтЧегоЗависит],[Порог],[Операция],[ФормулаID]) VALUES (4002,1,'уровень персонажа',5,'заменить формулу',2004)"
    Check 'Заговор усиливается от уровня персонажа' ((Scalar "SELECT COUNT(*) FROM [УсиленияЗаклинаний] WHERE [ЭффектЗаклинанияID]=4002 AND [ОтЧегоЗависит]='уровень персонажа'") -eq 1)
    Effect 3003 'Урон выбранной стихией' 1 2005
    Exec 'UPDATE [Эффекты] SET [ВыборТипаУрона]=True WHERE [ID]=3003'
    foreach($damage in @(1,3,4,6,9,13)){Exec "INSERT INTO [ВариантыУронаЭффекта] ([ЭффектID],[ТипУронаID]) VALUES (3003,$damage)"}
    Link-Effect 4003 1005 3003 'дальнобойная атака'
    Check 'Шесть типов урона на выбор, не шесть одновременных ударов' ((Scalar 'SELECT COUNT(*) FROM [ВариантыУронаЭффекта] WHERE [ЭффектID]=3003') -eq 6)
    Effect 3004 'Лечение' 2 2006
    Link-Effect 4004 1007 3004 'автоматически'
    Effect 3005 'Изменение бросков' 5 2007
    Link-Effect 4005 1008 3005 'автоматически'
    Check 'Эффект может лечить или менять бросок, а не наносить урон' ((Scalar 'SELECT COUNT(*) FROM [Эффекты] WHERE [ID] IN (3004,3005) AND [ТипУронаID] Is Null') -eq 2)
    Effect 3006 'Справочная информация' 9
    Link-Effect 4006 1002 3006 'автоматически'
    Effect 3007 'Возвращение к жизни' 10
    Link-Effect 4007 1003 3007 'особое'
    Check 'Не наносящие урон заклинания допускают отсутствие кубиков' ((Scalar 'SELECT COUNT(*) FROM [Эффекты] WHERE [ID] IN (3006,3007) AND [ФормулаID] Is Null') -eq 2)
    Formula 2008 '2к8' 3 2
    Effect 3008 'Тёплый вариант: урон огнём' 1 2008 4
    Effect 3009 'Тёплый вариант: сопротивление холоду' 11 $null 3
    Effect 3010 'Холодный вариант: урон холодом' 1 2008 3
    Effect 3011 'Холодный вариант: сопротивление огню' 11 $null 4
    Exec "INSERT INTO [ВыборыЭффектовЗаклинаний] ([ID],[ЗаклинаниеID],[Код],[Название]) VALUES (8001,1006,'shield_temperature','Вариант щита')"
    Exec "INSERT INTO [ВариантыЭффектовЗаклинаний] ([ID],[ВыборID],[Код],[Название]) VALUES (8101,8001,'warm','Тёплый')"
    Exec "INSERT INTO [ВариантыЭффектовЗаклинаний] ([ID],[ВыборID],[Код],[Название]) VALUES (8102,8001,'cold','Прохладный')"
    foreach($entry in @(@(4008,3008,1,8101),@(4009,3009,2,8101),@(4010,3010,3,8102),@(4011,3011,4,8102))){
        Link-Effect $entry[0] 1006 $entry[1] 'особое' $entry[2]
        Exec "UPDATE [ЭффектыЗаклинаний] SET [ВариантID]=$($entry[3]) WHERE [ID]=$($entry[0])"
    }
    Check 'Вариант заклинания объединяет несколько совместных эффектов' ((Scalar 'SELECT COUNT(*) FROM [ЭффектыЗаклинаний] WHERE [ВариантID]=8101') -eq 2)
    Check 'Альтернативный набор отделён от первого' ((Scalar 'SELECT COUNT(*) FROM [ЭффектыЗаклинаний] WHERE [ВариантID]=8102') -eq 2 -and (Scalar 'SELECT COUNT(*) FROM [ВариантыЭффектовЗаклинаний] WHERE [ВыборID]=8001') -eq 2)
    Exec "INSERT INTO [ВремяНакладывания] ([ЗаклинаниеID],[Порядок],[ВремяЧисло],[ЕдиницаВремениID]) VALUES (1002,1,1,3)"
    Exec "INSERT INTO [ВремяНакладывания] ([ЗаклинаниеID],[Порядок],[ДействиеID],[КоличествоДействий],[УсловиеРеакции]) VALUES (1009,1,3,1,'Условие определяется атакой либо конкретным заклинанием')"
    Check 'Ритуал и минутное накладывание независимы' ((Scalar 'SELECT COUNT(*) FROM [ВремяНакладывания] WHERE [ЗаклинаниеID]=1002 AND [ЕдиницаВремениID]=3') -eq 1)
    Check 'Реакция хранит отдельное условие' ((Scalar 'SELECT COUNT(*) FROM [ВремяНакладывания] WHERE [ЗаклинаниеID]=1009 AND [ДействиеID]=3 AND [УсловиеРеакции] Is Not Null') -eq 1)
    Check 'Концентрация и точный момент завершения сохраняются' ((Scalar 'SELECT COUNT(*) FROM [Заклинания] WHERE [ID]=1008 AND [Концентрация]=True') -eq 1 -and (Scalar 'SELECT COUNT(*) FROM [Заклинания] WHERE [ID]=1009 AND [ДлительностьТекст] Is Not Null') -eq 1)

    foreach($entry in @(@(5001,'Жемчужина'),@(5002,'Перо совы'),@(5003,'Алмаз'),@(5004,'Фосфор'),@(5005,'Светлячок'))){Add-Item $entry[0] $entry[1]}
    foreach($spell in @(1002,1003,1005,1006)){Exec "INSERT INTO [КомпонентыЗаклинаний] ([ЗаклинаниеID],[ВидКомпонентаID]) VALUES ($spell,3)"}
    Exec "INSERT INTO [ГруппыМатериалов] ([ID],[ЗаклинаниеID],[Порядок],[Выбор]) VALUES (6001,1002,1,'все')"
    Exec "INSERT INTO [МатериалыЗаклинаний] ([ГруппаID],[Порядок],[ПредметID],[ТребованиеТекст],[Количество],[ЕдиницаID],[МинимумПредметаММ],[СпособРасходаID]) VALUES (6001,1,5001,'Жемчужина с минимальной стоимостью',1,1,10000,2)"
    Exec "INSERT INTO [МатериалыЗаклинаний] ([ГруппаID],[Порядок],[ПредметID],[ТребованиеТекст],[Количество],[ЕдиницаID],[СпособРасходаID]) VALUES (6001,2,5002,'Перо совы',1,1,2)"
    Exec "INSERT INTO [ГруппыМатериалов] ([ID],[ЗаклинаниеID],[Порядок],[Выбор],[МинимумГруппыММ]) VALUES (6002,1003,1,'все',30000)"
    Exec "INSERT INTO [МатериалыЗаклинаний] ([ГруппаID],[Порядок],[ПредметID],[ТребованиеТекст],[СпособРасходаID]) VALUES (6002,1,5003,'Набор алмазов с общей минимальной стоимостью',3)"
    Exec "INSERT INTO [ГруппыМатериалов] ([ID],[ЗаклинаниеID],[Порядок],[Выбор]) VALUES (6003,1005,1,'все')"
    Exec "INSERT INTO [МатериалыЗаклинаний] ([ГруппаID],[Порядок],[ПредметID],[ТребованиеТекст],[МинимумПредметаММ],[СпособРасходаID]) VALUES (6003,1,5003,'Алмаз с минимальной стоимостью',5000,2)"
    Exec "INSERT INTO [ГруппыМатериалов] ([ID],[ЗаклинаниеID],[Порядок],[Выбор]) VALUES (6004,1006,1,'один из')"
    foreach($entry in @(@(1,5004,'Кусочек фосфора'),@(2,5005,'Светлячок'))){Exec "INSERT INTO [МатериалыЗаклинаний] ([ГруппаID],[Порядок],[ПредметID],[ТребованиеТекст],[СпособРасходаID]) VALUES (6004,$($entry[0]),$($entry[1]),'$($entry[2])',2)"}
    Check 'Два обязательных материала в одной группе' ((Scalar 'SELECT COUNT(*) FROM [МатериалыЗаклинаний] WHERE [ГруппаID]=6001') -eq 2)
    Check 'Один предмет имеет разные цену требования и расход в разных заклинаниях' ((Scalar 'SELECT COUNT(*) FROM [МатериалыЗаклинаний] WHERE [ПредметID]=5003') -eq 2)
    Check 'Минимум на весь набор не приписан каждому алмазу' ((Scalar 'SELECT [МинимумГруппыММ] FROM [ГруппыМатериалов] WHERE [ID]=6002') -eq 30000)
    Check 'Альтернативные материалы поддерживаются' ((Scalar "SELECT COUNT(*) FROM [ГруппыМатериалов] WHERE [ID]=6004 AND [Выбор]='один из'") -eq 1)
    Exec "INSERT INTO [МатериалыЗаклинаний] ([ГруппаID],[Порядок],[ТребованиеТекст]) VALUES (6004,3,'Ещё не проверенное требование')"
    Check 'Непроверенный расход не превращается в отсутствие расхода' ((Scalar 'SELECT [СпособРасходаID] FROM [МатериалыЗаклинаний] WHERE [ГруппаID]=6004 AND [Порядок]=3') -eq 1)
    Exec 'DELETE FROM [МатериалыЗаклинаний] WHERE [ГруппаID]=6004 AND [Порядок]=3'
    Reject 'Отрицательное количество материала запрещено' "INSERT INTO [МатериалыЗаклинаний] ([ГруппаID],[Порядок],[ТребованиеТекст],[Количество],[ЕдиницаID]) VALUES (6004,3,'Ошибка',-1,1)"
    foreach($query in $schema.queries){
        $rs=$db.QueryDefs.Item([string]$query.name).OpenRecordset(4)
        $rs.Close();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($rs)
        Check ('Запрос на временных примерах: '+$query.name) $true
    }
} finally {
    if($null -ne $db){$db.Close();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($db)}
    if($null -ne $workspace){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($workspace)}
    if($null -ne $engine){[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($engine)}
    [GC]::Collect();[GC]::WaitForPendingFinalizers()
    # Only the explicitly created disposable file may be removed, never the review/original database.
    $resolvedTest=[IO.Path]::GetFullPath($testPath)
    $resolvedDirectory=[IO.Path]::GetFullPath($testDirectory)+[IO.Path]::DirectorySeparatorChar
    if(-not $resolvedTest.StartsWith($resolvedDirectory,[StringComparison]::OrdinalIgnoreCase)){throw 'Unexpected test path'}
    if(Test-Path -LiteralPath $resolvedTest){Remove-Item -LiteralPath $resolvedTest}
}
if($ExpectedOriginalHash){
    $originalHash=(Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $root 'dnd database.accdb')).Hash
    Check 'Исходный файл пользователя не изменён' ($originalHash -eq $ExpectedOriginalHash)
}
$report=@{date=(Get-Date).ToString('yyyy-MM-dd');status='passed';database=$DatabasePath;allPassed=$true;checks=$checks;fixtureSpellCount=9;fixturesPersisted=$false}
$report | ConvertTo-Json -Depth 6 | Set-Content -Encoding UTF8 -LiteralPath $reportPath
@{allPassed=$true;checks=$checks.Count;fixtureSpells=9;fixturesPersisted=$false;report=$reportPath} | ConvertTo-Json
