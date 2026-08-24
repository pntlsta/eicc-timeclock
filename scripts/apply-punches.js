// Parses one command per line from the GitHub Issue body and mutates
// data/punches.json. Run by .github/workflows/process-punches.yml
// on every new issue.
//
// Commands:
//   punch add TYPE YYYY-MM-DD HH:MM
//   punch edit ID YYYY-MM-DD HH:MM
//   punch delete ID
// TYPE is one of: in, lunchout, lunchin, out

const fs = require('fs');
const path = require('path');

const PUNCHES_PATH = path.join(__dirname, '..', 'data', 'punches.json');
const RESULTS_PATH = path.join(__dirname, '..', 'command-results.txt');

const data = fs.existsSync(PUNCHES_PATH)
  ? JSON.parse(fs.readFileSync(PUNCHES_PATH, 'utf8'))
  : { punches: [] };

const VALID_TYPES = ['in', 'lunchout', 'lunchin', 'out'];

function nextId() {
  const nums = data.punches.map(p => {
    const m = String(p.id).match(/^p(\d+)$/);
    return m ? parseInt(m[1], 10) : 0;
  });
  const max = nums.length ? Math.max(...nums) : 0;
  return `p${max + 1}`;
}

const results = [];
const lines = (process.env.ISSUE_BODY || '').split('\n').map(l => l.trim()).filter(Boolean);

for (const line of lines) {
  try {
    let m;

    // punch add TYPE YYYY-MM-DD HH:MM
    if ((m = line.match(/^punch\s+add\s+(in|lunchout|lunchin|out)\s+(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s*$/i))) {
      const [, type, date, time] = m;
      const id = nextId();
      data.punches.push({ id, type: type.toLowerCase(), date, time });
      results.push(`OK: added ${type} punch on ${date} at ${time} (${id})`);
      continue;
    }

    // punch edit ID YYYY-MM-DD HH:MM
    if ((m = line.match(/^punch\s+edit\s+(p\d+)\s+(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2})\s*$/i))) {
      const [, id, date, time] = m;
      const punch = data.punches.find(p => p.id === id);
      if (!punch) { results.push(`FAILED: "${line}" — punch ${id} not found`); continue; }
      punch.date = date;
      punch.time = time;
      results.push(`OK: updated ${id} to ${date} ${time}`);
      continue;
    }

    // punch delete ID
    if ((m = line.match(/^punch\s+delete\s+(p\d+)\s*$/i))) {
      const id = m[1];
      const before = data.punches.length;
      data.punches = data.punches.filter(p => p.id !== id);
      results.push(data.punches.length < before ? `OK: deleted ${id}` : `FAILED: punch ${id} not found`);
      continue;
    }

    results.push(`FAILED: "${line}" — didn't match any known command syntax`);
  } catch (err) {
    results.push(`FAILED: "${line}" — ${err.message}`);
  }
}

fs.writeFileSync(PUNCHES_PATH, JSON.stringify(data, null, 2));
fs.writeFileSync(RESULTS_PATH, results.length ? results.join('\n') : 'No commands found in issue body.');
console.log(results.join('\n'));
