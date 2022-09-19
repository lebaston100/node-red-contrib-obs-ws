import asyncio
import aiohttp
import logging
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
        #print(json.dumps(response["requests"], indent=2, sort_keys=True))

        charsInLine = 0
        outputText = "const websocketNoDataRequestTypes = [\n\t"
        for event in response["requests"]:
            requestType = event["requestType"]
            requestFields = event["requestFields"]
            if len(requestFields) == 0 or not list(filter(lambda rF: not rF["valueOptional"], event["requestFields"])):
                if charsInLine > 80:
                    charsInLine = 0
                    outputText += "\n\t"
                outputText += f'"{requestType}", '
                charsInLine += len(requestType)
        outputText = outputText[:-2]
        outputText += "\n];"
        print(outputText)

asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
loop = asyncio.get_event_loop()
try:
    loop.run_until_complete(loadGithubJson())
finally:
    loop.close()