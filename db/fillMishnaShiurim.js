

const shiurimQuery = `INSERT INTO time4mishna_shiurim(shiur_title)
VALUES ?`;
const shiurimValues = require("./data/tim4mishna_shiurim_titles.json").map((title)=>[title])

const mishnaShiurimTable = {shiurimQuery,shiurimValues}
module.exports = mishnaShiurimTable;