(function () {
  const DAY_IN_MS = 24 * 60 * 60 * 1000;
  const START = ["sol", "luna", "mars", "mercury", "jupiter", "venus", "saturn"];
  const CHALDEAN = ["saturn", "jupiter", "mars", "sol", "venus", "mercury", "luna"];

  function toTitleCase(value) {
    if (!value) return "";
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function getDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function getCenteredWeekStartDay(date) {
    return (date.getDay() + 4) % 7;
  }

  function minutesBetween(a, b) {
    return (a.getTime() - b.getTime()) / 60000;
  }

  function getMoonPhaseName(phase) {
    if (phase < 0.03 || phase > 0.97) return "New Moon";
    if (phase < 0.22) return "Waxing Crescent";
    if (phase < 0.28) return "First Quarter";
    if (phase < 0.47) return "Waxing Gibbous";
    if (phase < 0.53) return "Full Moon";
    if (phase < 0.72) return "Waning Gibbous";
    if (phase < 0.78) return "Last Quarter";
    return "Waning Crescent";
  }

  function parseMonthDay(monthDay) {
    const [month, day] = monthDay.split("-").map(Number);
    return { month, day };
  }

  function isDateInSign(date, sign) {
    const { month: startMonth, day: startDay } = parseMonthDay(sign.start);
    const { month: endMonth, day: endDay } = parseMonthDay(sign.end);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const wrapsYear = startMonth > endMonth;

    if (!wrapsYear) {
      const afterStart = month > startMonth || (month === startMonth && day >= startDay);
      const beforeEnd = month < endMonth || (month === endMonth && day <= endDay);
      return afterStart && beforeEnd;
    }

    const afterStart = month > startMonth || (month === startMonth && day >= startDay);
    const beforeEnd = month < endMonth || (month === endMonth && day <= endDay);
    return afterStart || beforeEnd;
  }

  function getSignStartDate(date, sign) {
    const { month: startMonth, day: startDay } = parseMonthDay(sign.start);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const wrapsYear = startMonth > parseMonthDay(sign.end).month;

    let year = date.getFullYear();
    if (wrapsYear && (month < startMonth || (month === startMonth && day < startDay))) {
      year -= 1;
    }

    return new Date(year, startMonth - 1, startDay);
  }

  function getSignForDate(date, signs) {
    return signs.find((sign) => isDateInSign(date, sign)) || null;
  }

  function groupDecansBySign(decans) {
    const map = {};
    for (const decan of decans) {
      if (!map[decan.signId]) {
        map[decan.signId] = [];
      }
      map[decan.signId].push(decan);
    }

    for (const signId of Object.keys(map)) {
      map[signId].sort((a, b) => a.index - b.index);
    }
    return map;
  }

  function getDecanForDate(date, signs, decansBySign) {
    const sign = getSignForDate(date, signs);
    if (!sign) return null;

    const signDecans = decansBySign[sign.id] || [];
    if (!signDecans.length) {
      return { sign, decan: null };
    }

    const signStartDate = getSignStartDate(date, sign);
    const daysSinceSignStart = Math.floor((date.getTime() - signStartDate.getTime()) / DAY_IN_MS);
    let index = Math.floor(daysSinceSignStart / 10) + 1;
    if (index < 1) index = 1;
    if (index > 3) index = 3;

    const decan = signDecans.find((entry) => entry.index === index) || signDecans[0];
    return { sign, decan };
  }

  function calcPlanetaryHoursForDayAndLocation(date, geo) {
    const sunCalc = window.SunCalc;
    if (!sunCalc) {
      throw new Error("SunCalc library is not loaded.");
    }

    const solar = sunCalc.getTimes(date, geo.latitude, geo.longitude);
    const nextDay = new Date(date.getTime() + DAY_IN_MS);
    const solarNext = sunCalc.getTimes(nextDay, geo.latitude, geo.longitude);
    const dayOfWeek = date.getDay();
    const chaldeanStartPos = CHALDEAN.indexOf(START[dayOfWeek]);

    const dayHourInMinutes = minutesBetween(solar.sunset, solar.sunrise) / 12;
    const nightHourInMinutes = minutesBetween(solarNext.sunrise, solar.sunset) / 12;

    const hours = [];
    for (let hour = 0; hour < 12; hour += 1) {
      const start = new Date(solar.sunrise.getTime() + dayHourInMinutes * hour * 60_000);
      const end = new Date(start.getTime() + dayHourInMinutes * 60_000);
      hours.push({
        start,
        end,
        planetId: CHALDEAN[(chaldeanStartPos + hour) % 7],
        isDaylight: true
      });
    }

    for (let hour = 12; hour < 24; hour += 1) {
      const start = new Date(solar.sunset.getTime() + nightHourInMinutes * (hour - 12) * 60_000);
      const end = new Date(start.getTime() + nightHourInMinutes * 60_000);
      hours.push({
        start,
        end,
        planetId: CHALDEAN[(chaldeanStartPos + hour) % 7],
        isDaylight: false
      });
    }

    return hours;
  }

  window.TarotCalc = {
    DAY_IN_MS,
    toTitleCase,
    getDateKey,
    getCenteredWeekStartDay,
    getMoonPhaseName,
    groupDecansBySign,
    getDecanForDate,
    calcPlanetaryHoursForDayAndLocation
  };
})();
