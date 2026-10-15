"""Define the reviewable Access spell catalog; no game records are imported."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'database' / 'spells'
OUT.mkdir(parents=True, exist_ok=True)
tables: list[dict] = []


def f(name, technical, kind='text', *, required=False, size=255,
      default=None, rule=None, note=''):
    return dict(name=name, technical=technical, type=kind, required=required,
                size=size, default=default, rule=rule, description=note)


def ref(name, technical, parent, *, required=False, note=''):
    field = f(name, technical, 'long', required=required, note=note)
    field['references'] = parent
    return field


def table(name, technical, description, fields, *, unique=(), rule=None,
          seeds=None, lookup_name=None):
    item = dict(name=name, technical=technical, description=description,
                fields=[f('ID', 'id', 'counter', note='Внутренний ключ записи.')] + fields,
                unique=[list(x) for x in unique], rule=rule, seeds=seeds or [],
                lookupName=lookup_name)
    tables.append(item)
    return item


def dictionary(name, technical, description, rows, extra=()):
    seeds = []
    for index, row in enumerate(rows, 1):
        seeds.append(dict(ID=index, Код=row[0], Название=row[1], Описание=row[2] if len(row)>2 else ''))
    return table(name, technical, description,
                 [f('Код','code',required=True,size=64), f('Название','name_ru',required=True,size=150),
                  f('Описание','description','memo')] + list(extra),
                 unique=[['Код']], seeds=seeds, lookup_name='Название')


dictionary('Редакции','editions','Совместимость записи с редакцией; не степень автоматизации.',[
    ('5e_2014','D&D 5e 2014'),('5e_2024','D&D 2024'),
    ('universal_5e_2014_2024','Совместимо с 2014 и 2024'),
    ('unknown','Редакция не определена'),('conflict','Конфликт редакций')])
dictionary('ШколыМагии','magic_schools','Школа магии, а не тип урона.',[
    ('abjuration','Ограждение'),('conjuration','Вызов'),('divination','Прорицание'),
    ('enchantment','Очарование'),('evocation','Воплощение'),('illusion','Иллюзия'),
    ('necromancy','Некромантия'),('transmutation','Преобразование')])
dictionary('ТипыДействий','action_types','Стоимость накладывания в экономике действий.',[
    ('action','Действие'),('bonus_action','Бонусное действие'),('reaction','Реакция'),
    ('special','Особое')])
dictionary('ЕдиницыВремени','time_units','Единицы для времени накладывания и длительности.',[
    ('round','Раунд'),('turn','Ход'),('minute','Минута'),('hour','Час'),
    ('day','День'),('year','Год')])
dictionary('ВидыДистанции','range_types','Способ задания дальности; область хранится отдельно.',[
    ('self','На себя'),('touch','Касание'),('distance','Расстояние в футах'),
    ('sight','В пределах видимости'),('unlimited','Неограниченная'),('special','Особая')])
dictionary('ВидыДлительности','duration_types','Способ завершения эффекта; точное условие хранится текстом.',[
    ('instant','Мгновенная'),('timed','Ограниченное время'),('dispelled','Пока не рассеяно'),
    ('dismissed','Пока не прекращено'),('trigger','До события'),('special','Особая')])
dictionary('ВидыКомпонентов','component_types','В/С/М не являются продаваемыми предметами.',[
    ('V','Вербальный'),('S','Соматический'),('M','Материальный')])
dictionary('Классы','classes','Справочник обычных игровых классов; доступ к конкретному заклинанию задаётся связью.',[
    ('bard','Бард'),('barbarian','Варвар'),('fighter','Воин'),('wizard','Волшебник'),
    ('druid','Друид'),('cleric','Жрец'),('artificer','Изобретатель'),('warlock','Колдун'),
    ('monk','Монах'),('paladin','Паладин'),('rogue','Плут'),('ranger','Следопыт'),('sorcerer','Чародей')])
table('Подклассы','subclasses','Подклассы добавляются при заполнении каталога.',[
    f('Код','code',required=True,size=120), f('Название','name_ru',required=True,size=180),
    ref('КлассID','class_id','Классы',required=True),f('Описание','description','memo')],
    unique=[['Код']],lookup_name='Название')
dictionary('ТипыУрона','damage_types','Общие для заклинаний, будущего оружия и других эффектов.',[
    ('acid','Кислота'),('bludgeoning','Дробящий'),('cold','Холод'),('fire','Огонь'),
    ('force','Силовое поле'),('lightning','Электричество'),('necrotic','Некротическая энергия'),
    ('piercing','Колющий'),('poison','Яд'),('psychic','Психическая энергия'),
    ('radiant','Излучение'),('slashing','Рубящий'),('thunder','Звук')])
dice = dictionary('Кубики','dice','Только тип кубика. Количество и прибавки принадлежат формуле.',
    [(f'd{n}',f'к{n}') for n in (4,6,8,10,12,20,100)],
    extra=[f('Граней','sides','long',required=True,rule='>1')])
for row, sides in zip(dice['seeds'],(4,6,8,10,12,20,100)):
    row['Граней']=sides
dictionary('ВидыЭффектов','effect_types','Один эффект описывает один результат; у заклинания их может быть несколько.',[
    ('damage','Урон'),('healing','Лечение'),('temporary_hp','Временные хиты'),
    ('condition','Состояние'),('modifier','Изменение показателя'),('summoning','Призыв'),
    ('creation','Создание'),('control','Контроль'),('information','Получение информации'),('other','Другое'),
    ('resistance','Сопротивление урону')])
dictionary('Характеристики','abilities','Для спасбросков и явных модификаторов формулы.',[
    ('strength','Сила'),('dexterity','Ловкость'),('constitution','Телосложение'),
    ('intelligence','Интеллект'),('wisdom','Мудрость'),('charisma','Харизма')])
dictionary('ФормыОбласти','area_shapes','Геометрия области, не дистанция до её центра.',[
    ('sphere','Сфера'),('cube','Куб'),('cone','Конус'),('line','Линия'),
    ('cylinder','Цилиндр'),('circle','Круг'),('square','Квадрат'),('special','Особая')])
dictionary('Состояния','conditions','Справочник имён состояний; сложные правила остаются в описании эффекта.',[
    ('blinded','Ослеплённый'),('charmed','Очарованный'),('deafened','Оглохший'),
    ('frightened','Испуганный'),('grappled','Схваченный'),('incapacitated','Недееспособный'),
    ('invisible','Невидимый'),('paralyzed','Парализованный'),('petrified','Окаменевший'),
    ('poisoned','Отравленный'),('prone','Сбитый с ног'),('restrained','Опутанный'),
    ('stunned','Ошеломлённый'),('unconscious','Бессознательный'),('exhaustion','Истощение')])
dictionary('ЕдиницыКоличества','quantity_units','Единица запаса или требования; не выдумывает количество из описания.',[
    ('piece','Штука'),('pinch','Щепотка'),('drop','Капля'),('ounce','Унция'),
    ('pound','Фунт'),('handful','Горсть'),('portion','Порция'),('set','Набор')])
dictionary('СпособыРасхода','consumption_modes','Отделяет отсутствие проверки от явно подтверждённого расхода/сохранения.',[
    ('unknown','Не проверено'),('not_consumed','Не расходуется'),('consumed','Расходуется'),
    ('partial','Расходуется частично'),('conditional','Расходуется при условии')])

table('Источники','sources','Книги/источники DnD.su, не локальные PDF.',[
    f('Код','code',required=True,size=120),f('Название','name_ru',required=True,size=200),
    f('НазваниеОригинал','name_original',size=200),ref('РедакцияID','edition_id','Редакции',required=True),
    f('Адрес','url',size=255),f('Примечания','notes','memo')],unique=[['Код']],lookup_name='Название',seeds=[
    {'ID':1,'Код':'PHB_2014','Название':'Книга игрока (2014)','НазваниеОригинал':"Player's Handbook (2014)",'РедакцияID':1},
    {'ID':2,'Код':'TCE_2014','Название':'Котёл Таши со всякой всячиной','НазваниеОригинал':"Tasha's Cauldron of Everything",'РедакцияID':1}])

MONEY='Is Null Or (>=0 And =Fix([%s]))'
def money(name,technical,note):
    return f(name,technical,'currency',rule=MONEY%name,note=note+' Целое число медных монет; неизвестное — пусто.')

table('Предметы','items','Единый будущий каталог предметов и товаров; свойства использования задаются отдельно.',[
    f('Код','code',required=True,size=120),f('Название','name_ru',required=True,size=200),
    f('Описание','description','memo'),ref('ЕдиницаID','unit_id','ЕдиницыКоличества'),
    money('ЦенаММ','price_cp','Базовая цена, не минимальная стоимость компонента.'),
    f('ВесФунты','weight_lb','double',rule='Is Null Or >=0',note='Неизвестный вес оставляется пустым.'),
    f('Примечания','notes','memo')],unique=[['Код']],lookup_name='Название')

table('ФормулыБросков','roll_formulas','Переиспользуемый бросок. Его слагаемые структурированы и не исполняются как код.',[
    f('Код','code',required=True,size=120),f('Название','name_ru',required=True,size=180),
    f('ИсходнаяФормула','source_expression',size=255),f('ОсобыеПравила','special_rules','memo')],
    unique=[['Код']],lookup_name='Название')
table('СлагаемыеБросков','roll_terms','Кубики, константы и модификаторы одной формулы.',[
    ref('ФормулаID','formula_id','ФормулыБросков',required=True),
    f('Порядок','ordinal','long',required=True,rule='>0'),
    f('Вид','kind',required=True,size=40,rule='In ("кубики","константа","модификатор","мастерство")'),
    ref('КубикID','die_id','Кубики'),f('КоличествоКубиков','dice_count','long',rule='Is Null Or >0'),
    f('Константа','constant_value','long'),ref('ХарактеристикаID','ability_id','Характеристики'),
    f('МодификаторЗаклинателя','use_spellcasting_ability','boolean',required=True,default='False'),
    f('Коэффициент','coefficient','long',required=True,default='1',rule='<>0'),
    f('Примечания','notes','memo')],unique=[['ФормулаID','Порядок']],rule=(
    '([Вид]="кубики" And [КубикID] Is Not Null And [КоличествоКубиков] Is Not Null And [Константа] Is Null And [ХарактеристикаID] Is Null And [МодификаторЗаклинателя]=False) Or '
    '([Вид]="константа" And [Константа] Is Not Null And [КубикID] Is Null And [КоличествоКубиков] Is Null And [ХарактеристикаID] Is Null And [МодификаторЗаклинателя]=False) Or '
    '([Вид]="модификатор" And [КубикID] Is Null And [КоличествоКубиков] Is Null And [Константа] Is Null And (([ХарактеристикаID] Is Not Null And [МодификаторЗаклинателя]=False) Or ([ХарактеристикаID] Is Null And [МодификаторЗаклинателя]=True))) Or '
    '([Вид]="мастерство" And [КубикID] Is Null And [КоличествоКубиков] Is Null And [Константа] Is Null And [ХарактеристикаID] Is Null And [МодификаторЗаклинателя]=False)'))

table('Заклинания','spells','Ревизии заклинаний. Код стабилен, ревизия меняется при изменении механики.',[
    f('Код','canonical_id',required=True,size=160),f('Ревизия','revision','long',required=True,default='1',rule='>0'),
    f('Название','name_ru',required=True,size=200),f('НазваниеОригинал','name_original',size=200),
    f('ДругиеНазвания','aliases','memo'),f('Уровень','level','long',required=True,rule='Between 0 And 9',note='0 — заговор; уровень не является отдельным справочником.'),
    ref('ШколаID','school_id','ШколыМагии',required=True),ref('РедакцияID','edition_id','Редакции',required=True),
    f('Ритуал','is_ritual','boolean',required=True,default='False'),
    f('Концентрация','requires_concentration','boolean',required=True,default='False'),
    ref('ВидДистанцииID','range_type_id','ВидыДистанции',required=True),
    f('ДистанцияФуты','range_ft','double',rule='Is Null Or >=0'),f('ДистанцияТекст','range_text','memo'),
    ref('ВидДлительностиID','duration_type_id','ВидыДлительности',required=True),
    f('ДлительностьЧисло','duration_value','double',rule='Is Null Or >0'),
    ref('ЕдиницаДлительностиID','duration_unit_id','ЕдиницыВремени'),
    f('ДлительностьТекст','duration_text','memo',note='Сохраняет точный момент окончания и особые условия.'),
    f('КомпонентыТекст','components_text','memo'),f('ЦелиТекст','targets_text','memo'),
    f('Описание','description','memo'),f('НаВысокихУровнях','higher_levels_text','memo'),
    f('АдресDnDSu','source_url',size=255),f('IDНаСайте','site_id',size=80),
    f('СтатусПроверки','review_status',required=True,size=40,default='"черновик"',rule='In ("черновик","требует проверки","проверено")'),
    f('ПровереноДата','reviewed_at','datetime'),f('Примечания','notes','memo')],
    unique=[['Код','Ревизия']],lookup_name='Название')

table('ВремяНакладывания','spell_casting_times','Разделяет действие/реакцию и длительное накладывание; допускает варианты.',[
    ref('ЗаклинаниеID','spell_id','Заклинания',required=True),f('Порядок','ordinal','long',required=True,rule='>0'),
    ref('ДействиеID','action_type_id','ТипыДействий'),f('КоличествоДействий','action_count','long',rule='Is Null Or >0'),
    f('ВремяЧисло','time_value','double',rule='Is Null Or >0'),ref('ЕдиницаВремениID','time_unit_id','ЕдиницыВремени'),
    f('УсловиеРеакции','reaction_trigger','memo'),f('ИсходныйТекст','source_text','memo')],
    unique=[['ЗаклинаниеID','Порядок']],rule=(
    '([ДействиеID] Is Not Null And [КоличествоДействий] Is Not Null And [ВремяЧисло] Is Null And [ЕдиницаВремениID] Is Null) Or '
    '([ДействиеID] Is Null And [КоличествоДействий] Is Null And [ВремяЧисло] Is Not Null And [ЕдиницаВремениID] Is Not Null) Or '
    '([ДействиеID] Is Null And [КоличествоДействий] Is Null And [ВремяЧисло] Is Null And [ЕдиницаВремениID] Is Null And [ИсходныйТекст] Is Not Null)'))

for name,technical,target,column,technical_column in (
    ('КлассыЗаклинаний','spell_classes','Классы','КлассID','class_id'),
    ('ПодклассыЗаклинаний','spell_subclasses','Подклассы','ПодклассID','subclass_id')):
    table(name,technical,'Доступность с указанием источника/условия; не выдаёт заклинание персонажу сама по себе.',[
        ref('ЗаклинаниеID','spell_id','Заклинания',required=True),ref(column,technical_column,target,required=True),
        ref('ИсточникПравилаID','rule_source_id','Источники',required=True),
        f('ПравилоДоступа','access_rule','memo'),f('Примечания','notes','memo')],
        unique=[['ЗаклинаниеID',column,'ИсточникПравилаID']])
table('ИсточникиЗаклинаний','spell_sources','Все подтверждённые источники одной ревизии.',[
    ref('ЗаклинаниеID','spell_id','Заклинания',required=True),ref('ИсточникID','source_id','Источники',required=True),
    f('Страница','page_reference',size=80),f('Адрес','url',size=255),f('Примечания','notes','memo')],
    unique=[['ЗаклинаниеID','ИсточникID']])
table('КомпонентыЗаклинаний','spell_components','Отдельная строка для В, С и М.',[
    ref('ЗаклинаниеID','spell_id','Заклинания',required=True),ref('ВидКомпонентаID','component_type_id','ВидыКомпонентов',required=True)],
    unique=[['ЗаклинаниеID','ВидКомпонентаID']])
table('ГруппыМатериалов','spell_material_groups','Группы соединяются И; внутри группы — все предметы или один из вариантов.',[
    ref('ЗаклинаниеID','spell_id','Заклинания',required=True),f('Порядок','ordinal','long',required=True,rule='>0'),
    f('Выбор','selection_mode',required=True,size=25,default='"все"',rule='In ("все","один из")'),
    money('МинимумГруппыММ','minimum_group_value_cp','Стоимость всего набора, например нескольких алмазов вместе.'),
    f('Описание','description','memo')],unique=[['ЗаклинаниеID','Порядок']])
table('МатериалыЗаклинаний','spell_material_requirements','Требование к предмету в конкретном заклинании, не характеристика товара вообще.',[
    ref('ГруппаID','group_id','ГруппыМатериалов',required=True),f('Порядок','ordinal','long',required=True,rule='>0'),
    ref('ПредметID','item_id','Предметы'),f('ТребованиеТекст','requirement_text','memo',required=True),
    f('Количество','quantity','double',rule='Is Null Or >0'),ref('ЕдиницаID','unit_id','ЕдиницыКоличества'),
    money('МинимумПредметаММ','minimum_item_value_cp','Минимальная стоимость подходящего предмета, а не цена покупки.'),
    dict(ref('СпособРасходаID','consumption_mode_id','СпособыРасхода',required=True,
             note='Не проверено, не расходуется, расходуется, частично или при условии. Цена не определяет расход.'),default='1'),
    f('РасходКоличество','consumed_quantity','double',rule='Is Null Or >0'),
    f('УсловиеРасхода','consumption_condition','memo'),f('ОсобыеТребования','special_requirements','memo')],
    unique=[['ГруппаID','Порядок']],rule='([Количество] Is Null And [ЕдиницаID] Is Null) Or ([Количество] Is Not Null And [ЕдиницаID] Is Not Null)')

table('Эффекты','effects','Переиспользуемые шаблоны результата для заклинаний и будущих предметов/оружия.',[
    f('Код','code',required=True,size=120),f('Название','name_ru',required=True,size=200),
    ref('ВидЭффектаID','effect_type_id','ВидыЭффектов',required=True),ref('ФормулаID','roll_formula_id','ФормулыБросков'),
    ref('ТипУронаID','damage_type_id','ТипыУрона'),f('ВыборТипаУрона','choose_damage_type','boolean',required=True,default='False'),
    ref('СостояниеID','condition_id','Состояния'),f('ИзменяемыйПоказатель','modified_stat',size=120),
    f('Описание','description','memo'),f('Автоматизация','automation',required=True,size=30,default='"справочно"',
      rule='In ("справочно","с подтверждением","полностью")'),f('Примечания','notes','memo')],
    unique=[['Код']],lookup_name='Название',
    rule='([ВыборТипаУрона]=False) Or ([ВыборТипаУрона]=True And [ТипУронаID] Is Null)')
table('ВариантыУронаЭффекта','effect_damage_choices','Разрешённые типы при выборе; несколько строк — альтернативы, не одновременный урон.',[
    ref('ЭффектID','effect_id','Эффекты',required=True),ref('ТипУронаID','damage_type_id','ТипыУрона',required=True)],
    unique=[['ЭффектID','ТипУронаID']])
table('ВыборыЭффектовЗаклинаний','spell_effect_choices','Независимые группы выбора варианта; выбранный вариант может включать несколько результатов.',[
    ref('ЗаклинаниеID','spell_id','Заклинания',required=True),f('Код','code',required=True,size=100),
    f('Название','name_ru',required=True,size=180),f('Описание','description','memo')],
    unique=[['ЗаклинаниеID','Код']],lookup_name='Название')
table('ВариантыЭффектовЗаклинаний','spell_effect_options','Внутри одного выбора используется один вариант; все его связанные эффекты действуют вместе.',[
    ref('ВыборID','choice_id','ВыборыЭффектовЗаклинаний',required=True),f('Код','code',required=True,size=100),
    f('Название','name_ru',required=True,size=180),f('Описание','description','memo')],
    unique=[['ВыборID','Код']],lookup_name='Название')
table('ЭффектыЗаклинаний','spell_effects','Связь заклинания с результатом и контекстом применения.',[
    ref('ЗаклинаниеID','spell_id','Заклинания',required=True),ref('ЭффектID','effect_id','Эффекты',required=True),
    f('Порядок','ordinal','long',required=True,rule='>0'),
    f('Воздействие','resolution_type',required=True,size=40,default='"особое"',
      rule='In ("автоматически","рукопашная атака","дальнобойная атака","спасбросок","проверка","особое")'),
    ref('ХарактеристикаСпасброскаID','save_ability_id','Характеристики'),
    f('ПриУспехе','on_success',size=80,note='Например: половина урона. Не предполагается автоматически.'),
    f('УсловиеПрименения','application_condition','memo'),f('МоментСрабатывания','trigger_timing','memo'),
    ref('ВариантID','option_id','ВариантыЭффектовЗаклинаний',note='Пусто — общий эффект. Непусто — часть выбранного набора результатов; принадлежность тому же заклинанию проверяется при наполнении.'),
    f('ОписаниеЦели','target_description','memo')],unique=[['ЗаклинаниеID','Порядок']])
table('УсиленияЗаклинаний','spell_scaling','Усиление конкретной связи заклинания с эффектом; не меняет общий шаблон для оружия.',[
    ref('ЭффектЗаклинанияID','spell_effect_id','ЭффектыЗаклинаний',required=True),
    f('Порядок','ordinal','long',required=True,rule='>0'),
    f('ОтЧегоЗависит','basis',required=True,size=40,rule='In ("уровень ячейки","уровень персонажа","уровень класса","особое")'),
    f('Порог','threshold','long',rule='Is Null Or >0'),f('Шаг','step','long',rule='Is Null Or >0'),
    ref('КлассID','class_id','Классы'),f('Операция','operation',required=True,size=40,
      rule='In ("добавить формулу","заменить формулу","другой результат")'),
    ref('ФормулаID','roll_formula_id','ФормулыБросков'),f('Описание','description','memo')],
    unique=[['ЭффектЗаклинанияID','Порядок']],rule=(
    '([Операция]="другой результат" And [Описание] Is Not Null) Or '
    '([Операция] In ("добавить формулу","заменить формулу") And [ФормулаID] Is Not Null)'))
table('ОбластиЗаклинаний','spell_areas','Размеры в футах. Несколько строк допускают составную/альтернативную область с пояснением.',[
    ref('ЗаклинаниеID','spell_id','Заклинания',required=True),f('Порядок','ordinal','long',required=True,rule='>0'),
    ref('ФормаID','shape_id','ФормыОбласти',required=True),
    *[f(name,technical,'double',rule='Is Null Or >0') for name,technical in
      [('РадиусФуты','radius_ft'),('ДлинаФуты','length_ft'),('ШиринаФуты','width_ft'),('ВысотаФуты','height_ft')]],
    f('Описание','description','memo')],unique=[['ЗаклинаниеID','Порядок']])
table('ИнформацияОБазе','schema_information','Начните проверку базы с этой таблицы или запроса 00_ПрочитайМеня.',[
    f('Код','code',required=True,size=80),f('Раздел','section',required=True,size=150),f('Пояснение','explanation','memo',required=True)],
    unique=[['Код']],seeds=[
      {'ID':1,'Код':'version','Раздел':'Версия','Пояснение':'Структура заклинаний v1, 2026-10-15. На проверку. Заклинания и предметы пока не заполнены.'},
      {'ID':2,'Код':'start','Раздел':'Как смотреть','Пояснение':'Начните с запросов 00_ПрочитайМеня и 01_ЗаклинанияОбзор. Таблицы имеют русские имена, связанные поля — списки выбора. Связи: Работа с базами данных → Схема данных → Все связи.'},
      {'ID':3,'Код':'materials','Раздел':'Компоненты и торговля','Пояснение':'Предметы — общий каталог. Расход и минимальная стоимость хранятся в МатериалыЗаклинаний/ГруппыМатериалов и относятся к конкретному заклинанию. ЦенаММ в Предметы — отдельная цена товара. Группы требуются вместе; внутри группы выбор «все» или «один из».'},
      {'ID':4,'Код':'damage','Раздел':'Урон и кубики','Пояснение':'ТипыУрона, Кубики, ФормулыБросков и Эффекты общие. СлагаемыеБросков хранят количество кубиков, константу или модификатор. Оружие позже сможет ссылаться на те же таблицы.'},
      {'ID':5,'Код':'time','Раздел':'Действие и время','Пояснение':'«1 действие» — один вариант времени накладывания, а не ещё один независимый дублирующий параметр. Реакция имеет условие, длительное накладывание — число и единицу времени. Дистанция и размер области разделены.'},
      {'ID':6,'Код':'empty','Раздел':'Что заполнено','Пояснение':'Только справочники и эта инструкция. Игровых записей и демонстрационных заклинаний нет. Сначала проверяем схему, потом импортируем данные.'},
      {'ID':7,'Код':'mysql','Раздел':'Будущий MySQL','Пояснение':'Перенос после проверки пользователем. В database/spells/schema.json сохранены английские технические имена таблиц и полей. Эта база не подключается к серверу и не меняет SQLite приложения.'},
      {'ID':8,'Код':'limitations','Раздел':'Границы схемы','Пояснение':'Структура хранит данные, но сама не исполняет правила D&D. Неоднозначные механики остаются в тексте со статусом проверки. Незаполненное значение — неизвестно, не ноль. Условные правила, число доступных вариантов и полноту В/С/М проверяет отдельная проверка данных при заполнении.'},
    ])

queries = [
    dict(name='00_ПрочитайМеня', sql='SELECT [Раздел], [Пояснение] FROM [ИнформацияОБазе] ORDER BY [ID]'),
    dict(name='01_ЗаклинанияОбзор',sql='SELECT s.[ID], s.[Название], s.[Уровень], m.[Название] AS [Школа], e.[Название] AS [Редакция], s.[Ритуал], s.[Концентрация], s.[СтатусПроверки] FROM ([Заклинания] AS s INNER JOIN [ШколыМагии] AS m ON s.[ШколаID]=m.[ID]) INNER JOIN [Редакции] AS e ON s.[РедакцияID]=e.[ID] ORDER BY s.[Уровень], s.[Название]'),
    dict(name='02_КлассыЗаклинаний',sql='SELECT s.[Название] AS [Заклинание], c.[Название] AS [Класс], b.[Название] AS [Источник], x.[ПравилоДоступа] FROM (([КлассыЗаклинаний] AS x INNER JOIN [Заклинания] AS s ON x.[ЗаклинаниеID]=s.[ID]) INNER JOIN [Классы] AS c ON x.[КлассID]=c.[ID]) INNER JOIN [Источники] AS b ON x.[ИсточникПравилаID]=b.[ID]'),
    dict(name='03_Материалы',sql='SELECT s.[Название] AS [Заклинание], g.[Порядок] AS [Группа], g.[Выбор], g.[МинимумГруппыММ], r.[ТребованиеТекст], i.[Название] AS [Предмет], r.[Количество], u.[Название] AS [Единица], r.[МинимумПредметаММ], c.[Название] AS [Расход], r.[УсловиеРасхода] FROM (((([МатериалыЗаклинаний] AS r INNER JOIN [ГруппыМатериалов] AS g ON r.[ГруппаID]=g.[ID]) INNER JOIN [Заклинания] AS s ON g.[ЗаклинаниеID]=s.[ID]) INNER JOIN [СпособыРасхода] AS c ON r.[СпособРасходаID]=c.[ID]) LEFT JOIN [Предметы] AS i ON r.[ПредметID]=i.[ID]) LEFT JOIN [ЕдиницыКоличества] AS u ON r.[ЕдиницаID]=u.[ID]'),
    dict(name='04_Эффекты',sql='SELECT s.[Название] AS [Заклинание], e.[Название] AS [Эффект], k.[Название] AS [Вид], d.[Название] AS [Урон], e.[ВыборТипаУрона], f.[Название] AS [Формула], x.[Воздействие], x.[ПриУспехе], x.[УсловиеПрименения], e.[Автоматизация] FROM (((([ЭффектыЗаклинаний] AS x INNER JOIN [Заклинания] AS s ON x.[ЗаклинаниеID]=s.[ID]) INNER JOIN [Эффекты] AS e ON x.[ЭффектID]=e.[ID]) INNER JOIN [ВидыЭффектов] AS k ON e.[ВидЭффектаID]=k.[ID]) LEFT JOIN [ТипыУрона] AS d ON e.[ТипУронаID]=d.[ID]) LEFT JOIN [ФормулыБросков] AS f ON e.[ФормулаID]=f.[ID]'),
    dict(name='05_ВремяНакладывания',sql='SELECT s.[Название] AS [Заклинание], a.[Название] AS [Действие], t.[КоличествоДействий], t.[ВремяЧисло], u.[Название] AS [ЕдиницаВремени], t.[УсловиеРеакции], t.[ИсходныйТекст] FROM (([ВремяНакладывания] AS t INNER JOIN [Заклинания] AS s ON t.[ЗаклинаниеID]=s.[ID]) LEFT JOIN [ТипыДействий] AS a ON t.[ДействиеID]=a.[ID]) LEFT JOIN [ЕдиницыВремени] AS u ON t.[ЕдиницаВремениID]=u.[ID]'),
]

for definition in tables:
    if definition['technical'] in ('spells', 'damage_types', 'items'):
        definition['fields'].append(f('Иконка', 'icon_url', size=500))

schema = dict(version='1.1',created='2026-10-15',scope='schema_only_no_spell_records',
              tables=tables,queries=queries)
(OUT/'schema.json').write_text(json.dumps(schema,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

lines=['# Словарь таблиц базы заклинаний','',
       'Структура v1 для проверки в Access. Английские имена — карта будущего переноса в MySQL, не новая база на сервере.','']
for t in tables:
    lines += [f'## {t["name"]} — `{t["technical"]}`','',t['description'],'',
              '| Поле | Будущее имя | Тип | Обязательно | Назначение |','| --- | --- | --- | --- | --- |']
    for field in t['fields']:
        description=field['description']
        if 'references' in field: description += ' Связь: '+field['references']+'.'
        lines.append(f'| {field["name"]} | `{field["technical"]}` | {field["type"]} | {"Да" if field["required"] or field["type"]=="counter" else "Нет"} | {description.strip()} |')
    if t['unique']: lines+=['','Уникальность: '+'; '.join(', '.join(x) for x in t['unique'])+'.']
    lines+=['']
(ROOT/'docs'/'spells-database-fields.md').write_text('\n'.join(lines),encoding='utf-8')
print(json.dumps({'tables':len(tables),'relationships':sum('references' in f for t in tables for f in t['fields']),
                  'lookup_rows':sum(len(t['seeds']) for t in tables if t['name']!='ИнформацияОБазе'),
                  'spell_rows':0,'queries':len(queries)},ensure_ascii=False))
