const masechtaInfo = require("./data/mishnaIndex.json").sort((a, b) => a.masechtaId - b.masechtaId);
const { getMaschetaPerek } = require("../SefariaUtils/getmishnayos");
const fs = require("fs")
const numberOfMasechtos = masechtaInfo.length;
const mishnayos = [];
const writeAllMishnaFile = (arr) => {
    const text = JSON.stringify(arr);
    fs.writeFileSync("./db/data/mishnayos.json", text)
    console.log("file written")
}

const getmasechtaByPerek = (masechtaName, perek, perakimNumber, masechtaId, iteration) => {
    return getMaschetaPerek(masechtaName, perek).then((mishnaTextObj) => {
        return mishnaTextObj;
    }).then((res) => {
        const hebText = res[`${masechtaName}_perek_${perek}`]["he"];
        hebText.forEach((mishna, index) => {
            const mishnaTosSend = {
                masechtaId, perek, mishnaNumber: index + 1, mishnaText: mishna
            }
            mishnayos.push(mishnaTosSend);
            // mishnaQuery += `(${masechtaId},${perek},${index + 1},'${mishna}'),`;
        });
        if (perek < perakimNumber) {
            console.log(perakimNumber, perek, masechtaName)
            perek += 1;
            return getmasechtaByPerek(masechtaName, perek, perakimNumber, masechtaId, iteration)
        } else {
            console.log("finished fetching mishnayos for " + masechtaName)
            if (iteration < numberOfMasechtos - 1) {
                iteration += 1;
                return addAllMasechtos(iteration)
            } else {
                console.log("Finishing fetching mishnayos for all masechtos!")
                writeAllMishnaFile(mishnayos);

            }
        }
    });
}
const addAllMasechtos = (iteration) => {

    const { masechtaNameAlt, masechtaId, perakimNumber } = masechtaInfo[iteration];
    return getmasechtaByPerek(masechtaNameAlt, perek = 1, perakimNumber, masechtaId, iteration)
}
// run func to create mishnayos file
addAllMasechtos(0)





