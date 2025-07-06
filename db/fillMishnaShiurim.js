const mishnayosShiurimTitles = require("./data/tim4mishna_shiurim_titles.json");
'INSERT INTO masechta_table(masechta_name,alt_names,number_of_perakim,number_of_mishnayos,seder_id)VALUES';
// 
let shiurimQuery = 'INSERT INTO time4mishna_shiurim(shiur_title)VALUES';
const createMishnaShiurimQuery = (mishnayosShiurimTitles)=>{
    mishnayosShiurimTitles.forEach(shiurTitle => {
          shiurimQuery += `(${shiurTitle}),`;
    });
  shiurimQuery = shiurimQuery.substring(0, shiurimQuery.length - 1);
    shiurimQuery+= ";";
    return shiurimQuery;
}

module.exports = createMishnaShiurimQuery;