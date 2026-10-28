# Выборка каталога персонажа для проверки (этап 3)

Дата: 2026-10-29. Каталог: версия 14 — 13 классов, 118 подклассов, 84 предыстории и 5 адаптаций, 105 черт, 18 навыков, 65 языков, 15 состояний. Кэш страниц `5e14.dnd.su` — от 2026-10-27–28. Проверяет чат «Тестирование» (бриф этапа 3), затем автор.

По 10 объектов на категорию (навыки, языки и состояния — 10 вместе), подобраны на сложные случаи. Значения в столбце «Что проверить» взяты из `catalog.db` скриптом — так их показывает программа; на сайте должно быть то же. В конце — список английских названий всех 118 подклассов: от них зависят ID (Р11), проверить до слияния этапа 3, как Р71.

## Как проверять

1. Откройте программу с полным каталогом. В папке проекта выполните в терминале:

   ```bash
   npm run dev
   ```

   Откроется окно «Костёр». (В zip из GitHub — только тестовый каталог, для выборки он не подходит.)

2. Нажмите «Справочник» и введите название из таблицы в общую строку поиска — у результата подписана категория.
3. Откройте карточку и страницу DnD.su по ссылке из таблицы. У навыков, языков и состояний ссылка ведёт на общую статью — найдите строку поиском по странице (Ctrl+F); у подклассов — на раздел страницы класса.
4. Сравните с тем, что написано в «Что проверить». Таблицу класса 1–20 смотрите в карточке целиком: в столбце — только 20-я строка.
5. Замечания запишите в столбец «Итог» («ок» или что не так) или перечислите номера строк в чате.

Обозначения: у предысторий «снаряжение: частей N, со ссылкой M (…)» — сколько частей строки снаряжения и какие связаны с предметами каталога; `full`, `half`, `third`, `pact`, `artificer` — прогрессия ячеек при мультиклассе; `assisted` — механика частично данными, `display_only` — только текстом; `musical_instrument`, `gaming_set`, `artisans_tools` — группы инструментов (выбор без списка). «В фильтре заклинаний DnD.su — N»: столько заклинаний связано с подклассом связью `spell_subclass` (на сайте — фильтр списка заклинаний по подклассу); в карточке заклинания это строка «Подклассы».

Ошибки сайта и английские названия исправляются файлами в `data/reviewed/character/`, ошибки разбора — в коде импортёра.

## Классы

| № | Объект | Источник | Почему в выборке | Что проверить | Итог |
| --- | --- | --- | --- | --- | --- |
| 1 | [Изобретатель](https://5e14.dnd.su/class/137-artificer/) (Artificer) — `class:artificer` | TCE | прогрессия заклинаний «половина вверх» (artificer), инфузии, книга TCE | к8; хиты: 1 ур. 8, далее 5; спасброски Тел, Инт; навыки 2 из 7; подкласс с 3 ур. («Специальность изобретателя»), особенности подкласса на 3, 5, 9, 15; заклинания Инт, artificer; таблица 20 строк, столбцы: Заговоры, Предметы с инфузией, Инфузии; 20 ур.: БМ +6, Заговоры 4, Предметы с инфузией 6, Инфузии 12 ячейки 4/3/3/3/2/0/0/0/0; особенностей 13 (TCE 0); подклассов 4; мультикласс: Инт 13 |  |
| 2 | [Варвар](https://5e14.dnd.su/class/87-barbarian/) (Barbarian) — `class:barbarian` | PH14 | «Ярость» — число в таблице, а не новые особенности; «Неограниченно» на 20-м | к12; хиты: 1 ур. 12, далее 7; спасброски Сил, Тел; навыки 2 из Уход за животными, Атлетика, Запугивание, Природа, Восприятие, Выживание; подкласс с 3 ур. («Путь дикости»), особенности подкласса на 3, 6, 10, 14; заклинания —; таблица 20 строк, столбцы: Урон ярости, Ярость; 20 ур.: БМ +6, Урон ярости 4, Ярость unlimited; особенностей 16 (TCE 2); подклассов 9; мультикласс: Сил 13 |  |
| 3 | [Жрец](https://5e14.dnd.su/class/89-cleric/) (Cleric) — `class:cleric` | PH14 | подкласс с 1-го уровня; характеристика заклинаний исправлена в части Б (ревизия 2); 4 опциональные TCE | к8; хиты: 1 ур. 8, далее 5; спасброски Мдр, Хар; навыки 2 из История, Проницательность, Медицина, Убеждение, Религия; подкласс с 1 ур. («Божественный домен»), особенности подкласса на 1, 2, 6, 8, 17; заклинания Мдр, full; таблица 20 строк, столбцы: Заговоры; 20 ур.: БМ +6, Заговоры 5 ячейки 4/3/3/3/3/2/2/1/1; особенностей 10 (TCE 4); подклассов 14; мультикласс: Мдр 13 |  |
| 4 | [Воин](https://5e14.dnd.su/class/91-fighter/) (Fighter) — `class:fighter` | PH14 | нет столбцов таблицы; мультикласс «Сила или Ловкость» | к10; хиты: 1 ур. 10, далее 6; спасброски Сил, Тел; навыки 2 из 8; подкласс с 3 ур. («Воинский архетип»), особенности подкласса на 3, 7, 10, 15, 18; заклинания —; таблица 20 строк, столбцы: —; 20 ур.: БМ +6; особенностей 8 (TCE 1); подклассов 10; мультикласс: Сил 13 или Лов 13 |  |
| 5 | [Монах](https://5e14.dnd.su/class/93-monk/) (Monk) — `class:monk` | PH14 | больше всего особенностей (23); кость боевых искусств растёт | к8; хиты: 1 ур. 8, далее 5; спасброски Сил, Лов; навыки 2 из Акробатика, Атлетика, История, Проницательность, Религия, Скрытность; подкласс с 3 ур. («Монастырская традиция»), особенности подкласса на 3, 6, 11, 17; заклинания —; таблица 20 строк, столбцы: Очки ци, Боевые искусства, Движение без доспехов; 20 ур.: БМ +6, Очки ци 20, Боевые искусства 1d10, Движение без доспехов 30; особенностей 23 (TCE 4); подклассов 10; мультикласс: Мдр 13 и Лов 13 |  |
| 6 | [Следопыт](https://5e14.dnd.su/class/97-ranger/) (Ranger) — `class:ranger` | PH14 | больше всего опциональных TCE (6); полузаклинатель; мультикласс «Ловкость и Мудрость» | к10; хиты: 1 ур. 10, далее 6; спасброски Сил, Лов; навыки 3 из 8; подкласс с 3 ур. («Архетип следопыта»), особенности подкласса на 3, 7, 11, 15; заклинания Мдр, half; таблица 20 строк, столбцы: Известные заклинания; 20 ур.: БМ +6, Известные заклинания 11 ячейки 4/3/3/3/2/0/0/0/0; особенностей 19 (TCE 6); подклассов 8; мультикласс: Лов 13 и Мдр 13 |  |
| 7 | [Плут](https://5e14.dnd.su/class/99-rogue/) (Rogue) — `class:rogue` | PH14 | «Скрытая атака» в костях; 4 навыка из 11 | к8; хиты: 1 ур. 8, далее 5; спасброски Лов, Инт; навыки 4 из 11; подкласс с 3 ур. («Архетип плута»), особенности подкласса на 3, 9, 13, 17; заклинания —; таблица 20 строк, столбцы: Скрытая атака; 20 ур.: БМ +6, Скрытая атака 10d6; особенностей 14 (TCE 1); подклассов 9; мультикласс: Лов 13 |  |
| 8 | [Чародей](https://5e14.dnd.su/class/101-sorcerer/) (Sorcerer) — `class:sorcerer` | PH14 | больше всего столбцов (15 с ячейками); единицы чародейства | к6; хиты: 1 ур. 6, далее 4; спасброски Тел, Хар; навыки 2 из Магия, Обман, Проницательность, Запугивание, Убеждение, Религия; подкласс с 1 ур. («Происхождение чародея»), особенности подкласса на 1, 6, 14, 18; заклинания Хар, full; таблица 20 строк, столбцы: Заговоры, Единицы чародейства, Известные заклинания; 20 ур.: БМ +6, Заговоры 6, Единицы чародейства 20, Известные заклинания 15 ячейки 4/3/3/3/3/2/2/1/1; особенностей 9 (TCE 3); подклассов 8; мультикласс: Хар 13 |  |
| 9 | [Колдун](https://5e14.dnd.su/class/104-warlock/) (Warlock) — `class:warlock` | PH14 | магия договора: ячейки и их уровень отдельными столбцами; воззвания | к8; хиты: 1 ур. 8, далее 5; спасброски Мдр, Хар; навыки 2 из 7; подкласс с 1 ур. («Потусторонний покровитель»), особенности подкласса на 1, 6, 10, 14; заклинания Хар, pact; таблица 20 строк, столбцы: Заговоры, Воззвания, Уровень ячеек, Ячейки договора, Известные заклинания; 20 ур.: БМ +6, Заговоры 4, Воззвания 8, Уровень ячеек 5, Ячейки договора 4, Известные заклинания 15; особенностей 9 (TCE 2); подклассов 9; мультикласс: Хар 13 |  |
| 10 | [Волшебник](https://5e14.dnd.su/class/105-wizard/) (Wizard) — `class:wizard` | PH14 | подкласс со 2-го уровня; дюнамантия через подклассы (Р53) | к6; хиты: 1 ур. 6, далее 4; спасброски Инт, Мдр; навыки 2 из Магия, История, Проницательность, Расследование, Медицина, Религия; подкласс с 2 ур. («Магические традиции»), особенности подкласса на 2, 6, 10, 14; заклинания Инт, full; таблица 20 строк, столбцы: Заговоры; 20 ур.: БМ +6, Заговоры 5 ячейки 4/3/3/3/3/2/2/1/1; особенностей 8 (TCE 2); подклассов 13; мультикласс: Инт 13 |  |

## Подклассы

| № | Объект | Источник | Почему в выборке | Что проверить | Итог |
| --- | --- | --- | --- | --- | --- |
| 1 | [Домен света](https://5e14.dnd.su/class/89-cleric/#domain.light) (Light Domain) — `subclass:cleric-light` | PH14 | доп. заклинания домена ссылками; огненный шар у жреца — «через подкласс» (Р53); в фильтре DnD.su заклинаний на одно больше, чем в списке домена | класс Жрец; особенностей 6 на уровнях 1, 2, 6, 8, 17; доп. заклинания «заклинания домена света»: 1 — Огненные ладони, Огонь фей; 3 — Палящий луч, Пылающий шар; 5 — Дневной свет, Огненный шар; 7 — Огненная стена, Страж веры; 9 — Наблюдение, Небесный огонь; в фильтре заклинаний DnD.su — 11 |  |
| 2 | [Мистический рыцарь](https://5e14.dnd.su/class/91-fighter/#archetype.eldritch-knigh) (Eldritch Knight) — `subclass:fighter-eldritch-knight` | PH14 | заклинатель-треть, своя таблица заклинателя; якорь страницы с опечаткой (`eldritch-knigh`) | класс Воин; особенностей 6 на уровнях 3, 7, 10, 15, 18; заклинатель Инт, third; в фильтре заклинаний DnD.su — 0 |  |
| 3 | [Убийца чудовищ](https://5e14.dnd.su/class/97-ranger/#archetype.monster-slayer) (Monster Slayer) — `subclass:ranger-monster-slayer` | XGE | в фильтре заклинаний DnD.su другое название («убийца монстров», поле `spellListName`); список заклинаний без названия | класс Следопыт; особенностей 6 на уровнях 3, 7, 11, 15; доп. заклинания «без названия»: 3 — Защита от зла и добра; 5 — Область истины; 9 — Магический круг; 13 — Изгнание; 17 — Удержание чудовища; в фильтре заклинаний DnD.su — 5 |  |
| 4 | [Круг земли](https://5e14.dnd.su/class/90-druid/#circle.land) (Circle of the Land) — `subclass:druid-land` | PH14 | 8 списков по местности | класс Друид; особенностей 6 на уровнях 2, 3, 6, 10, 14; доп. заклинания списков 8 (Болото, Гора, Лес, Луг, Побережье, Подземье, Пустыня, Тундра), заклинаний всего 64; первый: 3 — Мельфова кислотная стрела, Тьма; 5 — Зловонное облако, Хождение по воде; 7 — Поиск существа, Свобода перемещения; 9 — Наблюдение, Нашествие насекомых; в фильтре заклинаний DnD.su — 47 |  |
| 5 | [Гений](https://5e14.dnd.su/class/104-warlock/#patron.genie) (The Genie) — `subclass:warlock-genie` | TCE | 5 списков (по виду гения); ряды — по уровню заклинаний | класс Колдун; особенностей 5 на уровнях 1, 6, 10, 14; доп. заклинания списков 5 (Заклинание гения, Заклинание дао, Заклинание джинна, Заклинание ифрита, Заклинание марид), заклинаний всего 26; первый: 1 — Обнаружение зла и добра; 2 — Воображаемая сила; 3 — Сотворение пищи и воды; 4 — Воображаемый убийца; 5 — Сотворение; 9 — Исполнение желаний; в фильтре заклинаний DnD.su — 25 |  |
| 6 | [Божественная душа](https://5e14.dnd.su/class/101-sorcerer/#origin.divine-soul) (Divine Soul) — `subclass:sorcerer-divine-soul` | PH14 | «Склонность» — таблица текстом, не список доп. заклинаний | класс Чародей; особенностей 5 на уровнях 1, 6, 14, 18; в фильтре заклинаний DnD.su — 5 |  |
| 7 | [Магия хронургии](https://5e14.dnd.su/class/105-wizard/#tradition.chronurgy) (Chronurgy Magic) — `subclass:wizard-chronurgy` | EGW | книга EGW; 15 заклинаний дюнамантии через фильтр, своего списка нет | класс Волшебник; особенностей 5 на уровнях 2, 6, 10, 14; в фильтре заклинаний DnD.su — 15 |  |
| 8 | [Путь великана](https://5e14.dnd.su/class/87-barbarian/#primal.giant) (Path of the Giant) — `subclass:barbarian-giant` | BGG | код книги `BGG` выбран мной (вопрос автору) | класс Варвар; особенностей 5 на уровнях 3, 6, 10, 14; в фильтре заклинаний DnD.su — 2 |  |
| 9 | [Клятвопреступник](https://5e14.dnd.su/class/94-paladin/#oath.oathbreaker) (Oathbreaker) — `subclass:paladin-oathbreaker` | DMG14 | книга «Руководство мастера» (`DMG14`) | класс Паладин; особенностей 4 на уровнях 3, 7, 15, 20; доп. заклинания «ЗАКЛИНАНИЯ КЛЯТВОПРЕСТУПНИКА»: 3 — Адское возмездие, Нанесение ран; 5 — Корона безумия, Тьма; 9 — Восставший труп, Проклятие; 13 — Смятение, Усыхание; 17 — Заражение, Подчинение личности; в фильтре заклинаний DnD.su — 10 |  |
| 10 | [Путь восходящего дракона](https://5e14.dnd.su/class/93-monk/#tradition.ascending-dragon) (Way of the Ascendant Dragon) — `subclass:monk-ascendant-dragon` | FTD | якорь с опечаткой (`ascending-dragon`), книга FTD | класс Монах; особенностей 5 на уровнях 3, 6, 11, 17; в фильтре заклинаний DnD.su — 0 |  |

## Предыстории

| № | Объект | Источник | Почему в выборке | Что проверить | Итог |
| --- | --- | --- | --- | --- | --- |
| 1 | [Прислужник](https://5e14.dnd.su/backgrounds/766-acolyte/) (Acolyte) — `background:acolyte` | PH14 | языки «два на выбор»; снаряжение частями со ссылками | навыки: Проницательность, Религия; инструменты: —; языки: 2 из любых; снаряжение: частей 6, со ссылкой 4 (Благовония, Ряса, Одежда, обычная, Кошель); деньги 1500 мм; умение «Приют для верующих» |  |
| 2 | [Артист](https://5e14.dnd.su/backgrounds/757-entertainer/) (Entertainer) — `background:entertainer` | PH14 | инструмент — группа «музыкальный инструмент»; разновидность «Гладиатор» | навыки: Акробатика, Выступление; инструменты: Набор для грима, 1 из musical_instrument; языки: —; снаряжение: частей 4, со ссылкой 2 (Одежда, костюм, Кошель); деньги 1500 мм; умение «По многочисленным просьбам»; разновидности: Гладиатор |  |
| 3 | [Шарлатан](https://5e14.dnd.su/backgrounds/769-charlatan/) (Charlatan) — `background:charlatan` | PH14 | два фиксированных инструмента; выбор внутри части снаряжения | навыки: Ловкость рук, Обман; инструменты: Набор для грима, Набор для фальсификации; языки: —; снаряжение: частей 4, со ссылкой 3 (Одежда, отличная, Набор для грима, Кошель); деньги 1500 мм; умение «Поддельная личность» |  |
| 4 | [Студент Призмари](https://5e14.dnd.su/backgrounds/795-prismari-student/) (Prismari Student) — `background:prismari-student` | SCC | смешанный выбор «ремесленные или музыкальный»; умение даёт черту | навыки: Акробатика, Выступление; инструменты: —; языки: 1 из любых; на выбор: 1 из [artisans_tools, musical_instrument]; снаряжение: частей 5, со ссылкой 3 (Чернила (бутылочка 30 граммов), Писчее перо, Кошель); деньги 1000 мм; умение «Поступивший в Призмари»; даёт черту: Поступивший в Стриксхейвен |  |
| 5 | [Награждённый](https://5e14.dnd.su/backgrounds/858-rewarded/) (Rewarded) — `background:rewarded` | BMT | черта «одна из трёх»; число игровых наборов исправлено в части В (было 3 — из «трёх драконов» в скобках) | навыки: Проницательность, Убеждение; инструменты: 1 из gaming_set; языки: 1 из любых; снаряжение: частей 7, со ссылкой 4 (Писчее перо, Кольцо-печатка, Одежда, отличная, Кошель); деньги 1800 мм; умение «улыбка Фортуны»; даёт черту: Везунчик, Посвящённый в магию, Одарённый |  |
| 6 | [Дальний путешественник](https://5e14.dnd.su/backgrounds/777-far-traveler/) (Far Traveler) — `background:far-traveler` | SCAG | смешанный выбор «музыкальный инструмент или игровой набор»; SCAG | навыки: Проницательность, Восприятие; инструменты: —; языки: 1 из любых; на выбор: 1 из [musical_instrument, gaming_set]; снаряжение: частей 8, со ссылкой 2 (Одежда, дорожная, Кошель); деньги 1500 мм; умение «Все взгляды прикованы к вам»; только текстом 2 |  |
| 7 | [Преследуемый](https://5e14.dnd.su/backgrounds/789-haunted-one/) (Haunted One) — `background:haunted-one` | VRGR | навыки и языки — из списка; VRGR | навыки: 2 из Магия, Расследование, Религия, Выживание; инструменты: —; языки: 2 из Бездны, Драконий, Инфернальный, Первичный, Сильван, Подземный; снаряжение: частей 4, со ссылкой 2 (Набор охотника на монстров, Одежда, обычная); деньги 10 мм; умение «Сердце тьмы»; только текстом 1 |  |
| 8 | [Соламнийский Рыцарь](https://5e14.dnd.su/backgrounds/854-knight-of-solamnia/) (Knight of Solamnia) — `background:knight-of-solamnia` | SDQ | умение даёт черту «Оруженосец…», которая требует класс | навыки: Атлетика, Выживание; инструменты: —; языки: 2 из любых; снаряжение: частей 4, со ссылкой 3 (Карты, Одежда, обычная, Кошель); деньги 1000 мм; умение «Оруженосец Соламнии»; даёт черту: Оруженосец рыцаря Соламнии |  |
| 9 | [Великаний подкидыш](https://5e14.dnd.su/backgrounds/820-giant-foundling/) (Giant foundling) — `background:giant-foundling` | BPGG | фиксированный язык и язык на выбор; умение даёт черту «Удар великанов» | навыки: Выживание, Запугивание; инструменты: —; языки: Великаний, 1 из любых; снаряжение: частей 5, со ссылкой 3 (Рюкзак, Одежда, дорожная, Кошель); деньги 1000 мм; умение «Удар великанов»; даёт черту: Удар великанов |  |
| 10 | [Городской стражник](https://5e14.dnd.su/backgrounds/772-city-watch/) (City Watch) — `background:city-watch` | SCAG | разновидность «Сыщик»; SCAG | навыки: Атлетика, Проницательность; инструменты: —; языки: 2 из любых; снаряжение: частей 5, со ссылкой 2 (Рожок, Кошель); деньги 1000 мм; умение «Намётанный глаз»; разновидности: Сыщик |  |

## Черты

| № | Объект | Источник | Почему в выборке | Что проверить | Итог |
| --- | --- | --- | --- | --- | --- |
| 1 | [Одарённый](https://5e14.dnd.su/feats/130-skilled/) (Skilled) — `feat:skilled` | PH14 | смешанный выбор «навык или инструмент» — 3 | требование: —; на выбор: 3 из [skill, tool]; automation assisted |  |
| 2 | [Знаток средних доспехов](https://5e14.dnd.su/feats/114-moderately-armored/) (Moderately armored) — `feat:moderately-armored` | PH14 | требование — владение доспехами; «+1 Силы или Ловкости» | требование: владение доспехами (light); увеличение: +1 к 1 из Сил/Лов; доспехи: medium, shield; automation assisted |  |
| 3 | [Эльфийская точность](https://5e14.dnd.su/feats/157-elven-accuracy/) (Elven accuracy) — `feat:elven-accuracy` | XGE | требование — расы через «или», связи на объекты рас | требование: Эльф или Полуэльф; увеличение: +1 к 1 из Лов/Инт/Мдр/Хар; automation assisted; связи-требования: Эльф, Полуэльф |  |
| 4 | [Искажённая метка дракона](https://5e14.dnd.su/feats/173-aberrant-dragonmark/) (Aberrant dragonmark) — `feat:aberrant-dragonmark` | RLW | единственное требование только текстом | требование: текст «Отсутствие другой Метки Дракона»; увеличение: +1 Тел; только текстом 2; automation assisted |  |
| 5 | [Бдительный](https://5e14.dnd.su/feats/103-alert/) (Alert) — `feat:alert` | PH14 | без механики (`display_only`) — по Р77 станет данными на этапе 4.1 | требование: —; automation display_only |  |
| 6 | [Устойчивый](https://5e14.dnd.su/feats/140-resilient/) (Resilient) — `feat:resilient` | PH14 | спасбросок выбранной характеристики | требование: —; увеличение: +1 к 1 из любых; спасбросок: "chosen_ability"; automation assisted |  |
| 7 | [Затронутый феями](https://5e14.dnd.su/feats/161-fey-touched/) (Fey touched) — `feat:fey-touched` | TCE | заклинание по названию — ссылкой, второе на выбор — текстом | требование: —; увеличение: +1 к 1 из Инт/Мдр/Хар; заклинания: Туманный шаг; только текстом 1; automation assisted |  |
| 8 | [Оруженосец рыцаря Соламнии](https://5e14.dnd.su/feats/252-squire-of-solamnia/) (Squire of Solamnia) — `feat:squire-of-solamnia` | SDQ | требование-класс связью (часть В): «Воин, Паладин или предыстория» | требование: dragonlance и Воин или Паладин или Соламнийский Рыцарь; automation display_only; связи-требования: Соламнийский Рыцарь, Воин, Паладин |  |
| 9 | [Посвящённый в Высшее волшебство](https://5e14.dnd.su/feats/248-initiate-of-high-sorcery/) (Initiate of High Sorcery) — `feat:initiate-of-high-sorcery` | SDQ | требование-класс связью и кампания Dragonlance | требование: dragonlance и Чародей или Волшебник или Маг Высшего Волшебства; только текстом 1; automation display_only; связи-требования: Маг Высшего Волшебства, Чародей, Волшебник |  |
| 10 | [Пылкость огненного великана](https://5e14.dnd.su/feats/217-embar-of-the-fire-giant/) (Embar of the fire giant) — `feat:embar-of-the-fire-giant` | BPGG | требование «4 уровень и черта с вариантом»; английское название с опечаткой (Embar — вероятно Ember), от него ID | требование: 4+ ур. и Удар великанов (Огненный удар); увеличение: +1 к 1 из Сил/Тел/Мдр; automation assisted; связи-требования: Удар великанов |  |

## Навыки, языки, состояния

| № | Объект | Источник | Почему в выборке | Что проверить | Итог |
| --- | --- | --- | --- | --- | --- |
| 1 | [Акробатика](https://5e14.dnd.su/articles/newbie/468-using-ability-scores/) (Acrobatics) — `skill:acrobatics` | PH14 | навык Ловкости; связи с расами, предысториями, классами | характеристика Лов; владеют (связи): рас 3, предысторий 5, классов 3 |  |
| 2 | [Уход за животными](https://5e14.dnd.su/articles/newbie/468-using-ability-scores/) (Animal Handling) — `skill:animal-handling` | PH14 | ID из двух слов (`animal-handling`) | характеристика Мдр; владеют (связи): рас 9, предысторий 3, классов 4 |  |
| 3 | [Ловкость рук](https://5e14.dnd.su/articles/newbie/468-using-ability-scores/) (Sleight of Hand) — `skill:sleight-of-hand` | PH14 | ID из трёх слов | характеристика Лов; владеют (связи): рас 3, предысторий 5, классов 2 |  |
| 4 | [Акван](https://5e14.dnd.su/articles/mechanics/209-languages/) (Aquan) — `language:aquan` | PH14 | диалект Первичного (`dialect_of`) | экзотический; письменность: Дварфская (PH14); диалект: Первичный; диалекты: —; знают рас 3 |  |
| 5 | [Эльфийский](https://5e14.dnd.su/articles/mechanics/209-languages/) (Elvish) — `language:elvish` | PH14 | обычный язык со своей письменностью | обычный; письменность: Эльфийская (PH14); диалекты: —; знают рас 4 |  |
| 6 | [Глубинная Речь](https://5e14.dnd.su/articles/mechanics/209-languages/) (Deep Speech) — `language:deep-speech` | PH14 | без письменности | экзотический; письменность: нет (PH14); диалекты: —; знают рас 0 |  |
| 7 | [Подземный](https://5e14.dnd.su/articles/mechanics/209-languages/) (Undercommon) — `language:undercommon` | PH14 | экзотический с эльфийской письменностью | экзотический; письменность: Эльфийская (PH14); диалекты: —; знают рас 2 |  |
| 8 | [Сбитый с ног](https://5e14.dnd.su/articles/mechanics/27-conditions/) (Prone) — `condition:prone` | PH14 | синоним «Лежащий ничком» в поиске | пунктов описания 1; синонимы: Лежащий ничком |  |
| 9 | [Истощённый](https://5e14.dnd.su/articles/mechanics/27-conditions/) (Exhaustion) — `condition:exhaustion` | PH14 | таблица степеней (6 строк) | пунктов описания 6, таблица 6 строк; синонимы: — |  |
| 10 | [Невидимый](https://5e14.dnd.su/articles/mechanics/27-conditions/) (Invisible) — `condition:invisible` | PH14 | тёзка заклинания «Невидимость» — поиск находит оба | пунктов описания 1; синонимы: — |  |

## Английские названия подклассов (118)

Записаны вручную по книгам 2014 в `data/reviewed/character/subclasses.json`. ID подкласса — `subclass:<класс>-<хвост якоря страницы>`; при опечатке в якоре — поле `slug` (в таблице показан якорь). Сверить английское название с книгой (D&D Beyond или книга). Неверное название — поправить `nameEn`; менять ID (`slug`) — только с решением автора (Р11, Р21).

| № | Класс | Подкласс | Английское название | ID | Книга | Итог |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Изобретатель | Алхимик | Alchemist | `subclass:artificer-alchemist` | TCE |  |
| 2 | Изобретатель | Артиллерист | Artillerist | `subclass:artificer-artillerist` | TCE |  |
| 3 | Изобретатель | Боевой кузнец | Battle Smith | `subclass:artificer-battle-smith` (якорь `specialist.battlesmith`) | TCE |  |
| 4 | Изобретатель | Бронник | Armorer | `subclass:artificer-armorer` | TCE |  |
| 5 | Варвар | Путь берсерка | Path of the Berserker | `subclass:barbarian-berserker` | PH14 |  |
| 6 | Варвар | Путь тотемного воина | Path of the Totem Warrior | `subclass:barbarian-totem-warrior` | PH14 |  |
| 7 | Варвар | Путь бушующего в бою | Path of the Battlerager | `subclass:barbarian-battlerager` | SCAG |  |
| 8 | Варвар | Путь буревестника | Path of the Storm Herald | `subclass:barbarian-storm-herald` | XGE |  |
| 9 | Варвар | Путь предка-хранителя | Path of the Ancestral Guardian | `subclass:barbarian-ancestral-guardian` | XGE |  |
| 10 | Варвар | Путь фанатика | Path of the Zealot | `subclass:barbarian-zealot` | XGE |  |
| 11 | Варвар | Путь дикой магии | Path of Wild Magic | `subclass:barbarian-wild-magic` | TCE |  |
| 12 | Варвар | Путь зверя | Path of the Beast | `subclass:barbarian-beast` | TCE |  |
| 13 | Варвар | Путь великана | Path of the Giant | `subclass:barbarian-giant` | BGG |  |
| 14 | Бард | Коллегия доблести | College of Valor | `subclass:bard-valor` | PH14 |  |
| 15 | Бард | Коллегия знаний | College of Lore | `subclass:bard-lore` | PH14 |  |
| 16 | Бард | Коллегия мечей | College of Swords | `subclass:bard-swords` | XGE |  |
| 17 | Бард | Коллегия очарования | College of Glamour | `subclass:bard-glamour` | XGE |  |
| 18 | Бард | Коллегия шёпотов | College of Whispers | `subclass:bard-whispers` | XGE |  |
| 19 | Бард | Коллегия красноречия | College of Eloquence | `subclass:bard-eloquence` | TCE |  |
| 20 | Бард | Коллегия созидания | College of Creation | `subclass:bard-creation` | TCE |  |
| 21 | Бард | Коллегия духов | College of Spirits | `subclass:bard-spirits` | VRGR |  |
| 22 | Жрец | Домен бури | Tempest Domain | `subclass:cleric-tempest` | PH14 |  |
| 23 | Жрец | Домен войны | War Domain | `subclass:cleric-war` | PH14 |  |
| 24 | Жрец | Домен жизни | Life Domain | `subclass:cleric-life` | PH14 |  |
| 25 | Жрец | Домен знаний | Knowledge Domain | `subclass:cleric-knowledge` | PH14 |  |
| 26 | Жрец | Домен обмана | Trickery Domain | `subclass:cleric-trickery` | PH14 |  |
| 27 | Жрец | Домен природы | Nature Domain | `subclass:cleric-nature` | PH14 |  |
| 28 | Жрец | Домен света | Light Domain | `subclass:cleric-light` | PH14 |  |
| 29 | Жрец | Домен смерти | Death Domain | `subclass:cleric-death` | PH14 |  |
| 30 | Жрец | Домен магии | Arcana Domain | `subclass:cleric-arcana` | SCAG |  |
| 31 | Жрец | Домен кузни | Forge Domain | `subclass:cleric-forge` | XGE |  |
| 32 | Жрец | Домен упокоения | Grave Domain | `subclass:cleric-grave` | XGE |  |
| 33 | Жрец | Домен мира | Peace Domain | `subclass:cleric-peace` | TCE |  |
| 34 | Жрец | Домен порядка | Order Domain | `subclass:cleric-order` | TCE |  |
| 35 | Жрец | Домен сумерек | Twilight Domain | `subclass:cleric-twilight` | PH14 |  |
| 36 | Друид | Круг земли | Circle of the Land | `subclass:druid-land` | PH14 |  |
| 37 | Друид | Круг луны | Circle of the Moon | `subclass:druid-moon` | PH14 |  |
| 38 | Друид | Круг пастыря | Circle of the Shepherd | `subclass:druid-shepherd` | XGE |  |
| 39 | Друид | Круг снов | Circle of Dreams | `subclass:druid-dreams` | XGE |  |
| 40 | Друид | Круг дикого огня | Circle of Wildfire | `subclass:druid-wildfire` | TCE |  |
| 41 | Друид | Круг звёзд | Circle of Stars | `subclass:druid-stars` | TCE |  |
| 42 | Друид | Круг спор | Circle of Spores | `subclass:druid-spores` | TCE |  |
| 43 | Воин | Мастер боевых искусств | Battle Master | `subclass:fighter-battle-master` (якорь `archetype.battlemaster`) | PH14 |  |
| 44 | Воин | Мистический рыцарь | Eldritch Knight | `subclass:fighter-eldritch-knight` (якорь `archetype.eldritch-knigh`) | PH14 |  |
| 45 | Воин | Чемпион | Champion | `subclass:fighter-champion` | PH14 |  |
| 46 | Воин | Рыцарь Пурпурного дракона | Purple Dragon Knight (Banneret) | `subclass:fighter-banneret` | SCAG |  |
| 47 | Воин | Кавалерист | Cavalier | `subclass:fighter-cavalier` | XGE |  |
| 48 | Воин | Мистический лучник | Arcane Archer | `subclass:fighter-arcane-archer` | XGE |  |
| 49 | Воин | Самурай | Samurai | `subclass:fighter-samurai` | XGE |  |
| 50 | Воин | Рыцарь Эха | Echo Knight | `subclass:fighter-echo-knight` | EGW |  |
| 51 | Воин | Пси-воин | Psi Warrior | `subclass:fighter-psi-warrior` | TCE |  |
| 52 | Воин | Рунный рыцарь | Rune Knight | `subclass:fighter-rune-knight` | TCE |  |
| 53 | Монах | Путь открытой ладони | Way of the Open Hand | `subclass:monk-open-hand` | PH14 |  |
| 54 | Монах | Путь тени | Way of Shadow | `subclass:monk-shadow` | PH14 |  |
| 55 | Монах | Путь четырёх стихий | Way of the Four Elements | `subclass:monk-four-elements` | PH14 |  |
| 56 | Монах | Путь долгой смерти | Way of the Long Death | `subclass:monk-long-death` | SCAG |  |
| 57 | Монах | Путь кэнсэя | Way of the Kensei | `subclass:monk-kensei` | XGE |  |
| 58 | Монах | Путь пьяного мастера | Way of the Drunken Master | `subclass:monk-drunken-master` | XGE |  |
| 59 | Монах | Путь солнечной души | Way of the Sun Soul | `subclass:monk-sun-soul` | XGE |  |
| 60 | Монах | Путь астрального тела | Way of the Astral Self | `subclass:monk-astral-self` (якорь `tradition.astral-body`) | TCE |  |
| 61 | Монах | Путь милосердия | Way of Mercy | `subclass:monk-mercy` | TCE |  |
| 62 | Монах | Путь восходящего дракона | Way of the Ascendant Dragon | `subclass:monk-ascendant-dragon` (якорь `tradition.ascending-dragon`) | FTD |  |
| 63 | Паладин | Клятва преданности | Oath of Devotion | `subclass:paladin-devotion` | PH14 |  |
| 64 | Паладин | Клятва древних | Oath of the Ancients | `subclass:paladin-ancients` | PH14 |  |
| 65 | Паладин | Клятва мести | Oath of Vengeance | `subclass:paladin-vengeance` | PH14 |  |
| 66 | Паладин | Клятвопреступник | Oathbreaker | `subclass:paladin-oathbreaker` | DMG14 |  |
| 67 | Паладин | Клятва короны | Oath of the Crown | `subclass:paladin-crown` | SCAG |  |
| 68 | Паладин | Клятва искупления | Oath of Redemption | `subclass:paladin-redemption` | PH14 |  |
| 69 | Паладин | Клятва покорения | Oath of Conquest | `subclass:paladin-conquest` | PH14 |  |
| 70 | Паладин | Клятва славы | Oath of Glory | `subclass:paladin-glory` | TCE |  |
| 71 | Паладин | Клятва смотрителей | Oath of the Watchers | `subclass:paladin-watchers` | TCE |  |
| 72 | Следопыт | Охотник | Hunter | `subclass:ranger-hunter` | PH14 |  |
| 73 | Следопыт | Повелитель зверей | Beast Master | `subclass:ranger-beast-master` | TCE |  |
| 74 | Следопыт | Странник горизонта | Horizon Walker | `subclass:ranger-horizon-walker` | XGE |  |
| 75 | Следопыт | Сумрачный охотник | Gloom Stalker | `subclass:ranger-gloom-stalker` | XGE |  |
| 76 | Следопыт | Убийца чудовищ | Monster Slayer | `subclass:ranger-monster-slayer` | XGE |  |
| 77 | Следопыт | Странник фей | Fey Wanderer | `subclass:ranger-fey-wanderer` | TCE |  |
| 78 | Следопыт | Хранитель роя | Swarmkeeper | `subclass:ranger-swarmkeeper` | TCE |  |
| 79 | Следопыт | Наездник на дрейке | Drakewarden | `subclass:ranger-drakewarden` | PH14 |  |
| 80 | Плут | Вор | Thief | `subclass:rogue-thief` | PH14 |  |
| 81 | Плут | Убийца | Assassin | `subclass:rogue-assassin` (якорь `archetype.assasin`) | PH14 |  |
| 82 | Плут | Мистический ловкач | Arcane Trickster | `subclass:rogue-arcane-trickster` | PH14 |  |
| 83 | Плут | Дуэлянт | Swashbuckler | `subclass:rogue-swashbuckler` | XGE |  |
| 84 | Плут | Комбинатор | Mastermind | `subclass:rogue-mastermind` | XGE |  |
| 85 | Плут | Скаут | Scout | `subclass:rogue-scout` | XGE |  |
| 86 | Плут | Сыщик | Inquisitive | `subclass:rogue-inquisitive` | XGE |  |
| 87 | Плут | Фантом | Phantom | `subclass:rogue-phantom` | TCE |  |
| 88 | Плут | Клинок души | Soulknife | `subclass:rogue-soulknife` | TCE |  |
| 89 | Чародей | Наследие драконьей крови | Draconic Bloodline | `subclass:sorcerer-draconic` | PH14 |  |
| 90 | Чародей | Дикая магия | Wild Magic | `subclass:sorcerer-wild-magic` | PH14 |  |
| 91 | Чародей | Божественная душа | Divine Soul | `subclass:sorcerer-divine-soul` | PH14 |  |
| 92 | Чародей | Теневая магия | Shadow Magic | `subclass:sorcerer-shadow` | PH14 |  |
| 93 | Чародей | Штормовое колдовство | Storm Sorcery | `subclass:sorcerer-storm` | PH14 |  |
| 94 | Чародей | Аберрантный разум | Aberrant Mind | `subclass:sorcerer-aberrant-mind` | TCE |  |
| 95 | Чародей | Заводная душа | Clockwork Soul | `subclass:sorcerer-clockwork-soul` | TCE |  |
| 96 | Чародей | Лунное чародейство | Lunar Sorcery | `subclass:sorcerer-lunar-sorcery` | SDQ |  |
| 97 | Колдун | Архифея | The Archfey | `subclass:warlock-archfey` | PH14 |  |
| 98 | Колдун | Исчадие | The Fiend | `subclass:warlock-fiend` | PH14 |  |
| 99 | Колдун | Великий Древний | The Great Old One | `subclass:warlock-great-old-one` | PH14 |  |
| 100 | Колдун | Бессмертный | The Undying | `subclass:warlock-undying` | SCAG |  |
| 101 | Колдун | Ведьмовской клинок | The Hexblade | `subclass:warlock-hexblade` | XGE |  |
| 102 | Колдун | Небожитель | The Celestial | `subclass:warlock-celestial` | XGE |  |
| 103 | Колдун | Бездонный | The Fathomless | `subclass:warlock-fathomless` | TCE |  |
| 104 | Колдун | Гений | The Genie | `subclass:warlock-genie` | TCE |  |
| 105 | Колдун | Нежить | The Undead | `subclass:warlock-undead` | VRGR |  |
| 106 | Волшебник | Школа Воплощения | School of Evocation | `subclass:wizard-evocation` | PH14 |  |
| 107 | Волшебник | Школа Вызова | School of Conjuration | `subclass:wizard-conjuration` | PH14 |  |
| 108 | Волшебник | Школа Иллюзии | School of Illusion | `subclass:wizard-illusion` | PH14 |  |
| 109 | Волшебник | Школа Некромантии | School of Necromancy | `subclass:wizard-necromancy` | PH14 |  |
| 110 | Волшебник | Школа Ограждения | School of Abjuration | `subclass:wizard-abjuration` | PH14 |  |
| 111 | Волшебник | Школа Очарования | School of Enchantment | `subclass:wizard-enchantment` | PH14 |  |
| 112 | Волшебник | Школа Преобразования | School of Transmutation | `subclass:wizard-transmutation` | PH14 |  |
| 113 | Волшебник | Школа Прорицания | School of Divination | `subclass:wizard-divination` | PH14 |  |
| 114 | Волшебник | Военная магия | War Magic | `subclass:wizard-war-magic` | XGE |  |
| 115 | Волшебник | Магия хронургии | Chronurgy Magic | `subclass:wizard-chronurgy` | EGW |  |
| 116 | Волшебник | Магия гравитургии | Graviturgy Magic | `subclass:wizard-graviturgy` | EGW |  |
| 117 | Волшебник | Орден писцов | Order of Scribes | `subclass:wizard-scribes` | TCE |  |
| 118 | Волшебник | Песнь клинка | Bladesinging | `subclass:wizard-bladesinging` | TCE |  |
