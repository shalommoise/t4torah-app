require('dotenv').config();
const bucketPath = process.env.BUCKET_PATH


const formFileName = (torahProgram,folderType, fileName, fileType)=>{
const filePath = `${bucketPath}/${torahProgram}/${folderType}/${fileName}.${fileType}`;
return filePath;    
}

module.exports = {formFileName}
