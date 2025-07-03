const axios = require("axios");

const axiosInstance = axios.create({
    baseURL: "https://www.sefaria.org/api",
  });


  const getMaschetaPerek = (masechtaName, perekNumber) =>{
  return axiosInstance
        .get(`/texts/Mishnah_${masechtaName}.${perekNumber}`).
        then((res)=>{
            const {data} = res;
            const {text, he} = data;
           const mishnayosPerek = {[`${masechtaName}_perek_${perekNumber}`]: {text, he} }; ;
           return mishnayosPerek;

        }).catch((err)=>console.log(err))
  }

  module.exports = {getMaschetaPerek}