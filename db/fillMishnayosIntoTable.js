const masechtaInfo = require("./data/mishnaIndex.json").sort((a, b) => a.masechtaId - b.masechtaId);
const { getMaschetaPerek } = require("../SefariaUtils/getmishnayos")
let mishnaQuery = 'INSER INTO mishnayos_table(masechta_id,perek,mishna,mishna_text)VALUES';
const numberOfMasechtos = masechtaInfo.length;
const getmasechtaByPerek = (masechtaName, perek, perakimNumber, masechtaId, iteration) => {
    return getMaschetaPerek(masechtaName, perek).then((mishnaTextObj) => {
        return mishnaTextObj;
    }).then((res) => {
        const hebText = res[`${masechtaName}_perek_${perek}`]["he"];
        hebText.forEach((mishna, index) => {
            mishnaQuery += `(${masechtaId},${perek},${index + 1},'${mishna}'),`;
        });
        if (perek < perakimNumber) {
            console.log(perakimNumber, perek, masechtaName)
            perek += 1;
            return getmasechtaByPerek(masechtaName, perek, perakimNumber, masechtaId, iteration)
        } else {
            console.log("finished fetching mishnayos for" + masechtaName)
            if (iteration < numberOfMasechtos - 1) {
                iteration += 1;
                return addAllMasechtos(iteration)
            } else {
                console.log("Finishing fetching mishnayos for all masechtos!")
                mishnaQuery = mishnaQuery.substring(0, mishnaQuery.length - 1);
                mishnaQuery += ";";
                return mishnaQuery;
            }
        }
    });
}
const addAllMasechtos = (iteration) => {
    const { masechtaNameAlt, masechtaId, perakimNumber } = masechtaInfo[iteration];
    return getmasechtaByPerek(masechtaNameAlt, perek = 1, perakimNumber, masechtaId, iteration)
}

module.exports = addAllMasechtos;
