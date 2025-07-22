const parseShiurTitle = (title) => {
    if (!title) return {};
    const result = {};
    const arr = title.split(" ");
    result["masechta"] = arr[0];
    const numbers = arr[1].split("-")
    const first = numbers[0].split(":");
    result["firstPerek"] = Number(first[0]);
    result["firstMishna"] = Number(first[1]);
    const second = numbers[1].split(":");
    result["lastPerek"] = Number(second[0]);
    result["lastMishna"] = Number(second[1]);
    return result;
}



module.exports = { parseShiurTitle }