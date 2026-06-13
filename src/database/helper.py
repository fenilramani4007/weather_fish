def precipitation(precipitation, rain, shower):
    if precipitation > 0 or rain > 0 or shower > 0:
        return "rain"
    return ""


def meancloudcover(mean):
    if 10 < mean <= 40:
        return "partly cloudy"
    if mean > 40:
        return "cloudy"
    return "clear"
