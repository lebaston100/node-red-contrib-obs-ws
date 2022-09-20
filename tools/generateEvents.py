import asyncio
import aiohttp
import pyperclip
import json

"""Generate the available obs types and format them as a javascript array"""

async def loadGithubJson() -> None:
    url = "https://github.com/obsproject/obs-websocket/raw/master/docs/generated/protocol.json"
    response = None
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as resp:
                response = await resp.json(content_type="text/plain")
    except Exception as E:
        raise E
    else:
        #print(json.dumps(response["events"], indent=2, sort_keys=True))

        charsInLine = 0
        outputText = "const websocketEventTypes = [\n        "
        for event in response["events"]:
            if charsInLine > 80:
                charsInLine = 0
                outputText += "\n        "
            outputText += f'"{event["eventType"]}",'
            charsInLine += len(event["eventType"])

        outputText = outputText[:-1].rstrip()
        outputText += "\n    ];"
        print(outputText)
        pyperclip.copy(outputText)

asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
loop = asyncio.get_event_loop()
try:
    loop.run_until_complete(loadGithubJson())
finally:
    loop.close()