import json
import argparse
import feedparser
from datetime import datetime
import urllib.parse as urlparse

# Install dependencies
# brew install python3
# sudo apt install python3
# pip3 install feedparser

parser = argparse.ArgumentParser(description='Seismic monitor')
parser.add_argument('-m', '--min_magnitude', dest="min_magnitude", default=4.0, type=float, help='Excludes occurrences below the especified richter magnitude, default=4.0')
parser.add_argument('-d', '--last_occurrence', dest="last_occurrence_datime", metavar='YYYY-MM-DDThh:mm:ssTZD', default=datetime.now(), type=datetime.fromisoformat, help='Sets the datetime for the last occurrence, default=now()')
arguments = parser.parse_args()

def ssn() :
	feed = feedparser.parse('http://www.ssn.unam.mx/rss/ultimos-sismos.xml')
	for entry in feed['entries'] :
		link = entry['link']
		url = urlparse.urlparse(link)
		location = urlparse.parse_qs(url.query)['loc'][0].strip()
		magnitude = float(urlparse.parse_qs(url.query)['ma'][0])
		date = datetime.strptime(urlparse.parse_qs(url.query)['fecha'][0] + " " + urlparse.parse_qs(url.query)['hora'][0], '%Y-%m-%d %H:%M:%S').astimezone(arguments.last_occurrence_datime.tzinfo)
		if date >= arguments.last_occurrence_datime :
			if magnitude >= arguments.min_magnitude :
				return {'magnitude': magnitude, 'location': location, 'date': str(date.isoformat())}
	return 

print(json.dumps(ssn()))