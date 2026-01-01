const parseShiurTitle = (title) => {
    if (!title) return {};
    const result = {};
    const arr = title.split(" ");

    if (/[a-zA-Z]/.test(arr[1])) {
        // case with two Masechtos
        result["firstMasechta"] = arr[0];
        result["lastMasechta"] = arr[1].split("-")[1];
        const first = arr[1].split("-")[0].split(":");
        result["firstPerek"] = Number(first[0]);
        result["firstMishna"] = Number(first[1]);
        const second = arr[2].split(":");
        result["lastPerek"] = Number(second[0]);
        result["lastMishna"] = Number(second[1]);
    }
    else {
        // regular case
        result["firstMasechta"] = arr[0];
        result["lastMasechta"] = arr[0];
        const numbers = arr[1].split("-")
        const first = numbers[0].split(":");
        result["firstPerek"] = Number(first[0]);
        result["firstMishna"] = Number(first[1]);
        const second = numbers[1].split(":");
        result["lastPerek"] = Number(second[0]);
        result["lastMishna"] = Number(second[1]);
    }
    // end of regular case
    return result;
}

const  dbFriendlyTitle = (title) => {
  if (!title) return '';
  
  return title
    .trim()
    .replace(/\s+/g, '_')          // spaces → underscores
    .replace(/[^a-zA-Z0-9_]/g, '') // remove non-alphanumeric / underscore
    .toLowerCase();
}




module.exports = { parseShiurTitle,dbFriendlyTitle }