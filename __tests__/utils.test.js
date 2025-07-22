const {parseShiurTitle} = require("../utils/utils")

describe("parseShiurTitle()", ()=>{
    test("parseShiurTitle empty",()=>{
        const emptyStr = ''
         expect(parseShiurTitle(emptyStr)).toEqual({});
    })
    test("parse regular shiur ", ()=>{
        const standardShiur = "Brachos 1:1-1:4";
        expect(parseShiurTitle(standardShiur)).toEqual({
            masechta: "Brachos",
            firstPerek: 1,
            firstMishna:1,
            lastPerek:1,
            lastMishna:4
        })
    })
})