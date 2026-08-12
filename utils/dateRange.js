// Helper بيحوّل "أعرض بيانات يوم/أسبوع/شهر/سنة معينة" لحدود تاريخ + شكل تجميع
// بيشتغل بالكامل بتوقيت UTC عشان يتفق مع طريقة تجميع MongoDB الافتراضية
// ويتفادى مشاكل اختلاف توقيت السيرفر عن توقيت المستخدم.

function startOfUTCDay(date) {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function getDateRange(granularity, dateStr) {
  const ref = dateStr ? new Date(dateStr) : new Date();
  let start;
  let end;
  let unit;
  let bucketCount;

  if (granularity === 'day') {
    start = startOfUTCDay(ref);
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    unit = 'hour';
    bucketCount = 24;
  } else if (granularity === 'week') {
    start = startOfUTCDay(ref);
    const dow = start.getUTCDay(); // 0=Sun..6=Sat
    const diffToMonday = dow === 0 ? -6 : 1 - dow;
    start.setUTCDate(start.getUTCDate() + diffToMonday);
    end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 7);
    unit = 'day';
    bucketCount = 7;
  } else if (granularity === 'year') {
    start = new Date(Date.UTC(ref.getUTCFullYear(), 0, 1));
    end = new Date(Date.UTC(ref.getUTCFullYear() + 1, 0, 1));
    unit = 'month';
    bucketCount = 12;
  } else {
    // 'month' هو الافتراضي
    start = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth(), 1));
    end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));
    unit = 'day';
    bucketCount = Math.round((end - start) / (24 * 60 * 60 * 1000));
  }

  return { start, end, unit, bucketCount };
}

function dateFormatForUnit(unit) {
  if (unit === 'hour') return '%Y-%m-%dT%H:00';
  if (unit === 'month') return '%Y-%m';
  return '%Y-%m-%d';
}

function keyForDate(d, unit) {
  if (unit === 'hour') return `${d.toISOString().slice(0, 13)}:00`;
  if (unit === 'month') return d.toISOString().slice(0, 7);
  return d.toISOString().slice(0, 10);
}

function buildBuckets(start, unit, bucketCount) {
  const buckets = [];
  for (let i = 0; i < bucketCount; i++) {
    const d = new Date(start);
    if (unit === 'hour') d.setUTCHours(d.getUTCHours() + i);
    else if (unit === 'month') d.setUTCMonth(d.getUTCMonth() + i);
    else d.setUTCDate(d.getUTCDate() + i);
    buckets.push(d);
  }
  return buckets;
}

module.exports = { getDateRange, dateFormatForUnit, keyForDate, buildBuckets };
