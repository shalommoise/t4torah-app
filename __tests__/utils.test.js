const {parseShiurTitle} = require("../utils/utils")

describe("parseShiurTitle()", ()=>{
    test("parseShiurTitle empty",()=>{
        const emptyStr = ''
         expect(parseShiurTitle(emptyStr)).toBeNull();
    })
    test("parse regular shiur ", ()=>{
        const standardShiur = "Brachos 1:1-1:4";
        expect(parseShiurTitle(standardShiur)).toEqual({
            firstMasechta: "Brachos",
            firstPerek: 1,
            firstMishna:1,
            lastMasechta: "Brachos",
            lastPerek:1,
            lastMishna:4
        })
    })
    test("parse shiur with two maschetos", ()=>{
        const shiurName = "Brachos 9:5-Peah 1:3";
        expect(parseShiurTitle(shiurName)).toEqual({
            firstMasechta: "Brachos",
            firstPerek: 9,
            firstMishna:5,
            lastMasechta: "Peah",
            lastPerek:1,
            lastMishna:3
        })
    })
})