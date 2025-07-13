const sedarimNames = require("./data/sedarimNames.json");
const  masechtaNames = require("./data/masechtaNames.json");
const masechtaMoreInfo = require("./data/mishnaIndex.json");

const mesachtaTableQuery = `INSERT INTO masechta_table(masechta_name,alt_names,number_of_perakim,number_of_mishnayos,seder_id) 
VALUES ? `;
const masechtaTableValues = [];
for (let i =0; i< masechtaNames.length;i++) {
const mainMaschtaName = masechtaNames[i][0];
const sederNameOfMasechta = masechtaNames[i][1];
const sederId = sedarimNames.indexOf(sederNameOfMasechta);
const singleMasechetInfo = masechtaMoreInfo.filter((masechtaInfo)=>{return masechtaInfo.masechtaId === i+1})[0];
const {masechtaNameAlt,masechtaNameAltHe,perakimNumber,mishnayosNumber} = singleMasechetInfo; 
masechtaTableValues.push([mainMaschtaName,`${masechtaNameAlt} | ${masechtaNameAltHe}`,perakimNumber,mishnayosNumber,sederId])
// mesachtaTableQuery +=`('${mainMaschtaName}','${masechtaNameAlt} | ${masechtaNameAltHe}',${perakimNumber},${mishnayosNumber},${sederId}),`;
}

// mesachtaTableQuery = mesachtaTableQuery.substring(0, mesachtaTableQuery.length - 1);
//     mesachtaTableQuery+= ";";
const masechtaTable = {mesachtaTableQuery,  masechtaTableValues }
module.exports = masechtaTable;
