export function localTime(value: string, detailed = false) {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
  };
  if (detailed) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  }

  return new Date(value).toLocaleString('zh-CN', options);
}
