# BigEastBot
# Created by jives00
# December 2018
#
# This bot updates the siderbar on /r/bigeast with scores, upcoming games and standings

import praw         # reddit functions
import config       # stores username, API keys, etc.
import datetime     # bumch of time functions
import time         # more time functions
import requests     # to use the ESPN API
import os           # to clear the screen in CLI mode (not needed outside of CLI testing)
import csv          # to store/read standings file

# ----------------------
# Login
# ----------------------
def bot_login():
    r = praw.Reddit(
            username        = config.username,
            password        = config.password,
            client_id       = config.client_id,
            client_secret   = config.client_secret,
            user_agent      = "jives00's Big East bot to update sidebar with scores and schedules")

    return r

# ----------------------
# Puts the sidebar together
# ----------------------
def run_bot(r, gameIDsRecorded):
    msg         = "---\n\n**Recent/Upcoming Games**\n"
    today       = datetime.date.today()
    numDays     = 8             # total number of days to display
    numBack     = 2             # starting point is today minus the numBack (e.g. 1 would be yesterday)

    # Scores and Schedule
    for x in range(numDays):
        d           = today + datetime.timedelta(days = x-numBack)                      # get the date for which games to pull
        dateURL     = str(d.year) + str(d.strftime('%m')) + str(d.strftime('%d'))       # format the date for the ESPN API URL - month, day must be 2 digits
        msg         += getGames(d, dateURL, gameIDsRecorded)                            # build the sidebar with the scores/schedule

    # Some static text/Reddit formatting
    msg += "\n---\n\n"
    msg += "*All times are Big East-ern time unless otherwise noted.*\n\n"
    msg += "---\n\n"

    # Standings
    msg += "**Big East Basketball Standings:**\n\n"
    msg += "TEAM | CONF | OVERALL\n"
    msg +=":--:|:--:|:--:\n"
    msg += getStandings()           # get the current standings

    # Rest of the sidebar text
    msg += getStaticText()          # get the rest of the sidebar (just text)

    # Print in terminal, uncomment for testing
    # print ("*** RUN AT " + datetime.datetime.now().strftime("%Y-%m-%d %H:%M") + " ***")
    # print (msg)

    # Update Sidebar
    sub                 = r.subreddit("bigeast")
    mod                 = sub.mod
    settings            = mod.settings()
    sidebar_current     = settings['description']

    if (msg == sidebar_current):
        print(datetime.datetime.now().strftime("%Y-%m-%d %H:%M") + ' - No changes to sidebar')
    else:
        sub.mod.update(description=msg)
        print(datetime.datetime.now().strftime("%Y-%m-%d %H:%M") + ' - Sidebar updated')

# ----------------------
# Pull game scores/schedule
# ----------------------
def getGames(d, date, gameIDsRecorded):
    i       = 0
    msg     = ""
    URL     =   "http://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/"
    URL     +=  "scoreboard?lang=en&region=us&calendartype=blacklist&limit=300&dates="
    URL     +=  date + "&groups=4"
    API     = requests.get(URL).json()

    # Print the date just once
    datePrint = d.strftime("%A") + ", " + d.strftime("%B") + " " + str(d.day)

    if (10 <= d.day % 100 < 20):
        suffix = 'th'
    else:
        suffix = {1 : 'st', 2 : 'nd', 3 : 'rd'}.get(d.day % 10, "th")

    try:
        if (API['events'][0]):
            msg += '\n**' + datePrint + '^' + suffix + '**\n\n'
    except:
        pass

    # Print the game details
    for game in API['events']:

        # Get API game values
        status         =   API['events'][i]['status']['type']['name']
        timeLeft       =   API['events'][i]['status']['type']['detail']
        homeTeam       =   API['events'][i]['competitions'][0]['competitors'][0]['team']['shortDisplayName']
        awayTeam       =   API['events'][i]['competitions'][0]['competitors'][1]['team']['shortDisplayName']
        homeScore      =   int(API['events'][i]['competitions'][0]['competitors'][0]['score'])
        awayScore      =   int(API['events'][i]['competitions'][0]['competitors'][1]['score'])
        gameID         =   API['events'][i]['id']

        # get start time, with lowercase AM/PM or current score/time if in progress
        startTime      =   API['events'][i]['competitions'][0]['status']['type']['shortDetail']
        startTime      =   startTime.split()
        if (startTime[0] == "TBD"):
            startTime = "TBD"
        else:
            try:
                startTime = startTime[2] + startTime[3].lower()
            except:
                startTime = str(awayScore) + '-' + str(homeScore) + ' | ' + \
                str(API['events'][i]['competitions'][0]['status']['type']['detail'])

        # get TV station, if it exists
        try:         station = ' on ' + API['events'][i]['competitions'][0]['broadcasts'][0]['names'][0]
        except:      pass

        # Determine print message; if game is finished, update the standings
        if (status == 'STATUS_FINAL' and (awayScore > homeScore)):
            result = '* **' + awayTeam + '** vs ' + homeTeam + ' ' + str(awayScore) + '-' + str(homeScore) + '\n\n'
            updateStandings(gameID, awayTeam, homeTeam, gameIDsRecorded)
        elif (status == 'STATUS_FINAL' and (homeScore > awayScore)):
            result = '* ' + awayTeam + ' vs **' + homeTeam + '**'+ ' ' + str(awayScore) + '-' + str(homeScore) + '\n\n'
            updateStandings(gameID, homeTeam, awayTeam, gameIDsRecorded)
        else:
            result = '* ' + awayTeam + ' vs ' + homeTeam + ', ' + startTime + station + '\n\n'

        # Wrap up
        i += 1
        msg += result

    # Sort the CSV file
    sortStandings()

    return msg

# ----------------------
# Put standings together
# ----------------------

# read the CSV file and put in Reddit formatting
def getStandings():

    with open('standingsSorted.csv') as file:
        csv_reader      = csv.reader(file, delimiter=',')
        standings       = ""

        # print each row, skipping the header row
        for row in csv_reader:
            if (row[0] == 'Team'):
                pass
            else:
                teamName = '[' + row[0] + '](' + row[1] + ')'
                standings += (teamName + ' | ' + row[4] + '-' + row[5] + ' | ' + row[2] + '-' + row[3] +'\n')

    return standings

# update after a game goes final
def updateStandings(gameID, winningTeam, losingTeam, gameIDsRecorded):

    # Alphabetical listing of BE teams
    # CSV file must be in the same alpha order and spelling/capitalization
    BETeams = ["Butler", "Creighton", "DePaul", "Georgetown", "Marquette",\
               "Providence", "Seton Hall", "St. John's", "Villanova", "Xavier"]

    # add games to a file so to not update more than once
    # this whole section could be cleaned up, but it works so I don't want to touch it
    if (gameID not in gameIDsRecorded):
        gameIDsRecorded.append(gameID)
        with open("gameIDs.txt", "a") as file:
            file.write(gameID + "\n")

        # update overall wins
        if (winningTeam in BETeams):
            rowNum = BETeams.index(winningTeam) + 1
            f = open('standings.csv', 'r')
            reader = csv.reader(f)
            mylist = list(reader)
            f.close()
            mylist[rowNum][2] = int(mylist[rowNum][2]) + 1
            my_new_list = open('standings.csv', 'w', newline = '')
            csv_writer = csv.writer(my_new_list)
            csv_writer.writerows(mylist)
            my_new_list.close()

            # update conference wins
            if (losingTeam in BETeams):
                f = open('standings.csv', 'r')
                reader = csv.reader(f)
                mylist = list(reader)
                f.close()
                mylist[rowNum][4] = int(mylist[rowNum][4]) + 1
                my_new_list = open('standings.csv', 'w', newline = '')
                csv_writer = csv.writer(my_new_list)
                csv_writer.writerows(mylist)
                my_new_list.close()

        # update overall losses
        if (losingTeam in BETeams):
            rowNum = BETeams.index(losingTeam) + 1
            f = open('standings.csv', 'r')
            reader = csv.reader(f)
            mylist = list(reader)
            f.close()
            mylist[rowNum][3] = int(mylist[rowNum][3]) + 1
            my_new_list = open('standings.csv', 'w', newline = '')
            csv_writer = csv.writer(my_new_list)
            csv_writer.writerows(mylist)
            my_new_list.close()

            # update conference losses
            if (winningTeam in BETeams):
                f = open('standings.csv', 'r')
                reader = csv.reader(f)
                mylist = list(reader)
                f.close()
                mylist[rowNum][5] = int(mylist[rowNum][5]) + 1
                my_new_list = open('standings.csv', 'w', newline = '')
                csv_writer = csv.writer(my_new_list)
                csv_writer.writerows(mylist)
                my_new_list.close()

        else:
            pass


# sort the CSV file
# sorting goes: confLoss first, then confWins, then overallLosses, then overallWins
# smallest number of losses is first, if tied then more wins comes first
def sortStandings():
    # get the data into a list and sort in python
    with open('standings.csv',newline='') as csvfile:
        spamreader = csv.DictReader(csvfile, delimiter=",")
        sortedlist = sorted(spamreader, key=lambda row:(int(row['ConfLosses']), -int(row['ConfWins']), \
            int(row['OverallLosses']),-int(row['OverallWins'])), reverse=False)

    # take the sorted list and put it into a CSV file
    with open('standingsSorted.csv', 'w') as f:
        fieldnames = ['Team','URL', 'OverallWins', 'OverallLosses', 'ConfWins', 'ConfLosses']
        writer = csv.DictWriter(f, fieldnames=fieldnames, lineterminator='\n')
        writer.writeheader()
        for row in sortedlist:
            writer.writerow(row)

# get the game IDs to skip
def getGameIDs():
    if not os.path.isfile("gameIDs.txt"):
        gameIDsRecorded = []
    else:
        with open("gameIDs.txt", "r") as file:
            gameIDsRecorded = file.read()
            gameIDsRecorded = gameIDsRecorded.split("\n")

    return gameIDsRecorded

# ----------------------
# Static text at the end
# ----------------------
def getStaticText():
    msg = "\n*Rankings from AP Poll*\n\n"
    msg += "---\n\n"
    msg += "Welcome to the Big East Conference subreddit! Step right up and post your Big East news, "
    msg += "team news that could affect the conference, a picture of you at a game, your mom at a game, "
    msg += "and especially any hype videos! "
    msg += "Basically, we'll tell you if we don't want you to post something. GET TO IT!\n\n"
    msg += "---\n\n"
    msg += "**School Specific Subreddits**\n\n"
    msg += "* /r/ButlerUniversity\n\n"
    msg += "* /r/Creighton || /r/whiteandblue\n\n"
    msg += "* /r/DePaul\n\n"
    msg += "* /r/Georgetown\n\n"
    msg += "* /r/Marquette || /r/mubb\n\n"
    msg += "* /r/ProvidenceCollege || /r/pcbb\n\n"
    msg += "* /r/SHU || /r/shubb\n\n"
    msg += "* /r/StJohns\n\n"
    msg += "* /r/Villanova\n\n"
    msg += "* /r/XavierUniversity\n\n"
    msg += "---\n\n"
    msg += "**Other College Basketball Subreddits:**\n\n"
    msg += "* /r/CollegeBasketball\n\n"
    msg += "* /r/ACC\n\n"
    msg += "* /r/AmericanAthletic\n\n"
    msg += "* /r/Atlantic10\n\n"
    msg += "* /r/TheB1G\n\n"
    msg += "* /r/BigXII\n\n"
    msg += "* /r/Conference_USA\n\n"
    msg += "* /r/MidAmerican\n\n"
    msg += "* /r/MountainWest\n\n"
    msg += "* /r/Pac12\n\n"
    msg += "* /r/SEC\n\n"
    msg += "---\n\n"
    msg += "**Other Stuff:**\n\n"
    msg += "* [Big East Team Blogs and Forums](http://www.reddit.com/r/bigeast/wiki/externalsites)\n\n"
    msg += "* [/r/BigEast Traffic Stats](http://www.reddit.com/r/BigEast/about/traffic/)\n\n"
    msg += "* [Archive of Sidebar Images](http://www.reddit.com/r/bigeast/wiki/sidebarimages)\n\n\n"
    msg += '[Butler Bulldogs](http://www.butlersports.com/ "Butler Bulldogs")\n'
    msg += '[Creighton Blue Jays](http://www.gocreighton.com/ "Creighton Bluejays")\n'
    msg += '[DePaul Blue Demons](http://www.depaulbluedemons.com/ "DePaul Blue Demons")\n'
    msg += '[Georgetown Hoyas](http://www.guhoyas.com/ "Georgetown Hoyas")\n'
    msg += '[Marquette Golden Eagles](http://www.gomarquette.com/ "Marquette Golden Eagles")\n'
    msg += '[Providence Friars](http://www.friars.com/ "Providence Friars")\n'
    msg += '[Seton Hall Pirates](http://www.shupirates.com/ "Seton Hall Pirates")\n'
    msg += '[St. Johns Red Storm](http://www.redstormsports.com/ "St. Johns Red Storm")\n'
    msg += '[Villanova Wildcats](http://www.villanova.com/ "Villanova Wildcats")\n'
    msg += '[Xavier Musketeers](http://www.goxavier.com/ "Xavier Musketeers")\n\n'
    msg += "#####[Big East](http://reddit.com/r/BigEast)"

    return msg

# ----------------------
# Main Method
# ----------------------
r                   = bot_login()                           # login to reddit and return an instance of that login
gameIDsRecorded     = getGameIDs()                          # read the file with what gameIds are already recorded
duration            = 900                                   # number of seconds between calls to the API and sidebar updates
month               = datetime.datetime.now().month
hour                = datetime.datetime.now().hour
day                 = datetime.datetime.now().weekday()     # Mon - 0, Tues - 1, Weds - 2, Thurs - 3, Fri - 4, Sat - 5, Sun - 6

while(True):
    run_bot(r, gameIDsRecorded)

    # if betwen May and September, run only once a month
    if (month >= 5 and month <= 9):
        print(datetime.datetime.now().strftime("%Y-%m-%d %H:%M") + ' - Sleeping for another month')
        time.sleep(2500000)

    # if 1am, sleep for about 9 hours
    elif (hour == 1):
        print(datetime.datetime.now().strftime("%Y-%m-%d %H:%M") + ' - Sleeping for the night')
        time.sleep(32000)

    # otherwise run every 15 minutes
    else:
        time.sleep(900)
