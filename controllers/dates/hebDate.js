// using hebdatecal API to get hebrew dates anf shabbos yom tov etc... 
// source link https://www.hebcal.com/home/195/jewish-calendar-rest-api

const axios = require("axios");
const hebDatCalBaseURL = "https://www.hebcal.com/hebcal?v=1&cfg=json";

const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Shabbos'];
const yomTovs = ["15th of Nissan", "16th of Nissan", "21st of Nissan", "22nd of Nissan", "6th of Sivan", "7th of Sivan", "1st of Tishrei",
    "2nd of Tishrei", "10th of Tishrei","15th of Tishrei", "16th of Tishrei", "22nd of Tishrei", "23rd of Tishrei"
]

const removeApostraphes =(str)=>{
    return str.split("'").join("").split("׳").join("").split('״').join("");
}
const checkIfYomTov = (titleDate) =>{
     return yomTovs.includes(titleDate);
}

exports.getDateRange = (start, end) => {
  return  axios.get(`${hebDatCalBaseURL}&start=${start}&end=${end}&d=on`)
    .then((res)=>{
      const {items} = res.data;
   const toSend =  items.map((item)=>{return {
        title: removeApostraphes(item.title),
        date: item.date,
        hdate: removeApostraphes(item.hdate),
        dayOfWeek:  weekdays[new Date(item["date"]).getDay()],
        hebrewDate: removeApostraphes(item.hebrew),
        isYomTov: checkIfYomTov(item.title)
    }});
    return toSend;
   
    }).catch((err)=>console.log(err))
}
