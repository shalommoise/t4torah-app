# Time4Mishna Daily Email Template: Fix Steps

This document is a step-by-step plan for bringing the automated daily email template in line with the manual Mailchimp send.

Each step is labelled:

- **CLAUDE CODE:** work Claude Code does in the repo.
- **YOU:** work Shalom does outside the repo (assets, hosting, decisions, testing).

Work through the steps in order. Steps 1 and 5 depend on assets that Shalom must provide first.

---

## Step 0: Locate the template and the content source

**CLAUDE CODE**

1. Find the email template in the repo (search for the HTML you pasted, or for `Time4Mishna` in the email/send code on branch `feature/send-automation`).
2. Find the content query that supplies the daily values (date, Hebrew date, masechta, perek/mishna range, shiur URL, text URL).
3. Report the file paths to Shalom before making changes.

**YOU**

- Confirm the branch to work on (`feature/send-automation`).

---

## Step 1: Replace the header logo with a white version

**CLAUDE CODE**

1. In the template, change the header `<img>` `src` to the white logo URL once Shalom provides it.
2. Keep `width="564"` and `max-width:564px` so the layout does not change.
3. Leave the navy background `#344d6b` as it is.

**YOU**

1. Export a white (reversed) version of the Time4Mishna logo as a PNG at the same width (564px or 2x).
2. Upload it to the public bucket, for example `storage.googleapis.com/prod_time4mishna/email/`.
3. Give Claude Code the final URL.

---

## Step 2: Align the English and Hebrew dates

**CLAUDE CODE**

1. Find the date block: the English date paragraph (`Monday 26 October 2026 · 15 Cheshvan 5787`) and the Hebrew date paragraph (`dir="rtl"`).
2. Set both lines to the same alignment. Use `text-align:left` on the Hebrew line and keep `dir="rtl"`.
3. Put both lines in one container so they share the same left edge.
4. Check that the date still renders correctly if the Hebrew line is in a separate paragraph.

**YOU**

- Send a test email to yourself and check the alignment in Gmail and Outlook.

---

## Step 3: Add masechta Overview and Key Terms links

**CLAUDE CODE**

1. Create a lookup table mapping each masechta to its Overview PDF and Key Terms PDF. Store it in the content database or as a config file, following the existing repo pattern.
2. Add a column or lookup key for each masechta.
3. In the template, render the two links below the Shiur and Text links, using the same style as those links. Show them only when the masechta has a URL in the lookup table.
4. Add a test that fails if a masechta is sent without a matching lookup entry.

**YOU**

1. Provide the list of Overview and Key Terms PDF URLs for each masechta.
2. Check that every PDF URL opens before going live.

---

## Step 4: Turn the footer social links into buttons

**CLAUDE CODE**

1. Replace the plain text social links (Facebook, YouTube, SoundCloud, Spotify, Website, Email us) with table-based buttons.
2. Each button should be a `<td>` with a background colour (`#007C89`), `border-radius:4px`, padding `8px 14px`, and a white text link with `text-decoration:none`.
3. Keep the button layout compatible with Outlook (table-based, no CSS-only buttons).
4. Keep the links and their `target="_blank"` attributes exactly as they are.

**YOU**

- Choose the button colour if `#007C89` is not right.

---

## Step 5: Add the calendar image

**CLAUDE CODE**

1. Add the calendar image block between the Shiur/Text section and the share block, to match the manual send.
2. Use the calendar image URL Shalom provides. Do not link to the Mailchimp CDN.
3. If the calendar changes per week or month, add a lookup or content field that selects the right image for the current period.

**YOU**

1. Export the calendar image for the current period.
2. Upload it to the public bucket (for example `storage.googleapis.com/prod_time4mishna/email/calendar/`).
3. Tell Claude Code how often the calendar changes and where the images will come from each time.

---

## Step 6: Remove test placeholders from the donate link

**CLAUDE CODE**

1. Find the donate links that include `<< Test Email Address >>`, `<< Test First Name >>`, and `<< Test Last Name >>` in the query string.
2. Remove those placeholder parameters and keep only the `message` parameter.
3. Confirm that no `<< ... >>` text remains anywhere in the template.

**YOU**

- Nothing, unless you want the donate link to pass recipient details. If so, confirm the parameter names with the donation provider.

---

## Step 7: Handle unsubscribe and preferences links

**CLAUDE CODE**

1. Identify the sending method (Mailchimp API or another provider).
2. If Mailchimp campaigns are used, replace `[UNIQID]` with the correct Mailchimp merge tags.
3. If another provider is used, replace the Mailchimp `list-manage` links with the provider's unsubscribe mechanism, or with a link that the sending code fills in per recipient.
4. Keep the unsubscribe link in the footer.

**YOU**

1. Decide whether the daily send will use Mailchimp campaigns or a different provider. This follows the provider decision recorded in the project overview.
2. Test an unsubscribe in a real inbox after the change.

---

## Step 8: Make the title format consistent

**CLAUDE CODE**

1. Change the title in the automated template from `Shabbos 16:3–16:6` to `Shabbos 16.3-16.6`, matching the manual send.
2. Check that the file names used for the SHIUR and TEXT links follow the same dotted format.
3. Make sure the email subject includes the special date when there is one (per the project decision).

**YOU**

- Confirm the dotted format is the one you want everywhere.

---

## Step 9: Test and review

**CLAUDE CODE**

1. Render the final HTML and check for unclosed tags, missing `alt` text, and leftover `<< ... >>` or `[UNIQID]` placeholders.
2. Generate a sample email for a real date and compare it section by section with the manual Mailchimp send.
3. Summarise any differences that remain.

**YOU**

1. Send a test email to at least Gmail, Outlook, and one mobile client.
2. Compare the test email with the manual send for layout, links, and the calendar image.
3. Approve the final template before it goes to subscribers.
