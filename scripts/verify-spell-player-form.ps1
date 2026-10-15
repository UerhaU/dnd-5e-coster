param([string]$DatabasePath='')
$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
if(-not $DatabasePath){$DatabasePath=Join-Path $root 'База заклинаний.accdb'}
$reportPath=Join-Path $root 'database\spells\player-form-verification.json'
@{status='running';passed=$false;database=$DatabasePath}|ConvertTo-Json|Set-Content -Encoding UTF8 -LiteralPath $reportPath
$app=$null;$db=$null;$checks=[Collections.Generic.List[object]]::new();$cards=[Collections.Generic.List[object]]::new()
function Check([string]$Name,[bool]$Passed,$Detail=''){
    $checks.Add(@{name=$Name;passed=$Passed;detail=$Detail})
    if(-not $Passed){throw "Не пройдена проверка: $Name. $Detail"}
}
function Child-Count($Form,[string]$Control){
    $rs=$Form.Controls.Item($Control).Form.RecordsetClone
    try{if($rs.RecordCount -eq 0){return 0};$rs.MoveLast();return [int]$rs.RecordCount}
    finally{$rs=$null}
}
function Select-Spell($Form,[int]$Id){
    $selector=$Form.Controls.Item('ВыборЗаклинания')
    $row=-1
    for($index=0;$index -lt $selector.ListCount;$index++){
        if([string]$selector.Column(0,$index) -eq [string]$Id){$row=$index;break}
    }
    Check ('Заклинание есть в списке: '+$Id) ($row -ge 0)
    # Use the actual bound list value, as Access does when a row is selected.
    $selector.Value=$selector.ItemData($row)
    $selector.SetFocus()
    $display=[string]$selector.Text
    Check ('В поле показано название: '+$Id) ($selector.ListIndex -eq $row -and $display -eq [string]$selector.Column(1,$row)) $display
    Check ('Выбор передаёт ID: '+$Id) ([string]$selector.Value -eq [string]$Id) $selector.Value
    # COM assignment does not fire AfterUpdate; run the action registered on the control.
    $app.DoCmd.RunMacro([string]$selector.AfterUpdate)
    $Form.Recalc()
}
try{
    $app=New-Object -ComObject Access.Application
    $app.OpenCurrentDatabase([IO.Path]::GetFullPath($DatabasePath))
    $db=$app.CurrentDb()
    if(-not @($app.Forms|Where-Object Name -eq 'КаталогЗаклинаний').Count){$app.DoCmd.OpenForm('КаталогЗаклинаний',0)}
    $form=$app.Forms.Item('КаталогЗаклинаний')
    Check 'Основная форма открылась' ($form.Name -eq 'КаталогЗаклинаний')
    Check 'Выбор разрешён, добавление и удаление запрещены' ($form.AllowEdits -and -not $form.AllowAdditions -and -not $form.AllowDeletions)
    $editableBoundControls=@($form.Controls|Where-Object {$_.ControlType -in @(106,107,109,110,111) -and $_.ControlSource -and -not $_.Locked})
    Check 'Все поля карточки защищены от редактирования' ($editableBoundControls.Count -eq 0)
    foreach($subformName in @('СвязанныеЭффекты','СвязанныеМатериалы','СвязаннаяДоступность')){
        $child=$form.Controls.Item($subformName).Form
        Check ('Подформа защищена: '+$subformName) (-not $child.AllowEdits -and -not $child.AllowAdditions -and -not $child.AllowDeletions)
    }
    Check 'Выбор связан с действием поиска' ($form.Controls.Item('ВыборЗаклинания').AfterUpdate -eq 'ВыбратьЗаклинание')
    $selector=$form.Controls.Item('ВыборЗаклинания')
    Check 'Список выбора не привязан к полю записи' ([string]::IsNullOrEmpty([string]$selector.ControlSource))
    Check 'Список связан со столбцом ID' ($selector.BoundColumn -eq 1) $selector.BoundColumn
    Check 'ID скрыт, название доступно' ($selector.ColumnCount -eq 2 -and $selector.ColumnWidths -match '^0;' -and $selector.Enabled -and -not $selector.Locked)
    $selector.SetFocus()
    Check 'При открытии показано название текущей карточки' ($selector.ListIndex -ge 0 -and [string]$selector.Text -eq [string]$form.Controls.Item('Название').Value) ([string]$selector.Text)
    Check 'Не требуется VBA-модуль' ($app.CurrentProject.AllModules.Count -eq 0)
    $expected=@(
        @{ID=10001;Name='Огненный шар';Classes=7;Materials=2;Text='8к6';Ritual=$false;Concentration=$false},
        @{ID=10002;Name='Лечение ран';Classes=10;Materials=0;Text='1к8';Ritual=$false;Concentration=$false},
        @{ID=10003;Name='Опознание';Classes=5;Materials=2;Text='Без броска';Ritual=$true;Concentration=$false},
        @{ID=10004;Name='Благословение';Classes=4;Materials=1;Text='1к4';Ritual=$false;Concentration=$true}
    )
    foreach($spell in $expected){
        Select-Spell $form ([int]$spell.ID)
        # Access refreshes linked subforms on its next message cycle; allow a bounded settle.
        for($attempt=0;$attempt -lt 8;$attempt++){
            if((Child-Count $form 'СвязанныеМатериалы') -eq $spell.Materials){break}
            Start-Sleep -Milliseconds 125
        }
        $name=[string]$form.Controls.Item('Название').Value
        $description=[string]$form.Controls.Item('ОписаниеИгрока').Value
        $components=[string]$form.Controls.Item('Компоненты').Value
        $effects=$form.Controls.Item('СвязанныеЭффекты').Form
        $roll=[string]$effects.Controls.Item('Бросок').Value
        $classes=Child-Count $form 'СвязаннаяДоступность'
        $materials=Child-Count $form 'СвязанныеМатериалы'
        Check ($spell.Name+': выбран нужный заголовок') ($name -eq $spell.Name) $name
        Check ($spell.Name+': описание заполнено') ($description.Length -gt 60 -and $description -notmatch '^#')
        Check ($spell.Name+': параметры заполнены') ($components.Length -gt 0 -and [string]$form.Controls.Item('Время').Value -ne '' -and [string]$form.Controls.Item('Дистанция').Value -ne '' -and [string]$form.Controls.Item('Длительность').Value -ne '')
        Check ($spell.Name+': связанный эффект обновился') ($roll.Contains($spell.Text)) $roll
        Check ($spell.Name+': классы и подклассы отфильтрованы') ($classes -eq $spell.Classes) $classes
        Check ($spell.Name+': материалы отфильтрованы') ($materials -eq $spell.Materials) $materials
        if($materials -gt 0){
            $materialText=[string]$form.Controls.Item('СвязанныеМатериалы').Form.Controls.Item('Условия').Value
            Check ($spell.Name+': расход и стоимость читаются') ($materialText.Length -gt 10 -and $materialText -notmatch '^#') $materialText
        }
        $record=$form.RecordsetClone
        try{$record.Bookmark=$form.Bookmark;Check ($spell.Name+': признаки ритуала и концентрации') ([bool]$record.Fields.Item('Ритуал').Value -eq $spell.Ritual -and [bool]$record.Fields.Item('Концентрация').Value -eq $spell.Concentration)}
        finally{$record=$null}
        $cards.Add(@{id=$spell.ID;name=$name;roll=$roll;classRows=$classes;materialRows=$materials;descriptionLength=$description.Length})
    }
    # Go back to a previously displayed spell: no residual rows from the last selection.
    Select-Spell $form 10002
    Check 'При возврате к лечению нет чужих материалов' ((Child-Count $form 'СвязанныеМатериалы') -eq 0)
    Check 'Источник доступен из карточки' ([string]$form.Controls.Item('СсылкаИсточник').Value -eq 'https://5e14.dnd.su/spells/145-cure-wounds/')
    foreach($id in @(10003,10001,10004,10002)){
        $spell=@($expected|Where-Object ID -eq $id)[0]
        Select-Spell $form ([int]$id)
        Check ('Повторный порядок: '+$spell.Name) ([string]$form.Controls.Item('Название').Value -eq $spell.Name -and (Child-Count $form 'СвязанныеМатериалы') -eq $spell.Materials -and (Child-Count $form 'СвязаннаяДоступность') -eq $spell.Classes)
    }
    $allControls=@($form.Controls)
    $outside=@($allControls|Where-Object {($_.Left + $_.Width) -gt $form.Width -or ($_.Top + $_.Height) -gt $form.Section(0).Height})
    Check 'Все элементы внутри границ формы' ($outside.Count -eq 0)
    $idControls=@($allControls|Where-Object {$_.ControlType -eq 109 -and $_.Visible -and $_.ControlSource -match '^\[?(ID|Код|Ревизия|СтатусПроверки)\]?$'})
    Check 'Технические ключи не показаны игроку' ($idControls.Count -eq 0)
    $db.Close();[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($db);$db=$null
    $app.CloseCurrentDatabase()
}catch{
    @{status='failed';passed=$false;database=$DatabasePath;error=$_.Exception.Message;checks=$checks}|ConvertTo-Json -Depth 6|Set-Content -Encoding UTF8 -LiteralPath $reportPath
    throw
}finally{
    if($null -ne $db){try{$db.Close()}catch{};[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($db)}
    if($null -ne $app){$app.Quit(2);[void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($app)}
}
$report=@{status='passed';passed=$true;database=$DatabasePath;checks=$checks;cards=$cards;computerUseActions=0;visualUiCheck=$false;verifiedAt=(Get-Date).ToString('o')}
$report|ConvertTo-Json -Depth 7|Set-Content -Encoding UTF8 -LiteralPath $reportPath
@{passed=$true;checks=$checks.Count;spells=$cards.Count;computerUseActions=0;report=$reportPath}|ConvertTo-Json
