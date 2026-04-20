// =============================================
// ICS CALENDAR PARSER
// Parses .ics files and extracts uni classes
// =============================================

/**
 * Parse an ICS file string and return array of uni class objects
 */
export function parseICS(icsString) {
  const events = [];
  const lines = icsString.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  let currentEvent = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Handle line folding (lines starting with space/tab are continuations)
    if ((line.startsWith(' ') || line.startsWith('\t')) && currentEvent) {
      const lastKey = Object.keys(currentEvent).pop();
      if (lastKey) currentEvent[lastKey] += line.slice(1);
      continue;
    }

    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT' && currentEvent) {
      const parsed = parseEvent(currentEvent);
      if (parsed) events.push(...parsed);
      currentEvent = null;
    } else if (currentEvent) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx);
      const value = line.slice(colonIdx + 1);
      currentEvent[key] = value;
    }
  }

  return events;
}

/**
 * Parse a single VEVENT object into one or more uni class entries
 * Handles recurring events (RRULE)
 */
function parseEvent(event) {
  const title = decodeText(event['SUMMARY'] || 'Unnamed Class');
  const location = decodeText(event['LOCATION'] || '');
  const description = decodeText(event['DESCRIPTION'] || '');

  // Parse start/end times
  const dtstart = event['DTSTART'] || event['DTSTART;TZID'] ||
    Object.keys(event).find(k => k.startsWith('DTSTART')) && event[Object.keys(event).find(k => k.startsWith('DTSTART'))];
  const dtend = event['DTEND'] || event['DTEND;TZID'] ||
    Object.keys(event).find(k => k.startsWith('DTEND')) && event[Object.keys(event).find(k => k.startsWith('DTEND'))];

  if (!dtstart) return null;

  const startTime = parseICSTime(dtstart);
  const endTime = dtend ? parseICSTime(dtend) : null;

  if (!startTime) return null;

  // Check for recurring rule
  const rrule = event['RRULE'];
  const days = [];

  if (rrule) {
    // Extract BYDAY from RRULE (e.g. FREQ=WEEKLY;BYDAY=MO,WE)
    const bydayMatch = rrule.match(/BYDAY=([^;]+)/);
    if (bydayMatch) {
      const dayMap = {
        'MO': 'Monday', 'TU': 'Tuesday', 'WE': 'Wednesday',
        'TH': 'Thursday', 'FR': 'Friday', 'SA': 'Saturday', 'SU': 'Sunday'
      };
      const bydays = bydayMatch[1].split(',');
      bydays.forEach(d => {
        const dayName = dayMap[d.replace(/[-\d]/g, '')];
        if (dayName) days.push(dayName);
      });
    }
  }

  // If no recurring days found, use the day from the start date
  if (days.length === 0) {
    const dayFromDate = getDayFromDate(dtstart);
    if (dayFromDate) days.push(dayFromDate);
  }

  if (days.length === 0) return null;

  // Guess class type from title/description
  const classType = guessClassType(title, description);

  // Generate a color based on the title
  const color = generateColor(title);

  return days.map(day => ({
    id: `ics-${Date.now()}-${day}-${Math.random().toString(36).slice(2)}`,
    title: cleanTitle(title),
    classType,
    startTime: startTime.time,
    endTime: endTime ? endTime.time : addHour(startTime.time),
    location: location.slice(0, 50),
    color,
    day,
    enabled: true,
    fromImport: true,
  }));
}

function parseICSTime(dtString) {
  if (!dtString) return null;
  // Remove TZID= prefix if present
  const clean = dtString.replace(/^.*:/, '');
  // Format: 20240101T090000Z or 20240101T090000
  const match = clean.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/);
  if (!match) return null;
  const hours = parseInt(match[4]);
  const mins = parseInt(match[5]);
  return {
    time: `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`,
    hours,
    mins,
  };
}

function getDayFromDate(dtString) {
  if (!dtString) return null;
  const clean = dtString.replace(/^.*:/, '');
  const match = clean.match(/(\d{4})(\d{2})(\d{2})/);
  if (!match) return null;
  const date = new Date(
    parseInt(match[1]),
    parseInt(match[2]) - 1,
    parseInt(match[3])
  );
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay()];
}

function guessClassType(title, description) {
  const text = (title + ' ' + description).toLowerCase();
  if (/lecture|lect|lec/.test(text)) return 'lecture';
  if (/tutorial|tut\b/.test(text)) return 'tutorial';
  if (/lab\b|laboratory/.test(text)) return 'lab';
  if (/seminar|sem\b/.test(text)) return 'seminar';
  if (/exam|test\b|assessment/.test(text)) return 'exam';
  return 'lecture';
}

function cleanTitle(title) {
  // Remove common calendar cruft
  return title
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?\)/g, '')
    .trim()
    .slice(0, 50);
}

function addHour(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const newH = Math.min(h + 1, 23);
  return `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function generateColor(title) {
  const colors = ['#7c6bff', '#06b6d4', '#f59e0b', '#22c55e', '#ef4444', '#ec4899'];
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function decodeText(text) {
  return text
    .replace(/\\n/g, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}