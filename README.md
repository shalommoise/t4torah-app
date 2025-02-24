# Time4Torah Automate Porject

Task is to automate all Time4 Torah Porgrams

- Time4Mishna
- Time4Nach
- Time4Tefilla

## Features required

- Hebrew date APi to skip Shabbos ad Yom tov
- storage of all shiurim
- mishna texts (Sefaria API)
- Database index of shiurim
- storage of summary sheets and diagrams
- Database indexing of summary sheets diagrams
- upload and convert Time4Tefilla shiurim from WhatsApp
- Regenerate RSS Feed
- track links
- integrate with mailchimp
- Admin Level users (time4torah and jfuture emails only)
- Admin Upload of new summarry sheets


# bonus

- users to create own schedules
- Users can save where they are up to 
- Swap in API into App
- enhaced tracking of links
- Custom emails  not using mailchimp
- Google form quizes and results (AI generated)


## Tools

- Hebrew Date API
- Sefaria API
- Firebase user login
- API Client (Express for node?)
- MYSQL DB
- (Google) Cloud storage
- 


## API split

1. Internal 
   - Creating DB
   - Pulling from Sefaria
    - creating dates

2. Admin
  - uploading new shiurim
  - Editing different shiurim
  - uploading new summary sheets

3. Standard
  - Fetching shiurim
  - Downloading Bulk shiurim
  - Fetching Schedule


## Projects
 1. date  -store all dates or function to calculate from start date? 


