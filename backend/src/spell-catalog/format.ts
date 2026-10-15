const plurals = new Intl.PluralRules('ru');
const units: Record<string, [string, string, string]> = {
  piece: ['шт.', 'шт.', 'шт.'], pinch: ['щепотка', 'щепотки', 'щепоток'], drop: ['капля', 'капли', 'капель'],
  ounce: ['унция', 'унции', 'унций'], pound: ['фунт', 'фунта', 'фунтов'], handful: ['горсть', 'горсти', 'горстей'],
  portion: ['порция', 'порции', 'порций'], set: ['набор', 'набора', 'наборов'],
  round: ['раунд', 'раунда', 'раундов'], turn: ['ход', 'хода', 'ходов'], minute: ['минута', 'минуты', 'минут'],
  hour: ['час', 'часа', 'часов'], day: ['день', 'дня', 'дней'], year: ['год', 'года', 'лет'],
  action: ['действие', 'действия', 'действий'], bonus_action: ['бонусное действие', 'бонусных действия', 'бонусных действий'],
  reaction: ['реакция', 'реакции', 'реакций'], foot: ['фут', 'фута', 'футов'],
};

export function formatQuantity(value: number, code: string | null, fallback: string | null): string {
  const forms = code === null ? undefined : units[code];
  const category = plurals.select(value);
  const noun = forms ? forms[category === 'one' ? 0 : category === 'few' || category === 'other' ? 1 : 2] : fallback?.toLocaleLowerCase('ru') ?? '';
  return `${value.toLocaleString('ru-RU')} ${noun}`.trim();
}

export function formatDuration(value: number, code: string | null, fallback: string | null, concentration: boolean): string {
  if (!concentration) return formatQuantity(value, code, fallback);
  const genitive: Record<string, [string, string]> = {
    round: ['раунда', 'раундов'], turn: ['хода', 'ходов'], minute: ['минуты', 'минут'],
    hour: ['часа', 'часов'], day: ['дня', 'дней'], year: ['года', 'лет'],
  };
  const forms = code === null ? undefined : genitive[code];
  const noun = forms ? forms[plurals.select(value) === 'one' ? 0 : 1] : fallback?.toLocaleLowerCase('ru') ?? '';
  return `До ${value.toLocaleString('ru-RU')} ${noun}, концентрация`.trim();
}
