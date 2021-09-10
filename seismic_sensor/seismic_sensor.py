import json
import argparse
import requests
import feedparser
from bs4 import BeautifulSoup
import urllib.parse as urlparse
from datetime import datetime, timedelta

# Install dependencies
# brew install python3
# sudo apt install python3
# pip3 install feedparser requests beautifulsoup4

parser = argparse.ArgumentParser(description='Seismic monitor')
parser.add_argument('-m', '--min_magnitude', dest = 'min_magnitude', default = 5.0, type = float, help = 'Excludes earthquakes below the especified richter magnitude, default = 5.0')
parser.add_argument('-d', '--last_earthquake', dest = 'last_earthquake_datetime', metavar = 'YYYY-MM-DDThh:mm:ssTZD', default = (datetime.now() - timedelta(minutes = 1)), type = datetime.fromisoformat, help = 'Excludes earthquakes that happened before this datetime, default = One minute ago')
arguments = parser.parse_args()

def isValidData(date, magnitude) :
	return (magnitude >= arguments.min_magnitude) and (date >= arguments.last_earthquake_datetime)

def check_ssn() :
	feed = feedparser.parse('http://www.ssn.unam.mx/rss/ultimos-sismos.xml')
	for entry in feed['entries'] :
		try :
			link = entry['link']
			url = urlparse.urlparse(link)
			location = urlparse.parse_qs(url.query)['loc'][0].strip()
			magnitude = float(urlparse.parse_qs(url.query)['ma'][0])
			date = datetime.strptime(urlparse.parse_qs(url.query)['fecha'][0] + " " + urlparse.parse_qs(url.query)['hora'][0], '%Y-%m-%d %H:%M:%S').astimezone(arguments.last_earthquake_datetime.tzinfo)
			if isValidData(date, magnitude)  :
				return {'magnitude': magnitude, 'location': location, 'date': date.isoformat()}
		except :
			continue

def check_sasmex() :
	url = "http://www.cires.org.mx/sasmex_historico_buscador_resultado_es_n.php"
	payload = {
		'anio': '2021',
		'mes': '09',
		'tipoaviso': '03',
		'ciudad': '01'
	}
	page = requests.request("POST", url, data=payload)
	soup = BeautifulSoup(page.content, "html.parser")
	rows = soup.find_all("tr")
	for row in rows :
		try :
			if len(row.contents) < 6 :
				continue
			columns = row.contents
			magnitude = float(columns[9].text.strip())
			date = datetime.strptime(columns[3].contents[1].text.strip() + " " + columns[5].text.strip(), '%Y-%m-%d %H:%M:%S').astimezone(arguments.last_earthquake_datetime.tzinfo)
			if isValidData(date, magnitude) :
				return {'magnitude': magnitude, 'location': 'N/A', 'date': date.isoformat()}
		except :
			continue

def main() :
	ssn = check_ssn()
	sasmex = check_sasmex()
	if ssn and sasmex :
		if ssn['date'] == sasmex['date'] :
			if ssn['magnitude'] >= sasmex['magnitude'] :
				return ssn
			return sasmex
		elif ssn['date'] > sasmex['date'] :
			return ssn
		return sasmex
	elif ssn :
		return ssn
	elif sasmex :
		return sasmex
	return {'magnitude': 0, 'location': 'N/A', 'date': arguments.last_earthquake_datetime.isoformat()}

print(json.dumps(main()))