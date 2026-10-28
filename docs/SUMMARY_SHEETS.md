# Summary sheets

Summary and diagram PDFs for Time4Mishna. Each file is stored separately in the bucket and recorded in the `summary_sheets` table with the range of mishnayos it covers, so a PDF for any chazara schedule can be put together from the files that overlap its range.

## Data model

`summary_sheets` (see `db/setup.sql`; on an existing database run `db/migrations/001_summary_sheets.sql` once):

| column | meaning |
| --- | --- |
| `kind` | `summary`, `diagram`, `chart`, `overview`, `key_terms`, `cover` (title page), `mikra` (the pesukim), `test` or `back_matter` |
| `start_mishna`, `end_mishna` | `mishnayos_table.mishna_id` range the file covers (can cross perakim) |
| `part` | order when several files cover the same range (e.g. a perek in two PDFs) |
| `bucket_key` | path in the bucket, under `mishna/summaries/sheets/<Masechta>/` |
| `source_ref` | the file's path in the inventory (where it came from on Drive) |

Masechtos with no sheets simply have no rows. To find the sheets for a range, use `selectSummarySheetsForRange(startMishnaId, endMishnaId)` in `src/models/summarySheetModel.js`. It returns every sheet that overlaps the range, in learning order. A sheet that only partly overlaps is included whole.

The migration also adds `mishnayos_table.needs_diagram`, a to-do flag. It only marks which mishnayos should have a diagram. A diagram exists when there's a `kind = 'diagram'` row covering that mishna. To list the diagrams still missing:

```sql
SELECT m.mishna_id, m.masechta_id, m.perek, m.mishna FROM mishnayos_table m
WHERE m.needs_diagram AND NOT EXISTS (
  SELECT 1 FROM summary_sheets s
  WHERE s.kind = 'diagram' AND m.mishna_id BETWEEN s.start_mishna AND s.end_mishna
);
```

## Importing from Drive

1. **Download** the Drive folder (or the part you're doing) to a local folder, e.g. `~/summaries-drive`.
2. **Fill in the inventory.** Copy `db/data/summary_sheets_template.csv` into a Google Sheet and add one row per PDF, then download it as CSV. Columns:
   - `file`: path relative to the downloaded folder, e.g. `Bava Kama/Perek 2 page 1.pdf`
   - `masechta`: as in `masechta_table` (`Bava Kama`; case and `-`/`_` for spaces don't matter). For material that covers a whole seder (its cover, chart, key terms), put the seder name (`Zeraim` or `Seder Zeraim`) and leave start and end empty. It's filed under `Seder-Zeraim/`.
   - `start`, `end`: `3` (whole perek: a start means its first mishna, an end its last) or `3:4`. Leave both empty for the whole masechta.
   - `kind`: empty means `summary`
   - `part`: empty means `1`. Number the files when one range is split across several PDFs.
   - any other column (e.g. `notes`) is ignored
3. **Check it** (the default is a dry run: it reads the database and the files, and writes nothing):
   ```
   npm run import:summaries -- inventory.csv --files=~/summaries-drive
   ```
   Every problem is listed by spreadsheet row number: an unknown masechta, a perek or mishna that doesn't exist, start after end, a missing file, or two rows with the same masechta, kind, range and part. Fix the sheet and run it again.
4. **Import:**
   ```
   npm run import:summaries -- inventory.csv --files=~/summaries-drive --out=~/summaries-upload --dry-run=false
   ```
   This copies each file to `~/summaries-upload/<bucket key>` and upserts its row. If any row has an error, nothing is written. Re-running is safe, because rows are keyed by bucket key. Use a staging folder outside the repo.
5. **Upload** the contents of the staging folder to the bucket root, keeping the folder structure. Use the same tool you use for the other bucket files.
6. **Verify** that every recorded file is reachable at `BUCKET_PATH`:
   ```
   npm run import:summaries -- --check-bucket
   ```
   It exits 1 and lists the URLs of any files that are missing.

Bucket keys look like `mishna/summaries/sheets/Bava-Kama/Bava-Kama_summary_3_to_4_1.pdf` (masechta, kind, range as written in the inventory, part). They're separate from the existing per-masechta `mishna/summaries/<Masechta>-Overview.pdf` / `-Key-Terms.pdf` files that the daily email links to. Those files are unchanged.

Ranges are written into the key exactly as given in the inventory. So `3`–`3` and `3:1`–`3:8` give different keys even if they cover the same mishnayos. Use one style consistently for each masechta.
