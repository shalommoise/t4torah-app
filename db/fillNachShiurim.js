const tanachData = require("./data/tanach_index.json");
const { dbFriendlyTitle } = require("../utils/utils")

const nachEntries = [];
const nachData = tanachData.slice(5); //igonring Torah books for Nach
// adding custom intro shiurim to spcific places
nachData.unshift({ english: "yehoshua_introduction", order: 6, chapters: 1 });
nachData.unshift({ english: "nach_introduction", order: 6, chapters: 1 });
nachData.splice(3, 0, { english: "shoftim_introduction", order: 7, chapters: 1 });
nachData.splice(5, 0, { english: "shmuel_aleph_introduction", order: 8, chapters: 1 });
nachData.splice(11, 0, { english: "yirmiya_introduction", order: 13, chapters: 1 });
nachData.splice(13, 0, { english: "yechezkel_introduction", order: 13, chapters: 1 });
nachData.splice(28, 0, { english: "mishlei_introduction", order: 28, chapters: 1 });
nachData.splice(30, 0, { english: "iyov_introduction", order: 29, chapters: 1 });
nachData.forEach((sefer) => {
    const { order, english, chapters } = sefer;
    const regex = /introduction/i;
    if (regex.test(english)) {
  const entry = [dbFriendlyTitle(english), order,0];
  nachEntries.push(entry);
    } else {
        for (let i = 1; i <= chapters; i++) {

            const shiurTile = `${dbFriendlyTitle(english)}_${i}`;
            const entry = [shiurTile, order, i];
            nachEntries.push(entry);
        }
    }
});

const nachTableQuery = `INSERT INTO time4nach_shiurim(shiur_title,sefer_id,perek) 
VALUES ? `;

module.exports ={nachTableQuery, nachEntries}



