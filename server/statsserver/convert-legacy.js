// Одноразовая конвертация старых ../rating/*.txt в data/records/{serverId}.json.
// Запуск: node convert-legacy.js
import { loadRecords, mergeLegacyIntoRecords, saveRecords } from "./records.js";

const records = loadRecords();
const added = mergeLegacyIntoRecords(records);
saveRecords(records);
console.log(`Converted legacy rating files: ${added} records added/updated.`);
console.log(`Output: statsserver/data/records/{serverId}.json`);