---
name: check-travel
description: Verify that TRAVEL[dayId] array lengths in app.js match the <tr> count per day in index.html. Use after adding/removing rows from the itinerary.
---

The travel badges only render if `TRAVEL[day-N].length` equals the number of `<tr>` in that day's `<table>`. When the arrays drift, you silently lose badges on rows after the shift.

Run this Node check and fix any drift before shipping:

```bash
cat > /tmp/count-rows.mjs <<'EOF'
import fs from 'fs';
const html = fs.readFileSync('C:/Users/saigon-trip/index.html', 'utf8');
const dayStarts = [];
const rx = /<details[^>]*id="(day-\d+)"/g;
let m;
while ((m = rx.exec(html)) !== null) dayStarts.push({ id: m[1], start: m.index });
for (let i = 0; i < dayStarts.length; i++) {
  const start = dayStarts[i].start;
  const end = i + 1 < dayStarts.length ? dayStarts[i+1].start : html.indexOf('<footer>');
  const section = html.slice(start, end);
  const tableMatch = section.match(/<table>([\s\S]*?)<\/table>/);
  const trs = tableMatch ? (tableMatch[1].match(/<tr[^>]*>/g) || []).length : 0;
  console.log(dayStarts[i].id + ': ' + trs + ' rows');
}

const js = fs.readFileSync('C:/Users/saigon-trip/app.js', 'utf8');
const daySections = js.match(/'day-\d+':\s*\[[\s\S]*?\]/g) || [];
for (const ds of daySections) {
  const id = ds.match(/'(day-\d+)'/)[1];
  const items = (ds.match(/(?:\{[^}]*\}|null)/g) || []).length;
  console.log(id + ' TRAVEL: ' + items + ' entries');
}
EOF
node /tmp/count-rows.mjs
```

Each `day-N` row count must equal its `TRAVEL` entry count. If you added a row and forgot to add a corresponding travel entry, every badge after that row shifts one slot earlier — and the last row's badge disappears because the array is too short. Fix by editing `TRAVEL` in `app.js` to the correct length.
