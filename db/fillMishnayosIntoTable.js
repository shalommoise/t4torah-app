// CREATE TABLE mishnayos_table (
//     mishna_id INT NOT NULL AUTO_INCREMENT,
//     masechta_id INT,
//     perek INT NOT NULL,
//     mishna INT NOT NULL,
//     mishna_text TEXT NOT NULL,
//     PRIMARY KEY (mishna_id),
//     FOREIGN KEY (masechta_id) REFERENCES masechta_table(masechta_id)
// );
const masechtaInfo = require("./data/mishnaIndex.json").sort((a, b) => a.masechtaId - b.masechtaId);
const {getMaschetaPerek} = require("../SefariaUtils/getmishnayos")
let mishnaQuery = 'INSER INTO mishnayos_table(masechta_id,perek,mishna,mishna_text)VALUES';
let i = 0;

const getmasechtaByPerek = (masechtaName,perek)=>{
    getMaschetaPerek(masechtaName,perek).then((mishnaTextObj)=>{

    })
}