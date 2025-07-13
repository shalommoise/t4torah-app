const mishnayos = require("./data/mishnayos.json")

    const mishnayosQuery = `INSERT INTO mishnayos_table(masechta_id,perek,mishna,mishna_text)
     VALUES   (?, ?, ?, ?)
`;

const mishnayosValues = mishnayos.map((mishnaEntry)=>{
    return Object.values(mishnaEntry);
})

const mishnaTable = {mishnayosQuery,mishnayosValues}
module.exports = mishnaTable;