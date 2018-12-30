# BigEastBot
Reddit bot to update scores/schedules/standings on /r/bigeast

config.py is not included, this file contains the login information, API key, etc. for reddit.

These files *should* be created by the code automatically, but you may need to make empty ones if it doesn't work:

1) gameIDs.txt - a txt file that simply holds the game IDs so they don't get added to the standings again
2) standings.csv - a csv file with columns for: Team, URL (a wiki link), overall wins, overall losses, conference wins, conference losses.  The order in this file must be alphabetical and match the array in the main python file.
3) standingsSorted.csv - the same as the standings.csv file, but sorted by record.  This is the file used to generate the sidebar text.
