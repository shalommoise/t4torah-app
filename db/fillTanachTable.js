const tanachData = require("./data/tanach_index.json");
const tanachTableQuery = `INSERT INTO tanach_table(sefer_name,sefer_name_he,sefer_alt_name,sefer_chapter_count,section,section_he,subsection,subsection_he) 
VALUES ? `;
const tanachTableValues = tanachData.map((sefer)=>{
    const {hebrew,english,alt_name,chapters,section,section_hebrew,subsection,subsection_hebrew } = sefer;
    const entry = [english, hebrew,alt_name,chapters,section,section_hebrew,subsection,subsection_hebrew]
    return entry;
});

const tanachTable = {tanachTableQuery,  tanachTableValues };
module.exports = tanachTable;