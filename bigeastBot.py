# BigEastBot
# Created by jives00
# December 2018
#
# This bot updates the sidebar on /r/bigeast with scores, upcoming games and standings

import praw
import os
import datetime
import time
import requests
import csv
from titlecase import titlecase

DATA_DIR = os.environ.get('DATA_DIR', os.path.dirname(os.path.abspath(__file__)))


def data_path(filename):
    return os.path.join(DATA_DIR, filename)


def bot_login():
    r = praw.Reddit(
        username=os.environ['REDDIT_USERNAME'],
        password=os.environ['REDDIT_PASSWORD'],
        client_id=os.environ['REDDIT_CLIENT_ID'],
        client_secret=os.environ['REDDIT_CLIENT_SECRET'],
        user_agent="jives00's Big East bot to update sidebar with scores and schedules")
    return r


def run_bot(r, gameIDsRecorded):
    msg = "---\n\n**Recent/Upcoming Games**\n\n"
    today = datetime.date.today()
    numDays = 14
    numBack = 1

    for x in range(numDays):
        d = today + datetime.timedelta(days=x-numBack)
        dateURL = str(d.year) + str(d.strftime('%m')) + str(d.strftime('%d'))
        msg += getGames(d, dateURL, gameIDsRecorded)

    msg += "\n---\n\n"
    msg += "*All times are Big East-ern time unless otherwise noted.*\n\n"
    msg += "---\n\n"
    msg += "**Big East Basketball Standings:**\n\n"
    msg += "TEAM | CONF | OVERALL\n"
    msg += ":--:|:--:|:--:\n"
    msg += getStandings()
    msg += getStaticText()

    sub = r.subreddit("bigeast")
    mod = sub.mod
    settings = mod.settings()
    sidebar_current = settings['description']

    if (msg == sidebar_current):
        print(datetime.datetime.now().strftime("%Y-%m-%d %H:%M") + ' - No changes to sidebar')
    else:
        r.subreddit('bigeast').wiki['config/sidebar'].edit(msg)
        print(datetime.datetime.now().strftime("%Y-%m-%d %H:%M") + ' - Sidebar updated')


def getGames(d, date, gameIDsRecorded):
    i = 0
    msg = ""
    URL = "http://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/"
    URL += "scoreboard?lang=en&region=us&calendartype=blacklist&limit=300&dates="
    URL += date + "&groups=4"
    API = requests.get(URL).json()

    datePrint = d.strftime("%A") + ", " + d.strftime("%B") + " " + str(d.day)

    if (10 <= d.day % 100 < 20):
        suffix = 'th'
    else:
        suffix = {1: 'st', 2: 'nd', 3: 'rd'}.get(d.day % 10, "th")

    try:
        if (API['events'][0]):
            msg += '\n**' + datePrint + suffix + '**\n\n'
    except:
        pass

    for game in API['events']:
        status = API['events'][i]['status']['type']['name']
        timeLeft = API['events'][i]['status']['type']['detail']
        homeTeam = API['events'][i]['competitions'][0]['competitors'][0]['team']['shortDisplayName']
        awayTeam = API['events'][i]['competitions'][0]['competitors'][1]['team']['shortDisplayName']
        homeScore = int(API['events'][i]['competitions'][0]['competitors'][0]['score'])
        awayScore = int(API['events'][i]['competitions'][0]['competitors'][1]['score'])
        gameID = API['events'][i]['id']
        try:
            homeRank = API['events'][i]['competitions'][0]['competitors'][0]['curatedRank']['current']
        except:
            homeRank = 99
        try:
            awayRank = API['events'][i]['competitions'][0]['competitors'][1]['curatedRank']['current']
        except:
            awayRank = 99
        if(homeRank) > 25:
            homeRank = ''
        elif(homeRank) == 0:
            homeRank = ''
        else:
            homeRank = '#' + str(homeRank)
        if(awayRank) > 25:
            awayRank = ''
        elif(awayRank) == 0:
            awayRank = ''
        else:
            awayRank = '#' + str(awayRank)

        startTime = API['events'][i]['competitions'][0]['status']['type']['shortDetail']
        startTime = startTime.split()
        if (startTime[0] == "TBD"):
            startTime = "TBD"
        else:
            try:
                startTime = startTime[2] + startTime[3].lower()
            except:
                startTime = str(awayScore) + '-' + str(homeScore) + ' | ' + \
                    str(API['events'][i]['competitions'][0]['status']['type']['detail'])

        try:
            headline = API['events'][i]['competitions'][0]['notes'][0]['headline']
            if ("NIT" in headline):
                tournament = "NIT - "
            elif ("CBI" in headline):
                tournament = "CBIT - "
            elif ("MEN'S BASKETBALL CHAMPIONSHIP" in headline):
                tournament = "NCAA - "
            elif ("BIG EAST MEN'S CHAMPIONSHIP" in headline):
                tournament = "Big East Tournament - "
            else:
                tournament = ""
        except:
            tournament = ""

        try:
            station = ' on ' + API['events'][i]['competitions'][0]['broadcasts'][0]['names'][0]
        except:
            station = ''

        if (status == 'STATUS_FINAL' and (awayScore > homeScore)):
            if(awayRank == ''):
                result = '* ' + tournament + ' **' + awayTeam + '** vs ' + homeTeam + \
                    ' ' + str(awayScore) + '-' + str(homeScore) + ' ' + '\n\n'
            else:
                result = '* ' + tournament + ' **' + awayRank + ' ' + awayTeam + '** vs ' + \
                    homeTeam + ' ' + str(awayScore) + '-' + str(homeScore) + ' ' + '\n\n'
            updateStandings(gameID, awayTeam, homeTeam, gameIDsRecorded)

        elif (status == 'STATUS_FINAL' and (homeScore > awayScore)):
            if(homeRank == ''):
                result = '* ' + tournament + ' ' + awayRank + ' ' + awayTeam + ' vs **' + \
                    homeTeam + '**' + ' ' + str(awayScore) + '-' + str(homeScore) + ' ' + '\n\n'
            else:
                result = '* ' + tournament + ' ' + awayRank + ' ' + awayTeam + ' vs **' + homeRank + \
                    ' ' + homeTeam + '** ' + str(awayScore) + '-' + str(homeScore) + ' ' + '\n\n'
            updateStandings(gameID, homeTeam, awayTeam, gameIDsRecorded)

        else:
            result = '* ' + tournament + ' ' + awayRank + ' ' + awayTeam + ' vs ' + \
                homeRank + ' ' + homeTeam + ', ' + startTime + station + '\n\n'

        i += 1
        msg += result

    sortStandings()
    return msg


def getStandings():
    with open(data_path('standingsSorted.csv')) as file:
        csv_reader = csv.reader(file, delimiter=',')
        standings = ""
        for row in csv_reader:
            if (row[0] == 'Team'):
                pass
            else:
                teamName = '[' + row[0] + '](' + row[1] + ')'
                standings += (teamName + ' | ' + row[4] + '-' + row[5] + ' | ' + row[2] + '-' + row[3] + '\n')
    return standings


def updateStandings(gameID, winningTeam, losingTeam, gameIDsRecorded):
    BETeams = ["Butler", "Creighton", "DePaul", "Georgetown", "Marquette",
               "Providence", "Seton Hall", "St John's", "UConn", "Villanova", "Xavier"]

    if (gameID not in gameIDsRecorded):
        gameIDsRecorded.append(gameID)
        with open(data_path("gameIDs.txt"), "a") as file:
            file.write(gameID + "\n")

        if (winningTeam in BETeams):
            rowNum = BETeams.index(winningTeam) + 1
            f = open(data_path('standings.csv'), 'r')
            reader = csv.reader(f)
            mylist = list(reader)
            f.close()
            mylist[rowNum][2] = int(mylist[rowNum][2]) + 1
            my_new_list = open(data_path('standings.csv'), 'w', newline='')
            csv_writer = csv.writer(my_new_list)
            csv_writer.writerows(mylist)
            my_new_list.close()

            if (losingTeam in BETeams):
                f = open(data_path('standings.csv'), 'r')
                reader = csv.reader(f)
                mylist = list(reader)
                f.close()
                mylist[rowNum][4] = int(mylist[rowNum][4]) + 1
                my_new_list = open(data_path('standings.csv'), 'w', newline='')
                csv_writer = csv.writer(my_new_list)
                csv_writer.writerows(mylist)
                my_new_list.close()

        if (losingTeam in BETeams):
            rowNum = BETeams.index(losingTeam) + 1
            f = open(data_path('standings.csv'), 'r')
            reader = csv.reader(f)
            mylist = list(reader)
            f.close()
            mylist[rowNum][3] = int(mylist[rowNum][3]) + 1
            my_new_list = open(data_path('standings.csv'), 'w', newline='')
            csv_writer = csv.writer(my_new_list)
            csv_writer.writerows(mylist)
            my_new_list.close()

            if (winningTeam in BETeams):
                f = open(data_path('standings.csv'), 'r')
                reader = csv.reader(f)
                mylist = list(reader)
                f.close()
                mylist[rowNum][5] = int(mylist[rowNum][5]) + 1
                my_new_list = open(data_path('standings.csv'), 'w', newline='')
                csv_writer = csv.writer(my_new_list)
                csv_writer.writerows(mylist)
                my_new_list.close()


def sortStandings():
    with open(data_path('standings.csv'), newline='') as csvfile:
        spamreader = csv.DictReader(csvfile, delimiter=",")
        sortedlist = sorted(spamreader, key=lambda row: (int(row['ConfLosses']), -int(row['ConfWins']),
                                                         int(row['OverallLosses']), -int(row['OverallWins'])), reverse=False)

    with open(data_path('standingsSorted.csv'), 'w') as f:
        fieldnames = ['Team', 'URL', 'OverallWins', 'OverallLosses', 'ConfWins', 'ConfLosses']
        writer = csv.DictWriter(f, fieldnames=fieldnames, lineterminator='\n')
        writer.writeheader()
        for row in sortedlist:
            writer.writerow(row)


def getGameIDs():
    path = data_path("gameIDs.txt")
    if not os.path.isfile(path):
        return []
    with open(path, "r") as file:
        return file.read().split("\n")


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
    msg += "* /r/SECbasketball/\n\n"
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
    msg += '[Connecticut Huskies](https://uconnhuskies.com/ "Connecticut Huskies")\n'
    msg += '[Villanova Wildcats](http://www.villanova.com/ "Villanova Wildcats")\n'
    msg += '[Xavier Musketeers](http://www.goxavier.com/ "Xavier Musketeers")\n\n'
    msg += "#####[Big East](http://reddit.com/r/BigEast)"
    return msg


if __name__ == '__main__':
    r = bot_login()
    gameIDsRecorded = getGameIDs()

    while True:
        run_bot(r, gameIDsRecorded)

        month = datetime.datetime.now().month
        hour = datetime.datetime.now().hour

        if (month >= 5 and month <= 9):
            print(datetime.datetime.now().strftime("%Y-%m-%d %H:%M") + ' - Sleeping for another month')
            time.sleep(2500000)
        elif (hour == 1):
            print(datetime.datetime.now().strftime("%Y-%m-%d %H:%M") + ' - Sleeping for the night')
            time.sleep(32000)
        else:
            time.sleep(150)
