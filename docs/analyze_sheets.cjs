const fs = require('fs');
const path = require('path');

function getColumnIndex(ref) {
  let match = ref.match(/[A-Z]+/)[0];
  let col = 0;
  for (let i = 0; i < match.length; i++) {
    col = col * 26 + (match.charCodeAt(i) - 64);
  }
  return col - 1;
}

function parseSheet(dir) {
  const stringsRaw = fs.readFileSync(path.join(dir, 'xl', 'sharedStrings.xml'), 'utf-8');
  const strings = [];
  let tMatch;
  const tRegex = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;
  while ((tMatch = tRegex.exec(stringsRaw)) !== null) {
    strings.push(tMatch[1]);
  }
  
  const sheetRaw = fs.readFileSync(path.join(dir, 'xl', 'worksheets', 'sheet1.xml'), 'utf-8');
  const rows = sheetRaw.split('<row').slice(1);
  
  function getRowData(rowStr) {
    const data = {};
    const fullCRegex = /<c\s+([^>]*)>(?:<v>(.*?)<\/v>)?/g;
    let matches = rowStr.matchAll(fullCRegex);
    for (let m of matches) {
        let attrs = m[1];
        let val = m[2];
        let rMatch = attrs.match(/r="([A-Z]+)[0-9]+"/);
        if (!rMatch) continue;
        let colName = rMatch[1];
        let isString = attrs.includes('t="s"');
        if (val === undefined) continue;
        if (isString) {
            data[colName] = strings[parseInt(val, 10)];
        } else {
            data[colName] = val;
        }
    }
    return data;
  }

  const headers = getRowData(rows[0]);
  const firstData = getRowData(rows[1]);

  const colNames = Object.keys(headers).sort((a,b) => getColumnIndex(a) - getColumnIndex(b));
  
  colNames.forEach(col => {
     console.log(`${col} -> ${headers[col]}: ${firstData[col] || '(empty)'}`);
  });
}

console.log("### BGG1TOOL_RESULT ###");
parseSheet('c:/board-game-score-pad/docs/bgg1tool_extracted');
console.log("\n### BGGCOLLECTION ###");
parseSheet('c:/board-game-score-pad/docs/bggcoll_extracted');
