import json
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PATH_TO_FRONTEND = os.path.join(BASE_DIR, "..", "frontend", "public")
PATH_TO_WEATHER_DATA = os.path.join(BASE_DIR, "weather_data")


def _write_to_json(data: dict, file_path: str):
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(f"{file_path}.json", "w", encoding="utf-8") as f:
        json.dump(data, f, default=str)


def current_weather(df, zipcode):
    data = df.to_dict("index")["current"]
    _write_to_json(data, os.path.join(PATH_TO_WEATHER_DATA, f"{zipcode}_current"))


def forecast_weather_daily(df, zipcode):
    weekone = df.iloc[:7]
    weektwo = df.iloc[7:]
    _write_to_json(
        weekone.set_index("date").to_dict("index"),
        os.path.join(PATH_TO_WEATHER_DATA, f"{zipcode}_daily_weekone")
    )
    _write_to_json(
        weektwo.set_index("date").to_dict("index"),
        os.path.join(PATH_TO_WEATHER_DATA, f"{zipcode}_daily_weektwo")
    )


def forecast_weather_hourly(df, zipcode):
    data = df.set_index("time").to_dict("index")
    _write_to_json(data, os.path.join(PATH_TO_WEATHER_DATA, f"{zipcode}_hourly"))


def get_dict_from_json(zipcodes: list, cities: list) -> dict:
    data = {}
    for i, zipcode in enumerate(zipcodes):
        city = cities[i]
        filename = os.path.join(PATH_TO_FRONTEND, "structured_data", f"{zipcode}_structured.json")
        if os.path.exists(filename):
            with open(filename, "r", encoding="utf-8") as f:
                data[f"{zipcode}_{city}"] = json.load(f)
    return data


def write_structured_json(zipcode):
    filenames = ["current", "hourly", "daily_weekone", "daily_weektwo"]
    data = {}
    for filename in filenames:
        path = os.path.join(PATH_TO_WEATHER_DATA, f"{zipcode}_{filename}.json")
        with open(path, encoding="utf-8") as f:
            data[filename] = json.load(f)

    structured_path = os.path.join(PATH_TO_FRONTEND, "structured_data")
    os.makedirs(structured_path, exist_ok=True)
    with open(os.path.join(structured_path, f"{zipcode}_structured.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)


def write_prompt_to_txt(text: str, person: str):
    path = os.path.join(PATH_TO_FRONTEND, "weather_text_from_gpt")
    os.makedirs(path, exist_ok=True)
    with open(os.path.join(path, f"{person}.txt"), "w", encoding="utf-8") as f:
        f.write(text)
