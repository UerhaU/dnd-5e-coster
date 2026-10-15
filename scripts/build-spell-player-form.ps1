param([string]$DatabasePath='')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
if(-not $DatabasePath){$DatabasePath=Join-Path $root 'database\spells\work\spells-demo-building.accdb'}
$exportDirectory=Join-Path $root 'database\spells\form-source'
New-Item -ItemType Directory -Path $exportDirectory -Force|Out-Null
$app=$null;$db=$null
function Color([int]$r,[int]$g,[int]$b){return $r+256*$g+65536*$b}
$ink=Color 58 48 39;$muted=Color 106 97 85;$paper=Color 248 245 238;$accent=Color 73 55 40

function Label($Form,[string]$Name,[string]$Caption,[int]$X,[int]$Y,[int]$W,[int]$H,[int]$Size=10){
    $control=[pscustomobject]@{Kind='Label';Name=$Name;Caption=$Caption;Left=$X;Top=$Y;Width=$W;Height=$H;FontName='Segoe UI';FontSize=$Size;ForeColor=$muted;BackStyle=0;FontBold=$false}
    [void]$Form.Controls.Add($control)
    return ,$control
}
function Text($Form,[string]$Name,[string]$Source,[int]$X,[int]$Y,[int]$W,[int]$H,[int]$Size=11){
    $control=[pscustomobject]@{Kind='TextBox';Name=$Name;ControlSource=$Source;Left=$X;Top=$Y;Width=$W;Height=$H;FontName='Segoe UI';FontSize=$Size;ForeColor=$ink;BackStyle=0;FontBold=$false}
    [void]$Form.Controls.Add($control)
    return ,$control
}
function Begin-Form([string]$Name,[string]$Source,[int]$Width,[int]$Height,[bool]$Continuous=$false){
    $form=[pscustomobject]@{Name=$Name;RecordSource=$Source;Width=$Width;Height=$Height;Continuous=$Continuous;Caption=$Name;Controls=[System.Collections.ArrayList]::new()}
    return ,$form
}
function Quote([string]$Value){return '"'+$Value.Replace('\','\\').Replace('"','\"')+'"'}
function Save-Form($Form,[string]$Name){
    $lines=[System.Collections.Generic.List[string]]::new()
    foreach($line in @('Version =21','VersionRequired =20','Begin Form','    RecordSelectors = NotDefault','    AutoCenter = NotDefault','    NavigationButtons = NotDefault','    AllowDeletions = NotDefault','    DividingLines = NotDefault','    AllowAdditions = NotDefault','    ScrollBars =2')){$lines.Add($line)}
    # Main form must allow the unbound selector to change. Bound text controls stay Locked.
    if($Form.Continuous){$lines.Add('    AllowEdits = NotDefault')}
    $lines.Add('    DefaultView ='+$(if($Form.Continuous){'1'}else{'0'}))
    $lines.Add('    Width ='+$Form.Width)
    $lines.Add('    RecordSource ='+(Quote $Form.RecordSource))
    $lines.Add('    Caption ='+(Quote $Form.Caption))
    $lines.Add('    FitToScreen =1')
    $lines.Add('    Begin');$lines.Add('        Begin Section')
    $lines.Add('            Height ='+$Form.Height)
    $lines.Add('            BackColor ='+$paper)
    $lines.Add('            AlternateBackColor ='+$paper)
    $lines.Add('            Name ="ОбластьДанных"')
    $lines.Add('            Begin')
    foreach($control in $Form.Controls){
        $lines.Add('                Begin '+$control.Kind)
        if($control.Kind -eq 'TextBox'){$lines.Add('                    Locked = NotDefault');$lines.Add('                    TabStop = NotDefault');$lines.Add('                    ScrollBars =2')}
        $lines.Add('                    OldBorderStyle =0')
        foreach($property in @('Name','Left','Top','Width','Height','FontName','FontSize','ForeColor','BackStyle','BackColor','Caption','ControlSource','SourceObject','LinkMasterFields','LinkChildFields','RowSourceType','RowSource','BoundColumn','ColumnCount','DefaultValue','AfterUpdate','ValidationRule','ValidationText')){
            if($control.PSObject.Properties.Name -notcontains $property){continue}
            $value=$control.$property
            # SaveAsText stores this index from zero; the Access COM property starts at one.
            if($property -eq 'BoundColumn'){$value=[int]$value-1}
            if($value -is [string]){$value=Quote $value}
            $lines.Add('                    '+$property+' ='+$value)
        }
        if($control.PSObject.Properties.Name -contains 'FontBold'){$lines.Add('                    FontWeight ='+$(if($control.FontBold){'700'}else{'400'}))}
        if($control.Kind -eq 'ComboBox'){$lines.Add('                    ColumnWidths ="0;11340"');$lines.Add('                    LimitToList = NotDefault');$lines.Add('                    ListRows =12')}
        $lines.Add('                End')
    }
    foreach($line in @('            End','        End','    End','End')){$lines.Add($line)}
    $path=Join-Path $exportDirectory ($Name+'.txt')
    $lines -join "`r`n"|Set-Content -Encoding Unicode -LiteralPath $path
    if(@($app.CurrentProject.AllForms|Where-Object Name -eq $Name).Count){$app.DoCmd.DeleteObject(2,$Name)}
    $app.LoadFromText(2,$Name,$path)
    $app.SaveAsText(2,$Name,(Join-Path $exportDirectory ($Name+'.verified.txt')))
}
function Subform($Form,[string]$Name,[string]$Object,[int]$X,[int]$Y,[int]$W,[int]$H){
    $control=[pscustomobject]@{Kind='Subform';Name=$Name;SourceObject='Form.'+$Object;LinkMasterFields='ID';LinkChildFields='ЗаклинаниеID';Left=$X;Top=$Y;Width=$W;Height=$H}
    [void]$Form.Controls.Add($control)
    return ,$control
}
function Query([string]$Name,[string]$Sql){
    if(@($db.QueryDefs|Where-Object Name -eq $Name).Count){$db.QueryDefs.Delete($Name)}
    $query=$db.CreateQueryDef($Name,$Sql)
    [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($query)
}
try{
    $app=New-Object -ComObject Access.Application
    $app.OpenCurrentDatabase([IO.Path]::GetFullPath($DatabasePath))
    if(@($app.CurrentProject.AllForms|Where-Object Name -eq 'КаталогЗаклинаний').Count){throw 'Форма уже существует. Сборщик создаёт новую форму на подготовленной копии базы и не перезаписывает пользовательские изменения.'}
    $db=$app.CurrentDb()
    Query 'Игрок_Карточка' @'
SELECT s.*, m.[Название] AS [Школа], t.[ИсходныйТекст] AS [ВремяИгрока]
FROM ([Заклинания] AS s INNER JOIN [ШколыМагии] AS m ON s.[ШколаID]=m.[ID])
LEFT JOIN [ВремяНакладывания] AS t ON s.[ID]=t.[ЗаклинаниеID]
WHERE t.[Порядок]=1 ORDER BY s.[Название]
'@
    Query 'Игрок_Доступность' @'
SELECT x.[ЗаклинаниеID], c.[Название] AS [Кому], 'Класс' AS [Категория], b.[Название] AS [Источник], x.[ПравилоДоступа] AS [Условие]
FROM ([КлассыЗаклинаний] AS x INNER JOIN [Классы] AS c ON x.[КлассID]=c.[ID]) INNER JOIN [Источники] AS b ON x.[ИсточникПравилаID]=b.[ID]
UNION ALL
SELECT x.[ЗаклинаниеID], sc.[Название] & ' (' & c.[Название] & ')' AS [Кому], 'Подкласс' AS [Категория], b.[Название] AS [Источник], x.[ПравилоДоступа] AS [Условие]
FROM (([ПодклассыЗаклинаний] AS x INNER JOIN [Подклассы] AS sc ON x.[ПодклассID]=sc.[ID]) INNER JOIN [Классы] AS c ON sc.[КлассID]=c.[ID]) INNER JOIN [Источники] AS b ON x.[ИсточникПравилаID]=b.[ID]
ORDER BY [Категория], [Кому]
'@
    Query 'Игрок_Материалы' @'
SELECT g.[ЗаклинаниеID], r.[Порядок], r.[ТребованиеТекст] AS [Материал], c.[Название] AS [Расход],
IIf(r.[МинимумПредметаММ] Is Null,'Без указанной минимальной стоимости','Минимальная ценность: ' & (r.[МинимумПредметаММ]/100) & ' зм') AS [Стоимость]
FROM ([МатериалыЗаклинаний] AS r INNER JOIN [ГруппыМатериалов] AS g ON r.[ГруппаID]=g.[ID]) INNER JOIN [СпособыРасхода] AS c ON r.[СпособРасходаID]=c.[ID]
ORDER BY g.[ЗаклинаниеID],g.[Порядок],r.[Порядок]
'@
    Query 'Игрок_Эффекты' @'
SELECT x.[ЗаклинаниеID], x.[Порядок], e.[Название] AS [Эффект], k.[Название] AS [ВидРезультата],
IIf(f.[ID] Is Null,'Без броска кубиков',f.[ИсходнаяФормула]) & IIf(d.[ID] Is Null,'',' · ' & d.[Название]) AS [Бросок],
IIf(x.[Воздействие]='спасбросок','Спасбросок: ' & a.[Название] & IIf(x.[ПриУспехе] Is Null,'','; успех — ' & x.[ПриУспехе]),x.[Воздействие]) AS [Применение], e.[Описание] AS [Детали]
FROM (((([ЭффектыЗаклинаний] AS x INNER JOIN [Эффекты] AS e ON x.[ЭффектID]=e.[ID]) INNER JOIN [ВидыЭффектов] AS k ON e.[ВидЭффектаID]=k.[ID]) LEFT JOIN [ФормулыБросков] AS f ON e.[ФормулаID]=f.[ID]) LEFT JOIN [ТипыУрона] AS d ON e.[ТипУронаID]=d.[ID]) LEFT JOIN [Характеристики] AS a ON x.[ХарактеристикаСпасброскаID]=a.[ID]
ORDER BY x.[ЗаклинаниеID],x.[Порядок]
'@
    $macroName='ВыбратьЗаклинание'
    if(@($app.CurrentProject.AllMacros|Where-Object Name -eq $macroName).Count){$app.DoCmd.DeleteObject(4,$macroName)}
    $macroPath=Join-Path $exportDirectory 'ВыбратьЗаклинание.txt'
    Get-Content -Raw -Encoding UTF8 -LiteralPath (Join-Path $root 'database\spells\select-spell.macro.txt')|Set-Content -Encoding Unicode -LiteralPath $macroPath
    $app.LoadFromText(4,$macroName,$macroPath)

    $form=Begin-Form 'ДоступностьДляИгрока' 'Игрок_Доступность' 13400 620 $true
    $c=Text $form 'Кому' '[Кому]' 90 25 5200 285 10;$c.FontBold=$true
    $null=Text $form 'Книга' '[Источник]' 5500 25 7400 285 9
    $null=Text $form 'Условие' '[Условие]' 90 325 12800 260 9
    Save-Form $form 'ДоступностьДляИгрока'

    $form=Begin-Form 'МатериалыДляИгрока' 'Игрок_Материалы' 6400 720 $true
    $c=Text $form 'Материал' '[Материал]' 90 15 6100 335 10;$c.FontBold=$true
    $null=Text $form 'Условия' '=[Расход] & " · " & [Стоимость]' 90 365 6100 310 9
    Save-Form $form 'МатериалыДляИгрока'

    $form=Begin-Form 'ЭффектыДляИгрока' 'Игрок_Эффекты' 6700 1400 $true
    $c=Text $form 'Бросок' '[Бросок]' 90 20 6400 360 14;$c.FontBold=$true
    $null=Text $form 'Применение' '[Применение]' 90 420 6400 430 10
    $null=Text $form 'Детали' '[Детали]' 90 875 6400 475 10
    Save-Form $form 'ЭффектыДляИгрока'

    $form=Begin-Form 'КаталогЗаклинаний' 'Игрок_Карточка' 14700 11880
    $form.Caption='Книга заклинаний · D&D 5e 2014'
    $bar=[pscustomobject]@{Kind='Rectangle';Name='ФонЗаголовка';Left=0;Top=0;Width=14700;Height=720;BackStyle=1;BackColor=$accent}
    [void]$form.Controls.Add($bar)
    $heading=Label $form 'Заголовок' 'КНИГА ЗАКЛИНАНИЙ' 420 130 10500 470 20
    $heading.ForeColor=Color 250 244 228;$heading.FontBold=$true
    $null=Label $form 'ВыборПодпись' 'Выберите заклинание' 450 895 5300 300 10
    $combo=[pscustomobject]@{Kind='ComboBox';Name='ВыборЗаклинания';Left=450;Top=1230;Width=13500;Height=480;RowSourceType='Table/Query';RowSource='';BoundColumn=1;ColumnCount=2;ColumnWidths='0;11340';ListRows=12;LimitToList=$true;AutoExpand=$true;FontName='Segoe UI';FontSize=12;AfterUpdate=$macroName;DefaultValue='';ValidationRule='Is Not Null';ValidationText='Выберите заклинание из списка.'}
    [void]$form.Controls.Add($combo)
    $combo.RowSource='SELECT [ID],[Название] FROM [Заклинания] ORDER BY [Название]'
    $combo.BoundColumn=1;$combo.ColumnCount=2;$combo.ColumnWidths='0cm;20cm'
    $combo.ListRows=12;$combo.LimitToList=$true;$combo.AutoExpand=$true
    $combo.FontName='Segoe UI';$combo.FontSize=12;$combo.AfterUpdate=$macroName
    $first=$db.OpenRecordset('SELECT TOP 1 [ID] FROM [Заклинания] ORDER BY [Название]',4)
    try{$combo.DefaultValue=[string]$first.Fields.Item(0).Value}finally{$first.Close()}
    $c=Text $form 'Название' '[Название]' 450 1930 13500 650 24;$c.FontBold=$true
    $null=Text $form 'Кратко' '=[Уровень] & " уровень · " & [Школа] & IIf([Ритуал]," · Ритуал","") & IIf([Концентрация]," · Концентрация","")' 480 2610 13500 400 11
    $null=Label $form 'ВремяПодпись' 'ВРЕМЯ НАКЛАДЫВАНИЯ' 480 3230 4200 300 9
    $null=Text $form 'Время' '[ВремяИгрока]' 480 3570 4200 640 12
    $null=Label $form 'ДистанцияПодпись' 'ДИСТАНЦИЯ' 5100 3230 4200 300 9
    $null=Text $form 'Дистанция' '[ДистанцияТекст]' 5100 3570 4200 640 12
    $null=Label $form 'ДлительностьПодпись' 'ДЛИТЕЛЬНОСТЬ' 9700 3230 4200 300 9
    $null=Text $form 'Длительность' '[ДлительностьТекст]' 9700 3570 4250 640 11
    $null=Label $form 'КомпонентыПодпись' 'КОМПОНЕНТЫ' 480 4390 13200 300 9
    $null=Text $form 'Компоненты' '[КомпонентыТекст]' 480 4740 13400 650 11
    $null=Label $form 'ОписаниеПодпись' 'ЧТО ПРОИСХОДИТ' 480 5540 13200 300 9
    $null=Text $form 'ОписаниеИгрока' '[Описание]' 480 5900 13400 1400 11
    $null=Label $form 'УсилениеПодпись' 'БОЛЕЕ ВЫСОКАЯ ЯЧЕЙКА' 480 7440 13200 300 9
    $null=Text $form 'Усиление' '[НаВысокихУровнях]' 480 7790 13400 650 11
    $null=Label $form 'ЭффектыПодпись' 'ЭФФЕКТ И БРОСКИ' 480 8600 6500 300 9
    $null=Label $form 'МатериалыПодпись' 'МАТЕРИАЛЫ' 7600 8600 6500 300 9
    $null=Subform $form 'СвязанныеЭффекты' 'ЭффектыДляИгрока' 480 8950 6650 1500
    $null=Subform $form 'СвязанныеМатериалы' 'МатериалыДляИгрока' 7600 8950 6500 1500
    $null=Label $form 'ДоступностьПодпись' 'КЛАССЫ И ПОДКЛАССЫ' 480 10600 13000 300 9
    $null=Subform $form 'СвязаннаяДоступность' 'ДоступностьДляИгрока' 480 10950 13600 1900
    $null=Label $form 'ИсточникПодпись' 'Книга игрока (2014). Краткий пересказ по DnD.su; дополнительные списки помечены источником.' 480 13020 13400 370 9
    $null=Text $form 'СсылкаИсточник' '[АдресDnDSu]' 480 13440 13400 360 9
    $form.Height=13900
    Save-Form $form 'КаталогЗаклинаний'

    try{$db.Properties.Item('StartupForm').Value='КаталогЗаклинаний'}
    catch{$db.Properties.Append($db.CreateProperty('StartupForm',10,'КаталогЗаклинаний'))}
    $app.SaveAsText(4,$macroName,(Join-Path $exportDirectory 'ВыбратьЗаклинание.verified.txt'))
    $db.Close();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($db);$db=$null
    $app.CloseCurrentDatabase()
    @{Forms=4;Selector='ВыборЗаклинания';SelectionAction='SearchForRecord';VbaModules=0;Database=$DatabasePath}|ConvertTo-Json
}finally{
    if($null -ne $db){try{$db.Close()}catch{};[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($db)}
    if($null -ne $app){$app.Quit(2);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($app)}
}
