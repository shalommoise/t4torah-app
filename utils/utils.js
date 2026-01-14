const parseShiurTitle = (title) => {
    if (!title) return null;
    const result = {};
    const arr = title.split(" ");
    if (arr.length < 2) return null;

    const parsePerekMishna = (value) => {
        const parts = value.split(":");
        if (parts.length !== 2) return null;
        const perek = Number(parts[0]);
        const mishna = Number(parts[1]);
        if (Number.isNaN(perek) || Number.isNaN(mishna)) return null;
        return { perek, mishna };
    };

    if (/[a-zA-Z]/.test(arr[1])) {
        // case with two Masechtos
        if (arr.length < 3) return null;
        const firstSplit = arr[1].split("-");
        if (firstSplit.length !== 2) return null;
        const first = parsePerekMishna(firstSplit[0]);
        const second = parsePerekMishna(arr[2]);
        if (!first || !second) return null;
        result["firstMasechta"] = arr[0];
        result["lastMasechta"] = firstSplit[1];
        result["firstPerek"] = first.perek;
        result["firstMishna"] = first.mishna;
        result["lastPerek"] = second.perek;
        result["lastMishna"] = second.mishna;
    }
    else {
        // regular case
        const numbers = arr[1].split("-");
        if (numbers.length !== 2) return null;
        const first = parsePerekMishna(numbers[0]);
        const second = parsePerekMishna(numbers[1]);
        if (!first || !second) return null;
        result["firstMasechta"] = arr[0];
        result["lastMasechta"] = arr[0];
        result["firstPerek"] = first.perek;
        result["firstMishna"] = first.mishna;
        result["lastPerek"] = second.perek;
        result["lastMishna"] = second.mishna;
    }
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

const checkForMulitplMasechtos = (first, last)=>{
    const isInvalid = (value) => value == null || typeof value !== "object";
    const hasFields = (value) =>
        value.masechta_id != null && value.perek != null && value.mishna != null;
    if (isInvalid(first) || isInvalid(last) || !hasFields(first) || !hasFields(last)) {
        throw new Error("Not correct format");
    } else if (first.masechta_id === last.masechta_id) {
        return [1, first.masechta_id, `${first.perek}.${first.mishna}`, `${last.perek}.${last.mishna}`]
    } else {
        return [2, first.masechta_id, last.masechta_id,`${first.perek}.${first.mishna}`, `${last.perek}.${last.mishna}`]
    }
}


module.exports = { parseShiurTitle,dbFriendlyTitle,checkForMulitplMasechtos }
