 const dropTable =(tableName) =>{
    let dropStr = `DROP TABLE IF EXISTS ${tableName};`;
    return dropStr;
 }

const createTable =(tableName, fields,extraInfo )=>{
    let createStr = `CREATE TABLE ${tableName}(`;
    fields.forEach(field => {
        createStr += field.field_name + " " + field.type;
        if(field.extra_info) createStr += " " + field.extra_info;
        createStr += "\n";
        });
       if(extraInfo) createStr += extraInfo;
       createStr += ");";
       return createStr;
}

module.exports = {
    dropTable,createTable
}

