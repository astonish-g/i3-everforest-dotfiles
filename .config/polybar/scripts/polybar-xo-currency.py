#!/usr/bin python
# coding: utf-8
# Polybar XO Currency
# https://t.me/XO490

BASE_URL = 'https://freecurrencyrates.com/api/action.php?do=cvals&iso={}&f={}&v={}&s=cbr'
useragent = {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64; rv:76.0) Gecko/20100101 Firefox/76.0'}
proxy = None
# proxy = {'http': 'http://45.76.255.75:3128'}  # you favourites proxy

import requests
import sys
import json


def save_json(data, filename):
    if data:
        with open(f'/tmp/{filename}', 'w') as file:
            json.dump(data, file, ensure_ascii=False)


def open_json(filename):
    try:
        with open(f'/tmp/{filename}', 'r') as file:
            data = json.load(file)
    except:
        mycur = filename.split('_')[0].upper()
        data = {"updated": "", mycur: 0}
        return data
    else:
        return data


def get_response(mycur, anycur, value=None):
    try:
        if value is None:
            value = 1
        r = requests.get(url=BASE_URL.format(mycur, anycur, value),
                         headers=useragent,
                         proxies=proxy,
                         timeout=60,
                         allow_redirects=True)
        r.encoding = 'utf-8'
    except:
        return None
    else:
        return r.json()


def get_attr():
    argv = sys.argv
    if (len(argv) < 3) or (len(argv) > 4):
        sys.exit('\nUSAGE:\n\tExample: python main.py rub usd\n\t\t python main.py rub eur 2\n')
    if (len(argv) == 3):
        mycur = argv[1]
        anycur = argv[2]
        data = {'mycur': mycur, 'anycur': anycur}
    if (len(argv) == 4):
        mycur = argv[1]
        anycur = argv[2]
        value = argv[3]
        data = {'mycur': mycur, 'anycur': anycur, 'value': value}
    return data


def main():
    attr = get_attr()
    mycur = attr.get('mycur')
    anycur = attr.get('anycur')
    value = attr.get('value')
    filename_saveopen_json = f'{mycur}_{anycur}.json'
    try:
        resp = get_response(mycur, anycur, value=value)
    except:
        print('ISO currency code error')
    else:
        if resp is not None:
            save_json(resp, filename_saveopen_json)
            curs = round(resp[mycur.upper()], 2)
            print(f'{curs}')
        else:
            resp = open_json(filename_saveopen_json)
            curs = round(resp[mycur.upper()], 2)
            print(f'{curs}!')


if __name__ == "__main__":
    main()
