const sedarimNames = require("../data/sedarimNames.json");
const  masechtaNames = require("../data/masechtaNames.json");
const masechtaMoreInfo = require("../data/mishnaIndex.json");

let mesachtaTableQuery = 'INSERT INTO masechta_table(masechta_name,alt_names,number_of_perakim,number_of_mishnayos,seder_id)VALUES';

for (let i =0; i< masechtaNames.length;i++) {
const mainMaschtaName = masechtaNames[i][0];
const sederNameOfMasechta = masechtaNames[i][1];
const sederId = sedarimNames.indexOf(sederNameOfMasechta);
const singleMasechetInfo = masechtaMoreInfo.filter((masechtaInfo)=>{return masechtaInfo.masechtaId === i+1})[0];
const {masechtaNameAlt,masechtaNameAltHe,perakimNumber,mishnayosNumber} = singleMasechetInfo; 

mesachtaTableQuery +=`('${mainMaschtaName}','${masechtaNameAlt} | ${masechtaNameAltHe}',${perakimNumber},${mishnayosNumber},${sederId}),`;
}

mesachtaTableQuery = mesachtaTableQuery.substring(0, mesachtaTableQuery.length - 1);
    mesachtaTableQuery+= ";";
module.exports = mesachtaTableQuery;
