// Sunrise and sunset from NOAA's solar calculator equations (the "General Solar Position"
// spreadsheet: Julian century, equation of time and solar declination, with the sun's center at a
// zenith of 90.833 degrees for atmospheric refraction and the sun's disc). Accurate to about a
// minute between latitudes 72 N and 72 S. See design D9.

const RAD = Math.PI / 180;
const sin = (deg: number) => Math.sin(deg * RAD);
const cos = (deg: number) => Math.cos(deg * RAD);
const tan = (deg: number) => Math.tan(deg * RAD);
const SUNRISE_ZENITH = 90.833;

/** Equation of time in minutes and solar declination in degrees, `t` Julian centuries after J2000. */
function solarPosition(t: number): { equationOfTime: number; declination: number } {
  const meanLongitude = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360;
  const meanAnomaly = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);
  const center =
    sin(meanAnomaly) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    sin(2 * meanAnomaly) * (0.019993 - 0.000101 * t) +
    sin(3 * meanAnomaly) * 0.000289;
  const omega = 125.04 - 1934.136 * t;
  const apparentLongitude = meanLongitude + center - 0.00569 - 0.00478 * sin(omega);
  const meanObliquity = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliquity = meanObliquity + 0.00256 * cos(omega);
  const declination = Math.asin(sin(obliquity) * sin(apparentLongitude)) / RAD;
  const y = tan(obliquity / 2) ** 2;
  const equationOfTime =
    4 *
    ((y * sin(2 * meanLongitude) -
      2 * eccentricity * sin(meanAnomaly) +
      4 * eccentricity * y * sin(meanAnomaly) * cos(2 * meanLongitude) -
      0.5 * y * y * sin(4 * meanLongitude) -
      1.25 * eccentricity * eccentricity * sin(2 * meanAnomaly)) /
      RAD);
  return { equationOfTime, declination };
}

/** Julian centuries since J2000.0 at `ms` (milliseconds since the Unix epoch). */
const julianCentury = (ms: number) => (ms / 86400000 + 2440587.5 - 2451545) / 36525;

export interface SunTimes {
  /** Null when the sun doesn't rise that day (polar night) or doesn't set (midnight sun). */
  sunrise: Date | null;
  sunset: Date | null;
}

/**
 * Sunrise and sunset on the calendar day of `date` (its year, month and day, in the browser's time
 * zone) at a place west or east of Greenwich. The times are instants: format them for display.
 */
export function sunTimes(date: Date, latitude: number, longitude: number): SunTimes {
  const dayStart = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  // Solar noon in minutes after 00:00 UTC on that day, refined once at the noon itself.
  let noon = 720 - 4 * longitude;
  noon = 720 - 4 * longitude - solarPosition(julianCentury(dayStart + noon * 60000)).equationOfTime;
  const { declination } = solarPosition(julianCentury(dayStart + noon * 60000));
  const cosHourAngle = cos(SUNRISE_ZENITH) / (cos(latitude) * cos(declination)) - tan(latitude) * tan(declination);
  if (cosHourAngle > 1 || cosHourAngle < -1) return { sunrise: null, sunset: null };
  const hourAngle = Math.acos(cosHourAngle) / RAD;
  // Rise and set are worked out at their own times, which moves them by a few seconds.
  const at = (minutes: number, sign: 1 | -1): Date => {
    const position = solarPosition(julianCentury(dayStart + minutes * 60000));
    const cosH = cos(SUNRISE_ZENITH) / (cos(latitude) * cos(position.declination)) - tan(latitude) * tan(position.declination);
    const h = Math.acos(Math.max(-1, Math.min(1, cosH))) / RAD;
    return new Date(dayStart + (720 - 4 * longitude - position.equationOfTime + sign * 4 * h) * 60000);
  };
  return { sunrise: at(noon - 4 * hourAngle, -1), sunset: at(noon + 4 * hourAngle, 1) };
}
