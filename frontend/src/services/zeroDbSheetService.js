/**
 * ════════════════════════════════════════════════════════════════════════════
 * ZERO-DATABASE GOOGLE SHEET & LOCAL CLIENT-SERVICE
 * ════════════════════════════════════════════════════════════════════════════
 * 
 * Provides seamless zero-database operation:
 * - Reads attendee records directly from Google Sheets (CSV feed or Apps Script)
 * - Persists real-time gate check-in logs in Browser Storage (IndexedDB/LocalStorage)
 * - Generates instant offline CSV exports
 */

const LOCAL_STORAGE_KEY_CHECKINS = 'hs26_zero_db_checkins';
const LOCAL_STORAGE_KEY_REGISTRANTS = 'hs26_zero_db_cached_registrants';
const LOCAL_STORAGE_KEY_SHEET_URL = 'hs26_zero_db_sheet_csv_url';

/**
 * Parse CSV text into array of JSON objects
 */
export function parseCSV(csvText) {
  if (!csvText) return [];
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) return [];

  // Parse header line
  const headers = lines[0].split(',').map((h) => h.replace(/^["']|["']$/g, '').trim());

  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const row = [];
    let insideQuotes = false;
    let currentCell = '';

    for (let char of lines[i]) {
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === ',' && !insideQuotes) {
        row.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());

    if (row.length > 0) {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header] = (row[index] || '').replace(/^["']|["']$/g, '');
      });
      records.push(obj);
    }
  }

  return records;
}

/**
 * Normalize Google Sheet row object to standard HackSeries attendee model
 */
export function mapSheetRowToRegistrant(row, index) {
  const keys = Object.keys(row);
  const findVal = (keywords) => {
    for (let k of keys) {
      const lower = k.toLowerCase();
      for (let kw of keywords) {
        if (lower.includes(kw)) return row[k];
      }
    }
    return '';
  };

  const name = findVal(['name', 'full name', 'attendee']) || `Hacker #${index + 1}`;
  const email = findVal(['email', 'mail']) || '';
  const phone = findVal(['phone', 'contact', 'mobile']) || '';
  const uniqueId = findVal(['unique id', 'pass id', 'id', 'ticket id']) || `HS26-${String(index + 1).padStart(4, '0')}`;
  const track = findVal(['track', 'category', 'domain']) || 'AI & Web3 Innovation';
  const teamName = findVal(['team', 'team name', 'group']) || '';
  const institution = findVal(['college', 'institution', 'university']) || 'DYP DPU Pune';
  const verificationRaw = findVal(['verification', 'status', 'verified']) || 'Pending';
  const emailSentRaw = findVal(['pass emailed', 'email sent']) || 'NO';
  const checkedInRaw = findVal(['gate check-in', 'check-in', 'attended']) || 'NO';

  const isVerified = verificationRaw.toLowerCase().includes('verified') || verificationRaw.toLowerCase() === 'yes';
  const isEmailSent = emailSentRaw.toLowerCase().includes('yes');
  const isCheckedIn = checkedInRaw.toLowerCase().includes('yes');

  return {
    _id: uniqueId,
    uniqueId,
    name,
    email,
    phone,
    track,
    teamName,
    institution,
    ticketType: 'Hacker Pass',
    verified: isVerified,
    verificationStatus: isVerified ? 'Verified' : 'Pending',
    emailSent: isEmailSent,
    checkedIn: isCheckedIn,
    createdAt: new Date().toISOString(),
  };
}

export const zeroDbService = {
  getStoredSheetUrl() {
    return localStorage.getItem(LOCAL_STORAGE_KEY_SHEET_URL) || '';
  },

  setStoredSheetUrl(url) {
    if (url) localStorage.setItem(LOCAL_STORAGE_KEY_SHEET_URL, url.trim());
    else localStorage.removeItem(LOCAL_STORAGE_KEY_SHEET_URL);
  },

  getOfflineCheckins() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_CHECKINS) || '{}');
    } catch {
      return {};
    }
  },

  saveOfflineCheckin(uniqueId, details = {}) {
    const checkins = this.getOfflineCheckins();
    checkins[uniqueId] = {
      uniqueId,
      checkedIn: true,
      checkedInAt: new Date().toISOString(),
      checkedInBy: details.scannedBy || 'Gate Scanner Operator',
      photo: details.photo || null,
      ...details,
    };
    localStorage.setItem(LOCAL_STORAGE_KEY_CHECKINS, JSON.stringify(checkins));
    return checkins[uniqueId];
  },

  undoOfflineCheckin(uniqueId) {
    const checkins = this.getOfflineCheckins();
    delete checkins[uniqueId];
    localStorage.setItem(LOCAL_STORAGE_KEY_CHECKINS, JSON.stringify(checkins));
  },

  async fetchRegistrantsFromSheet(sheetUrl) {
    const urlToUse = sheetUrl || this.getStoredSheetUrl();
    if (!urlToUse) {
      // Return cached local registrants if available
      try {
        const cached = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_REGISTRANTS) || '[]');
        return this.mergeWithOfflineCheckins(cached);
      } catch {
        return [];
      }
    }

    try {
      const response = await fetch(urlToUse);
      const csvText = await response.text();
      const rawRows = parseCSV(csvText);
      const registrants = rawRows.map(mapSheetRowToRegistrant);

      // Cache locally
      localStorage.setItem(LOCAL_STORAGE_KEY_REGISTRANTS, JSON.stringify(registrants));

      return this.mergeWithOfflineCheckins(registrants);
    } catch (err) {
      console.warn('Could not fetch remote sheet, using local cached version:', err.message);
      const cached = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY_REGISTRANTS) || '[]');
      return this.mergeWithOfflineCheckins(cached);
    }
  },

  mergeWithOfflineCheckins(registrants) {
    const checkins = this.getOfflineCheckins();
    return registrants.map((reg) => {
      if (checkins[reg.uniqueId]) {
        return {
          ...reg,
          checkedIn: true,
          checkedInAt: checkins[reg.uniqueId].checkedInAt,
          checkedInBy: checkins[reg.uniqueId].checkedInBy,
          checkedInPhoto: checkins[reg.uniqueId].photo,
        };
      }
      return reg;
    });
  },

  exportCheckinsCSV() {
    const checkins = Object.values(this.getOfflineCheckins());
    const headers = ['Unique ID', 'Attendee Name', 'Email', 'Checked In Time', 'Scanned By'];
    const rows = checkins.map((c) => [
      c.uniqueId,
      `"${(c.name || '').replace(/"/g, '""')}"`,
      c.email || '',
      c.checkedInAt || '',
      c.checkedInBy || '',
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `hackseries-2026-gate-checkins-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};
