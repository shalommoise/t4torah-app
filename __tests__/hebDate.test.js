const { execFileSync } = require("child_process");
const path = require("path");

// process.env.TZ can't be changed inside a Jest worker, so each check runs in
// a fresh Node process with TZ set. The helper is pure; no request is made.
const hebDatePath = path.join(__dirname, "../controllers/dates/hebDate");

const inTimeZone = (tz, expression) => {
  const script = `const { getDayOfWeek } = require(${JSON.stringify(hebDatePath)});
process.stdout.write(JSON.stringify(${expression}));`;
  const out = execFileSync(process.execPath, ["-e", script], {
    env: { ...process.env, TZ: tz },
  });
  return JSON.parse(out.toString());
};

describe("getDayOfWeek()", () => {
  test("maps a Saturday to Shabbos on a server behind UTC", () => {
    // Guard: local getDay() gives Friday (5) here, so the TZ is in effect.
    expect(inTimeZone("America/New_York", `new Date("2026-10-03").getDay()`)).toBe(5);
    expect(inTimeZone("America/New_York", `getDayOfWeek("2026-10-03")`)).toBe("Shabbos");
  });

  test("maps a Friday to Friday on a server ahead of UTC", () => {
    expect(inTimeZone("Asia/Jerusalem", `getDayOfWeek("2026-10-02")`)).toBe("Friday");
  });

  test("maps a Sunday to Sunday in UTC", () => {
    expect(inTimeZone("UTC", `getDayOfWeek("2026-10-04")`)).toBe("Sunday");
  });
});
