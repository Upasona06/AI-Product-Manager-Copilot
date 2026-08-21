import urllib.request
import urllib.error

try:
    urllib.request.urlopen('http://localhost:5000/api/reports')
except urllib.error.HTTPError as e:
    print("STATUS_CODE:", e.code)
except Exception as e:
    print("ERROR:", e)
