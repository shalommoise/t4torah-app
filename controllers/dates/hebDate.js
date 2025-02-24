// using hebdatecal API to get hebrew dates anf shabbos yom tov etc... 
// source link https://www.hebcal.com/home/195/jewish-calendar-rest-api

const axios = require("axios");
const hebDatCalBaseURL = "https://www.hebcal.com/hebcal?v=1&cfg=json";

const test = ()=>{
    axios.get(`${hebDatCalBaseURL}&maj=on&min=on&mod=on&nx=on&year=now&month=x&ss=on&mf=on&c=on&geo=geoname&geonameid=3448439&M=on&s=on`)
    .then((res)=>console.log(res.data))
}

exports.getDateRange = (start, end) => {
    axios.get(`${hebDatCalBaseURL}&start=${start}&end=${end}&d=on`)
    .then((res)=>{
      const {items} = res.data;
      console.log(res.data)
    const toSend = items.map((item)=>{return {
        title: item.title,
        date: item.date,
        category: item.date,
        hdate: item.hdate,
        hebrewDate: item.hebrew
    }
    });
    return toSend;
    }).catch((err)=>console.log(err))
}
